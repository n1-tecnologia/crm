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
  it("(a) cobertura — as 10 chaves de structure.ts em registro.ts", () => {
    const esperadas = [
      "createSpace",
      "createFolder",
      "createList",
      "updateContainer",
      "moveContainer",
      "reorderContainers",
      "archiveContainer",
      "unarchiveContainer",
      "trashContainer",
      "restoreContainer",
    ].sort();
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
    // create-container-dialog.tsx manda `modeloDeTarefa` SEMPRE (C35) — em
    // branco e a partir de modelo — e `canaisDeAtendimento` quando
    // conversacional (C36). Era o 400 de "Criar Lista" (bug FUND-05).
    expect(
      ESTRUTURA.createList.safeParse(
        viaJson([{ name: "L", parentType: "space", parentId: "spc_1", isPrivate: false, modeloDeTarefa: "operacional" }]),
      ).success,
    ).toBe(true);
    expect(
      ESTRUTURA.createList.safeParse(
        viaJson([
          {
            name: "L",
            parentType: "folder",
            parentId: "fld_1",
            isPrivate: false,
            templateId: "tpl_1",
            modeloDeTarefa: "operacional",
          },
        ]),
      ).success,
    ).toBe(true);
    expect(
      ESTRUTURA.createList.safeParse(
        viaJson([
          {
            name: "L",
            parentType: "space",
            parentId: "spc_1",
            isPrivate: false,
            modeloDeTarefa: "conversacional",
            canaisDeAtendimento: ["chn_1", "chn_2"],
          },
        ]),
      ).success,
    ).toBe(true);
    // container-settings.tsx (POSC-09): identidade parcial e as quatro de estado.
    expect(ESTRUTURA.updateContainer.safeParse(viaJson(["list", "lst_1", { name: "Novo nome" }])).success).toBe(true);
    expect(
      ESTRUTURA.updateContainer.safeParse(
        viaJson(["space", "spc_1", { name: "E", description: "", color: "#0369a1", isPrivate: true }]),
      ).success,
    ).toBe(true);
    // Fase 10, 10-03 (D-11): mover Lista ou Pasta, com mapeamento só quando o Conjunto muda.
    expect(ESTRUTURA.moveContainer.safeParse(viaJson(["list", "lst_1", { parentType: "folder", parentId: "fld_2" }])).success).toBe(true);
    expect(
      ESTRUTURA.moveContainer.safeParse(
        viaJson(["folder", "fld_1", { parentType: "space", parentId: "spc_1" }, [{ fromStatusId: "a", toStatusId: "b" }]]),
      ).success,
    ).toBe(true);
    // Fase 10, 10-04 (D-08, D-09): reordenar um grupo de irmãos; Espaços têm pai `null`.
    expect(ESTRUTURA.reorderContainers.safeParse(viaJson(["list", { type: "folder", id: "fld_1" }, ["lst_2", "lst_1"]])).success).toBe(true);
    expect(ESTRUTURA.reorderContainers.safeParse(viaJson(["space", null, ["spc_2", "spc_1"]])).success).toBe(true);
    for (const nome of ["archiveContainer", "unarchiveContainer", "trashContainer", "restoreContainer"] as const) {
      expect(ESTRUTURA[nome].safeParse(viaJson(["folder", "fld_1"])).success, nome).toBe(true);
    }
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
    expect(
      ESTRUTURA.createList.safeParse(
        viaJson([{ name: "L", parentType: "space", parentId: "spc_1", modeloDeTarefa: "outro" }]),
      ).success,
    ).toBe(false);
    expect(
      ESTRUTURA.createList.safeParse(
        viaJson([{ name: "L", parentType: "space", parentId: "spc_1", canaisDeAtendimento: "chn_1" }]),
      ).success,
    ).toBe(false);
    expect(ESTRUTURA.updateContainer.safeParse(viaJson(["task", "t_1", { name: "x" }])).success).toBe(false);
    expect(ESTRUTURA.updateContainer.safeParse(viaJson(["list", "lst_1", { nome: "x" }])).success).toBe(false);
    expect(ESTRUTURA.archiveContainer.safeParse(viaJson(["list"])).success).toBe(false);
    expect(ESTRUTURA.trashContainer.safeParse(viaJson(["list", "lst_1", "extra"])).success).toBe(false);
    // moveContainer: o Espaço é a raiz e não se move; o destino não aceita chave extra.
    expect(ESTRUTURA.moveContainer.safeParse(viaJson(["space", "spc_1", { parentType: "space", parentId: "spc_2" }])).success).toBe(false);
    expect(
      ESTRUTURA.moveContainer.safeParse(viaJson(["list", "lst_1", { parentType: "folder", parentId: "fld_2", lixo: 1 }])).success,
    ).toBe(false);
    expect(ESTRUTURA.moveContainer.safeParse(viaJson(["list", "lst_1", { parentType: "list", parentId: "lst_2" }])).success).toBe(false);
    expect(
      ESTRUTURA.moveContainer.safeParse(
        viaJson(["list", "lst_1", { parentType: "folder", parentId: "fld_2" }, [{ fromStatusId: "a" }]]),
      ).success,
    ).toBe(false);
    // reorderContainers: pai de outro tipo, chave extra, ids que não são texto e pai ausente caem; vazio passa (o domínio recusa).
    expect(ESTRUTURA.reorderContainers.safeParse(viaJson(["list", { type: "list", id: "lst_1" }, ["lst_2"]])).success).toBe(false);
    expect(ESTRUTURA.reorderContainers.safeParse(viaJson(["list", { type: "folder", id: "fld_1", lixo: 1 }, ["lst_2"]])).success).toBe(false);
    expect(ESTRUTURA.reorderContainers.safeParse(viaJson(["list", { type: "folder", id: "fld_1" }, [1, 2]])).success).toBe(false);
    expect(ESTRUTURA.reorderContainers.safeParse(viaJson(["task", null, ["x"]])).success).toBe(false);
    expect(ESTRUTURA.reorderContainers.safeParse(viaJson(["list", { type: "folder", id: "fld_1" }])).success).toBe(false);
    expect(ESTRUTURA.reorderContainers.safeParse(viaJson(["list", { type: "folder", id: "fld_1" }, []])).success).toBe(true);
    // A Pasta não conhece o modelo de Tarefa.
    expect(
      ESTRUTURA.createFolder.safeParse(
        viaJson([{ name: "P", parentType: "space", parentId: "spc_1", modeloDeTarefa: "operacional" }]),
      ).success,
    ).toBe(false);
  });
});
