/**
 * Structure of Work: Space → Folder → Subfolder → List → Task → Subtask.
 * Ontology: documentos 02–08, A3, A4.2, B1–B4, B25, B36, B37, B40, B43, B45, B48.
 */

import type {
  ActorRef,
  Attachment,
  Comment,
  FieldValue,
  Id,
  Instant,
  Lifecycle,
  Minutes,
  Provenance,
  RecordBase,
  TaskDate,
} from "./primitives";

/** A4.3 — fixed platform categories. Automations, panels and AI read these. */
export type StatusCategory = "naoIniciado" | "emAndamento" | "concluido" | "fechado";

/** A4.2 — configuration half of a status. */
export interface StatusDefinition {
  readonly id: Id;
  name: string;
  color: string;
  readonly category: StatusCategory;
  order: number;
  /** Requisitos de SAÍDA deste Status: o que a Tarefa precisa ter para deixá-lo. */
  exitRequirements?: readonly FieldRequirement[];
  /** Só estes Membros movem uma Tarefa PARA este Status (vazio ou ausente: qualquer um que escreva). */
  entryAllowedMemberIds?: readonly Id[];
  /** Requisitos de ENTRADA: o que a Tarefa precisa ter para chegar a este Status. */
  entryRequirements?: readonly FieldRequirement[];
  /** Só se chega a este Status vindo destes (ausente: de qualquer um). */
  entryFromStatusIds?: readonly Id[];
}

/**
 * Um Campo (ou atributo nativo) exigido, opcionalmente só quando outro Campo
 * tem certo valor — "Boleto exigido quando Forma de pagamento = Boleto".
 */
export interface FieldRequirement {
  readonly definitionId?: Id;
  readonly attribute?: "dueDate" | "estimate" | "startDate";
  readonly whenDefinitionId?: Id;
  readonly whenValue?: string;
  /** Campo numérico: além de preenchido, maior que zero. */
  readonly positive?: boolean;
  readonly label?: string;
}

/** A4.2 — ordered sequence defined at one level and inherited (B25). */
export interface StatusSet {
  readonly id: Id;
  /** RN-ESP-05 — at least one `naoIniciado` and one `fechado`. */
  definitions: StatusDefinition[];
}

/** C6 — changes presentation, default fields and AI semantics, never the lifecycle. */
export interface TaskType {
  readonly id: Id;
  readonly name: string;
  readonly icon: string;
  /** The platform-provided type, not removable. */
  readonly isPlatformDefault: boolean;
  readonly definedAtType: "space" | "folder" | "list";
  readonly definedAtId: Id;
}

/** B25 — how a level relates to a configurable aspect defined above. */
export type InheritanceMode = "herdado" | "sobrescrito" | "bloqueado";

export type ConfigurableAspect =
  | "statusSet"
  | "fieldDefinitions"
  | "taskTypes"
  | "features"
  | "defaultViews"
  | "automations";

/** Glossário — one indicator per Task functionality; the catalogue is the platform's. */
export interface EnabledFeatures {
  prioridade: boolean;
  registroDeTempo: boolean;
  estimativa: boolean;
  dependencias: boolean;
  recorrencia: boolean;
  subtarefas: boolean;
  checklists: boolean;
  exigirSubtarefasConcluidas: boolean;
  exigirChecklistsConcluidos: boolean;
  datasDeSubtarefasContidas: boolean;
  impedirConclusaoDeTarefaBloqueada: boolean;
  compartilhamentoPublico: boolean;
}

/** A8 — saved presentation of a set of records. Configuration, not domain entity. */
export interface View {
  readonly id: Id;
  name: string;
  kind: "lista" | "quadro" | "calendario" | "linhaDoTempo" | "tabela" | "carga";
  /** Belongs to a container (shared with whoever opens it) or to a Member (personal view). */
  ownerKind: "container" | "member";
  ownerId: Id;
  /** The List the view reads; the permission is of whoever opens it, never of who saved it. */
  readonly listId: Id;
  filters: ViewFilters;
  groupBy?: "status" | "assignee" | "priority";
  sortBy?: { readonly by: "dueDate" | "priority" | "title" | "createdAt"; readonly direction: "asc" | "desc" };
  isDefault: boolean;
  readonly createdBy: Id;
  readonly createdAt: Instant;
}

/** Every filter optional; absent means "não filtra por isto". */
export interface ViewFilters {
  readonly statusCategory?: StatusCategory;
  readonly statusId?: Id;
  readonly assigneeMemberId?: Id;
  readonly priority?: Priority;
  readonly tagId?: Id;
  readonly overdue?: boolean;
  readonly text?: string;
}

