/**
 * crm:WR-03, lado do domínio (06-11 Task 1) — um Resumo sem código de
 * Categoria não se confere. `9.99.99` é preenchimento ("A classificar"), não
 * código; aprovar uma Conferência `ausente`, ou com um código fora da forma
 * do contrato v1.1 (`d.dd.dd` ou `d.dd.dd.dd`), recusa SEM efeito com
 * `recusaSemCodigo`. Pedir ajuste continua aberto: é o caminho para sair do
 * beco. `revisar` aprova (D6-02: quem decide é o Financeiro).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { decideProcessApproval } from "./ai";
import {
  CP,
  lancamentoSemCodigo,
  publicarResumoParaConferencia,
  TEXTOS_DA_CONFERENCIA,
  type ConferenciaDoResumo,
  type DeParaDeLancamento,
  type ResolucaoDeCategoria,
} from "./financeiro";

let state: DataState;
let conta: Task;

const deParaCom = (categoriaPorCampo: Record<string, ResolucaoDeCategoria>): DeParaDeLancamento => ({
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo,
  origem: "omie",
});

function publicar(dePara: DeParaDeLancamento): ConferenciaDoResumo {
  const r = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara });
  if (!r.ok) throw new Error(r.error);
  return r.value.conferencia;
}

const raizDe = (c: ConferenciaDoResumo) => conta.comments.find((x) => x.id === c.origin.threadCommentId);

function retrato(c: ConferenciaDoResumo) {
  return {
    comments: conta.comments.length,
    approvals: state.approvals.length,
    activity: state.activity.length,
    resolvido: raizDe(c)?.resolved,
    decision: c.decision,
  };
}

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
});

describe("(a) Categoria ausente do de-para (código de preenchimento 9.99.99)", () => {
  it("aprovar recusa com recusaSemCodigo, sem efeito", () => {
    const c = publicar(deParaCom({}));
    expect(c.origin.lancamento).toMatchObject({ veredito: "ausente", codigo: "9.99.99" });
    const antes = retrato(c);
    const r = decideProcessApproval(state, CP.financeiroId, c.id, "aprovada", { source: "click" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaSemCodigo);
    expect(TEXTOS_DA_CONFERENCIA.recusaSemCodigo).toContain("Peça ajuste com o código da Categoria");
    expect(retrato(c)).toEqual(antes);
    expect(c.decision).toBeUndefined();
    expect(raizDe(c)?.resolved).toBeUndefined();
  });

  it("aprovar pelo fio também recusa", () => {
    const c = publicar(deParaCom({}));
    const r = decideProcessApproval(state, CP.financeiroId, c.id, "aprovada", { source: "comment" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaSemCodigo);
  });
});

describe("(b) pedir ajuste continua aberto", () => {
  it("rejeitada com o código certo no motivo → ok", () => {
    const c = publicar(deParaCom({}));
    const r = decideProcessApproval(state, CP.financeiroId, c.id, "rejeitada", { source: "click", reason: "use 2.06.01" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(c.decision).toBe("rejeitada");
    expect(c.decisionReason).toBe("use 2.06.01");
  });
});

describe("(c) a forma do código é a do contrato v1.1", () => {
  it("resolvida com 2.6.1 (fora da forma) → aprovar recusa", () => {
    const c = publicar(deParaCom({ Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.6.1" } }));
    const r = decideProcessApproval(state, CP.financeiroId, c.id, "aprovada", { source: "click" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaSemCodigo);
    expect(c.decision).toBeUndefined();
  });

  it("resolvida com 2.02.98.01 (quatro níveis) → aprovar passa", () => {
    const c = publicar(deParaCom({ Impostos: { veredito: "resolvida", nome: "Outras despesas", codigo: "2.02.98.01" } }));
    const r = decideProcessApproval(state, CP.financeiroId, c.id, "aprovada", { source: "click" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(c.decision).toBe("aprovada");
  });

  it("revisar com 2.06.09 → aprovar passa (D6-02: quem decide é o Financeiro)", () => {
    const c = publicar(
      deParaCom({ Impostos: { veredito: "revisar", nome: "Taxas diversas", codigo: "2.06.09", similaridade: 0.61, motivo: "nome parecido" } }),
    );
    const r = decideProcessApproval(state, CP.financeiroId, c.id, "aprovada", { source: "click" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
  });
});

describe("(d) lancamentoSemCodigo", () => {
  it.each([
    ["ausente", "9.99.99", true],
    ["resolvida", "2.06.01", false],
    ["resolvida", "2.02.98.01", false],
    ["resolvida", "2.6.1", true],
    ["resolvida", "", true],
    ["revisar", "2.06.09", false],
    // Sem `trim`: o código é dado, não texto (D6-10).
    ["resolvida", "2.06.01 ", true],
  ] as const)("{%s, %j} → %s", (veredito, codigo, esperado) => {
    expect(lancamentoSemCodigo({ veredito, codigo })).toBe(esperado);
  });
});
