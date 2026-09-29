/**
 * A Atividade de Responsável é lida por gente: atribuir e remover gravam o
 * NOME, nunca o id. Achado da jornada de 2026-09-29 — a A3 ("Responsável vira
 * o Aprovador") deixava "Responsável atribuído (— → mem_marcos_paulo)".
 */
import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { CP } from "./financeiro";
import { assignTask, unassignTask } from "./tasks";

describe("Atividade de Responsável — nome, não id", () => {
  it("atribuir e remover um Membro gravam o nome dele", () => {
    const state = buildSeed();
    const conta = state.tasks.find((t) => t.listId === CP.listId && !t.assignees.some((a) => a.id === CP.aprovadorId));
    if (!conta) throw new Error("seed sem conta a pagar sem o Aprovador");
    const nome = state.members.find((m) => m.id === CP.aprovadorId)?.displayName;
    expect(nome).toBeTruthy();
    const aprovador = { kind: "member" as const, id: CP.aprovadorId };

    expect(assignTask(state, CP.financeiroId, conta.id, aprovador).ok).toBe(true);
    const atribuido = state.activity.find((a) => a.objectId === conta.id && a.action === "Responsável atribuído");
    expect(atribuido?.after).toBe(nome);

    expect(unassignTask(state, CP.financeiroId, conta.id, aprovador).ok).toBe(true);
    const removido = state.activity.find((a) => a.objectId === conta.id && a.action === "Responsável removido");
    expect(removido?.before).toBe(nome);
  });
});
