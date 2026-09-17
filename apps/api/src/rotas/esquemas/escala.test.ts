/**
 * `esquemas/escala.ts` — testes puros, sem banco, sem `buildApp`: só a FORMA
 * dos argumentos, nunca regra de negócio. Provam três coisas: (1) as DUAS
 * formas que o verificador reproduziu contra `ARGUMENTOS_GENERICOS`
 * (`01-VERIFICATION.md`) caem — `createGoal` com `kind: 42` e `saveView` com
 * `filters` arbitrário; (2) outras formas hostis caem; (3) as formas
 * LITERAIS que `apps/web` manda hoje continuam passando — a rede de
 * regressão contra falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { ESCALA } from "./escala";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/escala — a forma dos args de scale.ts", () => {
  it("(a) cobertura — as 14 chaves de scale.ts em registro.ts", () => {
    const esperadas = [
      "saveView",
      "deleteView",
      "setDefaultView",
      "createGoal",
      "updateGoal",
      "archiveGoal",
      "setGoalArchived",
      "linkTaskToGoal",
      "createForm",
      "updateForm",
      "archiveForm",
      "rotateFormSecret",
      "shareTaskPublicly",
      "revokePublicShare",
    ].sort();
    expect(Object.keys(ESCALA).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    // view-bar.tsx
    expect(
      ESCALA.saveView.safeParse(
        viaJson([{ listId: "lst_1", name: "V", kind: "lista", filters: {}, shared: false }]),
      ).success,
    ).toBe(true);
    expect(
      ESCALA.saveView.safeParse(
        viaJson([
          {
            listId: "lst_1",
            name: "V",
            kind: "lista",
            filters: { statusCategory: "emAndamento", priority: "alta", text: "urgente", overdue: true },
            shared: false,
          },
        ]),
      ).success,
    ).toBe(true);
    expect(
      ESCALA.saveView.safeParse(
        viaJson([
          {
            listId: "lst_1",
            name: "V compartilhada",
            kind: "quadro",
            filters: {},
            shared: true,
            sortBy: { by: "priority", direction: "asc" },
          },
        ]),
      ).success,
    ).toBe(true);
    expect(ESCALA.deleteView.safeParse(viaJson(["viw_1"])).success).toBe(true);
    expect(ESCALA.setDefaultView.safeParse(viaJson(["viw_1", true])).success).toBe(true);

    // metas/page.tsx
    expect(
      ESCALA.createGoal.safeParse(
        viaJson([{ name: "M", anchor: { type: "list", id: "lst_1" }, kind: "tarefasConcluidas", target: 10 }]),
      ).success,
    ).toBe(true);
    expect(
      ESCALA.createGoal.safeParse(
        viaJson([
          {
            name: "M",
            description: "d",
            anchor: { type: "space", id: "spc_1" },
            kind: "metrica",
            target: 5,
            unit: "un",
            measure: {
              target: "task",
              scopeType: "list",
              scopeIds: ["lst_1"],
              aggregation: "contagem",
              attribute: "id",
            },
            dueDate: "2026-12-31",
          },
        ]),
      ).success,
    ).toBe(true);
    expect(ESCALA.updateGoal.safeParse(viaJson(["gol_1", {}])).success).toBe(true);
    expect(ESCALA.updateGoal.safeParse(viaJson(["gol_1", { target: 20 }])).success).toBe(true);
    expect(ESCALA.archiveGoal.safeParse(viaJson(["gol_1"])).success).toBe(true);
    expect(ESCALA.setGoalArchived.safeParse(viaJson(["gol_1", false])).success).toBe(true);
    expect(ESCALA.linkTaskToGoal.safeParse(viaJson(["gol_1", "tsk_1", true])).success).toBe(true);

    // forms-editor.tsx
    expect(
      ESCALA.createForm.safeParse(
        viaJson([
          "lst_1",
          {
            name: "F",
            questions: [
              { label: "Título", required: true, target: { kind: "title" } },
              { label: "Campo", required: false, target: { kind: "field", definitionId: "fld_1" } },
            ],
          },
        ]),
      ).success,
    ).toBe(true);
    expect(
      ESCALA.createForm.safeParse(
        viaJson([
          "lst_1",
          {
            name: "F",
            questions: [{ id: "fqs_1", label: "Título", required: true, target: { kind: "title" } }],
          },
        ]),
      ).success,
    ).toBe(true);
    expect(ESCALA.updateForm.safeParse(viaJson(["frm_1", { enabled: false }])).success).toBe(true);
    expect(
      ESCALA.updateForm.safeParse(
        viaJson([
          "frm_1",
          {
            name: "x",
            questions: [{ label: "Assunto", required: true, target: { kind: "title" } }],
          },
        ]),
      ).success,
    ).toBe(true);
    expect(ESCALA.archiveForm.safeParse(viaJson(["frm_1"])).success).toBe(true);
    expect(ESCALA.rotateFormSecret.safeParse(viaJson(["frm_1"])).success).toBe(true);

    // share-task-dialog.tsx
    expect(
      ESCALA.shareTaskPublicly.safeParse(
        viaJson(["tsk_1", { showsComments: true, showsAttachments: false }]),
      ).success,
    ).toBe(true);
    expect(ESCALA.revokePublicShare.safeParse(viaJson(["tsk_1"])).success).toBe(true);
  });

  it("(c) as duas formas que o verificador reproduziu caem: createGoal kind:42 + anchor.lixo, saveView filters arbitrário", () => {
    // A forma exata que passava em ARGUMENTOS_GENERICOS (01-VERIFICATION.md).
    expect(
      ESCALA.createGoal.safeParse(
        viaJson([
          { name: "Meta", anchor: { type: "list", id: "lst_ativacao", lixo: { a: [1, 2] } }, kind: 42, target: 10 },
        ]),
      ).success,
    ).toBe(false);
    // Só o kind fora do enum, sem a chave a mais no anchor.
    expect(
      ESCALA.createGoal.safeParse(
        viaJson([{ name: "Meta", anchor: { type: "list", id: "lst_ativacao" }, kind: 42, target: 10 }]),
      ).success,
    ).toBe(false);
    // Só a chave a mais no anchor, com kind válido.
    expect(
      ESCALA.createGoal.safeParse(
        viaJson([
          {
            name: "Meta",
            anchor: { type: "list", id: "lst_ativacao", lixo: { a: [1, 2] } },
            kind: "tarefasConcluidas",
            target: 10,
          },
        ]),
      ).success,
    ).toBe(false);
    // saveView — kind fora do enum.
    expect(
      ESCALA.saveView.safeParse(
        viaJson([{ listId: "lst_1", name: "V", kind: "x", filters: {}, shared: false }]),
      ).success,
    ).toBe(false);
    // saveView — filters com chave arbitrária, exatamente como o verificador reproduziu.
    expect(
      ESCALA.saveView.safeParse(
        viaJson([
          { listId: "lst_1", name: "V", kind: "lista", filters: { qualquer: { coisa: true } }, shared: false },
        ]),
      ).success,
    ).toBe(false);
  });

  it("(c) outras formas hostis caem", () => {
    expect(ESCALA.updateGoal.safeParse(viaJson(["gol_1", { kind: 42 }])).success).toBe(false);
    expect(ESCALA.updateGoal.safeParse(viaJson(["gol_1", { lixo: 1 }])).success).toBe(false);
    expect(
      ESCALA.createForm.safeParse(
        viaJson([
          "lst_1",
          { name: "F", questions: [{ label: "x", required: true, target: { kind: "campo" } }] },
        ]),
      ).success,
    ).toBe(false);
    expect(ESCALA.createForm.safeParse(viaJson(["lst_1", { name: "F", questions: "x" }])).success).toBe(false);
    expect(
      ESCALA.shareTaskPublicly.safeParse(viaJson(["tsk_1", { showsComments: "sim", showsAttachments: false }]))
        .success,
    ).toBe(false);
  });
});
