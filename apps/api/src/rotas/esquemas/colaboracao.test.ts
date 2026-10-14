/**
 * `esquemas/colaboracao.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem — inclusive `RecurrenceRule`, o
 * maior vetor de `jsonb` malformado fora do CRM (`copies` aninhado); (2) as
 * formas LITERAIS que `apps/web` manda hoje continuam passando.
 */

import { describe, expect, it } from "vitest";
import { COLABORACAO } from "./colaboracao";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

const RECURRENCE_RULE_LITERAL = {
  frequency: "mensal",
  interval: 1,
  triggerMode: "aoConcluir",
  copies: { checklists: true, subtasks: false, assignees: true, fieldValues: true },
};

const RECURRENCE_RULE_MAXIMA = {
  frequency: "semanal",
  interval: 2,
  weekDays: [1, 3],
  triggerMode: "porCalendario",
  triggerStatusId: "st1",
  whenStillOpen: "aguardarConclusao",
  endsAfter: 5,
  endsOn: "2027-01-01",
  businessDays: "anterior",
  defaultAssigneeMemberId: "m1",
  copies: { checklists: true, subtasks: false, assignees: true, fieldValues: true, fieldValuesExcept: ["fd1"] },
};

describe("esquemas/colaboracao — a forma dos args de collaboration.ts", () => {
  it("(a) cobertura — as 9 chaves de collaboration.ts em registro.ts", () => {
    const esperadas = [
      "addDependency",
      "removeDependency",
      "addTimeEntry",
      "startTimer",
      "stopTimer",
      "attachFile",
      "removeAttachment",
      "setRecurrence",
      "spawnNextOccurrence",
      "spawnCalendarOccurrence",
      "runCalendarRecurrences",
    ].sort();
    expect(Object.keys(COLABORACAO).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof COLABORACAO, unknown[]]> = [
      ["addDependency", ["t1", "bloqueia", "t2"]],
      ["removeDependency", ["t1", "dep1"]],
      ["addTimeEntry", ["t1", { durationMinutes: 30 }]],
      ["addTimeEntry", ["t1", { durationMinutes: 30, on: "2026-09-17", description: "nota" }]],
      ["startTimer", ["t1"]],
      ["stopTimer", ["t1"]],
      ["stopTimer", ["t1", "desc"]],
      ["attachFile", ["t1", { name: "a.pdf", mediaType: "document", sizeBytes: 10 }]],
      ["removeAttachment", ["t1", "fil1"]],
      ["setRecurrence", ["t1", null]],
      ["setRecurrence", ["t1", RECURRENCE_RULE_LITERAL]],
      ["setRecurrence", ["t1", RECURRENCE_RULE_MAXIMA]],
      ["spawnNextOccurrence", ["t1"]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(COLABORACAO[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }
  });

  it("(b2) FUND-17 — o dia civil chega como Date revivido (não como texto): aceita Date válido, recusa string e Date inválido", () => {
    for (const nome of ["spawnCalendarOccurrence", "runCalendarRecurrences"] as const) {
      expect(COLABORACAO[nome].safeParse(["t1", new Date("2026-10-14T12:00:00")]).success, nome).toBe(true);
      expect(COLABORACAO[nome].safeParse(["t1", "2026-10-14"]).success, nome).toBe(false);
      expect(COLABORACAO[nome].safeParse(["t1", new Date("lixo")]).success, nome).toBe(false);
    }
  });

  it("(c) formas hostis caem", () => {
    expect(COLABORACAO.addDependency.safeParse(viaJson(["t1", "depende", "t2"])).success).toBe(false);
    expect(
      COLABORACAO.attachFile.safeParse(viaJson(["t1", { name: "a.exe", mediaType: "exe", sizeBytes: 10 }]))
        .success,
    ).toBe(false);
    expect(
      COLABORACAO.attachFile.safeParse(
        viaJson(["t1", { name: "a.pdf", mediaType: "document", sizeBytes: "10" }]),
      ).success,
    ).toBe(false);
    expect(
      COLABORACAO.setRecurrence.safeParse(
        viaJson(["t1", { ...RECURRENCE_RULE_LITERAL, frequency: "quinzenal" }]),
      ).success,
    ).toBe(false);
    {
      const { copies, ...semCopies } = RECURRENCE_RULE_LITERAL;
      void copies;
      expect(COLABORACAO.setRecurrence.safeParse(viaJson(["t1", semCopies])).success).toBe(false);
    }
    expect(
      COLABORACAO.setRecurrence.safeParse(
        viaJson(["t1", { ...RECURRENCE_RULE_LITERAL, copies: { checklists: true } }]),
      ).success,
    ).toBe(false);
    expect(
      COLABORACAO.setRecurrence.safeParse(
        viaJson(["t1", { ...RECURRENCE_RULE_LITERAL, triggerMode: "sempre" }]),
      ).success,
    ).toBe(false);
    expect(
      COLABORACAO.setRecurrence.safeParse(
        viaJson([
          "t1",
          { ...RECURRENCE_RULE_LITERAL, copies: { ...RECURRENCE_RULE_LITERAL.copies, lixo: true } },
        ]),
      ).success,
    ).toBe(false);
    expect(
      COLABORACAO.addTimeEntry.safeParse(viaJson(["t1", { durationMinutes: "30" }])).success,
    ).toBe(false);
  });
});
