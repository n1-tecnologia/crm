/**
 * V02-03A/V02-03B (02-VALIDATION.md) — a matriz da aprovação de processo
 * (Plan 02-04): D-06 (origem discriminada), D-09 (decisão canônica,
 * idempotente, clique e comentário convergem), D-11 (sem prazo, sem
 * lembrete). A regressão do fluxo de Agente (a)-(c) prova que a união
 * discriminada não muda o comportamento de `decideApproval` sobre uma
 * `ApprovalRequest` `agentExecution`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { StatusSet } from "../types";
import { createSpace, createList } from "./structure";
import { createTaskType } from "./configuration";
import { addTaskComment, createTask } from "./tasks";
import { decideApproval, decideProcessApproval, solicitarAprovacao } from "./ai";

const THIAGO = "mem_thiago"; // proprietario — abre a Tarefa e solicita a aprovação
const JULIA = "mem_julia"; // membro (role_vendas) — o aprovador designado
const MARCOS = "mem_marcos"; // membro (role_vendas) — não é o aprovador, não é administrador
const RAFAEL = "mem_rafael"; // administrador

/**
 * O Conjunto de Status exatamente como D-01 define para a Lista real:
 * `para fazer`, `em aprovação`, `não aprovado`, `aprovado` — a Lista de
 * Solicitações nasce só no Plan 02-06 (catálogo); aqui é o suficiente para
 * `solicitarAprovacao`/`decideProcessApproval` resolverem o status pelo nome.
 */
const STATUS_SET: StatusSet = {
  id: "sts_sol_teste",
  definitions: [
    { id: "st_sol_para_fazer", name: "para fazer", color: "#94a3b8", category: "naoIniciado", order: 0 },
    { id: "st_sol_em_aprovacao", name: "em aprovação", color: "#f59e0b", category: "emAndamento", order: 1 },
    { id: "st_sol_nao_aprovado", name: "não aprovado", color: "#ef4444", category: "concluido", order: 2 },
    // `fechado` — createSpace exige ao menos um status `fechado` no Conjunto (RN-ESP-03).
    { id: "st_sol_aprovado", name: "aprovado", color: "#22c55e", category: "fechado", order: 3 },
  ],
};

interface Fixture {
  readonly state: DataState;
  readonly taskId: string;
  readonly threadCommentId: string;
}

/** Espaço público (sem Concessão exigida) + Lista + Tarefa + Comentário de roteamento. */
function montarFixture(): Fixture {
  const state = buildSeed();

  const espaco = createSpace(state, THIAGO, { name: "Financeiro (teste 02-04)", statusSet: STATUS_SET });
  if (!espaco.ok) throw new Error(`seed de teste: ${espaco.error}`);

  const tipo = createTaskType(state, THIAGO, {
    name: "Solicitação (teste)",
    icon: "circle",
    definedAtType: "space",
    definedAtId: espaco.value.id,
  });
  if (!tipo.ok) throw new Error(`seed de teste: ${tipo.error}`);

  const lista = createList(state, THIAGO, {
    name: "Solicitações de pagamento (teste)",
    parentType: "space",
    parentId: espaco.value.id,
  });
  if (!lista.ok) throw new Error(`seed de teste: ${lista.error}`);

  const task = createTask(state, THIAGO, { listId: lista.value.id, title: "Pagamento de teste" });
  if (!task.ok) throw new Error(`seed de teste: ${task.error}`);

  const comentario = addTaskComment(state, THIAGO, task.value.id, { content: "Júlia, para aprovação (RESUMO)." });
  if (!comentario.ok) throw new Error(`seed de teste: ${comentario.error}`);

  return { state, taskId: task.value.id, threadCommentId: comentario.value.id };
}

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

