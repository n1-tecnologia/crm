/**
 * O manifesto sanitizado da importação de SOL-09 (V02-09B, T-02-21):
 * `gerarManifestoDeImportacao` lê `plataforma.importacao_ledger` — NUNCA as
 * linhas de origem, NUNCA `plataforma.registros` — e produz um relatório só
 * de contagens e categorias. Nada individual entra aqui: nenhum `TaskID`,
 * nome, documento, valor, banco, chave Pix, nome de arquivo ou trecho de
 * comentário. O relatório de rejeições detalhado (com `TaskID`) é
 * responsabilidade de quem chama esta função (`./importar.cli.ts`, Task 3),
 * gravado fora do git.
 *
 * ## O que o ledger sozinho reconstrói, e o que não reconstrói
 *
 * `resultado`/`motivo` por linha do ledger bastam para `importadas`
 * (`resultado in ('importada', 'avisada')`), `rejeitadas` (`resultado =
 * 'rejeitada'` e `motivo <> 'aprovado_ambiguo'`), `ambiguas` (`resultado =
 * 'rejeitada'` e `motivo = 'aprovado_ambiguo'`) e `motivos` (toda linha
 * rejeitada, agrupada por `motivo`) — sempre, mesmo meses depois, rodando só
 * com `--run=<uuid>`.
 *
 * `lidas` e `duplicadas`, porém, NÃO estão no ledger: uma linha "duplicada"
 * (já importada num run anterior) nunca grava uma segunda linha de ledger
 * neste `run_id` — ela simplesmente não aparece aqui, e reconstruir "quantas
 * vezes o CLI pulou uma linha nesta execução" exigiria reler a origem, o que
 * este arquivo nunca faz (T-02-21). Por isso `resumoDaExecucao` é um
 * parâmetro OPCIONAL: quando `./importar.cli.ts` gera o manifesto logo
 * depois de rodar (a soma de todas as chamadas de `importarLote`, Task 1,
 * que tem `lidas`/`duplicadas`/`anexosLigados`/`anexosAusentes` em memória),
 * esses quatro números entram no manifesto de verdade; rodando só
 * `--reconciliar` mais tarde (sem o resumo em memória), eles saem `0` — o
 * manifesto ainda é honesto, só não promete um número que o ledger não
 * guarda.
 *
 * `lacunas` (categoria de lacuna → contagem) é um recorte APROXIMADO: o
 * ledger guarda só a PRIMEIRA lacuna de cada linha `avisada` em `motivo`
 * (`./importar.ts`) — a Tarefa em si tem todas como Registro de Atividade;
 * este manifesto nunca foi a fonte completa disso.
 */

import { createHash } from "node:crypto";

import { pool } from "../../persistencia/conexao";
import { gravarAtomico } from "../clickup/exportar";

export interface ResumoDaExecucao {
  readonly lidas: number;
  readonly duplicadas: number;
  readonly anexosLigados: number;
  readonly anexosAusentes: number;
  /**
   * O que a execução contou em memória. Quando presente, vence o ledger: o
   * dry-run não grava ledger nenhum, e o `--apply` não grava linha para a
   * repetição de um `TaskID` (`taskid_duplicado`) — ler só o ledger zeraria o
   * primeiro e esconderia a segunda. Ausente só em `--reconciliar`.
   */
  readonly contagens?: {
    readonly validas: number;
    readonly importadas: number;
    readonly rejeitadas: number;
    readonly ambiguas: number;
    readonly motivos: Readonly<Record<string, number>>;
    readonly lacunas: Readonly<Record<string, number>>;
  };
}

export interface OpcoesDoManifesto {
  readonly runId: string;
  readonly workspaceId: string;
  readonly iniciadoEm: string;
  readonly concluidoEm: string;
  readonly modo: "dry-run" | "apply";
  /** Ver o cabeçalho — só quem acabou de rodar a importação tem estes quatro números. */
  readonly resumoDaExecucao?: ResumoDaExecucao;
}

