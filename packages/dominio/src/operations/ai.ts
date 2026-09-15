/**
 * AI operations: approvals and automation publishing.
 * Ontology: documentos 17 and 19, B22, B77, B80, B88, B94, RN-AGE-*, RN-AUT-*.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type {
  Agent,
  ApprovalRequest,
  Automation,
  AutomationVersion,
  ChatAnchor,
  ChatMessage,
  ChatSession,
  Id,
} from "../types";
import { contactDisplayName } from "../derive";
import { memberActor, nextId, recordActivity, systemActor } from "./activity";

const now = (): string => new Date().toISOString();

/**
 * B80 / RN-AGE-17 — approving is approving EXACTLY the fixed object, and it
 * NEVER grants permission: the two checks of DO-HAB-14 are redone at the moment
 * of the approval. In the `permissao` reason, only whoever holds the required
 * permission may approve, and becomes the delegate of that step (DO-AGE-11).
 */
export function decideApproval(
  state: DataState,
  actingMemberId: Id,
  approvalId: Id,
  decision: "aprovada" | "rejeitada",
  reason?: string,
): OperationResult<ApprovalRequest> {
  const approval = state.approvals.find((a) => a.id === approvalId);
  if (!approval) return fail("Solicitação de Aprovação não encontrada.");
  if (approval.decision) {
    return fail(`Esta Solicitação já foi ${approval.decision}.`);
  }
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") {
    return fail("Só um Membro ativo decide uma Solicitação de Aprovação.");
  }

  const execution = state.agentExecutions.find((e) => e.id === approval.executionId);
  const agent = execution ? state.agents.find((a) => a.id === execution.agentId) : undefined;

  const role = state.roles.find((r) => r.id === member.roleId);
  const mayDecide =
    approval.approverMemberId === actingMemberId ||
    agent?.ownerMemberId === actingMemberId ||
    role?.base === "administrador" ||
    role?.base === "proprietario";
  if (!mayDecide) {
    return fail("Você não é o aprovador designado desta Solicitação.");
  }

  /**
   * The expiry is settled only AFTER authorization: it cancels the Execution,
   * and an actor with no right to decide must not be able to produce that
   * effect by asking. The expiry is an act of the System, and it carries its
   * own Registro de Atividade because it produces an effect (B80).
   */
  if (Date.parse(approval.deadline) < Date.now()) {
    approval.decision = "expirada";
    approval.decidedAt = now();
    if (execution) {
      execution.state = "cancelada";
      execution.terminationReason = "Tempo limite de aprovação vencido";
      execution.endedAt = now();
    }
    recordActivity(state, {
      actor: systemActor,
      action: "Solicitação de Aprovação expirada",
      objectType: "approvalRequest",
      objectId: approval.id,
      objectName: approval.object.toolId,
      before: "pendente",
      after: "expirada",
      detail: "Execução cancelada por tempo limite de aprovação",
    });
    return fail("O prazo desta Solicitação venceu e a Execução foi cancelada.");
  }

  approval.decision = decision;
  approval.decidedByMemberId = actingMemberId;
  approval.decidedAt = now();

  if (execution) {
    if (decision === "aprovada") {
      execution.state = "concluida";
      execution.endedAt = now();
      execution.steps.push({
        index: execution.steps.length,
        kind: "ferramenta",
        toolId: approval.object.toolId,
        input: approval.object.input,
        toolAllowed: true,
        resourcePermitted: true,
        effectClass: approval.object.effectClass,
        result: "concluido",
        approvalRequestId: approval.id,
        at: now(),
      });
    } else {
      execution.state = "falhou";
      execution.terminationReason = reason ?? "Solicitação recusada";
      execution.endedAt = now();
    }
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: decision === "aprovada" ? "Solicitação de Aprovação aprovada" : "Solicitação de Aprovação recusada",
    objectType: "approvalRequest",
    objectId: approval.id,
    objectName: approval.object.toolId,
    after: decision,
    ...(reason ? { detail: reason } : {}),
  });
  return ok(approval);
}

/**
 * RN-AUT-07 — publishing validates, WITHOUT effect on failure: trigger
 * compatible with the scope, at least one action, existing tools, `ativo`
 * agents the automation may execute, skills granted to the agent, and the
 * permission ceiling of the owner (RN-AUT-04). DO-AUT-19 — publishing makes the
 * previous version `obsoleta` in the same act.
 */
