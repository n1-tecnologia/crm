/**
 * `esquemas/ia-habilidades.ts` — testes puros, sem banco: só a FORMA dos
 * argumentos. (a) cobertura, (b) as formas LITERAIS de `apps/web` passam,
 * (c) formas hostis caem.
 */

import { describe, expect, it } from "vitest";
import { IA_HABILIDADES } from "./ia-habilidades";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/ia-habilidades — a forma dos args de ia/habilidades.ts", () => {
  it("(a) cobertura — as 13 chaves de ia/habilidades.ts em registro.ts", () => {
    const esperadas = [
      "criarHabilidade",
      "copiarHabilidadeDaPlataforma",
      "editarHabilidade",
      "criarRascunhoDaHabilidade",
      "editarRascunhoDaHabilidade",
      "descartarRascunhoDaHabilidade",
      "publicarVersaoDaHabilidade",
      "obsoletarVersaoDaHabilidade",
      "arquivarHabilidade",
      "restaurarHabilidade",
      "concederHabilidade",
      "fixarVersaoDaConcessao",
      "revogarHabilidade",
    ].sort();
    expect(Object.keys(IA_HABILIDADES).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const H = IA_HABILIDADES;
    // nova-habilidade-dialog.tsx
    expect(H.criarHabilidade.safeParse(viaJson([{ name: "H", description: "" }])).success).toBe(true);
    // copiar-da-plataforma-dialog.tsx — `numero` pode ser undefined
    expect(H.copiarHabilidadeDaPlataforma.safeParse(viaJson(["skl_1", 2])).success).toBe(true);
    expect(H.copiarHabilidadeDaPlataforma.safeParse(viaJson(["skl_1", undefined])).success).toBe(true);
    // habilidade-completa.tsx / secoes-catalogo.tsx
    expect(H.editarHabilidade.safeParse(viaJson(["skl_1", { name: "Novo" }])).success).toBe(true);
    expect(H.criarRascunhoDaHabilidade.safeParse(viaJson(["skl_1"])).success).toBe(true);
    expect(H.criarRascunhoDaHabilidade.safeParse(viaJson(["skl_1", undefined])).success).toBe(true);
    expect(H.criarRascunhoDaHabilidade.safeParse(viaJson(["skl_1", 1])).success).toBe(true);
    expect(H.descartarRascunhoDaHabilidade.safeParse(viaJson(["skl_1"])).success).toBe(true);
    expect(H.publicarVersaoDaHabilidade.safeParse(viaJson(["skl_1"])).success).toBe(true);
    expect(H.obsoletarVersaoDaHabilidade.safeParse(viaJson(["skl_1", 1])).success).toBe(true);
    expect(H.arquivarHabilidade.safeParse(viaJson(["skl_1"])).success).toBe(true);
    expect(H.restaurarHabilidade.safeParse(viaJson(["skl_1"])).success).toBe(true);
    expect(H.fixarVersaoDaConcessao.safeParse(viaJson(["sgr_1", null])).success).toBe(true);
    expect(H.fixarVersaoDaConcessao.safeParse(viaJson(["sgr_1", 2])).success).toBe(true);
    expect(H.revogarHabilidade.safeParse(viaJson(["sgr_1"])).success).toBe(true);
    // conceder-habilidade-dialog.tsx
    expect(H.concederHabilidade.safeParse(viaJson([{ agentId: "agt_1", skillId: "skl_1" }])).success).toBe(true);
    expect(H.concederHabilidade.safeParse(viaJson([{ agentId: "agt_1", skillId: "skl_1", pinnedVersion: 1 }])).success).toBe(
      true,
    );
    // rascunho-da-habilidade.tsx — o patch inteiro do formulário
    expect(
      H.editarRascunhoDaHabilidade.safeParse(
        viaJson([
          "skl_1",
          {
            instructions: "Faça X",
            inputContract: [{ name: "negocio", type: "referencia:deal", required: true, description: "Negócio" }],
            outputContract: { structured: [], text: true },
            toolRequirements: [{ toolId: "ler_negocio", mandatory: true }],
            dependencies: [{ skillId: "skl_2" }, { skillId: "skl_3", pinnedVersion: 1 }],
            recommendedCollectionIds: ["col_1"],
          },
        ]),
      ).success,
    ).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    const H = IA_HABILIDADES;
    expect(H.criarHabilidade.safeParse([{ description: "x" }]).success).toBe(false);
    expect(H.editarRascunhoDaHabilidade.safeParse(["skl_1", { state: "publicada" }]).success).toBe(false);
    expect(H.editarRascunhoDaHabilidade.safeParse(["skl_1", { inputContract: [{ name: "x" }] }]).success).toBe(false);
    expect(H.fixarVersaoDaConcessao.safeParse(["sgr_1"]).success).toBe(false);
  });
});