export interface ManifestoDeImportacao {
  readonly versao: 1;
  readonly runId: string;
  readonly modo: "dry-run" | "apply";
  readonly iniciadoEm: string;
  readonly concluidoEm: string;
  readonly lidas: number;
  readonly validas: number;
  readonly importadas: number;
  readonly rejeitadas: number;
  readonly ambiguas: number;
  readonly duplicadas: number;
  readonly anexosLigados: number;
  readonly anexosAusentes: number;
  readonly motivos: Readonly<Record<string, number>>;
  readonly lacunas: Readonly<Record<string, number>>;
  readonly hashAgregado: string;
}

const MOTIVOS_AMBIGUOS = ["aprovado_ambiguo", "decisao_conflitante"] as const;

/**
 * Categorias que só `classificarLinha` (`./solicitacoes.ts`) produz para
 * rejeição/ambiguidade "puras" (sem Tarefa nenhuma) — usadas para separar
 * `motivos` (rejeição) de `lacunas` (Tarefa criada, com ressalva) quando o
 * `motivo` de uma linha `avisada` coincide, por acaso, com um nome também
 * usado por `rejeitada` (não deveria acontecer com as categorias atuais,
 * mas o filtro por `resultado`, não por nome, é o que garante isso mesmo
 * que uma categoria nova apareça amanhã).
 */
async function contarPorResultadoEMotivo(
  runId: string,
): Promise<{ readonly porResultado: Record<string, number>; readonly motivosDeRejeicao: Record<string, number>; readonly lacunas: Record<string, number> }> {
  const linhas = (
    await pool().query<{ resultado: string; motivo: string | null; n: string }>(
      `select resultado, motivo, count(*)::text as n
         from plataforma.importacao_ledger
        where run_id = $1
        group by resultado, motivo`,
      [runId],
    )
  ).rows;

  const porResultado: Record<string, number> = { importada: 0, avisada: 0, rejeitada: 0 };
  const motivosDeRejeicao: Record<string, number> = {};
  const lacunas: Record<string, number> = {};

  for (const linha of linhas) {
    const n = Number(linha.n);
    porResultado[linha.resultado] = (porResultado[linha.resultado] ?? 0) + n;
    if (linha.resultado === "rejeitada" && linha.motivo) {
      motivosDeRejeicao[linha.motivo] = (motivosDeRejeicao[linha.motivo] ?? 0) + n;
    }
    if (linha.resultado === "avisada" && linha.motivo) {
      lacunas[linha.motivo] = (lacunas[linha.motivo] ?? 0) + n;
    }
  }

  return { porResultado, motivosDeRejeicao, lacunas };
}

/** Gera o manifesto agregado — nunca lança por ledger vazio (run recém-criado, ainda em dry-run). */
export async function gerarManifestoDeImportacao(opcoes: OpcoesDoManifesto): Promise<ManifestoDeImportacao> {
  const resumo = opcoes.resumoDaExecucao;
  const doLedger = await contarPorResultadoEMotivo(opcoes.runId);
  const contagens = resumo?.contagens;

  const importadas = contagens?.importadas ?? doLedger.porResultado.importada! + doLedger.porResultado.avisada!;
  const ambiguas =
    contagens?.ambiguas ?? MOTIVOS_AMBIGUOS.reduce((soma, motivo) => soma + (doLedger.motivosDeRejeicao[motivo] ?? 0), 0);
  const rejeitadas = contagens?.rejeitadas ?? doLedger.porResultado.rejeitada! - ambiguas;
  const motivosDeRejeicao = contagens?.motivos ?? doLedger.motivosDeRejeicao;
  const lacunas = contagens?.lacunas ?? doLedger.lacunas;

  const lidas = resumo?.lidas ?? 0;
  const validas = contagens?.validas ?? importadas + rejeitadas + ambiguas;
  const duplicadas = resumo?.duplicadas ?? 0;
  const anexosLigados = resumo?.anexosLigados ?? 0;
  const anexosAusentes = resumo?.anexosAusentes ?? 0;

  const hashAgregado = createHash("sha256")
    .update(
      JSON.stringify({
        runId: opcoes.runId,
        importadas,
        rejeitadas,
        ambiguas,
        motivos: motivosDeRejeicao,
        lacunas,
      }),
    )
    .digest("hex");

  return {
    versao: 1,
    runId: opcoes.runId,
    modo: opcoes.modo,
    iniciadoEm: opcoes.iniciadoEm,
    concluidoEm: opcoes.concluidoEm,
    lidas,
    validas,
    importadas,
    rejeitadas,
    ambiguas,
    duplicadas,
    anexosLigados,
    anexosAusentes,
    motivos: motivosDeRejeicao,
    lacunas,
    hashAgregado,
  };
}

