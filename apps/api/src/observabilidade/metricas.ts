/**
 * As métricas mínimas do ensaio de duas semanas (02-RESEARCH.md, seção
 * "Deployment and Operational Observability") — sanitizadas: `coletarMetricas`
 * nunca devolve valor monetário, documento, chave Pix, título de Tarefa ou
 * qualquer outro campo do comentário/RESUMO. Só contagens, idades em segundos
 * e percentuais.
 *
 * Três camadas separadas de propósito (mesmo molde de
 * `../relatorios/ensaio-do-agente.ts`):
 *
 * `montarMetricas` (pura) — recebe uma `AmostraDeMetricas` já lida e devolve
 * o objeto `Metricas` final. É o que o teste (e) exercita sem tocar banco.
 *
 * `lerAmostraReal` (I/O) — a única função deste arquivo que toca o Postgres
 * do `apps/api` (outbox, aprovações via `hidratar()`, ledger de importação) e
 * mede latência local com pings reais. Nunca lê o Supabase do
 * `financeiro-tria` diretamente.
 *
 * `coletarMetricas` (composição) — `deps.amostra` presente pula todo I/O
 * (uso de teste); ausente, chama `lerAmostraReal`.
 *
 * ## Por que `automation` é um parâmetro, não uma leitura (decisão do Plan 02-27)
 *
 * Os comandos do adapter, os runs e as tentativas/resultados Omie por origem
 * vivem inteiramente no Supabase do `financeiro-tria` — e nenhuma tabela de
 * lá hoje persiste um HISTÓRICO consultável dessas contagens (`solicitacoes_pagamentos`
 * guarda o estado ATUAL da Solicitação, não uma linha por tentativa; não existe
 * uma tabela `runs`/`platform_adapter_commands` com contagem agregável por dia
 * — ver `../../../../financeiro-tria/automation/src/adapters/supabase.ts`).
 * Escrever uma leitura SQL contra um schema que este módulo não pode
 * verificar em produção arriscaria devolver um número ERRADO com aparência de
 * medido — pior que declarar a lacuna. Por isso `deps.automation` é opcional:
 * quando ausente, as métricas do `automation/` saem todas zero, nunca um
 * valor inventado; quando presente (CLI com `--resumo=<json>`, Task 3, ou um
 * teste), elas entram de verdade.
 */

import type { PoolClient } from "pg";
import type { ApprovalRequest, DataState } from "@n1/dominio";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { metricaDeOrigem, type PeriodoDaMetrica as PeriodoDeAprovacao } from "../servicos/janela-de-fallback";

export interface PeriodoDeMetrica {
  readonly desde: string;
  readonly ate: string;
}

export interface MetricasDoOutbox {
  readonly pending: number;
  readonly oldestAgeSeconds: number;
  readonly failed: number;
  readonly deliveryAttempts: number;
}

export interface MetricasDeRecebimento {
  /** Ver cabeçalho — hoje sempre `0` sem `deps.amostra.recebimento` (a tabela
   * `plataforma.http_idempotency` guarda o estado atual por chave, não o
   * histórico de tentativas repetidas). */
  readonly duplicatasRecebidas: number;
  readonly conflitosDeIdempotencia: number;
}

export interface MetricasDeAprovacoes {
  readonly porClique: number;
  readonly porComentario: number;
  readonly total: number;
  /** `porComentario / total` — o insumo de D-10. `0` sem nenhuma decisão no período. */
  readonly razao: number;
}

export interface MetricasDeSignedUrl {
  /** Ver cabeçalho — hoje sempre `0` sem `deps.amostra.signedUrl` (nenhuma
   * tabela registra emissão/falha de URL assinada ainda). */
  readonly refresh: number;
  readonly falha: number;
}

export interface MetricasDeImportacao {
  readonly lidos: number;
  readonly importados: number;
  readonly rejeitados: number;
  readonly avisados: number;
}

export interface MetricasDeLatencia {
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
}

export interface MetricasDoOmiePorOrigem {
  readonly incluir: number;
  readonly consultar: number;
  readonly reaproveitado: number;
  readonly duplicado: number;
}

