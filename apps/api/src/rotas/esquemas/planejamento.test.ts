/**
 * `esquemas/planejamento.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (tipo errado, chave desconhecida,
 * enum fora da lista); (2) as formas LITERAIS que `apps/web` manda hoje
 * continuam passando — a rede de regressão contra falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { PLANEJAMENTO } from "./planejamento";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/planejamento — a forma dos args de planning.ts", () => {
  it("(a) cobertura — as 11 chaves de planning.ts em registro.ts", () => {
    const esperadas = [
      "setMemberCapacity",
      "enableSprints",
      "disableSprints",
      "createNextSprint",
      "closeSprint",
      "saveListAsTemplate",
      "saveTaskAsTemplate",
      "instantiateTaskTemplate",
      "instantiateListTemplate",
      "renameTemplate",
      "setTemplateArchived",
    ].sort();
    expect(Object.keys(PLANEJAMENTO).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof PLANEJAMENTO, unknown[]]> = [
      ["setMemberCapacity", ["mem_1", 2400]],
      ["enableSprints", ["fld_1", 14]],
      ["disableSprints", ["fld_1"]],
      ["createNextSprint", ["fld_1"]],
      ["closeSprint", ["lst_1"]],
      ["saveListAsTemplate", ["lst_1", { name: "T" }]],
      ["saveListAsTemplate", ["lst_1", { name: "T", description: "d" }]],
      ["saveTaskAsTemplate", ["tsk_1", { name: "T" }]],
      ["saveTaskAsTemplate", ["tsk_1", { name: "T", description: "d" }]],
      ["instantiateTaskTemplate", ["tpl_1", "lst_1"]],
      ["instantiateTaskTemplate", ["tpl_1", "lst_1", "Título"]],
      ["instantiateListTemplate", ["tpl_1", { name: "L", parentType: "folder", parentId: "fld_1" }]],
      [
        "instantiateListTemplate",
        ["tpl_1", { name: "L", parentType: "space", parentId: "spc_1", description: "d", isPrivate: true }],
      ],
      // create-container-dialog.tsx, Lista a partir de modelo com configuração:
      // `modeloDeTarefa` sempre (C35), `canaisDeAtendimento` se conversacional (C36).
      [
        "instantiateListTemplate",
        ["tpl_1", { name: "L", parentType: "folder", parentId: "fld_1", isPrivate: false, modeloDeTarefa: "operacional" }],
      ],
      [
        "instantiateListTemplate",
        [
          "tpl_1",
          {
            name: "L",
            parentType: "space",
            parentId: "spc_1",
            isPrivate: false,
            modeloDeTarefa: "conversacional",
            canaisDeAtendimento: ["chn_1"],
          },
        ],
      ],
      ["renameTemplate", ["tpl_1", { name: "x" }]],
      ["setTemplateArchived", ["tpl_1", true]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(PLANEJAMENTO[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }

    const instantiate = PLANEJAMENTO.instantiateTaskTemplate.safeParse(viaJson(["tpl_1", "lst_1", undefined]));
    expect(instantiate.success).toBe(true);
    if (instantiate.success) expect(instantiate.data).toEqual(["tpl_1", "lst_1", undefined]);
  });

  it("(c) formas hostis caem", () => {
    expect(PLANEJAMENTO.setMemberCapacity.safeParse(viaJson(["mem_1", "2400"])).success).toBe(false);
    expect(
      PLANEJAMENTO.instantiateListTemplate.safeParse(
        viaJson(["tpl_1", { name: "L", parentType: "list", parentId: "lst_1" }]),
      ).success,
    ).toBe(false);
    expect(
      PLANEJAMENTO.instantiateListTemplate.safeParse(
        viaJson(["tpl_1", { name: "L", parentType: "folder", parentId: "fld_1", lixo: 1 }]),
      ).success,
    ).toBe(false);
    expect(
      PLANEJAMENTO.instantiateListTemplate.safeParse(
        viaJson(["tpl_1", { name: "L", parentType: "folder", parentId: "fld_1", modeloDeTarefa: "outro" }]),
      ).success,
    ).toBe(false);
    expect(PLANEJAMENTO.saveListAsTemplate.safeParse(viaJson(["lst_1", {}])).success).toBe(false);
    expect(PLANEJAMENTO.setTemplateArchived.safeParse(viaJson(["tpl_1", "sim"])).success).toBe(false);
  });
});