describe("Regressão do fluxo de Agente (V02-03A)", () => {
  it("(a) uma ApprovalRequest agentExecution com deadline no passado e decisão tardia continua expirando", () => {
    const approval = state.approvals.find((a) => a.id === "apr_1");
    if (!approval || approval.origin.kind !== "agentExecution") throw new Error("seed sem apr_1 agentExecution");
    approval.origin = { ...approval.origin, deadline: new Date(Date.now() - 1000).toISOString() };

    const result = decideApproval(state, THIAGO, "apr_1", "aprovada");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("prazo");
    expect(state.approvals.find((a) => a.id === "apr_1")?.decision).toBe("expirada");
  });

  it("(b) cancelar a Execução continua cancelando a aprovação", () => {
    const approval = state.approvals.find((a) => a.id === "apr_1");
    if (!approval || approval.origin.kind !== "agentExecution") throw new Error("seed sem apr_1 agentExecution");
    approval.origin = { ...approval.origin, deadline: new Date(Date.now() - 1000).toISOString() };

    decideApproval(state, THIAGO, "apr_1", "aprovada");

    const execucao = state.agentExecutions.find((e) => e.id === "exe_2");
    expect(execucao?.state).toBe("cancelada");
    expect(execucao?.terminationReason).toBe("Tempo limite de aprovação vencido");
  });

  it("(c) decideApproval sobre uma aprovação processTask recusa", () => {
    const { state, taskId, threadCommentId } = montarFixture();
    const solicitada = solicitarAprovacao(state, THIAGO, {
      taskId,
      approverMemberId: JULIA,
      threadCommentId,
    });
    if (!solicitada.ok) throw new Error(solicitada.error);

    const result = decideApproval(state, JULIA, solicitada.value.id, "aprovada");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("processo");
  });
});

