/**
 * A orquestração de REC-01: lotes sob `executar()`, ledger na MESMA
 * transação da Tarefa, retomada e reconciliação — MESMO desenho de
 * `./importar-contas-a-pagar.ts` (Plan 03-10), com uma etapa a mais que o
 * irmão não tem: o catálogo de clientes (D5-12) é hidratado UMA VEZ, no
 * início, porque `./contas-a-receber.ts` (Task 2) não faz I/O e não pode
 * resolver "Daniel Botelho" contra o CRM sozinho.
 *
 * Ver `./importar-contas-a-pagar.ts` para o raciocínio completo de tamanho
 * de lote, o que acontece quando uma conta falha no meio do lote, e o
 * vocabulário do ledger (`importada`/`avisada`/`rejeitada`) — tudo isso vale
 * aqui sem mudança nenhuma, porque `plataforma.importacao_ledger` é
 * compartilhada pelas duas importações, distinguidas só por `origem`.
 *
 * ## O catálogo de clientes (D5-12)
 *
 * `construirCatalogoDeClientes` abre uma transação `begin`/`rollback` (nunca
 * grava — mesma disciplina do conferidor de 05-09), hidrata `workspaceId`
 * inteiro e projeta só `id`/`tipo`/nome de exibição de Contatos e Empresas
 * `ativo`. Roda UMA vez por `importarTudo`, antes do primeiro lote — não a
 * cada linha, porque o catálogo não muda durante a importação e reidratar o
 * Espaço 240 vezes custaria 240 idas e voltas por nada.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";

import { derive, ok, type DataState, type Id, type OperationResult } from "@n1/dominio";
import {
  contaAReceberJaImportada,
  importarContaAReceberHistorica,
  ORIGEM_CONTAS_A_RECEBER,
  type EntradaDeContaAReceberHistorica,
} from "@n1/dominio/operations/importacao-contas-a-receber";

import { pool } from "../../persistencia/conexao";
import { hidratar } from "../../persistencia/repositorio";
import { executar, type OpcoesExecucao } from "../../persistencia/unidade-de-trabalho";
import { lerContasAReceberDoExport, mapearContaAReceber, verificarIntegridadeDoExportDeContasAReceber, type ClienteDoCatalogo, type ContextoDeMapeamento } from "./contas-a-receber";
import { gravarAtomico } from "./exportar";
import type { Manifesto } from "./manifesto";

export { ORIGEM_CONTAS_A_RECEBER };

/* ─────────────────────────── D5-12 — o catálogo de clientes ─────────────────────────── */

/**
 * Hidrata `workspaceId` DENTRO de uma transação que sempre `rollback`
 * (nunca escreve — mesmo molde de `conferir-contas-a-receber.ts`, 05-09) e
 * projeta os Contatos e Empresas `ativo` para o formato que
 * `mapearContaAReceber` (Task 2) consome. NUNCA cria Contato nem Empresa —
 * só lê o que já existe (D5-12).
 */
export async function construirCatalogoDeClientes(workspaceId: string): Promise<ContextoDeMapeamento> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    const { state } = await hidratar(cliente, workspaceId);
    const catalogo: ClienteDoCatalogo[] = [
      ...state.contacts
        .filter((c) => c.lifecycle === "ativo")
        .map((c) => ({ tipo: "contact" as const, id: c.id, nome: derive.contactDisplayName(c) })),
      ...state.companies
        .filter((c) => c.lifecycle === "ativo")
        .map((c) => ({ tipo: "company" as const, id: c.id, nome: c.tradeName || c.legalName })),
    ];
    return { catalogoDeClientes: catalogo };
  } finally {
    await cliente.query("rollback").catch(() => undefined);
    cliente.release();
  }
}

/* ────────────────────────────────── Lote ────────────────────────────────── */

export type ResultadoDaConta = "importada" | "rejeitada" | "avisada";

interface ResultadoPorConta {
  readonly legacyTaskId: string;
  readonly taskId?: Id;
  readonly resultado: ResultadoDaConta;
  /** Categoria — nunca o valor de um Campo nem o nome do cliente (D-25/T-02-21). */
  readonly motivo?: string;
  readonly sourceHash: string;
}

export interface EntradaParaImportar {
  readonly entrada: EntradaDeContaAReceberHistorica;
  /** sha-256 do JSON canônico do par Tarefa+histórico lido do export (auditoria por linha do ledger). */
  readonly sourceHash: string;
}

export interface ResultadoDoLote {
  readonly importadas: number;
  readonly rejeitadas: number;
  readonly avisadas: number;
  readonly puladas: number;
  readonly detalhes: readonly ResultadoPorConta[];
}

