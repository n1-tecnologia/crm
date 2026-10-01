/**
 * `esquemas/configuracao.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (`type` de Campo fora da lista,
 * `definedAtType` fora da lista, `category` fora da lista, funcionalidade
 * desconhecida); (2) as formas LITERAIS que `apps/web` manda hoje continuam
 * passando.
 */

import { describe, expect, it } from "vitest";
import { CONFIGURACAO } from "./configuracao";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/configuracao — a forma dos args de configuration.ts", () => {
  it("(a) cobertura — as 14 chaves de configuration.ts em registro.ts", () => {
    const esperadas = [
      "createFieldDefinition",
      "updateFieldDefinition",
      "archiveFieldDefinition",
      "restoreFieldDefinition",
      "addStatus",
      "updateStatus",
      "reorderStatuses",
      "removeStatus",
      "overrideStatusSet",
      "inheritStatusSet",
      "createTaskType",
      "updateTaskType",
      "removeTaskType",
      "setContainerFeature",
      "usarCampoHerdado",
    ].sort();
    expect(Object.keys(CONFIGURACAO).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof CONFIGURACAO, unknown[]]> = [
      ["createFieldDefinition", [{ name: "N", type: "text", definedAtType: "list", definedAtId: "l1" }]],
      [
        "createFieldDefinition",
        [
          {
            name: "N",
            type: "singleSelect",
            options: ["a", "b"],
            required: true,
            description: "d",
            definedAtType: "list",
            definedAtId: "l1",
          },
        ],
      ],
      ["updateFieldDefinition", ["fd1", {}]],
      ["updateFieldDefinition", ["fd1", { name: "x", options: ["a"] }]],
      ["archiveFieldDefinition", ["fd1"]],
      ["restoreFieldDefinition", ["fd1"]],
      ["addStatus", ["list", "l1", { name: "Novo", color: "#000", category: "naoIniciado" }]],
      ["updateStatus", ["folder", "f1", "st1", { color: "#fff" }]],
      // Plano pós-auditoria, 2.1 — a forma que `contas-a-pagar:configurar` usa.
      [
        "updateStatus",
        [
          "list",
          "l1",
          "st1",
          {
            exitRequirements: [
              { definitionId: "fd1" },
              { attribute: "dueDate" },
              { definitionId: "fd2", whenDefinitionId: "fd3", whenValue: "CPF" },
              { definitionId: "fd4", positive: true, label: "Valor" },
            ],
          },
        ],
      ],
      ["updateStatus", ["list", "l1", "st1", { exitRequirements: [] }]],
      // "Quem pode mover para cá": `[]` abre para qualquer pessoa.
      ["updateStatus", ["list", "l1", "st1", { entryAllowedMemberIds: [] }]],
      ["updateStatus", ["list", "l1", "st1", { entryAllowedMemberIds: ["mem_1", "mem_2"] }]],
      ["reorderStatuses", ["space", "s1", ["st1", "st2"]]],
      ["removeStatus", ["list", "l1", "st1"]],
      ["removeStatus", ["list", "l1", "st1", "st2"]],
      ["overrideStatusSet", ["folder", "f1"]],
      ["inheritStatusSet", ["folder", "f1"]],
      ["createTaskType", [{ name: "T", icon: "i", definedAtType: "space", definedAtId: "s1" }]],
      ["updateTaskType", ["tt1", { name: "x" }]],
      ["removeTaskType", ["tt1"]],
      ["setContainerFeature", ["list", "l1", "prioridade", true]],
      ["setContainerFeature", ["list", "l1", "checklists", null]],
      ["usarCampoHerdado", ["list", "l1", "fd_1", false]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(CONFIGURACAO[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }
  });

  it("(c) formas hostis caem", () => {
    expect(
      CONFIGURACAO.createFieldDefinition.safeParse(
        viaJson([{ name: "N", type: "cor", definedAtType: "list", definedAtId: "l1" }]),
      ).success,
    ).toBe(false);
    expect(
      CONFIGURACAO.createFieldDefinition.safeParse(
        viaJson([{ name: "N", type: "text", definedAtType: "workspace", definedAtId: "l1" }]),
      ).success,
    ).toBe(false);
    expect(
      CONFIGURACAO.createFieldDefinition.safeParse(
        viaJson([{ name: "N", type: "singleSelect", options: "a", definedAtType: "list", definedAtId: "l1" }]),
      ).success,
    ).toBe(false);
    expect(
      CONFIGURACAO.createFieldDefinition.safeParse(
        viaJson([{ name: "N", type: "text", definedAtType: "list", definedAtId: "l1", lixo: 1 }]),
      ).success,
    ).toBe(false);
    expect(
      CONFIGURACAO.addStatus.safeParse(
        viaJson(["list", "l1", { name: "Novo", color: "#000", category: "aberto" }]),
      ).success,
    ).toBe(false);
    // só folder/list.
    expect(CONFIGURACAO.overrideStatusSet.safeParse(viaJson(["space", "s1"])).success).toBe(false);
    expect(CONFIGURACAO.setContainerFeature.safeParse(viaJson(["list", "l1", "voar", true])).success).toBe(
      false,
    );
    expect(
      CONFIGURACAO.setContainerFeature.safeParse(viaJson(["list", "l1", "prioridade", "sim"])).success,
    ).toBe(false);
    expect(CONFIGURACAO.reorderStatuses.safeParse(viaJson(["list", "l1", "a"])).success).toBe(false);
    // Requisito de Status: atributo fora da lista e chave desconhecida caem.
    expect(
      CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { exitRequirements: [{ attribute: "prazo" }] }])).success,
    ).toBe(false);
    expect(
      CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { exitRequirements: [{ definitionId: "fd1", lixo: 1 }] }])).success,
    ).toBe(false);
    expect(CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { exitRequirements: "fd1" }])).success).toBe(false);
    expect(CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { entryAllowedMemberIds: "mem_1" }])).success).toBe(false);
    expect(CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { entryAllowedMemberIds: [1] }])).success).toBe(false);
  });
});
