/**
 * A orquestração de PAG-01: lotes sob `executar()`, ledger na MESMA
 * transação da Tarefa, retomada e reconciliação. `./contas-a-pagar.ts` lê o
 * disco e classifica; este arquivo não abre um único arquivo — recebe
 * classificações já prontas e decide só o quanto entra em cada transação.
 *
 * ## Tamanho de transação — a decisão e o custo de cada alternativa
 *
 * - **Uma `executar()` por conta (2.861 chamadas)** é o caminho ingênuo e é
 *   quadrático: cada chamada hidrata o Espaço inteiro, e o Espaço cresce a
 *   cada conta importada — a chamada nº 2.861 carregaria ~2.860 Tarefas e
 *   milhares de Registros para gravar uma linha. São 2.861 incrementos de
 *   `revisao` e 2.861 janelas em que outra escrita no Espaço colide (DEC-06
 *   serializa escrita por Espaço).
 * - **Uma `executar()` para tudo** hidrata uma vez e faz um diff só, mas
 *   segura o `update ... set revisao = revisao + 1` sobre a linha de `ws_n1`
 *   durante a importação inteira: qualquer outra escrita espera ou
 *   conflita, e a falha da conta nº 1.500 desfaz as 1.499 anteriores — nada
 *   é retomável, e `--resume` deixaria de existir.
 * - **Lote de `--lote=<n>` contas (padrão 250, 12 lotes para 2.861)** é o
 *   meio-termo: 12 hidratações de um estado que cresce, lock por lote
 *   medido em segundos e não em minutos, e uma falha que desfaz no máximo
 *   250 contas — as anteriores já estão no ledger e `--resume` parte dali.
 *   `executar()` repete a operação até 3 vezes em conflito de revisão; por
 *   isso `operacaoDoLote` chama `contaAPagarJaImportada` antes de cada
 *   conta — uma repetição por conflito não duplica nada.
 *
 * ## O que acontece quando a conta nº 1.500 falha
 *
 * Se a falha é **recusa do domínio** (`ok: false` de
 * `importarContaAPagarHistorica`): a conta vira linha de ledger `rejeitada`,
 * o lote segue e as outras 249 entram — 03-09 já desfez o estado parcial
 * daquela conta por conta própria (rollback interno da operação). Se a
 * falha é **exceção ou erro do Postgres**: o lote inteiro (contas
 * 1.251-1.500) desaparece — nem Tarefa, nem ledger; `executar()` faz
 * `rollback` da transação inteira. Os lotes anteriores continuam commitados
 * e com ledger; `--resume` recomeça na primeira conta sem linha de ledger.
 * Nenhum caminho deixa Tarefa sem ledger ou ledger sem Tarefa.
 *
 * `resultado` do ledger: `importada` quando a operação devolveu `ok` sem
 * lacuna; `avisada` quando a conta entrou mas com ao menos uma lacuna (é o
 * valor que torna a reconciliação por lacuna possível sem uma coluna nova —
 * a migração `003` é imutável, DEC-10); `rejeitada` quando o domínio
 * recusou.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";

import { ok, type DataState, type Id, type OperationResult } from "@n1/dominio";
import {
  contaAPagarJaImportada,
  importarContaAPagarHistorica,
  ORIGEM_CONTAS_A_PAGAR,
  type EntradaDeContaAPagarHistorica,
} from "@n1/dominio/operations/importacao-contas-a-pagar";

import { pool } from "../../persistencia/conexao";
import { executar, type OpcoesExecucao } from "../../persistencia/unidade-de-trabalho";
import { classificarTarefaLegada, lerTarefasDoExport, verificarIntegridadeDoExport } from "./contas-a-pagar";
import { gravarAtomico } from "./exportar";
import type { Manifesto } from "./manifesto";

export { ORIGEM_CONTAS_A_PAGAR };

/* ────────────────────────────────── Lote ────────────────────────────────── */

export type ResultadoDaConta = "importada" | "rejeitada" | "avisada";

interface ResultadoPorConta {
  readonly legacyTaskId: string;
  readonly taskId?: Id;
  readonly resultado: ResultadoDaConta;
  /** Categoria — cita id de Status/Campo quando existir, nunca o valor de um Campo (T-3-07/T-3-25). */
  readonly motivo?: string;
  readonly sourceHash: string;
}

