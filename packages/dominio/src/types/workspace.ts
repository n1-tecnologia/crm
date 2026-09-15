/**
 * Workspace root: the tenant and its internal entities.
 * Ontology: documento 01 (Espaço de Trabalho), A1, A6, A9, B26–B35.
 */

import type { ActorRef, FieldType, Id, Instant, Lifecycle } from "./primitives";
import type { Priority, StatusSet } from "./structure";

/** A4.1 — root exception: the workspace does not use `arquivado`/`naLixeira`. */
export type WorkspaceState = "ativo" | "suspenso" | "encerrado";

/** A4.1 — root exception. A Member is never deleted (A6.4). */
export type MemberState = "pendente" | "ativo" | "suspenso" | "removido";

/** A9.4 — the four system roles. */
export type SystemRole = "proprietario" | "administrador" | "membro" | "convidado";

/** A9.1 — actions a permission can grant. */
export type PermissionAction =
  | "ver"
  | "comentar"
  | "criar"
  | "editar"
  | "excluir"
  | "administrar"
  | "executar";

/** B29 — scope of a permission. */
export type PermissionScope = "registro" | "subarvore" | "proprios";

/** A9.1 — where the permission comes from. */
export type PermissionOrigin =
  | "papel"
  | "concessaoDireta"
  | "heranca"
  | "compartilhamento"
  | "propriedade"
  | "elegibilidadeDeFila";

/** A9.1 — the permission tuple. Stored on the Resource it reaches. */
export interface Grant {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly subjectKind: "member" | "team" | "role" | "agent" | "automation";
  readonly subjectId: Id;
  readonly action: PermissionAction;
  readonly resourceType: string;
  readonly resourceId: Id;
  readonly scope: PermissionScope;
  readonly origin: Extract<PermissionOrigin, "concessaoDireta" | "compartilhamento">;
  readonly grantedBy: Id;
  readonly grantedAt: Instant;
}

export interface Role {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly name: string;
  /** B30 — a system role is immutable; a custom role declares a base as ceiling. */
  readonly system: boolean;
  readonly base: SystemRole;
  readonly permissions: ReadonlyArray<{
    readonly action: PermissionAction;
    readonly resourceType: string;
    readonly scope: PermissionScope;
  }>;
}

export interface Team {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly name: string;
  readonly description?: string;
  /** RN-ET-12 — only `ativo` or `suspenso` members belong to a team. */
  memberIds: Id[];
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
}

/** DO-CXE-14 — value object of the Member, not of the Member–Queue relation. */
export interface AttendanceAvailability {
  value: "disponivel" | "ausente" | "indisponivel";
  at: Instant;
  origin: "membro" | "automacao" | "horarioDeAtendimento";
}

/** B86 — internal entity of the Member; never retains third-party data. */
export interface UserMemoryItem {
  readonly id: Id;
  content: string;
  readonly origin: { readonly kind: "sessao" | "membro"; readonly sessionId?: Id; readonly executionId?: Id };
  readonly createdAt: Instant;
  state: "ativo" | "desativado";
}

export interface UserMemory {
  enabled: boolean;
  items: UserMemoryItem[];
}

/** A1.4 — the relation between a Usuário and a workspace. */
export interface Member {
  readonly id: Id;
  readonly workspaceId: Id;
  /** B27 — may be empty while `pendente`. */
  userId?: Id;
  /** B27 — present while `pendente` without a Usuário. */
  invitedIdentity?: { readonly type: "email"; readonly value: string };
  displayName: string;
  /** Arquivo do retrato, em `public/membros/<id>.jpg`. */
  photoFileId?: Id;
  state: MemberState;
  roleId: Id;
  invitedBy?: Id;
  joinedAt?: Instant;
  removedAt?: Instant;
  /** B28 — recorded on the removed Member. */
  successorId?: Id;
  availability: AttendanceAvailability;
  userMemory: UserMemory;
  /** Fase 3 — capacidade semanal para a Carga de trabalho; sem valor, 40 h. */
  weeklyCapacityMinutes?: number;
}

/** B34 — value object of the workspace. */
export interface Locale {
  readonly timezone: string;
  readonly currency: string;
  readonly language: string;
}

/** B34 — configuration the organization sets, within platform ceilings. */
export interface TrashPolicy {
  readonly retentionDays: number;
}

