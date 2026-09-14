/**
 * Fase 1 da Gestão de Projetos: o que a Lista consome passa a ser configurável.
 *
 * B25 — Definições de Campo e Tipos de Tarefa ACUMULAM pelo caminho; o
 * Conjunto de Status SUBSTITUI: o nível mais próximo que o define vence por
 * inteiro. Cada operação aqui grava num contêiner (Espaço, Pasta ou Lista) e
 * nunca numa Tarefa — Tarefa não define configuração.
 */

import { containerAdminRefusal, containerPath, effectiveContainerConfig, effectiveListConfig, listPath } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type {
  ConfigurableAspect,
  EnabledFeatures,
  FieldDefinition,
  FieldType,
  Folder,
  Id,
  List,
  Space,
  StatusCategory,
  StatusDefinition,
  StatusSet,
  TaskType,
} from "../types";
import { memberActor, nextId, recordActivity } from "./activity";

type ContainerType = "space" | "folder" | "list";
type Container = Space | Folder | List;

const SELECT_TYPES: ReadonlySet<FieldType> = new Set(["singleSelect", "multiSelect"]);

/** RN-ESP-14/16 — administrar o contêiner, não só ter o Papel: o privado exige concessão. */
function mayConfigure(state: DataState, actingMemberId: Id, type: ContainerType, id: Id): string | undefined {
  return containerAdminRefusal(state, actingMemberId, type, id);
}

/** B25 — um ancestral que bloqueia o aspecto impede definir abaixo dele. */
export function blockedAbove(state: DataState, type: ContainerType, id: Id, aspect: ConfigurableAspect): string | undefined {
  for (const node of containerPath(state, type, id)) {
    if (node.id === id) continue;
    const ancestor = findContainer(state, node.type, node.id);
    if (ancestor?.blocks[aspect]) {
      return `${CONTAINER_LABEL[node.type]} ${ancestor.name} bloqueia ${ASPECT_LABEL[aspect]} abaixo dele.`;
    }
  }
  return undefined;
}

const ASPECT_LABEL: Record<ConfigurableAspect, string> = {
  statusSet: "a sobrescrita do Conjunto de Status",
  fieldDefinitions: "novas Definições de Campo",
  taskTypes: "novos Tipos de Tarefa",
  features: "as Funcionalidades",
  automations: "as Automações",
  defaultViews: "as Visualizações padrão",
};

/**
 * Os nós que enxergam o que este contêiner define: o caminho dele e tudo
 * abaixo — Pastas inclusive, mesmo as ainda sem Lista, senão a primeira Lista
 * criada nelas nasceria vendo dois nomes iguais.
 */
function visibleScopeOf(state: DataState, type: ContainerType, id: Id): Set<Id> {
  const scope = new Set<Id>(containerPath(state, type, id).map((n) => n.id));
  for (const folder of state.folders) {
    if (containerPath(state, "folder", folder.id).some((n) => n.id === id)) scope.add(folder.id);
  }
  for (const list of listsUnder(state, type, id)) {
    for (const node of listPath(state, list.id)) scope.add(node.id);
  }
  return scope;
}

function fieldNameCollision(state: DataState, type: ContainerType, id: Id, name: string, exceptId?: Id): FieldDefinition | undefined {
  const scope = visibleScopeOf(state, type, id);
  return state.fieldDefinitions.find(
    (d) =>
      d.id !== exceptId &&
      d.target === "task" &&
      d.lifecycle === "ativo" &&
      d.definedAtId !== undefined &&
      scope.has(d.definedAtId) &&
      d.name.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
  );
}

function taskTypeNameCollision(state: DataState, type: ContainerType, id: Id, name: string, exceptId?: Id): TaskType | undefined {
  const scope = visibleScopeOf(state, type, id);
  return state.taskTypes.find(
    (t) => t.id !== exceptId && scope.has(t.definedAtId) && t.name.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
  );
}

