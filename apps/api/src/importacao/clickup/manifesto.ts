/**
 * O manifesto é a prova de paridade (CON-09) de PREP-02 — não um índice.
 * Fecha o que `apps/api/exportacoes/clickup/` (fora do git, D-02) não pode
 * expor: nenhum e-mail, CPF/CNPJ, dado bancário, nome de anexo ou nome de
 * pessoa entra aqui. O que entra é o que prova que a exportação aconteceu e
 * que ninguém a alterou depois: sha256 por arquivo, `hashAgregado`,
 * contagens por Lista/recurso recontadas do disco (nunca confiadas na
 * memória de uma execução), e a lista de user ids vistos SEM nome.
 *
 * `MANIFESTO.json` (para o Plan 00-05/Fase 2 conferirem por script) +
 * `MANIFESTO.md` (para o dono ler) — os dois versionados, um nível acima da
 * pasta ignorada (`apps/api/exportacoes/CONTEXT.md`).
 *
 * Anexos entram como `<listId>/attachments/<taskId>/<attachmentId>`, sem o
 * nome original — o nome de um anexo real já vazou CPF em fixture de teste
 * (`nota-fulano-123.456.789-00.pdf`, Plan 00-01/00-03); o hash sha256
 * continua sendo do ARQUIVO INTEIRO (o nome nunca entra no hash, só no
 * caminho de disco de onde o arquivo é lido).
 *
 * O hash é sempre do texto/bytes CRUS que a API devolveu, gravados sem
 * reserialização por `exportar.ts` (D-03/RESEARCH.md Pattern 4) — reidratar
 * a mesma exportação duas vezes produz os mesmos hashes; mudar 1 byte de um
 * arquivo muda só o sha256 dele e o `hashAgregado`, nunca os demais.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ContagensDaLista } from "./exportar";

export interface EntradaDoManifesto {
  readonly caminho: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface Manifesto {
  readonly versao: 1;
  readonly exportadoEm: string;
  readonly exportador: { readonly commit: string };
  readonly amostra: boolean;
  readonly timeInStatusDisponivel: boolean | "nao-verificado";
  readonly listas: readonly ContagensDaLista[];
  readonly usuariosVistos: readonly { readonly id: string; readonly ocorrencias: number }[];
  readonly avisos: readonly string[];
  readonly arquivos: readonly EntradaDoManifesto[];
  readonly hashAgregado: string;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

/** `undefined` se o arquivo não existe, não é lido ou não é JSON válido — leitura defensiva, nunca lança. */
async function lerJsonSeguro(caminho: string): Promise<unknown> {
  try {
    const texto = await readFile(caminho, "utf8");
    return JSON.parse(texto) as unknown;
  } catch {
    return undefined;
  }
}

/** `sha256`/`bytes` por streaming — não carrega o arquivo inteiro na memória (anexos podem chegar a 50 MiB, T-0-08). */
export async function hashDoArquivo(caminho: string): Promise<{ readonly sha256: string; readonly bytes: number }> {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    let bytes = 0;
    const leitura = createReadStream(caminho);
    leitura.on("data", (pedaco: string | Buffer) => {
      const tamanho = typeof pedaco === "string" ? Buffer.byteLength(pedaco) : pedaco.length;
      bytes += tamanho;
      hash.update(pedaco);
    });
    leitura.on("end", () => resolve({ sha256: hash.digest("hex"), bytes }));
    leitura.on("error", reject);
  });
}

async function subpastasDeListId(pastaExportada: string): Promise<readonly string[]> {
  let entradas;
  try {
    entradas = await readdir(pastaExportada, { withFileTypes: true });
  } catch {
    return [];
  }
  return entradas
    .filter((entrada) => entrada.isDirectory() && /^\d+$/.test(entrada.name))
    .map((entrada) => entrada.name)
    .sort();
}

