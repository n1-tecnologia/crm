/**
 * Fase 4 da Gestão de Projetos: o que faz o sistema servir a vários times —
 * Visualizações salvas, Metas, Formulários e Compartilhamento público.
 *
 * Uma Visualização é configuração (A8): quem a abre lê pelas próprias
 * permissões, nunca pelas de quem salvou. A Meta nunca grava progresso. O
 * Formulário cria Tarefa em nome do dono, com Proveniência. O link público
 * abre a Tarefa só leitura por um segredo que a revogação invalida.
 */

import {
  containerAdminRefusal,
  effectiveLifecycleOfList,
  effectiveLifecycleOfTask,
  effectiveListConfig,
  isOverdue,
  memberReachesContainer,
  memberSeesTask,
} from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Form, FormQuestion, Goal, Id, PublicShare, Task, View, ViewFilters } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { createTask, setTaskFieldValue } from "./tasks";

const now = (): string => new Date().toISOString();

function activeMember(state: DataState, memberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === memberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo faz isto.";
  return undefined;
}

function isAdmin(state: DataState, memberId: Id): boolean {
  const base = state.roles.find((r) => r.id === state.members.find((m) => m.id === memberId)?.roleId)?.base;
  return base === "proprietario" || base === "administrador";
}

/** Um segredo legível o bastante para uma URL e imprevisível o bastante para um protótipo. */
function secret(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ───────────────────────────── Visualizações salvas ───────────────────────────── */

export interface SaveViewInput {
  readonly listId: Id;
  readonly name: string;
  readonly kind: View["kind"];
  readonly filters: ViewFilters;
  readonly groupBy?: View["groupBy"];
  readonly sortBy?: View["sortBy"];
  /** Compartilhada com quem abre a Lista, ou só sua. */
  readonly shared: boolean;
}

function viewNameTaken(state: DataState, input: { listId: Id; ownerKind: View["ownerKind"]; ownerId: Id; name: string }, exceptId?: Id): boolean {
  return state.views.some(
    (v) =>
      v.id !== exceptId &&
      v.listId === input.listId &&
      v.ownerKind === input.ownerKind &&
      v.ownerId === input.ownerId &&
      v.name.trim().toLocaleLowerCase("pt-BR") === input.name.trim().toLocaleLowerCase("pt-BR"),
  );
}

/** As Visualizações que este Membro vê nesta Lista: as da Lista e as pessoais dele. */
export function viewsFor(state: DataState, memberId: Id, listId: Id): View[] {
  return state.views.filter((v) => v.listId === listId && (v.ownerKind === "container" || v.ownerId === memberId));
}

export function saveView(state: DataState, actingMemberId: Id, input: SaveViewInput): OperationResult<View> {
  const refusal = activeMember(state, actingMemberId);
  if (refusal) return fail(refusal);
  if (!memberReachesContainer(state, actingMemberId, "list", input.listId)) return fail("Você não alcança esta Lista.");
  const name = input.name.trim();
  if (!name) return fail("Dê um nome à Visualização.", "nome");
  // Compartilhar é configurar a Lista: exige administrá-la. A pessoal é de quem vê.
  if (input.shared) {
    const admin = containerAdminRefusal(state, actingMemberId, "list", input.listId);
    if (admin) return fail(`Para compartilhar com a Lista: ${admin}`);
  }
  const ownerKind: View["ownerKind"] = input.shared ? "container" : "member";
  const ownerId = input.shared ? input.listId : actingMemberId;
  if (viewNameTaken(state, { listId: input.listId, ownerKind, ownerId, name })) return fail(`Já existe uma Visualização “${name}” aqui.`, "nome");
  const view: View = {
    id: nextId("viw"),
    name,
    kind: input.kind,
    ownerKind,
    ownerId,
    listId: input.listId,
    filters: { ...input.filters },
    ...(input.groupBy ? { groupBy: input.groupBy } : {}),
    ...(input.sortBy ? { sortBy: input.sortBy } : {}),
    isDefault: false,
    createdBy: actingMemberId,
    createdAt: now(),
  };
  state.views.push(view);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: input.shared ? "Visualização compartilhada salva" : "Visualização pessoal salva",
    objectType: "list",
    objectId: input.listId,
    objectName: state.lists.find((l) => l.id === input.listId)?.name ?? input.listId,
    after: name,
  });
  return ok(view);
}