function findContainer(state: DataState, type: ContainerType, id: Id): Container | undefined {
  return type === "space"
    ? state.spaces.find((s) => s.id === id)
    : type === "folder"
      ? state.folders.find((f) => f.id === id)
      : state.lists.find((l) => l.id === id);
}

const CONTAINER_LABEL: Record<ContainerType, string> = { space: "Espaço", folder: "Pasta", list: "Lista" };

/** As Listas cujo caminho passa por este contêiner — as que consomem o que ele define. */
function listsUnder(state: DataState, type: ContainerType, id: Id): List[] {
  if (type === "list") return state.lists.filter((l) => l.id === id);
  return state.lists.filter((l) => listPath(state, l.id).some((n) => n.type === type && n.id === id));
}

/* ───────────────────────────── Definições de Campo ───────────────────────── */

export interface CreateFieldDefinitionInput {
  readonly name: string;
  readonly type: FieldType;
  readonly options?: readonly string[];
  readonly required?: boolean;
  readonly description?: string;
  readonly definedAtType: ContainerType;
  readonly definedAtId: Id;
}

function validateOptions(type: FieldType, options: readonly string[] | undefined): string | undefined {
  if (!SELECT_TYPES.has(type)) return undefined;
  const limpas = (options ?? []).map((o) => o.trim()).filter(Boolean);
  if (limpas.length === 0) return "Um Campo de seleção precisa de ao menos uma opção.";
  if (new Set(limpas.map((o) => o.toLocaleLowerCase("pt-BR"))).size !== limpas.length) {
    return "As opções de um Campo de seleção não se repetem.";
  }
  return undefined;
}

export function createFieldDefinition(
  state: DataState,
  actingMemberId: Id,
  input: CreateFieldDefinitionInput,
): OperationResult<FieldDefinition> {
  const container = findContainer(state, input.definedAtType, input.definedAtId);
  if (!container) return fail(`${CONTAINER_LABEL[input.definedAtType]} não encontrado(a).`);
  const refusal = mayConfigure(state, actingMemberId, input.definedAtType, input.definedAtId);
  if (refusal) return fail(refusal);
  if (container.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não recebe Campo novo.");
  const bloqueio = blockedAbove(state, input.definedAtType, input.definedAtId, "fieldDefinitions");
  if (bloqueio) return fail(bloqueio);

  const name = input.name.trim();
  if (!name) return fail("Dê um nome ao Campo.", "nome");
  // Único no caminho que este contêiner enxerga: o nome é o que a pessoa lê na Tarefa.
  const colisao = fieldNameCollision(state, input.definedAtType, input.definedAtId, name);
  if (colisao) return fail(`Já existe um Campo “${colisao.name}” neste caminho.`, "nome");

  const optionsProblem = validateOptions(input.type, input.options);
  if (optionsProblem) return fail(optionsProblem, "opcoes");

  const definition: FieldDefinition = {
    id: nextId("fd"),
    workspaceId: state.workspace.id,
    name,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    type: input.type,
    ...(SELECT_TYPES.has(input.type) ? { options: (input.options ?? []).map((o) => o.trim()).filter(Boolean) } : {}),
    required: input.required ?? false,
    target: "task",
    definedAtType: input.definedAtType,
    definedAtId: input.definedAtId,
    lifecycle: "ativo",
  };
  state.fieldDefinitions.push(definition);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Definição de Campo criada",
    objectType: "fieldDefinition",
    objectId: definition.id,
    objectName: definition.name,
    detail: `Em ${CONTAINER_LABEL[input.definedAtType]} ${container.name}`,
  });
  return ok(definition);
}

