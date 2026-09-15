/**
 * CRM: Contacts, Companies, Deals, Funnels and the Inbox.
 * Ontology: documentos 09–14, A4.4, A4.5, B8–B14, B50–B70.
 */

import type {
  ActorRef,
  Attachment,
  CivilDate,
  Comment,
  FieldValue,
  Id,
  Instant,
  Lifecycle,
  Money,
  Provenance,
  RecordBase,
} from "./primitives";

/** A4.1 domain exception — Contact and Company add a terminal `mesclado`. */
export type CrmLifecycle = Lifecycle | "mesclado";

/** B13 — the only path by which an incoming Message resolves to a Contact. */
export type ContactIdentifierType =
  | "telefone"
  | "email"
  | "identidadeDeWhatsApp"
  | "usuarioDeInstagram"
  | "identificadorDeChatDoSite"
  /**
   * Identificador que NENHUM Canal resolve: registra por onde a pessoa existe
   * publicamente, não por onde se fala com ela. Nenhuma Capacidade de Canal o
   * lista, então ele nunca vira aba de conversa nem destino de Mensagem —
   * enquanto o LinkedIn não for um Canal com janela de resposta, modelo
   * aprovado e status de entrega definidos.
   */
  | "perfilDeLinkedIn"
  /** Como o LinkedIn: perfil público, nenhum Canal o resolve. */
  | "perfilDeTikTok";

export interface ContactIdentifier {
  readonly id: Id;
  readonly type: ContactIdentifierType;
  /** Canonical form; the uniqueness key together with the type (INV-CON-02). */
  readonly value: string;
  readonly displayValue: string;
  channelOriginId?: Id;
  /** Profile name the channel reports; feeds the display name when empty. */
  channelLabel?: string;
  verified: boolean;
  /** INV-CON-03 — at most one principal per type. */
  principal: boolean;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
}

/** B54 — monotonic history; the current value is derived per (purpose, channel). */
export interface ConsentRecord {
  readonly purposeId: Id;
  readonly channelType: ChannelType | "todos";
  readonly decision: "concedido" | "revogado";
  readonly at: Instant;
  readonly origin: "mensagem" | "formulario" | "verbal" | "importacao" | "automacao";
  readonly evidenceFileId?: Id;
  readonly evidenceMessageId?: Id;
  readonly recordedBy: ActorRef;
  readonly recordedAt: Instant;
}

export interface Address {
  readonly kind: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  principal: boolean;
}

/** B8 — N:N with role, two independent principal indicators and validity. */
export interface ContactCompanyLink {
  readonly id: Id;
  readonly contactId: Id;
  readonly companyId: Id;
  /** The job title belongs to the link, never to the Contact (DO-CON-04). */
  role: string;
  /** INV-CON-04 — at most one per Contact. */
  principalForContact: boolean;
  /** INV-EMP-04 — at most one per Company. */
  principalForCompany: boolean;
  start?: CivilDate;
  /** Filled means the link is closed; it is never deleted (RN-CON-06). */
  end?: CivilDate;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
}

/** DO-CON-14 — suppresses a duplicate suspicion for the pair. */
export interface DistinctFromLink {
  readonly id: Id;
  readonly contactAId: Id;
  readonly contactBId: Id;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
}

/** B14 — copy taken at the merge instant; base of the copy restoration. */
export interface PreMergeState {
  readonly at: Instant;
  readonly snapshot: string;
}

/** Documento 10, 6 — immutable, feeds panels and duplicate rules. */
export type ContactCreationMode =
  | "manual"
  | "importacao"
  | "automaticoPorMensagem"
  | "automaticoPorAutomacaoOuAgente"
  | "desdobradoDeMesclagem";

export interface Contact extends Omit<RecordBase, "lifecycle"> {
  lifecycle: CrmLifecycle;
  firstName: string;
  lastName: string;
  /** B14 — points at the survivor; mandatory and immutable while `mesclado`. */
  mergedIntoId?: Id;
  /** A7 — exactly one Member, always human. */
  ownerMemberId: Id;
  readonly creationMode: ContactCreationMode;
  originId?: Id;
  qualificationId?: Id;
  /** B34 — Catálogo `temperatura`: quão perto do fechamento a pessoa está. */
  temperatureId?: Id;
  birthDate?: CivilDate;
  language?: string;
  timezone?: string;
  photoFileId?: Id;
  description: string;
  identifiers: ContactIdentifier[];
  consents: ConsentRecord[];
  addresses: Address[];
  tagIds: Id[];
  fieldValues: FieldValue[];
  comments: Comment[];
  preMergeState?: PreMergeState;
  mergedAt?: Instant;
  /**
   * RN-CON-15 — present on a Contact born from `restoreMergedCopy`, pointing at
   * the `mesclado` record it was copied from. A restored copy that did not say
   * where it came from would be indistinguishable from a duplicate.
   */
  provenance?: Provenance;
}

