/**
 * O coração de PREP-02: `exportarClickUp(opcoes)` materializa o JSON bruto
 * das 3 Listas do ClickUp — Lista, Campos, Membros, Tarefas (abertas +
 * fechadas + subtarefas, e uma segunda passada de arquivadas), detalhe por
 * Tarefa, Comentários, `time_in_status` best-effort e os anexos baixados —
 * um arquivo por recurso e por página, exatamente como a API devolveu
 * (D-03: nunca reserializado).
 *
 * Guarda de retomada (RESEARCH.md Pitfall 4): o próprio filesystem é o
 * checkpoint. Antes de qualquer chamada de rede, `lerSeValido` confere se o
 * arquivo já existe e é válido; se sim, a chamada nunca acontece. Toda
 * gravação é atômica (`gravarAtomico`: escreve `<caminho>.tmp`, faz
 * `rename`) — um arquivo pela metade nunca passa a existir com o nome final,
 * então uma interrupção no meio de uma gravação nunca engana a retomada.
 *
 * O que este arquivo NÃO faz: não transforma o JSON da API (o mapper nasce
 * na importação, Fases 2/3), não indexa nada, não grava no Postgres, não
 * chama `inviteMember` nem cria Membro — só descreve/soma quem apareceu
 * (`coletarUsuarios`, D-12). Ressalva de histórico: a API pública do
 * ClickUp não expõe histórico cronológico de mudança de status
 * (RESEARCH.md Pitfall 1); `time_in_status` é tempo acumulado por status,
 * não uma trilha de auditoria — gravado best-effort, decidido por um smoke
 * test na primeira chamada da execução (Pitfall 2).
 *
 * A orquestração (`exportarClickUp`) é implementada nesta mesma pasta na
 * Task 2 — esta versão do arquivo (Task 1) só declara os utilitários que a
 * sustentam: gravação atômica, retomada, sanitização de caminho de anexo
 * (T-0-06, path traversal) e a coleta de anexos/usuários vistos.
 */

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ClienteClickUp } from "./cliente";

export const LISTAS = {
  solicitacao: "901109104938",
  contasAPagar: "901107637383",
  contasAReceber: "901107648977",
} as const;

export const TODAS_AS_LISTAS: readonly string[] = Object.values(LISTAS);

/** 50 MiB (T-0-08) — anexo maior que isto é pulado com aviso, nunca aborta a exportação. */
export const TAMANHO_MAXIMO_DE_ANEXO = 50 * 1024 * 1024;

export type PoliticaDeAnexos = "todas" | "nenhuma";

export interface OpcoesDaExportacao {
  readonly cliente: ClienteClickUp;
  /** Absoluto; ex.: `<repo>/apps/api/exportacoes/clickup`. */
  readonly pastaDestino: string;
  /** Default: `TODAS_AS_LISTAS`. */
  readonly listas?: readonly string[];
  /** Default: `"todas"` — Contas a receber também, é barata e a regra fica uma só. */
  readonly anexos?: PoliticaDeAnexos;
  /** Default: `"auto"` — o smoke test decide. */
  readonly timeInStatus?: "auto" | "nao";
  /** Amostra: só as N primeiras Tarefas de cada Lista (testes/dry-run). */
  readonly limiteDeTarefas?: number;
  /** Nunca recebe token nem conteúdo de Tarefa — só ids, caminhos, contagens. */
  readonly log?: (linha: string) => void;
}

export interface ContagensDaLista {
  readonly listId: string;
  readonly paginasDeTarefas: number;
  readonly tarefas: number;
  readonly tarefasArquivadas: number;
  readonly detalhes: number;
  readonly comentarios: number;
  readonly paginasDeComentarios: number;
  readonly anexos: number;
  readonly anexosBaixados: number;
  readonly anexosPulados: number;
  readonly timeInStatus: number;
  readonly timeInStatusIndisponivel: number;
  readonly campos: number;
  readonly membros: number;
  readonly statusDefinidos: number;
  /** epoch ms como STRING, como a API devolve (Pitfall 6) — base para re-exportação incremental futura. */
  readonly maiorDateUpdated?: string;
}

export type PapelDeUsuario =
  | "creator"
  | "assignee"
  | "watcher"
  | "comment-author"
  | "comment-assignee"
  | "attachment-user";

export interface UsuarioVisto {
  readonly id: string;
  readonly nome: string;
  readonly ocorrencias: number;
  readonly papeis: readonly PapelDeUsuario[];
}

export interface ResultadoDaExportacao {
  readonly iniciadaEm: string;
  readonly concluidaEm: string;
  readonly amostra: boolean;
  readonly timeInStatusDisponivel: boolean | "nao-verificado";
  readonly listas: readonly ContagensDaLista[];
  readonly usuariosVistos: readonly UsuarioVisto[];
  /** Sem PII: ids + motivo (ex.: "anexo abc123 da Tarefa 9hz pulado: host não permitido"). */
  readonly avisos: readonly string[];
  /** Chamadas de rede feitas NESTA execução (0 numa retomada completa). */
  readonly requisicoes: number;
}

