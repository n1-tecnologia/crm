/**
 * Inbox operations: sending, resolving, reopening and assigning conversations.
 * Ontology: documento 14, B12, B66, B68, B69, RN-CXE-*.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type { ActorRef, ChannelCapabilities, ChannelType, Conversation, Id, Message } from "../types";
import { marketingConsentMissing } from "../derive";
import { memberActor, nextId, recordActivity, systemActor } from "./activity";

const now = (): string => new Date().toISOString();

/**
 * Documento 14, 7.1 — capabilities belong to the CHANNEL TYPE. No rule reads
 * them from the Channel or the Conversation (RN-CXE-05).
 */
export const CHANNEL_CAPABILITIES: Record<ChannelType, ChannelCapabilities> = {
  whatsapp: {
    resolvesIdentifierTypes: ["identidadeDeWhatsApp"],
    responseWindowHours: 24,
    requiresTemplateOutsideWindow: true,
    hasSubjectAndCopies: false,
    reportedDeliveryStatuses: ["enviada", "entregue", "lida"],
    externalSenderMayEdit: true,
    reactions: true,
    groups: true,
    multimodalInOneMessage: false,
    anonymousIdentity: false,
    sendableMediaTypes: ["image", "video", "audio", "document", "sticker", "location", "flow"],
    viewOnce: true,
    voiceNote: true,
    richText: false,
  },
  instagram: {
    resolvesIdentifierTypes: ["usuarioDeInstagram"],
    responseWindowHours: 24,
    requiresTemplateOutsideWindow: true,
    hasSubjectAndCopies: false,
    reportedDeliveryStatuses: ["enviada", "lida"],
    externalSenderMayEdit: true,
    reactions: true,
    groups: false,
    multimodalInOneMessage: false,
    anonymousIdentity: false,
    // Sem documento: o Direct não aceita arquivo, só mídia.
    sendableMediaTypes: ["image", "video", "audio"],
    viewOnce: true,
    voiceNote: true,
    richText: false,
  },
  /*
   * LinkedIn: mensagem direta. Não tem janela de resposta, porque a permissão
   * para falar vem da conexão e não do tempo desde a última resposta. Também
   * não tem modelo aprovado: o que existe lá é limite de InMail, que é cota do
   * remetente e não aprovação de conteúdo.
   */
  linkedin: {
    resolvesIdentifierTypes: ["perfilDeLinkedIn"],
    requiresTemplateOutsideWindow: false,
    hasSubjectAndCopies: false,
    reportedDeliveryStatuses: ["enviada", "lida"],
    externalSenderMayEdit: true,
    reactions: true,
    groups: true,
    multimodalInOneMessage: false,
    anonymousIdentity: false,
    sendableMediaTypes: ["image", "video", "document"],
    viewOnce: false,
    voiceNote: true,
    richText: false,
  },
  email: {
    resolvesIdentifierTypes: ["email"],
    requiresTemplateOutsideWindow: false,
    hasSubjectAndCopies: true,
    reportedDeliveryStatuses: ["enviada"],
    externalSenderMayEdit: false,
    reactions: false,
    groups: true,
    multimodalInOneMessage: true,
    anonymousIdentity: false,
    // O e-mail aceita qualquer arquivo, e vários na mesma Mensagem.
    sendableMediaTypes: ["image", "video", "audio", "document", "spreadsheet", "other"],
    viewOnce: false,
    voiceNote: false,
    richText: true,
  },
  chatDoSite: {
    resolvesIdentifierTypes: ["identificadorDeChatDoSite"],
    requiresTemplateOutsideWindow: false,
    hasSubjectAndCopies: false,
    reportedDeliveryStatuses: ["entregue", "lida"],
    externalSenderMayEdit: false,
    reactions: false,
    groups: false,
    multimodalInOneMessage: true,
    anonymousIdentity: true,
    sendableMediaTypes: ["image", "document"],
    viewOnce: false,
    voiceNote: false,
    richText: false,
  },
};

