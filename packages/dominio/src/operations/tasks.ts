/**
 * Task operations. Every rule enforced here cites the ontology rule it applies;
 * every rejection is a pt-BR sentence that says what is missing.
 */

import {
  checklistProgress,
  effectiveListConfig,
  effectiveLifecycleOfList,
  effectiveLifecycleOfTask,
  isBlocked,
  isTerminalCategory,
  agentSeesTask,
  memberReachesContainer,
  memberSeesTask,
  statusCategory,
  taskCommentRefusal,
  taskWriteRefusal,
  statusDefinition,
  subtasksOf,
  taskLevel,
  tipoPadraoDaLista,
  containerAdminRefusal,
} from "../derive";
import { contatoDaTarefa } from "../derive-conversacional";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { ActorRef, Comment, EffectiveListConfig, FieldDefinition, FieldRequirement, FieldValue, Id, List, Minutes, Priority, StatusDefinition, Task, TaskDate } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { dataDevida, nextOccurrenceRefusal, runningTimer, spawnCalendarOccurrence, spawnNextOccurrence, transicaoDisparaRecorrencia } from "./collaboration";
import { runListAutomations } from "./automations";
import { containerTrashRefusal } from "./structure";
// Módulo-folha (só `import type`): a Conferência vigente e os revisores sem importar `./financeiro` (06-11);
// a marca do lançamento em curso e o prefixo do registro humano (06-19).
import {
  PREFIXO_LANCAMENTO_HUMANO,
  RECUSA_LANCAMENTO_EM_CURSO,
  conferenciaVigente,
  lancamentoEmCursoDe,
  revisoresDoResumo,
} from "./financeiro-base";

const now = (): string => new Date().toISOString();

function requireTask(state: DataState, taskId: Id): Task | undefined {
  return state.tasks.find((t) => t.id === taskId);
}

export interface CreateTaskInput {
  readonly listId: Id;
  readonly title: string;
  readonly parentTaskId?: Id;
  readonly statusId?: Id;
  readonly assignees?: readonly ActorRef[];
  readonly priority?: Priority;
  readonly dueDate?: TaskDate;
  /** Um dos Tipos que a Lista enxerga; sem ele, o primeiro do caminho. */
  readonly taskTypeId?: Id;
  /** Vínculos com que a Tarefa nasce (RN-TAR-15). Numa Lista conversacional, um deles é o Contato. */
  readonly vinculos?: readonly VinculoDeNascimento[];
}

export interface VinculoDeNascimento {
  readonly toType: "contact" | "conversation" | "deal";
  readonly toId: Id;
  readonly role?: string;
}

/** C35 — a recusa da Lista conversacional para a Tarefa raiz que chega sem Contato. */
export const TAREFA_SEM_CONTATO = "Nesta Lista toda Tarefa nasce de um Contato.";

/** O alvo de cada Vínculo de nascimento existe e está ativo — conferido antes de a Tarefa nascer. */
function vinculoRefusal(state: DataState, vinculo: VinculoDeNascimento): string | undefined {
  if (vinculo.toType === "contact") {
    const contact = state.contacts.find((c) => c.id === vinculo.toId);
    if (!contact) return "Contato não encontrado.";
    if (contact.lifecycle !== "ativo") return "Este Contato não está ativo.";
    return undefined;
  }
  if (vinculo.toType === "conversation") {
    const conversation = state.conversations.find((c) => c.id === vinculo.toId);
    if (!conversation || conversation.lifecycle !== "ativo") return "Conversa não encontrada.";
    return undefined;
  }
  const deal = state.deals.find((d) => d.id === vinculo.toId);
  if (!deal || deal.lifecycle !== "ativo") return "Negócio não encontrado.";
  return undefined;
}

/**
 * RN-LIS-03 / B1 — a root Task belongs to exactly one List; a Subtask derives
 * its List from the root and is capped by the workspace maximum depth
 * (RN-STA-04).
 */
export function createTask(
  state: DataState,
  actingMemberId: Id,
  input: CreateTaskInput,
  /**
   * `runAutomations: false` adia o gatilho `tarefaCriada` — usado por quem
   * precisa terminar de montar a Tarefa (Campos, anexos) antes de qualquer
   * automação enxergá-la (Plan 02-05: `submitForm`), disparando o mesmo
   * evento manualmente depois. Todo outro chamador mantém o padrão atual.
   *
   * `nasceNoStatusPedido: true` faz a Tarefa nascer direto em `input.statusId`,
   * sem passar pelas regras de mover (requisitos de saída/entrada, Automações de
   * "entrou em Status"). Só para reprodução de histórico — as importações —,
   * onde a Tarefa já esteve naquele Status e nada ao vivo pode reagir a isso.
   */
  options?: { readonly runAutomations?: boolean; readonly nasceNoStatusPedido?: boolean },
): OperationResult<Task> {
  const list = state.lists.find((l) => l.id === input.listId);
  if (!list) return fail("Lista não encontrada.");
  const criacao = listWriteRefusal(state, actingMemberId, input.listId);
  if (criacao) return fail(criacao);

  // C35 — na Lista conversacional a Tarefa raiz nasce de um Contato; a
  // Subtarefa herda o da raiz. O compositor rápido, o Formulário e o Template
  // batem nesta parede com a mesma frase que a tela mostra.
  if (list.modeloDeTarefa === "conversacional" && input.parentTaskId === undefined && !input.vinculos?.some((v) => v.toType === "contact")) {
    return fail(TAREFA_SEM_CONTATO);
  }
  for (const vinculo of input.vinculos ?? []) {
    const recusa = vinculoRefusal(state, vinculo);
    if (recusa) return fail(recusa);
  }

  const config = effectiveListConfig(state, input.listId);
  if (!config) return fail("Esta Lista não tem Conjunto de Status efetivo.");

  let parent: Task | undefined;
  let rootId: Id | undefined;
  if (input.parentTaskId) {
    parent = requireTask(state, input.parentTaskId);
    if (!parent) return fail("Tarefa pai não encontrada.");
    if (parent.listId !== input.listId) {
      return fail("Uma Subtarefa pertence à mesma Lista da sua Tarefa raiz.");
    }
    if (!config.features.subtarefas) return fail("Esta Lista não usa Subtarefas.");
    const level = taskLevel(state, parent) + 1;
    if (level > state.workspace.maxSubtaskDepth) {
      return fail(
        `Limite de ${state.workspace.maxSubtaskDepth} níveis de Subtarefa, definido no Espaço de Trabalho.`,
      );
    }
    // 6.2 — with the feature on, a Subtask born with a due date fits inside its parent's.
    if (config.features.datasDeSubtarefasContidas && input.dueDate) {
      const fim = dateMs(input.dueDate, "fim");
      const fimDaMae = dateMs(parent.dueDate, "fim");
      if (fim !== undefined && fimDaMae !== undefined && fim > fimDaMae) {
        return fail("A Subtarefa não pode vencer depois da Tarefa mãe: esta Lista exige datas contidas.", "vencimento");
      }
    }
    rootId = parent.rootTaskId ?? parent.id;
  }

  // RN-LIS-13 — a List that is not effectively `ativo` receives no new Task.
  const listState = effectiveLifecycleOfList(state, input.listId);
  if (listState !== "ativo") {
    return fail(
      listState === "arquivado"
        ? "Esta Lista está arquivada e não recebe Tarefas novas."
        : "Esta Lista está na lixeira e não recebe Tarefas novas.",
    );
  }

  // RN-LIS-18 — the maximum number of tasks per list is an imposed limit,
  // verified at the act that would consume it (RN-ET-23).
  if (input.parentTaskId === undefined) {
    const rootCount = state.tasks.filter(
      (t) => t.listId === input.listId && t.parentTaskId === undefined && t.lifecycle === "ativo",
    ).length;
    if (rootCount >= state.workspace.limits.tasksPerList) {
      return fail(
        `Limite de ${state.workspace.limits.tasksPerList} Tarefas por Lista atingido.`,
      );
    }
  }

  // Glossário — the default initial status is the first `naoIniciado` in order.
  // Toda Tarefa NASCE nele; um `statusId` diferente (o "+" de um grupo) é uma
  // mudança de Status logo depois de nascer, com as mesmas regras de quem move.
  const initial = [...config.statusSet.definitions]
    .sort((a, b) => a.order - b.order)
    .find((d) => d.category === "naoIniciado");
  if (!initial) return fail("O Conjunto de Status efetivo não tem status inicial.");
  const alvo = input.statusId && input.statusId !== initial.id ? config.statusSet.definitions.find((d) => d.id === input.statusId) : undefined;
  if (input.statusId && input.statusId !== initial.id && !alvo) {
    return fail("Este status não pertence ao Conjunto de Status efetivo desta Lista.");
  }

  // Sem Tipo pedido, vale o Tipo padrão do nível mais próximo da Lista: numa
  // Lista do Financeiro é "Conta" (da Pasta), não o "Tarefa" do Espaço. A
  // regra mora em `tipoPadraoDaLista` porque a tela de criação pré-escolhe
  // com ela — uma cópia aqui divergiria no primeiro ajuste.
  const platformType = input.taskTypeId ?? tipoPadraoDaLista(state, input.listId);
  if (!platformType) return fail("A Lista não tem Tipo de Tarefa disponível.");
  if (!config.taskTypeIds.includes(platformType)) return fail("Este Tipo de Tarefa não alcança esta Lista.", "tipo");

  const readable = state.workspace.taskReadableId.enabled
    ? `${state.workspace.taskReadableId.prefix}-${state.workspace.taskReadableId.next}`
    : undefined;
  if (state.workspace.taskReadableId.enabled) state.workspace.taskReadableId.next += 1;

  const task: Task = {
    id: nextId("tsk"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    listId: input.listId,
    ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
    ...(rootId ? { rootTaskId: rootId } : {}),
    siblingOrder: state.tasks.filter((t) => t.parentTaskId === input.parentTaskId).length,
    ...(readable ? { readableId: readable } : {}),
    title: input.title,
    description: "",
    statusId: options?.nasceNoStatusPedido && alvo ? alvo.id : initial.id,
    taskTypeId: platformType,
    priority: input.priority ?? "semPrioridade",
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    assignees: [...(input.assignees ?? [])],
    observerMemberIds: [],
    tagIds: [],
    fieldValues: [],
    checklists: [],
    timeEntries: [],
    dependencies: [],
    attachments: [],
    comments: [],
    updatedAt: now(),
  };
  state.tasks.push(task);
  // RN-TAR-15 — os Vínculos de nascimento saem do mesmo escritor da Tarefa:
  // um só lugar cria a Tarefa e o que a liga ao CRM.
  const linksAntes = state.links.length;
  for (const vinculo of input.vinculos ?? []) {
    state.links.push({
      id: nextId("lnk"),
      fromType: "task",
      fromId: task.id,
      toType: vinculo.toType,
      toId: vinculo.toId,
      ...(vinculo.role ? { role: vinculo.role } : {}),
      createdBy: memberActor(actingMemberId),
      createdAt: now(),
    });
  }
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tarefa criada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
  });
  if (alvo && !options?.nasceNoStatusPedido) {
    // Requisitos de saída do inicial, entrada no alvo, quem pode entrar,
    // Automações de "entrou em Status": tudo o que mover exige. Recusado, a
    // Tarefa não nasce — e o motivo é o mesmo que o de mover.
    const movida = changeTaskStatus(state, actingMemberId, task.id, alvo.id);
    if (!movida.ok) {
      state.tasks.splice(state.tasks.indexOf(task), 1);
      state.links.splice(linksAntes);
      state.activity = state.activity.filter((record) => record.objectId !== task.id);
      if (state.workspace.taskReadableId.enabled) state.workspace.taskReadableId.next -= 1;
      return fail(`Não nasce em “${alvo.name}”: ${movida.error}`);
    }
  }
  if (options?.runAutomations !== false) {
    runListAutomations(state, { kind: "tarefaCriada", taskId: task.id });
  }
  return ok(task, task.id);
}

