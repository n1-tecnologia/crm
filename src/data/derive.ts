/**
 * Derived readings. Nothing here is ever stored: every function recomputes from
 * the recorded state, as the ontology requires (B36, B45, B100, RN-CRM-16).
 */

import { ACTOR_KIND_LABEL } from "@/features/shell/format";
import type { DataState } from "./state";
import type {
  ActivityRecord,
  ActorRef,
  Comment,
  Contact,
  Conversation,
  Deal,
  EffectiveListConfig,
  EnabledFeatures,
  Folder,
  Goal,
  Grant,
  Id,
  Lifecycle,
  List,
  Space,
  StatusCategory,
  StatusDefinition,
  StatusSet,
  Task,
  TaskDate,
} from "./types";

const RESTRICTION: Record<Lifecycle, number> = { ativo: 0, arquivado: 1, naLixeira: 2 };

const mostRestrictive = (a: Lifecycle, b: Lifecycle): Lifecycle =>
  RESTRICTION[a] >= RESTRICTION[b] ? a : b;

export type PathNode = { type: "space" | "folder" | "list"; id: Id; name: string };

/** B25 — the chain of containers of any node, from its Space down to the node itself. */
export function containerPath(state: DataState, type: PathNode["type"], id: Id): PathNode[] {
  const chain: PathNode[] = [];
  let parentType: "space" | "folder" | undefined;
  let parentId: Id | undefined;
  if (type === "list") {
    const list = state.lists.find((l) => l.id === id);
    if (!list) return [];
    chain.push({ type: "list", id: list.id, name: list.name });
    parentType = list.parentType;
    parentId = list.parentId;
  } else if (type === "folder") {
    parentType = "folder";
    parentId = id;
  } else {
    const space = state.spaces.find((s) => s.id === id);
    return space ? [{ type: "space", id: space.id, name: space.name }] : [];
  }
  while (parentType === "folder") {
    const folder: Folder | undefined = state.folders.find((f) => f.id === parentId);
    if (!folder) break;
    chain.unshift({ type: "folder", id: folder.id, name: folder.name });
    parentType = folder.parentType;
    parentId = folder.parentId;
  }
  const space: Space | undefined = state.spaces.find((s) => s.id === parentId);
  if (space) chain.unshift({ type: "space", id: space.id, name: space.name });
  return chain;
}

/** B25 — the chain of containers of a List, from its Space down. */
export function listPath(state: DataState, listId: Id): PathNode[] {
  return containerPath(state, "list", listId);
}

/**
 * B36 — the effective state is the most restrictive between the own state and
 * the ancestors'. The cascade never rewrites a descendant's own state.
 */
export function effectiveLifecycleOfList(state: DataState, listId: Id): Lifecycle {
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return "naLixeira";
  let effective: Lifecycle = list.lifecycle;
  let parentType = list.parentType;
  let parentId = list.parentId;
  while (parentType === "folder") {
    const folder = state.folders.find((f) => f.id === parentId);
    if (!folder) break;
    effective = mostRestrictive(effective, folder.lifecycle);
    parentType = folder.parentType;
    parentId = folder.parentId;
  }
  const space = state.spaces.find((s) => s.id === parentId);
  if (space) effective = mostRestrictive(effective, space.lifecycle);
  return effective;
}

/** B36 — a Task follows its List and, for a Subtask, its parent Task too. */
export function effectiveLifecycleOfTask(state: DataState, taskId: Id): Lifecycle {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return "naLixeira";
  let effective = mostRestrictive(task.lifecycle, effectiveLifecycleOfList(state, task.listId));
  let parentId = task.parentTaskId;
  const seen = new Set<Id>([task.id]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent: Task | undefined = state.tasks.find((t) => t.id === parentId);
    if (!parent) break;
    effective = mostRestrictive(effective, parent.lifecycle);
    parentId = parent.parentTaskId;
  }
  return effective;
}

const DEFAULT_FEATURES: EnabledFeatures = {
  prioridade: true,
  registroDeTempo: true,
  estimativa: true,
  dependencias: true,
  recorrencia: true,
  subtarefas: true,
  checklists: true,
  exigirSubtarefasConcluidas: false,
  exigirChecklistsConcluidos: false,
  datasDeSubtarefasContidas: false,
  impedirConclusaoDeTarefaBloqueada: false,
  compartilhamentoPublico: true,
};

/**
 * B45 — the effective Status Set is resolved by the path at every query, never
 * stored: the List's own if `sobrescrito`, otherwise the nearest ancestor that
 * defines one (the Space always defines one).
 */
export function effectiveListConfig(state: DataState, listId: Id): EffectiveListConfig | null {
  return effectiveContainerConfig(state, "list", listId);
}

/**
 * The same resolution seen from any node of the path: what a List created
 * right here would consume. A Space or Folder settings screen reads this
 * instead of borrowing the first List below it.
 */
