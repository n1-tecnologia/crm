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

import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { ErroClickUp, hostPermitido, type ClienteClickUp, type RespostaClickUp } from "./cliente";
import { paginarPorCursor, paginarPorPagina, type CursorDeComentarios } from "./paginacao";

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

/**
 * O id de um anexo NUNCA vira um segmento de diretório sozinho — sempre
 * concatenado como `${attachmentId}-${nome sanitizado}`, um único nome de
 * arquivo — por isso pode conter `.` (a API real devolve alguns anexos
 * embutidos em Comentário com id em formato de nome de arquivo, ex.: um
 * UUID + extensão, ex.: `97df775c-...-b45.png`; descoberto rodando o CLI do
 * Plan 00-04 contra a API real). Ainda assim recusa `/`, `\` e o valor
 * exato `.`/`..` (que, sozinhos, teriam significado de diretório) — o
 * resultado continua conferido contra a pasta esperada logo abaixo, defesa
 * em profundidade que não depende só desta regex (T-0-06).
 */
const ID_DE_ANEXO_VALIDO = /^[A-Za-z0-9._-]+$/;

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
  if (
    !ID_DE_CAMINHO_VALIDO.test(taskId) ||
    !ID_DE_ANEXO_VALIDO.test(attachmentId) ||
    attachmentId === "." ||
    attachmentId === ".."
  ) {
    throw new Error(
      `caminhoDoAnexo: taskId ou attachmentId fora do formato esperado (taskId="${taskId}", attachmentId="${attachmentId}")`,
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

// ---------------------------------------------------------------------------
// Task 2 — orquestração
// ---------------------------------------------------------------------------

const LARGURA_DO_INDICE_DE_PAGINA = 3;

function nomeDePagina(indice: number): string {
  return `page-${String(indice).padStart(LARGURA_DO_INDICE_DE_PAGINA, "0")}.json`;
}

/** Constrói uma `RespostaClickUp` sintética a partir do disco — nunca chama rede (retomada, Pitfall 4). */
function respostaDoDisco(corpoCru: string): RespostaClickUp {
  return { status: 200, corpoCru, json: JSON.parse(corpoCru) as unknown, cabecalhos: new Headers() };
}

function extrairTarefas(json: unknown): { readonly itens: readonly unknown[]; readonly ultima: boolean } {
  if (!ehObjeto(json)) return { itens: [], ultima: true };
  return { itens: Array.isArray(json.tasks) ? json.tasks : [], ultima: json.last_page === true };
}

function extrairComentarios(json: unknown): readonly { readonly id: string; readonly date: string }[] {
  if (!ehObjeto(json) || !Array.isArray(json.comments)) return [];
  const resultado: { readonly id: string; readonly date: string }[] = [];
  for (const bruto of json.comments) {
    if (!ehObjeto(bruto)) continue;
    const id = idComoString(bruto.id);
    const date = typeof bruto.date === "string" ? bruto.date : undefined;
    if (id === undefined || date === undefined) continue;
    resultado.push({ id, date });
  }
  return resultado;
}

function contarElementos(json: unknown, chave: string): number {
  if (!ehObjeto(json)) return 0;
  const valor = json[chave];
  return Array.isArray(valor) ? valor.length : 0;
}

function maiorDateUpdatedDeTarefas(json: unknown): string | undefined {
  if (!ehObjeto(json) || !Array.isArray(json.tasks)) return undefined;
  let maior: string | undefined;
  for (const bruto of json.tasks) {
    if (!ehObjeto(bruto) || typeof bruto.date_updated !== "string") continue;
    if (maior === undefined || Number(bruto.date_updated) > Number(maior)) maior = bruto.date_updated;
  }
  return maior;
}

function maiorDeDuas(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Number(a) >= Number(b) ? a : b;
}

async function arquivoExisteComTamanho(caminho: string): Promise<boolean> {
  try {
    const info = await stat(caminho);
    return info.size > 0;
  } catch {
    return false;
  }
}

/**
 * Orquestra Lista → Campos → Membros → Tarefas (abertas + arquivadas) →
 * detalhe por Tarefa → Comentários → `time_in_status` → anexos, por Lista,
 * gravando o JSON bruto um arquivo por recurso/página (D-03). Retomável:
 * antes de qualquer chamada de rede, `lerSeValido`/`respostaDoDisco` servem
 * o que já está gravado — o filesystem é o checkpoint (Pitfall 4).
 *
 * `time_in_status` é um smoke test da EXECUÇÃO inteira (não por Lista): a
 * primeira chamada que falhar com erro 4xx desliga o recurso para todas as
 * Tarefas seguintes (Pitfall 2); falhas depois da primeira chamada
 * bem-sucedida só contam em `timeInStatusIndisponivel`, sem abortar.
 *
 * Nunca grava no Postgres, nunca chama `inviteMember`. `log`/`avisos` só
 * recebem ids, caminhos e contagens — nunca o corpo de Tarefa/Comentário nem
 * qualquer token (T-0-01).
 */
export async function exportarClickUp(opcoes: OpcoesDaExportacao): Promise<ResultadoDaExportacao> {
  const { cliente } = opcoes;
  const log = opcoes.log ?? ((): void => undefined);
  const politicaDeAnexos: PoliticaDeAnexos = opcoes.anexos ?? "todas";
  const timeInStatusOptOut = opcoes.timeInStatus === "nao";
  const listasAlvo = opcoes.listas ?? TODAS_AS_LISTAS;
  const amostra = opcoes.limiteDeTarefas !== undefined;

  const iniciadaEm = new Date().toISOString();
  const avisos: string[] = [];
  const usuariosVistos = new Map<string, UsuarioVisto>();
  const contagensPorLista: ContagensDaLista[] = [];

  let requisicoes = 0;
  let timeInStatusDisponivel = true;
  let smokeTestFeito = false;

  async function getContado(caminho: string, query?: Record<string, string>): Promise<RespostaClickUp> {
    requisicoes += 1;
    return cliente.get(caminho, query);
  }

  async function baixarContado(url: string): Promise<{ readonly bytes: Uint8Array; readonly contentType: string | null }> {
    requisicoes += 1;
    return cliente.baixar(url);
  }

  async function materializarRecurso(caminho: string, buscar: () => Promise<RespostaClickUp>): Promise<string> {
    const existente = await lerSeValido(caminho);
    if (existente !== undefined) return existente;
    const resposta = await buscar();
    await gravarAtomico(caminho, resposta.corpoCru);
    return resposta.corpoCru;
  }

  for (const listId of listasAlvo) {
    const pastaDaLista = path.join(opcoes.pastaDestino, listId);

    const listCorpo = await materializarRecurso(path.join(pastaDaLista, "list.json"), () => getContado(`/list/${listId}`));
    const fieldsCorpo = await materializarRecurso(path.join(pastaDaLista, "fields.json"), () =>
      getContado(`/list/${listId}/field`),
    );
    const membersCorpo = await materializarRecurso(path.join(pastaDaLista, "members.json"), () =>
      getContado(`/list/${listId}/member`),
    );

    const statusDefinidos = contarElementos(JSON.parse(listCorpo) as unknown, "statuses");
    const campos = contarElementos(JSON.parse(fieldsCorpo) as unknown, "fields");
    const membros = contarElementos(JSON.parse(membersCorpo) as unknown, "members");

    // Tarefas abertas (archived=false) — page/last_page (Pattern 1).
    async function buscarPaginaDeTarefasAbertas(page: number): Promise<RespostaClickUp> {
      const caminho = path.join(pastaDaLista, "tasks", nomeDePagina(page));
      const existente = await lerSeValido(caminho);
      if (existente !== undefined) return respostaDoDisco(existente);
      const resposta = await getContado(`/list/${listId}/task`, {
        page: String(page),
        include_closed: "true",
        subtasks: "true",
        archived: "false",
      });
      await gravarAtomico(caminho, resposta.corpoCru);
      return resposta;
    }

    // Segunda passada, arquivadas (archived=true) — mesma paginação, pasta irmã.
    async function buscarPaginaDeTarefasArquivadas(page: number): Promise<RespostaClickUp> {
      const caminho = path.join(pastaDaLista, "tasks-arquivadas", nomeDePagina(page));
      const existente = await lerSeValido(caminho);
      if (existente !== undefined) return respostaDoDisco(existente);
      const resposta = await getContado(`/list/${listId}/task`, {
        page: String(page),
        include_closed: "true",
        subtasks: "true",
        archived: "true",
      });
      await gravarAtomico(caminho, resposta.corpoCru);
      return resposta;
    }

    const idsAbertas: string[] = [];
    let paginasDeTarefasAbertas = 0;
    let maiorDateUpdated: string | undefined;
    for await (const pagina of paginarPorPagina(buscarPaginaDeTarefasAbertas, extrairTarefas)) {
      paginasDeTarefasAbertas += 1;
      log(`lista ${listId} · tarefas página ${pagina.page} · ${pagina.itens.length} itens`);
      for (const bruto of pagina.itens) {
        const id = ehObjeto(bruto) ? idComoString(bruto.id) : undefined;
        if (id !== undefined) idsAbertas.push(id);
      }
      maiorDateUpdated = maiorDeDuas(maiorDateUpdated, maiorDateUpdatedDeTarefas(JSON.parse(pagina.corpoCru) as unknown));
    }

    const idsArquivadas: string[] = [];
    let paginasDeTarefasArquivadas = 0;
    for await (const pagina of paginarPorPagina(buscarPaginaDeTarefasArquivadas, extrairTarefas)) {
      paginasDeTarefasArquivadas += 1;
      log(`lista ${listId} · tarefas arquivadas página ${pagina.page} · ${pagina.itens.length} itens`);
      for (const bruto of pagina.itens) {
        const id = ehObjeto(bruto) ? idComoString(bruto.id) : undefined;
        if (id !== undefined) idsArquivadas.push(id);
      }
      maiorDateUpdated = maiorDeDuas(maiorDateUpdated, maiorDateUpdatedDeTarefas(JSON.parse(pagina.corpoCru) as unknown));
    }

    const todosOsIds = Array.from(new Set([...idsAbertas, ...idsArquivadas]));
    const idsParaDetalhar = opcoes.limiteDeTarefas !== undefined ? todosOsIds.slice(0, opcoes.limiteDeTarefas) : todosOsIds;

    let detalhes = 0;
    let comentarios = 0;
    let paginasDeComentarios = 0;
    let anexosTotal = 0;
    let anexosBaixados = 0;
    let anexosPulados = 0;
    let timeInStatusTotal = 0;
    let timeInStatusIndisponivel = 0;

    for (const taskId of idsParaDetalhar) {
      const corpoDetalhe = await materializarRecurso(path.join(pastaDaLista, "task", `${taskId}.json`), () =>
        getContado(`/task/${taskId}`),
      );
      detalhes += 1;
      const detalheJson = JSON.parse(corpoDetalhe) as unknown;

      // Comentários — start/start_id (Pattern 2); o índice do arquivo é o
      // `indice` da página, não o cursor (que é opaco e vem da API).
      const pastaDeComentarios = path.join(pastaDaLista, "comments", taskId);
      let proximoIndice = 0;
      async function buscarPaginaDeComentarios(cursor?: CursorDeComentarios): Promise<RespostaClickUp> {
        const indice = proximoIndice;
        proximoIndice += 1;
        const caminho = path.join(pastaDeComentarios, nomeDePagina(indice));
        const existente = await lerSeValido(caminho);
        if (existente !== undefined) return respostaDoDisco(existente);
        const query = cursor !== undefined ? { start: cursor.start, start_id: cursor.start_id } : undefined;
        const resposta = await getContado(`/task/${taskId}/comment`, query);
        await gravarAtomico(caminho, resposta.corpoCru);
        return resposta;
      }

      const paginasDeComentariosJson: unknown[] = [];
      let paginasDaTarefa = 0;
      let comentariosDaTarefa = 0;
      for await (const pagina of paginarPorCursor(buscarPaginaDeComentarios, extrairComentarios)) {
        paginasDaTarefa += 1;
        comentariosDaTarefa += pagina.itens.length;
        paginasDeComentariosJson.push(JSON.parse(pagina.corpoCru) as unknown);
      }
      paginasDeComentarios += paginasDaTarefa;
      comentarios += comentariosDaTarefa;

      // time_in_status — best-effort, smoke test na primeira chamada da EXECUÇÃO.
      if (!timeInStatusOptOut && timeInStatusDisponivel) {
        const caminhoTis = path.join(pastaDaLista, "time-in-status", `${taskId}.json`);
        const existenteTis = await lerSeValido(caminhoTis);
        if (existenteTis !== undefined) {
          timeInStatusTotal += 1;
        } else {
          const primeiraTentativa = !smokeTestFeito;
          smokeTestFeito = true;
          try {
            const resposta = await getContado(`/task/${taskId}/time_in_status`);
            await gravarAtomico(caminhoTis, resposta.corpoCru);
            timeInStatusTotal += 1;
          } catch (erro) {
            const status = erro instanceof ErroClickUp ? erro.status : 0;
            if (primeiraTentativa) {
              timeInStatusDisponivel = false;
              avisos.push(
                `time_in_status indisponível (smoke test da lista ${listId}, status ${status}) — recurso não pedido para as demais Tarefas`,
              );
            } else {
              timeInStatusIndisponivel += 1;
            }
          }
        }
      }

      // Anexos — allowlist de host (T-0-07) e teto de tamanho (T-0-08) antes de qualquer download.
      let anexosDaTarefa = 0;
      let anexosBaixadosDaTarefa = 0;
      for (const anexo of coletarAnexos(taskId, detalheJson, paginasDeComentariosJson)) {
        anexosDaTarefa += 1;
        anexosTotal += 1;
        if (politicaDeAnexos === "nenhuma") continue;
        if (!hostPermitido(anexo.url)) {
          anexosPulados += 1;
          avisos.push(`anexo ${anexo.id} da Tarefa ${taskId} pulado: host não permitido`);
          continue;
        }
        if (anexo.tamanho !== undefined && anexo.tamanho > TAMANHO_MAXIMO_DE_ANEXO) {
          anexosPulados += 1;
          avisos.push(`anexo ${anexo.id} da Tarefa ${taskId} pulado: tamanho acima do máximo`);
          continue;
        }
        const caminhoAnexo = caminhoDoAnexo(pastaDaLista, taskId, anexo.id, anexo.titulo);
        if (await arquivoExisteComTamanho(caminhoAnexo)) {
          anexosBaixados += 1;
          anexosBaixadosDaTarefa += 1;
          continue;
        }
        const { bytes } = await baixarContado(anexo.url);
        await gravarAtomico(caminhoAnexo, bytes);
        anexosBaixados += 1;
        anexosBaixadosDaTarefa += 1;
      }

      coletarUsuarios(usuariosVistos, detalheJson, paginasDeComentariosJson);

      log(`tarefa ${taskId} · comentários ${paginasDaTarefa} páginas · anexos ${anexosBaixadosDaTarefa}/${anexosDaTarefa}`);
    }

    contagensPorLista.push({
      listId,
      paginasDeTarefas: paginasDeTarefasAbertas + paginasDeTarefasArquivadas,
      tarefas: idsAbertas.length,
      tarefasArquivadas: idsArquivadas.length,
      detalhes,
      comentarios,
      paginasDeComentarios,
      anexos: anexosTotal,
      anexosBaixados,
      anexosPulados,
      timeInStatus: timeInStatusTotal,
      timeInStatusIndisponivel,
      campos,
      membros,
      statusDefinidos,
      maiorDateUpdated,
    });
  }

  const usuariosVistosArray = Array.from(usuariosVistos.values()).sort((a, b) => b.ocorrencias - a.ocorrencias);
  await gravarAtomico(path.join(opcoes.pastaDestino, "usuarios-vistos.json"), JSON.stringify(usuariosVistosArray, null, 2));

  const resultado: ResultadoDaExportacao = {
    iniciadaEm,
    concluidaEm: new Date().toISOString(),
    amostra,
    timeInStatusDisponivel: timeInStatusOptOut ? "nao-verificado" : timeInStatusDisponivel,
    listas: contagensPorLista,
    usuariosVistos: usuariosVistosArray,
    avisos,
    requisicoes,
  };
  await gravarAtomico(path.join(opcoes.pastaDestino, "execucao.json"), JSON.stringify(resultado, null, 2));

  return resultado;
}
