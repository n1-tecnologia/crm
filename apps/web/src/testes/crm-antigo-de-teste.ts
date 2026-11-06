/**
 * Registros do CRM antigo (Contato, Negócio, Conversa) montados à mão para as provas NEGATIVAS da web (15-31, D-15-13).
 *
 * Várias telas já leem o CRM pelas rotas da api (`@/dados/crm/*`) e têm um teste que diz "o registro antigo do estado
 * não aparece". Até o 15-30 o registro antigo vinha do seed; o seed não cria mais CRM, então o teste põe o seu, com
 * estes construtores. Só montam o objeto: quem usa o põe na coleção certa do estado.
 */

import type { Contact, Conversation, Deal } from "@n1/dominio/types";

export function contatoAntigoDeTeste(sobre: Partial<Contact> & { readonly id: string }): Contact {
  return {
    workspaceId: "ws_n1",
    createdBy: { kind: "member", id: "mem_julia" },
    createdAt: "2026-10-01T09:00:00.000Z",
    lifecycle: "ativo",
    firstName: "Antigo",
    lastName: "do Estado",
    ownerMemberId: "mem_julia",
    creationMode: "manual",
    description: "",
    identifiers: [],
    consents: [],
    addresses: [],
    tagIds: [],
    fieldValues: [],
    comments: [],
    ...sobre,
  } as Contact;
}

export function negocioAntigoDeTeste(sobre: Partial<Deal> & { readonly id: string }): Deal {
  return {
    workspaceId: "ws_n1",
    createdBy: { kind: "member", id: "mem_julia" },
    createdAt: "2026-10-01T09:00:00.000Z",
    lifecycle: "ativo",
    title: "Negócio do estado",
    object: "Full Face Avançado",
    description: "",
    ownerMemberId: "mem_julia",
    funnelId: "fnl_closer",
    stageId: "clo_negociacao",
    situation: "aberto",
    contactLinks: [],
    tagIds: [],
    fieldValues: [],
    attachments: [],
    comments: [],
    stageHistory: [],
    ...sobre,
  } as unknown as Deal;
}

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