/**
 * RN-TAR-18 / RN-CHK-09 — concluding with open Subtasks or Checklist items is
 * allowed unless the List enables the corresponding functionality. RN-TAR-17 —
 * "Bloqueada" only blocks when the List enables it.
 */
export function changeTaskStatus(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  statusId: Id,
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTaskStatus(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (effectiveLifecycleOfTask(state, taskId) !== "ativo") {
    return fail("Esta Tarefa não está ativa. Restaure-a para editá-la.");
  }
  const config = effectiveListConfig(state, task.listId);
  const target = config?.statusSet.definitions.find((d) => d.id === statusId);
  if (!config || !target) {
    return fail("Este status não pertence ao Conjunto de Status efetivo desta Lista.");
  }

  const before = statusDefinition(state, task.listId, task.statusId);
  if (task.statusId !== target.id) {
    // 06-19 (crm2:WR-01) — o Agente está lançando a conta no Omie agora: só
    // quem marcou (o Membro de serviço, que registra o lançamento ou a falha)
    // move. Um humano que mexe no meio do `/lancar` produziria um segundo
    // título. A mesma regra na tela e no endpoint; o lote herda por item.
    const emCurso = lancamentoEmCursoDe(state, task);
    if (emCurso && emCurso.porMembroId !== actingMemberId) return fail(RECUSA_LANCAMENTO_EM_CURSO);
  }
  if (before && before.id !== target.id) {
    // Requisitos de saída do Status atual: o que falta é dito pelo nome, antes de mover.
    const faltando = unmetRequirements(state, task, before.exitRequirements ?? []);
    if (faltando.length > 0) return fail(`Para sair de “${before.name}” falta: ${faltando.join(", ")}.`);
  }
  if (before && before.id !== target.id) {
    // CR-04 (05-14) — D5-06 aplicada pelo backend, não só pela dica da tela.
    const naoDeclarado = statusNaoDeclaradoPelaEmpresa(state, task, target);
    if (naoDeclarado) return fail(naoDeclarado);
  }
  if (target.entryAllowedMemberIds?.length && !target.entryAllowedMemberIds.includes(actingMemberId)) {
    const nomes = target.entryAllowedMemberIds.map((id) => state.members.find((m) => m.id === id)?.displayName ?? id).join(", ");
    return fail(`Só ${nomes} move uma Tarefa para “${target.name}”.`);
  }
  if (before && before.id !== target.id) {
    const entrada = entryRefusal(state, task, config.statusSet.definitions, before, target);
    if (entrada) return fail(entrada);
  }
  if (isTerminalCategory(target.category) && !isTerminalCategory(before?.category)) {
    if (config.features.exigirSubtarefasConcluidas) {
      const open = subtasksOf(state, task.id).filter(
        (s) => effectiveLifecycleOfTask(state, s.id) === "ativo" && !isTerminalCategory(statusCategory(state, s)),
      );
      if (open.length > 0) {
        return fail(
          `Conclua ${open.length === 1 ? "a Subtarefa aberta" : `as ${open.length} Subtarefas abertas`} antes.`,
        );
      }
    }
    if (config.features.exigirChecklistsConcluidos) {
      const progress = checklistProgress(task);
      if (progress && progress.done < progress.total) {
        const open = progress.total - progress.done;
        return fail(
          `${open === 1 ? "Há 1 item de checklist aberto" : `Há ${open} itens de checklist abertos`} nesta Tarefa.`,
        );
      }
    }
    if (config.features.impedirConclusaoDeTarefaBloqueada && isBlocked(state, task)) {
      return fail("Esta Tarefa está bloqueada por uma Dependência e a Lista impede concluí-la.");
    }
  }

  // Documento 06, 6.1 — the completion moment is derived from the transition.
  const concluiuAgora = isTerminalCategory(target.category) && !isTerminalCategory(before?.category);
  // B6 — a recurrence that cannot spawn refuses the completion up front, so it never ends half done.
  // FUND-08 — com Status de disparo na regra, é entrar nele que dispara (pago), não qualquer conclusão.
  const disparaRecorrencia = transicaoDisparaRecorrencia(task.recurrence, before, target);
  // FUND-17 — por calendário com "aguardar conclusão": a data já era devida, a conclusão libera a próxima.
  const disparaPorCalendario =
    concluiuAgora && task.recurrence?.triggerMode === "porCalendario" && task.recurrence.whenStillOpen === "aguardarConclusao" && dataDevida(task.dueDate, new Date());
  if (disparaRecorrencia || disparaPorCalendario) {
    const plano = nextOccurrenceRefusal(state, task);
    if (plano.error) return fail(`Não dá para concluir: ${plano.error}`);
  }

  task.statusId = target.id;
  task.updatedAt = now();
  if (concluiuAgora) {
    task.completedAt = now();
  } else if (!isTerminalCategory(target.category)) {
    delete task.completedAt;
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Status alterado",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    before: before?.name,
    after: target.name,
  });
  // As Automações da Lista reagem à entrada no Status antes da recorrência: a
  // ocorrência seguinte nasce depois de a atual ter sido tratada.
  runListAutomations(state, { kind: "tarefaEntrouEmStatus", taskId: task.id, statusId: target.id, ...(before ? { previousStatusId: before.id } : {}) });
  // B6 — a recurrence in `aoConcluir` mode spawns the next occurrence here, not in the screen.
  if (disparaRecorrencia || disparaPorCalendario) {
    const next = disparaRecorrencia ? spawnNextOccurrence(state, actingMemberId, task.id) : spawnCalendarOccurrence(state, actingMemberId, task.id, new Date());
    if (!next.ok) return fail(`Concluída, mas a próxima ocorrência não foi criada: ${next.error}`);
    if (next.value) {
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Recorrência transferida",
        objectType: "task",
        objectId: task.id,
        objectName: task.title,
        detail: `Para “${next.value.title}”`,
      });
    }
  }
  return ok(task, task.id);
}

/**
 * RN-TAR-06 — the assignee needs `ver` at the moment of assignment, and
 * assigning never grants permission. B7 — Member or Agent; B48 keeps the
 * checklist item restricted to a Member.
 */
export function assignTask(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  assignee: ActorRef,
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (assignee.kind === "member") {
    const member = state.members.find((m) => m.id === assignee.id);
    if (!member) return fail("Membro não encontrado.");
    if (member.state !== "ativo") {
      return fail("Só um Membro ativo pode receber uma responsabilidade.");
    }
    // RN-TAR-06 — quem recebe precisa `ver` a Tarefa; atribuir nunca concede.
    if (!memberSeesTask(state, member.id, taskId)) return fail("Esse Membro não tem acesso a esta Tarefa: compartilhe antes de atribuir.");
  } else if (assignee.kind === "agent") {
    const agent = state.agents.find((a) => a.id === assignee.id);
    if (!agent) return fail("Agente não encontrado.");
    if (agent.lifecycle !== "ativo") {
      return fail("Só um Agente ativo pode ser Responsável.");
    }
    if (!agentSeesTask(state, agent.id, taskId)) return fail("Esse Agente não tem acesso a esta Tarefa: conceda `ver` antes de atribuir.");
  } else {
    return fail("Responsável de Tarefa é Membro ou Agente.");
  }
  if (task.assignees.some((a) => a.kind === assignee.kind && a.id === assignee.id)) {
    return ok(task);
  }
  task.assignees.push(assignee);
  task.updatedAt = now();
  // O nome, como em `unassignTask`: a Atividade é lida por gente — com o id, a
  // linha dizia "Responsável atribuído (— → mem_marcos_paulo)" (jornada de 2026-09-29).
  const nome =
    assignee.kind === "member"
      ? (state.members.find((m) => m.id === assignee.id)?.displayName ?? assignee.id)
      : (state.agents.find((a) => a.id === assignee.id)?.name ?? assignee.id);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Responsável atribuído",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    after: nome,
  });
  return ok(task, task.id);
}

export interface StatusMapping {
  readonly fromStatusId: Id;
  readonly toStatusId: Id;
}

/**
 * RN-LIS-06 / B40 — os nomes dos Status em uso pelas `tarefas` que o
 * `mapeamento` não leva a um Status do Conjunto de destino. Vazio quando o
 * Conjunto efetivo não muda: nesse caso nada precisa ser mapeado. Compartilhada
 * por `moveTask` e `moveContainer`, para as duas nunca divergirem.
 */
export function statusSemMapeamento(
  tarefas: readonly Task[],
  from: EffectiveListConfig,
  to: EffectiveListConfig,
  mapeamento: readonly StatusMapping[],
): string[] {
  if (from.statusSet.id === to.statusSet.id) return [];
  const inUse = new Set(tarefas.map((t) => t.statusId));
  const missing: string[] = [];
  for (const statusId of inUse) {
    const mapped = mapeamento.find((m) => m.fromStatusId === statusId);
    const destination = mapped ? to.statusSet.definitions.find((d) => d.id === mapped.toStatusId) : undefined;
    if (!destination) {
      const name = from.statusSet.definitions.find((d) => d.id === statusId)?.name ?? statusId;
      missing.push(name);
    }
  }
  return missing;
}