function mayEditView(state: DataState, actingMemberId: Id, view: View): string | undefined {
  const refusal = activeMember(state, actingMemberId);
  if (refusal) return refusal;
  if (view.ownerKind === "member") return view.ownerId === actingMemberId ? undefined : "Esta Visualização é pessoal de outro Membro.";
  return containerAdminRefusal(state, actingMemberId, "list", view.listId);
}

export function deleteView(state: DataState, actingMemberId: Id, viewId: Id): OperationResult<View> {
  const view = state.views.find((v) => v.id === viewId);
  if (!view) return fail("Visualização não encontrada.");
  const refusal = mayEditView(state, actingMemberId, view);
  if (refusal) return fail(refusal);
  state.views = state.views.filter((v) => v.id !== viewId);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Visualização excluída",
    objectType: "list",
    objectId: view.listId,
    objectName: state.lists.find((l) => l.id === view.listId)?.name ?? view.listId,
    before: view.name,
  });
  return ok(view);
}

/** Torna a Visualização compartilhada a padrão da Lista (ou tira o padrão). */
export function setDefaultView(state: DataState, actingMemberId: Id, viewId: Id, isDefault: boolean): OperationResult<View> {
  const view = state.views.find((v) => v.id === viewId);
  if (!view) return fail("Visualização não encontrada.");
  if (view.ownerKind !== "container") return fail("Só uma Visualização compartilhada pode ser a padrão da Lista.");
  const refusal = mayEditView(state, actingMemberId, view);
  if (refusal) return fail(refusal);
  for (const other of state.views) if (other.listId === view.listId && other.ownerKind === "container") other.isDefault = false;
  view.isDefault = isDefault;
  return ok(view);
}

/** Aplica filtro e ordenação de uma Visualização sobre Tarefas que quem abre já vê. */
export function applyView(state: DataState, tasks: readonly Task[], view: Pick<View, "filters" | "sortBy">, now = new Date()): Task[] {
  const f = view.filters;
  const texto = f.text?.trim().toLocaleLowerCase("pt-BR");
  const categoriaDe = (t: Task) => effectiveListConfig(state, t.listId)?.statusSet.definitions.find((d) => d.id === t.statusId)?.category;
  const PRIORITY_RANK: Record<Task["priority"], number> = { urgente: 0, alta: 1, normal: 2, baixa: 3, semPrioridade: 4 };
  const dueMs = (t: Task) => (t.dueDate ? Date.parse(t.dueDate.form === "civilDay" ? `${t.dueDate.value}T23:59:59` : t.dueDate.value) : Number.POSITIVE_INFINITY);
  let out = tasks.filter((t) => {
    if (f.statusCategory && categoriaDe(t) !== f.statusCategory) return false;
    if (f.statusId && t.statusId !== f.statusId) return false;
    if (f.assigneeMemberId && !t.assignees.some((a) => a.kind === "member" && a.id === f.assigneeMemberId)) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.tagId && !t.tagIds.includes(f.tagId)) return false;
    if (f.overdue && !isOverdue(state, t, now)) return false;
    if (texto && !t.title.toLocaleLowerCase("pt-BR").includes(texto)) return false;
    return true;
  });
  if (view.sortBy) {
    const { by, direction } = view.sortBy;
    const dir = direction === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const cmp =
        by === "dueDate"
          ? dueMs(a) - dueMs(b)
          : by === "priority"
            ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
            : by === "title"
              ? a.title.localeCompare(b.title, "pt-BR")
              : a.createdAt.localeCompare(b.createdAt);
      return cmp * dir;
    });
  }
  return out;
}

/* ───────────────────────────── Metas ───────────────────────────── */

export interface GoalInput {
  readonly name: string;
  readonly description?: string;
  readonly anchor: Goal["anchor"];
  readonly kind: Goal["kind"];
  readonly target: number;
  readonly unit?: string;
  readonly measure?: Goal["measure"];
  readonly dueDate?: string;
}

function validateGoal(input: GoalInput): string | undefined {
  if (!input.name.trim()) return "Dê um nome à Meta.";
  if (!Number.isFinite(input.target) || input.target <= 0) return "O alvo é um número maior que zero.";
  if (input.kind === "metrica" && !input.measure) return "Uma Meta por métrica precisa da leitura: o que contar ou somar, e onde.";
  // RN-PAI-13 — dinheiro não se soma entre moedas num número só; a Meta lê contagem ou estimativa.
  if (input.kind === "metrica" && input.measure?.attribute === "value") return "Uma Meta não soma valores em dinheiro: use contagem ou estimativa.";
  if (input.dueDate && Number.isNaN(Date.parse(input.dueDate))) return "Data-limite inválida.";
  return undefined;
}

