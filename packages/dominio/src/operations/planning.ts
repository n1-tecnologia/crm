/**
 * Fase 3 da Gestão de Projetos: o que só faz sentido depois de datas,
 * estimativas e dependências existirem — sprints, capacidade por Membro e
 * Templates de Lista e de Tarefa.
 *
 * Sprint não é entidade: é a Pasta com um papel, e as Listas dela são as
 * sprints datadas em sequência. Fechar uma sprint move o que ficou aberto para
 * a próxima com `moveTask`, deixando Registro.
 */

import { containerAdminRefusal, effectiveContainerConfig, effectiveListConfig, isTerminalCategory, memberReachesContainer, statusCategory } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Folder, Id, List, StatusDefinition, StatusSet, Task, Template } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { blockedAbove, createFieldDefinition, createTaskType } from "./configuration";
import { createList } from "./structure";
import { createTask, moveTask, type StatusMapping } from "./tasks";

const now = (): string => new Date().toISOString();
const DEFAULT_CAPACITY = 40 * 60;

const civil = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  return civil(date);
};

/* ───────────────────────────── Capacidade ───────────────────────────── */

export function memberCapacityMinutes(state: DataState, memberId: Id): number {
  return state.members.find((m) => m.id === memberId)?.weeklyCapacityMinutes ?? DEFAULT_CAPACITY;
}

/** O próprio Membro ou quem administra o Espaço de Trabalho. */
export function setMemberCapacity(
  state: DataState,
  actingMemberId: Id,
  memberId: Id,
  weeklyCapacityMinutes: number,
): OperationResult<number> {
  const acting = state.members.find((m) => m.id === actingMemberId);
  if (!acting || acting.state !== "ativo") return fail("Só um Membro ativo altera capacidade.");
  const base = state.roles.find((r) => r.id === acting.roleId)?.base;
  const admin = base === "proprietario" || base === "administrador";
  if (memberId !== actingMemberId && !admin) return fail("Só o próprio Membro ou um Administrador define a capacidade.");
  const target = state.members.find((m) => m.id === memberId);
  if (!target || target.state !== "ativo") return fail("Membro não encontrado ou inativo.");
  if (!Number.isInteger(weeklyCapacityMinutes) || weeklyCapacityMinutes < 0 || weeklyCapacityMinutes > 7 * 24 * 60) {
    return fail("A capacidade é em minutos por semana, de 0 a 10080.", "capacidade");
  }
  const antes = memberCapacityMinutes(state, memberId);
  target.weeklyCapacityMinutes = weeklyCapacityMinutes;
  if (antes !== weeklyCapacityMinutes) {
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Capacidade semanal alterada",
      objectType: "member",
      objectId: target.id,
      objectName: target.displayName,
      before: `${antes} min`,
      after: `${weeklyCapacityMinutes} min`,
    });
  }
  return ok(weeklyCapacityMinutes);
}

/* ───────────────────────────── Sprints ───────────────────────────── */

function sprintFolder(state: DataState, actingMemberId: Id, folderId: Id): Folder | string {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return "Pasta não encontrada.";
  const refusal = containerAdminRefusal(state, actingMemberId, "folder", folderId);
  if (refusal) return refusal;
  if (folder.lifecycle !== "ativo") return "Uma Pasta arquivada ou na lixeira não organiza sprints.";
  return folder;
}

/** As sprints da Pasta, em ordem de período (uma Lista sem período, anterior ao papel, vem antes). */
export function sprintsOf(state: DataState, folderId: Id): List[] {
  return state.lists
    .filter((l) => l.parentType === "folder" && l.parentId === folderId && l.lifecycle !== "naLixeira")
    .sort((a, b) => (a.plannedPeriod?.start ?? "").localeCompare(b.plannedPeriod?.start ?? "") || a.order - b.order);
}