function windowOpenUntil(state: DataState, conversation: Conversation): Date | null {
  const channel = state.channels.find((c) => c.id === conversation.channelId);
  if (!channel) return null;
  const hours = CHANNEL_CAPABILITIES[channel.channelType].responseWindowHours;
  if (hours === undefined) return null;
  const lastReceived = [...conversation.messages]
    .filter((m) => m.direction === "recebida")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
  if (!lastReceived) return null;
  return new Date(Date.parse(lastReceived.createdAt) + hours * 3_600_000);
}

export interface SendMessageInput {
  readonly conversationId: Id;
  readonly content: string;
  /** B67 — an internal note never reaches the Contact (INV-CXE-09). */
  readonly internal?: boolean;
  readonly templateProviderId?: string;
  /** Set when an Agent sends on behalf of a Member (A6.2). */
  readonly actor?: ActorRef;
  readonly delegate?: ActorRef;
  /**
   * O Rascunho adotado nesta Mensagem (doc 14, 7.10). Enviar um Rascunho
   * esvazia o Rascunho — ele deixa de estar à espera. Sem isto, o mesmo texto
   * fica visível como Mensagem enviada E como Rascunho pendente, e o próximo
   * Atendente o adota de novo: duplicata ao Contato, que não volta atrás.
   */
  readonly adoptedDraftOf?: ActorRef;
}

/**
 * RN-CXE-19 — outside the response window only an approved template may be
 * sent; a free message is REJECTED BEFORE BEING STORED, for every actor.
 * B69 — with the channel disconnected the message is stored `pendente`; there
 * is never a silent discard.
 */
export function sendMessage(
  state: DataState,
  actingMemberId: Id,
  input: SendMessageInput,
): OperationResult<Message> {
  const conversation = state.conversations.find((c) => c.id === input.conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.lifecycle !== "ativo") return fail("Esta Conversa está na lixeira.");
  if (!input.content.trim()) return fail("Escreva a mensagem antes de enviar.", "conteudo");

  const channel = state.channels.find((c) => c.id === conversation.channelId);
  if (!channel) return fail("Canal não encontrado.");

  const actor = input.actor ?? memberActor(actingMemberId);

  if (!input.internal) {
    const capabilities = CHANNEL_CAPABILITIES[channel.channelType];
    const until = windowOpenUntil(state, conversation);
    if (capabilities.requiresTemplateOutsideWindow && until && Date.now() > until.getTime()) {
      if (!input.templateProviderId) {
        return fail(
          "A janela de resposta deste Canal expirou. Só é possível enviar uma Mensagem de modelo aprovada.",
          "modelo",
        );
      }
      const template = channel.messageTemplates.find((t) => t.providerId === input.templateProviderId);
      if (!template || template.approval !== "aprovado") {
        return fail("Escolha uma Mensagem de modelo aprovada pelo provedor.", "modelo");
      }
    }

    // RN-CON-16 — a purpose that requires consent is checked before sending.
    if (marketingConsentMissing(state, conversation, input.templateProviderId)) {
      const contact = state.contacts.find((c) => c.id === conversation.contactId);
      return fail(
        `${contact?.firstName ?? "Este Contato"} não tem consentimento vigente para marketing neste Canal.`,
        "consentimento",
      );
    }
  }

  const disconnected = channel.connection !== "conectada";
  const message: Message = {
    id: nextId("msg"),
    conversationId: conversation.id,
    direction: input.internal ? "interna" : "enviada",
    actor,
    ...(input.delegate ? { delegate: input.delegate } : {}),
    content: input.content,
    attachments: [],
    ...(input.templateProviderId ? { usedTemplateProviderId: input.templateProviderId } : {}),
    ...(input.internal ? {} : { deliveryStatus: disconnected ? "pendente" : "enviada" }),
    internalReads: [],
    reactions: [],
    externalEdits: [],
    createdAt: now(),
  };
  conversation.messages.push(message);

  // B66 — sending empties the author's draft; the draft was never a Message.
  // 7.10 — and it empties the adopted one too, whoever wrote it.
  const adopted = input.adoptedDraftOf;
  conversation.drafts = conversation.drafts.filter(
    (d) =>
      !(d.actor.kind === actor.kind && d.actor.id === actor.id) &&
      !(adopted !== undefined && d.actor.kind === adopted.kind && d.actor.id === adopted.id),
  );

  recordActivity(state, {
    actor,
    ...(input.delegate ? { delegate: input.delegate } : {}),
    action: input.internal ? "Nota interna registrada" : "Mensagem enviada",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
    ...(() => {
      const parts = [
        disconnected && !input.internal ? "Canal desconectado: a Mensagem ficou pendente." : undefined,
        adopted
          ? `Rascunho de ${
              adopted.kind === "agent"
                ? (state.agents.find((a) => a.id === adopted.id)?.name ?? "Agente")
                : (state.members.find((m) => m.id === adopted.id)?.displayName ?? "Membro")
            } adotado nesta Mensagem.`
          : undefined,
      ].filter((part) => part !== undefined);
      return parts.length > 0 ? { detail: parts.join(" ") } : {};
    })(),
  });
  return ok(message);
}