export interface OpcoesDeLote {
  readonly cliente: PoolClient;
  readonly workspaceId: string;
  readonly actingMemberId: Id;
  readonly runId: string;
  readonly entradas: readonly EntradaParaImportar[];
  readonly dryRun: boolean;
  /** Só o teste passa isto — o CLI nunca expõe `--origem` (mesmo critério do irmão). */
  readonly origem?: string;
  /** SÓ para prova de atomicidade em teste — ver `./importar-contas-a-pagar.ts`. */
  readonly forcarFalhaDeLedgerParaTesteDeAtomicidade?: boolean;
}

/** Importa um lote já classificado — mesmos quatro passos de `importarLote` do irmão (`./importar-contas-a-pagar.ts`). */
export async function importarLote(opcoes: OpcoesDeLote): Promise<ResultadoDoLote> {
  const origem = opcoes.origem ?? ORIGEM_CONTAS_A_RECEBER;

  const legacyIds = opcoes.entradas.map((e) => e.entrada.legacyTaskId);
  const jaNoLedger =
    legacyIds.length === 0
      ? new Set<string>()
      : new Set(
          (
            await opcoes.cliente.query<{ legacy_task_id: string }>(
              `select legacy_task_id from plataforma.importacao_ledger where origem = $1 and legacy_task_id = any($2::text[])`,
              [origem, legacyIds],
            )
          ).rows.map((linha) => linha.legacy_task_id),
        );

  const pendentes = opcoes.entradas.filter((e) => !jaNoLedger.has(e.entrada.legacyTaskId));
  const puladas = opcoes.entradas.length - pendentes.length;

  if (pendentes.length === 0) return { importadas: 0, rejeitadas: 0, avisadas: 0, puladas, detalhes: [] };

  if (opcoes.dryRun) {
    const detalhes: ResultadoPorConta[] = pendentes.map(({ entrada, sourceHash }) => ({
      legacyTaskId: entrada.legacyTaskId,
      resultado: entrada.lacunas.length > 0 ? "avisada" : "importada",
      sourceHash,
    }));
    return {
      importadas: detalhes.filter((d) => d.resultado === "importada").length,
      rejeitadas: 0,
      avisadas: detalhes.filter((d) => d.resultado === "avisada").length,
      puladas,
      detalhes,
    };
  }

  let resultadosDoLote: ResultadoPorConta[] = [];
  const operacaoDoLote = (state: DataState): OperationResult<readonly ResultadoPorConta[]> => {
    resultadosDoLote = [];
    for (const { entrada, sourceHash } of pendentes) {
      if (contaAReceberJaImportada(state, entrada.legacyTaskId)) {
        resultadosDoLote.push({ legacyTaskId: entrada.legacyTaskId, resultado: "rejeitada", motivo: "ja_importada", sourceHash });
        continue;
      }
      const resultado = importarContaAReceberHistorica(state, opcoes.actingMemberId, entrada);
      if (!resultado.ok) {
        resultadosDoLote.push({
          legacyTaskId: entrada.legacyTaskId,
          resultado: "rejeitada",
          motivo: resultado.error.slice(0, 200),
          sourceHash,
        });
        continue;
      }
      resultadosDoLote.push({
        legacyTaskId: entrada.legacyTaskId,
        taskId: resultado.value.id,
        resultado: entrada.lacunas.length > 0 ? "avisada" : "importada",
        sourceHash,
      });
    }
    return ok(resultadosDoLote);
  };

  const aoConfirmar = async (cliente: PoolClient, resultados: readonly ResultadoPorConta[]): Promise<void> => {
    for (const [indice, resultado] of resultados.entries()) {
      const valorDoResultado =
        opcoes.forcarFalhaDeLedgerParaTesteDeAtomicidade && indice === 0 ? "resultado_invalido_de_teste" : resultado.resultado;
      await cliente.query(
        `insert into plataforma.importacao_ledger (origem, legacy_task_id, run_id, task_id, resultado, motivo, source_hash)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (origem, legacy_task_id) do nothing`,
        [origem, resultado.legacyTaskId, opcoes.runId, resultado.taskId ?? null, valorDoResultado, resultado.motivo ?? null, resultado.sourceHash],
      );
    }
  };

  // Mesma barreira de execução que o irmão: nenhuma chamada de `executar()`
  // desta importação pode carregar um evento de saída. Duas travas agora
  // (CR-05/T-5-57): a opção abaixo faz a Unidade de Trabalho lançar sozinha
  // se a derivação obrigatória de Canal não estiver vazia (nunca deveria
  // estar — `runAutomations: false` não roda Automação), e a guarda logo em
  // seguida continua cobrindo o chamador que acrescentasse `eventos` aqui
  // por engano.
  const opcoesDeExecucao: OpcoesExecucao<readonly ResultadoPorConta[]> = { aoConfirmar, semEventosDeSaida: true };
  if ("eventos" in opcoesDeExecucao) throw new Error("importarLote nunca pode carregar isto — plataforma.integration_outbox não pode crescer.");

  const resultadoDaTransacao = await executar(opcoes.workspaceId, operacaoDoLote, opcoesDeExecucao);

  if ("conflito" in resultadoDaTransacao && resultadoDaTransacao.conflito) throw new Error(resultadoDaTransacao.error);
  if (!resultadoDaTransacao.ok) throw new Error(resultadoDaTransacao.error);

  return {
    importadas: resultadosDoLote.filter((r) => r.resultado === "importada").length,
    rejeitadas: resultadosDoLote.filter((r) => r.resultado === "rejeitada").length,
    avisadas: resultadosDoLote.filter((r) => r.resultado === "avisada").length,
    puladas,
    detalhes: resultadosDoLote,
  };
}