/** A frase de recusa por falta de mapeamento: a mesma em `moveTask` e `moveContainer`. */
export function frasePedindoMapeamento(missing: readonly string[]): string {
  return `Mapeie ${missing.length === 1 ? "o status" : "os status"} ${missing.map((n) => `“${n}”`).join(", ")} para continuar.`;
}

/**
 * O que acontece a CADA Tarefa quando a configuração efetiva da Lista dela
 * muda de `from` para `to` — o laço que `moveTask` e `moveContainer` dividem:
 * Status remapeado (com Atividade), Valores de Campo arquivados ou reativados
 * (B37), Tipo de Tarefa sem efeito cai no primeiro do destino (RN-LIS-10(e)) e
 * link público revogado quando o destino não habilita a Funcionalidade. Quem
 * chama já conferiu o mapeamento (`statusSemMapeamento`) e é quem muda
 * `listId` e `updatedAt`.
 */
export function aplicarConfiguracaoEfetiva(
  state: DataState,
  actingMemberId: Id,
  tarefas: readonly Task[],
  from: EffectiveListConfig,
  to: EffectiveListConfig,
  mapeamento: readonly StatusMapping[],
): void {
  const keptDefinitions = new Set(to.fieldDefinitionIds);
  for (const item of tarefas) {
    if (from.statusSet.id !== to.statusSet.id) {
      const mapped = mapeamento.find((m) => m.fromStatusId === item.statusId);
      if (mapped) {
        const beforeName = from.statusSet.definitions.find((d) => d.id === item.statusId)?.name;
        const afterName = to.statusSet.definitions.find((d) => d.id === mapped.toStatusId)?.name;
        item.statusId = mapped.toStatusId;
        recordActivity(state, {
          actor: memberActor(actingMemberId),
          action: "Status alterado por remapeamento",
          objectType: "task",
          objectId: item.id,
          objectName: item.title,
          before: beforeName,
          after: afterName,
        });
      }
    }
    // B37 — archive what stopped applying, reactivate what applies again.
    for (const value of item.fieldValues) {
      value.state = keptDefinitions.has(value.definitionId) ? "ativo" : "arquivado";
    }
    // RN-LIS-10(e) — a task type not effective at the destination falls back.
    if (!to.taskTypeIds.includes(item.taskTypeId)) {
      const fallback = to.taskTypeIds[0];
      if (fallback) item.taskTypeId = fallback;
    }
    // tarefa.md §353 — o link público só sobrevive se o destino habilita a Funcionalidade.
    if (item.publicShare?.active && !to.features.compartilhamentoPublico) {
      item.publicShare.active = false;
      recordActivity(state, { actor: memberActor(actingMemberId), action: "Link público revogado", objectType: "task", objectId: item.id, objectName: item.title, detail: "A Lista de destino não permite compartilhamento público" });
    }
  }
}

/**
 * RN-LIS-06 / B40 — moving a Task to a List with a different effective Status
 * Set requires an explicit mapping of every status in use. Without a complete
 * mapping the operation is invalid; the category never changes without an
 * explicit act.
 *
 * B37 — field values whose definition stops applying are archived inside the
 * aggregate, never discarded.
 */
export function moveTask(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  targetListId: Id,
  mapping: readonly StatusMapping[] = [],
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.parentTaskId) {
    return fail("Uma Subtarefa só muda de Lista depois de promovida a Tarefa raiz.");
  }
  const target = state.lists.find((l) => l.id === targetListId);
  if (!target) return fail("Lista de destino não encontrada.");
  const destino = listWriteRefusal(state, actingMemberId, targetListId);
  if (destino) return fail(`Lista de destino: ${destino}`);
  if (targetListId === task.listId) return ok(task);
  // C35 — o modelo é da Lista, não da Tarefa: sair para uma operacional é
  // livre; entrar numa conversacional exige o Contato que a ficha vai mostrar.
  if (target.modeloDeTarefa === "conversacional" && !contatoDaTarefa(state, task)) {
    return fail("Uma Lista conversacional só recebe Tarefa com Contato vinculado.");
  }

  const from = effectiveListConfig(state, task.listId);
  const to = effectiveListConfig(state, targetListId);
  if (!from || !to) return fail("Configuração efetiva indisponível.");

  const tree = [task, ...descendants(state, task.id)];

  const missing = statusSemMapeamento(tree, from, to, mapping);
  if (missing.length > 0) return fail(frasePedindoMapeamento(missing), "mapeamento");

  const previousPath = from.path.map((p) => p.name).join(" › ");

  aplicarConfiguracaoEfetiva(state, actingMemberId, tree, from, to, mapping);
  for (const item of tree) {
    item.listId = targetListId;
    item.updatedAt = now();
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tarefa movida",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    before: previousPath,
    after: to.path.map((p) => p.name).join(" › "),
  });
  return ok(task, task.id);
}

function descendants(state: DataState, taskId: Id): Task[] {
  const out: Task[] = [];
  const walk = (parentId: Id) => {
    for (const child of state.tasks.filter((t) => t.parentTaskId === parentId)) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(taskId);
  return out;
}

/**
 * B48 — converting a checklist item into a Subtask is a single act, without an
 * inverse, rejected before any effect when it would exceed the maximum depth.
 */
export function convertChecklistItem(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  checklistId: Id,
  itemId: Id,
  parentTaskId?: Id,
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  const checklist = task.checklists.find((c) => c.id === checklistId);
  const item = checklist?.items.find((i) => i.id === itemId);
  if (!checklist || !item) return fail("Item de Checklist não encontrado.");
  if (item.converted) return fail("Este Item já foi convertido.");
  if (item.parentItemId) return fail("Só um Item de primeiro nível vira Subtarefa.");

  const parent = parentTaskId ?? task.id;
  const parentTask = requireTask(state, parent);
  if (!parentTask) return fail("Tarefa pai não encontrada.");
  const level = taskLevel(state, parentTask) + 1;
  if (level > state.workspace.maxSubtaskDepth) {
    return fail(
      `Converter aqui criaria o nível ${level}. Escolha outra Tarefa pai ou converta a partir de um nível acima.`,
    );
  }

  const created = createTask(state, actingMemberId, {
    listId: task.listId,
    title: item.text,
    parentTaskId: parent,
    ...(item.assigneeMemberId ? { assignees: [memberActor(item.assigneeMemberId)] } : {}),
  });
  if (!created.ok) return created;

  // B48 — the subitems migrate as a checklist of the new Subtask.
  const subitems = checklist.items.filter((i) => i.parentItemId === item.id);
  if (subitems.length > 0) {
    created.value.checklists.push({
      id: nextId("chk"),
      name: checklist.name,
      order: 0,
      items: subitems.map((s, index) => ({ ...s, id: nextId("cki"), order: index, parentItemId: undefined })),
      createdBy: memberActor(actingMemberId),
      createdAt: now(),
    });
    checklist.items = checklist.items.filter((i) => i.parentItemId !== item.id);
  }

  item.converted = {
    taskId: created.value.id,
    title: created.value.title,
    at: now(),
    by: memberActor(actingMemberId),
  };
  task.updatedAt = now();

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Item de Checklist convertido em Subtarefa",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    after: created.value.title,
  });
  return created;
}

/** B43 — the trash records the own state and the restore gives it back. */
export function trashTask(state: DataState, actingMemberId: Id, taskId: Id): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.lifecycle === "naLixeira") return ok(task);
  task.lifecycleBeforeTrash = task.lifecycle === "arquivado" ? "arquivado" : "ativo";
  task.lifecycle = "naLixeira";
  task.trashedAt = now();
  // B36 — a running time entry is closed the moment the task leaves `ativo`.
  for (const entry of task.timeEntries) {
    if (!entry.end) {
      entry.end = now();
      entry.durationMinutes = Math.max(
        1,
        Math.round((Date.parse(entry.end) - Date.parse(entry.start)) / 60_000),
      );
    }
  }
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tarefa enviada à lixeira",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
  });
  return ok(task);
}

/**
 * B43 / RN-TAR-28 — restoring returns the own state before the trash and
 * requires the immediate parent not to be effectively in the trash. A Subtask
 * whose parent is not restored comes back as a root Task.
 */
export function restoreTask(state: DataState, actingMemberId: Id, taskId: Id): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.lifecycle !== "naLixeira") return ok(task);

  if (task.parentTaskId) {
    const parent = requireTask(state, task.parentTaskId);
    if (!parent || effectiveLifecycleOfTask(state, parent.id) === "naLixeira") {
      delete task.parentTaskId;
      delete task.rootTaskId;
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Pai alterado",
        objectType: "task",
        objectId: task.id,
        objectName: task.title,
        detail: "restauração",
      });
    }
  }

  task.lifecycle = task.lifecycleBeforeTrash ?? "ativo";
  delete task.lifecycleBeforeTrash;
  delete task.trashedAt;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tarefa restaurada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    after: task.lifecycle,
  });
  return ok(task, task.id);
}

/**
 * 12.6 — eliminação permanente ("eliminar agora"): não é estado, é o fim.
 * Só sai da lixeira para o nada o que está na lixeira por ato próprio. Elimina
 * o agregado inteiro e as Subtarefas (mesmo as que não estavam na lixeira:
 * a cascata é de eliminação, não de estado); remove Vínculos e Dependências
 * dos dois lados; NÃO elimina Arquivos (são do Espaço de Trabalho); os
 * Registros de Atividade permanecem, com o título preservado neles (INV-ET-12).
 * Exige `excluir` sobre a Tarefa — o mesmo que enviar à lixeira.
 */
export function purgeTask(state: DataState, actingMemberId: Id, taskId: Id): OperationResult<{ readonly eliminadas: number }> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.lifecycle !== "naLixeira") return fail("Só uma Tarefa na lixeira é eliminada: envie-a à lixeira primeiro.");

  const arvore = [task, ...descendants(state, task.id)];
  const ids = new Set(arvore.map((t) => t.id));
  for (const outra of state.tasks) {
    if (!ids.has(outra.id) && outra.dependencies.some((d) => ids.has(d.taskId))) {
      outra.dependencies = outra.dependencies.filter((d) => !ids.has(d.taskId));
    }
  }
  state.links = state.links.filter((l) => !((l.fromType === "task" && ids.has(l.fromId)) || (l.toType === "task" && ids.has(l.toId))));
  state.tasks = state.tasks.filter((t) => !ids.has(t.id));
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tarefa eliminada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    ...(arvore.length > 1 ? { detail: `${arvore.length - 1} Subtarefa(s) eliminada(s) com ela.` } : {}),
  });
  return ok({ eliminadas: arvore.length });
}