/**
 * Fase 4 — Meta: alvo numérico lido de registros (como um Widget) ou por
 * conclusão de Tarefas ligadas. O progresso é derivado, nunca gravado.
 */
export interface Goal extends RecordBase {
  name: string;
  description?: string;
  ownerMemberId: Id;
  /** Onde a Meta se lê: o Painel deste contêiner a mostra. */
  anchor: { readonly type: "space" | "folder" | "list"; readonly id: Id };
  kind: "tarefasConcluidas" | "metrica";
  target: number;
  unit?: string;
  /** Só em `metrica`: a mesma leitura que um Widget faz. */
  measure?: {
    readonly target: "task" | "deal";
    readonly scopeType: "workspace" | "space" | "folder" | "list" | "funnel";
    readonly scopeIds: readonly Id[];
    readonly aggregation: "contagem" | "soma";
    readonly attribute: string;
  };
  /** Só em `tarefasConcluidas`. */
  taskIds: Id[];
  dueDate?: string;
}

/**
 * Fase 4 — Formulário: perguntas mapeadas em atributos e Campos da Lista;
 * cada envio chama `createTask` em nome do dono do Formulário.
 */
export interface Form extends RecordBase {
  readonly listId: Id;
  name: string;
  description?: string;
  ownerMemberId: Id;
  questions: FormQuestion[];
  enabled: boolean;
  /** Parte pública do link; rotacionar o segredo invalida o link anterior. */
  secret: string;
  submissions: number;
}

export interface FormQuestion {
  readonly id: Id;
  label: string;
  required: boolean;
  target: { readonly kind: "title" } | { readonly kind: "description" } | { readonly kind: "field"; readonly definitionId: Id };
}

/** Fields shared by Space, Folder, Subfolder and List (B45: no owner, no status). */
interface StructuralContainerBase extends RecordBase {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
  /** A9.2, B38 — interrupts the `papel` and `heranca` origins. */
  isPrivate: boolean;
  /** B25 — mode per aspect, plus the block indicator for descendants. */
  modes: Partial<Record<ConfigurableAspect, InheritanceMode>>;
  blocks: Partial<Record<ConfigurableAspect, boolean>>;
  /** Present when the aspect is `sobrescrito`. */
  statusSet?: StatusSet;
  features?: Partial<EnabledFeatures>;
  provenance?: Provenance;
}

export interface Space extends StructuralContainerBase {
  /** RN-ESP-03 — the Space is the highest point of definition and always defines one. */
  statusSet: StatusSet;
  /**
   * Atalhos ao nível de Lista: entram na árvore do Espaço como uma Lista,
   * mas abrem outra tela do produto com um recorte fixo (a Caixa de Entrada
   * do CRM só com as Conversas do Membro). Não contêm Tarefas.
   */
  shortcuts?: readonly SpaceShortcut[];
}

export interface SpaceShortcut {
  readonly id: Id;
  readonly name: string;
  readonly target: "caixaDeEntrada";
  /** "minhas" = só as Conversas atribuídas a quem está olhando. */
  readonly scope: "minhas" | "todas";
}

/**
 * B3 — a Subfolder is a Folder whose parent is a Folder. Same entity, same
 * capabilities, one restriction: it contains no Folder (A3.4).
 */
export interface Folder extends StructuralContainerBase {
  readonly parentType: "space" | "folder";
  readonly parentId: Id;
  /**
   * Fase 3 — uma Pasta com o papel de sprint: as Listas dela são sprints
   * datadas em sequência. Não é entidade nova; é a Pasta com um papel.
   */
  sprint?: { cadenceDays: number };
}

export interface List extends StructuralContainerBase {
  readonly parentType: "space" | "folder";
  readonly parentId: Id;
  /** Descriptive; does not restrict nor derive from the Task dates. */
  plannedPeriod?: { start?: CivilDateLike; end?: CivilDateLike };
  /**
   * Um Convidado com `ver` numa Tarefa desta Lista pode comentar e preencher
   * SÓ estes Campos — a Pessoa da conta anexa a nota sem ver o resto.
   */
  guestEditableDefinitionIds?: readonly Id[];
}

type CivilDateLike = string;

/** B2 — internal component of the Task, without external identity. */
export interface ChecklistItem {
  readonly id: Id;
  text: string;
  order: number;
  done: boolean;
  doneAt?: Instant;
  /** INV-CHK-04 — any actor kind with `editar` may complete it. */
  doneBy?: ActorRef;
  /** B48 — 0..1 Member, never an Agent. */
  assigneeMemberId?: Id;
  readonly parentItemId?: Id;
  /** B48 — terminal marker; out of numerator and denominator of the progress. */
  converted?: { readonly taskId: Id; readonly title: string; readonly at: Instant; readonly by: ActorRef };
}