export function effectiveContainerConfig(state: DataState, type: PathNode["type"], id: Id): EffectiveListConfig | null {
  const path = containerPath(state, type, id);
  const self = path.at(-1);
  if (!self) return null;

  let statusSet: StatusSet | undefined;
  let definedAt: PathNode = path[0] ?? self;
  // The nearest level that overrides wins; walk from the node up to the Space.
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const node = path[i];
    if (!node) continue;
    const container = containerOf(state, node);
    if (container?.statusSet) {
      statusSet = container.statusSet;
      definedAt = node;
      break;
    }
  }
  if (!statusSet) return null;

  // B25 — field definitions, task types and automations accumulate along the path.
  const pathIds = new Set(path.map((n) => n.id));
  const fieldDefinitionIds = state.fieldDefinitions
    .filter((d) => d.target === "task" && d.definedAtId !== undefined && pathIds.has(d.definedAtId))
    .filter((d) => d.lifecycle === "ativo")
    .map((d) => d.id);
  const taskTypeIds = state.taskTypes.filter((t) => pathIds.has(t.definedAtId)).map((t) => t.id);

  // B25 — features substitute: the nearest level that defines one wins, per feature.
  const features: EnabledFeatures = { ...DEFAULT_FEATURES };
  for (const node of path) {
    const container = containerOf(state, node);
    if (container?.features) Object.assign(features, container.features);
  }

  return { statusSet, statusSetDefinedAt: definedAt, fieldDefinitionIds, taskTypeIds, features, path };
}

function containerOf(state: DataState, node: PathNode): Space | Folder | List | undefined {
  return node.type === "list"
    ? state.lists.find((l) => l.id === node.id)
    : node.type === "folder"
      ? state.folders.find((f) => f.id === node.id)
      : state.spaces.find((s) => s.id === node.id);
}

export function statusDefinition(
  state: DataState,
  listId: Id,
  statusId: Id,
): StatusDefinition | undefined {
  return effectiveListConfig(state, listId)?.statusSet.definitions.find((d) => d.id === statusId);
}

export function statusCategory(state: DataState, task: Task): StatusCategory | undefined {
  return statusDefinition(state, task.listId, task.statusId)?.category;
}

const TERMINAL: readonly StatusCategory[] = ["concluido", "fechado"];

export const isTerminalCategory = (category: StatusCategory | undefined): boolean =>
  category !== undefined && TERMINAL.includes(category);

