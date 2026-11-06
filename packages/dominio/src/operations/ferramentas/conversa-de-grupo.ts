/**
 * A Conversa de GRUPO e as Mensagens do modelo antigo (F14-D-05): o que as Ferramentas — Grupo, Flow
 * e Automação — ainda chamam depois que as operações do CRM antigo saíram de `OPERACOES` (15-32,
 * 3.5.4). Grupo e Flow ficam no modelo antigo de Conversa até as Sessões 6 e 7; este arquivo é o
 * que sobrou de `operations/conversations.ts` e sai com elas.
 *
 * Ficam registradas em `OPERACOES` só as cinco que a tela da Conversa de grupo na Caixa ainda
 * chama pelo store (`resolveConversation`, `reopenConversation`, `assignConversation`,
 * `trashConversation`, `toggleConversationStar`). `sendMessage`, `sendMessageSemConferencia`,
 * `receiveMessage` e `startConversation` são composições internas das Ferramentas: nenhuma rota as
 * alcança. Ver a linha `deviation` do 15-32 em `.planning/WINDOWS.md`.
 *
 * Ontology: documento 14, B12, B66, B68, B69, RN-CXE-*.
 */

import type { Canal } from "../../crm/canais";
import { CHANNEL_CAPABILITIES, capacidadesDoCanal } from "../../crm/capacidades";
import { marketingConsentMissing } from "../../derive";
import { fail, ok, type DataState, type OperationResult } from "../../state";
import type { ActorRef, Channel, Conversation, CrmDasFerramentas, Id, Message } from "../../types";
import { memberActor, nextId, recordActivity, systemActor } from "../activity";

/**
 * Fase 9, 1.2.2 — quem escreve no CRM antigo (Conversas e Mensagens do modelo em inglês que vive
 * em `plataforma.registros`) é Membro `ativo` com Papel base diferente de `convidado`: a mesma
 * regra de escrita de `podeNoCrm` (`../../crm/permissoes`). Devolve `undefined` quando pode e a
 * frase de recusa quando não pode. A rota recusa o suspenso (09-07) e esta é a segunda barreira,
 * no domínio, onde a regra mora para valer igual na tela e no endpoint.
 *
 * Composições internas (Automações, Flows, Grupos) que agem em nome do Agente do pipeline
 * (Convidado) ou de uma Automação chamam `sendMessageSemConferencia`, que nunca entra em
 * `OPERACOES`: lá o ator já foi conferido por quem disparou a composição.
 */
export function recusaDeEscritaNoCrmAntigo(state: DataState, actingMemberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo altera o CRM.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return "Um Convidado não altera o CRM: ele alcança só o que foi compartilhado com ele.";
  }
  return undefined;
}

const now = (): string => new Date().toISOString();

/** O Canal da tabela `plataforma.canais` na forma que as composições antigas leem (`Channel`). */
function canalComoChannel(canal: Canal, workspaceId: Id): Channel {
  return {
    id: canal.id,
    workspaceId,
    createdBy: { kind: "member", id: canal.criadoPor },
    createdAt: canal.criadoEm,
    lifecycle: canal.estado,
    ...(canal.arquivadoEm !== null ? { archivedAt: canal.arquivadoEm } : {}),
    name: canal.nome,
    channelType: canal.tipo,
    externalId: canal.identificadorExterno,
    connection: canal.conexao === "com_erro" ? "comErro" : canal.conexao,
    configuredByMemberId: canal.configuradoPor,
    ...(canal.filaPadraoId !== null ? { defaultQueueId: canal.filaPadraoId } : {}),
    ...(canal.proprietarioPadraoId !== null ? { defaultContactOwnerMemberId: canal.proprietarioPadraoId } : {}),
    ...(canal.origemPadraoId !== null ? { defaultOriginId: canal.origemPadraoId } : {}),
    messageTemplates: [],
    groupsEnabled: canal.gruposHabilitados,
    provider: canal.provedor,
    relational: true,
    simulatedConnection: canal.conexaoSimulada,
  };
}

/**
 * O Canal que a composição precisa. O Canal vive só em `plataforma.canais` (15-33: a ponte que o
 * projetava em `state.channels` saiu), então ele chega por `crm.canais`, o que o servidor leu da
 * tabela e que as operações de Grupo, Flow e Automação já recebem. `state.channels` vem primeiro:
 * é onde o CRM antigo de teste e os Canais antigos de `registros` ainda estão até o corte.
 */
function canalPeloId(state: DataState, canalId: Id, crm?: CrmDasFerramentas): Channel | undefined {
  const antigo = state.channels.find((c) => c.id === canalId);
  if (antigo) return antigo;
  const canal = crm?.canais.find((c) => c.id === canalId);
  return canal ? canalComoChannel(canal, state.workspace.id) : undefined;
}