/* ─────────────────────────────── Hash canônico ─────────────────────────────── */

function canonicalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonicalizar);
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([chave, valorAninhado]) => [chave, canonicalizar(valorAninhado)]),
    );
  }
  return valor;
}

/** sha-256 do JSON canônico — mesmo princípio de `hashCanonico` em `./importar-contas-a-pagar.ts`. */
export function hashCanonico(valor: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalizar(valor))).digest("hex");
}

/* ──────────────────────────────── importarTudo ──────────────────────────────── */

export interface ResultadoDaImportacao {
  readonly runId: string;
  readonly lidas: number;
  readonly importadas: number;
  readonly rejeitadas: number;
  readonly avisadas: number;
  readonly puladas: number;
  readonly lacunasPorCategoria: Readonly<Record<string, number>>;
  readonly rejeicoesPorCategoria: Readonly<Record<string, number>>;
}

export interface OpcoesDeImportarTudo {
  readonly pastaDaLista: string;
  readonly workspaceId: string;
  readonly actingMemberId: Id;
  readonly runId: string;
  /** Padrão 250. */
  readonly lote?: number;
  readonly dryRun: boolean;
  readonly pularVerificacaoDeHash?: boolean;
  readonly origem?: string;
  /** Só o teste informa isto — pula a hidratação real e usa um catálogo sintético. */
  readonly contexto?: ContextoDeMapeamento;
  readonly registrarProgresso?: (linha: string) => void;
}

async function carregarManifestoDaPlataforma(pastaDaLista: string): Promise<Manifesto> {
  const caminho = path.join(pastaDaLista, "..", "..", "MANIFESTO.json");
  return JSON.parse(await readFile(caminho, "utf8")) as Manifesto;
}

/** Categoria da lacuna, cortando no primeiro `:` — as duas categorias de D5-18 citam o id legado do outro lado do `:` (ver `./contas-a-receber.ts`). */
function categoriaDaLacuna(lacuna: string): string {
  return lacuna.split(":")[0] ?? lacuna;
}

/**
 * Compõe: confere a integridade do export (T-3-27, mesma disciplina do
 * irmão), monta o catálogo de clientes UMA vez (D5-12), lê e mapeia em
 * fluxo, agrupa em lotes, chama `importarLote` por lote, imprime uma linha
 * de progresso por lote e devolve as contagens agregadas.
 */
