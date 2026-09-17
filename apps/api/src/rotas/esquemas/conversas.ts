/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/conversations.ts` — 11 operações.
 * `receiveMessage` NÃO é operação de Membro (simula uma Mensagem recebida,
 * sem `actingMemberId` como segundo parâmetro) e não está em `OPERACOES`
 * (`registro.ts`) — não ganha schema aqui. Ver `../esquemas/CONTEXT.md` para
 * a regra da pasta e `./fragmentos.ts` para o porquê da validação ser de
 * transporte, não de regra de negócio.
 */

import { ACTOR_REF, ID, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

const SEND_MESSAGE_INPUT = z
  .object({
    conversationId: ID,
    content: z.string(),
    internal: z.boolean().optional(),
    templateProviderId: z.string().optional(),
    actor: ACTOR_REF.optional(),
    delegate: ACTOR_REF.optional(),
    adoptedDraftOf: ACTOR_REF.optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const CONVERSAS = {
  sendMessage: z.tuple([SEND_MESSAGE_INPUT]),
  resolveConversation: z.tuple([ID]),
  reopenConversation: z.tuple([ID]),
  // O 2º parâmetro é `ActorRef | undefined` — posição obrigatória que o web
  // preenche com `undefined` para "remover atribuição"; `undefined` numa
  // lista vira `null` no JSON, por isso `opcional()`.
  assignConversation: z.tuple([ID, opcional(ACTOR_REF)]),
  trashConversation: z.tuple([ID]),
  moveConversationToContact: z.tuple([ID, ID, opcional(z.boolean())]),
  discardDraft: z.tuple([ID, ACTOR_REF]),
  restoreConversation: z.tuple([ID]),
  startConversation: z.tuple([ID, ID]),
  toggleConversationStar: z.tuple([ID]),
  markConversationRead: z.tuple([ID]),
} satisfies Esquemas;
