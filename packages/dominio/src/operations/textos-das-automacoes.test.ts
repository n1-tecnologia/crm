/**
 * O texto dos Comentários que as Automações escrevem quando falta dado na conta.
 * Achado da simulação no Espaço de produção (2026-09-28): a R4 sem cliente saía
 * "—, o cliente está há 30 dias…" e a A5 sem Empresa, "para o CNPJ da Empresa —".
 */
import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { runScheduledAutomations } from "./automations";
import { CP, CR } from "./financeiro";
import { createTask, setTaskFieldValue } from "./tasks";

const MARYANE = CP.financeiroId;

function dia(isoCivil: string, somar: number): Date {
  const d = new Date(`${isoCivil}T12:00:00-03:00`);
  d.setDate(d.getDate() + somar);
  return d;
}

function comentariosAutomaticos(state: DataState, taskId: string): string[] {
  return (state.tasks.find((t) => t.id === taskId)?.comments ?? []).filter((c) => c.author.kind !== "member").map((c) => c.content);
}

describe("textos das Automações com dado faltando", () => {
  it("R4 sem cliente vinculado: sem saudação vazia, começa em maiúscula", () => {
    const state = buildSeed();
    const conta = createTask(state, MARYANE, { listId: CR.listId, title: "Parcela sem cliente", dueDate: { form: "civilDay", value: "2026-10-01" } });
    expect(conta.ok).toBe(true);
    if (!conta.ok) return;
    runScheduledAutomations(state, MARYANE, CR.listId, dia("2026-10-01", 1)); // R2 leva a "pendente"
    runScheduledAutomations(state, MARYANE, CR.listId, dia("2026-10-01", 30)); // R4
    const r4 = comentariosAutomaticos(state, conta.value.id).find((c) => c.includes("30 dias em cobrança"));
    expect(r4).toBeDefined();
    expect(r4).not.toMatch(/^—/);
    expect(r4?.startsWith("O cliente está há 30 dias em cobrança")).toBe(true);
  });

  it("A5 sem Empresa na conta: diz que a Empresa não foi preenchida, em vez de \"da Empresa —\"", () => {
    const state = buildSeed();
    const conta = createTask(state, MARYANE, { listId: CP.listId, title: "Nota sem Empresa", dueDate: { form: "civilDay", value: "2026-10-20" } });
    expect(conta.ok).toBe(true);
    if (!conta.ok) return;
    expect(setTaskFieldValue(state, MARYANE, conta.value.id, CP.fields.centroDeCusto, "TRIA").ok).toBe(true);
    expect(setTaskFieldValue(state, MARYANE, conta.value.id, CP.fields.pessoa, MARYANE).ok).toBe(true);
    runScheduledAutomations(state, MARYANE, CP.listId, dia("2026-10-20", -5)); // A5
    const a5 = comentariosAutomaticos(state, conta.value.id).find((c) => c.includes("emitir sua nota"));
    expect(a5).toBeDefined();
    expect(a5).toContain("da empresa pagadora (Empresa não preenchida na conta)");
    expect(a5).not.toContain("da Empresa —");
  });

  it("com Empresa na conta e sem mapa de CNPJ: nomeia a Empresa, como antes", () => {
    const state = buildSeed();
    const conta = createTask(state, MARYANE, { listId: CP.listId, title: "Nota com Empresa", dueDate: { form: "civilDay", value: "2026-10-20" } });
    if (!conta.ok) throw new Error(conta.error);
    setTaskFieldValue(state, MARYANE, conta.value.id, CP.fields.centroDeCusto, "TRIA");
    setTaskFieldValue(state, MARYANE, conta.value.id, CP.fields.pessoa, MARYANE);
    setTaskFieldValue(state, MARYANE, conta.value.id, CP.fields.empresa, "Tria Company");
    runScheduledAutomations(state, MARYANE, CP.listId, dia("2026-10-20", -5));
    expect(comentariosAutomaticos(state, conta.value.id).find((c) => c.includes("emitir sua nota"))).toContain("da Empresa Tria Company");
  });
});
