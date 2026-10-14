/**
 * A FORMA dos `args` das operações de `packages/dominio/src/operations/tasks.ts`
 * — 20 operações. Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import { ACTOR_REF, ID, opcional, PRIORITY, STATUS_MAPPING, TASK_DATE, VALOR_DE_CAMPO, type Esquemas } from "./fragmentos";
import { z } from "zod";

const CREATE_TASK_INPUT = z
  .object({
    listId: ID,
    title: z.string(),
    parentTaskId: ID.optional(),
    statusId: ID.optional(),
    assignees: z.array(ACTOR_REF).optional(),
    priority: PRIORITY.optional(),
    dueDate: TASK_DATE.optional(),
    taskTypeId: ID.optional(),
  })
  .strict();

const UPDATE_TASK_INPUT = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    priority: PRIORITY.optional(),
    startDate: TASK_DATE.nullable().optional(),
    dueDate: TASK_DATE.nullable().optional(),
    estimate: z.number().nullable().optional(),
    taskTypeId: ID.optional(),
  })
  .strict();

const ADD_TASK_COMMENT_INPUT = z
  .object({
    content: z.string(),
    parentCommentId: ID.optional(),
    mentions: z.array(z.object({ type: z.string(), id: ID }).strict()).optional(),
    actor: ACTOR_REF.optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila (verificado neste repositório, zod 4.6.5 + TS 5: `moveTask:
 * z.tuple([ID])` e `updateTask: z.tuple([ID, z.object({ title: z.number()
 * })])` falham com TS2322 apontando `_output`). Se uma entrada não compilar,
 * o erro está na entrada — não relaxar para `z.ZodTypeAny`.
 */
export const TAREFAS = {
  createTask: z.tuple([CREATE_TASK_INPUT]),
  changeTaskStatus: z.tuple([ID, ID]),
  assignTask: z.tuple([ID, ACTOR_REF]),
  unassignTask: z.tuple([ID, ACTOR_REF]),
  moveTask: z.tuple([ID, ID, opcional(z.array(STATUS_MAPPING))]),
  convertChecklistItem: z.tuple([ID, ID, ID, opcional(ID)]),
  trashTask: z.tuple([ID]),
  restoreTask: z.tuple([ID]),
  // PARD-10 — eliminar agora e o expurgo pela retenção (dia civil como Date revivido).
  purgeTask: z.tuple([ID]),
  purgeExpiredTasks: z.tuple([ID, z.date()]),
  restoreList: z.tuple([ID]),
  addChecklist: z.tuple([ID, z.string()]),
  addChecklistItem: z.tuple([ID, ID, z.string()]),
  setChecklistItemDone: z.tuple([ID, ID, ID, z.boolean()]),
  // Remover Checklist ou Item é edição da Tarefa; o domínio guarda o conteúdo no Registro de Atividade.
  removeChecklist: z.tuple([ID, ID]),
  removeChecklistItem: z.tuple([ID, ID, ID]),
  startMeeting: z.tuple([ID]),
  endMeeting: z.tuple([ID]),
  updateTask: z.tuple([ID, UPDATE_TASK_INPUT]),
  setTaskFieldValue: z.tuple([ID, ID, VALOR_DE_CAMPO]),
  addTaskComment: z.tuple([ID, ADD_TASK_COMMENT_INPUT]),
  resolveTaskComment: z.tuple([ID, ID, z.boolean()]),
  // FUND-10 — "conteúdo não vazio" e "só o autor ou quem administra" são regra do domínio.
  editTaskComment: z.tuple([ID, ID, z.string()]),
  deleteTaskComment: z.tuple([ID, ID]),
  setTaskTags: z.tuple([ID, z.array(ID)]),
  watchTask: z.tuple([ID, ID, z.boolean()]),
} satisfies Esquemas;