/** B34 — a previsão de eliminação: envio à lixeira + prazo da Política de lixeira do Espaço de Trabalho. */
export function previsaoDeEliminacao(state: DataState, task: Pick<Task, "trashedAt">): number | undefined {
  if (!task.trashedAt) return undefined;
  return Date.parse(task.trashedAt) + state.workspace.trashPolicy.retentionDays * 86_400_000;
}

/**
 * PARD-10 — o expurgo pela Política de lixeira: o Sistema elimina o que
 * passou do prazo (tarefa.md, 12.3). Por Lista e dia, como os outros relógios
 * da agenda (`runScheduledAutomations`, `runCalendarRecurrences`), e com a
 * mesma exigência: administrar a Lista. Uma Subtarefa vencida sob uma Tarefa
 * também vencida cai com a mãe, não em dobro.
 */
export function purgeExpiredTasks(
  state: DataState,
  actingMemberId: Id,
  listId: Id,
  today: Date,
): OperationResult<{ readonly eliminadas: number; readonly failed: number; readonly failures: ReadonlyArray<{ readonly taskId: Id; readonly title: string; readonly reason: string }> }> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return fail("Só um Membro ativo roda o expurgo da lixeira.");
  if (!state.lists.some((l) => l.id === listId)) return fail("Lista não encontrada.");
  const admin = containerAdminRefusal(state, actingMemberId, "list", listId);
  if (admin) return fail(admin);
  const vencidas = state.tasks.filter((t) => {
    if (t.listId !== listId || t.lifecycle !== "naLixeira") return false;
    const previsao = previsaoDeEliminacao(state, t);
    return previsao !== undefined && previsao <= today.getTime();
  });
  let eliminadas = 0;
  let failed = 0;
  const failures: Array<{ taskId: Id; title: string; reason: string }> = [];
  for (const task of vencidas) {
    if (!state.tasks.some((t) => t.id === task.id)) continue; // caiu com a mãe
    const r = purgeTask(state, actingMemberId, task.id);
    if (r.ok) eliminadas += r.value.eliminadas;
    else {
      failed += 1;
      failures.push({ taskId: task.id, title: task.title, reason: r.error });
    }
  }
  return ok({ eliminadas, failed, failures });
}

/**
 * B43 — restaurar um contêiner devolve o que foi à lixeira COM ele, e só isso:
 * uma Tarefa que já estava na lixeira antes continua lá. É o `trashedAt` que
 * distingue as duas, e sem ele não haveria como saber o que era cascata.
 */
export function restoreList(state: DataState, actingMemberId: Id, listId: Id): OperationResult<List> {
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return fail("Lista não encontrada.");
  // 1.2.3 — a mesma conferência de `restoreContainer`: para quem não alcança a
  // Lista ela não existe, e restaurar exige `excluir` (Administrador,
  // Proprietário ou concessão direta). Antes qualquer ator restaurava.
  if (!memberReachesContainer(state, actingMemberId, "list", listId)) return fail("Lista não encontrada.");
  const recusa = containerTrashRefusal(state, actingMemberId, "list", listId);
  if (recusa) return fail(recusa);
  if (list.lifecycle !== "naLixeira") return ok(list);

  // Um contêiner não volta para dentro de um pai que está na lixeira.
  const parent =
    list.parentType === "folder"
      ? state.folders.find((f) => f.id === list.parentId)
      : state.spaces.find((sp) => sp.id === list.parentId);
  if (!parent) return fail("O contêiner que a continha já não existe.");
  if (parent.lifecycle === "naLixeira") {
    return fail(`${parent.name} está na lixeira. Restaure o contêiner antes.`);
  }

  const trashedWithList = list.trashedAt
    ? state.tasks.filter(
        (task) =>
          task.listId === list.id &&
          task.lifecycle === "naLixeira" &&
          task.trashedAt === list.trashedAt,
      )
    : [];
  for (const task of trashedWithList) {
    task.lifecycle = task.lifecycleBeforeTrash ?? "ativo";
    delete task.lifecycleBeforeTrash;
    delete task.trashedAt;
  }

  list.lifecycle = list.lifecycleBeforeTrash ?? "ativo";
  delete list.lifecycleBeforeTrash;
  delete list.trashedAt;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Lista restaurada",
    objectType: "list",
    objectId: list.id,
    objectName: list.name,
    after: list.lifecycle,
    ...(trashedWithList.length > 0
      ? { detail: `${trashedWithList.length} Tarefa(s) voltaram com ela.` }
      : {}),
  });
  return ok(list, list.id);
}

/** B2 — o Checklist é componente interno da Tarefa; não tem identidade externa. */
export function addChecklist(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  name: string,
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.lifecycle !== "ativo") return fail("Esta Tarefa não está ativa.");
  if (!effectiveListConfig(state, task.listId)?.features.checklists) return fail("Esta Lista não usa Checklists.");
  if (!name.trim()) return fail("Dê um nome ao Checklist.", "nome");

  task.checklists.push({
    id: nextId("chk"),
    name: name.trim(),
    order: task.checklists.length,
    items: [],
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Checklist acrescentado",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    after: name.trim(),
  });
  return ok(task, task.id);
}

export function addChecklistItem(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  checklistId: Id,
  text: string,
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.lifecycle !== "ativo") return fail("Esta Tarefa não está ativa.");
  const checklist = task.checklists.find((c) => c.id === checklistId);
  if (!checklist) return fail("Checklist não encontrado.");
  if (!text.trim()) return fail("Escreva o Item antes de acrescentar.", "texto");

  checklist.items.push({
    id: nextId("cki"),
    text: text.trim(),
    order: checklist.items.length,
    done: false,
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Item de Checklist acrescentado",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: checklist.name,
    after: text.trim(),
  });
  return ok(task, task.id);
}

/**
 * INV-CHK-04 — concluir um Item guarda QUEM concluiu e QUANDO; desmarcar apaga
 * as duas coisas, porque um Item aberto nunca tem conclusão.
 *
 * B48 — um Item convertido em Subtarefa é terminal: ele não volta a ser Item.
 */
export function setChecklistItemDone(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  checklistId: Id,
  itemId: Id,
  done: boolean,
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.lifecycle !== "ativo") return fail("Esta Tarefa não está ativa.");
  const checklist = task.checklists.find((c) => c.id === checklistId);
  if (!checklist) return fail("Checklist não encontrado.");
  const item = checklist.items.find((i) => i.id === itemId);
  if (!item) return fail("Item não encontrado.");
  if (item.converted) {
    return fail("Este Item virou Subtarefa: conclua a Subtarefa, não o Item.");
  }
  if (item.done === done) return ok(task);

  item.done = done;
  if (done) {
    item.doneAt = now();
    item.doneBy = memberActor(actingMemberId);
  } else {
    delete item.doneAt;
    delete item.doneBy;
  }
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: done ? "Item de Checklist concluído" : "Item de Checklist reaberto",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: `${checklist.name} · ${item.text}`,
  });
  return ok(task, task.id);
}

/**
 * Remover um Checklist remove os seus Itens. Não há lixeira de Checklist ou
 * Item: a remoção é definitiva dentro do agregado, e o que foi removido fica
 * preservado no Registro de Atividade da Tarefa (checklist.md, seção 12).
 * É edição da Tarefa (`editar`), como acrescentar.
 */
export function removeChecklist(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  checklistId: Id,
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.lifecycle !== "ativo") return fail("Esta Tarefa não está ativa.");
  const checklist = task.checklists.find((c) => c.id === checklistId);
  if (!checklist) return fail("Checklist não encontrado.");

  task.checklists = task.checklists.filter((c) => c.id !== checklistId);
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Checklist removido",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    before: checklist.name,
    detail:
      checklist.items.length === 0
        ? "Sem Itens."
        : `${checklist.items.length} Item(ns) removido(s) com ele: ${checklist.items.map((i) => i.text).join("; ")}`,
  });
  return ok(task, task.id);
}

/**
 * Remover um Item remove os seus Subitens (checklist.md, seção 12). Um Item
 * `convertido` pode ser removido sem efeito sobre a Subtarefa (B48): a marca
 * terminal some do Checklist, a Subtarefa continua existindo.
 */
export function removeChecklistItem(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  checklistId: Id,
  itemId: Id,
): OperationResult<Task> {
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (task.lifecycle !== "ativo") return fail("Esta Tarefa não está ativa.");
  const checklist = task.checklists.find((c) => c.id === checklistId);
  if (!checklist) return fail("Checklist não encontrado.");
  const item = checklist.items.find((i) => i.id === itemId);
  if (!item) return fail("Item não encontrado.");

  const subitens = checklist.items.filter((i) => i.parentItemId === itemId);
  const removidos = new Set([itemId, ...subitens.map((i) => i.id)]);
  checklist.items = checklist.items.filter((i) => !removidos.has(i.id));
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Item de Checklist removido",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    before: item.text,
    detail:
      subitens.length === 0
        ? checklist.name
        : `${checklist.name} · ${subitens.length} Subitem(ns) removido(s) com ele: ${subitens.map((i) => i.text).join("; ")}`,
  });
  return ok(task, task.id);
}

/**
 * A Reunião do Closer.
 *
 * Não existe entidade Reunião na ontologia: uma reunião é uma Tarefa de Tipo
 * Reunião com data e hora, ligada ao Negócio por Vínculo (D8 deixou Evento de
 * calendário como decisão futura). A tela de call é a leitura dessa Tarefa
 * enquanto ela está `emAndamento`.
 *
 * "Em andamento" é o Status da Tarefa, não o relógio: uma call que passou do
 * horário e ninguém abriu não está acontecendo, e uma que varou o tempo
 * previsto continua acontecendo.
 */
