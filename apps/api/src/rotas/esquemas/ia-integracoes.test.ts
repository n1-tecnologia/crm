/**
 * `esquemas/ia-integracoes.ts` — testes puros, sem banco: só a FORMA dos
 * argumentos.
 */

import { describe, expect, it } from "vitest";
import { IA_INTEGRACOES } from "./ia-integracoes";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/ia-integracoes — a forma dos args de ia/integracoes.ts", () => {
  it("(a) cobertura — as 2 chaves de ia/integracoes.ts em registro.ts", () => {
    expect(Object.keys(IA_INTEGRACOES).sort()).toEqual(["conectarIntegracao", "desconectarIntegracao"]);
  });

  it("(b) formas literais do web passam — integracao-menu.tsx", () => {
    expect(IA_INTEGRACOES.conectarIntegracao.safeParse(viaJson(["int_1"])).success).toBe(true);
    expect(IA_INTEGRACOES.desconectarIntegracao.safeParse(viaJson(["int_1"])).success).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(IA_INTEGRACOES.conectarIntegracao.safeParse([{ id: "int_1" }]).success).toBe(false);
    expect(IA_INTEGRACOES.conectarIntegracao.safeParse(["int_1", "extra"]).success).toBe(false);
  });
});
