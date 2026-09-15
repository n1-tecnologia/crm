/**
 * Fase 2 da Gestão de Projetos: o ciclo diário de quem trabalha numa Tarefa.
 * Dependências sem ciclo, tempo lançado ou cronometrado, anexos que apontam
 * para Arquivo (A8) e Recorrência que gera a próxima ocorrência ao concluir.
 */

import { civilOf, civilPlusDays, effectiveLifecycleOfTask, effectiveListConfig, isTerminalCategory, statusCategory, taskWriteRefusal } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { ActorRef, Attachment, Checklist, Dependency, DependencyKind, Id, RecurrenceRule, Task, TaskDate, TimeEntry, WorkspaceFile } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { runListAutomations } from "./automations";

const now = (): string => new Date().toISOString();

function activeTask(state: DataState, actingMemberId: Id, taskId: Id): Task | string {
  const refusal = taskWriteRefusal(state, actingMemberId, taskId);
  if (refusal) return refusal;
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return "Tarefa não encontrada.";
  if (effectiveLifecycleOfTask(state, taskId) !== "ativo") return "Esta Tarefa não está ativa. Restaure-a para editá-la.";
  return task;
}

/* ───────────────────────────── Dependências ───────────────────────────── */

const INVERSE: Record<DependencyKind, DependencyKind> = {
  bloqueia: "eBloqueadaPor",
  eBloqueadaPor: "bloqueia",
  aguarda: "aguarda",
};

const KIND_LABEL: Record<DependencyKind, string> = {
  bloqueia: "bloqueia",
  eBloqueadaPor: "é bloqueada por",
  aguarda: "aguarda",
};

/**
 * Quem esta Tarefa bloqueia, lendo as duas pontas: o `bloqueia` gravado nela e
 * o `eBloqueadaPor` gravado nas outras. Um registro de um lado só (dado antigo)
 * ainda conta, senão o espelho fecharia um ciclo de dois.
 */
function blockedBy(state: DataState, taskId: Id): Id[] {
  const own = state.tasks.find((t) => t.id === taskId)?.dependencies.filter((d) => d.kind === "bloqueia").map((d) => d.taskId) ?? [];
  const mirrored = state.tasks.filter((t) => t.dependencies.some((d) => d.kind === "eBloqueadaPor" && d.taskId === taskId)).map((t) => t.id);
  return [...new Set([...own, ...mirrored])];
}

/** Há caminho de bloqueio de `from` até `to`? (para recusar A→…→A) */
function reaches(state: DataState, from: Id, to: Id, seen = new Set<Id>()): boolean {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return blockedBy(state, from).some((next) => reaches(state, next, to, seen));
}

function isAncestorOrDescendant(state: DataState, a: Task, b: Task): boolean {
  const up = (t: Task): Id[] => {
    const ids: Id[] = [];
    let current: Task | undefined = t;
    while (current?.parentTaskId) {
      ids.push(current.parentTaskId);
      current = state.tasks.find((x) => x.id === current?.parentTaskId);
    }
    return ids;
  };
  return up(a).includes(b.id) || up(b).includes(a.id);
}

/**
 * "A bloqueia B" grava nas duas: A ganha `bloqueia B`, B ganha `eBloqueadaPor A`.
 * `aguarda` é simétrica. Como as duas Tarefas mudam, quem age precisa escrever
 * nas duas (RN-TAR-16); e nunca entre ancestral e descendente (INV-TAR-09).
 */