export function startMeeting(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
): OperationResult<Task> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return fail("Só um Membro ativo abre a reunião.");

  const task = requireTask(state, taskId);
  if (!task) return fail("Reunião não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (effectiveLifecycleOfTask(state, task.id) !== "ativo") {
    return fail("Esta Reunião está arquivada ou na lixeira.");
  }
  const tipo = state.taskTypes.find((t) => t.id === task.taskTypeId);
  if (tipo?.name !== "Reunião") return fail("Esta Tarefa não é uma Reunião.");

  const config = effectiveListConfig(state, task.listId);
  const emAndamento = config?.statusSet.definitions.find((d) => d.category === "emAndamento");
  if (!emAndamento) return fail("A Lista desta Reunião não tem status de andamento.");

  if (statusCategory(state, task) === "emAndamento") return ok(task);
  // INV-TAR-12 — um Apontamento aberto por Membro; a Reunião é um deles.
  const aberto = runningTimer(state, actingMemberId);
  if (aberto) return fail(`Você já tem um cronômetro aberto em “${aberto.task.title}”. Pare-o antes de abrir a Reunião.`);
  if (isTerminalCategory(statusCategory(state, task))) {
    return fail("Esta Reunião já foi encerrada.");
  }

  task.statusId = emAndamento.id;
  // O tempo da call é Apontamento de tempo, que a Tarefa já tem. Inventar um
  // `startedAt` seria um segundo lugar guardando a mesma coisa.
  task.timeEntries.push({
    id: nextId("tme"),
    memberId: actingMemberId,
    start: new Date().toISOString(),
    description: "Reunião",
    createdBy: memberActor(actingMemberId),
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Reunião aberta",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
  });
  return ok(task, task.id);
}

/**
 * Encerrar a reunião conclui a Tarefa. É esse evento que a Automação "Proposta
 * enviada" escuta para mover o Negócio da Call para a Proposta: encerrar sem
 * concluir deixaria o Negócio parado sem ninguém entender por quê.
 */
export function endMeeting(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
): OperationResult<Task> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return fail("Só um Membro ativo encerra a reunião.");

  const task = requireTask(state, taskId);
  if (!task) return fail("Reunião não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (statusCategory(state, task) !== "emAndamento") {
    return fail("Esta Reunião não está em andamento.");
  }

  const config = effectiveListConfig(state, task.listId);
  const concluido = config?.statusSet.definitions.find((d) => d.category === "concluido");
  if (!concluido) return fail("A Lista desta Reunião não tem status de conclusão.");

  task.statusId = concluido.id;
  const aberta = [...task.timeEntries].reverse().find((e) => e.end === undefined);
  const fim = new Date().toISOString();
  if (aberta) {
    aberta.end = fim;
    aberta.durationMinutes = Math.max(
      1,
      Math.round((Date.parse(fim) - Date.parse(aberta.start)) / 60_000),
    );
  }
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Reunião encerrada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    ...(aberta?.durationMinutes ? { detail: `${aberta.durationMinutes} min` } : {}),
  });
  return ok(task, task.id);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Fase 0 do plano de Gestão de Projetos: a Tarefa editável.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Tirar um Responsável. A atribuição não deu permissão, tirar não tira nada além dela. */
export function unassignTask(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  assignee: ActorRef,
): OperationResult<Task> {
  const refusal = taskWriteRefusal(state, actingMemberId, taskId);
  if (refusal) return fail(refusal);
  const task = requireTask(state, taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const escrita = mayWriteTask(state, actingMemberId, taskId);
  if (escrita) return fail(escrita);
  if (effectiveLifecycleOfTask(state, taskId) !== "ativo") return fail("Esta Tarefa não está ativa. Restaure-a para editá-la.");
  const antes = task.assignees.length;
  task.assignees = task.assignees.filter((a) => !(a.kind === assignee.kind && a.id === assignee.id));
  if (task.assignees.length === antes) return ok(task);
  task.updatedAt = now();
  const nome =
    assignee.kind === "member"
      ? (state.members.find((m) => m.id === assignee.id)?.displayName ?? assignee.id)
      : (state.agents.find((a) => a.id === assignee.id)?.name ?? assignee.id);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Responsável removido",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    before: nome,
  });
  return ok(task, task.id);
}

/**
 * Quem pode escrever numa Tarefa (17.1): Membro ativo que não seja Convidado e
 * que a VEJA — a permissão da Tarefa vem da Lista, e quem não alcança a Lista
 * não alcança a Tarefa por id.
 */
function mayWriteTask(state: DataState, actingMemberId: Id, taskId: Id): string | undefined {
  return taskWriteRefusal(state, actingMemberId, taskId);
}

/** Escrita de Campo ou Comentário: a regra geral, ou a exceção da Pessoa da conta. */
function mayWriteFieldOrComment(state: DataState, actingMemberId: Id, taskId: Id): string | undefined {
  if (guestFieldWriter(state, actingMemberId, taskId)) return undefined;
  return taskWriteRefusal(state, actingMemberId, taskId);
}

/** Escrita de Status: a regra geral, ou a exceção do Agente do pipeline (§9). */
function mayWriteTaskStatus(state: DataState, actingMemberId: Id, taskId: Id): string | undefined {
  if (guestStatusWriter(state, actingMemberId, taskId)) return undefined;
  return taskWriteRefusal(state, actingMemberId, taskId);
}

/**
 * §9 do catálogo Solicitação de pagamento — o Agente do pipeline: Convidado
 * cujo Papel concede `editar` restrito a Status. Devolve `true` só quando o
 * Convidado tem essa concessão E alcança a Tarefa; não muda nada além de
 * Status — Tags, Vencimento e os demais Campos seguem a recusa categórica de
 * `taskWriteRefusal` para Convidado, como antes.
 */
export function guestStatusWriter(state: DataState, actingMemberId: Id, taskId: Id): boolean {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return false;
  const role = state.roles.find((r) => r.id === member.roleId);
  if (!role || role.base !== "convidado") return false;
  const podeStatus = role.permissions.some((p) => p.action === "editar" && p.restrictedTo === "status");
  if (!podeStatus) return false;
  return memberSeesTask(state, actingMemberId, taskId);
}

/**
 * A Pessoa da conta: Convidado com `ver` na Tarefa cuja Lista libera alguns
 * Campos para Convidados. Devolve os Campos liberados, ou `undefined` quando o
 * ator não é esse caso — e aí a regra geral (`taskWriteRefusal`) decide.
 */
export function guestFieldWriter(state: DataState, actingMemberId: Id, taskId: Id): readonly Id[] | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return undefined;
  if (state.roles.find((r) => r.id === member.roleId)?.base !== "convidado") return undefined;
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return undefined;
  const liberados = state.lists.find((l) => l.id === task.listId)?.guestEditableDefinitionIds;
  if (!liberados?.length) return undefined;
  return memberSeesTask(state, actingMemberId, taskId) ? liberados : undefined;
}

const valorPreenchido = (value: FieldValue["value"] | undefined): boolean =>
  value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0) && value !== false;

/**
 * Ids literais dos dois Campos "Empresa" do processo financeiro — cada Lista
 * tem o seu próprio (`fld_sp_c_empresa` na Solicitação, `fd_cp_empresa` em
 * Contas a pagar — `../solicitacao-de-pagamento.ts:234` e
 * `../operations/financeiro.ts:35`, e a conversão de um para o outro em
 * `conversao-de-solicitacao.ts:78`, `DE_PARA_DE_CAMPOS`). Literal aqui, e não
 * `CP.fields.empresa` importado de `./financeiro`, pelo mesmo motivo mecânico
 * já documentado em `conversao-de-solicitacao.ts`: `./financeiro.ts` já
 * importa deste arquivo (`addTaskComment`, `createTask`, `setTaskFieldValue`,
 * `trashTask`, `unmetRequirements`) — importar `CP` daqui criaria o ciclo
 * `tasks ⇄ financeiro`.
 */
const CAMPOS_EMPRESA: readonly Id[] = ["fld_sp_c_empresa", "fd_cp_empresa"];

/**
 * D5-06 — o 5º Status "em revisão" (e qualquer Status futuro que alguma
 * Empresa declare) só é alcançável pela Empresa que o declara em
 * `Integration.statusDeclarados` (05-01, `configuracao-por-empresa.ts`). Vale
 * só quando ALGUMA Integração do estado declara o Status alvo — um Status que
 * ninguém declara (os quatro de D-01) nunca é bloqueado por esta regra: sem
 * essa guarda, ela bloquearia tudo em qualquer Espaço sem Integração
 * configurada.
 *
 * CR-04 (05-14, fechamento de lacunas) — chamada dentro de `changeTaskStatus`,
 * não só de `statusOptionRefusal` (a dica da tela): o backend aplica a regra
 * de acesso, não só a tela (CONTEXT.md, regra de arquitetura). `alterarStatusEmLote`
 * (`./lote.ts`) herda a regra sem código próprio, porque chama `changeTaskStatus`
 * por item. Fail-closed: Status declarável por alguém + Tarefa sem Empresa é
 * recusa, não passagem livre — antes desta mudança, uma Tarefa sem Empresa
 * alcançava qualquer Status restrito.
 */
function statusNaoDeclaradoPelaEmpresa(state: DataState, task: Task, alvo: StatusDefinition): string | undefined {
  const declaravelPorAlguem = state.integrations.some((i) => i.statusDeclarados?.includes(alvo.name));
  if (!declaravelPorAlguem) return undefined;
  const empresa = task.fieldValues.find((v) => CAMPOS_EMPRESA.includes(v.definitionId) && v.state === "ativo")?.value;
  if (!empresa) {
    return `Este Status só vale para a Empresa que o declara — defina a Empresa da Tarefa antes de movê-la para “${alvo.name}”.`;
  }
  const integracao = state.integrations.find((i) => i.empresa === empresa);
  if (integracao?.statusDeclarados?.includes(alvo.name)) return undefined;
  // O texto fixo "fluxo do Family Office" fica como está porque hoje ele é o
  // único declarante — generalizar o texto é trabalho de quando existir um
  // segundo declarante (D5-11 aplicado por analogia).
  return `Este Status pertence ao fluxo do Family Office — a Automação desta Empresa não usa “${alvo.name}”.`;
}

/**
 * Por que ESTA opção de Status não pode ser escolhida agora — a mesma frase
 * que `changeTaskStatus` devolveria, dita antes do clique, em qualquer tela.
 */