export async function importarTudo(
  opcoes: OpcoesDeImportarTudo,
): Promise<ResultadoDaImportacao & { readonly detalhesPorLinha: readonly { readonly legacyTaskId: string; readonly resultado: string; readonly motivo?: string }[] }> {
  const tamanhoDoLote = opcoes.lote ?? 250;
  const registrar = opcoes.registrarProgresso ?? ((): void => undefined);

  let manifesto: Manifesto | undefined;
  try {
    manifesto = await carregarManifestoDaPlataforma(opcoes.pastaDaLista);
  } catch (erro) {
    if (!opcoes.pularVerificacaoDeHash) {
      throw new Error(
        `MANIFESTO.json não encontrado ou inválido em cima de "${opcoes.pastaDaLista}" — necessário para a conferência de integridade (T-3-27). ` +
          `Use --sem-verificacao-de-hash só com --dry-run. (${erro instanceof Error ? erro.message : String(erro)})`,
      );
    }
  }
  if (!opcoes.pularVerificacaoDeHash && manifesto) {
    const divergencias = await verificarIntegridadeDoExportDeContasAReceber(opcoes.pastaDaLista, manifesto);
    if (divergencias.length > 0) {
      throw new Error(
        `O export diverge do MANIFESTO.json em ${divergencias.length} arquivo(s) (T-3-27) — importação interrompida antes de qualquer gravação. Rode a exportação de novo.`,
      );
    }
  }

  const contexto = opcoes.contexto ?? (await construirCatalogoDeClientes(opcoes.workspaceId));
  registrar(`catálogo de clientes: ${contexto.catalogoDeClientes.length} Contatos/Empresas ativos em "${opcoes.workspaceId}"`);

  const cliente = await pool().connect();
  let lidas = 0;
  let importadas = 0;
  let rejeitadas = 0;
  let avisadas = 0;
  let puladas = 0;
  let numeroDoLote = 0;
  const lacunasPorCategoria: Record<string, number> = {};
  const rejeicoesPorCategoria: Record<string, number> = {};
  const detalhesPorLinha: { legacyTaskId: string; resultado: string; motivo?: string }[] = [];
  let loteAtual: EntradaParaImportar[] = [];

  const processarLoteAtual = async (): Promise<void> => {
    if (loteAtual.length === 0) return;
    numeroDoLote += 1;
    const resultado = await importarLote({
      cliente,
      workspaceId: opcoes.workspaceId,
      actingMemberId: opcoes.actingMemberId,
      runId: opcoes.runId,
      entradas: loteAtual,
      dryRun: opcoes.dryRun,
      ...(opcoes.origem !== undefined ? { origem: opcoes.origem } : {}),
    });
    importadas += resultado.importadas;
    rejeitadas += resultado.rejeitadas;
    avisadas += resultado.avisadas;
    puladas += resultado.puladas;
    for (const detalhe of resultado.detalhes) {
      if (detalhe.resultado !== "importada") {
        detalhesPorLinha.push({ legacyTaskId: detalhe.legacyTaskId, resultado: detalhe.resultado, ...(detalhe.motivo ? { motivo: detalhe.motivo } : {}) });
      }
    }
    registrar(`lote ${numeroDoLote} · importadas ${resultado.importadas} · puladas ${resultado.puladas} · avisadas ${resultado.avisadas} · rejeitadas ${resultado.rejeitadas}`);
    loteAtual = [];
  };

  try {
    for await (const { tarefa, historico } of lerContasAReceberDoExport(opcoes.pastaDaLista)) {
      lidas += 1;
      const classificacao = mapearContaAReceber(tarefa, historico, contexto);
      if (classificacao.resultado === "rejeitada") {
        rejeitadas += 1;
        const categoria = classificacao.motivo ?? "desconhecido";
        rejeicoesPorCategoria[categoria] = (rejeicoesPorCategoria[categoria] ?? 0) + 1;
        detalhesPorLinha.push({ legacyTaskId: classificacao.legacyTaskId ?? tarefa.id, resultado: "rejeitada", motivo: categoria });
        continue;
      }
      const entrada = classificacao.entrada;
      if (!entrada) continue; // inalcançável: `resultado === "valida"` sempre traz `entrada`.
      for (const lacuna of entrada.lacunas) {
        const categoria = categoriaDaLacuna(lacuna);
        lacunasPorCategoria[categoria] = (lacunasPorCategoria[categoria] ?? 0) + 1;
      }
      loteAtual.push({ entrada, sourceHash: hashCanonico({ tarefa, historico }) });
      if (loteAtual.length >= tamanhoDoLote) await processarLoteAtual();
    }
    await processarLoteAtual();
  } finally {
    cliente.release();
  }

  return { runId: opcoes.runId, lidas, importadas, rejeitadas, avisadas, puladas, lacunasPorCategoria, rejeicoesPorCategoria, detalhesPorLinha };
}

/* ──────────────────────────────── reconciliar ──────────────────────────────── */

export interface ResultadoDeReconciliacao {
  readonly runId: string;
  readonly porResultado: Readonly<Record<ResultadoDaConta, number>>;
  readonly tarefasNoEspaco: number;
  readonly bateComOLedger: boolean;
}