export function updateFieldDefinition(
  state: DataState,
  actingMemberId: Id,
  definitionId: Id,
  input: { readonly name?: string; readonly description?: string; readonly required?: boolean; readonly options?: readonly string[] },
): OperationResult<FieldDefinition> {
  const index = state.fieldDefinitions.findIndex((d) => d.id === definitionId);
  const definition = state.fieldDefinitions[index];
  if (!definition) return fail("Campo não encontrado.");
  if (definition.target !== "task" || !definition.definedAtType || !definition.definedAtId) return fail("Este Campo não é de Tarefa.");
  const refusal = mayConfigure(state, actingMemberId, definition.definedAtType, definition.definedAtId);
  if (refusal) return fail(refusal);
  if (definition.lifecycle !== "ativo") return fail("Este Campo está arquivado.");

  const mudancas: string[] = [];
  let next: FieldDefinition = definition;

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return fail("Dê um nome ao Campo.", "nome");
    if (name !== definition.name) {
      const colisao = fieldNameCollision(state, definition.definedAtType, definition.definedAtId, name, definition.id);
      if (colisao) return fail(`Já existe um Campo “${colisao.name}” neste caminho.`, "nome");
      mudancas.push(`nome: ${definition.name} → ${name}`);
      next = { ...next, name };
    }
  }
  if (input.description !== undefined && input.description.trim() !== (definition.description ?? "")) {
    const description = input.description.trim();
    if (description) {
      next = { ...next, description };
    } else {
      const semDescricao = { ...next };
      delete semDescricao.description;
      next = semDescricao;
    }
    mudancas.push("descrição");
  }
  if (input.required !== undefined && input.required !== definition.required) {
    next = { ...next, required: input.required };
    mudancas.push(input.required ? "passou a obrigatório" : "deixou de ser obrigatório");
  }
  if (input.options !== undefined) {
    if (!SELECT_TYPES.has(definition.type)) return fail("Só Campo de seleção tem opções.", "opcoes");
    const optionsProblem = validateOptions(definition.type, input.options);
    if (optionsProblem) return fail(optionsProblem, "opcoes");
    const limpas = input.options.map((o) => o.trim()).filter(Boolean);
    // Tirar uma opção em uso apagaria um valor gravado por alguém: recusado.
    const removidas = (definition.options ?? []).filter((o) => !limpas.includes(o));
    for (const opcao of removidas) {
      const emUso = state.tasks.some((t) =>
        t.fieldValues.some(
          (v) =>
            v.definitionId === definition.id &&
            v.state === "ativo" &&
            (Array.isArray(v.value) ? v.value.map(String).includes(opcao) : String(v.value) === opcao),
        ),
      );
      if (emUso) return fail(`A opção “${opcao}” está em uso em alguma Tarefa e não pode ser removida.`, "opcoes");
    }
    if (removidas.length > 0 || limpas.length !== (definition.options ?? []).length || limpas.some((o, i) => definition.options?.[i] !== o)) {
      next = { ...next, options: limpas };
      mudancas.push("opções");
    }
  }
  if (mudancas.length === 0) return ok(definition);

  state.fieldDefinitions[index] = next;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Definição de Campo alterada",
    objectType: "fieldDefinition",
    objectId: next.id,
    objectName: next.name,
    detail: mudancas.join(" · "),
  });
  return ok(next);
}

/** Arquivar preserva todo Valor gravado (B37); a Definição só some das Listas. */
export function archiveFieldDefinition(
  state: DataState,
  actingMemberId: Id,
  definitionId: Id,
): OperationResult<FieldDefinition> {
  const definition = state.fieldDefinitions.find((d) => d.id === definitionId);
  if (!definition) return fail("Campo não encontrado.");
  if (definition.target !== "task" || !definition.definedAtType || !definition.definedAtId) return fail("Este Campo não é de Tarefa.");
  const refusal = mayConfigure(state, actingMemberId, definition.definedAtType, definition.definedAtId);
  if (refusal) return fail(refusal);
  if (definition.lifecycle !== "ativo") return fail("Este Campo já está arquivado.");
  definition.lifecycle = "arquivado";
  const valores = state.tasks.filter((t) => t.fieldValues.some((v) => v.definitionId === definitionId)).length;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Definição de Campo arquivada",
    objectType: "fieldDefinition",
    objectId: definition.id,
    objectName: definition.name,
    ...(valores > 0 ? { detail: `${valores} Tarefa(s) preservam o valor` } : {}),
  });
  return ok(definition);
}

