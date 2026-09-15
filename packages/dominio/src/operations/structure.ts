/**
 * Criação de contêineres da Estrutura de Trabalho.
 *
 * A3 — Espaço contém Pastas e Listas; Pasta contém Subpastas e Listas;
 * Subpasta contém só Listas (A3.4); Lista contém Tarefas. A profundidade para
 * aí, e é a operação que garante isso: uma tela que apenas esconde a opção
 * deixa a regra passar por qualquer outro caminho.
 */

import { effectiveListConfig, memberReachesContainer } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Folder, Id, List, Provenance, Space, StatusSet, Template } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";

const now = (): string => new Date().toISOString();

/** Quem cria contêiner precisa de Papel que administre a Estrutura (17.2). */
function mayBuild(state: DataState, actingMemberId: Id, parent?: { readonly type: "space" | "folder"; readonly id: Id }): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo cria contêiner.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return "Um Convidado não cria contêiner: ele alcança só o que foi compartilhado com ele.";
  }
  // B38 — dentro de um contêiner privado só constrói quem o alcança.
  if (parent && !memberReachesContainer(state, actingMemberId, parent.type, parent.id)) {
    return "Você não alcança este contêiner: ele é privado e nada foi concedido a você.";
  }
  return undefined;
}

function nameTaken(existing: ReadonlyArray<{ name: string; lifecycle: string }>, name: string): boolean {
  const norm = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
  return existing.some((item) => item.lifecycle !== "naLixeira" && norm(item.name) === norm(name));
}

/**
 * RN-ESP-03 — o Espaço é o ponto mais alto de definição e SEMPRE define um
 * Conjunto de Status. Um Espaço sem Conjunto deixaria toda Lista abaixo dele
 * sem configuração efetiva, e nenhuma Tarefa poderia existir.
 *
 * RN-ESP-05 — o Conjunto precisa de ao menos um `naoIniciado` e um `fechado`.
 */
export function createSpace(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly name: string;
    readonly description?: string;
    readonly color?: string;
    readonly isPrivate?: boolean;
    readonly statusSet?: StatusSet;
    readonly templateId?: Id;
  },
): OperationResult<Space> {
  const refusal = mayBuild(state, actingMemberId);
  if (refusal) return fail(refusal);
  if (!input.name.trim()) return fail("Dê um nome ao Espaço.", "nome");
  if (nameTaken(state.spaces, input.name)) {
    return fail(`Já existe um Espaço chamado “${input.name.trim()}”.`, "nome");
  }

  const counted = state.spaces.filter((s) => s.lifecycle !== "naLixeira").length;
  if (counted >= state.workspace.limits.spaces) {
    return fail(
      `O limite de ${state.workspace.limits.spaces} Espaços do Espaço de Trabalho foi atingido.`,
    );
  }

  const { template, error: templateError } = resolveTemplate(state, input.templateId, "espaco");
  if (templateError) return fail(templateError, "template");

  const statusSet: StatusSet = input.statusSet ?? defaultStatusSet();
  const hasStart = statusSet.definitions.some((d) => d.category === "naoIniciado");
  const hasEnd = statusSet.definitions.some((d) => d.category === "fechado");
  if (!hasStart || !hasEnd) {
    return fail(
      "O Conjunto de Status precisa de ao menos um status não iniciado e um fechado.",
      "status",
    );
  }

  const space: Space = {
    id: nextId("spc"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.color ? { color: input.color } : {}),
    order: state.spaces.length,
    isPrivate: input.isPrivate ?? false,
    modes: {},
    blocks: {},
    ...(template ? { provenance: provenanceOf(template) } : {}),
    statusSet,
  };
  state.spaces.push(space);

  // O Template cria as Pastas que declara, cada uma com a mesma Proveniência.
  for (const name of template?.creates?.folders ?? []) {
    state.folders.push({
      id: nextId("fld"),
      workspaceId: state.workspace.id,
      createdBy: memberActor(actingMemberId),
      createdAt: now(),
      lifecycle: "ativo",
      name,
      order: state.folders.filter((f) => f.parentId === space.id).length,
      isPrivate: false,
      modes: {},
      blocks: {},
      provenance: provenanceOf(template as Template),
      parentType: "space",
      parentId: space.id,
    });
  }

  // B38a — um Espaço privado some para todo mundo sem concessão, inclusive para
  // quem acabou de criá-lo. A concessão ao criador nasce junto, senão o Espaço
  // nasce inalcançável e só um ato de governança o traz de volta.
  if (space.isPrivate) {
    state.grants.push({
      id: nextId("grt"),
      workspaceId: state.workspace.id,
      subjectKind: "member",
      subjectId: actingMemberId,
      resourceType: "space",
      resourceId: space.id,
      action: "administrar",
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: actingMemberId,
      grantedAt: now(),
    });
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Espaço criado",
    objectType: "space",
    objectId: space.id,
    objectName: space.name,
    ...(() => {
      const parts = [
        space.isPrivate ? "Privado: só quem tem concessão o vê." : undefined,
        template
          ? `Instanciado do Template “${template.name}”${
              template.creates?.folders?.length
                ? ` · ${template.creates.folders.length} Pasta(s) criadas com ele`
                : ""
            }.`
          : undefined,
      ].filter((part) => part !== undefined);
      return parts.length > 0 ? { detail: parts.join(" ") } : {};
    })(),
  });
  return ok(space);
}

