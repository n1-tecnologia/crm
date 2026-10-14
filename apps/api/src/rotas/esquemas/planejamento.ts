/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/planning.ts` — 11 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import { ID, MODELO_DE_TAREFA, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

const TEMPLATE_INPUT = z.object({ name: z.string(), description: z.string().optional() }).strict();

// O mesmo `input` de `createList` sem `templateId` (ele vai posicional):
// `create-container-dialog.tsx` manda `modeloDeTarefa` (C35) sempre e
// `canaisDeAtendimento` (C36) quando conversacional.
const INSTANTIATE_LIST_TEMPLATE_INPUT = z
  .object({
    name: z.string(),
    parentType: z.enum(["space", "folder"]),
    parentId: ID,
    description: z.string().optional(),
    isPrivate: z.boolean().optional(),
    modeloDeTarefa: MODELO_DE_TAREFA.optional(),
    canaisDeAtendimento: z.array(ID).optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const PLANEJAMENTO = {
  setMemberCapacity: z.tuple([ID, z.number()]),
  enableSprints: z.tuple([ID, z.number()]),
  disableSprints: z.tuple([ID]),
  createNextSprint: z.tuple([ID]),
  closeSprint: z.tuple([ID]),
  saveListAsTemplate: z.tuple([ID, TEMPLATE_INPUT]),
  saveTaskAsTemplate: z.tuple([ID, TEMPLATE_INPUT]),
  instantiateTaskTemplate: z.tuple([ID, ID, opcional(z.string())]),
  instantiateListTemplate: z.tuple([ID, INSTANTIATE_LIST_TEMPLATE_INPUT]),
  renameTemplate: z.tuple([ID, TEMPLATE_INPUT]),
  setTemplateArchived: z.tuple([ID, z.boolean()]),
} satisfies Esquemas;
