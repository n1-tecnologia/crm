/**
 * AI: Chat, Agents, Skills, Automations and Knowledge.
 * Ontology: documentos 15–20, B15–B24, B71–B99.
 */

import type {
  ActorRef,
  Attachment,
  Comment,
  Id,
  Instant,
  Lifecycle,
  Provenance,
  RecordBase,
} from "./primitives";

/** A1.3 — global entity; never belongs to a workspace. */
export interface Model {
  readonly id: Id;
  readonly name: string;
  readonly capabilities: {
    readonly inputs: ReadonlyArray<"texto" | "imagem" | "audio" | "video" | "documento">;
    readonly outputs: ReadonlyArray<"texto" | "imagem" | "audio">;
  };
  readonly discontinued: boolean;
}

/** B72 — atomic operation, without reasoning. The class of effect drives approval. */
export type EffectClass = "leitura" | "escritaReversivel" | "escritaIrreversivel" | "externa";

export interface Tool {
  readonly id: string;
  readonly name: string;
  readonly origin: "plataforma" | "integracao";
  readonly integrationId?: Id;
  readonly targetResourceType: string;
  readonly requiredAction: "ver" | "comentar" | "criar" | "editar" | "excluir" | "administrar" | "executar";
  readonly effectClass: EffectClass;
  readonly description: string;
}

/** B22 — three levels; the effective level is the minimum (B77). */
export type AutonomyLevel = "assistido" | "supervisionado" | "autonomo";

/** A4.1 domain exception — Agent and Automation add `rascunho` and `pausado`. */
export type AiLifecycle = Lifecycle | "rascunho" | "pausado";

/** B71 — version states of a Skill. */
export type VersionState = "rascunho" | "publicada" | "obsoleta";

export interface SkillParameter {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}

export interface SkillVersion {
  readonly number: number;
  state: VersionState;
  instructions: string;
  inputContract: SkillParameter[];
  outputContract: { readonly structured: SkillParameter[]; readonly text: boolean };
  /** RN-HAB-13 — a missing mandatory tool makes the grant `indisponivel`. */
  toolRequirements: ReadonlyArray<{ readonly toolId: string; readonly mandatory: boolean }>;
  /** B73 — acyclic, depth-limited. */
  dependencies: ReadonlyArray<{ readonly skillId: Id; readonly pinnedVersion?: number }>;
  recommendedCollectionIds: Id[];
  publishedBy?: Id;
  readonly createdAt: Instant;
  publishedAt?: Instant;
}

/** B71 — the Skill has a Criador and a Publicador, and NO Proprietário. */
export interface Skill extends RecordBase {
  name: string;
  description: string;
  readonly ownership: "workspace" | "plataforma";
  versions: SkillVersion[];
  provenance?: Provenance;
}

/** B15/B71 — the only origin of `executar` on a Skill for an Agent. */
export interface SkillGrant {
  readonly id: Id;
  readonly agentId: Id;
  readonly skillId: Id;
  /** Empty means it follows the current version. */
  pinnedVersion?: number;
  readonly grantedBy: Id;
  readonly grantedAt: Instant;
}

/** B80 — internal entity of the Execution, WITH identity. */
export interface ApprovalRequest {
  readonly id: Id;
  readonly executionId: Id;
  readonly stepIndex: number;
  readonly requestedBy: ActorRef;
  readonly reason: "autonomia" | "permissao" | "limite" | "acaoExplicita";
  /** Immutable: approving is approving exactly this. */
  readonly object: {
    readonly toolId: string;
    readonly input: string;
    readonly targetResourceType: string;
    readonly targetResourceId: Id;
    readonly effectClass: EffectClass;
  };
  approverMemberId: Id;
  decision?: "aprovada" | "rejeitada" | "expirada" | "cancelada";
  decidedByMemberId?: Id;
  decidedAt?: Instant;
  readonly createdAt: Instant;
  readonly deadline: Instant;
}

/** B18 — ordered value object of the Execution, without identity. */
export interface ExecutionStep {
  readonly index: number;
  readonly kind: "ferramenta" | "habilidade" | "aprovacao" | "raciocinio" | "memorizacao";
  readonly toolId?: string;
  readonly skillId?: Id;
  readonly skillVersion?: number;
  readonly input?: string;
  readonly output?: string;
  /** DO-HAB-14 — the two independent checks, recorded per invocation. */
  readonly toolAllowed?: boolean;
  readonly resourcePermitted?: boolean;
  readonly effectClass?: EffectClass;
  readonly result: "concluido" | "falhou" | "negada" | "pulado" | "aguardando" | "cancelado" | "simulado";
  readonly approvalRequestId?: Id;
  readonly activityRecordId?: Id;
  readonly at: Instant;
}