export interface EntradaParaImportar {
  readonly entrada: EntradaDeContaAPagarHistorica;
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
  /** Conexão só para o filtro de ledger (passo 1) — nunca a mesma transação de `executar()`. */
  readonly cliente: PoolClient;
  readonly workspaceId: string;
  readonly actingMemberId: Id;
  readonly runId: string;
  readonly entradas: readonly EntradaParaImportar[];
  readonly dryRun: boolean;
  /**
   * Só o teste passa isto — o CLI nunca expõe `--origem` (ver o critério
   * explícito em `./importar-contas-a-pagar.cli.ts`). Um valor por execução
   * de teste, para que a limpeza por `origem = $RUN` nunca alcance a
   * importação real. Padrão: `ORIGEM_CONTAS_A_PAGAR`.
   */
  readonly origem?: string;
  /**
   * SÓ para prova de atomicidade em teste (caso b, Plan 03-10 Task 2):
   * corrompe o `resultado` da primeira linha do lote para um valor fora do
   * `check` de `plataforma.importacao_ledger`, forçando `aoConfirmar` a
   * lançar dentro da transação. `executar()` faz `rollback` da transação
   * inteira — é assim que se prova que Tarefa e ledger nascem juntos ou não
   * nascem. Nunca usado fora de `importar-contas-a-pagar.test.ts`.
   */
  readonly forcarFalhaDeLedgerParaTesteDeAtomicidade?: boolean;
}

/**
 * Importa um lote já classificado. Passos: (1) filtrar contra o ledger —
 * as já presentes contam como `puladas`; (2) lote vazio devolve sem chamar
 * `executar()` (é isto que faz a segunda execução inteira não mexer em
 * `revisao`); (3) `executar()` sobre `operacaoDoLote`; (4) `aoConfirmar`
 * grava todas as linhas do lote no ledger, no MESMO cliente/transação.
 */
export async function importarLote(opcoes: OpcoesDeLote): Promise<ResultadoDoLote> {
  const origem = opcoes.origem ?? ORIGEM_CONTAS_A_PAGAR;

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

  // Lote inteiro já importado: nenhuma chamada de `executar()`, nenhuma
  // hidratação, `revisao` de `plataforma.workspaces` fica intocada — a
  // formulação operacional de "a segunda execução é no-op".
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
      if (contaAPagarJaImportada(state, entrada.legacyTaskId)) {
        resultadosDoLote.push({ legacyTaskId: entrada.legacyTaskId, resultado: "rejeitada", motivo: "ja_importada", sourceHash });
        continue;
      }
      const resultado = importarContaAPagarHistorica(state, opcoes.actingMemberId, entrada);
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

  // Barreira de execução (o mesmo guarda que o Plan 02-25 desenhou): nenhuma
  // chamada de `executar()` desta importação pode carregar um evento de
  // saída — se o parâmetro proibido abaixo for acrescentado ao objeto no
  // futuro, a linha seguinte falha alto em vez de deixar passar em silêncio.
  const opcoesDeExecucao: OpcoesExecucao<readonly ResultadoPorConta[]> = { aoConfirmar };
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

/** sha-256 do JSON canônico (chaves ordenadas, recursivo) — o mesmo princípio do diff canônico de `@n1/dominio`. */
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
  /**
   * Pula a conferência de `sha256` contra `MANIFESTO.json` (T-3-27). O CLI
   * (`./importar-contas-a-pagar.cli.ts`) recusa esta flag junto com
   * `--apply` — aqui a função continua flexível porque os testes montam um
   * export sintético em `os.tmpdir()`, sem `MANIFESTO.json` real.
   */
  readonly pularVerificacaoDeHash?: boolean;
  readonly origem?: string;
  /** Só o teste informa isto (nenhum `MANIFESTO.json` sintético): padrão vem de `manifesto.exportadoEm`. */
  readonly instanteDaExportacao?: string;
  readonly registrarProgresso?: (linha: string) => void;
}

async function carregarManifestoDaPlataforma(pastaDaLista: string): Promise<Manifesto> {
  // `pastaDaLista` é .../exportacoes/clickup/<listId>; o manifesto versionado
  // fica dois níveis acima, fora da árvore ignorada pelo git (LGPD).
  const caminho = path.join(pastaDaLista, "..", "..", "MANIFESTO.json");
  return JSON.parse(await readFile(caminho, "utf8")) as Manifesto;
}