export function enableSprints(
  state: DataState,
  actingMemberId: Id,
  folderId: Id,
  cadenceDays: number,
): OperationResult<Folder> {
  const folder = sprintFolder(state, actingMemberId, folderId);
  if (typeof folder === "string") return fail(folder);
  if (!Number.isInteger(cadenceDays) || cadenceDays < 1 || cadenceDays > 90) return fail("A cadência é em dias, de 1 a 90.", "cadencia");
  folder.sprint = { cadenceDays };
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Sprints habilitadas na Pasta",
    objectType: "folder",
    objectId: folder.id,
    objectName: folder.name,
    after: `a cada ${cadenceDays} dias`,
  });
  return ok(folder);
}

export function disableSprints(state: DataState, actingMemberId: Id, folderId: Id): OperationResult<Folder> {
  const folder = sprintFolder(state, actingMemberId, folderId);
  if (typeof folder === "string") return fail(folder);
  if (!folder.sprint) return fail("Esta Pasta não organiza sprints.");
  delete folder.sprint;
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Sprints desabilitadas na Pasta", objectType: "folder", objectId: folder.id, objectName: folder.name });
  return ok(folder);
}

/** A próxima sprint começa no dia seguinte ao fim da última; a primeira, hoje. */
export function createNextSprint(state: DataState, actingMemberId: Id, folderId: Id): OperationResult<List> {
  const folder = sprintFolder(state, actingMemberId, folderId);
  if (typeof folder === "string") return fail(folder);
  if (!folder.sprint) return fail("Habilite sprints na Pasta antes de criar uma.");
  const existentes = sprintsOf(state, folderId);
  // A última DATADA manda na sequência; uma Lista sem período (anterior ao papel) não.
  const ultima = existentes.filter((l) => l.plannedPeriod?.end).at(-1);
  const start = ultima?.plannedPeriod?.end ? addDays(ultima.plannedPeriod.end, 1) : civil(new Date());
  const end = addDays(start, folder.sprint.cadenceDays - 1);
  // O primeiro número livre entre TODAS as Listas da Pasta, lixeira inclusive: o nome é único lá.
  const nomes = new Set(state.lists.filter((l) => l.parentType === "folder" && l.parentId === folderId).map((l) => l.name.trim().toLocaleLowerCase("pt-BR")));
  // Numera pelas sprints datadas: uma Lista anterior ao papel não é a "Sprint 1".
  let numero = existentes.filter((l) => l.plannedPeriod?.start).length + 1;
  while (nomes.has(`sprint ${numero}`)) numero += 1;
  const created = createList(state, actingMemberId, { name: `Sprint ${numero}`, parentType: "folder", parentId: folderId });
  if (!created.ok) return created;
  created.value.plannedPeriod = { start, end };
  return ok(created.value);
}

/**
 * Mapeia Status por nome e, sem nome igual, pelo primeiro da mesma categoria.
 * Se algum não tiver destino, devolve o nome dele: a sprint não fecha às cegas.
 */
function mappingBetween(from: readonly StatusDefinition[], to: readonly StatusDefinition[]): { mapping: StatusMapping[] } | { missing: string } {
  const mapping: StatusMapping[] = [];
  for (const origem of from) {
    const destino =
      to.find((d) => d.name.trim().toLocaleLowerCase("pt-BR") === origem.name.trim().toLocaleLowerCase("pt-BR")) ??
      [...to].sort((a, b) => a.order - b.order).find((d) => d.category === origem.category);
    if (!destino) return { missing: origem.name };
    mapping.push({ fromStatusId: origem.id, toStatusId: destino.id });
  }
  return { mapping };
}

/**
 * Fechar a sprint: o que não concluiu vai para a próxima (criada se não
 * existir) e a Lista fica arquivada. As Subtarefas seguem a raiz em `moveTask`.
 * Tudo é verificado antes de qualquer escrita — uma sprint que não fecha não
 * deixa uma Lista nova para trás.
 */
