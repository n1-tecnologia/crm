/**
 * `esquemas/captacao.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (`criterio` fora do catálogo, lista
 * de Grupos elegíveis que não é array de string, chave desconhecida); (2) as
 * formas LITERAIS que `apps/web` manda hoje continuam passando.
 */

import { describe, expect, it } from "vitest";
import { CAPTACAO } from "./captacao";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/captacao — a forma dos args de ferramentas/captacao.ts", () => {
  it("(a) cobertura — as 4 chaves de ferramentas/captacao.ts em registro.ts", () => {
    const esperadas = ["criarLinkDeCaptacao", "editarLinkDeCaptacao", "enviarLinkALixeira", "restaurarLinkDaLixeira"].sort();
    expect(Object.keys(CAPTACAO).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    expect(CAPTACAO.criarLinkDeCaptacao.safeParse(viaJson([{ nome: "L", gruposElegiveisIds: ["grp_1"] }])).success).toBe(true);
    expect(
      CAPTACAO.criarLinkDeCaptacao.safeParse(
        viaJson([{ nome: "L", slug: "lanc", gruposElegiveisIds: ["grp_1", "grp_2"], criterio: "porCliques", ativo: false }]),
      ).success,
    ).toBe(true);
    expect(CAPTACAO.editarLinkDeCaptacao.safeParse(viaJson(["lcp_1", {}])).success).toBe(true);
    expect(
      CAPTACAO.editarLinkDeCaptacao.safeParse(
        viaJson(["lcp_1", { nome: "L2", gruposElegiveisIds: ["grp_1"], criterio: "porOrdem", ativo: true }]),
      ).success,
    ).toBe(true);
    expect(CAPTACAO.enviarLinkALixeira.safeParse(viaJson(["lcp_1"])).success).toBe(true);
    expect(CAPTACAO.restaurarLinkDaLixeira.safeParse(viaJson(["lcp_1"])).success).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(CAPTACAO.criarLinkDeCaptacao.safeParse(viaJson([{ nome: "L", gruposElegiveisIds: "grp_1" }])).success).toBe(false);
    expect(CAPTACAO.criarLinkDeCaptacao.safeParse(viaJson([{ nome: "L", gruposElegiveisIds: ["grp_1"], criterio: "porData" }])).success).toBe(false);
    expect(CAPTACAO.criarLinkDeCaptacao.safeParse(viaJson([{ gruposElegiveisIds: ["grp_1"] }])).success).toBe(false);
    expect(CAPTACAO.criarLinkDeCaptacao.safeParse(viaJson([{ nome: "L", gruposElegiveisIds: ["grp_1"], lixo: 1 }])).success).toBe(false);
    expect(CAPTACAO.editarLinkDeCaptacao.safeParse(viaJson(["lcp_1", { ativo: "sim" }])).success).toBe(false);
    expect(CAPTACAO.enviarLinkALixeira.safeParse(viaJson([])).success).toBe(false);
  });
});