/** A3.4 — uma Subpasta não contém Pasta. A profundidade para na segunda. */
export function createFolder(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly name: string;
    readonly parentType: "space" | "folder";
    readonly parentId: Id;
    readonly description?: string;
    readonly isPrivate?: boolean;
    readonly templateId?: Id;
  },
): OperationResult<Folder> {
  const refusal = mayBuild(state, actingMemberId, { type: input.parentType, id: input.parentId });
  if (refusal) return fail(refusal);
  if (!input.name.trim()) return fail("Dê um nome à Pasta.", "nome");

  if (input.parentType === "space") {
    const parent = state.spaces.find((s) => s.id === input.parentId);
    if (!parent) return fail("Espaço não encontrado.");
    if (parent.lifecycle !== "ativo") return fail("Este Espaço não está ativo.");
  } else {
    const parent = state.folders.find((f) => f.id === input.parentId);
    if (!parent) return fail("Pasta não encontrada.");
    if (parent.lifecycle !== "ativo") return fail("Esta Pasta não está ativa.");
    if (parent.parentType === "folder") {
      return fail("Uma Subpasta não contém outra Pasta: a estrutura para aqui.");
    }
  }

  const siblings = state.folders.filter(
    (f) => f.parentType === input.parentType && f.parentId === input.parentId,
  );
  if (nameTaken(siblings, input.name)) {
    return fail(`Já existe uma Pasta chamada “${input.name.trim()}” aqui.`, "nome");
  }

  const { template, error: templateError } = resolveTemplate(
    state,
    input.templateId,
    "pasta",
    input.parentType,
  );
  if (templateError) return fail(templateError, "template");


  const folder: Folder = {
    id: nextId("fld"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    order: siblings.length,
    isPrivate: input.isPrivate ?? false,
    // Nasce herdando: o ajuste é ato posterior, nas configurações do contêiner.
    modes: {},
    blocks: {},
    ...(template ? { provenance: provenanceOf(template) } : {}),
    parentType: input.parentType,
    parentId: input.parentId,
  };
  state.folders.push(folder);

  // B38a — o mesmo do Espaço: o contêiner privado nasce com a concessão ao criador,
  // senão nem quem o criou consegue abri-lo.
  if (folder.isPrivate) {
    state.grants.push({
      id: nextId("grt"),
      workspaceId: state.workspace.id,
      subjectKind: "member",
      subjectId: actingMemberId,
      resourceType: "folder",
      resourceId: folder.id,
      action: "administrar",
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: actingMemberId,
      grantedAt: now(),
    });
  }

  for (const name of template?.creates?.lists ?? []) {
    state.lists.push({
      id: nextId("lst"),
      workspaceId: state.workspace.id,
      createdBy: memberActor(actingMemberId),
      createdAt: now(),
      lifecycle: "ativo",
      name,
      order: state.lists.filter((l) => l.parentId === folder.id).length,
      isPrivate: false,
      modes: {},
      blocks: {},
      provenance: provenanceOf(template as Template),
      parentType: "folder",
      parentId: folder.id,
    });
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: folder.parentType === "folder" ? "Subpasta criada" : "Pasta criada",
    objectType: "folder",
    objectId: folder.id,
    objectName: folder.name,
    detail: parentName(state, input.parentType, input.parentId),
  });
  return ok(folder);
}

/**
 * A Lista nasce sem Conjunto próprio: ela herda do ancestral (B25). Se a
 * herança não resolver, a Lista não teria configuração efetiva e nenhuma Tarefa
 * caberia nela — por isso a operação confere DEPOIS de montar e desfaz.
 */
