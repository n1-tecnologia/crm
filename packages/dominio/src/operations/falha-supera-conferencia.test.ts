/**
 * crm:WR-09 e crm:CR-02, o lado do domínio (06-12 Task 2) — a saída do beco
 * depois de `CONTA_DIVERGENTE`. A Conferência aprovada afirmou uma conta
 * corrente que o Omie não usaria mais: `registrarFalhaDoLancamento(…, {
 * superarConferencia: true })` a cancela ("Conferência superada"), e a
 * Conferência vigente passa a ser nenhuma — uma Conferência mais antiga
 * (rejeitada ou aprovada) nunca volta a valer. O ciclo seguinte da ponte
 * publica um Resumo NOVO, com a conta de agora.
 *
 * Sem a opção (o caminho de `TITULO_EXISTENTE_DIVERGENTE`), a Conferência
 * fica: o que está errado é o título no Omie, não a conferência.
 *
 * `state.activity` é newest-first: Registros achados por `objectId`/`action`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { decideProcessApproval } from "./ai";
import {
  CP,
  TEXTOS_DA_CONFERENCIA,
  conferenciaDoResumo,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  type ConferenciaDoResumo,
  type DeParaDeLancamento,
} from "./financeiro";
import { conferenciaVigente } from "./financeiro-base";
import { changeTaskStatus } from "./tasks";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

const CODE = "CONTA_DIVERGENTE";
const FALHA = { motivo: TEXTOS_DA_CONFERENCIA.contaDivergente("TRIA", "TRIA COMPANY - ITAU"), code: CODE } as const;

let state: DataState;
let conta: Task;
let c1: ConferenciaDoResumo;
let c2: ConferenciaDoResumo;

const retrato = () => ({
  comments: conta.comments.length,
  activity: state.activity.length,
  statusId: conta.statusId,
  c2: { decision: c2.decision, decidedAt: c2.decidedAt },
});
const superada = () => state.activity.find((a) => a.objectId === c2.id && a.action === "Conferência superada");

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  // C1 publicada e rejeitada ("é comercial").
  const p1 = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA });
  if (!p1.ok) throw new Error(p1.error);
  c1 = p1.value.conferencia;
  const r1 = decideProcessApproval(state, CP.financeiroId, c1.id, "rejeitada", { source: "click", reason: "é comercial" });
  if (!r1.ok) throw new Error(r1.error);
  // C2 revisada e aprovada.
  const p2 = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA, conferenciaRejeitadaId: c1.id });
  if (!p2.ok) throw new Error(p2.error);
  c2 = p2.value.conferencia;
  const r2 = decideProcessApproval(state, CP.financeiroId, c2.id, "aprovada", { source: "click" });
  if (!r2.ok) throw new Error(r2.error);
  // Em "em lançamento omie", por movimento.
  const m = changeTaskStatus(state, CP.financeiroId, conta.id, CP.status.emLancamento);
  if (!m.ok) throw new Error(m.error);
  expect(conferenciaDoResumo(state, conta)).toMatchObject({ estado: "conferida", conferencia: { id: c2.id } });
});

describe("(a) superarConferencia — CONTA_DIVERGENTE", () => {
  it("cancela a aprovada com Registro, a vigente vira nenhuma (não a rejeitada C1), e o Resumo seguinte é de primeira vez", () => {
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, FALHA, { superarConferencia: true });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.statusId).toBe(CP.status.paraPagar);
    expect(c2.decision).toBe("cancelada");
    expect(c2.decidedAt).toBeTruthy();

    const registro = superada();
    expect(registro).toMatchObject({ objectType: "approvalRequest", before: "aprovada", after: "cancelada" });
    expect(registro?.detail).toContain(CODE);

    expect(conferenciaDoResumo(state, conta).estado).toBe("sem-resumo");
    expect(c1.decision).toBe("rejeitada");

    const novo = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA });
    expect(novo.ok, novo.ok ? "" : novo.error).toBe(true);
    if (!novo.ok) return;
    expect(novo.value.conferencia.id).not.toBe(c2.id);
    expect(novo.value.comentario.content).not.toContain("Revisado a pedido de");
    expect(novo.value.comentario.content).toContain('confira: responda "ok" para eu lançar');
    expect(conferenciaDoResumo(state, conta)).toMatchObject({ estado: "pendente", conferencia: { id: novo.value.conferencia.id } });
  });
});

describe("(b) sem a opção — TITULO_EXISTENTE_DIVERGENTE", () => {
  it("a Conferência continua aprovada, e a conta conferida em “para pagar”", () => {
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, {
      motivo: TEXTOS_DA_CONFERENCIA.tituloDivergente("5872791251", ["valor"]),
      code: "TITULO_EXISTENTE_DIVERGENTE",
    });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(c2.decision).toBe("aprovada");
    expect(superada()).toBeUndefined();
    expect(conta.statusId).toBe(CP.status.paraPagar);
    expect(conferenciaDoResumo(state, conta)).toMatchObject({ estado: "conferida", conferencia: { id: c2.id } });
  });
});

describe("(c) tudo ou nada", () => {
  it("Agente pausado: recusa sem efeito, C2 intocada", () => {
    const agente = state.agents.find((a) => a.id === CP.agentId);
    if (!agente) throw new Error("sem Agente");
    agente.lifecycle = "pausado";
    const antes = retrato();
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, FALHA, { superarConferencia: true });
    expect(r.ok).toBe(false);
    expect(retrato()).toEqual(antes);
    expect(c2.decision).toBe("aprovada");
    expect(superada()).toBeUndefined();
  });
});

describe("(d) conferenciaVigente — a mais recente; cancelada ou expirada, nenhuma", () => {
  it("a mais recente cancelada ⇒ undefined, mesmo com uma mais antiga rejeitada", () => {
    c2.decision = "cancelada";
    expect(conferenciaVigente(state, conta.id)).toBeUndefined();
    c2.decision = "expirada";
    expect(conferenciaVigente(state, conta.id)).toBeUndefined();
  });

  it("uma mais antiga cancelada e a mais nova pendente ⇒ a mais nova (o único cancelamento de antes)", () => {
    const outro = buildSeed();
    const t = outro.tasks.find((x) => x.id === "tsk_cp_das");
    if (!t) throw new Error("sem tsk_cp_das");
    const p1 = publicarResumoParaConferencia(outro, CP.financeiroId, t.id, { dePara: DE_PARA });
    if (!p1.ok) throw new Error(p1.error);
    const p2 = publicarResumoParaConferencia(outro, CP.financeiroId, t.id, { dePara: DE_PARA, pedidoDeRevisao: "troque a categoria" });
    if (!p2.ok) throw new Error(p2.error);
    expect(p1.value.conferencia.decision).toBe("cancelada");
    expect(conferenciaVigente(outro, t.id)?.id).toBe(p2.value.conferencia.id);
  });
});
