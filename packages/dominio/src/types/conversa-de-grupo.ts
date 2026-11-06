/**
 * A Conversa de GRUPO e as Mensagens dela: o que sobrou de `Conversation` e `Message` depois que o
 * CRM antigo saiu do `DataState` (Fase 15, 3.5.4, UCR-12).
 *
 * A Conversa 1:1 foi para `plataforma.conversas` e `plataforma.mensagens`. A de Grupo, o envio de Flow
 * e as composições das Automações seguem em `state.conversations` (F14-D-05) até as Sessões 6 e 7,
 * e é só isso que este tipo descreve: não há Contato nem Fila obrigatórios, a Conversa nasce de um
 * Grupo (`groupIdentifier`) e vive em `plataforma.registros`. O que Grupo e Flow nunca leem (o
 * Identificador não resolvido, a resposta a outra Mensagem, o assunto e as cópias de e-mail) saiu do
 * tipo; uma linha antiga que ainda os guarde segue hidratando, porque o JSON não é conferido contra
 * o tipo.
 *
 * Ontology: documento 14, A4.5, B7, B12, B66–B68.
 */

import type { EnvioDeFlow, RespostaDeFlow } from "./ferramentas";
import type { ActorRef, Attachment, FieldValue, Id, Instant, Provenance, RecordBase } from "./primitives";

/** A4.5 — system state of the Conversation. Sending a message does not change it. */
export type ConversationState = "aberta" | "pendente" | "resolvida";

export type MessageDirection = "recebida" | "enviada" | "interna";

export type MessageDeliveryStatus = "pendente" | "enviada" | "entregue" | "lida" | "falhou";

/** Um participante da Conversa: Membro, Agente ou Contato (documento 14, 7.7). */
export interface Participant {
  readonly id: Id;
  readonly subject: ActorRef | { readonly kind: "contact"; readonly id: Id };
  role: "contato" | "atendente" | "agente" | "observador";
  readonly principal?: boolean;
  readonly enteredAt: Instant;
  leftAt?: Instant;
  addedBy?: ActorRef;
}

/** DO-CXE-09 — present only while `pendente`. */
export interface Snooze {
  readonly until: Instant;
  readonly reason?: string;
  readonly by: ActorRef;
}

/** B68 — terminal value object; the message stays with a marker. */
export interface DeletionMark {
  readonly at: Instant;
  readonly by: ActorRef;
  readonly origin: "remetenteExterno" | "interno";
}

/** B66 — one per internal actor; never a Message and never in the sequence. */
export interface Draft {
  readonly actor: ActorRef;
  content: string;
  readonly origin: "membro" | "agente" | "sessaoDeChat";
  readonly executionId?: Id;
  readonly at: Instant;
}

export interface MensagemDeGrupo {
  readonly id: Id;
  readonly conversationId: Id;
  readonly direction: MessageDirection;
  readonly actor: ActorRef;
  readonly delegate?: ActorRef;
  /** B67 — the participant author, when the actor is contact, member or agent. */
  readonly senderParticipantId?: Id;
  content: string;
  readonly attachments: Attachment[];
  readonly usedTemplateProviderId?: string;
  readonly externalId?: string;
  deliveryStatus?: MessageDeliveryStatus;
  deliveryFailureReason?: string;
  readonly internalReads: Array<{ readonly actor: ActorRef; readonly at: Instant }>;
  readonly reactions: Array<{ readonly participantId: Id; readonly symbol: string; readonly at: Instant }>;
  deletionMark?: DeletionMark;
  readonly externalEdits: ReadonlyArray<{ readonly at: Instant; readonly previousContent: string }>;
  readonly createdAt: Instant;
  provenance?: Provenance;
  /** 23, 7.6 — a Mensagem `enviada` leva um Flow (e um Anexo `flow`). */
  flow?: EnvioDeFlow;
  /** 23, 7.6 — a Mensagem `recebida` traz a Resposta de Flow como conteúdo estruturado. */
  respostaDeFlow?: RespostaDeFlow;
}

/** A4.1 domain exception — the Conversation has no `arquivado`. */
export interface ConversaDeGrupo extends Omit<RecordBase, "lifecycle" | "lifecycleBeforeTrash"> {
  lifecycle: "ativo" | "naLixeira";
  /** INV-CXE-04 — immutable. O Canal é o de `plataforma.canais`. */
  readonly channelId: Id;
  /** Só a Conversa 1:1 que Flow e Automação abrem tem Contato (o de `plataforma.contatos`). */
  contactId?: Id;
  state: ConversationState;
  queueId?: Id;
  /** B7 — Member or Agent. Being assigned does not grant `ver`. */
  assignee?: ActorRef;
  title: string;
  titleEdited: boolean;
  snooze?: Snooze;
  drafts: Draft[];
  /**
   * Quem marcou esta Conversa. É POR MEMBRO, como os Observadores da Tarefa:
   * marcar é uma escolha de quem atende, não um atributo da Conversa.
   */
  starredBy: Id[];
  tagIds: Id[];
  fieldValues: FieldValue[];
  groupIdentifier?: { readonly externalId: string; readonly name: string };
  participants: Participant[];
  messages: MensagemDeGrupo[];
  resolvedAt?: Instant;
  reopenedAt?: Instant;
  reopenCount: number;
}