export function createGoal(state: DataState, actingMemberId: Id, input: GoalInput): OperationResult<Goal> {
  const refusal = activeMember(state, actingMemberId);
  if (refusal) return fail(refusal);
  const base = state.roles.find((r) => r.id === state.members.find((m) => m.id === actingMemberId)?.roleId)?.base;
  if (base === "convidado") return fail("Um Convidado não cria Meta.");
  if (!memberReachesContainer(state, actingMemberId, input.anchor.type, input.anchor.id)) return fail("Você não alcança o contêiner desta Meta.");
  const problema = validateGoal(input);
  if (problema) return fail(problema);
  const goal: Goal = {
    id: nextId("gol"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ownerMemberId: actingMemberId,
    anchor: input.anchor,
    kind: input.kind,
    target: input.target,
    ...(input.unit?.trim() ? { unit: input.unit.trim() } : {}),
    ...(input.kind === "metrica" && input.measure ? { measure: input.measure } : {}),
    taskIds: [],
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
  };
  state.goals.push(goal);
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Meta criada", objectType: "goal", objectId: goal.id, objectName: goal.name });
  return ok(goal);
}

function mayEditGoal(state: DataState, actingMemberId: Id, goal: Goal): string | undefined {
  const refusal = activeMember(state, actingMemberId);
  if (refusal) return refusal;
  if (goal.ownerMemberId !== actingMemberId && !isAdmin(state, actingMemberId)) return "Só o dono da Meta ou um Administrador a altera.";
  if (goal.lifecycle !== "ativo") return "Esta Meta está arquivada.";
  return undefined;
}

export function updateGoal(state: DataState, actingMemberId: Id, goalId: Id, input: Partial<GoalInput>): OperationResult<Goal> {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return fail("Meta não encontrada.");
  const refusal = mayEditGoal(state, actingMemberId, goal);
  if (refusal) return fail(refusal);
  const merged: GoalInput = {
    name: input.name ?? goal.name,
    description: input.description ?? goal.description,
    anchor: input.anchor ?? goal.anchor,
    kind: input.kind ?? goal.kind,
    target: input.target ?? goal.target,
    unit: input.unit ?? goal.unit,
    measure: input.measure ?? goal.measure,
    dueDate: input.dueDate ?? goal.dueDate,
  };
  const problema = validateGoal(merged);
  if (problema) return fail(problema);
  goal.name = merged.name.trim();
  if (merged.description?.trim()) goal.description = merged.description.trim();
  else delete goal.description;
  goal.anchor = merged.anchor;
  goal.kind = merged.kind;
  goal.target = merged.target;
  if (merged.unit?.trim()) goal.unit = merged.unit.trim();
  else delete goal.unit;
  if (merged.kind === "metrica" && merged.measure) goal.measure = merged.measure;
  else delete goal.measure;
  if (merged.dueDate) goal.dueDate = merged.dueDate;
  else delete goal.dueDate;
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Meta alterada", objectType: "goal", objectId: goal.id, objectName: goal.name });
  return ok(goal);
}

export function archiveGoal(state: DataState, actingMemberId: Id, goalId: Id): OperationResult<Goal> {
  return setGoalArchived(state, actingMemberId, goalId, true);
}

/** Arquivar tira a Meta da lista e do Painel; restaurar a traz de volta com o progresso lido de novo. */
export function setGoalArchived(state: DataState, actingMemberId: Id, goalId: Id, archived: boolean): OperationResult<Goal> {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return fail("Meta não encontrada.");
  const refusal = activeMember(state, actingMemberId);
  if (refusal) return fail(refusal);
  if (goal.ownerMemberId !== actingMemberId && !isAdmin(state, actingMemberId)) return fail("Só o dono da Meta ou um Administrador a altera.");
  if (archived && goal.lifecycle !== "ativo") return fail("Esta Meta já está arquivada.");
  if (!archived && goal.lifecycle === "ativo") return fail("Esta Meta já está ativa.");
  goal.lifecycle = archived ? "arquivado" : "ativo";
  recordActivity(state, { actor: memberActor(actingMemberId), action: archived ? "Meta arquivada" : "Meta restaurada", objectType: "goal", objectId: goal.id, objectName: goal.name });
  return ok(goal);
}

/** Liga uma Tarefa que o Membro vê; a Meta por métrica não liga Tarefas. */
export function linkTaskToGoal(state: DataState, actingMemberId: Id, goalId: Id, taskId: Id, linked: boolean): OperationResult<Goal> {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return fail("Meta não encontrada.");
  const refusal = mayEditGoal(state, actingMemberId, goal);
  if (refusal) return fail(refusal);
  if (goal.kind !== "tarefasConcluidas") return fail("Esta Meta é por métrica: não liga Tarefas.");
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !memberSeesTask(state, actingMemberId, taskId)) return fail("Tarefa não encontrada.");
  if (linked) {
    if (goal.taskIds.includes(taskId)) return ok(goal);
    if (effectiveLifecycleOfTask(state, taskId) !== "ativo") return fail("Só uma Tarefa ativa entra na Meta.");
    goal.taskIds.push(taskId);
  } else {
    goal.taskIds = goal.taskIds.filter((id) => id !== taskId);
  }
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: linked ? "Tarefa ligada à Meta" : "Tarefa desligada da Meta",
    objectType: "goal",
    objectId: goal.id,
    objectName: goal.name,
    detail: task.title,
  });
  return ok(goal);
}