/** Glossário — derived, never stored. */
export function isOverdue(state: DataState, task: Task, now: Date): boolean {
  if (!task.dueDate) return false;
  if (isTerminalCategory(statusCategory(state, task))) return false;
  if (task.dueDate.form === "civilDay") {
    const nextDay = new Date(`${task.dueDate.value}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    return now >= nextDay;
  }
  return now >= new Date(task.dueDate.value);
}

/** Glossário — `aguarda` does not block; an archived task does not block either. */
export function isBlocked(state: DataState, task: Task): boolean {
  return task.dependencies.some((dependency) => {
    if (dependency.kind !== "eBloqueadaPor") return false;
    const source = state.tasks.find((t) => t.id === dependency.taskId);
    if (!source) return false;
    if (effectiveLifecycleOfTask(state, source.id) !== "ativo") return false;
    return !isTerminalCategory(statusCategory(state, source));
  });
}

/** DO-STA-06 — only direct subtasks that are effectively `ativo` count. */
export function subtaskProgress(state: DataState, taskId: Id): { done: number; total: number } | null {
  const children = state.tasks.filter(
    (t) => t.parentTaskId === taskId && effectiveLifecycleOfTask(state, t.id) === "ativo",
  );
  if (children.length === 0) return null;
  const done = children.filter((c) => isTerminalCategory(statusCategory(state, c))).length;
  return { done, total: children.length };
}

/** B48 — countable item = first-level item that was not converted. */
export function checklistProgress(task: Task): { done: number; total: number } | null {
  const countable = task.checklists.flatMap((c) =>
    c.items.filter((i) => i.parentItemId === undefined && i.converted === undefined),
  );
  if (countable.length === 0) return null;
  return { done: countable.filter((i) => i.done).length, total: countable.length };
}

/** B1 — length of the parent chain up to the root task. */
export function taskLevel(state: DataState, task: Task): number {
  let level = 0;
  let parentId = task.parentTaskId;
  const seen = new Set<Id>([task.id]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    level += 1;
    parentId = state.tasks.find((t) => t.id === parentId)?.parentTaskId;
  }
  return level;
}

/** Documento 10, 6 — derived, never stored. */
export function contactDisplayName(contact: Contact): string {
  const full = `${contact.firstName} ${contact.lastName}`.trim();
  if (full) return full;
  const principal = contact.identifiers.find((i) => i.principal) ?? contact.identifiers[0];
  if (principal?.channelLabel) return principal.channelLabel;
  if (principal?.displayValue) return principal.displayValue;
  return "Contato sem nome";
}

/** DO-CON-04 — the job title belongs to the principal, current link. */
export function contactDisplayRole(state: DataState, contactId: Id): string {
  const link = state.contactCompanyLinks.find(
    (l) => l.contactId === contactId && l.principalForContact && l.end === undefined,
  );
  return link?.role ?? "";
}

export function principalCompanyId(state: DataState, contactId: Id): Id | undefined {
  return state.contactCompanyLinks.find(
    (l) => l.contactId === contactId && l.principalForContact && l.end === undefined,
  )?.companyId;
}

/** DO-NEG-05 — overridden if present, otherwise the stage default; 100/0 when closed. */
export function effectiveProbability(state: DataState, deal: Deal): number {
  if (deal.situation === "ganho") return 100;
  if (deal.situation === "perdido") return 0;
  if (deal.overriddenProbability !== undefined) return deal.overriddenProbability;
  const funnel = state.funnels.find((f) => f.id === deal.funnelId);
  return funnel?.stages.find((s) => s.id === deal.stageId)?.defaultProbability ?? 0;
}

/** DO-NEG-04 — amount × effective probability, in the value's currency. */
export function weightedValue(state: DataState, deal: Deal): number | null {
  if (!deal.value) return null;
  return (deal.value.amount * effectiveProbability(state, deal)) / 100;
}

/** RN-CXE-19 — derived: last received message + the channel type window. */
export function responseWindowOpenUntil(
  state: DataState,
  conversation: Conversation,
  capabilities: (type: string) => { responseWindowHours?: number },
): Date | null {
  const channel = state.channels.find((c) => c.id === conversation.channelId);
  if (!channel) return null;
  const hours = capabilities(channel.channelType).responseWindowHours;
  if (hours === undefined) return null;
  const lastReceived = [...conversation.messages]
    .filter((m) => m.direction === "recebida")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
  if (!lastReceived) return null;
  return new Date(new Date(lastReceived.createdAt).getTime() + hours * 3_600_000);
}

/** Documento 10, 6 — most recent message of any conversation of the contact. */
export function lastInteraction(state: DataState, contactId: Id): string | null {
  let latest: string | null = null;
  for (const conversation of state.conversations) {
    if (conversation.contactId !== contactId) continue;
    for (const message of conversation.messages) {
      if (message.direction === "interna") continue;
      if (latest === null || message.createdAt > latest) latest = message.createdAt;
    }
  }
  return latest;
}

/** B79 — full chain, from the root execution down to this one. */
export function executionChainOf(state: DataState, executionId: Id): Array<{ kind: string; id: Id; name: string }> {
  const chain: Array<{ kind: string; id: Id; name: string }> = [];
  let current: string | undefined = executionId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const agentExecution = state.agentExecutions.find((e) => e.id === current);
    if (agentExecution) {
      const agent = state.agents.find((a) => a.id === agentExecution.agentId);
      chain.unshift({ kind: "agente", id: agentExecution.id, name: agent?.name ?? "Agente eliminado" });
      current = agentExecution.chain.parentExecutionId;
      continue;
    }
    const automationExecution = state.automationExecutions.find((e) => e.id === current);
    if (automationExecution) {
      const automation = state.automations.find((a) => a.id === automationExecution.automationId);
      chain.unshift({
        kind: "automacao",
        id: automationExecution.id,
        name: automation?.name ?? "Automação eliminada",
      });
      current = automationExecution.chain.parentExecutionId;
      continue;
    }
    break;
  }
  return chain;
}

/** Helpers used across screens. */
export const listsOf = (state: DataState, parentId: Id): List[] =>
  state.lists.filter((l) => l.parentId === parentId);

export const foldersOf = (state: DataState, parentId: Id): Folder[] =>
  state.folders.filter((f) => f.parentId === parentId);

export const rootTasksOf = (state: DataState, listId: Id): Task[] =>
  state.tasks.filter((t) => t.listId === listId && t.parentTaskId === undefined);

export const subtasksOf = (state: DataState, taskId: Id): Task[] =>
  state.tasks.filter((t) => t.parentTaskId === taskId);

/**
 * RN-CON-16 — a marketing template may only be sent to a Contact with a current
 * consent for that purpose on that Channel. Derived here so the composer and
 * `sendMessage` read the SAME rule: a screen that decides this on its own drifts
 * from the operation and starts enabling a button that fails on click.
 */
export function marketingConsentMissing(
  state: DataState,
  conversation: Conversation,
  templateProviderId: string | undefined,
): boolean {
  if (!templateProviderId) return false;
  const channel = state.channels.find((c) => c.id === conversation.channelId);
  const template = channel?.messageTemplates.find((t) => t.providerId === templateProviderId);
  if (!channel || template?.category !== "marketing") return false;
  const contact = state.contacts.find((c) => c.id === conversation.contactId);
  if (!contact) return false;

  const purpose = state.catalog.find(
    (c) => c.kind === "finalidadeConsentimento" && c.name.toLowerCase() === "marketing",
  );
  const current = [...contact.consents]
    .filter(
      (c) =>
        c.purposeId === purpose?.id &&
        (c.channelType === "todos" || c.channelType === channel.channelType),
    )
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1);
  return current?.decision !== "concedido";
}

/**
 * PADROES §10 — why a terminal Status is unavailable for this Task, computed
 * from what the screen already shows. `undefined` means it is available.
 *
 * Derived here, not in a screen: the Task appears both as a full page and as a
 * side panel over a List, and two copies of this reasoning would drift into two
 * different answers for the same Task.
 */
export function terminalStatusBlockReason(state: DataState, task: Task): string | undefined {
  const config = effectiveListConfig(state, task.listId);
  if (!config) return undefined;

  const openChecklistItems = task.checklists.reduce(
    (total, checklist) =>
      total +
      checklist.items.filter(
        (item) => item.parentItemId === undefined && item.converted === undefined && !item.done,
      ).length,
    0,
  );
  if (config.features.exigirChecklistsConcluidos && openChecklistItems > 0) {
    return openChecklistItems === 1
      ? "1 item de checklist aberto nesta Tarefa."
      : `${openChecklistItems} itens de checklist abertos nesta Tarefa.`;
  }

  const openSubtasks = state.tasks.filter(
    (child) =>
      child.parentTaskId === task.id &&
      effectiveLifecycleOfTask(state, child.id) === "ativo" &&
      !isTerminalCategory(statusCategory(state, child)),
  ).length;
  if (config.features.exigirSubtarefasConcluidas && openSubtasks > 0) {
    return openSubtasks === 1 ? "1 Subtarefa aberta." : `${openSubtasks} Subtarefas abertas.`;
  }

  if (config.features.impedirConclusaoDeTarefaBloqueada && isBlocked(state, task)) {
    return "Esta Tarefa está bloqueada por uma Dependência e a Lista impede concluí-la.";
  }
  return undefined;
}

/**
 * B59 — a Stage Requirement in words. Lives here because the Funil screen and
 * the Negócio screen both show it, and the raw `contatoObrigatorio` leaking
 * into one of them was exactly the drift a second copy produces.
 */
export function requirementLabel(
  state: DataState,
  kind: string,
  fieldDefinitionId?: Id,
): string {
  if (kind === "campoPreenchido") {
    const definition = state.fieldDefinitions.find((d) => d.id === fieldDefinitionId);
    return `campo “${definition?.name ?? fieldDefinitionId}” preenchido`;
  }
  const labels: Record<string, string> = {
    contatoObrigatorio: "ao menos um Contato vinculado",
    empresaObrigatoria: "uma Empresa vinculada",
    valorObrigatorio: "valor preenchido",
    proprietarioObrigatorio: "Proprietário definido",
  };
  return labels[kind] ?? kind;
}

/**
 * B38 / B70 — o que um Membro alcança num Recurso. Um Convidado só vê o que lhe
 * foi concedido; os demais Papéis veem o que não é privado sem concessão.
 *
 * Vive aqui porque a barra lateral e os Painéis precisam da MESMA resposta: dois
 * cálculos separados divergiriam, e a divergência apareceria como um número que
 * a navegação não explica.
 */
export function memberSeesResource(state: DataState, memberId: Id, resourceId: Id): boolean {
  const granted = state.grants.some(
    (grant) =>
      grant.resourceId === resourceId &&
      ((grant.subjectKind === "member" && grant.subjectId === memberId) ||
        (grant.subjectKind === "team" &&
          state.teams.some((team) => team.id === grant.subjectId && team.memberIds.includes(memberId)))),
  );
  if (granted) return true;

  // B38a — um contêiner privado sem concessão não existe para ninguém, nem para
  // o Proprietário do Espaço de Trabalho. A única entrada é o ato de governança.
  const container =
    state.spaces.find((space) => space.id === resourceId) ??
    state.folders.find((folder) => folder.id === resourceId) ??
    state.lists.find((list) => list.id === resourceId);
  if (container && "isPrivate" in container && container.isPrivate) return false;

  const member = state.members.find((m) => m.id === memberId);
  const base = state.roles.find((r) => r.id === member?.roleId)?.base;
  // B70 — um Convidado não tem nada por Papel: só o que lhe foi concedido.
  return base !== "convidado";
}

export type WidgetReading =
  | { readonly kind: "semAcesso" }
  | { readonly kind: "texto"; readonly content: string }
  | { readonly kind: "numero"; readonly value: number; readonly label: string }
  /** RN-PAI-13 — o Painel nunca converte: uma série por moeda, sempre rotulada. */
  | {
      readonly kind: "moeda";
      readonly label: string;
      readonly byCurrency: ReadonlyArray<{ readonly currency: string; readonly amount: number }>;
    }
  | {
      readonly kind: "serie";
      readonly label: string;
      /** Só em métrica de dinheiro: a série inteira está nesta moeda. */
      readonly currency?: string;
      readonly rows: ReadonlyArray<{ readonly label: string; readonly value: number }>;
      readonly total: number;
      readonly shown: number;
    };

/**
 * Documento 21 — o Widget lê o dado no momento da consulta e SEMPRE pelas
 * permissões de quem olha (RN-PAI-15): a Âncora não concede acesso, e um Widget
 * cuja Fonte o visualizador não alcança diz isso em vez de mostrar zero. Zero e
 * "sem acesso" são respostas diferentes, e confundi-las é mentir com número.
 */
export function widgetReading(
  state: DataState,
  widget: {
    readonly viewType: string;
    readonly content?: string;
    readonly dataSource?: {
      readonly target: string;
      readonly scopeType: string;
      readonly scopeIds: readonly Id[];
    };
    readonly metrics: ReadonlyArray<{ readonly aggregation: string; readonly attribute: string; readonly label: string }>;
    readonly dimensions: ReadonlyArray<{ readonly attribute: string; readonly label: string; readonly timeGranularity?: string }>;
    readonly fixedFilters?: ReadonlyArray<{
      readonly attribute: string;
      readonly operator: string;
      readonly value: string;
      readonly label: string;
    }>;
    readonly limit?: number;
  },
  memberId: Id,
  now: Date,
): WidgetReading {
  if (widget.viewType === "texto") {
    return { kind: "texto", content: widget.content ?? "" };
  }

  const source = widget.dataSource;
  const metric = widget.metrics[0];
  if (!source || !metric) return { kind: "texto", content: "Widget sem Fonte de dados." };

  const scopeVisible = source.scopeIds.every(
    (scopeId) => scopeId === state.workspace.id || memberSeesResource(state, memberId, scopeId),
  );
  if (!scopeVisible) return { kind: "semAcesso" };

  const todos = recordsOfTarget(state, source.target, source.scopeType, source.scopeIds);

  /*
   * Documento 21, 7.5 — o Filtro fixo é gravado e vale em toda leitura. Sem
   * ele, um Widget rotulado "em prospecção agora" conta também o que foi
   * perdido: o número fica certo para a máquina e mentiroso para quem lê.
   *
   * O filtro compara contra o MESMO texto que a dimensão mostraria, para o
   * valor gravado ser o que a pessoa leu na tela e não um código interno.
   */
  const filtros = widget.fixedFilters ?? [];
  const records =
    filtros.length === 0
      ? todos
      : todos.filter((record) =>
          filtros.every((filtro) => {
            const lido = dimensionLabel(state, record, filtro.attribute, undefined) ?? "";
            const alvo = filtro.value.toLocaleLowerCase("pt-BR");
            const atual = lido.toLocaleLowerCase("pt-BR");
            return filtro.operator === "diferenteDe" ? atual !== alvo : atual === alvo;
          }),
        );
  const dimension = widget.dimensions[0];

  // Somar dinheiro é somar por moeda: RN-PAI-13 proíbe consolidar moedas.
  if (metric.aggregation === "soma" && metric.attribute === "value") {
    const byCurrency = new Map<string, number>();
    for (const record of records) {
      if (!("value" in record) || !record.value) continue;
      byCurrency.set(
        record.value.currency,
        (byCurrency.get(record.value.currency) ?? 0) + record.value.amount,
      );
    }
    if (!dimension) {
      return {
        kind: "moeda",
        label: metric.label,
        byCurrency: [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount })),
      };
    }
    // Com dimensão a série é uma barra por categoria, e uma barra não cabe duas
    // moedas: RN-PAI-13 recusa o Widget em vez de somar reais com dólares.
    if (byCurrency.size > 1) {
      return {
        kind: "texto",
        content: `Este recorte tem ${byCurrency.size} moedas. Somar dinheiro de moedas diferentes numa mesma barra é proibido: filtre por moeda.`,
      };
    }
  }

  const valueOf = (record: TargetRecord): number => {
    if (metric.aggregation === "contagem") {
      if (metric.attribute === "overdue") {
        return "statusId" in record && isOverdue(state, record as Task, now) ? 1 : 0;
      }
      return 1;
    }
    if (metric.attribute === "value") return "value" in record ? (record.value?.amount ?? 0) : 0;
    if (metric.attribute === "estimate") return "estimate" in record ? (record.estimate ?? 0) : 0;
    return 0;
  };

  if (!dimension) {
    const value = records.reduce((sum, record) => sum + valueOf(record), 0);
    return { kind: "numero", value, label: metric.label };
  }

  const buckets = new Map<string, number>();
  for (const record of records) {
    // Por Responsável: uma soma (estimativa) se divide entre os Membros; uma contagem conta a Tarefa para cada um.
    if (dimension.attribute === "assigneeMemberId" && "assignees" in record) {
      const membros = record.assignees.filter((a) => a.kind === "member");
      for (const a of membros) {
        const key = state.members.find((m) => m.id === a.id)?.displayName ?? a.id;
        buckets.set(key, (buckets.get(key) ?? 0) + (metric.aggregation === "soma" ? valueOf(record) / membros.length : valueOf(record)));
      }
      continue;
    }
    const key = dimensionLabel(state, record, dimension.attribute, dimension.timeGranularity);
    if (key === undefined) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + valueOf(record));
  }

  const all = [...buckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const limit = widget.limit ?? 12;
  const currency =
    metric.aggregation === "soma" && metric.attribute === "value"
      ? records.find((record): record is Deal => "value" in record && record.value !== undefined)
          ?.value?.currency
      : undefined;
  return {
    kind: "serie",
    label: metric.label,
    ...(currency ? { currency } : {}),
    rows: all.slice(0, limit),
    total: all.length,
    shown: Math.min(limit, all.length),
  };
}

type TargetRecord = Deal | Conversation | Task | Contact;

function recordsOfTarget(
  state: DataState,
  target: string,
  scopeType: string,
  scopeIds: readonly Id[],
): readonly TargetRecord[] {
  const inScope = (value: Id | undefined): boolean =>
    scopeType === "workspace" || (value !== undefined && scopeIds.includes(value));

  switch (target) {
    case "deal":
      return state.deals.filter((deal) => deal.lifecycle === "ativo" && inScope(deal.funnelId));
    case "conversation":
      return state.conversations.filter(
        (conversation) =>
          conversation.lifecycle === "ativo" &&
          (scopeType === "inbox" || scopeType === "workspace" || inScope(conversation.queueId)),
      );
    case "task":
      return state.tasks.filter((task) => {
        if (effectiveLifecycleOfTask(state, task.id) !== "ativo") return false;
        if (scopeType === "workspace") return true;
        if (scopeType === "list") return scopeIds.includes(task.listId);
        const path = listPath(state, task.listId);
        return path.some((node) => scopeIds.includes(node.id));
      });
    case "contact":
      return state.contacts.filter((contact) => contact.lifecycle === "ativo");
    default:
      return [];
  }
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

function dimensionLabel(
  state: DataState,
  record: TargetRecord,
  attribute: string,
  granularity: string | undefined,
): string | undefined {
  if (attribute === "stageId" && "stageId" in record) {
    const funnel = state.funnels.find((f) => f.id === record.funnelId);
    return funnel?.stages.find((s) => s.id === record.stageId)?.name;
  }
  if (attribute === "state" && "state" in record) return capitalize(record.state);
  if (attribute === "statusCategory" && "statusId" in record) {
    return statusCategory(state, record as Task);
  }
  if (attribute === "lossReasonId" && "lossReasonId" in record) {
    if (!record.lossReasonId) return undefined;
    return state.catalog.find((c) => c.id === record.lossReasonId)?.name;
  }
  if (attribute === "originId" && "originId" in record) {
    if (!record.originId) return undefined;
    return state.catalog.find((c) => c.id === record.originId)?.name;
  }
  if (attribute === "situation" && "situation" in record) return capitalize(record.situation);
  if (attribute === "ownerMemberId" && "ownerMemberId" in record) {
    return state.members.find((m) => m.id === record.ownerMemberId)?.displayName;
  }
  if (attribute === "closedAt" && "closedAt" in record) {
    if (!record.closedAt) return undefined;
    const date = new Date(record.closedAt);
    if (granularity === "ano") return String(date.getFullYear());
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  }
  return undefined;
}

/**
 * RN-CON-10 — Suspeita de Duplicidade é CALCULADA, nunca gravada: par de
 * Contatos não `mesclado`, motivo e momento. Força `certa` não existe — dois
 * Contatos com o mesmo Identificador são impossíveis (INV-CON-02) e a colisão é
 * interceptada na criação (RN-CON-11).
 *
 * O Vínculo `distinto de` (DO-CON-14) suprime o par: é a única persistência
 * associada, e existe justamente porque a suspeita se repetiria para sempre.
 *
 * Um Contato `arquivado` sai do cálculo (documento 10, tabela de transições).
 */
export function duplicateSuspicions(
  state: DataState,
): ReadonlyArray<{ readonly a: Contact; readonly b: Contact; readonly reasons: readonly string[] }> {
  const eligible = state.contacts.filter((contact) => contact.lifecycle === "ativo");
  const suppressed = new Set(
    state.distinctFromLinks.flatMap((link) => [
      `${link.contactAId}|${link.contactBId}`,
      `${link.contactBId}|${link.contactAId}`,
    ]),
  );

  const normalize = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const digits = (value: string): string => value.replace(/\D/g, "");

  const found: Array<{ a: Contact; b: Contact; reasons: string[] }> = [];
  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const a = eligible[i];
      const b = eligible[j];
      if (!a || !b) continue;
      if (suppressed.has(`${a.id}|${b.id}`)) continue;

      const reasons: string[] = [];

      const nameA = normalize(contactDisplayName(a));
      const nameB = normalize(contactDisplayName(b));
      if (nameA !== "" && nameA === nameB) reasons.push("Nome de exibição idêntico");

      // Telefone × identidade de WhatsApp: mesmo número, Tipos distintos.
      for (const idA of a.identifiers) {
        for (const idB of b.identifiers) {
          const bothPhoneish =
            (idA.type === "telefone" || idA.type === "identidadeDeWhatsApp") &&
            (idB.type === "telefone" || idB.type === "identidadeDeWhatsApp");
          if (bothPhoneish && idA.type !== idB.type && digits(idA.value) === digits(idB.value)) {
            reasons.push(`Mesmo número em Tipos distintos: ${idA.displayValue}`);
          }
          if (
            idA.type === "email" &&
            idB.type === "email" &&
            idA.value.toLowerCase() === idB.value.toLowerCase() &&
            idA.value !== idB.value
          ) {
            reasons.push("E-mail igual a menos de maiúsculas");
          }
        }
      }

      // Rótulo informado pelo Canal igual ao Nome de outro Contato.
      for (const identifier of a.identifiers) {
        if (identifier.channelLabel && normalize(identifier.channelLabel) === nameB) {
          reasons.push(`Rótulo do Canal “${identifier.channelLabel}” é o Nome do outro`);
        }
      }
      for (const identifier of b.identifiers) {
        if (identifier.channelLabel && normalize(identifier.channelLabel) === nameA) {
          reasons.push(`Rótulo do Canal “${identifier.channelLabel}” é o Nome do outro`);
        }
      }

      if (reasons.length > 0) found.push({ a, b, reasons: [...new Set(reasons)] });
    }
  }
  return found;
}

/**
 * Quem agiu, por extenso. O Registro de Atividade guarda só a referência, e a
 * referência sobrevive à remoção de quem agiu (INV-ET-12) — por isso cada ramo
 * tem um rótulo para o caso de o ator não existir mais.
 */
export function actorLabel(state: DataState, actor: ActorRef): string {
  if (actor.kind === "member") {
    const member = state.members.find((m) => m.id === actor.id);
    if (!member) return "Membro eliminado";
    return member.state === "removido" ? `${member.displayName} (removido)` : member.displayName;
  }
  if (actor.kind === "agent") {
    return `${state.agents.find((a) => a.id === actor.id)?.name ?? "Agente"} (Agente)`;
  }
  if (actor.kind === "automation") {
    return `${state.automations.find((a) => a.id === actor.id)?.name ?? "Automação"} (Automação)`;
  }
  if (actor.kind === "integration") {
    return `${state.integrations.find((i) => i.id === actor.id)?.name ?? "Integração"} (Integração)`;
  }
  return ACTOR_KIND_LABEL[actor.kind] ?? actor.kind;
}

/** O contador monotônico que gerou o id do Registro (`act_0000a4` → 376). */
function activitySequence(record: ActivityRecord): number {
  return Number.parseInt(record.id.slice(record.id.indexOf("_") + 1), 36);
}

/**
 * Do mais recente para o mais antigo. Várias passagens de Etapa caem no mesmo
 * instante e aí o `at` não decide nada; o desempate é a sequência de criação,
 * que está no id. A posição no array não serve: o seed empilha com `push` e
 * `recordActivity` insere com `unshift`, então o mesmo índice significa o
 * oposto nos dois.
 */
export function newestFirst(records: readonly ActivityRecord[]): ActivityRecord[] {
  return [...records].sort(
    (a, b) => b.at.localeCompare(a.at) || activitySequence(b) - activitySequence(a),
  );
}

/**
 * Por que este Membro NÃO pode escrever nesta Tarefa (17.1) — ou `undefined`
 * se pode. As operações recusam com esta frase; a tela desliga o controle com
 * ela, para o clique não ser o primeiro a saber.
 */
export function taskWriteRefusal(state: DataState, memberId: Id, taskId: Id): string | undefined {
  const member = state.members.find((m) => m.id === memberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo altera Tarefa.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return "Um Convidado não altera Tarefa: ele alcança só o que foi compartilhado com ele.";
  }
  if (!memberSeesTask(state, memberId, taskId)) return "Você não tem acesso a esta Tarefa.";
  // Quem só chega à Tarefa por concessão direta (a Lista não o alcança) faz o
  // que a concessão diz: `ver` e `comentar` não escrevem.
  const task = state.tasks.find((t) => t.id === taskId);
  if (task && !memberReachesContainer(state, memberId, "list", task.listId) && !grantsOn(state, memberId, taskId).some((g) => WRITE_ACTIONS.has(g.action))) {
    return "Você vê esta Tarefa por concessão, mas não a altera.";
  }
  return undefined;
}

const WRITE_ACTIONS: ReadonlySet<Grant["action"]> = new Set(["editar", "excluir", "administrar"]);

/** Por que este Membro NÃO pode comentar nesta Tarefa — `comentar` basta, escrever também. */
export function taskCommentRefusal(state: DataState, memberId: Id, taskId: Id): string | undefined {
  const escrita = taskWriteRefusal(state, memberId, taskId);
  if (!escrita) return undefined;
  if (memberSeesTask(state, memberId, taskId) && grantsOn(state, memberId, taskId).some((g) => g.action === "comentar" || WRITE_ACTIONS.has(g.action))) return undefined;
  return escrita;
}

/** Concessão direta a este Membro (ou a uma Equipe dele) neste recurso. */
function grantsOn(state: DataState, memberId: Id, resourceId: Id): Grant[] {
  return state.grants.filter(
    (grant) =>
      grant.resourceId === resourceId &&
      ((grant.subjectKind === "member" && grant.subjectId === memberId) ||
        (grant.subjectKind === "team" && state.teams.some((team) => team.id === grant.subjectId && team.memberIds.includes(memberId)))),
  );
}

/**
 * B38 lido ao longo do caminho: um contêiner privado corta a origem por Papel
 * para tudo abaixo dele, e uma concessão em um nó (escopo subárvore) alcança
 * o que está abaixo. `memberSeesResource` responde por um nó isolado; aqui a
 * Lista dentro de um Espaço privado não existe para quem não recebeu nada.
 */
export function memberReachesContainer(state: DataState, memberId: Id, type: PathNode["type"], id: Id): boolean {
  const path = containerPath(state, type, id);
  if (path.length === 0) return false;
  // Uma concessão em qualquer nó do caminho abre o alvo: no próprio nó ou num
  // ancestral (escopo subárvore). Só sem concessão é que o privado corta.
  if (path.some((node) => grantsOn(state, memberId, node.id).length > 0)) return true;
  if (path.some((node) => containerOf(state, node)?.isPrivate)) return false;
  const member = state.members.find((m) => m.id === memberId);
  const base = state.roles.find((r) => r.id === member?.roleId)?.base;
  return base !== "convidado";
}

/** 17.2 — a permissão da Tarefa vem da Lista; um compartilhamento da própria Tarefa também a abre. */
export function memberSeesTask(state: DataState, memberId: Id, taskId: Id): boolean {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  if (grantsOn(state, memberId, task.id).length > 0) return true;
  if (task.rootTaskId && grantsOn(state, memberId, task.rootTaskId).length > 0) return true;
  return memberReachesContainer(state, memberId, "list", task.listId);
}

/** RN-TAR-06 para Agentes: concessão ao Agente na Tarefa ou no caminho; sem ela, só o que não é privado. */
export function agentSeesTask(state: DataState, agentId: Id, taskId: Id): boolean {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  const granted = (resourceId: Id) => state.grants.some((g) => g.subjectKind === "agent" && g.subjectId === agentId && g.resourceId === resourceId);
  if (granted(task.id) || (task.rootTaskId !== undefined && granted(task.rootTaskId))) return true;
  const path = containerPath(state, "list", task.listId);
  if (path.some((node) => granted(node.id))) return true;
  return !path.some((node) => containerOf(state, node)?.isPrivate);
}

/**
 * Quem administra um contêiner (espaco.md:178): o Papel base Proprietário ou
 * Administrador que ALCANÇA o contêiner, ou uma concessão direta de
 * `administrar` nele ou acima — o "Administrador de Espaço", que é concessão e
 * não Papel.
 */
export function containerAdminRefusal(state: DataState, memberId: Id, type: PathNode["type"], id: Id): string | undefined {
  const member = state.members.find((m) => m.id === memberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo configura a Estrutura.";
  const path = containerPath(state, type, id);
  if (path.some((node) => grantsOn(state, memberId, node.id).some((g) => g.action === "administrar"))) return undefined;
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base !== "proprietario" && base !== "administrador") {
    return "Configurar a Estrutura exige administrar o contêiner: Administrador, Proprietário ou concessão direta.";
  }
  if (!memberReachesContainer(state, memberId, type, id)) return "Você não alcança este contêiner: ele é privado e nada foi concedido a você.";
  return undefined;
}

/**
 * Menções a um Membro em Comentários de Tarefa que ele alcança, em conversas
 * ainda abertas. Não há entidade Notificação: resolver a conversa é o que
 * "dá baixa" — o Comentário é imutável (7.1), a marca de resolvido é da conversa.
 */
export function pendingMentions(
  state: DataState,
  memberId: Id,
): Array<{ readonly task: Task; readonly comment: Comment }> {
  const found: Array<{ task: Task; comment: Comment }> = [];
  for (const task of state.tasks) {
    if (effectiveLifecycleOfTask(state, task.id) !== "ativo") continue;
    if (!memberSeesTask(state, memberId, task.id)) continue;
    for (const comment of task.comments) {
      if (comment.deletedAt) continue;
      if (!comment.mentions.some((m) => m.type === "member" && m.id === memberId)) continue;
      // Só o próprio Membro falando de si não conta; uma Automação em nome dele avisa.
      if (comment.author.kind === "member" && comment.author.id === memberId) continue;
      const root = comment.parentCommentId ? task.comments.find((c) => c.id === comment.parentCommentId) : comment;
      if (root?.resolved) continue;
      found.push({ task, comment });
    }
  }
  return found.sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt));
}

/* ───────────────────────────── Fase 3 — planejamento ───────────────────────────── */

/** Segunda-feira (dia civil local) da semana que contém a data. */
export function weekStartOf(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return civilOf(date);
}

export function civilOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function civilPlusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return civilOf(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
}

/** O dia civil de uma data de Tarefa, no fuso local para o instante. */
export function taskCivilDay(date: TaskDate | undefined): string | undefined {
  if (!date) return undefined;
  return date.form === "civilDay" ? date.value : civilOf(new Date(date.value));
}

export interface WorkloadCell {
  readonly memberId: Id;
  /** Segunda-feira da semana, ou "semData" para Tarefas sem vencimento. */
  readonly week: string;
  readonly minutes: number;
  readonly taskIds: readonly Id[];
}

/**
 * Carga de trabalho: a estimativa de cada Tarefa aberta cai na semana do
 * vencimento, dividida entre os Membros Responsáveis. Agentes não têm
 * capacidade e ficam fora. Sem vencimento, a carga vai para "semData".
 */
export function workload(state: DataState, tasks: readonly Task[]): WorkloadCell[] {
  const cells = new Map<string, { memberId: Id; week: string; minutes: number; taskIds: Id[] }>();
  for (const task of tasks) {
    if (isTerminalCategory(statusCategory(state, task))) continue;
    if (task.estimate === undefined || task.estimate <= 0) continue;
    const membros = task.assignees.filter((a) => a.kind === "member");
    if (membros.length === 0) continue;
    const dia = taskCivilDay(task.dueDate);
    const week = dia ? weekStartOf(dia) : "semData";
    for (const a of membros) {
      const key = `${a.id}|${week}`;
      const cell = cells.get(key) ?? { memberId: a.id, week, minutes: 0, taskIds: [] };
      cell.minutes += task.estimate / membros.length;
      cell.taskIds.push(task.id);
      cells.set(key, cell);
    }
  }
  return [...cells.values()];
}

/** A ocorrência que nasceu desta Tarefa ao concluí-la (B6) — para a tela apontar para ela. */
export function spawnedOccurrenceOf(state: DataState, taskId: Id): Task | undefined {
  return [...state.tasks].reverse().find((t) => t.provenance?.kind === "recurrence" && t.provenance.sourceId === taskId);
}

/* ───────────────────────────── Fase 4 — Metas ───────────────────────────── */

export interface GoalProgress {
  readonly current: number;
  readonly target: number;
  /** 0..1, limitado a 1 — a Meta batida não passa de 100%. */
  readonly ratio: number;
  readonly label: string;
}

/**
 * Progresso derivado, nunca gravado: por Tarefas ligadas concluídas, ou pela
 * mesma leitura que um Widget faz (o visualizador precisa alcançar o recorte;
 * senão a leitura é "sem acesso" e o progresso não se inventa).
 */
export function goalProgress(state: DataState, goal: Goal, memberId: Id, now: Date): GoalProgress | { readonly kind: "semAcesso" } {
  if (goal.kind === "tarefasConcluidas") {
    const ligadas = goal.taskIds.map((id) => state.tasks.find((t) => t.id === id)).filter((t): t is Task => t !== undefined && effectiveLifecycleOfTask(state, t.id) !== "naLixeira");
    const concluidas = ligadas.filter((t) => isTerminalCategory(statusCategory(state, t))).length;
    const target = goal.target;
    return { current: concluidas, target, ratio: target > 0 ? Math.min(1, concluidas / target) : 0, label: `${concluidas} de ${target} Tarefa(s)` };
  }
  const measure = goal.measure;
  if (!measure) return { current: 0, target: goal.target, ratio: 0, label: "sem leitura" };
  const reading = widgetReading(
    state,
    { viewType: "numero", dataSource: measure, metrics: [{ aggregation: measure.aggregation, attribute: measure.attribute, label: goal.name }], dimensions: [] },
    memberId,
    now,
  );
  if (reading.kind === "semAcesso") return { kind: "semAcesso" };
  const current = reading.kind === "numero" ? reading.value : reading.kind === "moeda" ? reading.byCurrency.reduce((s, c) => s + c.amount, 0) : 0;
  return { current, target: goal.target, ratio: goal.target > 0 ? Math.min(1, current / goal.target) : 0, label: `${current}${goal.unit ? ` ${goal.unit}` : ""} de ${goal.target}${goal.unit ? ` ${goal.unit}` : ""}` };
}