/** B34 — imposed from outside; the workspace is subject to them. */
export interface ImposedLimits {
  readonly members: number;
  readonly spaces: number;
  readonly contacts: number;
  readonly agents: number;
  readonly tasksPerList: number;
  readonly subtaskDepthCeiling: number;
  readonly executionChainDepth: number;
  readonly agentToAgentDepth: number;
  readonly operationsPerExecution: number;
  readonly approvalTimeoutHoursCeiling: number;
  readonly widgetsPerPanel: number;
}

/** B31 — up to two, one per origin; lifting requires whoever imposed it. */
export interface Suspension {
  readonly origin: "plataforma" | "proprietario";
  readonly at: Instant;
  readonly reason: string;
}

/** Glossário — readable identifier configuration, per entity family. */
export interface ReadableIdentifierConfig {
  enabled: boolean;
  prefix: string;
  next: number;
}

/** A8 — configured connection with an external system. */
export interface Integration {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly name: string;
  readonly systemType: string;
  state: "conectada" | "desconectada" | "comErro";
  /** B35 — traceability, never governance. There is no Proprietário. */
  configuredBy: Id;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
  /** Derived catalogue: identifiers of the tools it exposes. */
  readonly exposedTools: readonly string[];
}

export interface Workspace {
  readonly id: Id;
  name: string;
  state: WorkspaceState;
  /** INV-ET-02 — derived from the holder of the Proprietário role. */
  ownerMemberId: Id;
  readonly createdBy: Id;
  readonly createdAt: Instant;
  locale: Locale;
  trashPolicy: TrashPolicy;
  /** B1 — recommendation 3, within the platform ceiling (C20). */
  maxSubtaskDepth: number;
  taskReadableId: ReadableIdentifierConfig;
  dealReadableId: ReadableIdentifierConfig;
  readonly limits: ImposedLimits;
  /** B33 — instantiated with the workspace, always `ativo`. */
  readonly defaultAgentId: Id;
  /** B60 — exactly one, always `ativo`, never private. */
  defaultFunnelId: Id;
  defaultSpaceTemplateId?: Id;
  suspensions: Suspension[];
  closedAt?: Instant;
}

/** A8 — reusable structure of another entity; instantiating has no live link. */
export interface Template {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly kind: "espaco" | "pasta" | "lista" | "tarefa" | "checklist" | "agente";
  readonly name: string;
  readonly description?: string;
  /** Descrição legível da estrutura, para quem lê o catálogo. */
  readonly body: string;
  /**
   * A8 — o que a instanciação cria. Estruturado de propósito: com o corpo em
   * texto livre, instanciar seria adivinhar, e a Proveniência apontaria para
   * algo que ninguém consegue reproduzir.
   */
  readonly creates?: {
    readonly folders?: readonly string[];
    readonly lists?: readonly string[];
    /** Template de Lista: o que ela define ao nascer (ids novos na instância). */
    readonly listConfig?: {
      readonly statusSet?: StatusSet;
      readonly fieldDefinitions?: ReadonlyArray<{
        readonly name: string;
        readonly type: FieldType;
        readonly options?: readonly string[];
        readonly required: boolean;
        readonly description?: string;
      }>;
      readonly taskTypes?: readonly string[];
    };
    /** Template de Tarefa: estrutura copiada, nunca ids. */
    readonly task?: {
      readonly title: string;
      readonly description: string;
      readonly priority: Priority;
      readonly checklists: ReadonlyArray<{ readonly name: string; readonly items: readonly string[] }>;
      readonly subtasks: readonly string[];
    };
  };
  /** B47 — a Folder template that contains Subfolders is only instantiable in a Space. */
  readonly containsSubfolders?: boolean;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
  lifecycle: Lifecycle;
}

/** B34 — workspace catalogues with identity. */
export interface CatalogItem {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly kind:
    | "origem"
    | "qualificacao"
    | "temperatura"
    | "finalidadeConsentimento"
    | "motivoPerda"
    | "motivoGanho";
  readonly name: string;
  readonly color?: string;
  readonly order: number;
  /** Only for `finalidadeConsentimento` (B54). */
  readonly requiresConsentToSend?: boolean;
  /** Instantiated with the workspace and editable (B34). */
  readonly seeded?: boolean;
  lifecycle: Lifecycle;
}
