/**
 * `esquemas/ia-agentes.ts` — testes puros, sem banco: só a FORMA dos
 * argumentos. (a) cobertura, (b) as formas LITERAIS de `apps/web` passam,
 * (c) formas hostis caem.
 */

import { describe, expect, it } from "vitest";
import { IA_AGENTES } from "./ia-agentes";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/ia-agentes — a forma dos args de ia/agentes.ts", () => {
  it("(a) cobertura — as 8 chaves de ia/agentes.ts em registro.ts", () => {
    const esperadas = [
      "ativarAgente",
      "pausarAgente",
      "arquivarAgente",
      "enviarAgenteALixeira",
      "transferirAgente",
      "ensaiarAgente",
      "cancelarExecucao",
      "apagarItemDeMemoria",
    ].sort();
    expect(Object.keys(IA_AGENTES).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    // agente-completo.tsx / secoes-catalogo.tsx
    expect(IA_AGENTES.ativarAgente.safeParse(viaJson(["agt_1"])).success).toBe(true);
    expect(IA_AGENTES.pausarAgente.safeParse(viaJson(["agt_1"])).success).toBe(true);
    expect(IA_AGENTES.arquivarAgente.safeParse(viaJson(["agt_1"])).success).toBe(true);
    expect(IA_AGENTES.enviarAgenteALixeira.safeParse(viaJson(["agt_1"])).success).toBe(true);
    expect(IA_AGENTES.apagarItemDeMemoria.safeParse(viaJson(["agt_1", "mem_1"])).success).toBe(true);
    // `cancelarExecucao(data, me, execution.id)` — sem motivo
    expect(IA_AGENTES.cancelarExecucao.safeParse(viaJson(["exe_1"])).success).toBe(true);
    const comNull = IA_AGENTES.cancelarExecucao.safeParse(viaJson(["exe_1", undefined]));
    expect(comNull.success).toBe(true);
    if (comNull.success) expect(comNull.data).toEqual(["exe_1", undefined]);
    // transferir-agente-dialog.tsx
    expect(IA_AGENTES.transferirAgente.safeParse(viaJson(["agt_1", "m2"])).success).toBe(true);
    // ensaiar-dialog.tsx
    expect(IA_AGENTES.ensaiarAgente.safeParse(viaJson(["agt_1", { texto: "oi" }])).success).toBe(true);
    expect(
      IA_AGENTES.ensaiarAgente.safeParse(viaJson(["agt_1", { texto: "oi", anchor: { type: "task", id: "tsk_1" } }])).success,
    ).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(IA_AGENTES.ensaiarAgente.safeParse(["agt_1", { text: "oi" }]).success).toBe(false);
    expect(IA_AGENTES.ensaiarAgente.safeParse(["agt_1", { texto: "oi", anchor: { type: "task" } }]).success).toBe(false);
    expect(IA_AGENTES.transferirAgente.safeParse(["agt_1"]).success).toBe(false);
    expect(IA_AGENTES.cancelarExecucao.safeParse(["exe_1", 3]).success).toBe(false);
  });
});