/** DO-CXE-07 — sending does not change the state by itself; resolving is an act. */
export function resolveConversation(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
): OperationResult<Conversation> {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.state === "resolvida") return ok(conversation);
  const before = conversation.state;
  conversation.state = "resolvida";
  conversation.resolvedAt = now();
  delete conversation.snooze;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conversa resolvida",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
    before,
    after: "resolvida",
  });
  return ok(conversation);
}

/**
 * RN-CXE-09 — an incoming message within the reopen window reopens the SAME
 * conversation; beyond it, a new conversation is created. Manual reopening has
 * no deadline.
 */
export function reopenConversation(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
): OperationResult<Conversation> {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.state !== "resolvida") return ok(conversation);
  conversation.state = "aberta";
  conversation.reopenedAt = now();
  conversation.reopenCount += 1;
  delete conversation.resolvedAt;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conversa reaberta",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
    before: "resolvida",
    after: "aberta",
  });
  return ok(conversation);
}

/**
 * Simulates an incoming message. RN-CXE-09 decides between entering the open
 * conversation, reopening the resolved one inside the window, or creating a new
 * one. RN-CON-13 — an archived or trashed Contact returns to `ativo`.
 */
export function receiveMessage(
  state: DataState,
  channelId: Id,
  contactId: Id,
  content: string,
): OperationResult<Conversation> {
  const channel = state.channels.find((c) => c.id === channelId);
  if (!channel) return fail("Canal não encontrado.");
  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");

  if (contact.lifecycle === "arquivado" || contact.lifecycle === "naLixeira") {
    contact.lifecycle = "ativo";
    delete contact.lifecycleBeforeTrash;
    recordActivity(state, {
      actor: systemActor,
      action: "Contato restaurado por Mensagem recebida",
      objectType: "contact",
      objectId: contact.id,
      objectName: `${contact.firstName} ${contact.lastName}`.trim(),
    });
  }

  const pair = state.conversations.filter(
    (c) => c.channelId === channelId && c.contactId === contactId && c.lifecycle === "ativo",
  );
  let conversation = pair.find((c) => c.state !== "resolvida");

  if (!conversation) {
    const resolved = pair
      .filter((c) => c.state === "resolvida" && c.resolvedAt)
      .sort((a, b) => (a.resolvedAt ?? "").localeCompare(b.resolvedAt ?? ""))
      .at(-1);
    const withinWindow =
      resolved?.resolvedAt !== undefined &&
      Date.now() - Date.parse(resolved.resolvedAt) <= state.inbox.reopenWindowHours * 3_600_000;
    if (resolved && withinWindow) {
      conversation = resolved;
      conversation.state = "aberta";
      conversation.reopenCount += 1;
      conversation.reopenedAt = now();
      delete conversation.resolvedAt;
      recordActivity(state, {
        actor: systemActor,
        action: "Conversa reaberta por Mensagem",
        objectType: "conversation",
        objectId: conversation.id,
        objectName: conversation.title,
      });
    }
  }

  if (!conversation) {
    conversation = {
      id: nextId("cnv"),
      workspaceId: state.workspace.id,
      createdBy: systemActor,
      createdAt: now(),
      lifecycle: "ativo",
      channelId,
      contactId,
      state: "aberta",
      ...(channel.defaultQueueId ? { queueId: channel.defaultQueueId } : {}),
      title: content.slice(0, 60),
      titleEdited: false,
      drafts: [],
      starredBy: [],
      tagIds: [],
      fieldValues: [],
      participants: [
        {
          id: nextId("prt"),
          subject: { kind: "contact", id: contactId },
          role: "contato",
          principal: true,
          enteredAt: now(),
        },
      ],
      messages: [],
      reopenCount: 0,
    };
    state.conversations.push(conversation);
    recordActivity(state, {
      actor: systemActor,
      action: "Conversa criada por Mensagem recebida",
      objectType: "conversation",
      objectId: conversation.id,
      objectName: conversation.title,
    });
  } else if (conversation.state === "pendente") {
    conversation.state = "aberta";
    delete conversation.snooze;
  }

  const identifier =
    contact.identifiers.find((i) =>
      CHANNEL_CAPABILITIES[channel.channelType].resolvesIdentifierTypes.includes(i.type),
    ) ?? contact.identifiers[0];

  conversation.messages.push({
    id: nextId("msg"),
    conversationId: conversation.id,
    direction: "recebida",
    actor: { kind: "integration", id: channel.id },
    ...(identifier ? { viaIdentifierId: identifier.id } : {}),
    content,
    attachments: [],
    externalId: nextId("ext"),
    internalReads: [],
    reactions: [],
    externalEdits: [],
    createdAt: now(),
  });
  return ok(conversation);
}