export function addDependency(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  kind: DependencyKind,
  otherTaskId: Id,
): OperationResult<Dependency> {
  const task = activeTask(state, actingMemberId, taskId);
  if (typeof task === "string") return fail(task);
  if (otherTaskId === taskId) return fail("Uma Tarefa não depende de si mesma.");
  const other = activeTask(state, actingMemberId, otherTaskId);
  if (typeof other === "string") return fail(`A outra Tarefa: ${other}`);
  if (isAncestorOrDescendant(state, task, other)) return fail("Dependência não liga uma Tarefa a uma Subtarefa dela nem à Tarefa mãe.");
  if (task.dependencies.some((d) => d.taskId === otherTaskId) || other.dependencies.some((d) => d.taskId === taskId)) {
    return fail("Já existe uma Dependência entre estas Tarefas.");
  }
  if (!effectiveListConfig(state, task.listId)?.features.dependencias) return fail("Esta Lista não usa Dependências.");
  if (!effectiveListConfig(state, other.listId)?.features.dependencias) return fail("A Lista da outra Tarefa não usa Dependências.");

  // Ciclo: se esta Tarefa vai bloquear a outra, a outra não pode já bloquear esta (por qualquer caminho).
  const blocker = kind === "bloqueia" ? taskId : kind === "eBloqueadaPor" ? otherTaskId : null;
  const blocked = kind === "bloqueia" ? otherTaskId : kind === "eBloqueadaPor" ? taskId : null;
  if (blocker && blocked && reaches(state, blocked, blocker)) {
    return fail("Isso fecharia um ciclo: a outra Tarefa já bloqueia esta por algum caminho.");
  }

  const dependency: Dependency = { id: nextId("dep"), kind, taskId: otherTaskId };
  task.dependencies.push(dependency);
  other.dependencies.push({ id: nextId("dep"), kind: INVERSE[kind], taskId });
  task.updatedAt = now();
  other.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Dependência adicionada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: `${KIND_LABEL[kind]} “${other.title}”`,
  });
  return ok(dependency);
}

export function removeDependency(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  dependencyId: Id,
): OperationResult<Task> {
  const task = activeTask(state, actingMemberId, taskId);
  if (typeof task === "string") return fail(task);
  const dependency = task.dependencies.find((d) => d.id === dependencyId);
  if (!dependency) return fail("Dependência não encontrada.");
  const other = state.tasks.find((t) => t.id === dependency.taskId);
  if (other) {
    const refusal = taskWriteRefusal(state, actingMemberId, other.id);
    if (refusal) return fail(`A outra Tarefa: ${refusal}`);
  }
  task.dependencies = task.dependencies.filter((d) => d.id !== dependencyId);
  if (other) {
    other.dependencies = other.dependencies.filter((d) => !(d.taskId === taskId && d.kind === INVERSE[dependency.kind]));
    other.updatedAt = now();
  }
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Dependência removida",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: `${KIND_LABEL[dependency.kind]} “${other?.title ?? dependency.taskId}”`,
  });
  return ok(task);
}

/* ───────────────────────────── Tempo ───────────────────────────── */

/** Lançamento manual: uma duração, com a data em que foi feita e uma nota. */
export function addTimeEntry(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  input: { readonly durationMinutes: number; readonly on?: string; readonly description?: string },
): OperationResult<TimeEntry> {
  const task = activeTask(state, actingMemberId, taskId);
  if (typeof task === "string") return fail(task);
  if (!effectiveListConfig(state, task.listId)?.features.registroDeTempo) return fail("Esta Lista não usa Registro de Tempo.");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) return fail("A duração é em minutos inteiros, no mínimo 1.", "duracao");
  if (input.durationMinutes > 24 * 60) return fail("Um lançamento não passa de 24 horas.", "duracao");
  const quando = input.on ? Date.parse(input.on) : Date.now();
  if (Number.isNaN(quando)) return fail("Data inválida.", "data");
  if (quando > Date.now() + 60_000) return fail("Não se lança tempo no futuro.", "data");

  const start = new Date(quando - input.durationMinutes * 60_000).toISOString();
  const entry: TimeEntry = {
    id: nextId("tme"),
    memberId: actingMemberId,
    start,
    end: new Date(quando).toISOString(),
    durationMinutes: input.durationMinutes,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    createdBy: memberActor(actingMemberId),
  };
  task.timeEntries.push(entry);
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tempo registrado",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    after: `${entry.durationMinutes} min`,
  });
  return ok(entry);
}

/** O cronômetro aberto do Membro, em qualquer Tarefa: um por vez. */
export function runningTimer(state: DataState, memberId: Id): { task: Task; entry: TimeEntry } | undefined {
  for (const task of state.tasks) {
    const entry = task.timeEntries.find((e) => e.memberId === memberId && e.end === undefined);
    if (entry) return { task, entry };
  }
  return undefined;
}

export function startTimer(state: DataState, actingMemberId: Id, taskId: Id): OperationResult<TimeEntry> {
  const task = activeTask(state, actingMemberId, taskId);
  if (typeof task === "string") return fail(task);
  if (!effectiveListConfig(state, task.listId)?.features.registroDeTempo) return fail("Esta Lista não usa Registro de Tempo.");
  const aberto = runningTimer(state, actingMemberId);
  if (aberto) return fail(`Você já tem um cronômetro aberto em “${aberto.task.title}”. Pare-o antes.`);
  const entry: TimeEntry = { id: nextId("tme"), memberId: actingMemberId, start: now(), createdBy: memberActor(actingMemberId) };
  task.timeEntries.push(entry);
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Cronômetro iniciado", objectType: "task", objectId: task.id, objectName: task.title });
  return ok(entry);
}