/** Nomes de arquivo diretamente dentro de `dir` (sem recursão), ordenados — nunca lança para pasta ausente. */
async function arquivosDiretos(dir: string): Promise<readonly string[]> {
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entradas
    .filter((entrada) => entrada.isFile())
    .map((entrada) => entrada.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Caminhos ABSOLUTOS de todo arquivo sob `dir`, recursivo — cada nível é
 * ordenado por nome antes de recursar, para que o resultado seja o mesmo
 * não importa a ordem em que o sistema de arquivos devolva `readdir`
 * (determinismo do manifesto exige isso, não só a ordenação final por
 * `caminho` em `listarArquivos`).
 */
async function arquivosRecursivos(dir: string): Promise<readonly string[]> {
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const ordenadas = [...entradas].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const resultado: string[] = [];
  for (const entrada of ordenadas) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...(await arquivosRecursivos(caminho)));
    } else if (entrada.isFile()) {
      resultado.push(caminho);
    }
  }
  return resultado;
}

function idsDistintosDeTarefas(paginas: readonly unknown[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const pagina of paginas) {
    if (!ehObjeto(pagina) || !Array.isArray(pagina.tasks)) continue;
    for (const bruto of pagina.tasks) {
      if (!ehObjeto(bruto)) continue;
      if (typeof bruto.id === "string" || typeof bruto.id === "number") ids.add(String(bruto.id));
    }
  }
  return ids;
}

function maiorDateUpdatedDePaginas(paginas: readonly unknown[]): string | undefined {
  let maior: string | undefined;
  for (const pagina of paginas) {
    if (!ehObjeto(pagina) || !Array.isArray(pagina.tasks)) continue;
    for (const bruto of pagina.tasks) {
      if (!ehObjeto(bruto) || typeof bruto.date_updated !== "string") continue;
      if (maior === undefined || Number(bruto.date_updated) > Number(maior)) maior = bruto.date_updated;
    }
  }
  return maior;
}

function maiorDeDuas(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Number(a) >= Number(b) ? a : b;
}

function idsDistintosDeComentarios(paginas: readonly unknown[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const pagina of paginas) {
    if (!ehObjeto(pagina) || !Array.isArray(pagina.comments)) continue;
    for (const bruto of pagina.comments) {
      if (!ehObjeto(bruto)) continue;
      if (typeof bruto.id === "string" || typeof bruto.id === "number") ids.add(String(bruto.id));
    }
  }
  return ids;
}

function statusesDeListJson(listJson: unknown): readonly unknown[] {
  if (!ehObjeto(listJson)) return [];
  if (Array.isArray(listJson.statuses)) return listJson.statuses;
  if (ehObjeto(listJson.list) && Array.isArray(listJson.list.statuses)) return listJson.list.statuses;
  return [];
}

/**
 * Reconta do disco, nunca confia em memória de uma execução anterior —
 * `anexosPulados`/`timeInStatusIndisponivel` não são recontáveis a partir só
 * dos arquivos presentes (o que FALTOU nunca deixou rastro em disco); ficam
 * `0` aqui e `gerarManifesto` os sobrepõe com o que `execucao.json` tiver
 * registrado, quando existir.
 */
