/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/configuration.ts` — 14 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import type { EnabledFeatures, FieldType } from "@n1/dominio";
import {
  CONTAINER_TYPE,
  ID,
  opcional,
  STATUS_CATEGORY,
  type Confere,
  type Esquemas,
  type Igual,
} from "./fragmentos";
import { z } from "zod";

const FIELD_TYPE = z.enum([
  "text",
  "longText",
  "number",
  "currency",
  "percent",
  "date",
  "dateTime",
  "singleSelect",
  "multiSelect",
  "checkbox",
  "person",
  "phone",
  "email",
  "url",
  "file",
  "rating",
  "relation",
  "formula",
]);

const FEATURE = z.enum([
  "prioridade",
  "registroDeTempo",
  "estimativa",
  "dependencias",
  "recorrencia",
  "subtarefas",
  "checklists",
  "exigirSubtarefasConcluidas",
  "exigirChecklistsConcluidos",
  "datasDeSubtarefasContidas",
  "impedirConclusaoDeTarefaBloqueada",
  "compartilhamentoPublico",
]);

const FOLDER_OU_LIST = z.enum(["folder", "list"]);

// "opções não vazias" e "sem repetição" são regra — `validateOptions` em
// `configuration.ts` — não repetir aqui.
const CREATE_FIELD_DEFINITION_INPUT = z
  .object({
    name: z.string(),
    type: FIELD_TYPE,
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    description: z.string().optional(),
    definedAtType: CONTAINER_TYPE,
    definedAtId: ID,
  })
  .strict();

const UPDATE_FIELD_DEFINITION_INPUT = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  })
  .strict();

const ADD_STATUS_INPUT = z
  .object({ name: z.string(), color: z.string(), category: STATUS_CATEGORY })
  .strict();

const UPDATE_STATUS_INPUT = z.object({ name: z.string().optional(), color: z.string().optional() }).strict();

const CREATE_TASK_TYPE_INPUT = z
  .object({ name: z.string(), icon: z.string(), definedAtType: CONTAINER_TYPE, definedAtId: ID })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const CONFIGURACAO = {
  createFieldDefinition: z.tuple([CREATE_FIELD_DEFINITION_INPUT]),
  updateFieldDefinition: z.tuple([ID, UPDATE_FIELD_DEFINITION_INPUT]),
  archiveFieldDefinition: z.tuple([ID]),
  restoreFieldDefinition: z.tuple([ID]),
  addStatus: z.tuple([CONTAINER_TYPE, ID, ADD_STATUS_INPUT]),
  updateStatus: z.tuple([CONTAINER_TYPE, ID, ID, UPDATE_STATUS_INPUT]),
  reorderStatuses: z.tuple([CONTAINER_TYPE, ID, z.array(ID)]),
  removeStatus: z.tuple([CONTAINER_TYPE, ID, ID, opcional(ID)]),
  overrideStatusSet: z.tuple([FOLDER_OU_LIST, ID]),
  inheritStatusSet: z.tuple([FOLDER_OU_LIST, ID]),
  createTaskType: z.tuple([CREATE_TASK_TYPE_INPUT]),
  updateTaskType: z.tuple([ID, z.object({ name: z.string() }).strict()]),
  removeTaskType: z.tuple([ID]),
  // `null` = "herdar" — valor de domínio.
  setContainerFeature: z.tuple([CONTAINER_TYPE, ID, FEATURE, z.boolean().nullable()]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [Igual<z.infer<typeof FIELD_TYPE>, FieldType>, Igual<z.infer<typeof FEATURE>, keyof EnabledFeatures>]
>;
