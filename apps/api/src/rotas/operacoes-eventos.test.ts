import type { DataState } from "@n1/dominio";
import { describe, expect, it } from "vitest";
import { LISTA_SOLICITACOES_DE_PAGAMENTO_ID } from "../servicos/dto-solicitacao";
import { eventosDeSaidaDaOperacao } from "./operacoes";

const estado = {
  tasks: [
    { id: "tsk_sol", listId: LISTA_SOLICITACOES_DE_PAGAMENTO_ID },
    { id: "tsk_outra", listId: "lst_outra" },
  ],
} as unknown as DataState;

const aprovacaoDeProcesso = {
  id: "apr_1",
  origin: { kind: "processTask", taskId: "tsk_sol", threadCommentId: "cmt_rot" },
  decision: "aprovada",
  decisionSource: "click",
};

describe("eventosDeSaidaDaOperacao", () => {
  it("decisão de aprovação de processo grava aprovacao-decidida com a fonte que o domínio registrou", () => {
    const eventos = eventosDeSaidaDaOperacao("decideProcessApproval", {
      args: ["apr_1", "aprovada", { source: "click" }],
      valor: aprovacaoDeProcesso,
      state: estado,
      membroId: "mem_aprovador",
      eraReplay: false,
    });
    expect(eventos).toEqual([
      {
        type: "solicitacao.aprovacao-decidida.v1",
        aggregateType: "task",
        aggregateId: "tsk_sol",
        payload: { taskId: "tsk_sol", approvalId: "apr_1", decision: "aprovada", source: "click", decidedByMemberId: "mem_aprovador" },
      },
    ]);
  });

  it("repetir a mesma decisão não reenvia o evento", () => {
    const eventos = eventosDeSaidaDaOperacao("decideProcessApproval", {
      args: ["apr_1", "aprovada", { source: "click" }],
      valor: aprovacaoDeProcesso,
      state: estado,
      membroId: "mem_aprovador",
      eraReplay: true,
    });
    expect(eventos).toEqual([]);
  });

  it("aprovação de Execução de Agente não é do pipeline de pagamento", () => {
    const eventos = eventosDeSaidaDaOperacao("decideProcessApproval", {
      args: ["apr_2", "aprovada", { source: "click" }],
      valor: { ...aprovacaoDeProcesso, id: "apr_2", origin: { kind: "agentExecution", executionId: "exe_1" } },
      state: estado,
      membroId: "mem_aprovador",
      eraReplay: false,
    });
    expect(eventos).toEqual([]);
  });

  it("comentário numa Solicitação grava comentario-criado; em Tarefa de outra Lista, nada", () => {
    const naSolicitacao = eventosDeSaidaDaOperacao("addTaskComment", {
      args: ["tsk_sol", { content: "aprovado", parentCommentId: "cmt_rot" }],
      valor: { id: "cmt_resposta", parentCommentId: "cmt_rot" },
      state: estado,
      membroId: "mem_aprovador",
      eraReplay: false,
    });
    expect(naSolicitacao).toEqual([
      {
        type: "solicitacao.comentario-criado.v1",
        aggregateType: "task",
        aggregateId: "tsk_sol",
        payload: { taskId: "tsk_sol", commentId: "cmt_resposta", parentCommentId: "cmt_rot", authorMemberId: "mem_aprovador" },
      },
    ]);

    const emOutraLista = eventosDeSaidaDaOperacao("addTaskComment", {
      args: ["tsk_outra", { content: "ok" }],
      valor: { id: "cmt_x" },
      state: estado,
      membroId: "mem_aprovador",
      eraReplay: false,
    });
    expect(emOutraLista).toEqual([]);
  });

  it("qualquer outra operação segue sem evento", () => {
    expect(
      eventosDeSaidaDaOperacao("setTaskStatus", { args: ["tsk_sol"], valor: {}, state: estado, membroId: "mem_x", eraReplay: false }),
    ).toEqual([]);
  });
});