export function statusOptionRefusal(state: DataState, actingMemberId: Id, task: Task, optionId: Id): string | undefined {
  if (optionId === task.statusId) return undefined;
  const config = effectiveListConfig(state, task.listId);
  const atual = config?.statusSet.definitions.find((d) => d.id === task.statusId);
  const faltando = unmetRequirements(state, task, atual?.exitRequirements ?? []);
  if (atual && faltando.length > 0) return `Para sair de “${atual.name}” falta: ${faltando.join(", ")}.`;
  const alvo = config?.statusSet.definitions.find((d) => d.id === optionId);
  if (alvo) {
    const naoDeclarado = statusNaoDeclaradoPelaEmpresa(state, task, alvo);
    if (naoDeclarado) return naoDeclarado;
  }
  if (alvo?.entryAllowedMemberIds?.length && !alvo.entryAllowedMemberIds.includes(actingMemberId)) {
    const permitidos = alvo.entryAllowedMemberIds;
    const nomes = permitidos.map((id) => state.members.find((m) => m.id === id)?.displayName ?? id);
    // Uma regra que aponta para quem não é Membro do Espaço (ex.: configuração
    // copiada de outro Espaço, ou a pessoa ainda não entrou) trava o Status para
    // todo mundo — a frase diz isso, em vez de só listar ids que ninguém reconhece.
    const ausentes = permitidos.filter((id) => !state.members.some((m) => m.id === id && m.state !== "removido"));
    const aviso =
      ausentes.length === permitidos.length
        ? " Nenhum deles é Membro deste Espaço de Trabalho — ajuste em Configurações da Lista → Status → “Quem pode mover para cá”."
        : ausentes.length > 0
          ? ` (${ausentes.join(", ")} não ${ausentes.length === 1 ? "é Membro" : "são Membros"} deste Espaço de Trabalho.)`
          : "";
    return `Só ${nomes.join(", ")} move para “${alvo.name}”.${aviso}`;
  }
  if (config && atual && alvo) return entryRefusal(state, task, config.statusSet.definitions, atual, alvo);
  return undefined;
}

/** Requisitos de entrada e Status de origem permitidos do Status de destino. */
function entryRefusal(state: DataState, task: Task, definitions: readonly StatusDefinition[], from: StatusDefinition, to: StatusDefinition): string | undefined {
  if (to.entryFromStatusIds?.length && !to.entryFromStatusIds.includes(from.id)) {
    const nomes = to.entryFromStatusIds.map((id) => definitions.find((d) => d.id === id)?.name ?? id).map((n) => `“${n}”`).join(", ");
    return `“${to.name}” só recebe Tarefas vindas de ${nomes}.`;
  }
  const faltando = unmetRequirements(state, task, to.entryRequirements ?? []);
  if (faltando.length > 0) return `Para entrar em “${to.name}” falta: ${faltando.join(", ")}.`;
  return undefined;
}

/** Os requisitos não atendidos, pelo nome — o que a pessoa lê na recusa. */
export function unmetRequirements(state: DataState, task: Task, requirements: readonly FieldRequirement[]): string[] {
  const valorDe = (definitionId: Id) => task.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;
  const faltando: string[] = [];
  for (const req of requirements) {
    if (req.whenDefinitionId) {
      const condicao = valorDe(req.whenDefinitionId);
      if (String(condicao ?? "") !== String(req.whenValue ?? "")) continue;
    }
    if (req.attribute) {
      const presente = req.attribute === "dueDate" ? task.dueDate !== undefined : req.attribute === "startDate" ? task.startDate !== undefined : task.estimate !== undefined;
      if (!presente) faltando.push(req.label ?? (req.attribute === "dueDate" ? "Data de vencimento" : req.attribute === "startDate" ? "Data de início" : "Estimativa"));
      continue;
    }
    if (req.definitionId) {
      const valor = valorDe(req.definitionId);
      const nome = req.label ?? state.fieldDefinitions.find((d) => d.id === req.definitionId)?.name ?? req.definitionId;
      if (!valorPreenchido(valor)) faltando.push(nome);
      else if (req.positive && !(Number(valor) > 0)) faltando.push(`${nome} maior que zero`);
    }
  }
  return faltando;
}

/** 17.1 — criar Tarefa exige alcançar a Lista; o Convidado nunca cria. */
export function listWriteRefusal(state: DataState, actingMemberId: Id, listId: Id): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo cria Tarefa.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") return "Um Convidado não cria Tarefa.";
  if (!memberReachesContainer(state, actingMemberId, "list", listId)) return "Você não tem acesso a esta Lista.";
  return undefined;
}

function isWorkspaceAdmin(state: DataState, memberId: Id): boolean {
  const base = state.roles.find((r) => r.id === state.members.find((m) => m.id === memberId)?.roleId)?.base;
  return base === "proprietario" || base === "administrador";
}

function requireActiveTask(state: DataState, taskId: Id): Task | string {
  const task = requireTask(state, taskId);
  if (!task) return "Tarefa não encontrada.";
  if (effectiveLifecycleOfTask(state, taskId) !== "ativo") {
    return "Esta Tarefa não está ativa. Restaure-a para editá-la.";
  }
  return task;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  urgente: "urgente",
  alta: "alta",
  normal: "normal",
  baixa: "baixa",
  semPrioridade: "sem prioridade",
};

/**
 * Dia civil é o dia inteiro (6.2): como início conta do começo, como vencimento
 * até o fim. O dia é lido no fuso de quem usa — o mesmo em que o instante foi
 * digitado — para "20/09 23:00" não cair no dia 21 por causa do UTC.
 */
const dateMs = (date: TaskDate | undefined, edge: "inicio" | "fim" = "inicio"): number | undefined => {
  if (!date) return undefined;
  if (date.form === "instant") return Date.parse(date.value);
  const [y, m, d] = date.value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return edge === "inicio" ? new Date(y, m - 1, d, 0, 0, 0, 0).getTime() : new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
};

const dateKey = (date: TaskDate | undefined): string | undefined => date?.value;

export interface UpdateTaskInput {
  readonly title?: string;
  readonly description?: string;
  readonly priority?: Priority;
  /** `null` limpa a data; `undefined` não toca nela. */
  readonly startDate?: TaskDate | null;
  readonly dueDate?: TaskDate | null;
  readonly estimate?: Minutes | null;
  readonly taskTypeId?: Id;
}

/**
 * Edita os atributos nativos da Tarefa (ontologia 6.1). Cada campo alterado
 * vira um Registro de Atividade com antes → depois; o que não mudou não gera
 * ruído. Início nunca fica depois do vencimento (6.2).
 */
export function updateTask(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  input: UpdateTaskInput,
): OperationResult<Task> {
  const refusal = taskWriteRefusal(state, actingMemberId, taskId);
  if (refusal) return fail(refusal);
  const task = requireActiveTask(state, taskId);
  if (typeof task === "string") return fail(task);
  const features = effectiveListConfig(state, task.listId)?.features;

  const mudancas: Array<{ readonly action: string; readonly before?: string; readonly after?: string }> = [];

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return fail("O título da Tarefa não pode ficar vazio.", "titulo");
    if (title !== task.title) {
      mudancas.push({ action: "Título alterado", before: task.title, after: title });
      task.title = title;
    }
  }
  if (input.description !== undefined && input.description !== task.description) {
    mudancas.push({ action: "Descrição alterada" });
    task.description = input.description;
  }
  if (input.priority !== undefined && input.priority !== task.priority) {
    if (features && !features.prioridade) return fail("Esta Lista não usa Prioridade.", "prioridade");
    if (!(input.priority in PRIORITY_LABEL)) return fail("Prioridade inválida.", "prioridade");
    mudancas.push({ action: "Prioridade alterada", before: PRIORITY_LABEL[task.priority], after: PRIORITY_LABEL[input.priority] });
    task.priority = input.priority;
  }

  const startDate = input.startDate === undefined ? task.startDate : input.startDate ?? undefined;
  const dueDate = input.dueDate === undefined ? task.dueDate : input.dueDate ?? undefined;
  const inicio = dateKey(startDate);
  const fim = dateKey(dueDate);
  const inicioMs = dateMs(startDate, "inicio");
  const fimMs = dateMs(dueDate, "fim");
  if (inicioMs !== undefined && fimMs !== undefined && inicioMs > fimMs) return fail("O início não pode ficar depois do vencimento.", "inicio");
  // 6.2 — com a funcionalidade ligada, as datas da Subtarefa cabem nas da mãe: vale
  // quando a filha se estica e quando a mãe encolhe.
  if (features?.datasDeSubtarefasContidas && (input.startDate !== undefined || input.dueDate !== undefined)) {
    if (task.parentTaskId) {
      const mae = requireTask(state, task.parentTaskId);
      const fimDaMae = dateMs(mae?.dueDate, "fim");
      const inicioDaMae = dateMs(mae?.startDate, "inicio");
      if (fimMs !== undefined && fimDaMae !== undefined && fimMs > fimDaMae) {
        return fail("A Subtarefa não pode vencer depois da Tarefa mãe: esta Lista exige datas contidas.", "vencimento");
      }
      if (inicioMs !== undefined && inicioDaMae !== undefined && inicioMs < inicioDaMae) {
        return fail("A Subtarefa não pode começar antes da Tarefa mãe: esta Lista exige datas contidas.", "inicio");
      }
    }
    const filhas = state.tasks.filter((t) => t.parentTaskId === task.id && t.lifecycle === "ativo");
    for (const filha of filhas) {
      const fimDaFilha = dateMs(filha.dueDate, "fim");
      const inicioDaFilha = dateMs(filha.startDate, "inicio");
      if (fimMs !== undefined && fimDaFilha !== undefined && fimDaFilha > fimMs) {
        return fail(`A Subtarefa “${filha.title}” vence depois: esta Lista exige datas contidas.`, "vencimento");
      }
      if (inicioMs !== undefined && inicioDaFilha !== undefined && inicioDaFilha < inicioMs) {
        return fail(`A Subtarefa “${filha.title}” começa antes: esta Lista exige datas contidas.`, "inicio");
      }
    }
  }

  if (input.startDate !== undefined && dateKey(task.startDate) !== inicio) {
    mudancas.push({ action: "Início alterado", ...(task.startDate ? { before: dateKey(task.startDate) } : {}), ...(inicio ? { after: inicio } : {}) });
    if (startDate) task.startDate = startDate;
    else delete task.startDate;
  }
  if (input.dueDate !== undefined && dateKey(task.dueDate) !== fim) {
    mudancas.push({ action: "Vencimento alterado", ...(task.dueDate ? { before: dateKey(task.dueDate) } : {}), ...(fim ? { after: fim } : {}) });
    if (dueDate) task.dueDate = dueDate;
    else delete task.dueDate;
  }
  if (input.estimate !== undefined) {
    if (features && !features.estimativa) return fail("Esta Lista não usa Estimativa.", "estimativa");
    const estimate = input.estimate ?? undefined;
    if (estimate !== undefined && (!Number.isFinite(estimate) || estimate < 0)) {
      return fail("A estimativa é em minutos e não pode ser negativa.", "estimativa");
    }
    if (estimate !== task.estimate) {
      mudancas.push({ action: "Estimativa alterada", ...(task.estimate !== undefined ? { before: `${task.estimate} min` } : {}), ...(estimate !== undefined ? { after: `${estimate} min` } : {}) });
      if (estimate !== undefined) task.estimate = estimate;
      else delete task.estimate;
    }
  }

  if (input.taskTypeId !== undefined && input.taskTypeId !== task.taskTypeId) {
    const config = effectiveListConfig(state, task.listId);
    if (!config?.taskTypeIds.includes(input.taskTypeId)) return fail("Este Tipo de Tarefa não alcança esta Lista.", "tipo");
    const nomeDe = (id: Id) => state.taskTypes.find((t) => t.id === id)?.name ?? id;
    mudancas.push({ action: "Tipo alterado", before: nomeDe(task.taskTypeId), after: nomeDe(input.taskTypeId) });
    task.taskTypeId = input.taskTypeId;
  }

  if (mudancas.length === 0) return ok(task);
  task.updatedAt = now();
  for (const mudanca of mudancas) {
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: mudanca.action,
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
      ...(mudanca.before !== undefined ? { before: mudanca.before } : {}),
      ...(mudanca.after !== undefined ? { after: mudanca.after } : {}),
    });
  }
  return ok(task, task.id);
}

