/**
 * Primitives shared by every domain.
 * Ontology: A4.1 (lifecycle states), A6.1 (actor kinds), B36/B43 (own state,
 * state before trash), B34 (Locale as value object).
 */

export type Id = string;

/** Absolute instant, ISO 8601 in UTC. Rendered in the workspace Locale timezone. */
export type Instant = string;

/** Civil day, `YYYY-MM-DD`. Has no timezone by definition (documento 06, 6.2). */
export type CivilDate = string;

/**
 * A Data of a Task is either a civil day or an instant. The form is chosen per
 * Data, never per Task (documento 06, 6.2).
 */
export type TaskDate =
  | { readonly form: "civilDay"; readonly value: CivilDate }
  | { readonly form: "instant"; readonly value: Instant };

/** Duration in minutes. */
export type Minutes = number;

/**
 * Value of a Deal: amount plus currency. Currencies never sum with each other
 * (RN-PAI-13); the panel produces one series per currency.
 */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

/** A6.1 — who performs a registrable action. */
export type ActorKind = "member" | "agent" | "automation" | "integration" | "system";

/**
 * Reference to an Actor. Every registrable action carries one, and an optional
 * delegate ("em nome de" — A6.2).
 */
export interface ActorRef {
  readonly kind: ActorKind;
  readonly id: Id;
}

/**
 * A4.1 — lifecycle state common to persistent entities. Domain exceptions are
 * declared by the entities that have them (Contact/Company add `mesclado`,
 * Agent/Automation add `rascunho` and `pausado`, Channel has no `na lixeira`,
 * Conversation has no `arquivado`).
 *
 * The codes are invariant in gender for every entity (A4.1).
 */
export type Lifecycle = "ativo" | "arquivado" | "naLixeira";

/** B43 — only `ativo` or `arquivado` can precede the trash. */
export type LifecycleBeforeTrash = "ativo" | "arquivado";

/**
 * Fields every workspace-owned record carries. `ownState` is the recorded state;
 * the effective state is derived from the ancestors and is never stored (B36).
 */
export interface RecordBase {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly createdBy: ActorRef;
  /** A6.2 — present when the creator acted on behalf of someone. */
  readonly createdByDelegate?: ActorRef;
  readonly createdAt: Instant;
  lifecycle: Lifecycle;
  /** B43 — recorded while `naLixeira`, consumed and cleared on restore. */
  lifecycleBeforeTrash?: LifecycleBeforeTrash;
  archivedAt?: Instant;
  trashedAt?: Instant;
}

/**
 * A8 — provenance without a live link. Survives the elimination of the origin
 * as a historical value.
 */
export interface Provenance {
  readonly kind:
    | "template"
    | "recurrence"
    | "checklistItem"
    | "conversation"
    | "deal"
    | "contact"
    | "company"
    | "task"
    | "chatSession"
    | "execution"
    | "automation"
    | "copy"
    | "import"
    | "merge"
    | "form";
  readonly sourceId: Id;
  /** Name at the time — the reference is a value, not a live pointer. */
  readonly sourceName: string;
  readonly at: Instant;
}

/** A8 — explicit, typed, bidirectional association between two records. */
export type LinkTargetType =
  | "task"
  | "contact"
  | "company"
  | "deal"
  | "conversation"
  | "knowledgeDocument";

export interface Link {
  readonly id: Id;
  readonly fromType: LinkTargetType;
  readonly fromId: Id;
  readonly toType: LinkTargetType;
  readonly toId: Id;
  /** Free label where the ontology allows it (Task↔*, Conversation↔Deal). */
  readonly role?: string;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
}

/** A8 — reference to a workspace File. Removing it never removes the File. */
export interface Attachment {
  readonly fileId: Id;
  readonly order: number;
  readonly mediaType:
    | "image"
    | "audio"
    | "video"
    | "document"
    | "spreadsheet"
    | "location"
    | "sticker"
    /** Formulário interativo do provedor (WhatsApp Flows): coleta dados dentro da conversa. */
    | "flow"
    | "other";
  readonly displayName: string;
  /** C26 — derived, regenerable, attributed to an Actor; never replaces the File. */
  readonly derivedText?: { readonly text: string; readonly by: ActorRef; readonly at: Instant };
}

export interface WorkspaceFile {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly name: string;
  readonly mediaType: Attachment["mediaType"];
  readonly sizeBytes: number;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
}

/**
 * A8 — a manifestation of an Actor about a record. Replies are one level deep;
 * `resolved` exists only on the thread root (DO-TAR-07).
 */
export interface Comment {
  readonly id: Id;
  readonly author: ActorRef;
  readonly authorDelegate?: ActorRef;
  content: string;
  readonly attachments: Attachment[];
  /** Derived from the content; never creates a Link or a permission (RN-TAR-14). */
  readonly mentions: ReadonlyArray<{ readonly type: string; readonly id: Id }>;
  readonly parentCommentId?: Id;
  resolved?: { readonly by: Id; readonly at: Instant };
  readonly createdAt: Instant;
  editedAt?: Instant;
  /** RN-TAR-13 — deletion keeps the thread with a marker. */
  deletedAt?: Instant;
}

/** A5.3 — global catalogue of field types. */
export type FieldType =
  | "text"
  | "longText"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "dateTime"
  | "singleSelect"
  | "multiSelect"
  | "checkbox"
  | "person"
  | "phone"
  | "email"
  | "url"
  | "file"
  | "rating"
  | "relation"
  | "formula";

/** A5.1 — the configuration half of a custom field. */
export interface FieldDefinition {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly name: string;
  /**
   * O que preencher ali. Um nome de campo raramente se explica sozinho —
   * "Critério" não diz a ninguém qual pergunta fazer — e sem isso cada pessoa
   * preenche uma coisa diferente no mesmo campo.
   */
  readonly description?: string;
  readonly type: FieldType;
  readonly options?: readonly string[];
  readonly required: boolean;
  /** A5.2 — Task definitions live in a container; CRM definitions in the workspace. */
  readonly target: "task" | "contact" | "company" | "deal" | "conversation";
  /** Present for `task`: the container that is the point of definition (B25). */
  readonly definedAtType?: "space" | "folder" | "list";
  readonly definedAtId?: Id;
  lifecycle: Lifecycle;
}

/**
 * A5.1 — the value half. B37: a value whose definition stopped applying is
 * archived inside the aggregate, never discarded.
 */
export interface FieldValue {
  readonly definitionId: Id;
  value: string | number | boolean | readonly string[] | null;
  /** B37 — `arquivado` means preserved, hidden, not editable, out of panels. */
  state: "ativo" | "arquivado";
}

/** B5 — label defined in the workspace, applicable to five entity types. */
export interface Tag {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly name: string;
  readonly color: string;
  /** Optional restriction of the entity types it applies to. */
  readonly appliesTo?: ReadonlyArray<"task" | "contact" | "company" | "deal" | "conversation">;
  lifecycle: Lifecycle;
}

/**
 * A6.2 — the recorded fact of an action. Base of the audit trail and of every
 * entity's history.
 */
export interface ActivityRecord {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly actor: ActorRef;
  /** A6.2 — "em nome de", any actor kind (B18). */
  readonly delegate?: ActorRef;
  readonly action: string;
  readonly objectType: string;
  readonly objectId: Id;
  /** INV-ET-12 — survives the elimination of the object. */
  readonly objectName: string;
  readonly at: Instant;
  readonly result: "ok" | "denied" | "failed";
  readonly before?: string;
  readonly after?: string;
  /** Free detail: reason of a governance act, cause of a system act, etc. */
  readonly detail?: string;
}