/** O caminho de volta do arquivamento: o Campo reaparece com os valores que preservou. */
export function restoreFieldDefinition(
  state: DataState,
  actingMemberId: Id,
  definitionId: Id,
): OperationResult<FieldDefinition> {
  const definition = state.fieldDefinitions.find((d) => d.id === definitionId);
  if (!definition) return fail("Campo não encontrado.");
  if (definition.target !== "task" || !definition.definedAtType || !definition.definedAtId) return fail("Este Campo não é de Tarefa.");
  const refusal = mayConfigure(state, actingMemberId, definition.definedAtType, definition.definedAtId);
  if (refusal) return fail(refusal);
  if (definition.lifecycle !== "arquivado") return fail("Este Campo não está arquivado.");
  const container = findContainer(state, definition.definedAtType, definition.definedAtId);
  if (!container || container.lifecycle !== "ativo") return fail("O contêiner que define este Campo não está ativo.");
  const colisao = fieldNameCollision(state, definition.definedAtType, definition.definedAtId, definition.name, definition.id);
  if (colisao) return fail(`Já existe um Campo “${colisao.name}” neste caminho: renomeie um deles antes.`);
  definition.lifecycle = "ativo";
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Definição de Campo restaurada",
    objectType: "fieldDefinition",
    objectId: definition.id,
    objectName: definition.name,
  });
  return ok(definition);
}

/* ───────────────────────────── Conjunto de Status ────────────────────────── */

/** O contêiner precisa DEFINIR o Conjunto para editá-lo; herdado se edita na origem. */
function ownStatusSet(state: DataState, type: ContainerType, id: Id): { container: Container; set: StatusSet } | string {
  const container = findContainer(state, type, id);
  if (!container) return `${CONTAINER_LABEL[type]} não encontrado(a).`;
  if (container.lifecycle !== "ativo") return "Um contêiner arquivado ou na lixeira não muda de configuração.";
  if (!container.statusSet) {
    return `${CONTAINER_LABEL[type]} ${container.name} herda o Conjunto de Status: edite-o na origem ou sobrescreva aqui.`;
  }
  return { container, set: container.statusSet };
}

function checkMinimum(definitions: readonly StatusDefinition[]): string | undefined {
  // RN-ESP-05 / DO-ESP-03 — ao menos um “não iniciado” e um “fechado”.
  if (!definitions.some((d) => d.category === "naoIniciado")) return "O Conjunto precisa de ao menos um Status “não iniciado”.";
  if (!definitions.some((d) => d.category === "fechado")) return "O Conjunto precisa de ao menos um Status “fechado”.";
  return undefined;
}

export function addStatus(
  state: DataState,
  actingMemberId: Id,
  containerType: ContainerType,
  containerId: Id,
  input: { readonly name: string; readonly color: string; readonly category: StatusCategory },
): OperationResult<StatusDefinition> {
  const refusal = mayConfigure(state, actingMemberId, containerType, containerId);
  if (refusal) return fail(refusal);
  const own = ownStatusSet(state, containerType, containerId);
  if (typeof own === "string") return fail(own);
  const name = input.name.trim();
  if (!name) return fail("Dê um nome ao Status.", "nome");
  if (own.set.definitions.some((d) => d.name.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
    return fail(`Já existe um Status “${name}” neste Conjunto.`, "nome");
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return fail("A cor do Status é um hexadecimal de seis dígitos.", "cor");

  const definition: StatusDefinition = {
    id: nextId("st"),
    name,
    color: input.color,
    category: input.category,
    order: (own.set.definitions.at(-1)?.order ?? -1) + 1,
  };
  own.set.definitions.push(definition);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Status criado",
    objectType: containerType,
    objectId: own.container.id,
    objectName: own.container.name,
    after: name,
  });
  return ok(definition);
}