export function closeSprint(
  state: DataState,
  actingMemberId: Id,
  listId: Id,
): OperationResult<{ readonly moved: number; readonly nextListId: Id }> {
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return fail("Lista não encontrada.");
  if (list.parentType !== "folder") return fail("Esta Lista não é uma sprint: está fora de uma Pasta de sprints.");
  const folder = sprintFolder(state, actingMemberId, list.parentId);
  if (typeof folder === "string") return fail(folder);
  if (!folder.sprint) return fail("Esta Pasta não organiza sprints.");
  // B38a — a sprint que o Membro não alcança não existe para ele.
  if (!memberReachesContainer(state, actingMemberId, "list", listId)) return fail("Lista não encontrada.");
  if (list.lifecycle !== "ativo") return fail("Esta sprint já foi fechada.");

  // A próxima é a sprint ativa datada depois desta; uma Lista sem período não é sprint seguinte.
  const inicio = list.plannedPeriod?.start ?? "";
  const proximaExistente = sprintsOf(state, folder.id).find(
    (l) => l.id !== listId && l.lifecycle === "ativo" && l.plannedPeriod?.start !== undefined && l.plannedPeriod.start > inicio && memberReachesContainer(state, actingMemberId, "list", l.id),
  );
  const abertas = state.tasks.filter(
    (t) => t.listId === listId && !t.parentTaskId && t.lifecycle === "ativo" && !isTerminalCategory(statusCategory(state, t)),
  );
  // O Conjunto de destino: o da próxima, ou o que uma sprint nova herdaria da Pasta.
  const daqui = effectiveListConfig(state, listId);
  const destino = proximaExistente ? effectiveListConfig(state, proximaExistente.id) : effectiveContainerConfig(state, "folder", folder.id);
  if (!daqui || !destino) return fail("Configuração efetiva indisponível.");
  let mapping: StatusMapping[] = [];
  if (abertas.length > 0 && daqui.statusSet.id !== destino.statusSet.id) {
    const mapeado = mappingBetween(daqui.statusSet.definitions, destino.statusSet.definitions);
    if ("missing" in mapeado) return fail(`O Status “${mapeado.missing}” não tem equivalente na próxima sprint. Alinhe os Conjuntos de Status antes de fechar.`);
    mapping = mapeado.mapping;
  }

  let proxima = proximaExistente;
  if (!proxima) {
    const criada = createNextSprint(state, actingMemberId, folder.id);
    if (!criada.ok) return criada;
    proxima = criada.value;
  }
  let moved = 0;
  for (const task of abertas) {
    const r = moveTask(state, actingMemberId, task.id, proxima.id, mapping);
    if (!r.ok) return fail(`Não foi possível mover “${task.title}”: ${r.error}`);
    moved += 1;
  }
  list.lifecycle = "arquivado";
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Sprint fechada",
    objectType: "list",
    objectId: list.id,
    objectName: list.name,
    detail: `${moved} Tarefa(s) movida(s) para ${proxima.name}`,
  });
  return ok({ moved, nextListId: proxima.id });
}

/* ───────────────────────────── Templates ───────────────────────────── */