export type ExecutionState =
  | "pendente"
  | "executando"
  | "aguardandoAprovacao"
  | "concluida"
  | "falhou"
  | "cancelada";

/** B79 — one chain object for Automation and Agent executions alike. */
export interface ExecutionChain {
  readonly parentExecutionId?: Id;
  readonly depth: number;
  readonly visitedAgentIds: readonly Id[];
  readonly visitedAutomationObjects: ReadonlyArray<{ readonly automationId: Id; readonly objectId?: Id }>;
}

/** DO-AGE-09 — references to what composed the context, never the content. */
export interface ContextComposition {
  readonly anchor?: { readonly type: string; readonly id: Id; readonly name: string };
  readonly readRecordIds: readonly Id[];
  readonly fragmentRefs: ReadonlyArray<{ readonly documentId: Id; readonly version: number; readonly fragmentId: Id }>;
  readonly memoryItemIds: readonly Id[];
  readonly chatMessageIds: readonly Id[];
}

/** B98 — obligatory on every output based on Knowledge; never erased. */
export interface KnowledgeReference {
  readonly documentId: Id;
  readonly documentTitle: string;
  readonly version: number;
  readonly fragmentIds: readonly Id[];
  readonly collectionId: Id;
  readonly collectionName: string;
  /** Resolves with a marker when the cited record is gone (RN-CNH-22). */
  readonly marker?:
    | "documentoNaLixeira"
    | "documentoEliminado"
    | "versaoEliminadaPorRetencao"
    | "fragmentoRegenerado"
    | "semPermissao";
}

/** DO-AGE-18 — value object of the Execution, never of the Agent. */
export interface ExecutionCost {
  readonly modelUnits: number;
  readonly toolCalls: number;
  readonly childExecutions: number;
  readonly durationMs: number;
}

export interface AgentExecution {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly agentId: Id;
  readonly agentVersion: number;
  state: ExecutionState;
  readonly origin: "sessaoDeChat" | "acaoDireta" | "automacao" | "agente" | "caixaDeEntrada";
  readonly invokedBy: ActorRef;
  /** A9.3 — only a Member delegate enters the permission intersection. */
  readonly delegate?: ActorRef;
  readonly chain: ExecutionChain;
  readonly chatSessionId?: Id;
  readonly anchor?: { readonly type: string; readonly id: Id };
  readonly modelId: Id;
  readonly effectiveAutonomy: AutonomyLevel;
  /** B82 — writes are simulated, without effect and without memory. */
  readonly rehearsal: boolean;
  readonly input: string;
  steps: ExecutionStep[];
  output?: string;
  contextComposition: ContextComposition;
  knowledgeReferences: KnowledgeReference[];
  cost: ExecutionCost;
  terminationReason?: string;
  readonly startedAt: Instant;
  endedAt?: Instant;
}

/** B78 — internal 1:1 entity of the Agent, with eligibility by delegate. */
export interface AgentMemoryItem {
  readonly id: Id;
  content: string;
  readonly executionId: Id;
  /** Filled only when the execution delegate was a Member (B78). */
  readonly originDelegateMemberId?: Id;
  readonly referencedRecordIds: readonly Id[];
  readonly origin: "agente" | "membro";
  readonly createdAt: Instant;
  lastUsedAt?: Instant;
}

/** B74 — created by every behaviour change; valid from the next execution. */
export interface AgentVersion {
  readonly number: number;
  objective: string;
  instructions: string;
  /** B75 — one model or the `padraoDaPlataforma` marker. */
  modelId: Id | "padraoDaPlataforma";
  allowsModelOverride: boolean;
  allowedToolIds: string[];
  /** DO-AGE-02 — the granted skills by identity, at the time of the version. */
  grantedSkillIds: Id[];
  autonomy: AutonomyLevel;
  approvalPolicy: {
    approverMemberIds: Id[];
    approverTeamIds: Id[];
    /** B80 — platform default of 72 hours. */
    timeoutHours: number;
  };
  maxInvocationDepth?: number;
  memoryEnabled: boolean;
  /*
    Extensão do Construtor de Agentes (fora da ontologia v1.0): o que a tela
    configura e não tinha onde morar. Opcionais para as Versões anteriores.
  */
  /** Sugestões iniciais de conversa mostradas a quem abre o chat com o Agente. */
  icebreakers?: readonly string[];
  /** Fontes de conhecimento declaradas na tela, pelo rótulo. */
  knowledgeSources?: ReadonlyArray<{ readonly kind: "arquivo" | "url" | "base"; readonly label: string }>;
  responseFormat?: "texto" | "markdown" | "json" | "estruturado";
  accessPoints?: ReadonlyArray<"chat" | "whatsapp" | "api" | "webhook">;
  readonly by: ActorRef;
  readonly reason?: string;
  readonly at: Instant;
}