/* ───────────────────────────── Formulários ───────────────────────────── */

export interface FormInput {
  readonly name: string;
  readonly description?: string;
  readonly questions: ReadonlyArray<Omit<FormQuestion, "id"> & { readonly id?: Id }>;
}

function validateQuestions(state: DataState, listId: Id, questions: FormInput["questions"]): string | undefined {
  if (questions.length === 0) return "O Formulário precisa de ao menos uma pergunta.";
  const titulos = questions.filter((q) => q.target.kind === "title");
  if (titulos.length !== 1) return "Exatamente uma pergunta vira o título da Tarefa.";
  if (!titulos[0]?.required) return "A pergunta do título é obrigatória.";
  if (questions.some((q) => !q.label.trim())) return "Toda pergunta precisa de um rótulo.";
  const config = effectiveListConfig(state, listId);
  const permitidos = new Set(config?.fieldDefinitionIds ?? []);
  for (const q of questions) {
    if (q.target.kind === "field") {
      const def = state.fieldDefinitions.find((d) => d.id === (q.target as { definitionId: Id }).definitionId);
      if (!def || !permitidos.has(def.id)) return `A pergunta “${q.label}” aponta para um Campo que esta Lista não tem.`;
      if (def.type === "formula") return `O Campo “${def.name}” é fórmula e não recebe resposta.`;
    }
  }
  // Campo obrigatório da Lista sem pergunta obrigatória: a Tarefa nasceria incompleta.
  for (const id of permitidos) {
    const def = state.fieldDefinitions.find((d) => d.id === id);
    if (def?.required && !questions.some((q) => q.target.kind === "field" && q.target.definitionId === id && q.required)) {
      return `O Campo “${def.name}” é obrigatório nesta Lista: o Formulário precisa de uma pergunta obrigatória para ele.`;
    }
  }
  const alvos = questions.map((q) => JSON.stringify(q.target));
  if (new Set(alvos).size !== alvos.length) return "Duas perguntas apontam para o mesmo destino.";
  return undefined;
}

