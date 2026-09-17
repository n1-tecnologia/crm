/**
 * Shape of the in-memory data. One collection per entity that has identity;
 * components live inside their aggregate root, as the ontology defines them.
 */

import type {
  ActivityRecord,
  Agent,
  AgentExecution,
  ApprovalRequest,
  Automation,
  AutomationExecution,
  CatalogItem,
  Channel,
  ChatFolder,
  ChatSession,
  Collection,
  CollectionGrant,
  Comunidade,
  Company,
  CompanyCompanyLink,
  Contact,
  ContactCompanyLink,
  Conversation,
  Deal,
  DistinctFromLink,
  FieldDefinition,
  Flow,
  Folder,
  Funnel,
  Grant,
  Grupo,
  Id,
  Inbox,
  Integration,
  KnowledgeDocument,
  Link,
  LinkDeCaptacao,
  List,
  Member,
  Model,
  Panel,
  Queue,
  Role,
  Skill,
  SkillGrant,
  Space,
  Tag,
  Task,
  TaskType,
  Team,
  Template,
  Tool,
  View,
  Goal,
  Form,
  Workspace,
  WorkspaceFile,
} from "./types";

export interface DataState {
  /** Global platform entities — referenced, never owned (A1.3). */
  readonly models: Model[];
  readonly tools: Tool[];

  workspace: Workspace;
  members: Member[];
  teams: Team[];
  roles: Role[];
  integrations: Integration[];
  grants: Grant[];
  templates: Template[];
  catalog: CatalogItem[];
  tags: Tag[];
  files: WorkspaceFile[];
  fieldDefinitions: FieldDefinition[];
  taskTypes: TaskType[];
  views: View[];
  goals: Goal[];
  forms: Form[];

  spaces: Space[];
  folders: Folder[];
  lists: List[];
  tasks: Task[];

  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
  funnels: Funnel[];
  contactCompanyLinks: ContactCompanyLink[];
  companyCompanyLinks: CompanyCompanyLink[];
  distinctFromLinks: DistinctFromLink[];

  inbox: Inbox;
  channels: Channel[];
  queues: Queue[];
  conversations: Conversation[];

  chatFolders: ChatFolder[];
  chatSessions: ChatSession[];
  agents: Agent[];
  agentExecutions: AgentExecution[];
  skills: Skill[];
  skillGrants: SkillGrant[];
  automations: Automation[];
  automationExecutions: AutomationExecution[];
  approvals: ApprovalRequest[];
  collections: Collection[];
  collectionGrants: CollectionGrant[];
  documents: KnowledgeDocument[];

  panels: Panel[];

  /** Ativos de Canal (docs 23–25): Ferramentas do CRM. */
  grupos: Grupo[];
  comunidades: Comunidade[];
  linksDeCaptacao: LinkDeCaptacao[];
  flows: Flow[];

  links: Link[];
  activity: ActivityRecord[];
}

/**
 * Every operation answers with a typed result; errors are pt-BR sentences.
 * `id` é o registro que a operação criou, alterou ou moveu: a tela acende essa
 * peça por `--dur-realce` (`useRecente`). Opcional — sem ele não há realce.
 */
export type OperationResult<T = void> =
  | { readonly ok: true; readonly value: T; readonly id?: Id }
  | { readonly ok: false; readonly error: string; readonly field?: string };

export const ok = <T>(value: T, id?: Id): OperationResult<T> => (id === undefined ? { ok: true, value } : { ok: true, value, id });
export const fail = <T = never>(error: string, field?: string): OperationResult<T> =>
  field === undefined ? { ok: false, error } : { ok: false, error, field };

/** Session simulated by choosing a Member (`/entrar`); nothing is persisted. */
export interface Session {
  memberId: Id;
}
