/**
 * Criação e ciclo de vida de contêineres da Estrutura de Trabalho.
 *
 * A3 — Espaço contém Pastas e Listas; Pasta contém Subpastas e Listas;
 * Subpasta contém só Listas (A3.4); Lista contém Tarefas. A profundidade para
 * aí, e é a operação que garante isso: uma tela que apenas esconde a opção
 * deixa a regra passar por qualquer outro caminho.
 */

import { containerAdminRefusal, containerPath, definesAspect, effectiveLifecycleOfContainer, effectiveListConfig, irmaosOrdenados, memberReachesContainer } from "../derive";
import { ehEstruturaFixa, PASTA_MEUS_NEGOCIOS_ID } from "../estruturas-fixas";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { EffectiveListConfig, Folder, Id, Lifecycle, List, ModeloDeTarefa, PaiDeConteiner, Provenance, Space, StatusCategory, StatusSet, Task, Template } from "../types";

export type { PaiDeConteiner };
import { memberActor, nextId, recordActivity } from "./activity";
import { CANAIS_SO_NA_CONVERSACIONAL, validarCanaisDeAtendimento } from "./canais";
import { ASPECTOS_QUE_SUBSTITUEM, blockedAtOrAbove, fieldNameCollision, taskTypeNameCollision } from "./configuration";
import { aplicarConfiguracaoEfetiva, frasePedindoMapeamento, statusSemMapeamento, type StatusMapping } from "./tasks";

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
 * Pitfall 3 — a `order` de quem entra num grupo de irmãos: depois do maior que
 * já existe, nunca `length`. Mover renumera a origem e põe o movido no fim do
 * destino; criar com `length` repetiria a `order` de qualquer grupo que tenha um
 * buraco (dado antigo, ou um irmão que saiu). A lixeira conta, como sempre.
 */
