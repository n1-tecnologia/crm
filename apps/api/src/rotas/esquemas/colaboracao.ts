/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/collaboration.ts` — 9 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import type { Attachment, DependencyKind, RecurrenceRule } from "@n1/dominio";
import { ID, opcional, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const DEPENDENCY_KIND = z.enum(["bloqueia", "eBloqueadaPor", "aguarda"]);

const MEDIA_TYPE = z.enum([
  "image",
  "audio",
  "video",
  "document",
  "spreadsheet",
  "location",
  "sticker",
  "flow",
  "other",
]);

const RECURRENCE_COPIES = z
  .object({
    checklists: z.boolean(),
    subtasks: z.boolean(),
    assignees: z.boolean(),
    fieldValues: z.boolean(),
    fieldValuesExcept: z.array(ID).optional(),
  })
  .strict();

const RECURRENCE_RULE = z
  .object({
    frequency: z.enum(["diaria", "semanal", "mensal", "anual"]),
    interval: z.number(),
    weekDays: z.array(z.number()).optional(),
    triggerMode: z.enum(["aoConcluir", "porCalendario"]),
    whenStillOpen: z.enum(["gerarMesmoAssim", "aguardarConclusao"]).optional(),
    endsAfter: z.number().optional(),
    endsOn: z.string().optional(),
    businessDays: z.enum(["anterior", "posterior"]).optional(),
    defaultAssigneeMemberId: ID.optional(),
    copies: RECURRENCE_COPIES,
  })
  .strict();

const ADD_TIME_ENTRY_INPUT = z
  .object({ durationMinutes: z.number(), on: z.string().optional(), description: z.string().optional() })
  .strict();

const ATTACH_FILE_INPUT = z.object({ name: z.string(), mediaType: MEDIA_TYPE, sizeBytes: z.number() }).strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const COLABORACAO = {
  addDependency: z.tuple([ID, DEPENDENCY_KIND, ID]),
  removeDependency: z.tuple([ID, ID]),
  addTimeEntry: z.tuple([ID, ADD_TIME_ENTRY_INPUT]),
  startTimer: z.tuple([ID]),
  stopTimer: z.tuple([ID, opcional(z.string())]),
  attachFile: z.tuple([ID, ATTACH_FILE_INPUT]),
  removeAttachment: z.tuple([ID, ID]),
  // `null` = "sem recorrência".
  setRecurrence: z.tuple([ID, RECURRENCE_RULE.nullable()]),
  spawnNextOccurrence: z.tuple([ID]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof DEPENDENCY_KIND>, DependencyKind>,
    Igual<z.infer<typeof MEDIA_TYPE>, Attachment["mediaType"]>,
    Igual<z.infer<typeof RECURRENCE_RULE>["frequency"], RecurrenceRule["frequency"]>,
    Igual<z.infer<typeof RECURRENCE_RULE>["triggerMode"], RecurrenceRule["triggerMode"]>,
  ]
>;
