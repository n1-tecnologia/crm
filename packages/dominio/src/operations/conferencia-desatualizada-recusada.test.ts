/**
 * crm:WR-08 (06-11 Task 1) — uma Conferência velha não se decide. Se a
 * impressão de lançamento da conta mudou depois do Resumo, a Conferência
 * afirmaria que alguém conferiu dados que não são os da conta: o domínio
 * recusa as duas decisões SEM efeito (nada no fio, nada gravado, fio
 * intocado). A régua é a impressão, não o relógio: com os dados de volta, a
 * mesma Conferência volta a ser decidível.
 *
 * `state.activity` é newest-first: Registros achados por `objectId`/`action`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { decideProcessApproval } from "./ai";
import { CP, publicarResumoParaConferencia, TEXTOS_DA_CONFERENCIA, type ConferenciaDoResumo, type DeParaDeLancamento } from "./financeiro";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let conta: Task;
let conferencia: ConferenciaDoResumo;
let valorOriginal: unknown;

const raiz = () => conta.comments.find((c) => c.id === conferencia.origin.threadCommentId);

/** O retrato do que uma recusa não pode ter mudado. */
function retrato() {
  return {
    comments: conta.comments.length,
    approvals: state.approvals.length,
    activity: state.activity.length,
    executions: state.agentExecutions.length,
    statusId: conta.statusId,
    resolvido: raiz()?.resolved,
    decision: conferencia.decision,
  };
}

function valor(): { value: unknown } {
  const fv = conta.fieldValues.find((f) => f.definitionId === CP.fields.valor && f.state === "ativo");
  if (!fv) throw new Error("sem Valor");
  return fv as { value: unknown };
}

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  const r = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA });
  if (!r.ok) throw new Error(r.error);
  conferencia = r.value.conferencia;
  valorOriginal = valor().value;
});

describe("(a) aprovar uma Conferência cuja impressão não é mais a da conta", () => {
  it("recusa com recusaDesatualizada, sem efeito", () => {
    valor().value = 99;
    const antes = retrato();
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDesatualizada);
    expect(retrato()).toEqual(antes);
    expect(conferencia.decision).toBeUndefined();
    expect(raiz()?.resolved).toBeUndefined();
    expect(conta.comments.some((c) => c.content.startsWith("✅ Resumo conferido por"))).toBe(false);
  });
});

describe("(b) pedir ajuste de uma Conferência velha", () => {
  it.each(["click", "comment"] as const)("rejeitada por %s: a mesma recusa, sem efeito", (source) => {
    valor().value = 99;
    const antes = retrato();
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "rejeitada", { source, reason: "é comercial" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDesatualizada);
    expect(retrato()).toEqual(antes);
    expect(conferencia.decision).toBeUndefined();
  });

  it("aprovada por comentário: a mesma recusa, sem efeito", () => {
    valor().value = 99;
    const antes = retrato();
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "comment" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDesatualizada);
    expect(retrato()).toEqual(antes);
  });
});

describe("(c) a régua é a impressão, não o relógio", () => {
  it("com o Valor de volta ao original, a MESMA Conferência volta a ser decidível", () => {
    valor().value = 99;
    expect(decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" }).ok).toBe(false);
    valor().value = valorOriginal;
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conferencia.decision).toBe("aprovada");
    expect(raiz()?.resolved?.by).toBe(CP.financeiroId);
  });
});

describe("(d) o Resumo novo, publicado porque os dados mudaram", () => {
  it("a Conferência NOVA se decide", () => {
    valor().value = 99;
    const novo = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA, motivo: "dados-mudaram" });
    if (!novo.ok) throw new Error(novo.error);
    expect(novo.value.conferencia.id).not.toBe(conferencia.id);
    const r = decideProcessApproval(state, CP.financeiroId, novo.value.conferencia.id, "aprovada", { source: "click" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
  });
});

describe("(e) a repetição idempotente continua antes da guarda (D-09)", () => {
  it("aprovada com a impressão igual, a conta muda, repetir aprovada é ok sem efeito", () => {
    const d = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" });
    expect(d.ok, d.ok ? "" : d.error).toBe(true);
    valor().value = 99;
    const antes = retrato();
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" });
    expect(r.ok).toBe(true);
    expect(retrato()).toEqual(antes);
  });
});