/**
 * Compõe: confere a integridade do export (T-3-27), lê e classifica em
 * fluxo, agrupa em lotes, chama `importarLote` por lote, imprime uma linha
 * de progresso por lote e devolve as contagens agregadas. O relatório
 * detalhado por linha (nunca valor de Campo) é gravado à parte, dentro da
 * árvore ignorada pelo git — ver `./importar-contas-a-pagar.cli.ts`.
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
    const divergencias = await verificarIntegridadeDoExport(opcoes.pastaDaLista, manifesto);
    if (divergencias.length > 0) {
      throw new Error(
        `O export diverge do MANIFESTO.json em ${divergencias.length} arquivo(s) (T-3-27) — importação interrompida antes de qualquer gravação. Rode a exportação de novo.`,
      );
    }
  }
  const instanteDaExportacao = opcoes.instanteDaExportacao ?? manifesto?.exportadoEm ?? new Date().toISOString();

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
    for await (const { tarefa, historico } of lerTarefasDoExport(opcoes.pastaDaLista)) {
      lidas += 1;
      const classificacao = classificarTarefaLegada(tarefa, historico, { instanteDaExportacao });
      if (classificacao.resultado === "rejeitada") {
        rejeitadas += 1;
        const categoria = classificacao.motivo ?? "desconhecido";
        rejeicoesPorCategoria[categoria] = (rejeicoesPorCategoria[categoria] ?? 0) + 1;
        detalhesPorLinha.push({ legacyTaskId: classificacao.legacyTaskId ?? tarefa.id, resultado: "rejeitada", motivo: categoria });
        continue;
      }
      const entrada = classificacao.entrada;
      if (!entrada) continue; // inalcançável: `resultado === "valida"` sempre traz `entrada`.
      for (const lacuna of entrada.lacunas) lacunasPorCategoria[lacuna] = (lacunasPorCategoria[lacuna] ?? 0) + 1;
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

/**
 * Lê o ledger daquele `run_id` e devolve as contagens por `resultado`, mais
 * a contagem de Tarefas no Espaço — é o que prova que reaplicar não
 * duplicou (T-3-02).
 *
 * `opcoes.origem` afeta só o filtro do LEDGER (o teste usa um valor por
 * execução, nunca `ORIGEM_CONTAS_A_PAGAR`). A contagem de Tarefas, porém,
 * filtra sempre por `provenance.sourceName = ORIGEM_CONTAS_A_PAGAR` — é o
 * valor que `importarContaAPagarHistorica` (03-09) grava de verdade em toda
 * Tarefa, e ele nunca muda entre execuções: o `workspaceId` é o que isola o
 * teste da produção (a segunda das "três axes" declaradas no plano).
 */
export async function reconciliar(opcoes: { readonly runId: string; readonly workspaceId: string; readonly origem?: string }): Promise<ResultadoDeReconciliacao> {
  const origemDoLedger = opcoes.origem ?? ORIGEM_CONTAS_A_PAGAR;
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
      [opcoes.workspaceId, ORIGEM_CONTAS_A_PAGAR],
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
 * `apps/api/exportacoes/importacao-contas-a-pagar/<runId>/RELATORIO.{md,json}` —
 * só contagens, categorias de lacuna/rejeição e o `run_id`. Nenhum
 * `legacyTaskId`, título, fornecedor, documento, valor, chave Pix ou código
 * de barras (T-3-25). O relatório detalhado por linha é responsabilidade do
 * chamador (`./importar-contas-a-pagar.cli.ts`), gravado dentro da árvore
 * já ignorada pelo git por LGPD.
 */
export async function relatorioSanitizado(contagens: ContagensParaRelatorio): Promise<{ readonly pastaDoRelatorio: string }> {
  const pastaDoRelatorio = path.join(contagens.pastaDaLista, "..", "..", "importacao-contas-a-pagar", contagens.runId);
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
    `# Relatório da importação de Contas a pagar — run \`${contagens.runId}\``,
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

/**
 * Grava o relatório DETALHADO por linha — `legacyTaskId` + categoria, ainda
 * sem nenhum valor de Campo — em
 * `<pastaDaLista>/importacao/<runId>/rejeicoes.log`, dentro da árvore já
 * ignorada pelo git por LGPD (`.gitignore` linha 42). Só as linhas que NÃO
 * foram `importada` limpa entram aqui (rejeitadas, avisadas e as recusadas
 * já na classificação) — é o "rejeições", não um espelho das 2.861.
 */
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