export function publishAutomation(
  state: DataState,
  actingMemberId: Id,
  automationId: Id,
): OperationResult<AutomationVersion> {
  const automation = state.automations.find((a) => a.id === automationId);
  if (!automation) return fail("Automação não encontrada.");

  /**
   * Publicar exige `administrar` sobre a Automação (documento 12, 12.2 e a
   * tabela de 17.1): o Proprietário do Espaço de Trabalho e os Administradores
   * por Papel, o Proprietário e o Criador da Automação por `próprios`. Um
   * Convidado não tem nada sobre Automação por Papel.
   *
   * A verificação vem antes de qualquer validação do rascunho para que quem não
   * pode publicar não descubra, pela mensagem de erro, o que falta nele.
   */
  const acting = state.members.find((m) => m.id === actingMemberId);
  if (!acting || acting.state !== "ativo") {
    return fail("Só um Membro ativo publica uma Versão de Automação.");
  }
  const actingBase = state.roles.find((r) => r.id === acting.roleId)?.base;
  const mayPublish =
    actingBase === "proprietario" ||
    actingBase === "administrador" ||
    (actingBase !== "convidado" &&
      (automation.ownerMemberId === actingMemberId ||
        (automation.createdBy.kind === "member" && automation.createdBy.id === actingMemberId)));
  if (!mayPublish) {
    return fail("Publicar uma Versão exige administrar esta Automação.");
  }

  const draft = automation.versions.find((v) => v.state === "rascunho");
  if (!draft) return fail("Não há rascunho para publicar.");

  if (!draft.trigger) {
    return fail("Escolha um Gatilho para publicar.", "gatilho");
  }
  if (draft.actions.length === 0) {
    return fail("Adicione ao menos uma Ação.", "acoes");
  }

  // RN-AUT-07 — the trigger must be compatible with the scope.
  const scopeFamily = automationScopeFamily(automation);
  const triggerFamily = triggerObjectFamily(draft.trigger.eventType);
  if (draft.trigger.kind === "evento" && triggerFamily && !scopeFamily.includes(triggerFamily)) {
    return fail(
      `O Evento “${draft.trigger.eventType}” não ocorre no escopo desta Automação.`,
      "gatilho",
    );
  }

  for (const action of draft.actions) {
    if (action.kind === "escrita") {
      if (!action.toolId || !state.tools.some((t) => t.id === action.toolId)) {
        return fail(`A Ferramenta “${action.toolId ?? "—"}” não existe no Catálogo.`, "acoes");
      }
    }
    if (action.controlKind === "invocarAgente") {
      const agent = state.agents.find((a) => a.id === action.agentId);
      if (!agent) return fail("O Agente indicado na Ação não existe.", "acoes");
      if (agent.lifecycle !== "ativo") {
        return fail(`O Agente “${agent.name}” não está ativo.`, "acoes");
      }
      if (action.skillId) {
        const granted = state.skillGrants.some(
          (g) => g.agentId === agent.id && g.skillId === action.skillId,
        );
        if (!granted) {
          const skill = state.skills.find((s) => s.id === action.skillId);
          return fail(
            `A Habilidade “${skill?.name ?? action.skillId}” não está concedida ao Agente “${agent.name}”.`,
            "acoes",
          );
        }
      }
    }
  }

  // RN-AUT-04 — the effective permission is own ∩ owner; publishing is rejected
  // when the automation's own grants exceed the owner's.
  const owner = state.members.find((m) => m.id === automation.ownerMemberId);
  if (!owner || (owner.state !== "ativo" && owner.state !== "suspenso")) {
    return fail("A Automação precisa de um Proprietário ativo.");
  }
  const ownerRole = state.roles.find((r) => r.id === owner.roleId);
  const automationRole = automation.roleId
    ? state.roles.find((r) => r.id === automation.roleId)
    : undefined;
  if (automationRole && ownerRole && exceeds(automationRole.base, ownerRole.base)) {
    return fail(
      "A Automação não pode ter mais permissões que o seu Proprietário. Revise as concessões ou transfira a propriedade.",
    );
  }

  for (const version of automation.versions) {
    if (version.state === "publicada") version.state = "obsoleta";
  }
  draft.state = "publicada";
  draft.publishedBy = actingMemberId;
  draft.publishedAt = now();
  if (automation.lifecycle === "rascunho") automation.lifecycle = "ativo";

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Versão de Automação publicada",
    objectType: "automation",
    objectId: automation.id,
    objectName: automation.name,
    after: `versão ${draft.number}`,
  });
  return ok(draft);
}