function proximaOrdem(irmaos: ReadonlyArray<{ readonly order: number }>): number {
  return irmaos.length === 0 ? 0 : Math.max(...irmaos.map((c) => c.order)) + 1;
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
    order: proximaOrdem(state.spaces),
    isPrivate: input.isPrivate ?? false,
    modes: {},
    blocks: {},
    ...(template ? { provenance: provenanceOf(template) } : {}),
    statusSet,
  };
  state.spaces.push(space);
  // Todo Espaço nasce com o Tipo padrão da plataforma, como os do seed. Sem
  // ele, nenhuma Lista abaixo aceita Tarefa: a criação recusa "sem Tipo".
  state.taskTypes.push({
    id: nextId("tt"),
    name: "Tarefa",
    icon: "circle-check",
    isPlatformDefault: true,
    definedAtType: "space",
    definedAtId: space.id,
  });

  // O Template cria as Pastas que declara, cada uma com a mesma Proveniência.
  for (const name of template?.creates?.folders ?? []) {
    state.folders.push({
      id: nextId("fld"),
      workspaceId: state.workspace.id,
      createdBy: memberActor(actingMemberId),
      createdAt: now(),
      lifecycle: "ativo",
      name,
      order: proximaOrdem(state.folders.filter((f) => f.parentType === "space" && f.parentId === space.id)),
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
    order: proximaOrdem(siblings),
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
      order: proximaOrdem(state.lists.filter((l) => l.parentType === "folder" && l.parentId === folder.id)),
      isPrivate: false,
      // C35 — o Template de Pasta só nomeia as Listas: nascem no modelo padrão.
      modeloDeTarefa: "operacional",
      modes: {},
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
    /** C35 — o que a Tarefa é ao nascer aqui; ausente, `operacional`. */
    readonly modeloDeTarefa?: ModeloDeTarefa;
    /** C36 — por onde a Lista conversacional atende; ela exige ao menos um. */
    readonly canaisDeAtendimento?: readonly Id[];
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

  // C36 — a conversacional nasce dizendo por onde atende; a operacional não
  // tem o que dizer.
  const modelo = input.modeloDeTarefa ?? "operacional";
  let canais: readonly Id[] | undefined;
  if (modelo === "conversacional") {
    const validos = validarCanaisDeAtendimento(state, input.canaisDeAtendimento);
    if (typeof validos === "string") return fail(validos, "canais");
    canais = validos.ids;
  } else if (input.canaisDeAtendimento && input.canaisDeAtendimento.length > 0) {
    return fail(CANAIS_SO_NA_CONVERSACIONAL, "canais");
  }

  const list: List = {
    id: nextId("lst"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    order: proximaOrdem(siblings),
    isPrivate: input.isPrivate ?? false,
    modeloDeTarefa: modelo,
    ...(canais ? { canaisDeAtendimento: canais } : {}),
    // Nasce herdando: o ajuste é ato posterior, nas configurações do contêiner.
    modes: {},
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
    detail:
      parentName(state, input.parentType, input.parentId) +
      (list.modeloDeTarefa === "conversacional" ? " · Modelo conversacional: cada Tarefa nasce de um Contato" : "") +
      (canais ? ` · Atende por ${nomesDosCanais(state, canais)}` : ""),
  });
  return ok(list);
}

/** Os nomes dos Canais, na ordem dada, para o Registro de Atividade. */
export function nomesDosCanais(state: DataState, ids: readonly Id[]): string {
  return ids.map((id) => state.channels.find((c) => c.id === id)?.name ?? id).join(", ");
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
      error: "Este Template contém Subpastas e só pode ser instanciado dentro de um Espaço.",
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

/* ───────────────── Ciclo de vida e identidade (POSC-09) ───────────────── */

/**
 * O que um contêiner é depois de criado também muda: nome, descrição, cor e
 * privacidade (`updateContainer`); e o estado próprio anda pelos três de
 * `Lifecycle` — arquivar/desarquivar e enviar à lixeira/restaurar. Antes só
 * `closeSprint` arquivava uma Lista, e nada a desarquivava.
 *
 * As regras vêm de espaco.md (valem para Pasta e Lista por RN-PAS/RN-LIS):
 *   - RN-ESP-11: sobre um registro cujo estado EFETIVO não é `ativo` só vale
 *     ver, alterar permissões e alterar o estado próprio — nada de editar
 *     conteúdo. Por isso `updateContainer` exige efetivamente ativo, e as
 *     quatro de estado não: uma Lista arquivada sob Espaço arquivado é
 *     desarquivada mesmo assim, e continua efetivamente arquivada até o
 *     Espaço voltar (B36 — o efetivo é derivado, nunca gravado).
 *   - B43: a lixeira grava o estado próprio anterior e a restauração o
 *     devolve, nunca força `ativo`. O que foi à lixeira COM o contêiner volta
 *     com ele — é o mesmo `trashedAt` que distingue a cascata do que já
 *     estava lá antes (o mesmo critério de `restoreList`, em tasks.ts).
 *   - RN-ESP-23 / B39: nome único entre irmãos não-lixeira; renomear ou
 *     restaurar com colisão é recusado.
 *   - espaco.md:217: arquivar e desarquivar exigem `administrar`; lixeira e
 *     restauração exigem `excluir` — administrar cobre, e uma concessão
 *     direta de `excluir` no caminho basta.
 *   - Não existe eliminação permanente a partir de `ativo`: "excluir" na tela
 *     é enviar à lixeira.
 */

export type TipoDeConteiner = "space" | "folder" | "list";

type Conteiner = Space | Folder | List;

const ROTULO: Record<TipoDeConteiner, { readonly nome: string; readonly artigo: "o" | "a"; readonly arquivado: string; readonly restaurado: string }> = {
  space: { nome: "Espaço", artigo: "o", arquivado: "arquivado", restaurado: "restaurado" },
  folder: { nome: "Pasta", artigo: "a", arquivado: "arquivada", restaurado: "restaurada" },
  list: { nome: "Lista", artigo: "a", arquivado: "arquivada", restaurado: "restaurada" },
};

function findContainer(state: DataState, type: TipoDeConteiner, id: Id): Conteiner | undefined {
  return type === "space"
    ? state.spaces.find((s) => s.id === id)
    : type === "folder"
      ? state.folders.find((f) => f.id === id)
      : state.lists.find((l) => l.id === id);
}

/** Os irmãos entre os quais o nome precisa ser único (RN-ESP-23 / B39), sem o próprio. */
function siblingsOf(state: DataState, type: TipoDeConteiner, container: Conteiner): ReadonlyArray<{ name: string; lifecycle: string }> {
  if (type === "space") return state.spaces.filter((s) => s.id !== container.id);
  const own = container as Folder | List;
  const pool: ReadonlyArray<Folder | List> = type === "folder" ? state.folders : state.lists;
  return pool.filter((c) => c.id !== own.id && c.parentType === own.parentType && c.parentId === own.parentId);
}

/** Um contêiner não é encontrado quando não existe OU quando quem pede não o alcança — para quem não alcança, ele não existe (RN-ESP-15). */
function requireContainer(state: DataState, actingMemberId: Id, type: TipoDeConteiner, id: Id): Conteiner | string {
  const container = findContainer(state, type, id);
  if (!container || !memberReachesContainer(state, actingMemberId, type, id)) return `${ROTULO[type].nome} não encontrad${ROTULO[type].artigo}.`;
  return container;
}

/**
 * Lixeira e restauração exigem `excluir` (espaco.md:217): quem administra o
 * contêiner tem, e uma concessão direta de `excluir` nele ou acima também
 * serve — é a única porta para quem não é Administrador nem Proprietário.
 * Exportada para a tela desligar o botão com a mesma frase (não é caso de uso;
 * não entra em `OPERACOES`).
 */
export function containerTrashRefusal(state: DataState, actingMemberId: Id, type: TipoDeConteiner, id: Id): string | undefined {
  const admin = containerAdminRefusal(state, actingMemberId, type, id);
  if (!admin) return undefined;
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return admin;
  const nosDoCaminho = new Set(containerPath(state, type, id).map((n) => n.id));
  const teams = state.teams.filter((t) => t.memberIds.includes(actingMemberId)).map((t) => t.id);
  const temExcluir = state.grants.some(
    (g) =>
      g.action === "excluir" &&
      nosDoCaminho.has(g.resourceId) &&
      ((g.subjectKind === "member" && g.subjectId === actingMemberId) || (g.subjectKind === "team" && teams.includes(g.subjectId))),
  );
  if (temExcluir) return undefined;
  return `Enviar à lixeira ou restaurar exige excluir ${ROTULO[type].artigo} ${ROTULO[type].nome}: Administrador, Proprietário ou concessão direta.`;
}

/** B36 — um apontamento em andamento fecha no instante em que a Tarefa deixa de estar efetivamente ativa. */
function closeRunningTimeEntries(task: Task, at: string): void {
  for (const entry of task.timeEntries) {
    if (!entry.end) {
      entry.end = at;
      entry.durationMinutes = Math.max(1, Math.round((Date.parse(entry.end) - Date.parse(entry.start)) / 60_000));
    }
  }
}

/** Toda a subárvore abaixo de um contêiner, no mesmo formato da cascata (B36). */
function descendantsOf(state: DataState, type: TipoDeConteiner, id: Id): { readonly folders: Folder[]; readonly lists: List[]; readonly tasks: Task[] } {
  const folders: Folder[] = [];
  const lists: List[] = [];
  if (type !== "list") {
    const fila: Array<{ type: "space" | "folder"; id: Id }> = [{ type, id }];
    while (fila.length > 0) {
      const atual = fila.shift();
      if (!atual) break;
      for (const f of state.folders) {
        if (f.parentType === atual.type && f.parentId === atual.id) {
          folders.push(f);
          fila.push({ type: "folder", id: f.id });
        }
      }
      for (const l of state.lists) {
        if (l.parentType === atual.type && l.parentId === atual.id) lists.push(l);
      }
    }
  }
  const listIds = new Set(type === "list" ? [id] : lists.map((l) => l.id));
  const tasks = state.tasks.filter((t) => listIds.has(t.listId));
  return { folders, lists, tasks };
}

function parentOf(state: DataState, type: TipoDeConteiner, container: Conteiner): { readonly type: "space" | "folder"; readonly container: Space | Folder | undefined } | undefined {
  if (type === "space") return undefined;
  const own = container as Folder | List;
  return {
    type: own.parentType,
    container: own.parentType === "folder" ? state.folders.find((f) => f.id === own.parentId) : state.spaces.find((s) => s.id === own.parentId),
  };
}

export interface UpdateContainerInput {
  readonly name?: string;
  /** Vazio apaga a descrição. */
  readonly description?: string;
  readonly color?: string;
  readonly isPrivate?: boolean;
}

/**
 * Nome, descrição, cor e privacidade de um contêiner existente. Exige
 * administrar o contêiner e que ele esteja EFETIVAMENTE ativo (RN-ESP-11).
 * O nome continua único entre os irmãos (RN-ESP-23 / B39).
 */
export function updateContainer(
  state: DataState,
  actingMemberId: Id,
  type: TipoDeConteiner,
  id: Id,
  input: UpdateContainerInput,
): OperationResult<Conteiner> {
  const found = requireContainer(state, actingMemberId, type, id);
  if (typeof found === "string") return fail(found);
  const container = found;
  const refusal = containerAdminRefusal(state, actingMemberId, type, id);
  if (refusal) return fail(refusal);
  const efetivo = effectiveLifecycleOfContainer(state, type, id);
  if (efetivo !== "ativo") {
    return fail(
      efetivo === "arquivado"
        ? `${ROTULO[type].nome} ${ROTULO[type].arquivado}: desarquive antes de editar.`
        : `${ROTULO[type].nome} na lixeira: restaure antes de editar.`,
    );
  }

  const nomeAntes = container.name;
  if (input.name !== undefined) {
    const nome = input.name.trim();
    if (!nome) return fail(`Dê um nome ${ROTULO[type].artigo === "o" ? "ao" : "à"} ${ROTULO[type].nome}.`, "nome");
    if (nameTaken(siblingsOf(state, type, container), nome)) {
      return fail(`Já existe ${ROTULO[type].artigo === "o" ? "um" : "uma"} ${ROTULO[type].nome} chamad${ROTULO[type].artigo} “${nome}” aqui.`, "nome");
    }
    container.name = nome;
  }
  if (input.description !== undefined) {
    const descricao = input.description.trim();
    if (descricao) container.description = descricao;
    else delete container.description;
  }
  if (input.color !== undefined) {
    const cor = input.color.trim();
    if (type === "space") {
      if (!cor) return fail("Dê uma cor ao Espaço.", "cor");
      (container as Space).color = cor;
    } else if (cor) {
      container.color = cor;
    } else {
      delete container.color;
    }
  }
  if (input.isPrivate !== undefined) container.isPrivate = input.isPrivate;

  const renomeado = input.name !== undefined && container.name !== nomeAntes;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: renomeado ? `${ROTULO[type].nome} renomead${ROTULO[type].artigo}` : `${ROTULO[type].nome} alterad${ROTULO[type].artigo}`,
    objectType: type,
    objectId: container.id,
    objectName: container.name,
    ...(renomeado ? { before: nomeAntes, after: container.name } : {}),
  });
  return ok(container);
}

/**
 * D-11 (2.3.1) — o novo pai de uma Pasta ou Lista. O Espaço não se move: ele é
 * a raiz. Uma Lista ou Pasta vai para um Espaço (sem Pasta no meio) ou para uma
 * Pasta.
 */
export interface DestinoDeMover {
  readonly parentType: "space" | "folder";
  readonly parentId: Id;
}

type Movel = Folder | List;

/** O caminho legível de um contêiner (`Comercial › Clientes`), como `moveTask` grava. */
function caminhoLegivel(state: DataState, type: TipoDeConteiner, id: Id): string {
  return containerPath(state, type, id)
    .map((p) => p.name)
    .join(" › ");
}

/** Os irmãos do mesmo tipo sob um pai, sem o próprio: o grupo cuja `order` o mover mexe. */
function grupoDe(state: DataState, tipo: "folder" | "list", parentType: "space" | "folder", parentId: Id, semId?: Id): Movel[] {
  const pool: ReadonlyArray<Movel> = tipo === "folder" ? state.folders : state.lists;
  return pool.filter((c) => c.id !== semId && c.parentType === parentType && c.parentId === parentId);
}

interface RecusaDeMover {
  readonly mensagem: string;
  readonly campo?: string;
}

function recusarMover(state: DataState, actingMemberId: Id, tipo: "folder" | "list", id: Id, destino: DestinoDeMover): RecusaDeMover | undefined {
  const found = requireContainer(state, actingMemberId, tipo, id);
  if (typeof found === "string") return { mensagem: found };
  const movido = found as Movel;
  const admin = containerAdminRefusal(state, actingMemberId, tipo, id);
  if (admin) return { mensagem: admin };
  // O movido pode estar arquivado (RN-PAS-11) e vai assim mesmo; na lixeira, não.
  if (movido.lifecycle === "naLixeira") return { mensagem: `${ROTULO[tipo].nome} na lixeira: restaure antes de mover.` };

  // O destino que o ator não alcança não existe para ele (RN-ESP-15): sem nome, sem pista.
  const alvo = requireContainer(state, actingMemberId, destino.parentType, destino.parentId);
  if (typeof alvo === "string") return { mensagem: alvo };
  if (effectiveLifecycleOfContainer(state, destino.parentType, destino.parentId) !== "ativo") {
    const r = ROTULO[destino.parentType];
    return { mensagem: `${r.artigo === "o" ? "Este" : "Esta"} ${r.nome} não está ativ${r.artigo}.` };
  }
  const construir = mayBuild(state, actingMemberId, { type: destino.parentType, id: destino.parentId });
  if (construir) return { mensagem: construir };

  if (movido.parentType === destino.parentType && movido.parentId === destino.parentId) return { mensagem: "Já está aqui." };
  if (tipo === "folder" && containerPath(state, destino.parentType, destino.parentId).some((n) => n.type === "folder" && n.id === id)) {
    return { mensagem: "Um contêiner não vai para dentro de si mesmo." };
  }
  // Q2/A7 — o conjunto fechado das estruturas que o código endereça por id; só o movido e o destino são nomeados.
  if (ehEstruturaFixa(tipo, id)) return { mensagem: `${ROTULO[tipo].nome} ${movido.name} é uma estrutura fixa e não muda de lugar.` };
  if (containerPath(state, destino.parentType, destino.parentId).some((n) => n.type === "folder" && n.id === PASTA_MEUS_NEGOCIOS_ID)) {
    return { mensagem: "A Pasta Meus negócios não recebe Pastas nem Listas." };
  }
  // Profundidade (RN-SUB-11, RN-SUB-02): a estrutura tem no máximo dois níveis de Pasta.
  if (tipo === "folder" && destino.parentType === "folder") {
    if (state.folders.some((f) => f.parentType === "folder" && f.parentId === id)) {
      return { mensagem: "Uma Pasta com Subpastas não vai para dentro de outra Pasta." };
    }
    if (state.folders.find((f) => f.id === destino.parentId)?.parentType === "folder") {
      return { mensagem: "Uma Subpasta não contém outra Pasta: a estrutura para aqui." };
    }
  }
  if (nameTaken(grupoDe(state, tipo, destino.parentType, destino.parentId, id), movido.name)) {
    const r = ROTULO[tipo];
    return {
      mensagem: `Já existe ${r.artigo === "o" ? "um" : "uma"} ${r.nome} chamad${r.artigo} “${movido.name}” em ${alvo.name}.`,
      campo: "nome",
    };
  }
  return recusaPorConfiguracao(state, actingMemberId, tipo, movido, destino);
}

/** O movido e tudo abaixo dele que não está na lixeira: onde a configuração própria pode morar. */
function nosDaSubarvore(state: DataState, tipo: "folder" | "list", movido: Movel): Array<{ readonly tipo: "folder" | "list"; readonly id: Id }> {
  const nos: Array<{ readonly tipo: "folder" | "list"; readonly id: Id }> = [{ tipo, id: movido.id }];
  if (tipo === "list") return nos;
  const abaixo = descendantsOf(state, "folder", movido.id);
  for (const f of abaixo.folders) if (effectiveLifecycleOfContainer(state, "folder", f.id) !== "naLixeira") nos.push({ tipo: "folder", id: f.id });
  for (const l of abaixo.lists) if (effectiveLifecycleOfContainer(state, "list", l.id) !== "naLixeira") nos.push({ tipo: "list", id: l.id });
  return nos;
}

/** Roda `ler` com o pai do movido já trocado pelo destino e o devolve como estava (também se `ler` lançar). */
function comPaiNoDestino<T>(movido: Movel, destino: DestinoDeMover, ler: () => T): T {
  const origem = { parentType: movido.parentType, parentId: movido.parentId };
  movido.parentType = destino.parentType;
  movido.parentId = destino.parentId;
  try {
    return ler();
  } finally {
    movido.parentType = origem.parentType;
    movido.parentId = origem.parentId;
  }
}

/**
 * As recusas que dependem do que o movido e o que está abaixo dele CONFIGURAM
 * (RESEARCH Pattern 3, itens 6 a 8): bloqueio do destino, colisão de nome de
 * Campo e de Tipo no caminho novo e Formulário que o envio deixaria de aceitar.
 * Nenhuma frase nomeia contêiner que o ator não alcança (B38a): os nomes citados
 * são o do destino e de quem o bloqueia (o ator alcança o destino, logo o
 * caminho dele), o do Campo ou Tipo que o movido define e, no Formulário, só o
 * de uma Lista que o ator administra.
 */
function recusaPorConfiguracao(state: DataState, actingMemberId: Id, tipo: "folder" | "list", movido: Movel, destino: DestinoDeMover): RecusaDeMover | undefined {
  const nos = nosDaSubarvore(state, tipo, movido);

  // 6. Bloqueio (RN-ESP-09, D-16): só os aspectos que SUBSTITUEM recusam; os que acumulam ficam (A5).
  for (const aspecto of ASPECTOS_QUE_SUBSTITUEM) {
    if (!nos.some((n) => definesAspect(state, n.tipo, n.id, aspecto))) continue;
    const bloqueio = blockedAtOrAbove(state, destino.parentType, destino.parentId, aspecto);
    if (bloqueio) return { mensagem: bloqueio };
  }

  // 7. Colisão de nome (RN-PAS-14, DO-LIS-05): a leitura é a de `createFieldDefinition`, só que com o movido já no caminho novo.
  const ids = new Set(nos.map((n) => n.id));
  const colisao = comPaiNoDestino(movido, destino, (): string | undefined => {
    for (const d of state.fieldDefinitions) {
      if (d.target !== "task" || d.lifecycle !== "ativo" || d.definedAtId === undefined || !ids.has(d.definedAtId)) continue;
      const no = nos.find((n) => n.id === d.definedAtId);
      if (no && fieldNameCollision(state, no.tipo, no.id, d.name, d.id)) {
        return `Já existe um Campo chamado “${d.name}” no caminho de destino: renomeie antes de mover.`;
      }
    }
    for (const t of state.taskTypes) {
      if (t.isPlatformDefault || !ids.has(t.definedAtId)) continue;
      const no = nos.find((n) => n.id === t.definedAtId);
      if (no && taskTypeNameCollision(state, no.tipo, no.id, t.name, t.id)) {
        return `Já existe um Tipo de Tarefa chamado “${t.name}” no caminho de destino: renomeie antes de mover.`;
      }
    }
    return undefined;
  });
  if (colisao) return { mensagem: colisao, campo: "nome" };

  // 8. Formulário ativo que pergunta um Campo que deixaria de valer: o envio quebraria (molde de `usarCampoHerdado`).
  const mudancas = mudancasDeConfiguracao(state, tipo, movido, destino);
  if (!mudancas) return { mensagem: "Configuração efetiva indisponível." };
  let anonimo = false;
  for (const m of mudancas) {
    const saem = new Set(m.from.fieldDefinitionIds.filter((campo) => !m.to.fieldDefinitionIds.includes(campo)));
    if (saem.size === 0) continue;
    for (const f of state.forms) {
      if (f.lifecycle !== "ativo" || f.listId !== m.lista.id) continue;
      const pergunta = f.questions.find((q) => q.target.kind === "field" && saem.has(q.target.definitionId));
      if (!pergunta || pergunta.target.kind !== "field") continue;
      if (containerAdminRefusal(state, actingMemberId, "list", m.lista.id)) {
        anonimo = true;
        continue;
      }
      const campo = state.fieldDefinitions.find((d) => d.id === (pergunta.target as { definitionId: Id }).definitionId);
      return { mensagem: `O Formulário “${f.name}” pergunta por “${campo?.name ?? "um Campo"}”: o envio quebraria no destino. Tire a pergunta antes de mover.` };
    }
  }
  if (anonimo) return { mensagem: "Um Formulário de uma Lista abaixo pergunta por um Campo que deixaria de valer no destino: o envio quebraria. Tire a pergunta antes de mover." };
  return undefined;
}

/**
 * L1 — a fonte única das recusas de mover (menos a falta de mapeamento, que
 * depende do que as Tarefas usam). A tela chama esta mesma função para
 * desligar o destino com a frase da operação; `moveContainer` a chama primeiro.
 * Devolve a frase, ou `undefined` quando o mover é permitido.
 */
export function recusaDeMover(state: DataState, actingMemberId: Id, tipo: "folder" | "list", id: Id, destino: DestinoDeMover): string | undefined {
  return recusarMover(state, actingMemberId, tipo, id, destino)?.mensagem;
}

/**
 * O nome da Atividade do mover (RESEARCH Pattern 3, item 11): a Subpasta que
 * sobe para um Espaço é "promovida a Pasta" e a Pasta de nível 1 que entra
 * numa Pasta é "rebaixada a Subpasta" (RN-PAS-15); o resto é "Lista movida" ou
 * "Pasta movida".
 */
function acaoDeMover(tipo: "folder" | "list", origem: "space" | "folder", destino: "space" | "folder"): string {
  if (tipo === "folder" && origem === "folder" && destino === "space") return "Subpasta promovida a Pasta";
  if (tipo === "folder" && origem === "space" && destino === "folder") return "Pasta rebaixada a Subpasta";
  return `${ROTULO[tipo].nome} movid${ROTULO[tipo].artigo}`;
}

/** A configuração efetiva de uma Lista da subárvore movida, antes (`from`) e depois (`to`). */
interface MudancaDeConfiguracao {
  readonly lista: List;
  readonly from: EffectiveListConfig;
  readonly to: EffectiveListConfig;
}

/**
 * Para cada Lista da subárvore do movido (ele mesmo, se for Lista), a
 * configuração efetiva antes e depois do mover. Não deixa o estado mudado: o
 * pai do movido é trocado só enquanto `to` é lido, e volta (também se a leitura
 * lançar). `null` quando alguma Lista ficaria sem configuração efetiva.
 */
function mudancasDeConfiguracao(state: DataState, tipo: "folder" | "list", movido: Movel, destino: DestinoDeMover): MudancaDeConfiguracao[] | null {
  const listas = tipo === "list" ? [movido as List] : descendantsOf(state, "folder", movido.id).lists;
  const antes = listas.map((l) => effectiveListConfig(state, l.id));
  const depois = comPaiNoDestino(movido, destino, () => listas.map((l) => effectiveListConfig(state, l.id)));
  const mudancas: MudancaDeConfiguracao[] = [];
  for (const [i, lista] of listas.entries()) {
    const from = antes[i];
    const to = depois[i];
    if (!from || !to) return null;
    mudancas.push({ lista, from, to });
  }
  return mudancas;
}

/**
 * L2 / Q4 (`owner-confirmation: pending`) — o que o mover faria com o que já
 * existe, lido SEM mudar nada: o que o diálogo "Mover para…" mostra antes de
 * agir. Calcula sobre as mesmas Listas e Tarefas que `moveContainer` toca
 * (qualquer ciclo de vida, Subtarefas incluídas) e com a mesma leitura de
 * `from`/`to` por Lista, então o que o diálogo mostra é o que a operação faz.
 *
 * - `conjuntoMuda`/`statusEmUso`: algum Conjunto efetivo muda; cada Status em
 *   uso pelas Tarefas dessas Listas, uma vez, na ordem do Conjunto de origem.
 * - `camposQueSaem`/`valoresAfetados`: Campos que a Lista deixa de ter e que
 *   têm Valor `ativo` (o que vai a `arquivado`, B37).
 * - `tiposQueMudam`: Tarefas cujo Tipo sai do destino e cai no primeiro dele.
 * - `linksPublicosRevogados`: Tarefas com link público ativo que o destino não
 *   permite.
 *
 * Não confere permissão nem as recusas: `recusaDeMover` é quem diz se pode.
 */
export interface ConsequenciasDeMover {
  readonly conjuntoMuda: boolean;
  readonly statusEmUso: ReadonlyArray<{ readonly statusId: Id; readonly nome: string; readonly categoria: StatusCategory; readonly tarefas: number }>;
  readonly camposQueSaem: ReadonlyArray<{ readonly id: Id; readonly nome: string }>;
  readonly valoresAfetados: number;
  readonly tiposQueMudam: number;
  readonly linksPublicosRevogados: number;
}

export function consequenciasDeMover(state: DataState, tipo: "folder" | "list", id: Id, destino: DestinoDeMover): ConsequenciasDeMover {
  const vazio: ConsequenciasDeMover = { conjuntoMuda: false, statusEmUso: [], camposQueSaem: [], valoresAfetados: 0, tiposQueMudam: 0, linksPublicosRevogados: 0 };
  const movido = findContainer(state, tipo, id) as Movel | undefined;
  if (!movido) return vazio;
  const mudancas = mudancasDeConfiguracao(state, tipo, movido, destino);
  if (!mudancas) return vazio;

  let conjuntoMuda = false;
  const emUso = new Map<Id, { statusId: Id; nome: string; categoria: StatusCategory; tarefas: number; posicao: number }>();
  const campos = new Map<Id, string>();
  let valoresAfetados = 0;
  let tiposQueMudam = 0;
  let linksPublicosRevogados = 0;

  for (const m of mudancas) {
    const tarefas = state.tasks.filter((t) => t.listId === m.lista.id);
    if (m.from.statusSet.id !== m.to.statusSet.id) {
      conjuntoMuda = true;
      const definicoes = [...m.from.statusSet.definitions].sort((x, y) => x.order - y.order);
      for (const t of tarefas) {
        const posicao = definicoes.findIndex((d) => d.id === t.statusId);
        const definicao = definicoes[posicao];
        if (!definicao) continue;
        const atual = emUso.get(definicao.id);
        if (atual) atual.tarefas += 1;
        else emUso.set(definicao.id, { statusId: definicao.id, nome: definicao.name, categoria: definicao.category, tarefas: 1, posicao });
      }
    }

    const mantidos = new Set(m.to.fieldDefinitionIds);
    const saem = new Set(m.from.fieldDefinitionIds.filter((campo) => !mantidos.has(campo)));
    for (const t of tarefas) {
      for (const v of t.fieldValues) {
        if (v.state !== "ativo" || !saem.has(v.definitionId)) continue;
        valoresAfetados += 1;
        if (!campos.has(v.definitionId)) campos.set(v.definitionId, state.fieldDefinitions.find((d) => d.id === v.definitionId)?.name ?? v.definitionId);
      }
      if (m.to.taskTypeIds.length > 0 && !m.to.taskTypeIds.includes(t.taskTypeId)) tiposQueMudam += 1;
      if (t.publicShare?.active && !m.to.features.compartilhamentoPublico) linksPublicosRevogados += 1;
    }
  }

  return {
    conjuntoMuda,
    statusEmUso: [...emUso.values()].sort((x, y) => x.posicao - y.posicao).map(({ statusId, nome, categoria, tarefas }) => ({ statusId, nome, categoria, tarefas })),
    camposQueSaem: [...campos.entries()].map(([campoId, nome]) => ({ id: campoId, nome })),
    valoresAfetados,
    tiposQueMudam,
    linksPublicosRevogados,
  };
}

/** O que da Tarefa a regra de configuração efetiva pode tocar: se mudou, a Tarefa foi atualizada. */
const assinaturaDaTarefa = (t: Task): string => JSON.stringify([t.statusId, t.taskTypeId, t.publicShare?.active ?? null, t.fieldValues.map((v) => v.state)]);

/**
 * D-11 (2.3.1) — uma Lista ou Pasta muda de lugar. Exige administrar o movido e
 * criar no destino (`mayBuild`); o destino precisa estar efetivamente ativo e
 * não pode ter outro irmão com o mesmo nome. O movido entra no FIM do grupo do
 * destino (`max(order) + 1`) e o grupo de origem é renumerado de 0 a n-1.
 * Nada que o movido contém é apagado ou copiado: a privacidade e a
 * configuração efetiva são derivadas do caminho.
 *
 * As recusas, na ordem (todas em `recusaDeMover`, que a tela lê): permissão no
 * movido e no destino, "já está aqui", "dentro de si", estrutura fixa (Q2),
 * profundidade (RN-SUB-11 e RN-SUB-02), nome repetido, bloqueio do destino
 * (RN-ESP-09; só os aspectos que substituem), colisão de nome de Campo e Tipo
 * (RN-PAS-14) e Formulário que o envio quebraria. A Atividade nasce com o nome
 * do caso: promovida, rebaixada, "Pasta movida" ou "Lista movida".
 *
 * Quando o Conjunto de Status efetivo muda para alguma Lista da subárvore, cada
 * Status em uso nas Tarefas dela (de qualquer ciclo de vida, Subtarefas
 * incluídas) precisa de mapeamento — senão a operação recusa com a frase de
 * `moveTask` e nada muda. O que a Tarefa faz com a nova configuração (Status,
 * Valor de Campo arquivado ou reativado, Tipo, link público) é
 * `aplicarConfiguracaoEfetiva`, a mesma de `moveTask`.
 *
 * Lacuna conhecida (RESEARCH §5(f)): referências a Status por id fora das
 * Tarefas (`RecurrenceRule.triggerStatusId`, filtros de Visualização,
 * condições de Automação) não são remapeadas, como em `moveTask`. Os
 * Responsáveis que perdem `ver` ao entrar num Espaço privado também não são
 * liberados (A8), como em `updateContainer`.
 */
export function moveContainer(
  state: DataState,
  actingMemberId: Id,
  tipo: "folder" | "list",
  id: Id,
  destino: DestinoDeMover,
  mapeamento: readonly StatusMapping[] = [],
): OperationResult<Movel> {
  const recusa = recusarMover(state, actingMemberId, tipo, id, destino);
  if (recusa) return fail(recusa.mensagem, recusa.campo);
  const movido = findContainer(state, tipo, id) as Movel;

  const mudancas = mudancasDeConfiguracao(state, tipo, movido, destino);
  if (!mudancas) return fail("Configuração efetiva indisponível.");
  const tarefasDe = (lista: List): Task[] => state.tasks.filter((t) => t.listId === lista.id);

  // Só as Listas cujo Conjunto muda entram no mapeamento.
  const faltando = new Set<string>();
  for (const m of mudancas) {
    for (const nome of statusSemMapeamento(tarefasDe(m.lista), m.from, m.to, mapeamento)) faltando.add(nome);
  }
  if (faltando.size > 0) return fail(frasePedindoMapeamento([...faltando]), "mapeamento");

  const caminhoAntes = caminhoLegivel(state, tipo, id);
  const origem = { parentType: movido.parentType, parentId: movido.parentId };

  const noDestino = grupoDe(state, tipo, destino.parentType, destino.parentId, id);
  const novaOrdem = proximaOrdem(noDestino);
  const naOrigem = grupoDe(state, tipo, origem.parentType, origem.parentId, id).sort((x, y) => x.order - y.order);
  naOrigem.forEach((c, i) => {
    c.order = i;
  });

  movido.parentType = destino.parentType;
  movido.parentId = destino.parentId;
  movido.order = novaOrdem;

  for (const m of mudancas) {
    const tarefas = tarefasDe(m.lista);
    const antes = new Map(tarefas.map((t) => [t.id, assinaturaDaTarefa(t)]));
    aplicarConfiguracaoEfetiva(state, actingMemberId, tarefas, m.from, m.to, mapeamento);
    for (const t of tarefas) {
      if (antes.get(t.id) !== assinaturaDaTarefa(t)) t.updatedAt = now();
    }
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: acaoDeMover(tipo, origem.parentType, destino.parentType),
    objectType: tipo,
    objectId: movido.id,
    objectName: movido.name,
    before: caminhoAntes,
    after: caminhoLegivel(state, tipo, id),
  });
  return ok(movido);
}

