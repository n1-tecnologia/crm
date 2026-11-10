/**
 * `alvosDosClientes` (Fase 15, 3.4.10): o cliente de cada conta vira um alvo de `POST /crm/nomes`,
 * sem repetir; conta sem Vínculo de cliente não entra.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CR } from "@n1/dominio/operations/financeiro";
import { alvosDosClientes } from "./use-nomes-dos-clientes";

describe("alvosDosClientes", () => {
  it("junta o cliente das contas sem repetir, com o tipo do Vínculo", () => {
    const state = buildSeed();
    const contas = state.tasks.filter((t) => t.listId === CR.listId);
    const alvos = alvosDosClientes(state, contas);
    expect(alvos.length).toBeGreaterThan(0);
    expect(new Set(alvos.map((a) => `${a.tipo}:${a.id}`)).size).toBe(alvos.length);
    expect(alvos).toContainEqual({ tipo: "contact", id: "cnt_cr_helena" });
    // Duas contas da mesma cliente contam um alvo só.
    expect(alvos.filter((a) => a.id === "cnt_cr_helena")).toHaveLength(1);
  });

  it("conta sem Vínculo de cliente não vira alvo, e lista vazia não pede nada", () => {
    const state = buildSeed();
    const solta = state.tasks.find((t) => t.listId === CR.listId && !state.links.some((l) => l.fromId === t.id));
    expect(alvosDosClientes(state, solta ? [solta] : [])).toEqual([]);
    expect(alvosDosClientes(state, [])).toEqual([]);
  });
});