/** RN-CXE-12 — no distribution rule assigns to an Agent; only an explicit act. */
export function assignConversation(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
  assignee: ActorRef | undefined,
): OperationResult<Conversation> {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (assignee?.kind === "member") {
    const member = state.members.find((m) => m.id === assignee.id);
    if (!member || member.state !== "ativo") return fail("Só um Membro ativo pode ser Atribuído.");
  }
  if (assignee?.kind === "agent") {
    const agent = state.agents.find((a) => a.id === assignee.id);
    if (!agent || agent.lifecycle !== "ativo") return fail("Só um Agente ativo pode ser Atribuído.");
  }
  if (assignee) conversation.assignee = assignee;
  else delete conversation.assignee;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: assignee ? "Conversa atribuída" : "Conversa liberada",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
    after: assignee?.id,
  });
  return ok(conversation);
}

/** RN-CXE-33 — only a resolved conversation goes to the trash. */
export function trashConversation(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
): OperationResult<Conversation> {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.state !== "resolvida") {
    return fail("Só uma Conversa resolvida pode ir para a lixeira.");
  }
  conversation.lifecycle = "naLixeira";
  conversation.trashedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conversa enviada à lixeira",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
  });
  return ok(conversation);
}

/**
 * RN-CXE-11 / RN-CXE-10 — mover a Conversa para outro Contato.
 *
 * A regra dura: é REJEITADO se o destino já tiver uma Conversa não resolvida no
 * mesmo Canal, salvo resolver a existente no mesmo ato. Duas Conversas abertas
 * do mesmo Contato no mesmo Canal quebram a identidade (Contato, Canal) que a
 * Caixa de Entrada usa para rotear a próxima Mensagem recebida.
 *
 * O Canal da Conversa é imutável (INV-CXE-04): mover troca o Contato, nunca o
 * Canal, e as Mensagens permanecem exatamente como estão.
 */
