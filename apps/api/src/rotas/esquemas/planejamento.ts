/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/planning.ts` — 11 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import { ID, MODELO_DE_TAREFA, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";
import { CANAIS_DO_NAVEGADOR } from "./tarefas-conversacionais";

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
  enableSprints: z.tuple([ID, z.number()]),
  disableSprints: z.tuple([ID]),
  createNextSprint: z.tuple([ID]),
  closeSprint: z.tuple([ID]),
  saveListAsTemplate: z.tuple([ID, TEMPLATE_INPUT]),
  saveTaskAsTemplate: z.tuple([ID, TEMPLATE_INPUT]),
  instantiateTaskTemplate: z.tuple([ID, ID, opcional(z.string())]),
  // O 3º elemento é o `canais` que o navegador usa só na execução local: o servidor o descarta e o
  // troca pelo que leu de `plataforma.canais` (`rotas/gesto-no-crm`, D-15-07).
  instantiateListTemplate: z.tuple([ID, INSTANTIATE_LIST_TEMPLATE_INPUT, opcional(CANAIS_DO_NAVEGADOR)]),
  renameTemplate: z.tuple([ID, TEMPLATE_INPUT]),
  setTemplateArchived: z.tuple([ID, z.boolean()]),
} satisfies Esquemas;