/** Uma Reunião em andamento é um cronômetro que só `endMeeting` fecha. */
export function meetingInProgress(state: DataState, task: Task): boolean {
  return state.taskTypes.find((t) => t.id === task.taskTypeId)?.name === "Reunião" && statusCategory(state, task) === "emAndamento";
}

export function stopTimer(state: DataState, actingMemberId: Id, taskId: Id, description?: string): OperationResult<TimeEntry> {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const entry = task.timeEntries.find((e) => e.memberId === actingMemberId && e.end === undefined);
  if (!entry) return fail("Você não tem cronômetro aberto nesta Tarefa.");
  if (meetingInProgress(state, task)) return fail("Esta Reunião está em andamento: encerre a Reunião para fechar o tempo.");
  entry.end = now();
  entry.durationMinutes = Math.max(1, Math.round((Date.parse(entry.end) - Date.parse(entry.start)) / 60_000));
  if (description?.trim()) entry.description = description.trim();
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Cronômetro parado",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    after: `${entry.durationMinutes} min`,
  });
  return ok(entry);
}

/* ───────────────────────────── Anexos ───────────────────────────── */

/** A8 — o Arquivo é do Espaço de Trabalho; o anexo aponta para ele e removê-lo nunca o apaga. */
export function attachFile(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  file: { readonly name: string; readonly mediaType: Attachment["mediaType"]; readonly sizeBytes: number },
): OperationResult<Attachment> {
  const task = activeTask(state, actingMemberId, taskId);
  if (typeof task === "string") return fail(task);
  const name = file.name.trim();
  if (!name) return fail("O arquivo precisa de um nome.");
  if (!Number.isFinite(file.sizeBytes) || file.sizeBytes < 0) return fail("Tamanho inválido.");
  const limite = 25 * 1024 * 1024;
  if (file.sizeBytes > limite) return fail("O arquivo passa de 25 MB.");

  const workspaceFile: WorkspaceFile = {
    id: nextId("fil"),
    workspaceId: state.workspace.id,
    name,
    mediaType: file.mediaType,
    sizeBytes: file.sizeBytes,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  };
  state.files.push(workspaceFile);
  const attachment: Attachment = {
    fileId: workspaceFile.id,
    order: (task.attachments.at(-1)?.order ?? -1) + 1,
    mediaType: file.mediaType,
    displayName: name,
  };
  task.attachments.push(attachment);
  task.updatedAt = now();
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Anexo adicionado", objectType: "task", objectId: task.id, objectName: task.title, after: name });
  return ok(attachment);
}

export function removeAttachment(state: DataState, actingMemberId: Id, taskId: Id, fileId: Id): OperationResult<Task> {
  const task = activeTask(state, actingMemberId, taskId);
  if (typeof task === "string") return fail(task);
  const attachment = task.attachments.find((a) => a.fileId === fileId);
  if (!attachment) return fail("Anexo não encontrado.");
  task.attachments = task.attachments.filter((a) => a.fileId !== fileId);
  task.updatedAt = now();
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Anexo removido", objectType: "task", objectId: task.id, objectName: task.title, before: attachment.displayName });
  return ok(task);
}

/* ───────────────────────────── Recorrência ───────────────────────────── */

export function setRecurrence(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  rule: RecurrenceRule | null,
): OperationResult<Task> {
  const task = activeTask(state, actingMemberId, taskId);
  if (typeof task === "string") return fail(task);
  if (!effectiveListConfig(state, task.listId)?.features.recorrencia) return fail("Esta Lista não usa Recorrência.");
  if (rule) {
    if (!Number.isInteger(rule.interval) || rule.interval < 1) return fail("O intervalo é um inteiro maior que zero.", "intervalo");
    if (!task.dueDate) return fail("Uma Tarefa recorrente precisa de vencimento: é dele que a próxima ocorrência é calculada.", "vencimento");
    if (rule.endsAfter !== undefined && (!Number.isInteger(rule.endsAfter) || rule.endsAfter < 1)) return fail("O fim por contagem é um inteiro maior que zero.", "fim");
    task.recurrence = rule;
  } else {
    delete task.recurrence;
  }
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: rule ? "Recorrência definida" : "Recorrência removida",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    ...(rule ? { after: `a cada ${rule.interval} ${rule.frequency}` } : {}),
  });
  return ok(task);
}

