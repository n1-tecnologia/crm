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
      "setContainerDefaultViews",
      "setContainerBlock",
      "usarCampoHerdado",
      "createTag",
      "updateTag",
      "archiveTag",
      "restoreTag",
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
      // requisitos-do-status-dialog.tsx (RELO-04): os dois lados e o "só vindo de", juntos.
      [
        "updateStatus",
        [
          "list",
          "l1",
          "st1",
          {
            exitRequirements: [{ definitionId: "fd1", positive: true }, { attribute: "dueDate" }],
            entryRequirements: [{ definitionId: "fd2", whenDefinitionId: "fd3", whenValue: "Boleto" }],
            entryFromStatusIds: ["st0"],
          },
        ],
      ],
      ["updateStatus", ["list", "l1", "st1", { entryRequirements: [], entryFromStatusIds: [] }]],
      // configuracoes/tags/page.tsx (AVIS-02)
      ["createTag", [{ name: "Urgente", color: "#be123c", appliesTo: ["task", "deal"] }]],
      ["createTag", [{ name: "Geral", color: "#0369a1" }]],
      ["updateTag", ["tag_1", { name: "Novo nome" }]],
      ["updateTag", ["tag_1", { appliesTo: [] }]],
      ["archiveTag", ["tag_1"]],
      ["restoreTag", ["tag_1"]],
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
      // Fase 10, D-07 — as formas que a web vai mandar; `null` = herdar.
      ["setContainerDefaultViews", ["space", "spc_1", { disponiveis: ["lista", "quadro"], inicial: "quadro" }]],
      ["setContainerDefaultViews", ["folder", "fld_1", null]],
      // Fase 10, D-16 — bloquear e desbloquear um aspecto no Espaço e na Pasta.
      ["setContainerBlock", ["space", "spc_1", "statusSet", true]],
      ["setContainerBlock", ["folder", "fld_1", "fieldDefinitions", false]],
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
    // Visualizações padrão: chave extra, tipo desconhecido e `undefined` no lugar de `null` caem.
    expect(
      CONFIGURACAO.setContainerDefaultViews.safeParse(viaJson(["space", "spc_1", { disponiveis: ["lista"], inicial: "lista", extra: 1 }])).success,
    ).toBe(false);
    expect(
      CONFIGURACAO.setContainerDefaultViews.safeParse(viaJson(["space", "spc_1", { disponiveis: ["mapa"], inicial: "mapa" }])).success,
    ).toBe(false);
    expect(CONFIGURACAO.setContainerDefaultViews.safeParse(viaJson(["space", "spc_1"])).success).toBe(false);
    // Bloqueio: a Lista não bloqueia (D-15), aspecto desconhecido e booleano ausente caem.
    expect(CONFIGURACAO.setContainerBlock.safeParse(viaJson(["list", "lst_1", "statusSet", true])).success).toBe(false);
    expect(CONFIGURACAO.setContainerBlock.safeParse(viaJson(["space", "spc_1", "cor", true])).success).toBe(false);
    expect(CONFIGURACAO.setContainerBlock.safeParse(viaJson(["space", "spc_1", "statusSet"])).success).toBe(false);
    // Requisito de Status: atributo fora da lista e chave desconhecida caem.
    expect(
      CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { exitRequirements: [{ attribute: "prazo" }] }])).success,
    ).toBe(false);
    expect(
      CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { exitRequirements: [{ definitionId: "fd1", lixo: 1 }] }])).success,
    ).toBe(false);
    expect(CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { exitRequirements: "fd1" }])).success).toBe(false);
    expect(CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { entryAllowedMemberIds: "mem_1" }])).success).toBe(false);
    expect(CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { entryRequirements: [{ attribute: "cor" }] }])).success).toBe(false);
    expect(CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { entryFromStatusIds: "st0" }])).success).toBe(false);
    expect(CONFIGURACAO.createTag.safeParse(viaJson([{ name: "x", appliesTo: ["pessoa"] }])).success).toBe(false);
    expect(CONFIGURACAO.createTag.safeParse(viaJson([{ nome: "x" }])).success).toBe(false);
    expect(CONFIGURACAO.archiveTag.safeParse(viaJson([])).success).toBe(false);
    expect(CONFIGURACAO.updateStatus.safeParse(viaJson(["list", "l1", "st1", { entryAllowedMemberIds: [1] }])).success).toBe(false);
  });
});
