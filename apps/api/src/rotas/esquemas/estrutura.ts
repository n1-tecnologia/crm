/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/structure.ts` — 10 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import type { FieldRequirement } from "@n1/dominio";
import { CONTAINER_TYPE, ID, MODELO_DE_TAREFA, opcional, STATUS_CATEGORY, STATUS_MAPPING, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const FIELD_REQUIREMENT = z
  .object({
    definitionId: ID.optional(),
    attribute: z.enum(["dueDate", "estimate", "startDate"]).optional(),
    whenDefinitionId: ID.optional(),
    whenValue: z.string().optional(),
    positive: z.boolean().optional(),
    label: z.string().optional(),
  })
  .strict();

// "ao menos um `naoIniciado` e um `fechado`" é RN-ESP-05, regra do domínio —
// não repetir aqui.
const STATUS_DEFINITION = z
  .object({
    id: ID,
    name: z.string(),
    color: z.string(),
    category: STATUS_CATEGORY,
    order: z.number(),
    exitRequirements: z.array(FIELD_REQUIREMENT).optional(),
    entryAllowedMemberIds: z.array(ID).optional(),
    entryRequirements: z.array(FIELD_REQUIREMENT).optional(),
    entryFromStatusIds: z.array(ID).optional(),
  })
  .strict();

const STATUS_SET = z.object({ id: ID, definitions: z.array(STATUS_DEFINITION) }).strict();

const CREATE_SPACE_INPUT = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
    isPrivate: z.boolean().optional(),
    statusSet: STATUS_SET.optional(),
    templateId: ID.optional(),
  })
  .strict();

const CREATE_CONTAINER_INPUT = z
  .object({
    name: z.string(),
    parentType: z.enum(["space", "folder"]),
    parentId: ID,
    description: z.string().optional(),
    isPrivate: z.boolean().optional(),
    templateId: ID.optional(),
  })
  .strict();

/**
 * Só a Lista tem modelo de Tarefa (C35) e canais de atendimento (C36) — a
 * Pasta não conhece os campos. `create-container-dialog.tsx` manda
 * `modeloDeTarefa` sempre e `canaisDeAtendimento` quando conversacional;
 * um `.strict()` sem os dois devolvia 400 para toda Lista criada pela tela.
 */
const CREATE_LIST_INPUT = CREATE_CONTAINER_INPUT.extend({
  modeloDeTarefa: MODELO_DE_TAREFA.optional(),
  canaisDeAtendimento: z.array(ID).optional(),
}).strict();

// POSC-09 — `container-settings.tsx` manda só o que mudou; vazio em
// `description` apaga (regra do domínio, não daqui).
const UPDATE_CONTAINER_INPUT = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    isPrivate: z.boolean().optional(),
  })
  .strict();

// D-11 (2.3.1) — só Pasta e Lista se movem; o Espaço é a raiz. O destino é o
// novo pai: um Espaço ou uma Pasta. A regra de profundidade é do domínio.
const FOLDER_OU_LIST = z.enum(["folder", "list"]);

const DESTINO_DE_MOVER = z.object({ parentType: z.enum(["space", "folder"]), parentId: ID }).strict();

// D-08 / D-09 (2.3.2) — o pai do grupo que se reordena: um Espaço ou uma Pasta;
// `null` só para os Espaços. Vazio, repetido e fora do grupo são recusas do
// domínio, por isso a lista de ids não tem `.min()`/`.max()`.
const PAI_DE_CONTEINER = z.object({ type: z.enum(["space", "folder"]), id: ID }).strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const ESTRUTURA = {
  createSpace: z.tuple([CREATE_SPACE_INPUT]),
  createFolder: z.tuple([CREATE_CONTAINER_INPUT]),
  createList: z.tuple([CREATE_LIST_INPUT]),
  updateContainer: z.tuple([CONTAINER_TYPE, ID, UPDATE_CONTAINER_INPUT]),
  moveContainer: z.tuple([FOLDER_OU_LIST, ID, DESTINO_DE_MOVER, opcional(z.array(STATUS_MAPPING))]),
  reorderContainers: z.tuple([CONTAINER_TYPE, PAI_DE_CONTEINER.nullable(), z.array(ID)]),
  archiveContainer: z.tuple([CONTAINER_TYPE, ID]),
  unarchiveContainer: z.tuple([CONTAINER_TYPE, ID]),
  trashContainer: z.tuple([CONTAINER_TYPE, ID]),
  restoreContainer: z.tuple([CONTAINER_TYPE, ID]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [Igual<NonNullable<z.infer<typeof FIELD_REQUIREMENT>["attribute"]>, NonNullable<FieldRequirement["attribute"]>>]
>;
