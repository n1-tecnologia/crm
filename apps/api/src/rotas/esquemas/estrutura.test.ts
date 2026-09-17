/**
 * `esquemas/estrutura.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (`StatusSet` malformado, `category`
 * fora da lista, `parentType` fora da lista, chave desconhecida); (2) as
 * formas LITERAIS que `apps/web` manda hoje continuam passando.
 */

import { describe, expect, it } from "vitest";
import { ESTRUTURA } from "./estrutura";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/estrutura — a forma dos args de structure.ts", () => {
  it("(a) cobertura — as 3 chaves de structure.ts em registro.ts", () => {
    const esperadas = ["createSpace", "createFolder", "createList"].sort();
    expect(Object.keys(ESTRUTURA).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    // create-container-dialog.tsx
    expect(ESTRUTURA.createSpace.safeParse(viaJson([{ name: "E" }])).success).toBe(true);
    expect(
      ESTRUTURA.createSpace.safeParse(
        viaJson([
          { name: "E", description: "d", color: "#3b82f6", isPrivate: true, templateId: "tpl_1" },
        ]),
      ).success,
    ).toBe(true);
    expect(
      ESTRUTURA.createSpace.safeParse(
        viaJson([
          {
            name: "E",
            statusSet: {
              id: "sts_1",
              definitions: [
                { id: "st_1", name: "A fazer", color: "#000", category: "naoIniciado", order: 0 },
                {
                  id: "st_2",
                  name: "Feito",
                  color: "#fff",
                  category: "fechado",
                  order: 1,
                  exitRequirements: [{ definitionId: "fld_1", positive: true }],
                  entryAllowedMemberIds: ["mem_1"],
                  entryFromStatusIds: ["st_1"],
                },
              ],
            },
          },
        ]),
      ).success,
    ).toBe(true);
    expect(
      ESTRUTURA.createFolder.safeParse(viaJson([{ name: "P", parentType: "space", parentId: "spc_1" }])).success,
    ).toBe(true);
    expect(
      ESTRUTURA.createFolder.safeParse(
        viaJson([
          {
            name: "P",
            parentType: "folder",
            parentId: "fld_1",
            description: "d",
            isPrivate: true,
            templateId: "tpl_1",
          },
        ]),
      ).success,
    ).toBe(true);
    expect(
      ESTRUTURA.createList.safeParse(viaJson([{ name: "L", parentType: "space", parentId: "spc_1" }])).success,
    ).toBe(true);
    expect(
      ESTRUTURA.createList.safeParse(
        viaJson([
          {
            name: "L",
            parentType: "folder",
            parentId: "fld_1",
            description: "d",
            isPrivate: false,
            templateId: "tpl_1",
          },
        ]),
      ).success,
    ).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(
      ESTRUTURA.createSpace.safeParse(viaJson([{ name: "E", statusSet: { definitions: [] } }])).success,
    ).toBe(false);
    expect(
      ESTRUTURA.createSpace.safeParse(
        viaJson([
          {
            name: "E",
            statusSet: { id: "sts_1", definitions: [{ id: "st_1", name: "x", color: "#", category: "aberto", order: 0 }] },
          },
        ]),
      ).success,
    ).toBe(false);
    expect(
      ESTRUTURA.createSpace.safeParse(
        viaJson([
          {
            name: "E",
            statusSet: {
              id: "sts_1",
              definitions: [
                {
                  id: "st_1",
                  name: "x",
                  color: "#000",
                  category: "naoIniciado",
                  order: 0,
                  exitRequirements: [{ attribute: "cor" }],
                },
              ],
            },
          },
        ]),
      ).success,
    ).toBe(false);
    expect(
      ESTRUTURA.createSpace.safeParse(
        viaJson([
          {
            name: "E",
            statusSet: {
              id: "sts_1",
              definitions: [
                { id: "st_1", name: "x", color: "#000", category: "naoIniciado", order: 0, lixo: 1 },
              ],
            },
          },
        ]),
      ).success,
    ).toBe(false);
    expect(
      ESTRUTURA.createFolder.safeParse(viaJson([{ name: "P", parentType: "list", parentId: "lst_1" }])).success,
    ).toBe(false);
    expect(ESTRUTURA.createList.safeParse(viaJson([{ name: "L" }])).success).toBe(false);
  });
});
