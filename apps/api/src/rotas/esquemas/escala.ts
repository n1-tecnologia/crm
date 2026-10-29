/**
 * A FORMA dos `args` das operações de `packages/dominio/src/operations/scale.ts`
 * — 14 operações. Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import type { View } from "@n1/dominio";
import { CONTAINER_TYPE, ID, PRIORITY, STATUS_CATEGORY, VIEW_KIND, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

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

const FORM_QUESTION_TARGET = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("title") }).strict(),
  z.object({ kind: z.literal("description") }).strict(),
  z.object({ kind: z.literal("field"), definitionId: ID }).strict(),
]);

const FORM_QUESTION = z
  .object({
    id: ID.optional(),
    label: z.string(),
    required: z.boolean(),
    target: FORM_QUESTION_TARGET,
    // Checklist 1.2/1.3 — seção, ajuda e condição da pergunta (os limites são do domínio).
    section: z.string().optional(),
    help: z.string().optional(),
    showWhen: z.object({ questionId: ID, values: z.array(z.string()) }).strict().optional(),
  })
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
  createForm: z.tuple([ID, FORM_INPUT]),
  updateForm: z.tuple([ID, FORM_INPUT_PARCIAL]),
  archiveForm: z.tuple([ID]),
  unarchiveForm: z.tuple([ID]),
  rotateFormSecret: z.tuple([ID]),
  shareTaskPublicly: z.tuple([ID, SHARE_OPTIONS]),
  revokePublicShare: z.tuple([ID]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof GROUP_BY>, NonNullable<View["groupBy"]>>,
  ]
>;
