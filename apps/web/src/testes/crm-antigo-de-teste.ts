/**
 * Uma Conversa do modelo antigo montada à mão para as provas NEGATIVAS da web (15-31, D-15-13): as telas leem as
 * Conversas pelas rotas da api (`@/dados/crm/*`) e os testes provam que a Conversa do estado não aparece. Só monta o
 * objeto: quem usa o põe nas Conversas do estado. O Contato e o Negócio antigos saíram na 15-42, com os arranjos
 * que os punham no estado: nenhuma tela os lê mais.
 */

import type { Conversation } from "@n1/dominio/types";

/** Uma Conversa 1:1 aberta, com uma Mensagem recebida ainda não lida, atribuída a `atribuidaA`. */
export function conversaAntigaDeTeste(sobre: Partial<Conversation> & { readonly id: string; readonly atribuidaA?: string }): Conversation {
  const { atribuidaA, ...resto } = sobre;
  return {
    workspaceId: "ws_n1",
    createdBy: { kind: "system", id: "sistema" },
    createdAt: "2026-11-06T09:00:00.000Z",
    lifecycle: "ativo",
    channelId: "chn_wpp",
    contactId: "cnt_35",
    state: "aberta",
    ...(atribuidaA ? { assignee: { kind: "member", id: atribuidaA } } : {}),
    title: "Conversa do estado",
    titleEdited: false,
    drafts: [],
    starredBy: [],
    tagIds: [],
    fieldValues: [],
    participants: [],
    messages: [
      {
        id: `msg_${sobre.id}`,
        conversationId: sobre.id,
        direction: "recebida",
        actor: { kind: "integration", id: "chn_wpp" },
        content: "Oi!",
        attachments: [],
        internalReads: [],
        reactions: [],
        externalEdits: [],
        createdAt: "2026-11-06T09:00:00.000Z",
      },
    ],
    reopenCount: 0,
    ...resto,
  } as unknown as Conversation;
}
