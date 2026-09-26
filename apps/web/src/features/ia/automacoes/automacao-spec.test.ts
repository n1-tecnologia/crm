/**
 * A spec do editor de Automação: as Ferramentas legadas com equivalente
 * executável (D5) — saem do seletor de nova Ação, ficam no Catálogo e a Ação
 * que já as usa continua descrita, marcada como legada.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { FERRAMENTAS_QUE_EXECUTAM } from "@n1/dominio/operations";
import { FERRAMENTAS_DEPRECIADAS, ferramentaDepreciada, specDaAcao } from "./automacao-spec";

describe("Ferramentas legadas do seletor de Ação", () => {
  const state = buildSeed();

  it("cada legada continua no Catálogo e aponta para uma equivalente que o motor executa, também do Catálogo", () => {
    expect(FERRAMENTAS_DEPRECIADAS.size).toBeGreaterThan(0);
    for (const [legada, equivalente] of FERRAMENTAS_DEPRECIADAS) {
      expect(state.tools.some((t) => t.id === legada), legada).toBe(true);
      expect(FERRAMENTAS_QUE_EXECUTAM.has(equivalente), equivalente).toBe(true);
      expect(state.tools.some((t) => t.id === equivalente), equivalente).toBe(true);
      expect(ferramentaDepreciada(legada)).toBe(true);
      expect(ferramentaDepreciada(equivalente)).toBe(false);
    }
  });

  it("a spec de uma Ação legada nomeia a equivalente (a pílula “legado”); a executável não", () => {
    const legada = specDaAcao(state, { kind: "escrita", toolId: "alterar_status" });
    expect(legada.legadoDe).toBe("Alterar Status da Tarefa");
    expect(legada.descricao).toContain("Alterar Status da Tarefa");
    const executavel = specDaAcao(state, { kind: "escrita", toolId: "tarefa.alterarStatus" });
    expect(executavel.legadoDe).toBeUndefined();
    const foraDoCatalogo = specDaAcao(state, { kind: "escrita", toolId: "inexistente" });
    expect(foraDoCatalogo.legadoDe).toBeUndefined();
  });
});
