/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/structure.ts` — 3 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import type { FieldRequirement } from "@n1/dominio";
import { ID, STATUS_CATEGORY, type Confere, type Esquemas, type Igual } from "./fragmentos";
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
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const ESTRUTURA = {
  createSpace: z.tuple([CREATE_SPACE_INPUT]),
  createFolder: z.tuple([CREATE_CONTAINER_INPUT]),
  createList: z.tuple([CREATE_CONTAINER_INPUT]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [Igual<NonNullable<z.infer<typeof FIELD_REQUIREMENT>["attribute"]>, NonNullable<FieldRequirement["attribute"]>>]
>;