/** Mesmo desenho de `reconciliar` em `./importar-contas-a-pagar.ts` — ver lá para o raciocínio completo. */
export async function reconciliar(opcoes: { readonly runId: string; readonly workspaceId: string; readonly origem?: string }): Promise<ResultadoDeReconciliacao> {
  const origemDoLedger = opcoes.origem ?? ORIGEM_CONTAS_A_RECEBER;
  const cliente = await pool().connect();
  try {
    const porResultadoLinhas = await cliente.query<{ resultado: string; n: string }>(
      `select resultado, count(*)::text as n from plataforma.importacao_ledger where run_id = $1 and origem = $2 group by resultado`,
      [opcoes.runId, origemDoLedger],
    );
    const porResultado: Record<ResultadoDaConta, number> = { importada: 0, rejeitada: 0, avisada: 0 };
    for (const linha of porResultadoLinhas.rows) {
      if (linha.resultado === "importada" || linha.resultado === "rejeitada" || linha.resultado === "avisada") {
        porResultado[linha.resultado] = Number(linha.n);
      }
    }
    const tarefas = await cliente.query<{ n: string }>(
      `select count(*)::text as n from plataforma.registros
        where workspace_id = $1 and colecao = 'tasks' and dados #>> '{provenance,sourceName}' = $2`,
      [opcoes.workspaceId, ORIGEM_CONTAS_A_RECEBER],
    );
    const tarefasNoEspaco = Number(tarefas.rows[0]?.n ?? "0");
    return {
      runId: opcoes.runId,
      porResultado,
      tarefasNoEspaco,
      bateComOLedger: porResultado.importada + porResultado.avisada === tarefasNoEspaco,
    };
  } finally {
    cliente.release();
  }
}

/* ──────────────────────────────── Relatórios ──────────────────────────────── */

export interface ContagensParaRelatorio extends ResultadoDaImportacao {
  readonly pastaDaLista: string;
  readonly dryRun: boolean;
}

/**
 * Grava o relatório AGREGADO (versionado) em
 * `apps/api/exportacoes/importacao-contas-a-receber/<runId>/RELATORIO.{md,json}` —
 * só contagens, categorias de lacuna/rejeição e o `run_id`. Nenhum
 * `legacyTaskId`, nome de cliente ou valor monetário (T-02-21/D-25).
 */
export async function relatorioSanitizado(contagens: ContagensParaRelatorio): Promise<{ readonly pastaDoRelatorio: string }> {
  const pastaDoRelatorio = path.join(contagens.pastaDaLista, "..", "..", "importacao-contas-a-receber", contagens.runId);
  const json = {
    runId: contagens.runId,
    modo: contagens.dryRun ? "dry-run" : "apply",
    lidas: contagens.lidas,
    importadas: contagens.importadas,
    rejeitadas: contagens.rejeitadas,
    avisadas: contagens.avisadas,
    puladas: contagens.puladas,
    lacunasPorCategoria: contagens.lacunasPorCategoria,
    rejeicoesPorCategoria: contagens.rejeicoesPorCategoria,
  };
  const linhasMd = [
    `# Relatório da importação de Contas a receber — run \`${contagens.runId}\``,
    "",
    `Modo: **${json.modo}**`,
    "",
    "| Contagem | Valor |",
    "|---|---|",
    `| lidas | ${contagens.lidas} |`,
    `| importadas | ${contagens.importadas} |`,
    `| avisadas | ${contagens.avisadas} |`,
    `| rejeitadas | ${contagens.rejeitadas} |`,
    `| puladas | ${contagens.puladas} |`,
    "",
    "## Lacunas",
    "",
    "| Categoria | Ocorrências |",
    "|---|---|",
    ...Object.entries(contagens.lacunasPorCategoria).map(([categoria, n]) => `| ${categoria} | ${n} |`),
    "",
    "## Rejeições",
    "",
    "| Categoria | Ocorrências |",
    "|---|---|",
    ...Object.entries(contagens.rejeicoesPorCategoria).map(([categoria, n]) => `| ${categoria} | ${n} |`),
    "",
  ];
  await gravarAtomico(path.join(pastaDoRelatorio, "RELATORIO.json"), `${JSON.stringify(json, null, 2)}\n`);
  await gravarAtomico(path.join(pastaDoRelatorio, "RELATORIO.md"), `${linhasMd.join("\n")}\n`);
  return { pastaDoRelatorio };
}

/** Relatório DETALHADO por linha — fora da árvore versionada (LGPD, mesma disciplina do irmão). */
export async function relatorioDetalhadoPorLinha(
  pastaDaLista: string,
  runId: string,
  detalhes: readonly { readonly legacyTaskId: string; readonly resultado: string; readonly motivo?: string }[],
): Promise<{ readonly caminho: string }> {
  const caminho = path.join(pastaDaLista, "importacao", runId, "rejeicoes.log");
  const linhas = detalhes.map((d) => `${d.legacyTaskId}\t${d.resultado}\t${d.motivo ?? ""}`);
  await gravarAtomico(caminho, `${linhas.join("\n")}\n`);
  return { caminho };
}