export async function contarRecursos(pastaExportada: string): Promise<readonly ContagensDaLista[]> {
  const listIds = await subpastasDeListId(pastaExportada);
  const resultado: ContagensDaLista[] = [];

  for (const listId of listIds) {
    const pastaDaLista = path.join(pastaExportada, listId);

    const statusDefinidos = statusesDeListJson(await lerJsonSeguro(path.join(pastaDaLista, "list.json"))).length;

    const fieldsJson = await lerJsonSeguro(path.join(pastaDaLista, "fields.json"));
    const campos = ehObjeto(fieldsJson) && Array.isArray(fieldsJson.fields) ? fieldsJson.fields.length : 0;

    const membersJson = await lerJsonSeguro(path.join(pastaDaLista, "members.json"));
    const membros = ehObjeto(membersJson) && Array.isArray(membersJson.members) ? membersJson.members.length : 0;

    const nomesDeTarefas = await arquivosDiretos(path.join(pastaDaLista, "tasks"));
    const paginasDeTarefas = await Promise.all(
      nomesDeTarefas.map((nome) => lerJsonSeguro(path.join(pastaDaLista, "tasks", nome))),
    );
    const idsAbertas = idsDistintosDeTarefas(paginasDeTarefas);

    const nomesDeArquivadas = await arquivosDiretos(path.join(pastaDaLista, "tasks-arquivadas"));
    const paginasDeArquivadas = await Promise.all(
      nomesDeArquivadas.map((nome) => lerJsonSeguro(path.join(pastaDaLista, "tasks-arquivadas", nome))),
    );
    const idsArquivadas = idsDistintosDeTarefas(paginasDeArquivadas);

    const maiorDateUpdated = maiorDeDuas(
      maiorDateUpdatedDePaginas(paginasDeTarefas),
      maiorDateUpdatedDePaginas(paginasDeArquivadas),
    );

    const detalhes = (await arquivosDiretos(path.join(pastaDaLista, "task"))).length;

    const arquivosDeComentarios = await arquivosRecursivos(path.join(pastaDaLista, "comments"));
    const paginasDeComentariosJson = await Promise.all(arquivosDeComentarios.map((caminho) => lerJsonSeguro(caminho)));
    const idsDeComentarios = idsDistintosDeComentarios(paginasDeComentariosJson);

    const timeInStatus = (await arquivosDiretos(path.join(pastaDaLista, "time-in-status"))).length;

    const arquivosDeAnexo = (await arquivosRecursivos(path.join(pastaDaLista, "attachments"))).length;

    resultado.push({
      listId,
      paginasDeTarefas: nomesDeTarefas.length,
      tarefas: idsAbertas.size,
      tarefasArquivadas: idsArquivadas.size,
      detalhes,
      comentarios: idsDeComentarios.size,
      paginasDeComentarios: arquivosDeComentarios.length,
      anexos: arquivosDeAnexo,
      anexosBaixados: arquivosDeAnexo,
      anexosPulados: 0,
      timeInStatus,
      timeInStatusIndisponivel: 0,
      campos,
      membros,
      statusDefinidos,
      maiorDateUpdated,
    });
  }

  return resultado;
}

/** `<listId>/attachments/<taskId>/<attId>-<nome original>` → trunca no primeiro `-` após `attId` (o nome nunca entra no manifesto). */
const CAMINHO_DE_ANEXO = /^(\d+)\/attachments\/([^/]+)\/([^/]+?)-.*$/;

/**
 * Caminhos relativos (separador `/`, mesmo em Windows), ordenados por
 * comparação binária de string (`<`/`>` puros — nunca um método de
 * comparação sensível a idioma, que reordenaria por regras de locale e
 * quebraria o determinismo entre máquinas). Exclui `exportacao.log`,
 * `execucao.json` e qualquer `*.tmp`
 * (nunca deveriam sobrar de uma gravação atômica bem-sucedida, mas um `.tmp`
 * órfão de uma interrupção não deve contaminar o manifesto).
 */
export async function listarArquivos(pastaExportada: string): Promise<readonly EntradaDoManifesto[]> {
  const absolutos = await arquivosRecursivos(pastaExportada);
  const entradas: EntradaDoManifesto[] = [];

  for (const absoluto of absolutos) {
    const nomeBase = path.basename(absoluto);
    if (nomeBase === "exportacao.log" || nomeBase === "execucao.json" || nomeBase.endsWith(".tmp")) continue;

    const relativo = path.relative(pastaExportada, absoluto).split(path.sep).join("/");
    const casamentoDeAnexo = relativo.match(CAMINHO_DE_ANEXO);
    const caminho = casamentoDeAnexo
      ? `${casamentoDeAnexo[1]}/attachments/${casamentoDeAnexo[2]}/${casamentoDeAnexo[3]}`
      : relativo;

    const { sha256, bytes } = await hashDoArquivo(absoluto);
    entradas.push({ caminho, bytes, sha256 });
  }

  entradas.sort((a, b) => (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0));
  return entradas;
}

/**
 * Lê `execucao.json` (Plan 00-03) se existir — só para `amostra`,
 * `timeInStatusDisponivel`, `avisos` e o `anexosPulados`/
 * `timeInStatusIndisponivel` por Lista (o que não está mais em disco não é
 * recontável, ver `contarRecursos`); `usuariosVistos` vem de
 * `usuarios-vistos.json` mapeado para `{ id, ocorrencias }` — SEM `nome`,
 * mesmo que o arquivo de origem tenha um (D-02). As contagens em si vêm
 * sempre de `contarRecursos` (do disco), nunca do `execucao.json` — a
 * exportação pode ter sido retomada, interrompida ou editada manualmente
 * depois de gravar `execucao.json`; o disco é a fonte da verdade.
 */