/**
 * L3 — a frase que desliga Subir/Descer e o arrastar entre irmãos. `reorderContainers`
 * a chama primeiro, então a tela e a operação recusam pelo mesmo motivo.
 *
 * "Editar no pai" (2.3.2) é `mayBuild(pai)` (A4): Membro ativo, não Convidado, que
 * alcança o pai — este código não tem conferência `editar` de contêiner. Os
 * Espaços não têm pai: reordená-los pede Papel Administrador ou Proprietário.
 */
export function recusaDeReordenar(state: DataState, actingMemberId: Id, tipo: TipoDeConteiner, pai: PaiDeConteiner): string | undefined {
  if (tipo === "space") {
    if (pai !== null) return "Os Espaços ficam direto no Espaço de Trabalho: não têm pai.";
    const member = state.members.find((m) => m.id === actingMemberId);
    if (!member || member.state !== "ativo") return "Só um Membro ativo reordena os Espaços.";
    const base = state.roles.find((r) => r.id === member.roleId)?.base;
    if (base !== "proprietario" && base !== "administrador") return "Reordenar os Espaços exige Administrador ou Proprietário.";
    return undefined;
  }
  if (pai === null) return "Diga em que Espaço ou Pasta estão os itens a reordenar.";
  const alvo = requireContainer(state, actingMemberId, pai.type, pai.id);
  if (typeof alvo === "string") return alvo;
  if (effectiveLifecycleOfContainer(state, pai.type, pai.id) !== "ativo") {
    const r = ROTULO[pai.type];
    return `${r.artigo === "o" ? "Este" : "Esta"} ${r.nome} não está ativ${r.artigo}.`;
  }
  return mayBuild(state, actingMemberId, pai);
}