function templateNameTaken(state: DataState, kind: Template["kind"], name: string): boolean {
  return state.templates.some((t) => t.kind === kind && t.lifecycle === "ativo" && t.name.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
}

/** A8 — o Template guarda estrutura, não ids: os Status ganham ids novos ao instanciar. */
function statusSetCopy(set: StatusSet): StatusSet {
  return { ...set, id: nextId("ss"), definitions: set.definitions.map((d) => ({ ...d, id: nextId("st") })) };
}

export function saveListAsTemplate(
  state: DataState,
  actingMemberId: Id,
  listId: Id,
  input: { readonly name: string; readonly description?: string },
): OperationResult<Template> {
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return fail("Lista não encontrada.");
  const refusal = containerAdminRefusal(state, actingMemberId, "list", listId);
  if (refusal) return fail(refusal);
  const name = input.name.trim();
  if (!name) return fail("Dê um nome ao Template.", "nome");
  if (templateNameTaken(state, "lista", name)) return fail(`Já existe um Template de Lista “${name}”.`, "nome");
  const config = effectiveListConfig(state, listId);
  if (!config) return fail("Esta Lista não tem configuração efetiva.");

  const fieldDefinitions = config.fieldDefinitionIds
    .map((id) => state.fieldDefinitions.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined)
    .map((d) => ({
      name: d.name,
      type: d.type,
      ...(d.options ? { options: [...d.options] } : {}),
      required: d.required,
      ...(d.description ? { description: d.description } : {}),
    }));
  const taskTypes = config.taskTypeIds
    .map((id) => state.taskTypes.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined && !t.isPlatformDefault)
    .map((t) => t.name);

  const template: Template = {
    id: nextId("tpl"),
    workspaceId: state.workspace.id,
    kind: "lista",
    name,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    body: `Status: ${config.statusSet.definitions.map((d) => d.name).join(", ")}${fieldDefinitions.length ? ` · Campos: ${fieldDefinitions.map((f) => f.name).join(", ")}` : ""}${taskTypes.length ? ` · Tipos: ${taskTypes.join(", ")}` : ""}`,
    creates: { listConfig: { statusSet: statusSetCopy(config.statusSet), fieldDefinitions, taskTypes } },
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
  };
  state.templates.push(template);
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Template de Lista salvo", objectType: "list", objectId: list.id, objectName: list.name, after: name });
  return ok(template);
}

export function saveTaskAsTemplate(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  input: { readonly name: string; readonly description?: string },
): OperationResult<Template> {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return fail("Tarefa não encontrada.");
  // Template é catálogo do Espaço de Trabalho: publica a estrutura para todos. Exige administrar a Lista de origem.
  const refusal = containerAdminRefusal(state, actingMemberId, "list", task.listId);
  if (refusal) return fail(refusal);
  const name = input.name.trim();
  if (!name) return fail("Dê um nome ao Template.", "nome");
  if (templateNameTaken(state, "tarefa", name)) return fail(`Já existe um Template de Tarefa “${name}”.`, "nome");
  const subtasks = state.tasks
    .filter((t) => t.parentTaskId === task.id && t.lifecycle === "ativo")
    .sort((a, b) => a.siblingOrder - b.siblingOrder)
    .map((t) => t.title);
  const checklists = task.checklists
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ name: c.name, items: c.items.filter((i) => !i.converted && !i.parentItemId).sort((a, b) => a.order - b.order).map((i) => i.text) }));
  const template: Template = {
    id: nextId("tpl"),
    workspaceId: state.workspace.id,
    kind: "tarefa",
    name,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    body: `${checklists.length} Checklist(s), ${subtasks.length} Subtarefa(s)`,
    creates: { task: { title: task.title, description: task.description, priority: task.priority, checklists, subtasks } },
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
  };
  state.templates.push(template);
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Template de Tarefa salvo", objectType: "task", objectId: task.id, objectName: task.title, after: name });
  return ok(template);
}

/** Cria a Tarefa (e Subtarefas, Checklists) a partir do Template; nada de ids copiados. */
export function instantiateTaskTemplate(
  state: DataState,
  actingMemberId: Id,
  templateId: Id,
  listId: Id,
  title?: string,
): OperationResult<Task> {
  const template = state.templates.find((t) => t.id === templateId);
  if (!template || template.lifecycle !== "ativo" || template.kind !== "tarefa" || !template.creates?.task) {
    return fail("Template de Tarefa não encontrado.");
  }
  const spec = template.creates.task;
  const config = effectiveListConfig(state, listId);
  if (spec.subtasks.length > 0 && config && !config.features.subtarefas) return fail("Este modelo cria Subtarefas e esta Lista não usa Subtarefas.");
  if (spec.checklists.length > 0 && config && !config.features.checklists) return fail("Este modelo cria Checklists e esta Lista não usa Checklists.");
  const antesTarefas = state.tasks.length;
  const antesAtividade = state.activity.length;
  // Tudo ou nada: uma Subtarefa recusada desfaz a Tarefa raiz, senão a repetição duplica.
  const desfazer = (motivo: string): OperationResult<Task> => {
    state.tasks.splice(antesTarefas);
    state.activity.splice(0, state.activity.length - antesAtividade);
    return fail(motivo);
  };
  const created = createTask(state, actingMemberId, { listId, title: title?.trim() || spec.title, priority: spec.priority });
  if (!created.ok) return created;
  const task = created.value;
  task.description = spec.description;
  task.provenance = { kind: "template", sourceId: template.id, sourceName: template.name, at: now() };
  task.checklists = spec.checklists.map((c, order) => ({
    id: nextId("chk"),
    name: c.name,
    order,
    items: c.items.map((text, i) => ({ id: nextId("cki"), text, order: i, done: false })),
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  }));
  for (const sub of spec.subtasks) {
    const r = createTask(state, actingMemberId, { listId, title: sub, parentTaskId: task.id });
    if (!r.ok) return desfazer(`A Subtarefa “${sub}” do modelo não cabe aqui: ${r.error}`);
    r.value.provenance = { kind: "template", sourceId: template.id, sourceName: template.name, at: now() };
  }
  return ok(task);
}