function linhaDeCategoria(rotulo: string, mapa: Readonly<Record<string, number>>): readonly string[] {
  const entradas = Object.entries(mapa).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (entradas.length === 0) return [`Nenhuma.`];
  const linhas = ["", `### ${rotulo}`, "", "| Categoria | Ocorrências |", "|---|---|"];
  for (const [categoria, n] of entradas) linhas.push(`| ${categoria} | ${n} |`);
  return linhas;
}

/** Resumo legível — mesma disciplina de `../clickup/manifesto.ts#manifestoEmMarkdown`: só contagens, nunca dado individual. */
export function manifestoEmMarkdown(manifesto: ManifestoDeImportacao): string {
  const linhas: string[] = [];
  linhas.push(`# Manifesto da importação de Solicitações históricas — run \`${manifesto.runId}\``);
  linhas.push("");
  linhas.push(`Modo: **${manifesto.modo}**`);
  linhas.push(`Iniciado em: ${manifesto.iniciadoEm}`);
  linhas.push(`Concluído em: ${manifesto.concluidoEm}`);
  linhas.push("");
  linhas.push("| Contagem | Valor |");
  linhas.push("|---|---|");
  linhas.push(`| lidas | ${manifesto.lidas} |`);
  linhas.push(`| válidas | ${manifesto.validas} |`);
  linhas.push(`| importadas | ${manifesto.importadas} |`);
  linhas.push(`| rejeitadas | ${manifesto.rejeitadas} |`);
  linhas.push(`| ambíguas | ${manifesto.ambiguas} |`);
  linhas.push(`| duplicadas | ${manifesto.duplicadas} |`);
  linhas.push(`| anexos ligados | ${manifesto.anexosLigados} |`);
  linhas.push(`| anexos ausentes | ${manifesto.anexosAusentes} |`);
  linhas.push(...linhaDeCategoria("Motivos de rejeição/ambiguidade", manifesto.motivos));
  linhas.push(...linhaDeCategoria("Lacunas (Tarefa criada com ressalva)", manifesto.lacunas));
  linhas.push("");
  linhas.push(`hashAgregado (sha256): \`${manifesto.hashAgregado}\``);
  linhas.push("");
  return linhas.join("\n");
}

/** `mkdir -p` implícito de `gravarAtomico` + os dois arquivos, gravação atômica (`.tmp` + `rename`, mesmo padrão do exportador do ClickUp). */
export async function escreverManifestoDeImportacao(
  manifesto: ManifestoDeImportacao,
  pastaDeExportacoes: string,
): Promise<{ readonly json: string; readonly md: string }> {
  const pastaDoRun = `${pastaDeExportacoes}/importacao/${manifesto.runId}`;
  const caminhoJson = `${pastaDoRun}/MANIFESTO.json`;
  const caminhoMd = `${pastaDoRun}/MANIFESTO.md`;
  await gravarAtomico(caminhoJson, `${JSON.stringify(manifesto, null, 2)}\n`);
  await gravarAtomico(caminhoMd, `${manifestoEmMarkdown(manifesto)}\n`);
  return { json: caminhoJson, md: caminhoMd };
}
