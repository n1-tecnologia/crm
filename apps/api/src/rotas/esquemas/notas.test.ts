/**
 * `esquemas/notas.ts` — testes puros, sem banco, sem `buildApp`: só a FORMA
 * dos argumentos, nunca regra de negócio. Provam duas coisas: (1) a forma
 * hostil que motivou CR-02 (Tipo de Ativo fora do catálogo, chave
 * desconhecida) cai; (2) a forma LITERAL que `apps/web` manda continua
 * passando.
 */

import { describe, expect, it } from "vitest";
import { NOTAS } from "./notas";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/notas — a forma dos args de ferramentas/notas.ts", () => {
  it("(a) cobertura — a 1 chave de ferramentas/notas.ts em registro.ts", () => {
    expect(Object.keys(NOTAS).sort()).toEqual(["adicionarNotaNoAtivo"]);
  });

  it("(b) formas literais passam, para cada Tipo de Ativo", () => {
    expect(NOTAS.adicionarNotaNoAtivo.safeParse(viaJson(["grupo", "grp_1", "nota"])).success).toBe(true);
    expect(NOTAS.adicionarNotaNoAtivo.safeParse(viaJson(["comunidade", "com_1", "nota"])).success).toBe(true);
    expect(NOTAS.adicionarNotaNoAtivo.safeParse(viaJson(["flow", "flw_1", "nota"])).success).toBe(true);
    expect(NOTAS.adicionarNotaNoAtivo.safeParse(viaJson(["linkDeCaptacao", "lcp_1", "nota"])).success).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(NOTAS.adicionarNotaNoAtivo.safeParse(viaJson(["contato", "cnt_1", "nota"])).success).toBe(false);
    expect(NOTAS.adicionarNotaNoAtivo.safeParse(viaJson(["grupo", "grp_1"])).success).toBe(false);
    expect(NOTAS.adicionarNotaNoAtivo.safeParse(viaJson(["grupo", "grp_1", "nota", "extra"])).success).toBe(false);
    expect(NOTAS.adicionarNotaNoAtivo.safeParse(viaJson(["grupo", "grp_1", 123])).success).toBe(false);
  });
});