/** Soma meses sem estourar: 31/01 + 1 mês é 28/02, não 03/03. */
export function addMonths(d: Date, months: number): void {
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
}

/** Desloca no fuso local: um dia civil continua dia civil; um instante mantém a hora. */
function shift(date: TaskDate, rule: RecurrenceRule): TaskDate {
  if (date.form === "civilDay") {
    const [y, m, day] = date.value.split("-").map(Number);
    const d = new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1);
    switch (rule.frequency) {
      case "diaria": d.setDate(d.getDate() + rule.interval); break;
      case "semanal": d.setDate(d.getDate() + 7 * rule.interval); break;
      case "mensal": addMonths(d, rule.interval); break;
      case "anual": addMonths(d, 12 * rule.interval); break;
    }
    return { form: "civilDay", value: civilOf(d) };
  }
  const d = new Date(date.value);
  switch (rule.frequency) {
    case "diaria": d.setDate(d.getDate() + rule.interval); break;
    case "semanal": d.setDate(d.getDate() + 7 * rule.interval); break;
    case "mensal": addMonths(d, rule.interval); break;
    case "anual": addMonths(d, 12 * rule.interval); break;
  }
  return { form: "instant", value: d.toISOString() };
}

const localCivil = (date: TaskDate): string => (date.form === "civilDay" ? date.value : civilOf(new Date(date.value)));

/** Sábado e domingo andam para o dia útil pedido; feriados ficam fora deste protótipo. */
function toBusinessDay(date: TaskDate, rule: RecurrenceRule["businessDays"]): TaskDate {
  if (!rule) return date;
  const shiftBy = (d: Date): number => {
    const dow = d.getDay();
    if (dow === 6) return rule === "anterior" ? -1 : 2;
    if (dow === 0) return rule === "anterior" ? -2 : 1;
    return 0;
  };
  if (date.form === "civilDay") {
    const [y, m, day] = date.value.split("-").map(Number);
    const d = new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1);
    const delta = shiftBy(d);
    return delta === 0 ? date : { form: "civilDay", value: civilPlusDays(date.value, delta) };
  }
  const d = new Date(date.value);
  const delta = shiftBy(d);
  if (delta === 0) return date;
  d.setDate(d.getDate() + delta);
  return { form: "instant", value: d.toISOString() };
}


/** A cópia nasce toda por fazer: nada de `doneAt`, conversões ou ids antigos. */
function copyChecklist(state: DataState, source: Checklist, by: ActorRef): Checklist {
  // RN-CHK-13 — um Item convertido é marcador terminal: não nasce de novo.
  const vivos = source.items.filter((i) => !i.converted);
  const ids = new Map(vivos.map((i) => [i.id, nextId("cki")] as const));
  const ativo = (memberId: Id | undefined) => memberId !== undefined && state.members.some((m) => m.id === memberId && m.state === "ativo");
  return {
    id: nextId("chk"),
    name: source.name,
    order: source.order,
    items: vivos.map((i) => ({
      id: ids.get(i.id)!,
      text: i.text,
      order: i.order,
      done: false,
      ...(ativo(i.assigneeMemberId) ? { assigneeMemberId: i.assigneeMemberId } : {}),
      ...(i.parentItemId && ids.has(i.parentItemId) ? { parentItemId: ids.get(i.parentItemId)! } : {}),
    })),
    createdBy: by,
    createdAt: now(),
  };
}

/** 1 para a origem, 2 para a gerada dela, e assim por diante — seguindo a proveniência. */
function occurrenceOrdinal(state: DataState, task: Task): number {
  let ordinal = 1;
  let current: Task | undefined = task;
  const seen = new Set<Id>();
  while (current?.provenance?.kind === "recurrence" && !seen.has(current.id)) {
    seen.add(current.id);
    const sourceId: Id = current.provenance.sourceId;
    current = state.tasks.find((t) => t.id === sourceId);
    ordinal += 1;
  }
  return ordinal;
}

/**
 * O que impede a próxima ocorrência de nascer — lido ANTES de concluir, para a
 * conclusão não ficar meio feita. `null` quando nada nasce por desenho da regra
 * (fim alcançado, modo por calendário); a data quando nasce.
 */