export interface AnexoReferenciado {
  readonly id: string;
  readonly url: string;
  readonly titulo: string;
  readonly tamanho?: number;
  readonly origem: "tarefa" | "comentario";
  readonly taskId: string;
}

/** Só ids simples — nunca `/`, nunca `..` — entram num caminho de arquivo (T-0-06). */
const ID_DE_CAMINHO_VALIDO = /^[A-Za-z0-9_-]+$/;

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function idComoString(valor: unknown): string | undefined {
  if (typeof valor === "string" && valor.length > 0) return valor;
  if (typeof valor === "number") return String(valor);
  return undefined;
}

/**
 * `path.basename` sobre a string com `\` trocado por `/` (barra invertida não
 * separa diretório no POSIX, mas um `title` hostil pode tentar usá-la); tudo
 * fora de `[A-Za-z0-9._-]` vira `_`; `_` repetidos colapsam; `.` no início é
 * removido (evita nome de arquivo oculto ou relativo); corta em 120
 * caracteres; string vazia vira `"anexo"`.
 */
export function sanitizarNomeDeArquivo(nome: string): string {
  const semBarraInvertida = nome.replace(/\\/g, "/");
  const base = path.basename(semBarraInvertida);
  const trocado = base
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "");
  const cortado = trocado.slice(0, 120);
  return cortado.length > 0 ? cortado : "anexo";
}

/**
 * `<pastaDaLista>/attachments/<taskId>/<attachmentId>-<nome sanitizado>`.
 * `taskId`/`attachmentId` são validados por regex ANTES de entrar no
 * caminho (nunca dependem só da sanitização do título); o resultado é
 * conferido por `path.resolve` + `startsWith` contra a pasta esperada —
 * T-0-06, path traversal por `title` hostil (`../../x`) ou por um id fora do
 * formato esperado.
 */
export function caminhoDoAnexo(
  pastaDaLista: string,
  taskId: string,
  attachmentId: string,
  titulo: string,
): string {
  if (!ID_DE_CAMINHO_VALIDO.test(taskId) || !ID_DE_CAMINHO_VALIDO.test(attachmentId)) {
    throw new Error(
      `caminhoDoAnexo: taskId ou attachmentId fora do formato esperado (taskId=${JSON.stringify(taskId)}, attachmentId=${JSON.stringify(attachmentId)})`,
    );
  }
  const pasta = path.resolve(pastaDaLista, "attachments", taskId);
  const alvo = path.resolve(pasta, `${attachmentId}-${sanitizarNomeDeArquivo(titulo)}`);
  if (alvo !== pasta && !alvo.startsWith(pasta + path.sep)) {
    throw new Error("caminhoDoAnexo: caminho resolvido cai fora da pasta de anexos esperada");
  }
  return alvo;
}

/**
 * `mkdir -p`, escreve `<caminho>.tmp`, `rename` — nunca deixa um arquivo pela
 * metade com o nome final (RESEARCH.md Pattern 4 / Pitfall 4). Remove um
 * `.tmp` órfão de uma execução anterior interrompida antes de escrever o
 * novo.
 */
export async function gravarAtomico(caminho: string, conteudo: string | Uint8Array): Promise<void> {
  const tmp = `${caminho}.tmp`;
  await mkdir(path.dirname(caminho), { recursive: true });
  await rm(tmp, { force: true });
  await writeFile(tmp, conteudo);
  await rename(tmp, caminho);
}

/**
 * `undefined` se o arquivo não existe, está vazio ou não é JSON válido;
 * senão o texto exato gravado — é essa checagem que faz do filesystem o
 * checkpoint da retomada (Pitfall 4): um arquivo pela metade (nunca
 * produzido por `gravarAtomico`, mas hipoteticamente de uma gravação
 * externa) nunca conta como feito.
 */
export async function lerSeValido(caminho: string): Promise<string | undefined> {
  let texto: string;
  try {
    texto = await readFile(caminho, "utf8");
  } catch {
    return undefined;
  }
  if (texto.length === 0) return undefined;
  try {
    JSON.parse(texto);
  } catch {
    return undefined;
  }
  return texto;
}

/** Itens de `pagina.comments` — leitura defensiva (Pitfall 5: campo só aparece quando preenchido). */
function comentariosDaPagina(pagina: unknown): readonly unknown[] {
  if (!ehObjeto(pagina)) return [];
  return Array.isArray(pagina.comments) ? pagina.comments : [];
}

function anexoDeItemBruto(
  item: unknown,
  origem: "tarefa" | "comentario",
  taskId: string,
): AnexoReferenciado | undefined {
  if (!ehObjeto(item)) return undefined;
  const url = item.url;
  if (typeof url !== "string" || url.length === 0) return undefined;
  const id = idComoString(item.id);
  if (id === undefined) return undefined;
  const titulo = typeof item.title === "string" ? item.title : "";
  const tamanho = typeof item.size === "number" ? item.size : undefined;
  return { id, url, titulo, tamanho, origem, taskId };
}