/**
 * Valor de Campo da Tarefa (7.4). A Tarefa só aceita as Definições que a sua
 * Lista herda (B25): uma Definição de outro contêiner é recusada mesmo que
 * exista. O espelho de `setDealFieldValue`, com a mesma leitura de tipo.
 */
/**
 * Quem pode escrever este Campo nesta Tarefa, e se o Campo vale aqui: a regra
 * geral, a exceção da Pessoa da conta (só os Campos liberados), Campo ativo,
 * de Tarefa, não fórmula e da Lista da Tarefa. É o começo de
 * `setTaskFieldValue`, exportado para quem grava um Campo por outro caminho
 * (o anexo enviado ao Storage, `anexos-enviados.ts`) seguir a MESMA regra.
 */
export function escritaDeCampo(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  definitionId: Id,
): { readonly task: Task; readonly definition: FieldDefinition } | { readonly erro: string; readonly campo?: Id } {
  const refusal = mayWriteFieldOrComment(state, actingMemberId, taskId);
  if (refusal) return { erro: refusal };
  const task = requireActiveTask(state, taskId);
  if (typeof task === "string") return { erro: task };

  const definition = state.fieldDefinitions.find((d) => d.id === definitionId);
  if (!definition) return { erro: "Campo não encontrado." };
  if (definition.target !== "task") return { erro: "Este Campo não é de Tarefa." };
  const liberadosAoConvidado = guestFieldWriter(state, actingMemberId, taskId);
  if (liberadosAoConvidado && !liberadosAoConvidado.includes(definitionId)) {
    return { erro: `Como Convidado, você só preenche ${liberadosAoConvidado.map((id) => state.fieldDefinitions.find((d) => d.id === id)?.name ?? id).join(" e ")} nesta Tarefa.` };
  }
  if (definition.lifecycle !== "ativo") return { erro: "Este Campo está arquivado." };
  if (definition.type === "formula") return { erro: "Fórmula é calculada, não gravada (6.3).", campo: definitionId };
  const config = effectiveListConfig(state, task.listId);
  if (!config || !config.fieldDefinitionIds.includes(definitionId)) {
    return { erro: `O Campo “${definition.name}” não se aplica à Lista desta Tarefa.`, campo: definitionId };
  }
  return { task, definition };
}

/** Os ids de Arquivo que um valor de Campo de arquivo guarda: lista de ids, ou o nome solto de antes (que não é id). */
export function idsDeArquivoDoValor(state: DataState, value: FieldValue["value"] | undefined): Id[] {
  const brutos = typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  return brutos.filter((id) => state.files.some((f) => f.id === id));
}

export function setTaskFieldValue(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  definitionId: Id,
  value: FieldValue["value"],
): OperationResult<Task> {
  const escrita = escritaDeCampo(state, actingMemberId, taskId, definitionId);
  if ("erro" in escrita) return fail(escrita.erro, escrita.campo);
  const { task, definition } = escrita;

  const vazio = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  if (definition.required && vazio) return fail(`${definition.name} é obrigatório.`, definitionId);

  // O que se grava é o tipo da Definição, não o que chegou: texto vira string,
  // número vira number, seleção múltipla vira lista sem repetição.
  let gravar: FieldValue["value"] = null;
  if (!vazio) {
    switch (definition.type) {
      case "singleSelect": {
        const escolha = String(value);
        if (!(definition.options ?? []).includes(escolha)) return fail(`“${escolha}” não é uma opção de ${definition.name}.`, definitionId);
        gravar = escolha;
        break;
      }
      case "multiSelect": {
        const escolhidos = [...new Set((Array.isArray(value) ? value : [value]).map(String))];
        const fora = escolhidos.find((v) => !(definition.options ?? []).includes(v));
        if (fora) return fail(`“${fora}” não é uma opção de ${definition.name}.`, definitionId);
        gravar = escolhidos;
        break;
      }
      case "number":
      case "currency":
      case "percent": {
        const numero = typeof value === "number" ? value : Number(String(value).replace(",", "."));
        if (!Number.isFinite(numero)) return fail(`${definition.name} precisa ser um número.`, definitionId);
        if (definition.type === "percent" && (numero < 0 || numero > 100)) return fail(`${definition.name} vai de 0 a 100.`, definitionId);
        gravar = numero;
        break;
      }
      case "checkbox":
        gravar = value === true || value === "true";
        break;
      case "person": {
        const membro = state.members.find((m) => m.id === value);
        if (!membro) return fail(`${definition.name} precisa apontar para um Membro.`, definitionId);
        gravar = membro.id;
        break;
      }
      case "date": {
        const texto = String(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(Date.parse(`${texto}T00:00:00Z`))) {
          return fail(`${definition.name} precisa ser uma data (AAAA-MM-DD).`, definitionId);
        }
        gravar = texto;
        break;
      }
      case "dateTime": {
        const instante = Date.parse(String(value));
        if (Number.isNaN(instante)) return fail(`${definition.name} precisa ser uma data e hora.`, definitionId);
        gravar = new Date(instante).toISOString();
        break;
      }
      case "email": {
        const texto = String(value).trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) return fail(`${definition.name} precisa ser um e-mail.`, definitionId);
        gravar = texto;
        break;
      }
      case "url": {
        const texto = String(value).trim();
        if (!/^https?:\/\//.test(texto)) return fail(`${definition.name} precisa começar com http:// ou https://.`, definitionId);
        gravar = texto;
        break;
      }
      case "file": {
        // Uma lista de ids só REMOVE: todo id tem de já estar neste Campo. Um
        // arquivo novo entra pelo envio ao Storage (`anexarArquivoEnviado`),
        // que confere o objeto no servidor — nunca por um id escolhido aqui.
        // O nome solto de antes (texto) continua aceito; um texto que é o id de um Arquivo, não:
        // seria um Arquivo de outra Tarefa ou de outro Formulário escolhido à mão, sem passar
        // pelo Storage — e depois a lista "só remove" o aceitaria como já presente (revisão de código).
        if (typeof value === "string") {
          const atual = task.fieldValues.find((v) => v.definitionId === definitionId)?.value;
          if (value !== atual && state.files.some((f) => f.id === value.trim())) {
            return fail(`Para pôr um arquivo novo em ${definition.name}, envie o arquivo pela tela.`, definitionId);
          }
          gravar = value;
          break;
        }
        if (!Array.isArray(value)) return fail(`${definition.name} é uma lista de arquivos.`, definitionId);
        const atuais = new Set(idsDeArquivoDoValor(state, task.fieldValues.find((v) => v.definitionId === definitionId)?.value));
        const pedidos = [...new Set(value.map(String))];
        if (pedidos.some((id) => !atuais.has(id))) {
          return fail(`Para pôr um arquivo novo em ${definition.name}, envie o arquivo pela tela.`, definitionId);
        }
        gravar = pedidos;
        break;
      }
      default:
        if (typeof value !== "string") return fail(`${definition.name} é texto.`, definitionId);
        gravar = value;
    }
  }

  const existente = task.fieldValues.find((v) => v.definitionId === definitionId);
  if (existente?.state === "arquivado") return fail("Este Valor está arquivado: ele é preservado, não editado.");
  const antes = existente?.value;
  if (existente) existente.value = gravar;
  else task.fieldValues.push({ definitionId, value: gravar, state: "ativo" });
  task.updatedAt = now();

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: `${definition.name} alterado`,
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    ...(antes !== undefined && antes !== null && antes !== "" ? { before: String(antes) } : {}),
    ...(vazio ? {} : { after: String(gravar) }),
  });
  return ok(task, task.id);
}

/**
 * Comentário na Tarefa (7.1). O autor é imutável; o conteúdo se corrige por
 * `editTaskComment` e se exclui por `deleteTaskComment` (RN-TAR-13). Um
 * Agente comenta em nome de quem o acionou (`authorDelegate`, A6.2).
 * A resposta aponta para o Comentário raiz — a ontologia tem um nível de thread.
 */
