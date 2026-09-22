/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/iniciar-conversa.ts` — 1 operação. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import { ID, MONEY, type Esquemas } from "./fragmentos";
import { z } from "zod";

const INICIAR_CONVERSA_INPUT = z
  .object({
    listId: ID,
    contactId: ID,
    stageId: ID,
    channelId: ID,
    title: z.string().optional(),
    value: MONEY.optional(),
    qualificationId: ID.optional(),
    temperatureId: ID.optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const INICIAR_CONVERSA = {
  iniciarConversa: z.tuple([INICIAR_CONVERSA_INPUT]),
} satisfies Esquemas;