const BASE_RANK: Record<string, number> = { convidado: 0, membro: 1, administrador: 2, proprietario: 3 };

const exceeds = (a: string, b: string): boolean => (BASE_RANK[a] ?? 0) > (BASE_RANK[b] ?? 0);

function automationScopeFamily(automation: Automation): string[] {
  switch (automation.scopeType) {
    case "workspace":
      return ["task", "deal", "contact", "company", "conversation", "message", "execution", "document"];
    case "space":
    case "folder":
    case "list":
      return ["task"];
    case "funnel":
      return ["deal"];
    case "inbox":
    case "queue":
      return ["conversation", "message"];
    default:
      return [];
  }
}

function triggerObjectFamily(eventType: string | undefined): string | null {
  if (!eventType) return null;
  if (eventType.startsWith("tarefa")) return "task";
  if (eventType.startsWith("negocio")) return "deal";
  if (eventType.startsWith("contato")) return "contact";
  if (eventType.startsWith("empresa")) return "company";
  if (eventType.startsWith("conversa")) return "conversation";
  if (eventType.startsWith("mensagem")) return "message";
  if (eventType.startsWith("execucao")) return "execution";
  if (eventType.startsWith("documento")) return "document";
  return null;
}

/**
 * B94 — restoring or unarchiving an Agent or an Automation NEVER returns it
 * directly to `ativo`: it returns to `pausado` when the previous state was
 * `ativo` or `pausado`; `rascunho` and `arquivado` come back as they were.
 */
export function restoreAgent(state: DataState, actingMemberId: Id, agentId: Id): OperationResult<Agent> {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent) return fail("Agente não encontrado.");
  if (agent.lifecycle !== "naLixeira" && agent.lifecycle !== "arquivado") return ok(agent);
  const previous = agent.lifecycleBeforeTrashAi ?? "ativo";
  agent.lifecycle = previous === "ativo" || previous === "pausado" ? "pausado" : previous;
  delete agent.lifecycleBeforeTrashAi;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Agente restaurado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    after: agent.lifecycle,
    detail: "A reativação é ato explícito após revisão de referências.",
  });
  return ok(agent);
}

export function restoreAutomation(
  state: DataState,
  actingMemberId: Id,
  automationId: Id,
): OperationResult<Automation> {
  const automation = state.automations.find((a) => a.id === automationId);
  if (!automation) return fail("Automação não encontrada.");
  if (automation.lifecycle !== "naLixeira" && automation.lifecycle !== "arquivado") return ok(automation);
  const previous = automation.lifecycleBeforeTrashAi ?? "ativo";
  automation.lifecycle = previous === "ativo" || previous === "pausado" ? "pausado" : previous;
  delete automation.lifecycleBeforeTrashAi;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Automação restaurada",
    objectType: "automation",
    objectId: automation.id,
    objectName: automation.name,
    after: automation.lifecycle,
  });
  return ok(automation);
}

/**
 * B83 — a Âncora é fixada na criação e é imutável como VALOR: ela guarda o nome
 * que o registro tinha no momento, para a Sessão continuar legível mesmo depois
 * de o registro ser renomeado ou mesclado.
 */