export function moveConversationToContact(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
  toContactId: Id,
  resolveExisting = false,
): OperationResult<Conversation> {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.lifecycle !== "ativo") return fail("Esta Conversa está na lixeira.");

  const target = state.contacts.find((c) => c.id === toContactId);
  if (!target) return fail("Contato de destino não encontrado.");
  if (target.lifecycle === "mesclado") {
    return fail("Este Contato foi mesclado. Mova para o Contato sobrevivente.");
  }
  if (conversation.contactId === toContactId) return ok(conversation);

  const colliding = state.conversations.find(
    (other) =>
      other.id !== conversation.id &&
      other.contactId === toContactId &&
      other.channelId === conversation.channelId &&
      other.lifecycle === "ativo" &&
      other.state !== "resolvida",
  );
  if (colliding && !resolveExisting) {
    const channel = state.channels.find((c) => c.id === conversation.channelId);
    return fail(
      `${target.firstName} já tem uma Conversa não resolvida em ${channel?.name ?? "este Canal"}. Resolva-a no mesmo ato para mover.`,
      "destino",
    );
  }
  if (colliding) {
    colliding.state = "resolvida";
    colliding.resolvedAt = now();
    delete colliding.snooze;
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Conversa resolvida",
      objectType: "conversation",
      objectId: colliding.id,
      objectName: colliding.title,
      before: "aberta",
      after: "resolvida",
      detail: "Resolvida no ato de mover outra Conversa para este Contato",
    });
  }

  const previous = conversation.contactId
    ? state.contacts.find((c) => c.id === conversation.contactId)
    : undefined;
  conversation.contactId = toContactId;
  delete conversation.unresolvedIdentifier;

  /**
   * RN-CXE-11 move o Contato PRINCIPAL. Sem trocar o Participante, a Conversa
   * passaria a pertencer a um Contato enquanto a lista de Participantes ainda
   * mostraria o outro como principal — a tela mentindo sobre quem está ali.
   */
  const principal = conversation.participants.find(
    (participant) => participant.subject.kind === "contact" && participant.principal,
  );
  if (principal) {
    const index = conversation.participants.indexOf(principal);
    conversation.participants[index] = {
      ...principal,
      subject: { kind: "contact", id: toContactId },
    };
  } else {
    conversation.participants.push({
      id: nextId("prt"),
      subject: { kind: "contact", id: toContactId },
      role: "contato",
      principal: true,
      enteredAt: now(),
    });
  }

  const previousName = previous ? `${previous.firstName} ${previous.lastName}`.trim() : "não resolvido";
  const targetName = `${target.firstName} ${target.lastName}`.trim();

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conversa movida para outro Contato",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
    before: previousName,
    after: targetName,
  });
  // RN-CXE-11 — registrado nas DUAS pontas: quem procura pelo Contato de origem
  // precisa achar para onde a Conversa foi.
  if (previous) {
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Conversa saiu deste Contato",
      objectType: "contact",
      objectId: previous.id,
      objectName: previousName,
      after: targetName,
      detail: conversation.title,
    });
  }
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conversa recebida de outro Contato",
    objectType: "contact",
    objectId: target.id,
    objectName: targetName,
    before: previousName,
    detail: conversation.title,
  });
  return ok(conversation);
}

/**
 * B66 — descartar um Rascunho é irrecuperável: ele nunca foi Mensagem, então
 * não há lixeira nem versão anterior para onde voltar. Por isso o descarte é um
 * ato registrado, e não um efeito colateral de fechar a tela.
 */
export function discardDraft(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
  draftActor: ActorRef,
): OperationResult<null> {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.lifecycle !== "ativo") return fail("Esta Conversa está na lixeira.");

  const draft = conversation.drafts.find(
    (d) => d.actor.kind === draftActor.kind && d.actor.id === draftActor.id,
  );
  if (!draft) return fail("Este Rascunho já não existe.");

  conversation.drafts = conversation.drafts.filter((d) => d !== draft);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Rascunho de IA descartado",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
    detail:
      draftActor.kind === "agent"
        ? (state.agents.find((a) => a.id === draftActor.id)?.name ?? "Agente")
        : (state.members.find((m) => m.id === draftActor.id)?.displayName ?? "Membro"),
  });
  return ok(null);
}

/**
 * RN-CXE-33 — a Conversa vai à lixeira só `resolvida`, e volta `resolvida`: o
 * estado de atendimento não é efeito colateral da restauração. As Mensagens
 * nunca saíram, então nada precisa voltar com ela.
 */
export function restoreConversation(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
): OperationResult<Conversation> {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.lifecycle !== "naLixeira") return ok(conversation);

  const contact = conversation.contactId
    ? state.contacts.find((c) => c.id === conversation.contactId)
    : undefined;
  if (contact && contact.lifecycle === "naLixeira") {
    return fail(
      `O Contato ${contact.firstName} está na lixeira. Restaure o Contato antes: uma Conversa sem Contato resolvido não é roteável.`,
    );
  }

  conversation.lifecycle = "ativo";
  delete conversation.trashedAt;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conversa restaurada",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
    detail: `Volta ${conversation.state}.`,
  });
  return ok(conversation);
}

