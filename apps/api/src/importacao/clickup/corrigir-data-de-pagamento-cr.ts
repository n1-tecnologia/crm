/**
 * CR-06, a metade "dados" (Plan 05-22): o `--apply` da importação de Contas
 * a receber já rodou em `ws_n1` (240 Tarefas, commit `87d2761`) com o corte
 * de Data de pagamento em UTC. 05-16 corrigiu o CÓDIGO da importação para a
 * PRÓXIMA execução (`instanteDaDataDePagamento` + `comoDiaCivil`, resolvido
 * em `America/Sao_Paulo`) — este módulo descobre QUANTAS das 240 ficaram
 * erradas e corrige essas, e só essas, por operação auditada.
 *
 * `levantarCorrecoes` é PURO (sem I/O): relê o export com a MESMA precedência
 * e o MESMO fuso da importação, e compara contra o que `ws_n1` tem gravado
 * agora — nunca uma terceira interpretação da data. Criar-ou-conferir
 * aplicado a dado: só entra em `corrigir` quando o valor ativo é EXATAMENTE
 * o dia UTC errado conhecido; se alguém já mudou o Campo, a linha é
 * `divergente` e NÃO é sobrescrita (T-5-73).
 *
 * `aplicarCorrecoes` é a orquestração: confere a integridade do export
 * contra o manifesto (T-3-27, como `importarTudo`), levanta em dry-run
 * (hidrata num `begin`/`rollback`, nunca escreve) ou aplica dentro de UMA
 * `executar()` com a trava contra evento de saída ligada (ver a opção mais
 * abaixo) que recalcula o levantamento sobre o estado da PRÓPRIA transação
 * (nunca sobre o levantamento pré-transação, que pode estar velho) e chama
 * `corrigirDataDePagamentoImportada` para cada `corrigir` — se alguma
 * recusar inesperadamente, a transação inteira falha (tudo ou nada,
 * T-5-74/T-5-75).
 *
 * NUNCA imprime/registra nome de cliente, título de Tarefa ou valor
 * monetário — só `legacyTaskId`, contagens, categorias e datas (T-02-21/D-25).
 * O detalhe por linha (com `legacyTaskId`) vai para um arquivo FORA do git,
 * sob a pasta do export — mesmo precedente de `relatorioDetalhadoPorLinha`
 * (`./importar-contas-a-receber.ts`).
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type DataState, type Id, type OperationResult } from "@n1/dominio";
import { syncIdSequence } from "@n1/dominio/operations";
import { CR } from "@n1/dominio/operations/financeiro";
import {
  corrigirDataDePagamentoImportada,
  ORIGEM_CONTAS_A_RECEBER,
} from "@n1/dominio/operations/importacao-contas-a-receber";
import type { CivilDate } from "@n1/dominio/types/primitives";

import { pool } from "../../persistencia/conexao";
import { hidratar } from "../../persistencia/repositorio";
import { executar, type OpcoesExecucao } from "../../persistencia/unidade-de-trabalho";
import type { TarefaClickUpBruta } from "./contas-a-pagar";
import {
  comoDiaCivil,
  instanteDaDataDePagamento,
  lerContasAReceberDoExport,
  verificarIntegridadeDoExportDeContasAReceber,
} from "./contas-a-receber";
import { gravarAtomico } from "./exportar";
import type { Manifesto } from "./manifesto";

/* ─────────────────────────── O vocabulário do relatório ─────────────────────────── */

export type SituacaoDaCorrecao = "corrigir" | "divergente" | "nao-encontrada";

export interface CorrecaoDeDataDePagamento {
  readonly legacyTaskId: string;
  /** Ausente só quando `situacao === "nao-encontrada"`. */
  readonly taskId?: Id;
  readonly origem: "campo" | "date_closed";
  /** O dia UTC que a importação antiga gravou (o que a linha está corrigindo). */
  readonly errado: CivilDate;
  /** O dia civil de São Paulo — a mesma regra de 05-16 (D5-16/CR-06). */
  readonly correto: CivilDate;
  readonly situacao: SituacaoDaCorrecao;
}

export interface TotaisDoLevantamento {
  readonly lidas: number;
  readonly comDataDePagamento: number;
  readonly afetadasPorOrigem: Readonly<Record<"campo" | "date_closed", number>>;
}

export interface ResultadoDoLevantamento {
  readonly correcoes: readonly CorrecaoDeDataDePagamento[];
  readonly totais: TotaisDoLevantamento;
}

