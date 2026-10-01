/**
 * Checklist 3.1 — a reprovação por comentário. O domínio exige motivo para
 * reprovar (`decideProcessApproval`), e a rota de classificação decidia só com
 * `{ source: "comment" }`: todo "reprovado" classificado voltava 409. Agora o
 * motivo é a própria resposta do aprovador. Sem banco: a decisão roda em
 * memória com as mesmas opções que a rota monta.
 */
import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { decideProcessApproval, solicitarAprovacao } from "@n1/dominio/operations/ai";
import { addTaskComment, createTask } from "@n1/dominio/operations/tasks";
import { buildSeed } from "@n1/dominio/seed";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { opcoesDaDecisaoPorComentario } from "./classificacoes";

const LISTA_ID = "lst_solicitacoes_de_pagamento";

function topicoComResposta(textoDaResposta: string) {
  const state = buildSeed();
  const servico = state.members.find((m) => m.userId === usuarioDoSeed("mem_maryane"));
  if (!servico) throw new Error("seed sem mem_maryane");
  const evolucao = evoluirConfiguracaoDeSolicitacoes(state, servico.id);
  if (!evolucao.ok) throw new Error(evolucao.error);
  const aprovador = state.members.find((m) => m.id === "mem_thiago");
  if (!aprovador) throw new Error("seed sem mem_thiago");

  const tarefa = createTask(state, servico.id, { listId: LISTA_ID, title: "Solicitação — reprovação por comentário" });
  if (!tarefa.ok) throw new Error(tarefa.error);
  const raiz = addTaskComment(state, servico.id, tarefa.value.id, { content: "@Aprovador, para aprovação." });
  if (!raiz.ok) throw new Error(raiz.error);
  const aprovacao = solicitarAprovacao(state, servico.id, {
    taskId: tarefa.value.id,
    approverMemberId: aprovador.id,
    threadCommentId: raiz.value.id,
  });
  if (!aprovacao.ok) throw new Error(aprovacao.error);
  const resposta = addTaskComment(state, aprovador.id, tarefa.value.id, { content: textoDaResposta, parentCommentId: raiz.value.id });
  if (!resposta.ok) throw new Error(resposta.error);
  return { state, aprovadorId: aprovador.id, approvalId: aprovacao.value.id, taskId: tarefa.value.id, resposta: resposta.value };
}

describe("opcoesDaDecisaoPorComentario", () => {
  it("aprovação não leva motivo", () => {
    expect(opcoesDaDecisaoPorComentario("aprovada", "ok, pode seguir")).toEqual({ source: "comment" });
  });

  it("reprovação leva a resposta do aprovador como motivo", () => {
    expect(opcoesDaDecisaoPorComentario("rejeitada", "  Reprovado: valor diverge do contrato.  ")).toEqual({
      source: "comment",
      reason: "Reprovado: valor diverge do contrato.",
    });
  });

  it("reprovação com resposta em branco ainda leva um motivo", () => {
    expect(opcoesDaDecisaoPorComentario("rejeitada", "   ").reason).toBe("Reprovado por comentário.");
  });
});

describe("a decisão que a rota toma, em memória", () => {
  it("sem o motivo (a chamada antiga), o domínio recusa a reprovação", () => {
    const t = topicoComResposta("Não aprovo, valor errado.");
    const r = decideProcessApproval(t.state, t.aprovadorId, t.approvalId, "rejeitada", { source: "comment" });
    expect(r.ok).toBe(false);
  });

  it("com as opções da rota, a reprovação por comentário decide e põe a resposta como motivo", () => {
    const t = topicoComResposta("Não aprovo, valor errado.");
    const r = decideProcessApproval(t.state, t.aprovadorId, t.approvalId, "rejeitada", opcoesDaDecisaoPorComentario("rejeitada", t.resposta.content));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.decision).toBe("rejeitada");
    expect(r.value.decisionReason).toBe("Não aprovo, valor errado.");
    const tarefa = t.state.tasks.find((x) => x.id === t.taskId);
    expect(tarefa?.comments.some((c) => c.content.startsWith("❌ Reprovado por"))).toBe(true);
  });
});