export function addTaskComment(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  input: {
    readonly content: string;
    readonly parentCommentId?: Id;
    readonly mentions?: ReadonlyArray<{ readonly type: string; readonly id: Id }>;
    readonly actor?: ActorRef;
  },
): OperationResult<Comment> {
  const refusal = guestFieldWriter(state, actingMemberId, taskId) ? undefined : taskCommentRefusal(state, actingMemberId, taskId);
  if (refusal) return fail(refusal);
  const task = requireActiveTask(state, taskId);
  if (typeof task === "string") return fail(task);
  const content = input.content.trim();
  if (!content) return fail("Escreva o comentário antes de enviar.", "conteudo");
  // O autor é quem agiu, ou um Agente ativo agindo em nome de quem agiu — nunca outro Membro.
  if (input.actor) {
    if (input.actor.kind === "member" && input.actor.id !== actingMemberId) {
      return fail("Um Membro não comenta em nome de outro Membro.");
    }
    if (input.actor.kind === "agent") {
      const agent = state.agents.find((a) => a.id === input.actor?.id);
      if (!agent || agent.lifecycle !== "ativo") return fail("O Agente autor precisa existir e estar ativo.");
    }
    if (input.actor.kind === "automation") {
      const automation = state.automations.find((a) => a.id === input.actor?.id);
      if (!automation || automation.lifecycle !== "ativo") return fail("A Automação autora precisa existir e estar ativa.");
    }
  }

  let parentCommentId: Id | undefined;
  if (input.parentCommentId) {
    const pai = task.comments.find((c) => c.id === input.parentCommentId && !c.deletedAt);
    if (!pai) return fail("O Comentário respondido não existe mais.");
    // Responder a uma resposta pendura no mesmo fio: um nível só.
    parentCommentId = pai.parentCommentId ?? pai.id;
  }
  for (const mention of input.mentions ?? []) {
    if (mention.type === "member" && !state.members.some((m) => m.id === mention.id)) {
      return fail("A menção aponta para um Membro que não existe.");
    }
  }

  const actor = input.actor ?? memberActor(actingMemberId);
  // 06-19 (crm2:WR-01) — o registro humano do lançamento (o diálogo "Lançado
  // no Omie", que compõe esta operação com `textoDoLancamentoHumano`) não
  // pode acontecer enquanto o Agente lança a conta: seriam dois títulos. É o
  // molde de `resolveTaskComment` (06-11), que consulta a Conferência por
  // `./financeiro-base`. Comentários comuns, e os do Agente, passam.
  if (actor.kind === "member" && content.startsWith(PREFIXO_LANCAMENTO_HUMANO)) {
    const emCurso = lancamentoEmCursoDe(state, task);
    if (emCurso && emCurso.porMembroId !== actingMemberId) return fail(RECUSA_LANCAMENTO_EM_CURSO);
  }
  const comment: Comment = {
    id: nextId("cmt"),
    author: actor,
    ...(actor.kind !== "member" ? { authorDelegate: memberActor(actingMemberId) } : {}),
    content,
    attachments: [],
    mentions: [...(input.mentions ?? [])],
    ...(parentCommentId ? { parentCommentId } : {}),
    createdAt: now(),
  };
  task.comments.push(comment);
  task.updatedAt = now();
  recordActivity(state, {
    actor,
    ...(actor.kind !== "member" ? { delegate: memberActor(actingMemberId) } : {}),
    action: parentCommentId ? "Resposta a Comentário" : "Comentário na Tarefa",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: content.length > 80 ? `${content.slice(0, 77)}…` : content,
  });
  return ok(comment, comment.id);
}

/**
 * RN-TAR-13 — só o autor (ou quem o Agente representou), ou quem tem
 * `administrar` sobre a Tarefa ou sobre a Lista, edita ou exclui um
 * Comentário. O autor do registro é imutável; o conteúdo não.
 */
function commentEditRefusal(state: DataState, actingMemberId: Id, task: Task, comment: Comment): string | undefined {
  const base = taskCommentRefusal(state, actingMemberId, task.id);
  if (base) return base;
  const autorId = comment.author.kind === "member" ? comment.author.id : comment.authorDelegate?.id;
  if (autorId === actingMemberId) return undefined;
  if (isWorkspaceAdmin(state, actingMemberId) || containerAdminRefusal(state, actingMemberId, "list", task.listId) === undefined) return undefined;
  return "Só quem escreveu o Comentário, ou quem administra a Lista, o edita ou exclui.";
}

/** FUND-10 — corrigir o próprio Comentário: o conteúdo muda e `editedAt` marca; o autor e a hora de criação ficam. */
export function editTaskComment(state: DataState, actingMemberId: Id, taskId: Id, commentId: Id, content: string): OperationResult<Comment> {
  const task = requireActiveTask(state, taskId);
  if (typeof task === "string") return fail(task);
  const comment = task.comments.find((c) => c.id === commentId && !c.deletedAt);
  if (!comment) return fail("Comentário não encontrado.");
  const refusal = commentEditRefusal(state, actingMemberId, task, comment);
  if (refusal) return fail(refusal);
  const novo = content.trim();
  if (!novo) return fail("Escreva o comentário antes de salvar.", "conteudo");
  if (novo === comment.content) return ok(comment);
  const antes = comment.content;
  comment.content = novo;
  comment.editedAt = now();
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Comentário editado",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    before: antes.length > 80 ? `${antes.slice(0, 77)}…` : antes,
    after: novo.length > 80 ? `${novo.slice(0, 77)}…` : novo,
  });
  return ok(comment);
}

/**
 * FUND-10 — excluir deixa o marcador "Comentário excluído" que preserva o
 * encadeamento (RN-TAR-13): o registro fica, sem conteúdo, com `deletedAt`;
 * as respostas continuam penduradas nele. O fato vai ao Registro de Atividade.
 */
export function deleteTaskComment(state: DataState, actingMemberId: Id, taskId: Id, commentId: Id): OperationResult<Comment> {
  const task = requireActiveTask(state, taskId);
  if (typeof task === "string") return fail(task);
  const comment = task.comments.find((c) => c.id === commentId);
  if (!comment) return fail("Comentário não encontrado.");
  if (comment.deletedAt) return ok(comment);
  const refusal = commentEditRefusal(state, actingMemberId, task, comment);
  if (refusal) return fail(refusal);
  const resumo = comment.content.length > 80 ? `${comment.content.slice(0, 77)}…` : comment.content;
  comment.content = "";
  comment.deletedAt = now();
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: comment.parentCommentId ? "Resposta excluída" : "Comentário excluído",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    before: resumo,
  });
  return ok(comment);
}

/** Resolver marca o fio como tratado; reabrir tira a marca. Nunca apaga. */
export function resolveTaskComment(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  commentId: Id,
  resolved: boolean,
): OperationResult<Comment> {
  const refusal = mayWriteTask(state, actingMemberId, taskId);
  if (refusal) return fail(refusal);
  const task = requireActiveTask(state, taskId);
  if (typeof task === "string") return fail(task);
  const comment = task.comments.find((c) => c.id === commentId && !c.deletedAt);
  if (!comment) return fail("Comentário não encontrado.");
  if (comment.parentCommentId) return fail("Resolva o fio pelo Comentário que o abriu.");
  // 17.1 — `comentar` resolve os próprios fios; os de terceiros são `administrar`.
  const autorId = comment.author.kind === "member" ? comment.author.id : comment.authorDelegate?.id;
  // Fase 6 — o fio do Resumo é aberto pelo Agente em nome do serviço; quem o
  // confere precisa poder fechá-lo à mão também (no ClickUp, "Resolvido" pela Maryane).
  // 06-11 (crm:IN-02): só para RESOLVER, e só quem confere a Conferência
  // VIGENTE deste fio — o aprovador dela ou um revisor do Resumo; o aprovador
  // de uma Conferência cancelada não. Reabrir o fio NÃO reabre a Conferência,
  // cuja decisão fica: por isso reabrir é gesto de quem abriu o fio ou de
  // Administrador, como antes da Fase 6.
  const vigente = resolved ? conferenciaVigente(state, taskId) : undefined;
  const confereEsteFio =
    vigente !== undefined &&
    vigente.origin.threadCommentId === commentId &&
    (vigente.approverMemberId === actingMemberId || revisoresDoResumo(state).includes(actingMemberId));
  if (autorId !== actingMemberId && !confereEsteFio && !isWorkspaceAdmin(state, actingMemberId)) {
    return fail("Só quem abriu o fio, ou um Administrador, o resolve.");
  }

  if (resolved) comment.resolved = { by: actingMemberId, at: now() };
  else delete comment.resolved;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: resolved ? "Comentário resolvido" : "Comentário reaberto",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
  });
  return ok(comment, comment.id);
}

/** As Tags da Tarefa, do Catálogo do Espaço de Trabalho; nunca uma solta. */
export function setTaskTags(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  tagIds: readonly Id[],
): OperationResult<Task> {
  const refusal = mayWriteTask(state, actingMemberId, taskId);
  if (refusal) return fail(refusal);
  const task = requireActiveTask(state, taskId);
  if (typeof task === "string") return fail(task);

  const unicos = [...new Set(tagIds)];
  for (const tagId of unicos) {
    const tag = state.tags.find((t) => t.id === tagId);
    if (!tag) return fail("Tag não encontrada.");
    if (tag.lifecycle !== "ativo") return fail(`A Tag “${tag.name}” não está ativa.`);
  }
  const antes = task.tagIds.map((id) => state.tags.find((t) => t.id === id)?.name ?? id).join(", ");
  const depois = unicos.map((id) => state.tags.find((t) => t.id === id)?.name ?? id).join(", ");
  if (antes === depois) return ok(task);
  task.tagIds = unicos;
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tags alteradas",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    before: antes || "—",
    after: depois || "—",
  });
  return ok(task, task.id);
}

/**
 * Observar é receber o que acontece sem ser Responsável. Qualquer Membro ativo
 * observa a si mesmo; pôr outro como observador exige poder escrever na Tarefa.
 */
export function watchTask(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  memberId: Id,
  watching: boolean,
): OperationResult<Task> {
  const acting = state.members.find((m) => m.id === actingMemberId);
  if (!acting || acting.state !== "ativo") return fail("Só um Membro ativo observa Tarefa.");
  if (memberId === actingMemberId) {
    if (!memberSeesTask(state, actingMemberId, taskId)) return fail("Você não tem acesso a esta Tarefa.");
  } else {
    const refusal = mayWriteTask(state, actingMemberId, taskId);
    if (refusal) return fail(refusal);
    if (!memberSeesTask(state, memberId, taskId)) return fail("Esse Membro não tem acesso a esta Tarefa.");
  }
  const task = requireActiveTask(state, taskId);
  if (typeof task === "string") return fail(task);
  const alvo = state.members.find((m) => m.id === memberId);
  if (!alvo || alvo.state !== "ativo") return fail("Só um Membro ativo pode observar.");

  const ja = task.observerMemberIds.includes(memberId);
  if (watching === ja) return ok(task);
  task.observerMemberIds = watching
    ? [...task.observerMemberIds, memberId]
    : task.observerMemberIds.filter((id) => id !== memberId);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: watching ? "Observador adicionado" : "Observador removido",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: alvo.displayName,
  });
  return ok(task, task.id);
}
