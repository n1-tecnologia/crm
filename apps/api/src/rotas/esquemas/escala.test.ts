/**
 * `esquemas/escala.ts` — testes puros, sem banco, sem `buildApp`: só a FORMA
 * dos argumentos, nunca regra de negócio. Provam três coisas: (1) as DUAS
 * formas que o verificador reproduziu contra o antigo fallback estrutural
 * (`01-VERIFICATION.md`, removido no Plan 01-16) caem — `saveView` com
 * `filters` arbitrário (a outra, de Metas, saiu com elas); (2) outras formas
 * hostis caem; (3) as formas LITERAIS que `apps/web` manda hoje continuam
 * passando — a rede de regressão contra falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { ESCALA } from "./escala";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/escala — a forma dos args de scale.ts", () => {
  it("(a) cobertura — as 9 chaves de scale.ts em registro.ts", () => {
    const esperadas = [
      "saveView",
      "deleteView",
      "setDefaultView",
      "createForm",
      "updateForm",
      "archiveForm",
      "unarchiveForm",
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
    // Checklist 1.2/1.3 — a pergunta com seção, ajuda e condição, como o editor manda.
    expect(
      ESCALA.updateForm.safeParse(
        viaJson([
          "frm_1",
          {
            questions: [
              { id: "fqs_1", label: "Forma", required: false, target: { kind: "field", definitionId: "fd_1" }, section: "Pagamento", help: "Como paga" },
              { id: "novo_1", label: "Chave", required: false, target: { kind: "field", definitionId: "fd_2" }, showWhen: { questionId: "fqs_1", values: ["Chave Pix"] } },
            ],
          },
        ]),
      ).success,
    ).toBe(true);
    expect(
      ESCALA.updateForm.safeParse(viaJson(["frm_1", { questions: [{ label: "x", required: true, target: { kind: "title" }, showWhen: { questionId: "a", values: [], extra: 1 } }] }])).success,
    ).toBe(false);
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
    expect(ESCALA.unarchiveForm.safeParse(viaJson(["frm_1"])).success).toBe(true);
    expect(ESCALA.rotateFormSecret.safeParse(viaJson(["frm_1"])).success).toBe(true);

    // share-task-dialog.tsx
    expect(
      ESCALA.shareTaskPublicly.safeParse(
        viaJson(["tsk_1", { showsComments: true, showsAttachments: false }]),
      ).success,
    ).toBe(true);
    expect(ESCALA.revokePublicShare.safeParse(viaJson(["tsk_1"])).success).toBe(true);
  });

  it("(c) as formas que o verificador reproduziu caem: saveView com kind fora do enum e filters arbitrário", () => {
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