describe("Aprovação de processo (V02-03B, D-06/D-09/D-11)", () => {
  it("(d) o aprovador designado aprova por clique — comentário canônico, Atividade e Status", () => {
    const { state, taskId, threadCommentId } = montarFixture();
    const solicitada = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });
    if (!solicitada.ok) throw new Error(solicitada.error);
    expect(state.tasks.find((t) => t.id === taskId)?.statusId).toBe("st_sol_em_aprovacao");

    const result = decideProcessApproval(state, JULIA, solicitada.value.id, "aprovada", { source: "click" });

    expect(result.ok).toBe(true);
    const task = state.tasks.find((t) => t.id === taskId);
    expect(task?.statusId).toBe("st_sol_aprovado");
    const resposta = task?.comments.find((c) => c.parentCommentId === threadCommentId);
    expect(resposta?.content).toBe("✅ Aprovado por Júlia Prado");
    const atividade = state.activity.find(
      (a) => a.objectType === "approvalRequest" && a.objectId === solicitada.value.id,
    );
    expect(atividade?.action).toBe("Aprovação decidida");
    expect(atividade?.detail).toContain("por clique");
    expect(state.approvals.find((a) => a.id === solicitada.value.id)?.decisionSource).toBe("click");
  });

  it("(e) repetir a MESMA decisão é sucesso idempotente, sem segundo Comentário nem segunda Atividade", () => {
    const { state, taskId, threadCommentId } = montarFixture();
    const solicitada = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });
    if (!solicitada.ok) throw new Error(solicitada.error);
    decideProcessApproval(state, JULIA, solicitada.value.id, "aprovada", { source: "click" });

    const task = state.tasks.find((t) => t.id === taskId)!;
    const comentariosAntes = task.comments.length;
    const atividadesAntes = state.activity.length;

    const result = decideProcessApproval(state, JULIA, solicitada.value.id, "aprovada", { source: "click" });

    expect(result.ok).toBe(true);
    expect(task.comments.length).toBe(comentariosAntes);
    expect(state.activity.length).toBe(atividadesAntes);
  });

  it("(f) a decisão oposta sobre aprovação já decidida é conflito — nada muda", () => {
    const { state, taskId, threadCommentId } = montarFixture();
    const solicitada = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });
    if (!solicitada.ok) throw new Error(solicitada.error);
    decideProcessApproval(state, JULIA, solicitada.value.id, "aprovada", { source: "click" });

    const result = decideProcessApproval(state, JULIA, solicitada.value.id, "rejeitada", {
      source: "click",
      reason: "mudei de ideia",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("já foi aprovada");
    expect(state.approvals.find((a) => a.id === solicitada.value.id)?.decision).toBe("aprovada");
    expect(state.tasks.find((t) => t.id === taskId)?.statusId).toBe("st_sol_aprovado");
  });

  it("(g) um Membro qualquer (não aprovador, não administrador) tenta decidir — recusa, nada muda", () => {
    const { state, taskId, threadCommentId } = montarFixture();
    const solicitada = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });
    if (!solicitada.ok) throw new Error(solicitada.error);

    const result = decideProcessApproval(state, MARCOS, solicitada.value.id, "aprovada", { source: "click" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("aprovador designado");
    expect(state.approvals.find((a) => a.id === solicitada.value.id)?.decision).toBeUndefined();
    expect(state.tasks.find((t) => t.id === taskId)?.statusId).toBe("st_sol_em_aprovacao");
  });

  it("(h) um Membro com papel base administrador decide, mesmo sem ser o aprovador designado", () => {
    const { state, taskId, threadCommentId } = montarFixture();
    const solicitada = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });
    if (!solicitada.ok) throw new Error(solicitada.error);

    const result = decideProcessApproval(state, RAFAEL, solicitada.value.id, "aprovada", { source: "click" });

    expect(result.ok).toBe(true);
    expect(state.tasks.find((t) => t.id === taskId)?.statusId).toBe("st_sol_aprovado");
  });

  it("(i) rejeitada sem motivo recusa", () => {
    const { state, taskId, threadCommentId } = montarFixture();
    const solicitada = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });
    if (!solicitada.ok) throw new Error(solicitada.error);

    const result = decideProcessApproval(state, JULIA, solicitada.value.id, "rejeitada", { source: "click" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("motivo");
    expect(state.approvals.find((a) => a.id === solicitada.value.id)?.decision).toBeUndefined();
  });

  it("(j) rejeitada com motivo — comentário canônico, Status não aprovado, decisionReason gravado", () => {
    const { state, taskId, threadCommentId } = montarFixture();
    const solicitada = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });
    if (!solicitada.ok) throw new Error(solicitada.error);

    const result = decideProcessApproval(state, JULIA, solicitada.value.id, "rejeitada", {
      source: "click",
      reason: "Nota fiscal divergente do RESUMO",
    });

    expect(result.ok).toBe(true);
    const task = state.tasks.find((t) => t.id === taskId);
    expect(task?.statusId).toBe("st_sol_nao_aprovado");
    const resposta = task?.comments.find((c) => c.parentCommentId === threadCommentId);
    expect(resposta?.content).toBe("❌ Reprovado por Júlia Prado");
    expect(state.approvals.find((a) => a.id === solicitada.value.id)?.decisionReason).toBe(
      "Nota fiscal divergente do RESUMO",
    );
  });

  it("(k) decisão por comentário grava decisionSource: comment e produz o MESMO comentário e Status que por clique", () => {
    const porClique = montarFixture();
    const solicitadaClique = solicitarAprovacao(porClique.state, THIAGO, {
      taskId: porClique.taskId,
      approverMemberId: JULIA,
      threadCommentId: porClique.threadCommentId,
    });
    if (!solicitadaClique.ok) throw new Error(solicitadaClique.error);
    decideProcessApproval(porClique.state, JULIA, solicitadaClique.value.id, "aprovada", { source: "click" });
    const taskClique = porClique.state.tasks.find((t) => t.id === porClique.taskId);
    const respostaClique = taskClique?.comments.find((c) => c.parentCommentId === porClique.threadCommentId);

    const porComentario = montarFixture();
    const solicitadaComentario = solicitarAprovacao(porComentario.state, THIAGO, {
      taskId: porComentario.taskId,
      approverMemberId: JULIA,
      threadCommentId: porComentario.threadCommentId,
    });
    if (!solicitadaComentario.ok) throw new Error(solicitadaComentario.error);
    const resultado = decideProcessApproval(
      porComentario.state,
      JULIA,
      solicitadaComentario.value.id,
      "aprovada",
      { source: "comment" },
    );
    const taskComentario = porComentario.state.tasks.find((t) => t.id === porComentario.taskId);
    const respostaComentario = taskComentario?.comments.find(
      (c) => c.parentCommentId === porComentario.threadCommentId,
    );

    expect(resultado.ok).toBe(true);
    expect(
      porComentario.state.approvals.find((a) => a.id === solicitadaComentario.value.id)?.decisionSource,
    ).toBe("comment");
    expect(respostaComentario?.content).toBe(respostaClique?.content);
    expect(taskComentario?.statusId).toBe(taskClique?.statusId);
  });

  it("(l) solicitarAprovacao chamada duas vezes para a mesma Tarefa devolve a mesma aprovação, sem criar a segunda", () => {
    const { state, taskId, threadCommentId } = montarFixture();

    const primeira = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });
    if (!primeira.ok) throw new Error(primeira.error);
    const segunda = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });

    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.value.id).toBe(primeira.value.id);
    expect(
      state.approvals.filter((a) => a.origin.kind === "processTask" && a.origin.taskId === taskId).length,
    ).toBe(1);
  });

  it("(m) uma aprovação processTask nunca ganha deadline", () => {
    const { state, taskId, threadCommentId } = montarFixture();

    const solicitada = solicitarAprovacao(state, THIAGO, { taskId, approverMemberId: JULIA, threadCommentId });

    expect(solicitada.ok).toBe(true);
    if (!solicitada.ok) return;
    expect(solicitada.value.origin.kind).toBe("processTask");
    expect("deadline" in solicitada.value.origin).toBe(false);
  });
});