/** B50 — analogous to the Contact identifier; never resolves Messages. */
export interface CompanyIdentifier {
  readonly id: Id;
  readonly type: "dominio" | "documentoFiscal" | "telefone";
  readonly value: string;
  readonly country?: string;
  verified: boolean;
  principal: boolean;
  readonly createdAt: Instant;
}

/** B52 — typed association with a fixed catalogue. */
export interface CompanyCompanyLink {
  readonly id: Id;
  readonly fromCompanyId: Id;
  readonly toCompanyId: Id;
  readonly kind: "parceira" | "concorrente" | "fornecedoraDe" | "clienteDe" | "outro";
  readonly label?: string;
  readonly createdAt: Instant;
}

export interface Company extends Omit<RecordBase, "lifecycle"> {
  lifecycle: CrmLifecycle;
  /** INV-EMP-01 — at least one of the two. */
  tradeName: string;
  legalName: string;
  ownerMemberId: Id;
  description: string;
  /** B51 — acyclic forest; nothing is inherited through it. */
  parentCompanyId?: Id;
  originId?: Id;
  identifiers: CompanyIdentifier[];
  addresses: Address[];
  tagIds: Id[];
  fieldValues: FieldValue[];
  attachments: Attachment[];
  comments: Comment[];
  mergedIntoId?: Id;
  preMergeState?: PreMergeState;
  mergedAt?: Instant;
}

/** A4.4 — system state of the Deal; orthogonal to the lifecycle. */
export type DealSituation = "aberto" | "ganho" | "perdido";

/** DO-NEG-03 — fixed platform catalogue of roles in a Deal. */
export type DealContactRole =
  | "decisor"
  | "influenciador"
  | "comprador"
  | "tecnico"
  | "usuario"
  | "outro";

export interface DealContactLink {
  readonly id: Id;
  readonly contactId: Id;
  role: DealContactRole;
  roleLabel?: string;
  /** INV-NEG-06 — at most one principal per Deal. */
  principal: boolean;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
}

/** B62 — records the stage by identity, name AND order at the time. */
export interface StageTransition {
  readonly id: Id;
  readonly at: Instant;
  readonly fromStageId?: Id;
  readonly fromStageName?: string;
  readonly fromStageOrder?: number;
  readonly toStageId: Id;
  readonly toStageName: string;
  readonly toStageOrder: number;
  readonly fromFunnelId?: Id;
  readonly toFunnelId: Id;
  readonly entryOrigin:
    | "criacao"
    | "avanco"
    | "retrocesso"
    | "salto"
    | "mudancaDeFunil"
    | "reabertura"
    | "remapeamento";
  readonly discardedProbability?: number;
  readonly timeInPreviousStageMinutes?: number;
  readonly actor: ActorRef;
  readonly delegate?: ActorRef;
}

export interface Deal extends RecordBase {
  readableId?: string;
  title: string;
  /** B10 — textual; replaces a product catalogue in this version. */
  object: string;
  description: string;
  /** B9 — 0..1, only an `ativo` Company when set. */
  companyId?: Id;
  ownerMemberId: Id;
  /** B9 — exactly one funnel and one of its stages, in every state and situation. */
  funnelId: Id;
  stageId: Id;
  value?: Money;
  /** DO-NEG-05 — discarded on every progression, preserved on remapping. */
  overriddenProbability?: number;
  situation: DealSituation;
  lossReasonId?: Id;
  winReasonId?: Id;
  closingNote?: string;
  originId?: Id;
  expectedCloseDate?: CivilDate;
  closedAt?: Instant;
  enteredStageAt: Instant;
  contactLinks: DealContactLink[];
  tagIds: Id[];
  fieldValues: FieldValue[];
  attachments: Attachment[];
  comments: Comment[];
  stageHistory: StageTransition[];
  provenance?: Provenance;
}