/**
 * Instanciar um Template de Lista: a Lista nasce e, se o Template define
 * configuração, ela sobrescreve o Conjunto de Status com ids novos e cria os
 * Campos e Tipos nela mesma. Definir configuração é administrar (RN-ESP-14):
 * a mesma porta de `overrideStatusSet`, verificada ANTES de criar — e um
 * bloqueio acima (B25) recusa antes de existir Lista para desfazer.
 */
export function instantiateListTemplate(
  state: DataState,
  actingMemberId: Id,
  templateId: Id,
  input: { readonly name: string; readonly parentType: "space" | "folder"; readonly parentId: Id; readonly description?: string; readonly isPrivate?: boolean },
): OperationResult<List> {
  const template = state.templates.find((t) => t.id === templateId);
  if (!template || template.lifecycle !== "ativo" || template.kind !== "lista") return fail("Template de Lista não encontrado.");
  if (!memberReachesContainer(state, actingMemberId, input.parentType, input.parentId)) return fail("Você não alcança este contêiner.");
  const cfg = template.creates?.listConfig;
  if (cfg) {
    const admin = containerAdminRefusal(state, actingMemberId, input.parentType, input.parentId);
    if (admin) return fail(`Este Template define Status, Campos e Tipos: ${admin}`);
    for (const aspect of ["statusSet", "fieldDefinitions", "taskTypes"] as const) {
      if (aspect === "statusSet" && !cfg.statusSet) continue;
      if (aspect === "fieldDefinitions" && !(cfg.fieldDefinitions?.length ?? 0)) continue;
      if (aspect === "taskTypes" && !(cfg.taskTypes?.length ?? 0)) continue;
      const bloqueio = blockedAbove(state, input.parentType, input.parentId, aspect);
      // O bloqueio olha os ancestrais do NÓ; a Lista nova terá o pai como ancestral também.
      const doPai = state.folders.find((f) => f.id === input.parentId)?.blocks[aspect] || state.spaces.find((sp) => sp.id === input.parentId)?.blocks[aspect];
      if (bloqueio || doPai) return fail(bloqueio ?? `O contêiner escolhido bloqueia ${aspect === "statusSet" ? "a sobrescrita do Conjunto de Status" : aspect === "fieldDefinitions" ? "novas Definições de Campo" : "novos Tipos de Tarefa"} abaixo dele.`);
    }
  }
  const antes = { lists: state.lists.length, fields: state.fieldDefinitions.length, types: state.taskTypes.length, activity: state.activity.length, grants: state.grants.length };
  const desfazer = (motivo: string): OperationResult<List> => {
    state.lists.splice(antes.lists);
    state.fieldDefinitions.splice(antes.fields);
    state.taskTypes.splice(antes.types);
    state.grants.splice(antes.grants);
    state.activity.splice(0, state.activity.length - antes.activity);
    return fail(motivo);
  };
  const created = createList(state, actingMemberId, { ...input, templateId });
  if (!created.ok) return created;
  const list = created.value;
  if (!cfg) return ok(list);
  if (cfg.statusSet) {
    list.statusSet = statusSetCopy(cfg.statusSet);
    list.modes = { ...list.modes, statusSet: "sobrescrito" };
  }
  const herdados = effectiveListConfig(state, list.id)?.fieldDefinitionIds ?? [];
  for (const field of cfg.fieldDefinitions ?? []) {
    // Um Campo com o mesmo nome já herdado só serve se for do mesmo tipo.
    const existente = herdados.map((id) => state.fieldDefinitions.find((d) => d.id === id)).find((d) => d && d.name.trim().toLocaleLowerCase("pt-BR") === field.name.trim().toLocaleLowerCase("pt-BR"));
    if (existente) {
      if (existente.type !== field.type) return desfazer(`O Campo “${field.name}” já chega a esta Lista como ${existente.type}, e o modelo o define como ${field.type}.`);
      continue;
    }
    const r = createFieldDefinition(state, actingMemberId, { ...field, definedAtType: "list", definedAtId: list.id });
    if (!r.ok) return desfazer(`O Campo “${field.name}” do modelo não cabe aqui: ${r.error}`);
  }
  const tiposVisiveis = new Set((effectiveListConfig(state, list.id)?.taskTypeIds ?? []).map((id) => state.taskTypes.find((t) => t.id === id)?.name.trim().toLocaleLowerCase("pt-BR")));
  for (const typeName of cfg.taskTypes ?? []) {
    if (tiposVisiveis.has(typeName.trim().toLocaleLowerCase("pt-BR"))) continue;
    const r = createTaskType(state, actingMemberId, { name: typeName, icon: "circle", definedAtType: "list", definedAtId: list.id });
    if (!r.ok) return desfazer(`O Tipo “${typeName}” do modelo não cabe aqui: ${r.error}`);
  }
  return ok(list);
}

