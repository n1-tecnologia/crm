/**
 * Checklist 3.2 — o comentário de roteamento abre a Solicitação de Aprovação.
 * `comentarPelaIntegracao` é o que a rota `POST /payment-requests/:taskId/comments`
 * roda dentro da Unidade de Trabalho; aqui, sem banco, com o Membro de serviço
 * do "Agente do pipeline" criado pelo configurador, como em produção.
 */
import { describe, expect, it } from "vitest";
import { SOL, type DataState } from "@n1/dominio";
import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";
import { CP } from "@n1/dominio/operations";
import { createTask } from "@n1/dominio/operations/tasks";
import { EMAIL_DO_AGENTE_DO_PIPELINE, evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { ID_DO_STATUS } from "../servicos/dto-solicitacao";
import { comentarPelaIntegracao } from "./integracao-solicitacoes";

const LISTA_ID = "lst_solicitacoes_de_pagamento";
const AGORA = "2026-10-01T12:00:00.000Z";
const MARYANE = "mem_maryane";
const APROVADOR = "mem_aprovador_teste";

/** O Espaço como em produção: o bootstrap da Gestão, o configurador com o Membro de serviço e um aprovador comum. */
function solicitacaoNova(): { state: DataState; agenteId: string; taskId: string } {
  const state = buildGestaoBootstrap({ agora: AGORA });
  const evolucao = evoluirConfiguracaoDeSolicitacoes(state, MARYANE, { membroDeServico: { email: EMAIL_DO_AGENTE_DO_PIPELINE } });
  if (!evolucao.ok) throw new Error(evolucao.error);
  const agente = state.members.find((m) => m.roleId === SOL.papeis.agentePipeline && m.state === "ativo");
  if (!agente) throw new Error("configurador não criou o Agente do pipeline");
  state.members.push({
    id: APROVADOR,
    workspaceId: state.workspace.id,
    displayName: "Aprovador (teste)",
    state: "ativo",
    roleId: "role_mem",
    availability: { value: "disponivel", at: AGORA, origin: "membro" },
    userMemory: { enabled: true, items: [] },
  });
  const tarefa = createTask(state, MARYANE, { listId: LISTA_ID, title: "Solicitação — TESTE AUTOMATIZADO 3.2" });
  if (!tarefa.ok) throw new Error(tarefa.error);
  return { state, agenteId: agente.id, taskId: tarefa.value.id };
}

describe("comentarPelaIntegracao — 3.2", () => {
  it("sem requestApprovalFromMemberId, só comenta: nenhuma aprovação, Status igual", () => {
    const { state, agenteId, taskId } = solicitacaoNova();
    const antes = state.tasks.find((t) => t.id === taskId)!.statusId;
    const r = comentarPelaIntegracao(state, agenteId, taskId, { text: "Thiago, para aprovação", mentionMemberIds: [APROVADOR] });
    expect(r.ok, !r.ok ? r.error : "").toBe(true);
    expect(state.approvals.filter((a) => a.origin.kind === "processTask" && a.origin.taskId === taskId)).toEqual([]);
    expect(state.tasks.find((t) => t.id === taskId)!.statusId).toBe(antes);
  });

  it("com o campo, o comentário é o fio da aprovação do Membro e a Solicitação vai para “em aprovação”", () => {
    const { state, agenteId, taskId } = solicitacaoNova();
    const r = comentarPelaIntegracao(state, agenteId, taskId, {
      text: "Thiago, para aprovação",
      mentionMemberIds: [APROVADOR],
      requestApprovalFromMemberId: APROVADOR,
    });
    if (!r.ok) throw new Error(r.error);
    const aprovacoes = state.approvals.filter((a) => a.origin.kind === "processTask" && a.origin.taskId === taskId);
    expect(aprovacoes).toHaveLength(1);
    expect(aprovacoes[0]).toMatchObject({
      approverMemberId: APROVADOR,
      origin: { kind: "processTask", processStep: "pagamento", threadCommentId: r.value.id },
    });
    expect(aprovacoes[0]!.decision).toBeUndefined();
    expect(state.tasks.find((t) => t.id === taskId)!.statusId).toBe(ID_DO_STATUS["em aprovação"]);
    expect(state.tasks.find((t) => t.id === taskId)!.comments.some((c) => c.id === r.value.id)).toBe(true);
  });

  it("aprovador que não é Membro ativo: recusa (a rota desfaz o comentário junto)", () => {
    const { state, agenteId, taskId } = solicitacaoNova();
    const r = comentarPelaIntegracao(state, agenteId, taskId, { text: "Fulano, para aprovação", requestApprovalFromMemberId: "mem_nao_existe" });
    expect(r).toMatchObject({ ok: false, error: "O Aprovador precisa ser um Membro ativo." });
  });

  it("uma aprovação já pendente noutro fio recusa o pedido novo", () => {
    const { state, agenteId, taskId } = solicitacaoNova();
    const primeiro = comentarPelaIntegracao(state, agenteId, taskId, { text: "Thiago, para aprovação", requestApprovalFromMemberId: APROVADOR });
    if (!primeiro.ok) throw new Error(primeiro.error);
    const segundo = comentarPelaIntegracao(state, agenteId, taskId, { text: "Thiago, para aprovação", requestApprovalFromMemberId: APROVADOR });
    expect(segundo).toMatchObject({ ok: false, error: expect.stringContaining("já aguarda uma aprovação em outro comentário") });
  });

  it("Tarefa fora da Lista de Solicitações não é achada", () => {
    const { state, agenteId } = solicitacaoNova();
    const conta = createTask(state, MARYANE, { listId: CP.listId, title: "Conta — TESTE AUTOMATIZADO 3.2" });
    if (!conta.ok) throw new Error(conta.error);
    const r = comentarPelaIntegracao(state, agenteId, conta.value.id, { text: "x", requestApprovalFromMemberId: APROVADOR });
    expect(r).toMatchObject({ ok: false, error: "Tarefa não encontrada." });
  });
});
