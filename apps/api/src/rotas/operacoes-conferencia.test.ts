/**
 * 06-13 Task 3 — a Conferência do Resumo (`processStep: "resumo"`, Fase 6)
 * não é Solicitação de pagamento (`processStep: "pagamento"`):
 *
 *   (a) crm:CR-04 — decidir uma Conferência por clique não grava
 *       `solicitacao.aprovacao-decidida.v1` (o evento iria a
 *       `handlePlatformApprovalDecision` no `automation/`);
 *   (b) crm:CR-04, o outro emissor — a classificação de uma resposta no fio
 *       não acha (nem decide) uma Conferência: a credencial de serviço não
 *       abre caminho ao `/lancar`;
 *   (d) crm:IN-04 — a cutucada cobre criar, mover, mandar para a lixeira,
 *       restaurar e anexar/remover anexo numa conta.
 *
 * Arquivo novo (CON-05). Puro, sem banco.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations/financeiro";
import type { DataState } from "@n1/dominio";
import { resolverAprovacaoPeloTopico } from "./classificacoes";
import { eventosDeSaidaDaOperacao, tarefasAfetadasPelaOperacao } from "./operacoes";

const estado = { tasks: [{ id: "tsk_cp_das", listId: CP.listId }] } as unknown as DataState;

function decisao(processStep: "pagamento" | "resumo" | undefined, decision: "aprovada" | "rejeitada") {
  return {
    id: "apr_1",
    origin: { kind: "processTask", taskId: "tsk_cp_das", threadCommentId: "cmt_rot", ...(processStep ? { processStep } : {}) },
    decision,
    decisionSource: "click",
  };
}

const eventosDe = (valor: unknown) =>
  eventosDeSaidaDaOperacao("decideProcessApproval", { args: ["apr_1", "aprovada", { source: "click" }], valor, state: estado, membroId: "mem_maryane", eraReplay: false });

describe("(a) crm:CR-04 — eventosDeSaidaDaOperacao só emite para a Solicitação", () => {
  it.each(["aprovada", "rejeitada"] as const)("Conferência do Resumo %s: nenhum evento", (d) => {
    expect(eventosDe(decisao("resumo", d))).toEqual([]);
  });

  it("Solicitação (processStep \"pagamento\"): o evento de sempre", () => {
    expect(eventosDe(decisao("pagamento", "rejeitada"))).toEqual([
      {
        type: "solicitacao.aprovacao-decidida.v1",
        aggregateType: "task",
        aggregateId: "tsk_cp_das",
        payload: { taskId: "tsk_cp_das", approvalId: "apr_1", decision: "rejeitada", source: "click", decidedByMemberId: "mem_maryane" },
      },
    ]);
  });

  it("processTask sem processStep: nenhum evento (lista de permissão, não de exclusão)", () => {
    expect(eventosDe(decisao(undefined, "aprovada"))).toEqual([]);
  });
});

describe("(b) crm:CR-04 — resolverAprovacaoPeloTopico só acha Solicitação", () => {
  it("uma Solicitação no fio T1 e uma Conferência do Resumo no fio T2: T1 ⇒ a Solicitação; T2 ⇒ nada", () => {
    const solicitacao = { id: "apr_sol", origin: { kind: "processTask", taskId: "tsk_sol", processStep: "pagamento", threadCommentId: "cmt_t1" } };
    const conferencia = {
      id: "apr_conf",
      origin: { kind: "processTask", taskId: "tsk_cp_das", processStep: "resumo", threadCommentId: "cmt_t2", resumoCommentId: "cmt_t2", impressao: "x", lancamento: {} },
    };
    const state = { approvals: [solicitacao, conferencia] } as unknown as DataState;
    expect(resolverAprovacaoPeloTopico(state, "cmt_t1")?.id).toBe("apr_sol");
    expect(resolverAprovacaoPeloTopico(state, "cmt_t2")).toBeUndefined();
    expect(resolverAprovacaoPeloTopico(state, undefined)).toBeUndefined();
  });
});

describe("(d) crm:IN-04 — a cutucada completa", () => {
  const seed = buildSeed();
  const par = { workspaceId: seed.workspace.id, listId: CP.listId };

  it("createTask: o par vem da Tarefa CRIADA (o valor), não da entrada", () => {
    const criada = seed.tasks.find((t) => t.id === "tsk_cp_das")!;
    const entrada = { listId: CP.listId, title: "Conta nova" };
    expect(tarefasAfetadasPelaOperacao("createTask", [entrada], criada, seed)).toEqual([par]);
  });

  it("createTask noutra Lista: o par DESSA Lista (quem filtra é cutucarPonte)", () => {
    const outra = seed.tasks.find((t) => t.listId !== CP.listId)!;
    expect(tarefasAfetadasPelaOperacao("createTask", [{ listId: outra.listId, title: "x" }], outra, seed)).toEqual([
      { workspaceId: seed.workspace.id, listId: outra.listId },
    ]);
  });

  it.each(["moveTask", "trashTask", "restoreTask", "attachFile", "removeAttachment"])("%s numa conta (args[0]): o par da conta", (nome) => {
    expect(tarefasAfetadasPelaOperacao(nome, ["tsk_cp_das", "x"], undefined, seed)).toEqual([par]);
  });
});