/**
 * Anexos "de primeira classe" da Tarefa (`detalheDaTarefa.attachments[]`,
 * `origem: "tarefa"`) mais os anexos embutidos nos blocos de rich text de
 * cada Comentário (`comentario.comment[].attachment`, `origem: "comentario"`
 * — é assim que a API do ClickUp representa um arquivo colado dentro de um
 * Comentário). Deduplica por id; ignora entradas sem `url` (Pitfall 5).
 */
export function coletarAnexos(
  taskId: string,
  detalheDaTarefa: unknown,
  paginasDeComentarios: readonly unknown[],
): readonly AnexoReferenciado[] {
  const vistos = new Map<string, AnexoReferenciado>();

  const attachmentsDoDetalhe = ehObjeto(detalheDaTarefa) ? detalheDaTarefa.attachments : undefined;
  if (Array.isArray(attachmentsDoDetalhe)) {
    for (const bruto of attachmentsDoDetalhe) {
      const anexo = anexoDeItemBruto(bruto, "tarefa", taskId);
      if (anexo !== undefined && !vistos.has(anexo.id)) vistos.set(anexo.id, anexo);
    }
  }

  for (const pagina of paginasDeComentarios) {
    for (const comentario of comentariosDaPagina(pagina)) {
      if (!ehObjeto(comentario) || !Array.isArray(comentario.comment)) continue;
      for (const bloco of comentario.comment) {
        if (!ehObjeto(bloco)) continue;
        const anexo = anexoDeItemBruto(bloco.attachment, "comentario", taskId);
        if (anexo !== undefined && !vistos.has(anexo.id)) vistos.set(anexo.id, anexo);
      }
    }
  }

  return Array.from(vistos.values());
}

function nomeDeUsuario(usuarioBruto: unknown): string {
  if (!ehObjeto(usuarioBruto)) return "desconhecido";
  if (typeof usuarioBruto.username === "string" && usuarioBruto.username.length > 0) {
    return usuarioBruto.username;
  }
  if (typeof usuarioBruto.email === "string" && usuarioBruto.email.length > 0) {
    return usuarioBruto.email;
  }
  return "desconhecido";
}

function registrarUsuario(
  acumulador: Map<string, UsuarioVisto>,
  usuarioBruto: unknown,
  papel: PapelDeUsuario,
): void {
  if (!ehObjeto(usuarioBruto)) return;
  const id = idComoString(usuarioBruto.id);
  if (id === undefined) return;

  const existente = acumulador.get(id);
  if (existente === undefined) {
    acumulador.set(id, { id, nome: nomeDeUsuario(usuarioBruto), ocorrencias: 1, papeis: [papel] });
    return;
  }
  const papeis = existente.papeis.includes(papel) ? existente.papeis : [...existente.papeis, papel];
  acumulador.set(id, { ...existente, ocorrencias: existente.ocorrencias + 1, papeis });
}

/**
 * Acumula todo user id visto (D-12): `creator`, `assignees[]`, `watchers[]`
 * e o `user`/uploader de anexo do detalhe da Tarefa; `user`/`assignee` de
 * cada Comentário; o `user` de um anexo embutido num Comentário. `ocorrencias`
 * soma a cada chamada (é contagem de ocorrências, não de Tarefas — chamar
 * duas vezes com o mesmo detalhe dobra `ocorrencias`); `papeis` nunca repete.
 */
export function coletarUsuarios(
  acumulador: Map<string, UsuarioVisto>,
  detalheDaTarefa: unknown,
  paginasDeComentarios: readonly unknown[],
): void {
  if (ehObjeto(detalheDaTarefa)) {
    if (detalheDaTarefa.creator !== undefined) {
      registrarUsuario(acumulador, detalheDaTarefa.creator, "creator");
    }
    if (Array.isArray(detalheDaTarefa.assignees)) {
      for (const assignee of detalheDaTarefa.assignees) registrarUsuario(acumulador, assignee, "assignee");
    }
    if (Array.isArray(detalheDaTarefa.watchers)) {
      for (const watcher of detalheDaTarefa.watchers) registrarUsuario(acumulador, watcher, "watcher");
    }
    if (Array.isArray(detalheDaTarefa.attachments)) {
      for (const anexo of detalheDaTarefa.attachments) {
        if (ehObjeto(anexo) && anexo.user !== undefined) registrarUsuario(acumulador, anexo.user, "attachment-user");
      }
    }
  }

  for (const pagina of paginasDeComentarios) {
    for (const comentario of comentariosDaPagina(pagina)) {
      if (!ehObjeto(comentario)) continue;
      if (comentario.user !== undefined) registrarUsuario(acumulador, comentario.user, "comment-author");
      if (Array.isArray(comentario.assignee)) {
        for (const assignee of comentario.assignee) registrarUsuario(acumulador, assignee, "comment-assignee");
      } else if (comentario.assignee !== undefined) {
        registrarUsuario(acumulador, comentario.assignee, "comment-assignee");
      }
      if (Array.isArray(comentario.comment)) {
        for (const bloco of comentario.comment) {
          if (ehObjeto(bloco) && ehObjeto(bloco.attachment) && bloco.attachment.user !== undefined) {
            registrarUsuario(acumulador, bloco.attachment.user, "attachment-user");
          }
        }
      }
    }
  }
}