export async function gerarManifesto(opcoes: {
  readonly pastaExportada: string;
  readonly exportadoEm: string;
  readonly commit: string;
}): Promise<Manifesto> {
  const { pastaExportada, exportadoEm, commit } = opcoes;

  const execucaoJson = await lerJsonSeguro(path.join(pastaExportada, "execucao.json"));

  const amostra = ehObjeto(execucaoJson) && execucaoJson.amostra === true;

  const timeInStatusBruto = ehObjeto(execucaoJson) ? execucaoJson.timeInStatusDisponivel : undefined;
  const timeInStatusDisponivel: boolean | "nao-verificado" =
    timeInStatusBruto === true || timeInStatusBruto === false || timeInStatusBruto === "nao-verificado"
      ? timeInStatusBruto
      : "nao-verificado";

  const avisos =
    ehObjeto(execucaoJson) && Array.isArray(execucaoJson.avisos)
      ? execucaoJson.avisos.filter((aviso): aviso is string => typeof aviso === "string")
      : [];

  const contagensDaExecucaoPorListId = new Map<string, Record<string, unknown>>();
  if (ehObjeto(execucaoJson) && Array.isArray(execucaoJson.listas)) {
    for (const lista of execucaoJson.listas) {
      if (ehObjeto(lista) && typeof lista.listId === "string") contagensDaExecucaoPorListId.set(lista.listId, lista);
    }
  }

  const listasRecontadas = await contarRecursos(pastaExportada);
  const listas = listasRecontadas.map((lista) => {
    const daExecucao = contagensDaExecucaoPorListId.get(lista.listId);
    const anexosPulados = typeof daExecucao?.anexosPulados === "number" ? daExecucao.anexosPulados : 0;
    const timeInStatusIndisponivel =
      typeof daExecucao?.timeInStatusIndisponivel === "number" ? daExecucao.timeInStatusIndisponivel : 0;
    return { ...lista, anexosPulados, timeInStatusIndisponivel };
  });

  const usuariosVistosJson = await lerJsonSeguro(path.join(pastaExportada, "usuarios-vistos.json"));
  const usuariosVistos = Array.isArray(usuariosVistosJson)
    ? usuariosVistosJson
        .filter(ehObjeto)
        .filter((usuario) => typeof usuario.id === "string" && typeof usuario.ocorrencias === "number")
        .map((usuario) => ({ id: usuario.id as string, ocorrencias: usuario.ocorrencias as number }))
    : [];

  const arquivos = await listarArquivos(pastaExportada);
  const hashAgregado = createHash("sha256")
    .update(arquivos.map((arquivo) => `${arquivo.sha256}  ${arquivo.caminho}\n`).join(""))
    .digest("hex");

  return {
    versao: 1,
    exportadoEm,
    exportador: { commit },
    amostra,
    timeInStatusDisponivel,
    listas,
    usuariosVistos,
    avisos,
    arquivos,
    hashAgregado,
  };
}

function linhaDeContagem(rotulo: string, valor: number | string | undefined): string {
  return `| ${rotulo} | ${valor ?? "—"} |`;
}

/**
 * Resumo legível — NUNCA lista arquivo a arquivo (isso é `MANIFESTO.json`,
 * a única fonte de caminho+hash). Sem PII: só ids opacos, contagens e hash.
 */