export function nextOccurrenceRefusal(state: DataState, task: Task): { readonly error?: string; readonly dueDate?: TaskDate } {
  const rule = task.recurrence;
  if (!rule || rule.triggerMode !== "aoConcluir" || !task.dueDate) return {};
  if (rule.endsAfter !== undefined && occurrenceOrdinal(state, task) >= rule.endsAfter) return {};
  const proximaData = toBusinessDay(shift(task.dueDate, rule), rule.businessDays);
  if (rule.endsOn && localCivil(proximaData) > String(rule.endsOn)) return {};
  const config = effectiveListConfig(state, task.listId);
  if (!config?.statusSet.definitions.some((d) => d.category === "naoIniciado")) return { error: "A Lista não tem Status inicial para a próxima ocorrência." };
  if (config.features.datasDeSubtarefasContidas && task.parentTaskId) {
    const mae = state.tasks.find((t) => t.id === task.parentTaskId);
    const fimDaMae = mae?.dueDate ? localCivil(mae.dueDate) : undefined;
    if (fimDaMae && localCivil(proximaData) > fimDaMae) {
      return { error: `A próxima ocorrência venceria em ${civilPlusDays(localCivil(proximaData), 0)}, depois da Tarefa mãe: esta Lista exige datas contidas.` };
    }
  }
  return { dueDate: proximaData };
}

/**
 * Concluir uma Tarefa recorrente (modo `aoConcluir`) cria a próxima ocorrência
 * na mesma Lista, com as datas deslocadas e o que a regra manda copiar. A regra
 * é TRANSFERIDA (12.5): a concluída deixa de gerar. `changeTaskStatus` chama
 * isto na transição terminal.
 */
export function spawnNextOccurrence(state: DataState, actingMemberId: Id, taskId: Id): OperationResult<Task | null> {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const rule = task.recurrence;
  if (!rule) return ok(null);
  if (!isTerminalCategory(statusCategory(state, task))) return fail("A próxima ocorrência nasce quando esta é concluída.");
  const plano = nextOccurrenceRefusal(state, task);
  if (plano.error) return fail(plano.error);
  if (!plano.dueDate) {
    delete task.recurrence;
    return ok(null);
  }
  const proximaData = plano.dueDate;
  const config = effectiveListConfig(state, task.listId);
  const inicial = config?.statusSet.definitions.filter((d) => d.category === "naoIniciado").sort((a, b) => a.order - b.order)[0];
  if (!inicial) return fail("A Lista não tem Status inicial.");

  const next: Task = {
    id: nextId("tsk"),
    workspaceId: task.workspaceId,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    listId: task.listId,
    ...(task.parentTaskId ? { parentTaskId: task.parentTaskId } : {}),
    ...(task.rootTaskId ? { rootTaskId: task.rootTaskId } : {}),
    siblingOrder: state.tasks.filter((t) => t.parentTaskId === task.parentTaskId && t.listId === task.listId).length,
    title: task.title,
    description: task.description,
    statusId: inicial.id,
    taskTypeId: task.taskTypeId,
    priority: task.priority,
    ...(task.startDate ? { startDate: toBusinessDay(shift(task.startDate, rule), rule.businessDays) } : {}),
    dueDate: proximaData,
    ...(task.estimate !== undefined ? { estimate: task.estimate } : {}),
    assignees: rule.defaultAssigneeMemberId ? [{ kind: "member", id: rule.defaultAssigneeMemberId }] : rule.copies.assignees ? [...task.assignees] : [],
    observerMemberIds: [...task.observerMemberIds],
    tagIds: [...task.tagIds],
    fieldValues: rule.copies.fieldValues
      ? task.fieldValues.filter((v) => v.state === "ativo" && !(rule.copies.fieldValuesExcept ?? []).includes(v.definitionId)).map((v) => ({ ...v }))
      : [],
    checklists: rule.copies.checklists ? task.checklists.map((c) => copyChecklist(state, c, memberActor(actingMemberId))) : [],
    timeEntries: [],
    dependencies: [],
    attachments: [],
    comments: [],
    recurrence: rule,
    provenance: { kind: "recurrence", sourceId: task.id, sourceName: task.title, at: now() },
    updatedAt: now(),
  };
  state.tasks.push(next);
  delete task.recurrence;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Próxima ocorrência criada",
    objectType: "task",
    objectId: next.id,
    objectName: next.title,
    detail: `Gerada de “${task.title}”`,
  });
  runListAutomations(state, { kind: "tarefaCriada", taskId: next.id });
  return ok(next);
}