/**
 * D-08 / D-09 (2.3.2) — reordena um GRUPO de irmãos: os Espaços, as Pastas de um
 * pai ou as Listas de um pai. Pastas e Listas continuam em dois grupos, cada um
 * com a própria `order`.
 *
 * A3 (DESVIO declarado de "a permutação completa"): o estado de um Membro é um
 * recorte (privados que ele não alcança, arquivados e lixeira saem da árvore) e
 * a operação roda na cópia dele antes de rodar no Espaço inteiro. Por isso
 * recebe os ids que o Membro VÊ, reocupa as vagas deles na sequência recebida e
 * deixa os irmãos não citados onde estavam. O grupo inteiro é regravado de 0 a
 * n-1, o que também conserta dado antigo com `order` repetido.
 *
 * Recusa: sem ids; id repetido; id que não pertence ao grupo (outro pai, outro
 * tipo) ou que o ator não alcança ("não encontrado", sem pista — T-10-11).
 * Registra "Ordem alterada" no pai (nos Espaços, no Espaço de Trabalho) só
 * quando a sequência mudou.
 */
export function reorderContainers(
  state: DataState,
  actingMemberId: Id,
  tipo: TipoDeConteiner,
  pai: PaiDeConteiner,
  ids: readonly Id[],
): OperationResult<readonly Id[]> {
  const recusa = recusaDeReordenar(state, actingMemberId, tipo, pai);
  if (recusa) return fail(recusa);
  if (ids.length === 0) return fail("Nada a reordenar.");
  if (new Set(ids).size !== ids.length) return fail("Um contêiner aparece duas vezes na ordem.");

  const grupo = irmaosOrdenados(state, tipo, pai);
  const noGrupo = new Set(grupo.map((c) => c.id));
  for (const id of ids) {
    const existe = findContainer(state, tipo, id);
    if (!existe || !memberReachesContainer(state, actingMemberId, tipo, id)) {
      return fail(`${ROTULO[tipo].nome} não encontrad${ROTULO[tipo].artigo}.`);
    }
    if (!noGrupo.has(id)) return fail(`${existe.name} não pertence a este grupo.`);
  }

  const citados = new Set(ids);
  const vagas = grupo.flatMap((c, i) => (citados.has(c.id) ? [i] : []));
  const nova: Conteiner[] = [...grupo];
  vagas.forEach((vaga, i) => {
    nova[vaga] = grupo.find((c) => c.id === ids[i]) as Conteiner;
  });

  const mudou = nova.some((c, i) => c.id !== grupo[i]?.id);
  nova.forEach((c, i) => {
    c.order = i;
  });
  const sequencia = nova.map((c) => c.id);
  if (!mudou) return ok(sequencia);

  const rotuloDoGrupo = tipo === "space" ? "Espaços" : tipo === "folder" ? "Pastas" : "Listas";
  const dono =
    pai === null
      ? { objectType: "workspace", objectId: state.workspace.id, objectName: state.workspace.name }
      : { objectType: pai.type, objectId: pai.id, objectName: (findContainer(state, pai.type, pai.id) as Conteiner).name };
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Ordem alterada",
    ...dono,
    detail: rotuloDoGrupo,
  });
  return ok(sequencia);
}