/* ────────────────────────────── levantarCorrecoes (puro) ────────────────────────────── */

/**
 * Para cada Tarefa do export: `instanteDaDataDePagamento` resolve o instante
 * bruto (mesma precedência de D5-16); `errado` é o dia UTC que a importação
 * antiga cortou (`instante.slice(0, 10)` — o defeito de CR-06, reproduzido
 * AQUI só para comparar, nunca para gravar); `correto` é o dia civil de São
 * Paulo (`comoDiaCivil`, a correção de 05-16). Quando os dois concordam
 * (UTC e São Paulo dão o mesmo dia), a linha nem entra em `correcoes` — a
 * importação já gravou certo. Quando divergem, localiza a Tarefa em `state`
 * pela mesma proveniência que `jaImportada` usa e classifica pelo valor
 * ATIVO do Campo "Data de pagamento" agora.
 */
export function levantarCorrecoes(tarefasDoExport: readonly TarefaClickUpBruta[], state: DataState): ResultadoDoLevantamento {
  const correcoes: CorrecaoDeDataDePagamento[] = [];
  let comDataDePagamento = 0;
  const afetadasPorOrigem: Record<"campo" | "date_closed", number> = { campo: 0, date_closed: 0 };

  for (const tarefa of tarefasDoExport) {
    const resolucao = instanteDaDataDePagamento(tarefa);
    if (!resolucao) continue;
    comDataDePagamento += 1;

    const errado = resolucao.instante.slice(0, 10) as CivilDate;
    const correto = comoDiaCivil(Date.parse(resolucao.instante));
    if (!correto || correto === errado) continue; // UTC e São Paulo concordam — a importação já gravou certo.

    afetadasPorOrigem[resolucao.origem] += 1;

    const legacyTaskId = String(tarefa.id);
    const tarefaEmWsN1 = state.tasks.find(
      (t) => t.provenance?.kind === "import" && t.provenance.sourceId === legacyTaskId && t.provenance.sourceName === ORIGEM_CONTAS_A_RECEBER,
    );
    if (!tarefaEmWsN1) {
      correcoes.push({ legacyTaskId, origem: resolucao.origem, errado, correto, situacao: "nao-encontrada" });
      continue;
    }

    const valorAtivo = tarefaEmWsN1.fieldValues.find((v) => v.definitionId === CR.fields.dataPagamento)?.value;
    const situacao: SituacaoDaCorrecao = valorAtivo === errado ? "corrigir" : "divergente";
    correcoes.push({ legacyTaskId, taskId: tarefaEmWsN1.id, origem: resolucao.origem, errado, correto, situacao });
  }

  return {
    correcoes,
    totais: { lidas: tarefasDoExport.length, comDataDePagamento, afetadasPorOrigem },
  };
}

/* ────────────────────────────── aplicarCorrecoes (orquestração) ────────────────────────────── */

export interface OpcoesDeAplicarCorrecoes {
  readonly pastaDaLista: string;
  readonly workspaceId: string;
  readonly actingMemberId: Id;
  readonly dryRun: boolean;
}

export interface ResultadoDeAplicarCorrecoes {
  readonly runId: string;
  readonly dryRun: boolean;
  readonly totais: TotaisDoLevantamento;
  readonly correcoes: readonly CorrecaoDeDataDePagamento[];
  /** Quantas correções foram de fato gravadas — 0 em dry-run. */
  readonly aplicadas: number;
  /** Caminho do detalhe por linha, fora do git. */
  readonly caminhoDoDetalhe: string;
}

async function carregarManifestoDaPlataforma(pastaDaLista: string): Promise<Manifesto> {
  const caminho = path.join(pastaDaLista, "..", "..", "MANIFESTO.json");
  return JSON.parse(await readFile(caminho, "utf8")) as Manifesto;
}

/** Detalhe por linha, fora da árvore versionada — mesma disciplina de `relatorioDetalhadoPorLinha` (LGPD). */
async function gravarDetalhePorLinha(
  pastaDaLista: string,
  runId: string,
  correcoes: readonly CorrecaoDeDataDePagamento[],
): Promise<string> {
  const caminho = path.join(pastaDaLista, "correcao-data-de-pagamento", runId, "correcoes.log");
  const linhas = correcoes.map((c) => `${c.legacyTaskId}\t${c.taskId ?? ""}\t${c.origem}\t${c.errado}\t${c.correto}\t${c.situacao}`);
  await gravarAtomico(caminho, `${linhas.join("\n")}\n`);
  return caminho;
}