export interface Agent extends Omit<RecordBase, "lifecycle"> {
  lifecycle: AiLifecycle;
  lifecycleBeforeTrashAi?: AiLifecycle;
  name: string;
  description: string;
  /** A7 — exactly one Member, always human (B7). */
  ownerMemberId: Id;
  /** B76 — born with the Convidado role; never inherits from the owner. */
  roleId: Id;
  versions: AgentVersion[];
  memory: AgentMemoryItem[];
  memoryRetention: { readonly maxItems: number; readonly maxDays: number; readonly keepDelegated: boolean };
  costLimit?: { readonly units: number; readonly periodDays: number };
  provenance?: Provenance;
}

/** B83 — value object fixed at creation, immutable, never a Link. */
export interface ChatAnchor {
  readonly type:
    | "task"
    | "deal"
    | "contact"
    | "company"
    | "conversation"
    | "knowledgeDocument"
    | "space"
    | "folder"
    | "list";
  readonly id: Id;
  readonly nameAtTheTime: string;
}

export type ChatMessageRole = "usuario" | "assistente" | "sistema" | "ferramenta";

/** B84 — immutable; correction and regeneration create a new message. */
export interface ChatMessage {
  readonly id: Id;
  readonly order: number;
  readonly role: ChatMessageRole;
  readonly author: ActorRef;
  content: string;
  readonly fileIds: readonly Id[];
  /** Mandatory on `assistente` and `ferramenta`. */
  readonly executionId?: Id;
  readonly knowledgeReferences: KnowledgeReference[];
  readonly toolId?: string;
  readonly toolResult?: "concluida" | "negada" | "falhou" | "aguardandoAprovacao";
  readonly replacesMessageId?: Id;
  replaced?: boolean;
  complete?: boolean;
  readonly at: Instant;
}

/** B21 — personal; no role grants access to someone else's session (DO-CHT-09). */
/**
 * Pasta de Sessões de Chat. É do Membro, como a Sessão (DO-CHT-09): ninguém vê
 * a pasta de outro. Um nível só, sem pasta dentro de pasta — organização de
 * lista, não Estrutura.
 */
export interface ChatFolder {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly ownerMemberId: Id;
  name: string;
  readonly createdAt: Instant;
}

export interface ChatSession extends RecordBase {
  /** Owner equals creator and is immutable (INV-CHT-01). */
  readonly ownerMemberId: Id;
  /** Sem pasta é o normal: a Sessão nasce solta e é guardada depois. */
  folderId?: Id;
  title: string;
  titleEdited: boolean;
  /**
   * B83 — fixed at creation and immutable as a VALUE. B14 repoints the
   * reference on a merge by replacing the whole value object, never by
   * mutating its interior.
   */
  anchor?: ChatAnchor;
  mainAgentId?: Id;
  chosenModelId?: Id;
  /** A Habilidade que a pessoa escolheu para esta Sessão — o "plugin". */
  skillId?: Id;
  /** DO-CHT-14 — only restricts, never widens (INV-CHT-06). */
  toolRestriction: { readonly toolIds: readonly string[]; readonly effectClasses: readonly EffectClass[] };
  messages: ChatMessage[];
  sharedWithMemberIds: Id[];
  sharedWithTeamIds: Id[];
}

/** B89 — exactly one trigger per version, of one of four kinds. */
export type TriggerKind = "evento" | "agendamento" | "manual" | "condicaoTemporal";

export interface AutomationTrigger {
  readonly kind: TriggerKind;
  readonly eventType?: string;
  readonly eventSubtype?: string;
  readonly schedule?: {
    readonly frequency: "minutos" | "horas" | "dias" | "semanas" | "meses";
    readonly interval: number;
    readonly weekDays?: readonly number[];
    readonly time?: string;
  };
  readonly temporalPredicate?: string;
}

export interface AutomationCondition {
  readonly kind: "atributo" | "valorDeCampo" | "pertencimento" | "temporal" | "hibrida";
  readonly expression: string;
  /** B90 — a hybrid condition invokes an Agent and yields a child execution. */
  readonly agentId?: Id;
  readonly skillId?: Id;
  readonly defaultOnFailure?: string;
}

/** B91 — a write action is always a tool; a control action never is. */
export interface AutomationAction {
  readonly order: number;
  readonly kind: "escrita" | "controle";
  readonly toolId?: string;
  readonly controlKind?: "ramificar" | "invocarAgente" | "solicitarAprovacao" | "aguardar" | "notificar" | "encerrar";
  readonly params: string;
  readonly targetExpression?: string;
  /** Only on `invocarAgente` (B80). */
  readonly agentId?: Id;
  readonly skillId?: Id;
  readonly maxAutonomy?: AutonomyLevel;
  readonly approverMemberId?: Id;
  readonly approverTeamId?: Id;
  readonly timeoutHours?: number;
}