export function createChatSession(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly title: string;
    readonly mainAgentId?: Id;
    readonly anchor?: { readonly type: ChatAnchor["type"]; readonly id: Id };
    /** O Modelo desta Sessão; sem escolha, vale o do Agente. */
    readonly chosenModelId?: Id;
    /** A pasta em que a Sessão já nasce guardada. */
    readonly folderId?: Id;
    /** A Habilidade escolhida para a Sessão. */
    readonly skillId?: Id;
  },
): OperationResult<ChatSession> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") {
    return fail("Só um Membro ativo abre uma Sessão de Chat.");
  }
  if (!input.title.trim()) return fail("Dê um título à Sessão.", "titulo");

  if (input.chosenModelId) {
    const model = state.models.find((m) => m.id === input.chosenModelId);
    if (!model) return fail("Modelo não encontrado.", "modelo");
    if (model.discontinued) return fail(`O Modelo “${model.name}” foi descontinuado.`, "modelo");
  }
  if (input.skillId) {
    const skill = state.skills.find((k) => k.id === input.skillId);
    if (!skill) return fail("Habilidade não encontrada.", "habilidade");
    if (skill.lifecycle !== "ativo") return fail(`A Habilidade “${skill.name}” não está ativa.`, "habilidade");
  }
  if (input.folderId) {
    const folder = state.chatFolders.find((f) => f.id === input.folderId);
    if (!folder) return fail("Pasta não encontrada.", "pasta");
    if (folder.ownerMemberId !== actingMemberId) return fail("Esta pasta é de outro Membro.", "pasta");
  }

  if (input.mainAgentId) {
    const agent = state.agents.find((a) => a.id === input.mainAgentId);
    if (!agent) return fail("Agente não encontrado.", "agente");
    if (agent.lifecycle !== "ativo") return fail(`O Agente “${agent.name}” não está ativo.`, "agente");
  }

  let anchor: ChatAnchor | undefined;
  if (input.anchor) {
    const name = anchorName(state, input.anchor.type, input.anchor.id);
    if (name === undefined) return fail("O registro da Âncora não foi encontrado.", "ancora");
    anchor = { type: input.anchor.type, id: input.anchor.id, nameAtTheTime: name };
  }

  const session: ChatSession = {
    id: nextId("cht"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    ownerMemberId: actingMemberId,
    title: input.title.trim(),
    titleEdited: true,
    ...(anchor ? { anchor } : {}),
    ...(input.mainAgentId ? { mainAgentId: input.mainAgentId } : {}),
    ...(input.chosenModelId ? { chosenModelId: input.chosenModelId } : {}),
    ...(input.folderId ? { folderId: input.folderId } : {}),
    ...(input.skillId ? { skillId: input.skillId } : {}),
    toolRestriction: { toolIds: [], effectClasses: [] },
    messages: [],
    sharedWithMemberIds: [],
    sharedWithTeamIds: [],
  };
  state.chatSessions.push(session);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Sessão de Chat aberta",
    objectType: "chatSession",
    objectId: session.id,
    objectName: session.title,
    ...(anchor ? { detail: `Ancorada em ${anchor.nameAtTheTime}` } : {}),
  });
  return ok(session);
}

/**
 * Os ajustes da Sessão que a home oferece antes da primeira mensagem — pasta,
 * Habilidade, Modelo e Âncora — também para uma Sessão que já existe.
 *
 * B83 — a Âncora é fixada na criação. Uma Sessão sem Mensagem ainda não
 * começou: trocar a Âncora aí é parte de criar, não de reescrever. Com
 * Mensagem, a Âncora fecha.
 */