export function createList(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly name: string;
    readonly parentType: "space" | "folder";
    readonly parentId: Id;
    readonly description?: string;
    readonly isPrivate?: boolean;
    readonly templateId?: Id;
  },
): OperationResult<List> {
  const refusal = mayBuild(state, actingMemberId, { type: input.parentType, id: input.parentId });
  if (refusal) return fail(refusal);
  if (!input.name.trim()) return fail("Dê um nome à Lista.", "nome");

  if (input.parentType === "space") {
    const parent = state.spaces.find((s) => s.id === input.parentId);
    if (!parent) return fail("Espaço não encontrado.");
    if (parent.lifecycle !== "ativo") return fail("Este Espaço não está ativo.");
  } else {
    const parent = state.folders.find((f) => f.id === input.parentId);
    if (!parent) return fail("Pasta não encontrada.");
    if (parent.lifecycle !== "ativo") return fail("Esta Pasta não está ativa.");
  }

  const siblings = state.lists.filter(
    (l) => l.parentType === input.parentType && l.parentId === input.parentId,
  );
  if (nameTaken(siblings, input.name)) {
    return fail(`Já existe uma Lista chamada “${input.name.trim()}” aqui.`, "nome");
  }

  const { template, error: templateError } = resolveTemplate(state, input.templateId, "lista");
  if (templateError) return fail(templateError, "template");


  const list: List = {
    id: nextId("lst"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    order: siblings.length,
    isPrivate: input.isPrivate ?? false,
    // Nasce herdando: o ajuste é ato posterior, nas configurações do contêiner.
    modes: {},
    blocks: {},
    ...(template ? { provenance: provenanceOf(template) } : {}),
    parentType: input.parentType,
    parentId: input.parentId,
  };
  state.lists.push(list);

  if (effectiveListConfig(state, list.id) === null) {
    state.lists.pop();
    return fail(
      "Nenhum ancestral desta Lista define um Conjunto de Status, então ela não receberia Tarefa nenhuma.",
    );
  }

  // B38a — o mesmo do Espaço: o contêiner privado nasce com a concessão ao criador,
  // senão nem quem o criou consegue abri-lo.
  if (list.isPrivate) {
    state.grants.push({
      id: nextId("grt"),
      workspaceId: state.workspace.id,
      subjectKind: "member",
      subjectId: actingMemberId,
      resourceType: "list",
      resourceId: list.id,
      action: "administrar",
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: actingMemberId,
      grantedAt: now(),
    });
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Lista criada",
    objectType: "list",
    objectId: list.id,
    objectName: list.name,
    detail: parentName(state, input.parentType, input.parentId),
  });
  return ok(list);
}

/**
 * A8 — instanciar um Template NÃO cria vínculo vivo: ele copia a estrutura e
 * deixa Proveniência, que é um valor (nome no momento), não um ponteiro. Mudar
 * o Template depois não mexe no que já foi criado.
 *
 * B47 — um Template de Pasta que contém Subpastas só se instancia dentro de um
 * Espaço: dentro de outra Pasta, as Subpastas dele não teriam onde existir.
 */
function resolveTemplate(
  state: DataState,
  templateId: Id | undefined,
  kind: Template["kind"],
  parentType?: "space" | "folder",
): { readonly template?: Template; readonly error?: string } {
  if (!templateId) return {};
  const template = state.templates.find((t) => t.id === templateId);
  if (!template) return { error: "Template não encontrado." };
  if (template.lifecycle !== "ativo") return { error: "Este Template não está ativo." };
  if (template.kind !== kind) return { error: `Este Template não é de ${kind}.` };
  if (kind === "pasta" && template.containsSubfolders && parentType === "folder") {
    return {
      error: "Este Template contém Subpastas e só pode ser instanciado dentro de um Espaço (B47).",
    };
  }
  return { template };
}

function provenanceOf(template: Template): Provenance {
  return {
    kind: "template",
    sourceId: template.id,
    sourceName: template.name,
    at: now(),
  };
}

function parentName(state: DataState, parentType: "space" | "folder", parentId: Id): string {
  const parent =
    parentType === "space"
      ? state.spaces.find((s) => s.id === parentId)
      : state.folders.find((f) => f.id === parentId);
  return parent?.name ?? parentId;
}

/** RN-ESP-05 — o mínimo que um Conjunto precisa ter para ser válido. */
function defaultStatusSet(): StatusSet {
  return {
    id: nextId("sts"),
    definitions: [
      { id: nextId("st"), name: "A fazer", color: "#94a3b8", category: "naoIniciado", order: 0 },
      { id: nextId("st"), name: "Em andamento", color: "#3b82f6", category: "emAndamento", order: 1 },
      { id: nextId("st"), name: "Concluído", color: "#10b981", category: "concluido", order: 2 },
      { id: nextId("st"), name: "Cancelado", color: "#6b7280", category: "fechado", order: 3 },
    ],
  };
}