export interface AutomationVersion {
  readonly number: number;
  state: VersionState;
  trigger?: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  errorPolicy: {
    readonly onActionFailure: "interromper" | "continuar";
    readonly retries: number;
  };
  maxAutonomy?: AutonomyLevel;
  publishedBy?: Id;
  readonly createdAt: Instant;
  publishedAt?: Instant;
}

/** B41 — the scope is immutable and delimits the trigger, never the action. */
export type AutomationScopeType =
  | "workspace"
  | "space"
  | "folder"
  | "list"
  | "funnel"
  | "inbox"
  | "queue";

export interface AutomationExecution {
  readonly id: Id;
  readonly workspaceId: Id;
  readonly automationId: Id;
  readonly automationVersion: number;
  state: ExecutionState;
  readonly triggerKind: TriggerKind;
  readonly objectType?: string;
  readonly objectId?: Id;
  readonly objectName?: string;
  readonly invokedBy: ActorRef;
  readonly delegate?: ActorRef;
  readonly chain: ExecutionChain;
  steps: ExecutionStep[];
  childAgentExecutionIds: Id[];
  terminationReason?: string;
  cost: ExecutionCost;
  readonly startedAt: Instant;
  endedAt?: Instant;
}

/** B88 — subject of permission with the owner as ceiling. */
export interface Automation extends Omit<RecordBase, "lifecycle"> {
  lifecycle: AiLifecycle;
  lifecycleBeforeTrashAi?: AiLifecycle;
  name: string;
  description: string;
  readonly scopeType: AutomationScopeType;
  readonly scopeId: Id;
  ownerMemberId: Id;
  roleId?: Id;
  /** DO-AUT-11 — default false; never reacts to its own events. */
  reactsToAutomationEvents: boolean;
  versions: AutomationVersion[];
  provenance?: Provenance;
}

/** B96 — the source of a collection; `envioManual` is implicit and not removable. */
export interface KnowledgeSource {
  readonly id: Id;
  readonly kind: "envioManual" | "url" | "integracao";
  readonly name: string;
  config?: string;
  updatePolicy?: { readonly kind: "manual" | "periodica"; readonly intervalHours?: number };
  configuredByMemberId?: Id;
  state: "ativo" | "pausado" | "comErro";
  lastUpdateAt?: Instant;
  lastUpdateResult?: string;
  originVersionMark?: string;
}

/** B97 — derived, regenerable, created only by the System. */
export interface Fragment {
  readonly id: Id;
  readonly position: { readonly order: number; readonly locator: string };
  readonly derivedContent: string;
}

/** B98 — immutable content per version; only the current one is consultable. */
export interface DocumentVersion {
  readonly number: number;
  readonly content: { readonly text?: string; readonly fileId?: Id };
  readonly derivedRepresentations: ReadonlyArray<{
    readonly kind: "transcricao" | "descricao" | "extracao";
    readonly text: string;
    readonly by: ActorRef;
    readonly at: Instant;
  }>;
  processing: "pendente" | "processado" | "comErro";
  readonly origin: { readonly kind: "envio" | "edicao" | "atualizacao" | "restauracao"; readonly by: ActorRef; readonly at: Instant };
  fragments: Fragment[];
  readonly createdAt: Instant;
  supersededAt?: Instant;
}

export interface KnowledgeDocument extends RecordBase {
  readonly collectionId: Id;
  readonly sourceId: Id;
  title: string;
  readonly contentType: "texto" | "imagem" | "audio" | "video" | "pdf" | "arquivoEstruturado" | "paginaWeb";
  versions: DocumentVersion[];
  currentVersion: number;
  absentFromSourceSince?: Instant;
  metadata: {
    originalAuthor?: string;
    language?: string;
    contentDate?: string;
    labels: string[];
    summary?: string;
  };
  /** INV-CNH-05 — obligatory, never emptied. */
  readonly provenance: Provenance & { readonly sourceKind: string; readonly specificOrigin: string };
  comments: Comment[];
  attachments: Attachment[];
}

/** B97 — the only permission Resource of the knowledge layer. */
export interface Collection extends RecordBase {
  name: string;
  description: string;
  ownerMemberId: Id;
  isPrivate: boolean;
  sources: KnowledgeSource[];
  versionRetention: { readonly maxSuperseded: number; readonly maxDays: number };
}

/** B97 — an agent's access to a collection lives on the collection. */
export interface CollectionGrant {
  readonly id: Id;
  readonly collectionId: Id;
  readonly agentId: Id;
  readonly actions: ReadonlyArray<"ver" | "criar" | "editar">;
  readonly grantedBy: Id;
  readonly grantedAt: Instant;
}