/** `ativo` → `arquivado` no estado próprio. Exige administrar; vale sob ancestral arquivado (RN-ESP-11). */
export function archiveContainer(state: DataState, actingMemberId: Id, type: TipoDeConteiner, id: Id): OperationResult<Conteiner> {
  const found = requireContainer(state, actingMemberId, type, id);
  if (typeof found === "string") return fail(found);
  const container = found;
  const refusal = containerAdminRefusal(state, actingMemberId, type, id);
  if (refusal) return fail(refusal);
  if (container.lifecycle === "naLixeira") return fail(`${ROTULO[type].nome} na lixeira: restaure antes de arquivar.`);
  if (container.lifecycle === "arquivado") return ok(container);

  const at = now();
  container.lifecycle = "arquivado";
  container.archivedAt = at;
  // B36 — o que está abaixo passa a efetivamente arquivado; apontamento aberto fecha.
  for (const task of descendantsOf(state, type, id).tasks) closeRunningTimeEntries(task, at);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: `${ROTULO[type].nome} ${ROTULO[type].arquivado}`,
    objectType: type,
    objectId: container.id,
    objectName: container.name,
    at,
  });
  return ok(container);
}

/** `arquivado` → `ativo` no estado próprio. O efetivo continua derivado: sob ancestral arquivado, segue arquivado até ele voltar. */
export function unarchiveContainer(state: DataState, actingMemberId: Id, type: TipoDeConteiner, id: Id): OperationResult<Conteiner> {
  const found = requireContainer(state, actingMemberId, type, id);
  if (typeof found === "string") return fail(found);
  const container = found;
  const refusal = containerAdminRefusal(state, actingMemberId, type, id);
  if (refusal) return fail(refusal);
  if (container.lifecycle === "naLixeira") return fail(`${ROTULO[type].nome} na lixeira: restaure em vez de desarquivar.`);
  if (container.lifecycle === "ativo") return ok(container);

  container.lifecycle = "ativo";
  delete container.archivedAt;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: `${ROTULO[type].nome} desarquivad${ROTULO[type].artigo}`,
    objectType: type,
    objectId: container.id,
    objectName: container.name,
  });
  return ok(container);
}