export function updateStatus(
  state: DataState,
  actingMemberId: Id,
  containerType: ContainerType,
  containerId: Id,
  statusId: Id,
  input: { readonly name?: string; readonly color?: string },
): OperationResult<StatusDefinition> {
  const refusal = mayConfigure(state, actingMemberId, containerType, containerId);
  if (refusal) return fail(refusal);
  const own = ownStatusSet(state, containerType, containerId);
  if (typeof own === "string") return fail(own);
  const definition = own.set.definitions.find((d) => d.id === statusId);
  if (!definition) return fail("Status não encontrado neste Conjunto.");

  const mudancas: string[] = [];
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return fail("Dê um nome ao Status.", "nome");
    if (own.set.definitions.some((d) => d.id !== statusId && d.name.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      return fail(`Já existe um Status “${name}” neste Conjunto.`, "nome");
    }
    if (name !== definition.name) {
      mudancas.push(`${definition.name} → ${name}`);
      definition.name = name;
    }
  }
  if (input.color !== undefined && input.color !== definition.color) {
    if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return fail("A cor do Status é um hexadecimal de seis dígitos.", "cor");
    definition.color = input.color;
    mudancas.push("cor");
  }
  if (mudancas.length === 0) return ok(definition);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Status alterado na configuração",
    objectType: containerType,
    objectId: own.container.id,
    objectName: own.container.name,
    detail: mudancas.join(" · "),
  });
  return ok(definition);
}

export function reorderStatuses(
  state: DataState,
  actingMemberId: Id,
  containerType: ContainerType,
  containerId: Id,
  orderedIds: readonly Id[],
): OperationResult<StatusSet> {
  const refusal = mayConfigure(state, actingMemberId, containerType, containerId);
  if (refusal) return fail(refusal);
  const own = ownStatusSet(state, containerType, containerId);
  if (typeof own === "string") return fail(own);
  const atuais = own.set.definitions.map((d) => d.id);
  if (orderedIds.length !== atuais.length || !atuais.every((id) => orderedIds.includes(id))) {
    return fail("A nova ordem precisa conter exatamente os Status do Conjunto.");
  }
  for (const definition of own.set.definitions) definition.order = orderedIds.indexOf(definition.id);
  own.set.definitions.sort((a, b) => a.order - b.order);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Status reordenados",
    objectType: containerType,
    objectId: own.container.id,
    objectName: own.container.name,
  });
  return ok(own.set);
}

/**
 * Remover um Status exige destino para as Tarefas que estão nele — a mesma
 * regra de `removeStage` no Funil. O destino precisa ser do mesmo Conjunto.
 */
