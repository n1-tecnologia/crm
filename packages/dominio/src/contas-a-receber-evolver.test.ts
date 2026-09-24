/**
 * `evoluirConfiguracaoDeContasAReceber` — molde de
 * `solicitacao-de-pagamento-evolver.test.ts` (Plan 02-08): idempotência,
 * criação do que falta, divergência reportada e NUNCA sobrescrita, sobra
 * nunca removida. O estado de partida é `buildGestaoBootstrap()` — o mesmo
 * `DataState` de produção — para que qualquer mutação represente um desvio
 * real contra o que `ws_n1` tem hoje (05-CONFERENCIA-WS-N1.md, seção 1: zero
 * divergências).
 */

import { describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { evoluirConfiguracaoDeContasAReceber } from "./contas-a-receber-evolver";
import { CP, CR } from "./operations/financeiro";
import type { DataState } from "./state";

function estadoBase(): DataState {
  return buildGestaoBootstrap({ workspaceId: "ws_teste_cr_evolver" });
}

describe("evoluirConfiguracaoDeContasAReceber", () => {
  it("idempotência: duas chamadas seguidas sobre o estado já correto devolvem criados e divergentes vazios", () => {
    const state = estadoBase();
    const r1 = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r1.ok, r1.ok ? "" : r1.error).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    expect(r1.value.criados).toEqual([]);
    expect(r1.value.divergentes).toEqual([]);

    const r2 = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r2.ok, r2.ok ? "" : r2.error).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    expect(r2.value.criados).toEqual([]);
    expect(r2.value.divergentes).toEqual([]);
  });

  it("Status ausente no estado é criado, sem tocar nos demais — e a segunda volta já não o recria", () => {
    const state = estadoBase();
    const lista = state.lists.find((l) => l.id === CR.listId)!;
    lista.statusSet!.definitions = lista.statusSet!.definitions.filter((s) => s.id !== CR.status.pendente);
    expect(lista.statusSet!.definitions).toHaveLength(5);

    const r1 = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r1.ok, r1.ok ? "" : r1.error).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    expect(r1.value.criados).toContain(CR.status.pendente);
    expect(lista.statusSet!.definitions.some((s) => s.id === CR.status.pendente)).toBe(true);
    expect(lista.statusSet!.definitions).toHaveLength(6);

    const r2 = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r2.ok, r2.ok ? "" : r2.error).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    expect(r2.value.criados).toEqual([]);
  });

  it("D5-13 — Status com entryFromStatusIds adulterado vira divergência; o valor no estado permanece adulterado (nada sobrescrito)", () => {
    const state = estadoBase();
    const lista = state.lists.find((l) => l.id === CR.listId)!;
    const estornado = lista.statusSet!.definitions.find((s) => s.id === CR.status.estornado)!;
    // Correto: entryFromStatusIds: [CR.status.recebido]. Adulterado de propósito.
    estornado.entryFromStatusIds = [CR.status.paraReceber];

    const r = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("devia recusar por divergência");
    expect(r.error).toContain(CR.status.estornado);
    expect(r.error).toContain("entryFromStatusIds");

    // Nada foi sobrescrito — a adulteração continua lá.
    expect(estornado.entryFromStatusIds).toEqual([CR.status.paraReceber]);
  });

  it("Automação ausente é criada, com trigger/condições/ações idênticos ao catálogo", () => {
    const state = estadoBase();
    state.automations = state.automations.filter((a) => a.id !== "aut_cr_r4");
    expect(state.automations.some((a) => a.id === "aut_cr_r4")).toBe(false);

    const r = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.criados).toContain("aut_cr_r4");
    const criada = state.automations.find((a) => a.id === "aut_cr_r4");
    expect(criada).toBeDefined();
    expect(criada!.versions[0]!.trigger).toEqual({ kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: 30 }) });
  });

  it("nenhum Status é removido quando o estado tem um a mais que o catálogo — relatado como sobra", () => {
    const state = estadoBase();
    const lista = state.lists.find((l) => l.id === CR.listId)!;
    lista.statusSet!.definitions.push({ id: "st_cr_extra_teste", name: "extra fora do catálogo", color: "#000000", category: "concluido", order: 99 });

    const r = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("devia recusar por divergência");
    expect(r.error).toContain("st_cr_extra_teste");

    // Nunca removido — a sobra continua no Conjunto.
    expect(lista.statusSet!.definitions.some((s) => s.id === "st_cr_extra_teste")).toBe(true);
  });

  it("nenhuma Automação é removida quando o estado tem uma a mais, escopada à Lista — relatado como sobra", () => {
    const state = estadoBase();
    state.automations.push({
      id: "aut_cr_extra_teste",
      workspaceId: state.workspace.id,
      createdBy: { kind: "member", id: CP.financeiroId },
      createdAt: "2026-01-01T00:00:00.000Z",
      lifecycle: "ativo",
      name: "Automação fora do catálogo",
      description: "",
      scopeType: "list",
      scopeId: CR.listId,
      ownerMemberId: CP.financeiroId,
      reactsToAutomationEvents: false,
      versions: [{ number: 1, state: "publicada", conditions: [], actions: [], errorPolicy: { onActionFailure: "interromper", retries: 0 }, createdAt: "2026-01-01T00:00:00.000Z" }],
    });

    const r = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("devia recusar por divergência");
    expect(r.error).toContain("aut_cr_extra_teste");
    expect(state.automations.some((a) => a.id === "aut_cr_extra_teste")).toBe(true);
  });

  it("D5-14 — recebido exige Valor > 0, sem exceção por tipo (um único requisito universal, não um por Tipo de recebimento)", () => {
    const state = estadoBase();
    const lista = state.lists.find((l) => l.id === CR.listId)!;
    const recebido = lista.statusSet!.definitions.find((s) => s.id === CR.status.recebido)!;
    expect(recebido.entryRequirements).toEqual([{ definitionId: CP.fields.valor, positive: true }]);
  });

  it("recusa quando a Lista 'Contas a receber' ainda não existe no estado", () => {
    const state = estadoBase();
    state.lists = state.lists.filter((l) => l.id !== CR.listId);
    const r = evoluirConfiguracaoDeContasAReceber(state, CP.financeiroId);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("devia recusar");
    expect(r.error).toContain(CR.listId);
  });
});
