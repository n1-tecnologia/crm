/**
 * A FORMA dos `args` das cinco operações de
 * `packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts` que seguem em
 * `OPERACOES` — a Conversa de GRUPO aberta na Caixa as chama pelo store (F14-D-05).
 * As outras seis operações de Conversa (`sendMessage`, `moveConversationToContact`,
 * `discardDraft`, `restoreConversation`, `startConversation`, `markConversationRead`) saíram do
 * registro na 15-32 e respondem 404. `receiveMessage` NÃO é operação de Membro e nunca esteve em
 * `OPERACOES`. Ver `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o porquê
 * da validação ser de transporte, não de regra de negócio.
 */

import { ACTOR_REF, ID, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const CONVERSAS = {
  resolveConversation: z.tuple([ID]),
  reopenConversation: z.tuple([ID]),
  // O 2º parâmetro é `ActorRef | undefined` — posição obrigatória que o web
  // preenche com `undefined` para "remover atribuição"; `undefined` numa
  // lista vira `null` no JSON, por isso `opcional()`.
  assignConversation: z.tuple([ID, opcional(ACTOR_REF)]),
  trashConversation: z.tuple([ID]),
  toggleConversationStar: z.tuple([ID]),
} satisfies Esquemas;
