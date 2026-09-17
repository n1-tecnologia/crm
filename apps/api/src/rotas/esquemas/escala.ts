/**
 * A FORMA dos `args` das operações de `packages/dominio/src/operations/scale.ts`
 * — 14 operações. Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import type { Goal, View } from "@n1/dominio";
import { CONTAINER_TYPE, ID, PRIORITY, STATUS_CATEGORY, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const VIEW_KIND = z.enum(["lista", "quadro", "calendario", "linhaDoTempo", "tabela", "carga"]);

// `ViewFilters` é fechado no domínio — todo filtro é opcional, mas a chave
// tem de ser conhecida; é exatamente o que o verificador reproduziu com
// `filters: { qualquer: … }`.
const VIEW_FILTERS = z
  .object({
    statusCategory: STATUS_CATEGORY.optional(),
    statusId: ID.optional(),
    assigneeMemberId: ID.optional(),
    priority: PRIORITY.optional(),
    tagId: ID.optional(),
    overdue: z.boolean().optional(),
    text: z.string().optional(),
  })
  .strict();

const GROUP_BY = z.enum(["status", "assignee", "priority"]);

const SORT_BY = z
  .object({ by: z.enum(["dueDate", "priority", "title", "createdAt"]), direction: z.enum(["asc", "desc"]) })
  .strict();

const SAVE_VIEW_INPUT = z
  .object({
    listId: ID,
    name: z.string(),
    kind: VIEW_KIND,
    filters: VIEW_FILTERS,
    groupBy: GROUP_BY.optional(),
    sortBy: SORT_BY.optional(),
    shared: z.boolean(),
  })
  .strict();

const GOAL_ANCHOR = z.object({ type: CONTAINER_TYPE, id: ID }).strict();

const GOAL_KIND = z.enum(["tarefasConcluidas", "metrica"]);

const GOAL_MEASURE = z
  .object({
    target: z.enum(["task", "deal"]),
    scopeType: z.enum(["workspace", "space", "folder", "list", "funnel"]),
    scopeIds: z.array(ID),
    aggregation: z.enum(["contagem", "soma"]),
    attribute: z.string(),
  })
  .strict();

// `target > 0`, "métrica exige measure", data válida — regras de
// `validateGoal`, `scale.ts:198`, não repetir aqui.
const GOAL_INPUT = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    anchor: GOAL_ANCHOR,
    kind: GOAL_KIND,
    target: z.number(),
    unit: z.string().optional(),
    measure: GOAL_MEASURE.optional(),
    dueDate: z.string().optional(),
  })
  .strict();

// Escrito por extenso (não `GOAL_INPUT.partial()`) para deixar o `.strict()`
// inequívoco — o caso "(c) updateGoal com lixo" prova que o parcial continua
// estrito.
const GOAL_INPUT_PARCIAL = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    anchor: GOAL_ANCHOR.optional(),
    kind: GOAL_KIND.optional(),
    target: z.number().optional(),
    unit: z.string().optional(),
    measure: GOAL_MEASURE.optional(),
    dueDate: z.string().optional(),
  })
  .strict();

const FORM_QUESTION_TARGET = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("title") }).strict(),
  z.object({ kind: z.literal("description") }).strict(),
  z.object({ kind: z.literal("field"), definitionId: ID }).strict(),
]);

const FORM_QUESTION = z
  .object({ id: ID.optional(), label: z.string(), required: z.boolean(), target: FORM_QUESTION_TARGET })
  .strict();

const FORM_INPUT = z
  .object({ name: z.string(), description: z.string().optional(), questions: z.array(FORM_QUESTION) })
  .strict();

const FORM_INPUT_PARCIAL = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    questions: z.array(FORM_QUESTION).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

const SHARE_OPTIONS = z.object({ showsComments: z.boolean(), showsAttachments: z.boolean() }).strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const ESCALA = {
  saveView: z.tuple([SAVE_VIEW_INPUT]),
  deleteView: z.tuple([ID]),
  setDefaultView: z.tuple([ID, z.boolean()]),
  createGoal: z.tuple([GOAL_INPUT]),
  updateGoal: z.tuple([ID, GOAL_INPUT_PARCIAL]),
  archiveGoal: z.tuple([ID]),
  setGoalArchived: z.tuple([ID, z.boolean()]),
  linkTaskToGoal: z.tuple([ID, ID, z.boolean()]),
  createForm: z.tuple([ID, FORM_INPUT]),
  updateForm: z.tuple([ID, FORM_INPUT_PARCIAL]),
  archiveForm: z.tuple([ID]),
  rotateFormSecret: z.tuple([ID]),
  shareTaskPublicly: z.tuple([ID, SHARE_OPTIONS]),
  revokePublicShare: z.tuple([ID]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof VIEW_KIND>, View["kind"]>,
    Igual<z.infer<typeof GROUP_BY>, NonNullable<View["groupBy"]>>,
    Igual<z.infer<typeof GOAL_KIND>, Goal["kind"]>,
    Igual<z.infer<typeof GOAL_MEASURE>["scopeType"], NonNullable<Goal["measure"]>["scopeType"]>,
    Igual<z.infer<typeof GOAL_MEASURE>["aggregation"], NonNullable<Goal["measure"]>["aggregation"]>,
  ]
>;
