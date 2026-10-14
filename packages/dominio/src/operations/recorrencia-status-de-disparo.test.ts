/**
 * FUND-08 — Status de disparo da Recorrência. Em Contas a pagar, a conta do
 * mês seguinte nasce ao entrar em "pago": "aprovado" e "negado" são conclusão
 * pela ontologia (categoria terminal), mas não disparam. Sem Status de
 * disparo na regra, vale a ontologia: qualquer passagem a terminal.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { setRecurrence, transicaoDisparaRecorrencia } from "./collaboration";
import { CP } from "./financeiro";
import { changeTaskStatus } from "./tasks";

const S = CP.status;
let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};
const geradasDe = (id: string) => state.tasks.filter((t) => t.provenance?.kind === "recurrence" && t.provenance.sourceId === id);

describe("Recorrência com Status de disparo (Contas a pagar)", () => {
  it("o seed aponta para “pago”", () => {
    expect(conta("tsk_cp_thiago_out").recurrence?.triggerStatusId).toBe(S.pago);
  });

  it("aprovado não cria a próxima; pago, vindo de aprovado, cria; reabrir e pagar de novo não duplica", () => {
    const t = conta("tsk_cp_thiago_out");
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emAutorizacao).ok).toBe(true);
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.aprovado).ok).toBe(true);
    expect(geradasDe(t.id)).toHaveLength(0);
    expect(t.recurrence).toBeDefined();
    expect(t.completedAt).toBeDefined();

    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.pago).ok).toBe(true);
    expect(geradasDe(t.id)).toHaveLength(1);
    expect(t.recurrence).toBeUndefined();
    expect(geradasDe(t.id)[0]?.recurrence?.triggerStatusId).toBe(S.pago);

    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.lancado).ok).toBe(true);
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.pago).ok).toBe(true);
    expect(geradasDe(t.id)).toHaveLength(1);
  });

  it("negado não cria a próxima e mantém a regra para quando for paga", () => {
    const t = conta("tsk_cp_thiago_out");
    expect(t.recurrence?.triggerStatusId).toBe(S.pago);
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emAutorizacao).ok).toBe(true);
    const negado = changeTaskStatus(state, CP.aprovadorId, t.id, S.negado);
    expect(negado.ok, negado.ok ? "" : negado.error).toBe(true);
    expect(geradasDe(t.id)).toHaveLength(0);
    expect(t.recurrence).toBeDefined();
  });

  it("setRecurrence recusa Status de disparo de outra Lista ou não terminal", () => {
    const t = conta("tsk_cp_thiago_out");
    const base = { frequency: "mensal" as const, interval: 1, triggerMode: "aoConcluir" as const, copies: { checklists: false, subtasks: false, assignees: false, fieldValues: true } };
    const naoTerminal = setRecurrence(state, CP.financeiroId, t.id, { ...base, triggerStatusId: S.emAutorizacao });
    expect(naoTerminal.ok).toBe(false);
    if (!naoTerminal.ok) expect(naoTerminal.error).toContain("conclusão");
    expect(setRecurrence(state, CP.financeiroId, t.id, { ...base, triggerStatusId: "st_de_outra_lista" }).ok).toBe(false);
    expect(setRecurrence(state, CP.financeiroId, t.id, { ...base, triggerStatusId: S.pago }).ok).toBe(true);
  });

  it("sem Status de disparo, vale a ontologia: não terminal → terminal dispara; terminal → terminal não", () => {
    const regra = { frequency: "mensal" as const, interval: 1, triggerMode: "aoConcluir" as const, copies: { checklists: false, subtasks: false, assignees: false, fieldValues: false } };
    const aberto = { id: "a", category: "emAndamento" as const };
    const aprovado = { id: "b", category: "concluido" as const };
    const pago = { id: "c", category: "fechado" as const };
    expect(transicaoDisparaRecorrencia(regra, aberto, aprovado)).toBe(true);
    expect(transicaoDisparaRecorrencia(regra, aprovado, pago)).toBe(false);
    expect(transicaoDisparaRecorrencia({ ...regra, triggerStatusId: "c" }, aberto, aprovado)).toBe(false);
    expect(transicaoDisparaRecorrencia({ ...regra, triggerStatusId: "c" }, aprovado, pago)).toBe(true);
    expect(transicaoDisparaRecorrencia({ ...regra, triggerMode: "porCalendario" }, aberto, pago)).toBe(false);
  });
});
