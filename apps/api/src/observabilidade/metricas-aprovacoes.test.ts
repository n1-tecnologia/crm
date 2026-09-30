/**
 * 06-13 Task 3 — crm:WR-06: a métrica D-10 ("por comentário / total") mede o
 * fallback por comentário da SOLICITAÇÃO de pagamento. As Conferências do
 * Resumo (Fase 6, `processStep: "resumo"`) — inclusive as dispensas por
 * clique do Membro de serviço (D6-04) — são outro processo e não entram.
 *
 * Arquivo novo (CON-05). Puro, sem banco.
 */

import { describe, expect, it } from "vitest";
import type { DataState } from "@n1/dominio";
import { aprovacoesDaSolicitacao } from "./metricas";

describe("(c) aprovacoesDaSolicitacao — só processStep \"pagamento\"", () => {
  it("duas Solicitações (comentário e clique) e uma Conferência dispensada por clique: só as duas Solicitações", () => {
    const state = {
      approvals: [
        {
          id: "apr_sol_1",
          origin: { kind: "processTask", taskId: "tsk_sol_1", processStep: "pagamento", threadCommentId: "cmt_1" },
          decision: "aprovada",
          decidedAt: "2026-09-10T12:00:00.000Z",
          decisionSource: "comment",
        },
        {
          id: "apr_sol_2",
          origin: { kind: "processTask", taskId: "tsk_sol_2", processStep: "pagamento", threadCommentId: "cmt_2" },
          decision: "rejeitada",
          decidedAt: "2026-09-11T12:00:00.000Z",
          decisionSource: "click",
        },
        {
          id: "apr_conf",
          origin: { kind: "processTask", taskId: "tsk_cp_das", processStep: "resumo", threadCommentId: "cmt_3", resumoCommentId: "cmt_3", impressao: "x", lancamento: {} },
          decision: "aprovada",
          decidedAt: "2026-09-12T12:00:00.000Z",
          decisionSource: "click",
          decisionReason: "Conferência dispensada (Integração manual)",
        },
        {
          id: "apr_exe",
          origin: { kind: "agentExecution", executionId: "exe_1", stepIndex: 0, deadline: "2026-09-13T12:00:00.000Z" },
          decision: "aprovada",
          decidedAt: "2026-09-12T12:00:00.000Z",
          decisionSource: "click",
        },
      ],
    } as unknown as DataState;

    expect(aprovacoesDaSolicitacao(state)).toEqual([
      { decidedAt: "2026-09-10T12:00:00.000Z", decisionSource: "comment" },
      { decidedAt: "2026-09-11T12:00:00.000Z", decisionSource: "click" },
    ]);
  });
});
