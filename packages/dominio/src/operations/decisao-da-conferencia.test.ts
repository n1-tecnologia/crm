/**
 * A decisão da Conferência do Resumo (Fase 6, Fluxo 6 — 06-01 Task 2): clique
 * e resposta no fio convergem em `decideProcessApproval`, no ramo `resumo`.
 * A resposta canônica vai ao fio, a decisão é gravada com a fonte, a
 * aprovação resolve o fio — e o Status da conta NUNCA muda aqui. O ramo
 * `pagamento` (Solicitação) continua idêntico.
 *
 * `state.activity` é newest-first: Registros achados por `objectId`/`action`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { StatusSet, Task } from "../types";
import { decideProcessApproval, solicitarAprovacao } from "./ai";
import { createTaskType } from "./configuration";
import { CP, publicarResumoParaConferencia, TEXTOS_DA_CONFERENCIA, type ConferenciaDoResumo, type DeParaDeLancamento } from "./financeiro";
import { createList, createSpace } from "./structure";
import { addTaskComment, createTask, resolveTaskComment } from "./tasks";

const PUBLICADOR = "mem_thiago"; // Proprietário que alcança a Lista — publica o Resumo (autor delegado do fio)
const MARCOS_PAULO = CP.aprovadorId; // Membro comum: nem o aprovador da Conferência, nem Administrador

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let conta: Task;
let conferencia: ConferenciaDoResumo;

const nome = (id: string) => state.members.find((m) => m.id === id)?.displayName ?? id;
const raiz = () => conta.comments.find((c) => c.id === conferencia.origin.threadCommentId);
const respostasNoFio = () => conta.comments.filter((c) => c.parentCommentId === conferencia.origin.threadCommentId);

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  const r = publicarResumoParaConferencia(state, PUBLICADOR, conta.id, { dePara: DE_PARA });
  if (!r.ok) throw new Error(r.error);
  conferencia = r.value.conferencia;
});

describe("(a) aprovar por clique", () => {
  it("resposta canônica no fio, decisão gravada, fio resolvido, Status intocado", () => {
    const statusAntes = conta.statusId;
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    const respostas = respostasNoFio();
    expect(respostas).toHaveLength(1);
    expect(respostas[0]?.content).toBe(`✅ Resumo conferido por ${nome(CP.financeiroId)}`);
    expect(respostas[0]?.content).toBe(TEXTOS_DA_CONFERENCIA.conferido(nome(CP.financeiroId)));
    expect(respostas[0]?.author).toEqual({ kind: "member", id: CP.financeiroId });

    expect(conferencia.decision).toBe("aprovada");
    expect(conferencia.decidedByMemberId).toBe(CP.financeiroId);
    expect(conferencia.decidedAt).toBeDefined();
    expect(conferencia.decisionSource).toBe("click");

    expect(raiz()?.resolved?.by).toBe(CP.financeiroId);
    expect(state.activity.some((a) => a.objectId === conta.id && a.action === "Comentário resolvido")).toBe(true);
    const decidida = state.activity.find((a) => a.objectId === conferencia.id && a.action === "Aprovação decidida");
    expect(decidida?.detail).toBe("por clique");
    expect(decidida?.objectName).toBe(conta.title);

    expect(conta.statusId).toBe(statusAntes);
  });
});

describe("(b) pedir ajuste", () => {
  it("sem motivo: recusa, nada gravado", () => {
    const antes = conta.comments.length;
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "rejeitada", { source: "click" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Rejeitar exige um motivo.");
    expect(conta.comments.length).toBe(antes);
    expect(conferencia.decision).toBeUndefined();
  });

  it("com motivo: resposta canônica, motivo gravado, fio aberto, Status intocado", () => {
    const statusAntes = conta.statusId;
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "rejeitada", { source: "click", reason: "é comercial" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(respostasNoFio().map((c) => c.content)).toEqual([`🔁 Ajuste pedido por ${nome(CP.financeiroId)}: é comercial`]);
    expect(conferencia.decision).toBe("rejeitada");
    expect(conferencia.decisionReason).toBe("é comercial");
    expect(raiz()?.resolved).toBeUndefined();
    expect(conta.statusId).toBe(statusAntes);
  });
});

describe("(c) pela resposta no fio", () => {
  it("source comment grava a fonte e publica a mesma resposta canônica", () => {
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "comment" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conferencia.decisionSource).toBe("comment");
    expect(respostasNoFio().map((c) => c.content)).toEqual([`✅ Resumo conferido por ${nome(CP.financeiroId)}`]);
    expect(state.activity.find((a) => a.objectId === conferencia.id && a.action === "Aprovação decidida")?.detail).toBe("por comentário");
  });
});

describe("(d) repetição e conflito", () => {
  it("a mesma decisão de novo é ok sem segundo Comentário; a oposta é conflito que cita quem decidiu", () => {
    const primeira = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" });
    expect(primeira.ok).toBe(true);
    const depois = conta.comments.length;

    const repetida = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "comment" });
    expect(repetida.ok).toBe(true);
    expect(conta.comments.length).toBe(depois);
    expect(conferencia.decisionSource).toBe("click");

    const oposta = decideProcessApproval(state, PUBLICADOR, conferencia.id, "rejeitada", { source: "click", reason: "outra coisa" });
    expect(oposta.ok).toBe(false);
    if (!oposta.ok) expect(oposta.error).toContain(nome(CP.financeiroId));
    expect(conta.comments.length).toBe(depois);
    expect(conferencia.decision).toBe("aprovada");
  });
});

describe("(e) quem não confere", () => {
  it("Membro que não é o aprovador nem Administrador/Proprietário: recusa, sem Comentário", () => {
    const antes = conta.comments.length;
    const r = decideProcessApproval(state, MARCOS_PAULO, conferencia.id, "aprovada", { source: "click" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Você não é o aprovador designado desta Solicitação.");
    expect(conta.comments.length).toBe(antes);
    expect(conferencia.decision).toBeUndefined();
  });
});

describe("(f) o ramo pagamento continua idêntico", () => {
  const STATUS_SET: StatusSet = {
    id: "sts_sol_teste_06",
    definitions: [
      { id: "st_sol6_para_fazer", name: "para fazer", color: "#94a3b8", category: "naoIniciado", order: 0 },
      { id: "st_sol6_em_aprovacao", name: "em aprovação", color: "#f59e0b", category: "emAndamento", order: 1 },
      { id: "st_sol6_nao_aprovado", name: "não aprovado", color: "#ef4444", category: "concluido", order: 2 },
      { id: "st_sol6_aprovado", name: "aprovado", color: "#22c55e", category: "fechado", order: 3 },
    ],
  };

  it("aprovar uma Solicitação publica `✅ Aprovado por` e move para “aprovado”", () => {
    const THIAGO = PUBLICADOR;
    const JULIA = "mem_julia";
    const espaco = createSpace(state, THIAGO, { name: "Financeiro (teste 06-01)", statusSet: STATUS_SET });
    if (!espaco.ok) throw new Error(espaco.error);
    const tipo = createTaskType(state, THIAGO, { name: "Solicitação (teste 06)", icon: "circle", definedAtType: "space", definedAtId: espaco.value.id });
    if (!tipo.ok) throw new Error(tipo.error);
    const lista = createList(state, THIAGO, { name: "Solicitações (teste 06)", parentType: "space", parentId: espaco.value.id });
    if (!lista.ok) throw new Error(lista.error);
    const task = createTask(state, THIAGO, { listId: lista.value.id, title: "Pagamento de teste" });
    if (!task.ok) throw new Error(task.error);
    const fio = addTaskComment(state, THIAGO, task.value.id, { content: "Júlia, para aprovação (RESUMO)." });
    if (!fio.ok) throw new Error(fio.error);

    const solicitada = solicitarAprovacao(state, THIAGO, { taskId: task.value.id, approverMemberId: JULIA, threadCommentId: fio.value.id });
    if (!solicitada.ok) throw new Error(solicitada.error);
    expect(solicitada.value.origin).toMatchObject({ processStep: "pagamento" });
    expect(task.value.statusId).toBe("st_sol6_em_aprovacao");

    const r = decideProcessApproval(state, JULIA, solicitada.value.id, "aprovada", { source: "click" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(task.value.statusId).toBe("st_sol6_aprovado");
    const resposta = task.value.comments.find((c) => c.parentCommentId === fio.value.id);
    expect(resposta?.content).toBe(`✅ Aprovado por ${nome(JULIA)}`);
    // O fio da Solicitação não é resolvido pela decisão — só o do Resumo é.
    expect(task.value.comments.find((c) => c.id === fio.value.id)?.resolved).toBeUndefined();
  });
});

describe("(g) resolver o fio do Resumo à mão", () => {
  it("o aprovador da Conferência (não Administrador, não autor) resolve; outro Membro comum, não", () => {
    const papel = state.roles.find((r) => r.id === state.members.find((m) => m.id === CP.financeiroId)?.roleId)?.base;
    expect(papel).toBe("membro");
    expect(raiz()?.authorDelegate?.id).toBe(PUBLICADOR);

    const outro = resolveTaskComment(state, MARCOS_PAULO, conta.id, conferencia.origin.threadCommentId, true);
    expect(outro.ok).toBe(false);
    expect(raiz()?.resolved).toBeUndefined();

    const r = resolveTaskComment(state, CP.financeiroId, conta.id, conferencia.origin.threadCommentId, true);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(raiz()?.resolved?.by).toBe(CP.financeiroId);
  });
});