/**
 * Lê o export, confere a integridade (T-3-27) e ou (a) hidrata num
 * `begin`/`rollback` para só levantar (dry-run), ou (b) roda UMA transação
 * que recalcula o levantamento sobre o estado dela mesma e aplica cada
 * `corrigir` — tudo ou nada. Nunca escreve `plataforma.integration_outbox`
 * — a trava contra evento de saída (ver `opcoesDeExecucao` abaixo) garante isso.
 */
export async function aplicarCorrecoes(opcoes: OpcoesDeAplicarCorrecoes): Promise<ResultadoDeAplicarCorrecoes> {
  const manifesto = await carregarManifestoDaPlataforma(opcoes.pastaDaLista);
  const divergencias = await verificarIntegridadeDoExportDeContasAReceber(opcoes.pastaDaLista, manifesto);
  if (divergencias.length > 0) {
    throw new Error(
      `O export diverge do MANIFESTO.json em ${divergencias.length} arquivo(s) (T-3-27) — nada foi conferido nem corrigido. Rode a exportação de novo.`,
    );
  }

  const tarefasDoExport: TarefaClickUpBruta[] = [];
  for await (const { tarefa } of lerContasAReceberDoExport(opcoes.pastaDaLista)) {
    tarefasDoExport.push(tarefa);
  }

  const runId = randomUUID();

  if (opcoes.dryRun) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { state } = await hidratar(cliente, opcoes.workspaceId);
      syncIdSequence(state);
      const { correcoes, totais } = levantarCorrecoes(tarefasDoExport, state);
      const caminhoDoDetalhe = await gravarDetalhePorLinha(opcoes.pastaDaLista, runId, correcoes);
      return { runId, dryRun: true, totais, correcoes, aplicadas: 0, caminhoDoDetalhe };
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  }

  let correcoesLevantadas: readonly CorrecaoDeDataDePagamento[] = [];
  let totaisLevantados: TotaisDoLevantamento | undefined;

  const operacao = (state: DataState): OperationResult<readonly CorrecaoDeDataDePagamento[]> => {
    // Recalculado sobre o estado DESTA transação — nunca sobre um
    // levantamento anterior, que pode estar velho (outra escrita pode ter
    // entrado entre o dry-run que o operador leu e este `--apply`).
    const levantamento = levantarCorrecoes(tarefasDoExport, state);
    correcoesLevantadas = levantamento.correcoes;
    totaisLevantados = levantamento.totais;

    const aCorrigir = levantamento.correcoes.filter((c) => c.situacao === "corrigir");
    for (const item of aCorrigir) {
      if (!item.taskId) return fail(`Correção "${item.legacyTaskId}" sem Tarefa resolvida — estado inconsistente.`);
      const resultado = corrigirDataDePagamentoImportada(state, opcoes.actingMemberId, {
        taskId: item.taskId,
        esperadoAtual: item.errado,
        corrigido: item.correto,
      });
      // Tudo ou nada: uma recusa inesperada (por exemplo, uma escrita
      // concorrente que mudou o Campo entre o levantamento e agora) desfaz
      // a transação inteira, em vez de aplicar metade das correções.
      if (!resultado.ok) return fail(`Correção "${item.legacyTaskId}" recusada inesperadamente: ${resultado.error}`);
    }
    return ok(aCorrigir);
  };

  const opcoesDeExecucao: OpcoesExecucao<readonly CorrecaoDeDataDePagamento[]> = { semEventosDeSaida: true };
  if ("eventos" in opcoesDeExecucao) throw new Error("aplicarCorrecoes nunca pode carregar isto — plataforma.integration_outbox não pode crescer.");

  const resultadoDaTransacao = await executar(opcoes.workspaceId, operacao, opcoesDeExecucao);
  if ("conflito" in resultadoDaTransacao && resultadoDaTransacao.conflito) throw new Error(resultadoDaTransacao.error);
  if (!resultadoDaTransacao.ok) throw new Error(resultadoDaTransacao.error);

  const caminhoDoDetalhe = await gravarDetalhePorLinha(opcoes.pastaDaLista, runId, correcoesLevantadas);

  return {
    runId,
    dryRun: false,
    totais: totaisLevantados!,
    correcoes: correcoesLevantadas,
    aplicadas: resultadoDaTransacao.value.length,
    caminhoDoDetalhe,
  };
}