export function removeStatus(
  state: DataState,
  actingMemberId: Id,
  containerType: ContainerType,
  containerId: Id,
  statusId: Id,
  destinationStatusId?: Id,
): OperationResult<{ readonly moved: number }> {
  const refusal = mayConfigure(state, actingMemberId, containerType, containerId);
  if (refusal) return fail(refusal);
  const own = ownStatusSet(state, containerType, containerId);
  if (typeof own === "string") return fail(own);
  const definition = own.set.definitions.find((d) => d.id === statusId);
  if (!definition) return fail("Status não encontrado neste Conjunto.");

  const restantes = own.set.definitions.filter((d) => d.id !== statusId);
  const minimo = checkMinimum(restantes);
  if (minimo) return fail(minimo);

  // As Tarefas atingidas: nas Listas que consomem ESTE Conjunto.
  const listas = listsUnder(state, containerType, containerId).filter(
    (l) => effectiveListConfig(state, l.id)?.statusSet.id === own.set.id,
  );
  const listaIds = new Set(listas.map((l) => l.id));
  const atingidas = state.tasks.filter((t) => listaIds.has(t.listId) && t.statusId === statusId);
  let destino: StatusDefinition | undefined;
  if (atingidas.length > 0) {
    if (!destinationStatusId) {
      return fail(`${atingidas.length} Tarefa(s) estão em “${definition.name}”: escolha o Status de destino.`, "destino");
    }
    destino = restantes.find((d) => d.id === destinationStatusId);
    if (!destino) return fail("O Status de destino precisa ser outro do mesmo Conjunto.", "destino");
    for (const task of atingidas) {
      task.statusId = destino.id;
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Status alterado por remoção do Status",
        objectType: "task",
        objectId: task.id,
        objectName: task.title,
        before: definition.name,
        after: destino.name,
      });
    }
  }
  own.set.definitions = restantes;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Status removido",
    objectType: containerType,
    objectId: own.container.id,
    objectName: own.container.name,
    before: definition.name,
    ...(destino ? { after: destino.name, detail: `${atingidas.length} Tarefa(s) movidas` } : {}),
  });
  return ok({ moved: atingidas.length });
}

/**
 * Sobrescrever: a Pasta ou a Lista passa a definir o próprio Conjunto,
 * começando por uma cópia do efetivo — as Tarefas não mudam de Status porque
 * os ids são preservados na cópia.
 */
export function overrideStatusSet(
  state: DataState,
  actingMemberId: Id,
  containerType: "folder" | "list",
  containerId: Id,
): OperationResult<StatusSet> {
  const refusal = mayConfigure(state, actingMemberId, containerType, containerId);
  if (refusal) return fail(refusal);
  const container = findContainer(state, containerType, containerId);
  if (!container) return fail(`${CONTAINER_LABEL[containerType]} não encontrado(a).`);
  if (container.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não muda de configuração.");
  if (container.statusSet) return fail("Este contêiner já define o próprio Conjunto de Status.");
  // O que ESTE nó herda — não o que uma Lista qualquer abaixo consome.
  const efetivo = effectiveContainerConfig(state, containerType, containerId);
  if (!efetivo) return fail("Não há Conjunto efetivo para copiar.");
  const bloqueio = blockedAbove(state, containerType, containerId, "statusSet");
  if (bloqueio) return fail(bloqueio);
  const copia: StatusSet = {
    ...efetivo.statusSet,
    id: nextId("ss"),
    definitions: efetivo.statusSet.definitions.map((d) => ({ ...d })),
  };
  container.statusSet = copia;
  container.modes = { ...container.modes, statusSet: "sobrescrito" };
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conjunto de Status sobrescrito",
    objectType: containerType,
    objectId: container.id,
    objectName: container.name,
    detail: `Copiado de ${efetivo.statusSetDefinedAt.name}`,
  });
  return ok(copia);
}

/**
 * O caminho de volta: o contêiner deixa de definir e volta a herdar. Só é
 * possível enquanto toda Tarefa abaixo ainda cabe no Conjunto herdado — a
 * cópia preserva ids, então isso vale até alguém remover ou criar Status aqui.
 */