/** B59 — configuration of the stage, evaluated synchronously and blocking. */
export interface StageRequirement {
  readonly moment: "entrada" | "saida";
  readonly kind:
    | "campoPreenchido"
    | "contatoObrigatorio"
    | "empresaObrigatoria"
    | "valorObrigatorio"
    | "proprietarioObrigatorio";
  readonly fieldDefinitionId?: Id;
}

/** B58 — every stage is a progression stage; identity is stable inside the funnel. */
export interface Stage {
  readonly id: Id;
  name: string;
  order: number;
  defaultProbability: number;
  color?: string;
  description?: string;
  requirements: StageRequirement[];
  /** B59 — empty means every stage is allowed. */
  allowedTransitionStageIds: Id[];
}

/** B59 — consumed by the Deal when the situation changes, without leaving the stage. */
export interface ClosingRules {
  requireLossReason: boolean;
  requireValueOnWin: boolean;
}

export interface Funnel extends RecordBase {
  name: string;
  description?: string;
  color?: string;
  order: number;
  /** B57 — the Funnel has no Proprietário; governance is by role and `administrar`. */
  isPrivate: boolean;
  /** INV-FUN-02 — 1..N, and removing the only stage is rejected. */
  stages: Stage[];
  closingRules: ClosingRules;
  provenance?: Provenance;
}

/** A1.3 — global enumeration. */
export type ChannelType =
  | "whatsapp"
  | "instagram"
  /**
   * Mensagem direta do LinkedIn. Entrou como Canal quando a tela passou a
   * precisar ENVIAR por ele; antes era só Identificador, porque registrar por
   * onde a pessoa existe não é o mesmo que poder falar com ela.
   */
  | "linkedin"
  | "email"
  | "chatDoSite";

/** Documento 14, 7.1 — fixed per channel type; neither Channel nor Conversation redefine it. */
export interface ChannelCapabilities {
  readonly resolvesIdentifierTypes: readonly ContactIdentifierType[];
  readonly responseWindowHours?: number;
  readonly requiresTemplateOutsideWindow: boolean;
  readonly hasSubjectAndCopies: boolean;
  readonly reportedDeliveryStatuses: readonly MessageDeliveryStatus[];
  readonly externalSenderMayEdit: boolean;
  readonly reactions: boolean;
  readonly groups: boolean;
  readonly multimodalInOneMessage: boolean;
  readonly anonymousIdentity: boolean;
  /**
   * O que dá para anexar NESTE Canal. Oferecer na tela um tipo que o Canal não
   * aceita é prometer um envio que vai falhar do lado de fora, onde nada aqui
   * desfaz.
   */
  readonly sendableMediaTypes: readonly Attachment["mediaType"][];
  /** Mídia que se apaga depois de vista uma vez. Só o WhatsApp tem. */
  readonly viewOnce: boolean;
  /** Áudio gravado na hora, diferente de anexar um arquivo de áudio. */
  readonly voiceNote: boolean;
  /** Corpo com formatação e imagem embutida, em vez de texto puro. */
  readonly richText: boolean;
}

/** B69 — pre-approved text; not a Template and not a Message. */
export interface MessageTemplate {
  readonly providerId: string;
  readonly name: string;
  readonly language: string;
  readonly body: string;
  readonly category: "utilidade" | "marketing" | "autenticacao";
  readonly approval: "aprovado" | "pendente" | "rejeitado" | "pausado";
  readonly syncedAt: Instant;
}

/** A4.1 domain exception — the Channel has no `naLixeira`. */
export interface Channel extends Omit<RecordBase, "lifecycle" | "lifecycleBeforeTrash"> {
  lifecycle: "ativo" | "arquivado";
  name: string;
  readonly channelType: ChannelType;
  readonly externalId: string;
  connection: "conectada" | "desconectada" | "comErro";
  /** B35 — traceability, not governance. There is no Proprietário. */
  configuredByMemberId: Id;
  defaultQueueId?: Id;
  defaultContactOwnerMemberId?: Id;
  defaultOriginId?: Id;
  messageTemplates: MessageTemplate[];
  groupsEnabled: boolean;
}

/** B70 — the queue is the only origin of permission by operational reference. */
export interface Queue extends RecordBase {
  name: string;
  description?: string;
  eligibleMemberIds: Id[];
  eligibleTeamIds: Id[];
  distribution: "herdarDaCaixa" | "manual" | "rodizio" | "menorCarga";
  maxConversationsPerAttendant?: number;
  defaultContactOwnerMemberId?: Id;
  businessHours?: BusinessHours;
}