export interface MetricasDoAutomationPorOrigem {
  readonly comandosPendentes: number;
  readonly comandoMaisAntigoSegundos: number;
  readonly comandosFalhos: number;
  readonly runsAguardando: number;
  readonly runsFalhos: number;
  readonly runsConcluidos: number;
  readonly omie: MetricasDoOmiePorOrigem;
}

export type Origem = "plataforma" | "clickup";

export type MetricasDoAutomation = Readonly<Record<Origem, MetricasDoAutomationPorOrigem>>;

export interface Metricas {
  readonly periodo: PeriodoDeMetrica;
  readonly outbox: MetricasDoOutbox;
  readonly recebimento: MetricasDeRecebimento;
  readonly aprovacoes: MetricasDeAprovacoes;
  readonly signedUrl: MetricasDeSignedUrl;
  readonly importacao: MetricasDeImportacao;
  readonly latencia: MetricasDeLatencia;
  /** Ver cabeçalho — `undefined` quando ninguém informou `deps.amostra.automation`
   * nem `deps.automation`; nunca um objeto com zeros disfarçados de medição real. */
  readonly automation?: MetricasDoAutomation;
}

interface LinhaDeOutboxParaMetrica {
  readonly status: "pending" | "delivering" | "delivered" | "failed";
  readonly attempts: number;
  readonly createdAt: string;
}

interface LinhaDeLedgerParaMetrica {
  readonly resultado: "importada" | "rejeitada" | "avisada";
}

export interface AmostraDeMetricas {
  readonly outbox: readonly LinhaDeOutboxParaMetrica[];
  readonly aprovacoes: readonly Pick<ApprovalRequest, "decidedAt" | "decisionSource">[];
  readonly ledger: readonly LinhaDeLedgerParaMetrica[];
  readonly recebimento?: MetricasDeRecebimento;
  readonly signedUrl?: MetricasDeSignedUrl;
  /** Amostra de durações (ms) de ida-e-volta API↔DB — `lerAmostraReal` mede
   * pings reais; um teste pode injetar qualquer lista. */
  readonly latenciaAmostraMs?: readonly number[];
  readonly automation?: MetricasDoAutomation;
}

export interface DepsDeMetricas {
  readonly amostra?: AmostraDeMetricas;
  readonly workspaceId?: string;
  readonly cliente?: PoolClient;
  readonly automation?: MetricasDoAutomation;
}

const WORKSPACE_PADRAO = "ws_n1";

function percentil(amostra: readonly number[], p: number): number {
  if (amostra.length === 0) return 0;
  const ordenada = [...amostra].sort((a, b) => a - b);
  const indice = Math.min(ordenada.length - 1, Math.ceil((p / 100) * ordenada.length) - 1);
  return ordenada[Math.max(0, indice)]!;
}

/** Pura — o que o caso (e) do teste exercita. */
export function montarMetricas(periodo: PeriodoDeMetrica, amostra: AmostraDeMetricas): Metricas {
  const agora = Date.now();
  const pendentes = amostra.outbox.filter((e) => e.status === "pending");
  const oldestAgeSeconds = pendentes.length === 0
    ? 0
    : Math.max(0, ...pendentes.map((e) => Math.floor((agora - new Date(e.createdAt).getTime()) / 1000)));

  const outbox: MetricasDoOutbox = {
    pending: pendentes.length,
    oldestAgeSeconds,
    failed: amostra.outbox.filter((e) => e.status === "failed").length,
    deliveryAttempts: amostra.outbox.reduce((soma, e) => soma + e.attempts, 0),
  };

  const aprovacaoBruta = metricaDeOrigem(amostra.aprovacoes, periodo as PeriodoDeAprovacao);
  const aprovacoes: MetricasDeAprovacoes = {
    porClique: aprovacaoBruta.porClique,
    porComentario: aprovacaoBruta.porComentario,
    total: aprovacaoBruta.total,
    razao: aprovacaoBruta.razao,
  };

  const importacao: MetricasDeImportacao = {
    lidos: amostra.ledger.length,
    importados: amostra.ledger.filter((l) => l.resultado === "importada" || l.resultado === "avisada").length,
    rejeitados: amostra.ledger.filter((l) => l.resultado === "rejeitada").length,
    avisados: amostra.ledger.filter((l) => l.resultado === "avisada").length,
  };

  const amostraDeLatencia = amostra.latenciaAmostraMs ?? [];
  const latencia: MetricasDeLatencia = {
    p50Ms: percentil(amostraDeLatencia, 50),
    p95Ms: percentil(amostraDeLatencia, 95),
    p99Ms: percentil(amostraDeLatencia, 99),
  };

  return {
    periodo,
    outbox,
    recebimento: amostra.recebimento ?? { duplicatasRecebidas: 0, conflitosDeIdempotencia: 0 },
    aprovacoes,
    signedUrl: amostra.signedUrl ?? { refresh: 0, falha: 0 },
    importacao,
    latencia,
    ...(amostra.automation !== undefined ? { automation: amostra.automation } : {}),
  };
}