/**
 * B43 — o contêiner e tudo abaixo dele vão à lixeira num só ato, com o MESMO
 * `trashedAt`: é o que permite à restauração devolver só o que foi junto. Um
 * descendente que já estava na lixeira não é tocado — ele tem o próprio
 * `trashedAt`, e continua lá quando o contêiner voltar.
 */
export function trashContainer(state: DataState, actingMemberId: Id, type: TipoDeConteiner, id: Id): OperationResult<Conteiner> {
  const found = requireContainer(state, actingMemberId, type, id);
  if (typeof found === "string") return fail(found);
  const container = found;
  const refusal = containerTrashRefusal(state, actingMemberId, type, id);
  if (refusal) return fail(refusal);
  if (container.lifecycle === "naLixeira") return ok(container);

  const at = now();
  const trash = (record: { lifecycle: Lifecycle; lifecycleBeforeTrash?: "ativo" | "arquivado"; trashedAt?: string }): boolean => {
    if (record.lifecycle === "naLixeira") return false;
    record.lifecycleBeforeTrash = record.lifecycle === "arquivado" ? "arquivado" : "ativo";
    record.lifecycle = "naLixeira";
    record.trashedAt = at;
    return true;
  };
  const abaixo = descendantsOf(state, type, id);
  let pastas = 0;
  let listas = 0;
  let tarefas = 0;
  for (const f of abaixo.folders) if (trash(f)) pastas += 1;
  for (const l of abaixo.lists) if (trash(l)) listas += 1;
  for (const t of abaixo.tasks) {
    if (trash(t)) {
      tarefas += 1;
      closeRunningTimeEntries(t, at);
    }
  }
  trash(container);

  const partes = [
    pastas > 0 ? `${pastas} Pasta(s)` : "",
    listas > 0 ? `${listas} Lista(s)` : "",
    tarefas > 0 ? `${tarefas} Tarefa(s)` : "",
  ].filter(Boolean);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: `${ROTULO[type].nome} enviad${ROTULO[type].artigo} à lixeira`,
    objectType: type,
    objectId: container.id,
    objectName: container.name,
    at,
    ...(partes.length > 0 ? { detail: `${partes.join(", ")} foram junto.` } : {}),
  });
  return ok(container);
}