export function createForm(state: DataState, actingMemberId: Id, listId: Id, input: FormInput): OperationResult<Form> {
  const refusal = containerAdminRefusal(state, actingMemberId, "list", listId);
  if (refusal) return fail(refusal);
  const list = state.lists.find((l) => l.id === listId);
  if (!list || list.lifecycle !== "ativo") return fail("Lista não encontrada ou inativa.");
  const name = input.name.trim();
  if (!name) return fail("Dê um nome ao Formulário.", "nome");
  if (state.forms.some((f) => f.listId === listId && f.lifecycle === "ativo" && f.name.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
    return fail(`Já existe um Formulário “${name}” nesta Lista.`, "nome");
  }
  const problema = validateQuestions(state, listId, input.questions);
  if (problema) return fail(problema, "perguntas");
  const form: Form = {
    id: nextId("frm"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    listId,
    name,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ownerMemberId: actingMemberId,
    questions: input.questions.map((q) => ({ id: q.id ?? nextId("fqs"), label: q.label.trim(), required: q.required, target: q.target })),
    enabled: true,
    secret: secret(),
    submissions: 0,
  };
  state.forms.push(form);
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Formulário criado", objectType: "list", objectId: list.id, objectName: list.name, after: name });
  return ok(form);
}

export function updateForm(state: DataState, actingMemberId: Id, formId: Id, input: Partial<FormInput> & { readonly enabled?: boolean }): OperationResult<Form> {
  const form = state.forms.find((f) => f.id === formId);
  if (!form) return fail("Formulário não encontrado.");
  const refusal = containerAdminRefusal(state, actingMemberId, "list", form.listId);
  if (refusal) return fail(refusal);
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return fail("Dê um nome ao Formulário.", "nome");
    form.name = name;
  }
  if (input.description !== undefined) {
    if (input.description.trim()) form.description = input.description.trim();
    else delete form.description;
  }
  if (input.questions !== undefined) {
    const problema = validateQuestions(state, form.listId, input.questions);
    if (problema) return fail(problema, "perguntas");
    form.questions = input.questions.map((q) => ({ id: q.id ?? nextId("fqs"), label: q.label.trim(), required: q.required, target: q.target }));
  }
  if (input.enabled !== undefined) form.enabled = input.enabled;
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Formulário alterado", objectType: "list", objectId: form.listId, objectName: form.name });
  return ok(form);
}

/** Arquivar fecha o link e tira o Formulário da Lista; as Tarefas criadas por ele ficam. */
export function archiveForm(state: DataState, actingMemberId: Id, formId: Id): OperationResult<Form> {
  const form = state.forms.find((f) => f.id === formId);
  if (!form) return fail("Formulário não encontrado.");
  const refusal = containerAdminRefusal(state, actingMemberId, "list", form.listId);
  if (refusal) return fail(refusal);
  if (form.lifecycle !== "ativo") return fail("Este Formulário já está arquivado.");
  form.lifecycle = "arquivado";
  form.enabled = false;
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Formulário arquivado", objectType: "list", objectId: form.listId, objectName: form.name });
  return ok(form);
}

/** Rotacionar o segredo: o link antigo para de abrir. */
export function rotateFormSecret(state: DataState, actingMemberId: Id, formId: Id): OperationResult<Form> {
  const form = state.forms.find((f) => f.id === formId);
  if (!form) return fail("Formulário não encontrado.");
  const refusal = containerAdminRefusal(state, actingMemberId, "list", form.listId);
  if (refusal) return fail(refusal);
  form.secret = secret();
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Link do Formulário renovado", objectType: "list", objectId: form.listId, objectName: form.name });
  return ok(form);
}

/**
 * O que o link abre: Formulário ativo numa Lista ativa que o dono ainda
 * alcança. Fora disso o link não existe — quem responde não é Membro e não
 * tem o que fazer com "Lista arquivada".
 */
export function formBySecret(state: DataState, secretValue: string): Form | undefined {
  const form = state.forms.find((f) => f.secret === secretValue && f.lifecycle === "ativo");
  if (!form) return undefined;
  if (effectiveLifecycleOfList(state, form.listId) !== "ativo") return undefined;
  const owner = state.members.find((m) => m.id === form.ownerMemberId);
  if (!owner || owner.state !== "ativo" || !memberReachesContainer(state, form.ownerMemberId, "list", form.listId)) return undefined;
  return form;
}

/** Um Campo obrigatório criado depois do Formulário deixa-o desatualizado: ninguém o responderia. */
export function formOutdatedReason(state: DataState, form: Form): string | undefined {
  const config = effectiveListConfig(state, form.listId);
  for (const id of config?.fieldDefinitionIds ?? []) {
    const def = state.fieldDefinitions.find((d) => d.id === id);
    if (def?.required && !form.questions.some((q) => q.target.kind === "field" && q.target.definitionId === id && q.required)) {
      return `O Campo “${def.name}” passou a ser obrigatório na Lista e o Formulário não pergunta por ele.`;
    }
  }
  return undefined;
}

/**
 * Envio anônimo: vira `createTask` em nome do dono do Formulário, com
 * Proveniência `form`. Os obrigatórios da Lista valem — a validação das
 * perguntas garante que cada um tem pergunta obrigatória.
 */
export function submitForm(state: DataState, secretValue: string, answers: Readonly<Record<Id, string>>): OperationResult<Task> {
  const form = formBySecret(state, secretValue);
  if (!form) return fail("Este Formulário não existe mais ou o link foi renovado.");
  if (!form.enabled) return fail("Este Formulário está pausado.");
  if (formOutdatedReason(state, form)) return fail("Este Formulário está desatualizado: peça a quem o enviou para revisá-lo.");
  for (const q of form.questions) {
    if (q.required && !answers[q.id]?.trim()) return fail(`Responda “${q.label}”.`, q.id);
  }
  const titulo = form.questions.find((q) => q.target.kind === "title");
  const descricao = form.questions.find((q) => q.target.kind === "description");
  // Tudo ou nada: uma resposta recusada desfaz a Tarefa, o Registro e o identificador consumido.
  const antes = { tasks: state.tasks.length, activity: state.activity.length, readable: state.workspace.taskReadableId.next };
  const desfazer = (motivo: string, field: Id): OperationResult<Task> => {
    state.tasks.splice(antes.tasks);
    state.activity.splice(0, state.activity.length - antes.activity);
    state.workspace.taskReadableId.next = antes.readable;
    return fail(motivo, field);
  };
  const created = createTask(state, form.ownerMemberId, { listId: form.listId, title: (titulo ? answers[titulo.id] : "")?.trim() || "Sem título" });
  if (!created.ok) return fail("Não foi possível registrar agora: peça a quem enviou o link para verificar o Formulário.");
  const task = created.value;
  if (descricao && answers[descricao.id]?.trim()) task.description = answers[descricao.id]?.trim() ?? "";
  task.provenance = { kind: "form", sourceId: form.id, sourceName: form.name, at: now() };
  for (const q of form.questions) {
    if (q.target.kind !== "field") continue;
    const resposta = answers[q.id]?.trim();
    if (!resposta) continue;
    const def = state.fieldDefinitions.find((d) => d.id === (q.target as { definitionId: Id }).definitionId);
    // Números passam como texto: `setTaskFieldValue` é quem normaliza ("1,5" inclusive).
    const valor: string | boolean | readonly string[] =
      def?.type === "checkbox" ? resposta === "sim" : def?.type === "multiSelect" ? resposta.split(",").map((s) => s.trim()).filter(Boolean) : resposta;
    const r = setTaskFieldValue(state, form.ownerMemberId, task.id, (q.target as { definitionId: Id }).definitionId, valor);
    if (!r.ok) return desfazer(`“${q.label}”: ${r.error}`, q.id);
  }
  form.submissions += 1;
  recordActivity(state, { actor: memberActor(form.ownerMemberId), action: "Tarefa criada por Formulário", objectType: "task", objectId: task.id, objectName: task.title, detail: form.name });
  return ok(task);
}

/* ───────────────────────────── Compartilhamento público ───────────────────────────── */

export function shareTaskPublicly(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  options: { readonly showsComments: boolean; readonly showsAttachments: boolean },
): OperationResult<PublicShare> {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !memberSeesTask(state, actingMemberId, taskId)) return fail("Tarefa não encontrada.");
  // RN-TAR-21 / Inventário de telas: compartilhar para fora exige `administrar` a Lista.
  const refusal = containerAdminRefusal(state, actingMemberId, "list", task.listId);
  if (refusal) return fail(refusal);
  if (effectiveLifecycleOfTask(state, taskId) !== "ativo") return fail("Só uma Tarefa ativa é compartilhada.");
  if (!effectiveListConfig(state, task.listId)?.features.compartilhamentoPublico) return fail("Esta Lista não permite compartilhamento público.");
  if (task.publicShare?.active) return fail("Esta Tarefa já tem um link público ativo. Revogue-o para gerar outro.");
  task.publicShare = { secret: secret(), active: true, createdBy: actingMemberId, createdAt: now(), showsComments: options.showsComments, showsAttachments: options.showsAttachments };
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Link público criado", objectType: "task", objectId: task.id, objectName: task.title });
  return ok(task.publicShare);
}

export function revokePublicShare(state: DataState, actingMemberId: Id, taskId: Id): OperationResult<Task> {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !memberSeesTask(state, actingMemberId, taskId)) return fail("Tarefa não encontrada.");
  const refusal = containerAdminRefusal(state, actingMemberId, "list", task.listId);
  if (refusal) return fail(refusal);
  if (!task.publicShare?.active) return fail("Esta Tarefa não tem link público ativo.");
  task.publicShare.active = false;
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Link público revogado", objectType: "task", objectId: task.id, objectName: task.title });
  return ok(task);
}

/** O que o link abre: segredo ativo, Tarefa ativa e Lista que ainda permite compartilhar (tarefa.md §196). */
export function taskByPublicSecret(state: DataState, secretValue: string): Task | undefined {
  const task = state.tasks.find((t) => t.publicShare?.secret === secretValue && t.publicShare.active);
  if (!task || effectiveLifecycleOfTask(state, task.id) !== "ativo") return undefined;
  if (!effectiveListConfig(state, task.listId)?.features.compartilhamentoPublico) return undefined;
  return task;
}
