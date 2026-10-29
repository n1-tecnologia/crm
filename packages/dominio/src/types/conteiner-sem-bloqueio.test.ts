/**
 * Fase 10, EST-09 (D-15, 2.6.3) — a prova é de TIPO: `tsc --noEmit` falha com
 * "Unused directive" se o tipo voltar a aceitar `blocks`
 * numa Lista. O `it` de tempo de execução só existe para o vitest achar o
 * arquivo e para provar o efeito: um `blocks` legado numa Lista não bloqueia.
 */

import { describe, expect, it } from "vitest";
import { blockedAbove } from "../operations/configuration";
import { buildSeed } from "../seed";
import type { InheritanceMode, List } from "./structure";

describe("EST-09 — a Lista não tem `blocks`", () => {
  it("um literal de Lista com `blocks` não compila, e `blockedAbove` segue lendo só Espaço e Pasta", () => {
    const state = buildSeed();
    const lista = state.lists.find((l) => l.id === "lst_prospeccao"); // direto no Espaço spc_com
    expect(lista).toBeDefined();
    if (!lista) return;

    const comBloqueio: List = {
      ...lista,
      // @ts-expect-error D-15 — a Lista nunca é bloqueada: `blocks` só existe em Espaço e Pasta.
      blocks: {},
    };
    expect(comBloqueio.id).toBe(lista.id);

    // Um Espaço que bloqueia continua recusando a definição numa Lista abaixo dele.
    const espaco = state.spaces.find((s) => s.id === lista.parentId);
    expect(espaco).toBeDefined();
    if (!espaco) return;
    espaco.blocks = { fieldDefinitions: true };
    expect(blockedAbove(state, "list", lista.id, "fieldDefinitions")).toContain("bloqueia");

    // Um `blocks` legado na própria Lista (jsonb antigo) não influencia nenhum nó.
    espaco.blocks = {};
    Object.assign(lista, { blocks: { fieldDefinitions: true } });
    expect(blockedAbove(state, "list", lista.id, "fieldDefinitions")).toBeUndefined();
  });

  it("o modo de bloqueio não existe em InheritanceMode: o bloqueio mora só em `blocks` (2.6.4)", () => {
    const validos: InheritanceMode[] = ["herdado", "sobrescrito"];
    // @ts-expect-error 2.6.4 — um contêiner sobrescreve e bloqueia ao mesmo tempo; "bloqueado" não é modo.
    const removido: InheritanceMode = "bloqueado";
    expect(validos).not.toContain(removido);
  });
});