/** Quem cuida do catálogo de Templates: Proprietário ou Administrador do Espaço de Trabalho. */
function templateAdminRefusal(state: DataState, actingMemberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo altera Templates.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  return base === "proprietario" || base === "administrador" ? undefined : "Só um Administrador ou o Proprietário altera o catálogo de Templates.";
}

export function renameTemplate(state: DataState, actingMemberId: Id, templateId: Id, input: { readonly name: string; readonly description?: string }): OperationResult<Template> {
  const refusal = templateAdminRefusal(state, actingMemberId);
  if (refusal) return fail(refusal);
  const index = state.templates.findIndex((t) => t.id === templateId);
  const template = state.templates[index];
  if (!template) return fail("Template não encontrado.");
  const name = input.name.trim();
  if (!name) return fail("Dê um nome ao Template.", "nome");
  if (name.toLocaleLowerCase("pt-BR") !== template.name.toLocaleLowerCase("pt-BR") && templateNameTaken(state, template.kind, name)) {
    return fail(`Já existe um Template “${name}”.`, "nome");
  }
  const next: Template = { ...template, name, ...(input.description?.trim() ? { description: input.description.trim() } : {}) };
  if (!input.description?.trim()) delete (next as { description?: string }).description;
  state.templates[index] = next;
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Template renomeado", objectType: "template", objectId: template.id, objectName: name, before: template.name, after: name });
  return ok(next);
}

/** Arquivar tira o Template das escolhas; o que já foi instanciado não muda (A8). */
export function setTemplateArchived(state: DataState, actingMemberId: Id, templateId: Id, archived: boolean): OperationResult<Template> {
  const refusal = templateAdminRefusal(state, actingMemberId);
  if (refusal) return fail(refusal);
  const template = state.templates.find((t) => t.id === templateId);
  if (!template) return fail("Template não encontrado.");
  if (template.id === state.workspace.defaultSpaceTemplateId && archived) return fail("Este Template é o padrão para novos Espaços: troque o padrão antes de arquivá-lo.");
  if (archived && template.lifecycle !== "ativo") return fail("Este Template já está arquivado.");
  if (!archived && template.lifecycle === "ativo") return fail("Este Template já está ativo.");
  if (!archived && templateNameTaken(state, template.kind, template.name)) return fail(`Já existe um Template ativo “${template.name}”: renomeie antes de restaurar.`);
  template.lifecycle = archived ? "arquivado" : "ativo";
  recordActivity(state, { actor: memberActor(actingMemberId), action: archived ? "Template arquivado" : "Template restaurado", objectType: "template", objectId: template.id, objectName: template.name });
  return ok(template);
}