export function configureChatSession(
  state: DataState,
  actingMemberId: Id,
  sessionId: Id,
  input: {
    readonly folderId?: Id | null;
    readonly skillId?: Id | null;
    readonly chosenModelId?: Id | null;
    readonly mainAgentId?: Id | null;
    readonly anchor?: { readonly type: ChatAnchor["type"]; readonly id: Id } | null;
  },
): OperationResult<ChatSession> {
  const session = state.chatSessions.find((s) => s.id === sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.lifecycle !== "ativo") return fail("Esta Sessão não está ativa.");
  if (session.ownerMemberId !== actingMemberId) return fail("Só o dono ajusta a própria Sessão.");

  const mudancas: string[] = [];

  if (input.mainAgentId !== undefined) {
    if (input.mainAgentId) {
      const agent = state.agents.find((a) => a.id === input.mainAgentId);
      if (!agent) return fail("Agente não encontrado.", "agente");
      if (agent.lifecycle !== "ativo") return fail(`O Agente “${agent.name}” não está ativo.`, "agente");
      session.mainAgentId = agent.id;
      mudancas.push(`Agente ${agent.name}`);
    } else {
      delete session.mainAgentId;
      mudancas.push("Assistente padrão");
    }
  }

  if (input.folderId !== undefined) {
    if (input.folderId) {
      const folder = state.chatFolders.find((f) => f.id === input.folderId);
      if (!folder) return fail("Pasta não encontrada.", "pasta");
      if (folder.ownerMemberId !== actingMemberId) return fail("Esta pasta é de outro Membro.", "pasta");
      session.folderId = folder.id;
      mudancas.push(`pasta ${folder.name}`);
    } else {
      delete session.folderId;
      mudancas.push("sem pasta");
    }
  }
  if (input.skillId !== undefined) {
    if (input.skillId) {
      const skill = state.skills.find((k) => k.id === input.skillId);
      if (!skill) return fail("Habilidade não encontrada.", "habilidade");
      if (skill.lifecycle !== "ativo") return fail(`A Habilidade “${skill.name}” não está ativa.`, "habilidade");
      session.skillId = skill.id;
      mudancas.push(`plugin ${skill.name}`);
    } else {
      delete session.skillId;
      mudancas.push("sem plugin");
    }
  }
  if (input.chosenModelId !== undefined) {
    if (input.chosenModelId) {
      const model = state.models.find((m) => m.id === input.chosenModelId);
      if (!model) return fail("Modelo não encontrado.", "modelo");
      if (model.discontinued) return fail(`O Modelo “${model.name}” foi descontinuado.`, "modelo");
      session.chosenModelId = model.id;
      mudancas.push(`Modelo ${model.name}`);
    } else {
      delete session.chosenModelId;
      mudancas.push("Modelo do Agente");
    }
  }
  if (input.anchor !== undefined) {
    if (session.messages.length > 0) {
      return fail("A Âncora é fixada na criação: com Mensagens, ela não muda.", "ancora");
    }
    if (input.anchor) {
      const name = anchorName(state, input.anchor.type, input.anchor.id);
      if (name === undefined) return fail("O registro da Âncora não foi encontrado.", "ancora");
      session.anchor = { type: input.anchor.type, id: input.anchor.id, nameAtTheTime: name };
      mudancas.push(`ancorada em ${name}`);
    } else {
      delete session.anchor;
      mudancas.push("sem Âncora");
    }
  }
  if (mudancas.length === 0) return ok(session);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Sessão de Chat ajustada",
    objectType: "chatSession",
    objectId: session.id,
    objectName: session.title,
    detail: mudancas.join(" · "),
  });
  return ok(session);
}

/**
 * B84 — a Mensagem de Chat é imutável: corrigir cria uma nova, nunca edita a
 * anterior. Por isso enviar só acrescenta.
 *
 * DO-CHT-09 — uma Sessão de terceiro não é acessível a ninguém, nem ao
 * Proprietário do Espaço de Trabalho; o compartilhamento explícito é a única
 * via, e ele dá leitura, não voz.
 */
export function sendChatMessage(
  state: DataState,
  actingMemberId: Id,
  sessionId: Id,
  content: string,
): OperationResult<ChatMessage> {
  const session = state.chatSessions.find((s) => s.id === sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.lifecycle !== "ativo") return fail("Esta Sessão não está ativa.");
  if (session.ownerMemberId !== actingMemberId) {
    return fail("Só o Proprietário da Sessão escreve nela; o compartilhamento dá leitura.");
  }
  if (!content.trim()) return fail("Escreva a mensagem antes de enviar.", "conteudo");

  const message: ChatMessage = {
    id: nextId("cmg"),
    order: session.messages.length,
    role: "usuario",
    author: memberActor(actingMemberId),
    content: content.trim(),
    fileIds: [],
    knowledgeReferences: [],
    complete: true,
    at: now(),
  };
  session.messages.push(message);
  return ok(message);
}

function anchorName(state: DataState, type: ChatAnchor["type"], id: Id): string | undefined {
  switch (type) {
    case "task":
      return state.tasks.find((t) => t.id === id)?.title;
    case "deal":
      return state.deals.find((d) => d.id === id)?.title;
    case "contact": {
      const contact = state.contacts.find((c) => c.id === id);
      return contact ? contactDisplayName(contact) : undefined;
    }
    case "company":
      return state.companies.find((c) => c.id === id)?.legalName;
    case "conversation":
      return state.conversations.find((c) => c.id === id)?.title;
    case "knowledgeDocument":
      return state.documents.find((d) => d.id === id)?.title;
    case "space":
      return state.spaces.find((s) => s.id === id)?.name;
    case "folder":
      return state.folders.find((f) => f.id === id)?.name;
    case "list":
      return state.lists.find((l) => l.id === id)?.name;
  }
}
