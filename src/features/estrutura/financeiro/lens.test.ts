/**
 * A lente financeira sobre "Contas a pagar": grupos derivados, data do
 * pagamento, filtros de período e paridade entre o que a tela oferece e o
 * que a operação aceita.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { CP, changeTaskStatus, statusOptionRefusal } from "@/data/operations";
import type { DataState } from "@/data/state";
import type { Task } from "@/data/types";
import {
  applyFinanceFilters,
  FILTROS_INICIAIS,
  financeGroupOf,
  pagoEm,
} from "./lens";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};
const hoje = new Date();
const dia = (dias: number) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("financeGroupOf", () => {
  it("deriva o grupo do Status e do vencimento, nunca grava", () => {
    const now = new Date();
    expect(financeGroupOf(state, conta("tsk_cp_konq"), now)).toBe("autorizacao");
    expect(financeGroupOf(state, conta("tsk_cp_trafego"), now)).toBe("aPagar");
    expect(financeGroupOf(state, conta("tsk_cp_condominio"), now)).toBe("programadas");
    expect(financeGroupOf(state, conta("tsk_cp_recarga"), now)).toBe("pagas");
    // Vencida em Status não terminal, mesmo fora de "para pagar".
    expect(financeGroupOf(state, conta("tsk_cp_negada"), now)).toBe("vencidas");
  });

  it("negado é grupo próprio; vencida em Status terminal (aprovado) não é “vencida”", () => {
    const t = conta("tsk_cp_konq");
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, CP.status.negado).ok).toBe(true);
    expect(financeGroupOf(state, t, new Date())).toBe("negadas");
    const atrasada = conta("tsk_cp_negada");
    atrasada.statusId = CP.status.aprovado;
    expect(financeGroupOf(state, atrasada, new Date())).toBe("programadas");
  });
});

describe("pagoEm", () => {
  it("usa a entrada em “pago” da Atividade, não o completedAt (que já é de “aprovado”)", () => {
    const t = conta("tsk_cp_konq");
    expect(pagoEm(state, t)).toBeUndefined();
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, CP.status.aprovado).ok).toBe(true);
    t.completedAt = "2020-01-01T12:00:00.000Z"; // aprovado meses antes
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, CP.status.pago).ok).toBe(true);
    const pago = pagoEm(state, t);
    expect(pago).toBeDefined();
    expect(pago ?? 0).toBeGreaterThan(Date.parse("2025-01-01"));
  });

  it("toda conta paga do seed tem data de pagamento", () => {
    for (const t of state.tasks.filter((x) => x.listId === CP.listId && x.statusId === CP.status.pago)) {
      expect(pagoEm(state, t), t.id).toBeDefined();
    }
  });
});

describe("applyFinanceFilters", () => {
  const contas = () => state.tasks.filter((t) => t.listId === CP.listId);

  it("texto casa título, fornecedor e código; empresa casa o campo", () => {
    const now = new Date();
    const porCodigo = applyFinanceFilters(state, contas(), { ...FILTROS_INICIAIS, texto: "cp-106" }, now);
    expect(porCodigo.map((t) => t.readableId)).toEqual(["CP-106"]);
    const porFornecedor = applyFinanceFilters(state, contas(), { ...FILTROS_INICIAIS, texto: "pedro alencar" }, now);
    expect(porFornecedor.length).toBeGreaterThan(0);
    const porEmpresa = applyFinanceFilters(state, contas(), { ...FILTROS_INICIAIS, empresa: "Konquista" }, now);
    expect(porEmpresa.every((t) => t.fieldValues.some((v) => v.definitionId === CP.fields.empresa && v.value === "Konquista"))).toBe(true);
  });

  it("“Próximos 30 dias” começa hoje: vencida ontem fica de fora mesmo de manhã", () => {
    const t = conta("tsk_cp_trafego");
    t.dueDate = { form: "civilDay", value: dia(-1) };
    const manha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 10);
    const r = applyFinanceFilters(state, [t], { ...FILTROS_INICIAIS, periodo: "30dias" }, manha);
    expect(r).toHaveLength(0);
    t.dueDate = { form: "civilDay", value: dia(0) };
    expect(applyFinanceFilters(state, [t], { ...FILTROS_INICIAIS, periodo: "30dias" }, manha)).toHaveLength(1);
    t.dueDate = { form: "civilDay", value: dia(31) };
    expect(applyFinanceFilters(state, [t], { ...FILTROS_INICIAIS, periodo: "30dias" }, manha)).toHaveLength(0);
  });

  it("“Este mês” usa o mês civil local: último dia entra, primeiro do seguinte não", () => {
    const now = new Date(2026, 8, 13, 15); // 13/09/2026
    const t = conta("tsk_cp_trafego");
    t.dueDate = { form: "civilDay", value: "2026-09-30" };
    expect(applyFinanceFilters(state, [t], { ...FILTROS_INICIAIS, periodo: "mes" }, now)).toHaveLength(1);
    t.dueDate = { form: "civilDay", value: "2026-10-01" };
    expect(applyFinanceFilters(state, [t], { ...FILTROS_INICIAIS, periodo: "mes" }, now)).toHaveLength(0);
  });
});

describe("paridade tela ↔ operação", () => {
  it("o Financeiro vê “Marcar como paga” desabilitado pelo mesmo motivo que a operação recusa", () => {
    const t = conta("tsk_cp_konq");
    const motivo = statusOptionRefusal(state, CP.financeiroId, t, CP.status.pago);
    expect(motivo).toMatch(/pago/);
    const r = changeTaskStatus(state, CP.financeiroId, t.id, CP.status.pago);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Marcos Paulo.*“pago”/);
    expect(statusOptionRefusal(state, CP.aprovadorId, t, CP.status.pago)).toBeUndefined();
  });
});