export interface Checklist {
  readonly id: Id;
  name: string;
  order: number;
  items: ChecklistItem[];
  provenance?: Provenance;
  readonly createdBy: ActorRef;
  readonly createdAt: Instant;
}

/** B42 — always of a Member; an Agent never logs time. */
export interface TimeEntry {
  readonly id: Id;
  readonly memberId: Id;
  readonly start: Instant;
  end?: Instant;
  durationMinutes?: Minutes;
  description?: string;
  readonly createdBy: ActorRef;
}

/** Glossário — typed relation between Tasks; never cyclic, never ancestor↔descendant. */
export type DependencyKind = "bloqueia" | "eBloqueadaPor" | "aguarda";

export interface Dependency {
  readonly id: Id;
  readonly kind: DependencyKind;
  readonly taskId: Id;
}

/** B6 — each due occurrence generates a NEW Task with provenance. */
export interface RecurrenceRule {
  readonly frequency: "diaria" | "semanal" | "mensal" | "anual";
  readonly interval: number;
  readonly weekDays?: readonly number[];
  readonly triggerMode: "aoConcluir" | "porCalendario";
  readonly whenStillOpen?: "gerarMesmoAssim" | "aguardarConclusao";
  readonly endsAfter?: number;
  readonly endsOn?: CivilDateLike;
  /** Um vencimento que cai no fim de semana anda para o dia útil anterior (ou posterior). */
  readonly businessDays?: "anterior" | "posterior";
  /** A próxima ocorrência nasce com este Responsável, substituindo os copiados. */
  readonly defaultAssigneeMemberId?: Id;
  readonly copies: {
    readonly checklists: boolean;
    readonly subtasks: boolean;
    readonly assignees: boolean;
    readonly fieldValues: boolean;
    /** Campos que NÃO se copiam mesmo com `fieldValues` — a nota fiscal do mês seguinte ainda não existe. */
    readonly fieldValuesExcept?: readonly Id[];
  };
}

/** Glossário — exposes read access without a Subject; only a Member creates it. */
export interface PublicShare {
  readonly secret: string;
  active: boolean;
  readonly createdBy: Id;
  readonly createdAt: Instant;
  readonly showsComments: boolean;
  readonly showsAttachments: boolean;
}

/** Glossário — Priority is a fixed ordinal scale in this version (C17). */
export type Priority = "urgente" | "alta" | "normal" | "baixa" | "semPrioridade";

/**
 * B1 — a Subtask is a Task whose `parentTaskId` is filled. There is no separate
 * type: no rule, permission, tool, trigger or data source may treat it as one.
 */
export interface Task extends RecordBase {
  /** B4 — exactly one List; for a Subtask, derived from the root (INV-TAR-03). */
  listId: Id;
  parentTaskId?: Id;
  rootTaskId?: Id;
  /** Order among siblings; meaningful for Subtasks (documento 06, 6.1). */
  siblingOrder: number;
  readableId?: string;
  title: string;
  description: string;
  /** INV-TAR-04 — points at a definition of the List's effective Status Set. */
  statusId: Id;
  taskTypeId: Id;
  priority: Priority;
  startDate?: TaskDate;
  dueDate?: TaskDate;
  /** Derived on transition to a terminal category; cleared on reopen. */
  completedAt?: Instant;
  estimate?: Minutes;
  /** B7 — Member or Agent, both require `ver` on the Task (RN-TAR-06). */
  assignees: ActorRef[];
  observerMemberIds: Id[];
  tagIds: Id[];
  fieldValues: FieldValue[];
  checklists: Checklist[];
  timeEntries: TimeEntry[];
  dependencies: Dependency[];
  attachments: Attachment[];
  comments: Comment[];
  recurrence?: RecurrenceRule;
  publicShare?: PublicShare;
  provenance?: Provenance;
  updatedAt: Instant;
}

/** B25 — the resolved configuration a List consumes, computed per query. */
export interface EffectiveListConfig {
  readonly statusSet: StatusSet;
  readonly statusSetDefinedAt: { readonly type: string; readonly id: Id; readonly name: string };
  readonly fieldDefinitionIds: readonly Id[];
  readonly taskTypeIds: readonly Id[];
  readonly features: EnabledFeatures;
  readonly path: ReadonlyArray<{ readonly type: "space" | "folder" | "list"; readonly id: Id; readonly name: string }>;
}

/** B36 — derived: the most restrictive between own state and the ancestors'. */
export type EffectiveLifecycle = Lifecycle;