export function inheritStatusSet(
  state: DataState,
  actingMemberId: Id,
  containerType: "folder" | "list",
  containerId: Id,
): OperationResult<StatusSet> {
  const refusal = mayConfigure(state, actingMemberId, containerType, containerId);
  if (refusal) return fail(refusal);
  const container = findContainer(state, containerType, containerId);
  if (!container) return fail(`${CONTAINER_LABEL[containerType]} não encontrado(a).`);
  if (container.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não muda de configuração.");
  const proprio = container.statusSet;
  if (!proprio) return fail("Este contêiner já herda o Conjunto de Status.");
  const path = containerPath(state, containerType, containerId);
  const pai = path.at(-2);
  const herdado = pai ? effectiveContainerConfig(state, pai.type, pai.id) : null;
  if (!herdado) return fail("Não há Conjunto acima para herdar.");
  const idsHerdados = new Set(herdado.statusSet.definitions.map((d) => d.id));
  const listas = listsUnder(state, containerType, containerId).filter((l) => effectiveListConfig(state, l.id)?.statusSet.id === proprio.id);
  const listaIds = new Set(listas.map((l) => l.id));
  const fora = state.tasks.filter((t) => listaIds.has(t.listId) && !idsHerdados.has(t.statusId));
  if (fora.length > 0) {
    const naLixeira = fora.filter((t) => t.lifecycle === "naLixeira").length;
    return fail(
      `${fora.length} Tarefa(s) estão em Status que só existem aqui${naLixeira ? ` (${naLixeira} na lixeira)` : ""}. Mova-as para um Status herdado — ou remova o Status aqui, escolhendo um destino — antes de voltar a herdar.`,
    );
  }
  delete container.statusSet;
  container.modes = { ...container.modes, statusSet: "herdado" };
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conjunto de Status voltou a ser herdado",
    objectType: containerType,
    objectId: container.id,
    objectName: container.name,
    detail: `Herda de ${herdado.statusSetDefinedAt.name}`,
  });
  return ok(herdado.statusSet);
}

/* ───────────────────────────── Tipos de Tarefa ───────────────────────────── */

export function createTaskType(
  state: DataState,
  actingMemberId: Id,
  input: { readonly name: string; readonly icon: string; readonly definedAtType: ContainerType; readonly definedAtId: Id },
): OperationResult<TaskType> {
  const container = findContainer(state, input.definedAtType, input.definedAtId);
  if (!container) return fail(`${CONTAINER_LABEL[input.definedAtType]} não encontrado(a).`);
  const refusal = mayConfigure(state, actingMemberId, input.definedAtType, input.definedAtId);
  if (refusal) return fail(refusal);
  if (container.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não recebe Tipo de Tarefa.");
  const bloqueio = blockedAbove(state, input.definedAtType, input.definedAtId, "taskTypes");
  if (bloqueio) return fail(bloqueio);
  const name = input.name.trim();
  if (!name) return fail("Dê um nome ao Tipo de Tarefa.", "nome");
  // B25 — os Tipos acumulam pelo caminho: o nome é único no que este contêiner enxerga, não no Espaço de Trabalho.
  const colisao = taskTypeNameCollision(state, input.definedAtType, input.definedAtId, name);
  if (colisao) return fail(`Já existe um Tipo de Tarefa “${colisao.name}” neste caminho.`, "nome");
  const taskType: TaskType = {
    id: nextId("tt"),
    name,
    icon: input.icon.trim() || "circle",
    isPlatformDefault: false,
    definedAtType: input.definedAtType,
    definedAtId: input.definedAtId,
  };
  state.taskTypes.push(taskType);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tipo de Tarefa criado",
    objectType: input.definedAtType,
    objectId: container.id,
    objectName: container.name,
    after: name,
  });
  return ok(taskType);
}

export function updateTaskType(
  state: DataState,
  actingMemberId: Id,
  taskTypeId: Id,
  input: { readonly name: string },
): OperationResult<TaskType> {
  const index = state.taskTypes.findIndex((t) => t.id === taskTypeId);
  const taskType = state.taskTypes[index];
  if (!taskType) return fail("Tipo de Tarefa não encontrado.");
  const refusal = mayConfigure(state, actingMemberId, taskType.definedAtType, taskType.definedAtId);
  if (refusal) return fail(refusal);
  if (taskType.isPlatformDefault) return fail("O Tipo padrão da plataforma não se renomeia.");
  // `startMeeting` reconhece a Reunião pelo nome: renomear quebraria as calls existentes.
  if (taskType.name === "Reunião") return fail("O Tipo “Reunião” é reconhecido pela plataforma (reuniões e calls) e não se renomeia.");
  const name = input.name.trim();
  if (!name) return fail("Dê um nome ao Tipo de Tarefa.", "nome");
  if (name === taskType.name) return ok(taskType);
  const colisao = taskTypeNameCollision(state, taskType.definedAtType, taskType.definedAtId, name, taskType.id);
  if (colisao) return fail(`Já existe um Tipo de Tarefa “${colisao.name}” neste caminho.`, "nome");
  const next: TaskType = { ...taskType, name };
  state.taskTypes[index] = next;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tipo de Tarefa renomeado",
    objectType: taskType.definedAtType,
    objectId: taskType.definedAtId,
    objectName: findContainer(state, taskType.definedAtType, taskType.definedAtId)?.name ?? taskType.definedAtId,
    before: taskType.name,
    after: name,
  });
  return ok(next);
}