/** I/O — nunca chamada quando `deps.amostra` já veio pronta. */
async function lerAmostraReal(
  periodo: PeriodoDeMetrica,
  workspaceId: string,
  clienteInformado: PoolClient | undefined,
): Promise<AmostraDeMetricas> {
  const cliente = clienteInformado ?? (await pool().connect());
  const devePoolLiberar = clienteInformado === undefined;
  try {
    const outboxLinhas = await cliente.query<{ status: LinhaDeOutboxParaMetrica["status"]; attempts: number; created_at: string }>(
      `select status, attempts, created_at
         from plataforma.integration_outbox
        where workspace_id = $1 and created_at >= $2 and created_at <= $3`,
      [workspaceId, periodo.desde, periodo.ate],
    );
    const outbox: LinhaDeOutboxParaMetrica[] = outboxLinhas.rows.map((r) => ({
      status: r.status,
      attempts: Number(r.attempts),
      createdAt: r.created_at,
    }));

    const ledgerLinhas = await cliente.query<{ resultado: LinhaDeLedgerParaMetrica["resultado"] }>(
      `select resultado
         from plataforma.importacao_ledger
        where created_at >= $1 and created_at <= $2`,
      [periodo.desde, periodo.ate],
    );
    const ledger: LinhaDeLedgerParaMetrica[] = ledgerLinhas.rows.map((r) => ({ resultado: r.resultado }));

    const { state } = await hidratar(cliente, workspaceId);
    const aprovacoes = aprovacoesDaSolicitacao(state);

    const latenciaAmostraMs = await medirLatenciaLocal(cliente);

    return { outbox, aprovacoes, ledger, latenciaAmostraMs };
  } finally {
    if (devePoolLiberar) cliente.release();
  }
}

/**
 * 06-13 (crm:WR-06) — as aprovações que a métrica D-10 conta: só as da
 * Solicitação de pagamento (`processStep: "pagamento"`). A razão "por
 * comentário / total" mede o fallback por comentário da Solicitação; as
 * Conferências do Resumo (Fase 6) — inclusive as dispensas por clique do
 * Membro de serviço (D6-04) — mediriam outro processo. Pura.
 */
export function aprovacoesDaSolicitacao(state: DataState): AmostraDeMetricas["aprovacoes"] {
  return state.approvals
    .filter((a) => a.origin.kind === "processTask" && a.origin.processStep === "pagamento")
    .map((a) => ({ decidedAt: a.decidedAt, decisionSource: a.decisionSource }));
}

/** `select 1` repetido algumas vezes — a única medição de latência API↔DB que
 * este módulo faz por conta própria; contra o `automation/` (financeiro-tria)
 * não há como medir daqui (é outro processo, outra rede). */
async function medirLatenciaLocal(cliente: PoolClient, amostras = 7): Promise<number[]> {
  const duracoes: number[] = [];
  for (let i = 0; i < amostras; i += 1) {
    const inicio = performance.now();
    await cliente.query("select 1");
    duracoes.push(Math.round(performance.now() - inicio));
  }
  return duracoes;
}

export async function coletarMetricas(periodo: PeriodoDeMetrica, deps: DepsDeMetricas = {}): Promise<Metricas> {
  const amostra = deps.amostra ?? (await lerAmostraReal(periodo, deps.workspaceId ?? WORKSPACE_PADRAO, deps.cliente));
  const automation = deps.automation ?? amostra.automation;
  return montarMetricas(periodo, automation !== undefined ? { ...amostra, automation } : amostra);
}