/**
 * Abrir atendimento: a Conversa que o Membro começa, sem esperar o Contato
 * escrever primeiro.
 *
 * Existia só o caminho de fora para dentro (`receiveMessage`), e isso deixava
 * todo Contato novo mudo: sem Conversa, o compositor fica bloqueado para
 * sempre, e o próprio bloqueio mandava a pessoa "abrir o atendimento na Caixa
 * de Entrada" — um lugar que não tinha esse controle.
 *
 * A janela de resposta não se abre aqui: quem inicia fala sob as regras do
 * Canal, e é `sendMessage` que as aplica na primeira Mensagem.
 */
export function startConversation(
  state: DataState,
  actingMemberId: Id,
  channelId: Id,
  contactId: Id,
): OperationResult<Conversation> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return fail("Só um Membro ativo abre atendimento.");
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return fail("Um Convidado não abre atendimento.");
  }

  const channel = state.channels.find((c) => c.id === channelId);
  if (!channel) return fail("Canal não encontrado.");
  if (channel.lifecycle !== "ativo") return fail("Este Canal não está ativo.");

  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");
  if (contact.lifecycle !== "ativo") {
    return fail("Este Contato não está ativo: restaure-o antes de abrir atendimento.");
  }

  // Sem Identificador que o Canal resolva não há para onde a Mensagem sair.
  const capacidades = CHANNEL_CAPABILITIES[channel.channelType];
  const identificador = contact.identifiers.find((i) =>
    capacidades.resolvesIdentifierTypes.includes(i.type),
  );
  if (!identificador) {
    return fail(
      `Este Contato não tem Identificador que o Canal ${channel.name} alcance. Acrescente um antes de abrir atendimento.`,
    );
  }

  const existente = state.conversations.find(
    (c) =>
      c.channelId === channelId &&
      c.contactId === contactId &&
      c.lifecycle === "ativo" &&
      c.state !== "resolvida",
  );
  if (existente) return ok(existente);

  const conversation: Conversation = {
    id: nextId("cnv"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    channelId,
    contactId,
    state: "aberta",
    ...(channel.defaultQueueId ? { queueId: channel.defaultQueueId } : {}),
    assignee: memberActor(actingMemberId),
    title: `${contact.firstName} ${contact.lastName}`.trim() || identificador.displayValue,
    titleEdited: false,
    drafts: [],
    starredBy: [],
    tagIds: [],
    fieldValues: [],
    participants: [
      {
        id: nextId("prt"),
        subject: { kind: "contact", id: contactId },
        role: "contato",
        principal: true,
        enteredAt: now(),
      },
    ],
    messages: [],
    reopenCount: 0,
  };
  state.conversations.push(conversation);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Atendimento aberto",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
    detail: channel.name,
  });
  return ok(conversation);
}

/**
 * Marcar e desmarcar a Conversa. A marcação é de quem marca: outro Atendente
 * abre a mesma Conversa e não vê a estrela dele aqui.
 */
export function toggleConversationStar(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
): OperationResult<Conversation> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return fail("Só um Membro ativo marca Conversa.");

  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.lifecycle !== "ativo") return fail("Esta Conversa está na lixeira.");

  const marcada = conversation.starredBy.includes(actingMemberId);
  conversation.starredBy = marcada
    ? conversation.starredBy.filter((id) => id !== actingMemberId)
    : [...conversation.starredBy, actingMemberId];

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: marcada ? "Conversa desmarcada" : "Conversa marcada",
    objectType: "conversation",
    objectId: conversation.id,
    objectName: conversation.title,
  });
  return ok(conversation);
}

/**
 * Dar a Conversa por lida por quem está olhando. RN-CXE — "não lida" é
 * derivada: existe Mensagem sem leitura registrada deste Membro. Não existe um
 * campo `lida` que possa divergir das Mensagens.
 */
export function markConversationRead(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
): OperationResult<Conversation> {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return fail("Conversa não encontrada.");

  const agora = now();
  for (const message of conversation.messages) {
    if (message.direction === "enviada") continue;
    const jaLeu = message.internalReads.some(
      (r) => r.actor.kind === "member" && r.actor.id === actingMemberId,
    );
    if (!jaLeu) {
      message.internalReads.push({ actor: memberActor(actingMemberId), at: agora });
    }
  }
  return ok(conversation);
}