/** O Tipo padrão da plataforma fica; os outros saem só quando nenhuma Tarefa os usa. */
export function removeTaskType(state: DataState, actingMemberId: Id, taskTypeId: Id): OperationResult<TaskType> {
  const taskType = state.taskTypes.find((t) => t.id === taskTypeId);
  if (!taskType) return fail("Tipo de Tarefa não encontrado.");
  const refusal = mayConfigure(state, actingMemberId, taskType.definedAtType, taskType.definedAtId);
  if (refusal) return fail(refusal);
  if (taskType.isPlatformDefault) return fail("O Tipo padrão da plataforma não pode ser removido.");
  if (taskType.name === "Reunião") return fail("O Tipo “Reunião” é reconhecido pela plataforma e não pode ser removido.");
  const emUso = state.tasks.filter((t) => t.taskTypeId === taskTypeId).length;
  if (emUso > 0) return fail(`${emUso} Tarefa(s) são deste Tipo. Troque o Tipo delas antes de removê-lo.`);
  state.taskTypes = state.taskTypes.filter((t) => t.id !== taskTypeId);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tipo de Tarefa removido",
    objectType: taskType.definedAtType,
    objectId: taskType.definedAtId,
    objectName: findContainer(state, taskType.definedAtType, taskType.definedAtId)?.name ?? taskType.definedAtId,
    before: taskType.name,
  });
  return ok(taskType);
}

/* ───────────────────────────── Funcionalidades ───────────────────────────── */

/**
 * B25 — as Funcionalidades substituem por funcionalidade: definir aqui vence
 * o de cima para este nó e tudo abaixo; `null` volta a herdar aquela.
 */
export function setContainerFeature(
  state: DataState,
  actingMemberId: Id,
  containerType: ContainerType,
  containerId: Id,
  feature: keyof EnabledFeatures,
  enabled: boolean | null,
): OperationResult<Partial<EnabledFeatures>> {
  const container = findContainer(state, containerType, containerId);
  if (!container) return fail(`${CONTAINER_LABEL[containerType]} não encontrado(a).`);
  const refusal = mayConfigure(state, actingMemberId, containerType, containerId);
  if (refusal) return fail(refusal);
  if (container.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não muda de configuração.");
  const bloqueio = blockedAbove(state, containerType, containerId, "features");
  if (bloqueio) return fail(bloqueio);
  const proprias: Partial<EnabledFeatures> = { ...(container.features ?? {}) };
  const antes = effectiveContainerConfig(state, containerType, containerId)?.features[feature];
  if (enabled === null) delete proprias[feature];
  else proprias[feature] = enabled;
  container.features = proprias;
  container.modes = { ...container.modes, features: Object.keys(proprias).length > 0 ? "sobrescrito" : "herdado" };
  const depois = effectiveContainerConfig(state, containerType, containerId)?.features[feature];
  if (antes !== depois) {
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Funcionalidade alterada",
      objectType: containerType,
      objectId: container.id,
      objectName: container.name,
      detail: feature,
      before: antes ? "ativa" : "inativa",
      after: depois ? "ativa" : "inativa",
    });
  }
  return ok(proprias);
}