export function manifestoEmMarkdown(manifesto: Manifesto): string {
  const linhas: string[] = [];

  linhas.push("# Manifesto da exportação do ClickUp");
  linhas.push("");
  linhas.push(`- Exportado em: ${manifesto.exportadoEm}`);
  linhas.push(`- Commit: \`${manifesto.exportador.commit}\``);
  linhas.push(
    `- Amostra: ${manifesto.amostra ? "**sim — este manifesto NÃO é prova de paridade**" : "não"}`,
  );
  linhas.push("");

  for (const lista of manifesto.listas) {
    linhas.push(`## Lista ${lista.listId}`);
    linhas.push("");
    linhas.push("| Recurso | Contagem |");
    linhas.push("|---|---|");
    linhas.push(linhaDeContagem("Status definidos", lista.statusDefinidos));
    linhas.push(linhaDeContagem("Campos", lista.campos));
    linhas.push(linhaDeContagem("Membros", lista.membros));
    linhas.push(linhaDeContagem("Tarefas", lista.tarefas));
    linhas.push(linhaDeContagem("Tarefas arquivadas", lista.tarefasArquivadas));
    linhas.push(linhaDeContagem("Páginas de Tarefas", lista.paginasDeTarefas));
    linhas.push(linhaDeContagem("Detalhes de Tarefa", lista.detalhes));
    linhas.push(linhaDeContagem("Comentários", lista.comentarios));
    linhas.push(linhaDeContagem("Páginas de Comentários", lista.paginasDeComentarios));
    linhas.push(linhaDeContagem("time_in_status gravado", lista.timeInStatus));
    linhas.push(linhaDeContagem("time_in_status indisponível", lista.timeInStatusIndisponivel));
    linhas.push(linhaDeContagem("Anexos referenciados", lista.anexos));
    linhas.push(linhaDeContagem("Anexos baixados", lista.anexosBaixados));
    linhas.push(linhaDeContagem("Anexos pulados", lista.anexosPulados));
    linhas.push(linhaDeContagem("Maior date_updated (epoch ms, string)", lista.maiorDateUpdated));
    linhas.push("");
  }

  linhas.push(
    "> `time_in_status` é tempo acumulado por status (aproximado), não uma trilha cronológica de auditoria — a API pública do ClickUp não expõe histórico de transições de status.",
  );
  switch (manifesto.timeInStatusDisponivel) {
    case true:
      linhas.push("> Disponível nesta exportação (ClickApp \"Total time in Status\" ligado no Workspace).");
      break;
    case false:
      linhas.push("> Indisponível nesta exportação — ver Avisos abaixo.");
      break;
    default:
      linhas.push("> Não verificado nesta execução (`--sem-time-in-status`).");
  }
  linhas.push("");

  linhas.push("## Usuários vistos");
  linhas.push("");
  linhas.push("| id | ocorrências |");
  linhas.push("|---|---|");
  for (const usuario of manifesto.usuariosVistos) {
    linhas.push(`| ${usuario.id} | ${usuario.ocorrencias} |`);
  }
  linhas.push("");

  linhas.push("## Avisos");
  linhas.push("");
  if (manifesto.avisos.length === 0) {
    linhas.push("Nenhum.");
  } else {
    for (const aviso of manifesto.avisos) linhas.push(`- ${aviso}`);
  }
  linhas.push("");

  const totalDeBytes = manifesto.arquivos.reduce((soma, arquivo) => soma + arquivo.bytes, 0);
  linhas.push("## Totais");
  linhas.push("");
  linhas.push(`- Arquivos: ${manifesto.arquivos.length}`);
  linhas.push(`- Bytes: ${totalDeBytes}`);
  linhas.push(`- hashAgregado (sha256): \`${manifesto.hashAgregado}\``);
  linhas.push("");
  linhas.push(
    "A lista arquivo a arquivo (caminho, bytes, sha256) está em `MANIFESTO.json`, não neste documento.",
  );
  linhas.push("");

  return linhas.join("\n");
}

/** `mkdir -p` + os dois arquivos, cada um com `\n` final. Devolve os caminhos absolutos gravados. */
export async function escreverManifesto(
  manifesto: Manifesto,
  pastaDeSaida: string,
): Promise<{ readonly json: string; readonly md: string }> {
  await mkdir(pastaDeSaida, { recursive: true });
  const caminhoJson = path.join(pastaDeSaida, "MANIFESTO.json");
  const caminhoMd = path.join(pastaDeSaida, "MANIFESTO.md");
  await writeFile(caminhoJson, `${JSON.stringify(manifesto, null, 2)}\n`, "utf8");
  await writeFile(caminhoMd, `${manifestoEmMarkdown(manifesto)}\n`, "utf8");
  return { json: caminhoJson, md: caminhoMd };
}