/**
 * B43 — restaurar devolve o estado próprio anterior (nunca força `ativo`) e
 * traz de volta só o que foi à lixeira COM o contêiner. Exige que o pai
 * imediato não esteja na lixeira por estado próprio — pai arquivado é aceito,
 * e o contêiner fica efetivamente arquivado até ele voltar (RN-ESP-11).
 * Colisão de nome com um irmão vivo é recusada (RN-ESP-23).
 */
export function restoreContainer(state: DataState, actingMemberId: Id, type: TipoDeConteiner, id: Id): OperationResult<Conteiner> {
  const found = requireContainer(state, actingMemberId, type, id);
  if (typeof found === "string") return fail(found);
  const container = found;
  const refusal = containerTrashRefusal(state, actingMemberId, type, id);
  if (refusal) return fail(refusal);
  if (container.lifecycle !== "naLixeira") return ok(container);

  const pai = parentOf(state, type, container);
  if (pai) {
    if (!pai.container) return fail("O contêiner que o continha já não existe.");
    if (pai.container.lifecycle === "naLixeira") return fail(`${pai.container.name} está na lixeira. Restaure o contêiner antes.`);
  }
  if (nameTaken(siblingsOf(state, type, container), container.name)) {
    return fail(`Já existe ${ROTULO[type].artigo === "o" ? "um" : "uma"} ${ROTULO[type].nome} chamad${ROTULO[type].artigo} “${container.name}” aqui. Renomeie-${ROTULO[type].artigo} antes de restaurar.`, "nome");
  }

  const marca = container.trashedAt;
  const restore = (record: { lifecycle: Lifecycle; lifecycleBeforeTrash?: "ativo" | "arquivado"; trashedAt?: string }): boolean => {
    if (record.lifecycle !== "naLixeira" || marca === undefined || record.trashedAt !== marca) return false;
    record.lifecycle = record.lifecycleBeforeTrash ?? "ativo";
    delete record.lifecycleBeforeTrash;
    delete record.trashedAt;
    return true;
  };
  const abaixo = descendantsOf(state, type, id);
  let pastas = 0;
  let listas = 0;
  let tarefas = 0;
  for (const f of abaixo.folders) if (restore(f)) pastas += 1;
  for (const l of abaixo.lists) if (restore(l)) listas += 1;
  for (const t of abaixo.tasks) if (restore(t)) tarefas += 1;

  container.lifecycle = container.lifecycleBeforeTrash ?? "ativo";
  delete container.lifecycleBeforeTrash;
  delete container.trashedAt;

  const partes = [
    pastas > 0 ? `${pastas} Pasta(s)` : "",
    listas > 0 ? `${listas} Lista(s)` : "",
    tarefas > 0 ? `${tarefas} Tarefa(s)` : "",
  ].filter(Boolean);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: `${ROTULO[type].nome} ${ROTULO[type].restaurado}`,
    objectType: type,
    objectId: container.id,
    objectName: container.name,
    after: container.lifecycle,
    ...(partes.length > 0 ? { detail: `${partes.join(", ")} voltaram junto.` } : {}),
  });
  return ok(container, container.id);
}