/** DO-CXE-06 — the only source of "business hours" in messaging until C12. */
export interface BusinessHours {
  readonly days: ReadonlyArray<{ readonly weekDay: number; readonly from: string; readonly to: string }>;
  readonly holidays: readonly CivilDate[];
}

/** A4.5 — system state of the Conversation. Sending a message does not change it. */
export type ConversationState = "aberta" | "pendente" | "resolvida";

export type MessageDirection = "recebida" | "enviada" | "interna";

export type MessageDeliveryStatus = "pendente" | "enviada" | "entregue" | "lida" | "falhou";

/** B68 — terminal value object; the message stays with a marker. */
export interface DeletionMark {
  readonly at: Instant;
  readonly by: ActorRef;
  readonly origin: "remetenteExterno" | "interno";
}

export interface Message {
  readonly id: Id;
  readonly conversationId: Id;
  readonly direction: MessageDirection;
  readonly actor: ActorRef;
  readonly delegate?: ActorRef;
  /** B67 — the participant author, when the actor is contact, member or agent. */
  readonly senderParticipantId?: Id;
  /** Present on `recebida`: which identifier it arrived through (B13). */
  readonly viaIdentifierId?: Id;
  content: string;
  readonly attachments: Attachment[];
  readonly subject?: string;
  readonly additionalAddresses?: ReadonlyArray<{
    readonly kind: "para" | "copia" | "copiaOculta";
    readonly address: string;
    readonly displayName?: string;
  }>;
  readonly inReplyToMessageId?: Id;
  readonly usedTemplateProviderId?: string;
  readonly externalId?: string;
  deliveryStatus?: MessageDeliveryStatus;
  deliveryFailureReason?: string;
  readonly internalReads: Array<{ readonly actor: ActorRef; readonly at: Instant }>;
  readonly reactions: Array<{ readonly participantId: Id; readonly symbol: string; readonly at: Instant }>;
  deletionMark?: DeletionMark;
  readonly externalEdits: ReadonlyArray<{ readonly at: Instant; readonly previousContent: string }>;
  readonly createdAt: Instant;
  anonymized?: boolean;
  provenance?: Provenance;
}

/** Documento 14, 7.7 — identity is the pair (conversation, subject). */
export interface Participant {
  readonly id: Id;
  readonly subject: ActorRef | { readonly kind: "contact"; readonly id: Id };
  role: "contato" | "atendente" | "agente" | "observador";
  readonly principal?: boolean;
  readonly enteredAt: Instant;
  leftAt?: Instant;
  addedBy?: ActorRef;
}

/** B66 — one per internal actor; never a Message and never in the sequence. */
export interface Draft {
  readonly actor: ActorRef;
  content: string;
  readonly origin: "membro" | "agente" | "sessaoDeChat";
  readonly executionId?: Id;
  readonly at: Instant;
}

/** DO-CXE-09 — present only while `pendente`. */
export interface Snooze {
  readonly until: Instant;
  readonly reason?: string;
  readonly by: ActorRef;
}

/** A4.1 domain exception — the Conversation has no `arquivado`. */
export interface Conversation extends Omit<RecordBase, "lifecycle" | "lifecycleBeforeTrash"> {
  lifecycle: "ativo" | "naLixeira";
  /** INV-CXE-04 — immutable. */
  readonly channelId: Id;
  /** B12 — exactly one; may hold the "não resolvido" marker (DO-CXE-25). */
  contactId?: Id;
  unresolvedIdentifier?: { readonly type: ContactIdentifierType; readonly value: string };
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
   * marcar é uma escolha de quem atende, não um atributo da Conversa. Uma
   * estrela global faria a marcação de um sumir da tela do outro.
   */
  starredBy: Id[];
  tagIds: Id[];
  fieldValues: FieldValue[];
  groupIdentifier?: { readonly externalId: string; readonly name: string };
  participants: Participant[];
  messages: Message[];
  resolvedAt?: Instant;
  reopenedAt?: Instant;
  reopenCount: number;
}

/** B11 — exactly one per workspace, created with it, never deleted. */
export interface Inbox {
  readonly id: Id;
  readonly workspaceId: Id;
  /** DO-CXE-04 — single per inbox; queues and channels do not override it. */
  reopenWindowHours: number;
  defaultDistribution: "manual" | "rodizio" | "menorCarga";
  defaultContactOwnerMemberId?: Id;
  businessHours?: BusinessHours;
}