function windowOpenUntil(channel: Channel, conversation: Conversation): Date | null {
  const hours = capacidadesDoCanal(channel).responseWindowHours;
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
  /** O Canal da Conversa, quando só a tabela `plataforma.canais` o tem (15-33). */
  readonly crm?: CrmDasFerramentas;
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
  // 1.2.2 — primeira conferência: quem escreve no CRM antigo é Membro ativo e não Convidado.
  const recusa = recusaDeEscritaNoCrmAntigo(state, actingMemberId);
  if (recusa) return fail(recusa);
  return sendMessageSemConferencia(state, actingMemberId, input);
}

/**
 * O corpo de `sendMessage`, sem conferir o ator (1.2.2). É a variante das
 * composições internas — a Automação que envia ao Contato em nome do dono, por
 * exemplo — onde o ator já foi conferido por quem disparou a composição e pode
 * agir por delegação. NUNCA entra em `OPERACOES`: nenhuma rota a alcança.
 */
export function sendMessageSemConferencia(
  state: DataState,
  actingMemberId: Id,
  input: SendMessageInput,
): OperationResult<Message> {
  const conversation = state.conversations.find((c) => c.id === input.conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  if (conversation.lifecycle !== "ativo") return fail("Esta Conversa está na lixeira.");
  if (!input.content.trim()) return fail("Escreva a mensagem antes de enviar.", "conteudo");

  const channel = canalPeloId(state, conversation.channelId, input.crm);
  if (!channel) return fail("Canal não encontrado.");

  const actor = input.actor ?? memberActor(actingMemberId);

  if (!input.internal) {
    const capabilities = capacidadesDoCanal(channel);
    const until = windowOpenUntil(channel, conversation);
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
  return ok(message, message.id);
}

/** DO-CXE-07 — sending does not change the state by itself; resolving is an act. */
export function resolveConversation(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
): OperationResult<Conversation> {
  // 1.2.2 — primeira conferência: quem escreve no CRM antigo é Membro ativo e não Convidado.
  const recusa = recusaDeEscritaNoCrmAntigo(state, actingMemberId);
  if (recusa) return fail(recusa);
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
  return ok(conversation, conversation.id);
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
  // 1.2.2 — primeira conferência: quem escreve no CRM antigo é Membro ativo e não Convidado.
  const recusa = recusaDeEscritaNoCrmAntigo(state, actingMemberId);
  if (recusa) return fail(recusa);
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
  return ok(conversation, conversation.id);
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
  crm?: CrmDasFerramentas,
): OperationResult<Conversation> {
  const channel = canalPeloId(state, channelId, crm);
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
  return ok(conversation, conversation.id);
}

/** RN-CXE-12 — no distribution rule assigns to an Agent; only an explicit act. */
export function assignConversation(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
  assignee: ActorRef | undefined,
): OperationResult<Conversation> {
  // 1.2.2 — primeira conferência: quem escreve no CRM antigo é Membro ativo e não Convidado.
  const recusa = recusaDeEscritaNoCrmAntigo(state, actingMemberId);
  if (recusa) return fail(recusa);
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
  return ok(conversation, conversation.id);
}

/** RN-CXE-33 — only a resolved conversation goes to the trash. */
export function trashConversation(
  state: DataState,
  actingMemberId: Id,
  conversationId: Id,
): OperationResult<Conversation> {
  // 1.2.2 — primeira conferência: quem escreve no CRM antigo é Membro ativo e não Convidado.
  const recusa = recusaDeEscritaNoCrmAntigo(state, actingMemberId);
  if (recusa) return fail(recusa);
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
  crm?: CrmDasFerramentas,
): OperationResult<Conversation> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return fail("Só um Membro ativo abre atendimento.");
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return fail("Um Convidado não abre atendimento.");
  }

  const channel = canalPeloId(state, channelId, crm);
  if (!channel) return fail("Canal não encontrado.");
  if (channel.lifecycle !== "ativo") return fail("Este Canal não está ativo.");

  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");
  if (contact.lifecycle !== "ativo") {
    return fail("Este Contato não está ativo: restaure-o antes de abrir atendimento.");
  }

  // Sem Identificador que o Canal resolva não há para onde a Mensagem sair.
  const capacidades = capacidadesDoCanal(channel);
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
  return ok(conversation, conversation.id);
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
  // 1.2.2 — primeira conferência: quem escreve no CRM antigo é Membro ativo e não Convidado.
  const recusa = recusaDeEscritaNoCrmAntigo(state, actingMemberId);
  if (recusa) return fail(recusa);
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
  return ok(conversation, conversation.id);
}

