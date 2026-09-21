/**
 * AI operations: approvals and automation publishing.
 * Ontology: documentos 17 and 19, B22, B77, B80, B88, B94, RN-AGE-*, RN-AUT-*.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type {
  Agent,
  ApprovalOrigin,
  ApprovalRequest,
  Automation,
  AutomationVersion,
  ChatAnchor,
  ChatMessage,
  ChatSession,
  Id,
} from "../types";
import { contactDisplayName, effectiveListConfig } from "../derive";
import { memberActor, nextId, recordActivity, systemActor } from "./activity";
import { addTaskComment, changeTaskStatus } from "./tasks";

const now = (): string => new Date().toISOString();

/**
 * D-06 — normaliza a ORIGEM de um registro de `ApprovalRequest`, hidratado ou
 * não. `apps/api/src/persistencia/repositorio.ts::hidratar` é um `JSON.parse`
 * genérico por coleção — sem conhecimento do domínio, ele não pode fazer esta
 * tradução. Por isso a normalização mora aqui, e é aplicada pelas operações
 * que leem `state.approvals` (`ensureApprovalsNormalized`, abaixo), na
 * primeira leitura de cada registro: uma `ApprovalRequest` gravada antes desta
 * fase chega da hidratação com `executionId`/`stepIndex`/`deadline` soltos,
 * sem `origin` — perder isso silenciosamente corromperia o histórico de
 * Aprovações de Agente (V02-03A).
 */
export function normalizeApprovalOrigin(bruto: unknown): ApprovalOrigin {
  const registro = (bruto ?? {}) as Record<string, unknown>;
  const origin = registro.origin as Record<string, unknown> | undefined;
  if (origin && typeof origin === "object" && typeof origin.kind === "string") {
    return origin as unknown as ApprovalOrigin;
  }
  return {
    kind: "agentExecution",
    executionId: registro.executionId as Id,
    stepIndex: registro.stepIndex as number,
    deadline: registro.deadline as string,
  };
}

/** Garante `origin` em todo registro de `state.approvals` antes de qualquer leitura. */
function ensureApprovalsNormalized(state: DataState): void {
  for (const approval of state.approvals) {
    if (!approval.origin) approval.origin = normalizeApprovalOrigin(approval);
  }
}

/**
 * D-09 — a mesma resolução de autorização que `decideApproval` e
 * `decideProcessApproval` compartilham: o aprovador designado, ou um Membro
 * com papel base administrador/proprietário. `extraOwnerId` é o dono do
 * Agente — só existe no ramo `agentExecution` (RN-SP-05 não tem esse dono).
 */
function mayDecideApproval(state: DataState, actingMemberId: Id, approverMemberId: Id, extraOwnerId?: Id): boolean {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return false;
  const role = state.roles.find((r) => r.id === member.roleId);
  return (
    approverMemberId === actingMemberId ||
    (extraOwnerId !== undefined && extraOwnerId === actingMemberId) ||
    role?.base === "administrador" ||
    role?.base === "proprietario"
  );
}

/** O status do Conjunto de Status efetivo da Lista cujo nome bate exatamente. */
function resolveProcessStatusId(state: DataState, listId: Id, name: string): Id | undefined {
  return effectiveListConfig(state, listId)?.statusSet.definitions.find((d) => d.name === name)?.id;
}

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
  ensureApprovalsNormalized(state);
  const approval = state.approvals.find((a) => a.id === approvalId);
  if (!approval) return fail("Solicitação de Aprovação não encontrada.");
  if (approval.origin.kind !== "agentExecution") {
    return fail("Esta Solicitação de Aprovação pertence a um processo; use a decisão de processo.");
  }
  const origin = approval.origin;
  if (approval.decision) {
    return fail(`Esta Solicitação já foi ${approval.decision}.`);
  }
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") {
    return fail("Só um Membro ativo decide uma Solicitação de Aprovação.");
  }

  const execution = state.agentExecutions.find((e) => e.id === origin.executionId);
  const agent = execution ? state.agents.find((a) => a.id === execution.agentId) : undefined;

  if (!mayDecideApproval(state, actingMemberId, approval.approverMemberId, agent?.ownerMemberId)) {
    return fail("Você não é o aprovador designado desta Solicitação.");
  }

  /**
   * The expiry is settled only AFTER authorization: it cancels the Execution,
   * and an actor with no right to decide must not be able to produce that
   * effect by asking. The expiry is an act of the System, and it carries its
   * own Registro de Atividade because it produces an effect (B80).
   */
  if (Date.parse(origin.deadline) < Date.now()) {
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

export interface SolicitarAprovacaoInput {
  readonly taskId: Id;
  readonly approverMemberId: Id;
  readonly threadCommentId: Id;
  readonly reason?: string;
}

/**
 * D-06/D-07 — a aprovação de processo nasce ligada diretamente à Tarefa e ao
 * passo `pagamento`, sem `AgentExecution`. Quem é o Aprovador certo (Centro de
 * Custo e Valor, RN-SP-03) é resolvido ANTES de chamar esta operação — ela
 * recebe o aprovador já decidido (o catálogo da Lista é o Plan 02-06).
 */
export function solicitarAprovacao(
  state: DataState,
  actingMemberId: Id,
  input: SolicitarAprovacaoInput,
): OperationResult<ApprovalRequest> {
  ensureApprovalsNormalized(state);
  const task = state.tasks.find((t) => t.id === input.taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const approver = state.members.find((m) => m.id === input.approverMemberId);
  if (!approver || approver.state !== "ativo") {
    return fail("O Aprovador precisa ser um Membro ativo.");
  }
  const threadComment = task.comments.find((c) => c.id === input.threadCommentId && !c.deletedAt);
  if (!threadComment) {
    return fail("O Comentário de roteamento não existe nesta Tarefa.");
  }

  // Idempotência do roteamento — repetir para a mesma Tarefa não cria uma segunda pendência.
  const existing = state.approvals.find(
    (a) => a.origin.kind === "processTask" && a.origin.taskId === input.taskId && a.decision === undefined,
  );
  if (existing) return ok(existing);

  const statusId = resolveProcessStatusId(state, task.listId, "em aprovação");
  if (!statusId) {
    return fail("Esta Lista não tem o status “em aprovação” configurado.");
  }
  const moved = changeTaskStatus(state, actingMemberId, task.id, statusId);
  if (!moved.ok) return fail(moved.error, moved.field);

  const approval: ApprovalRequest = {
    id: nextId("apr"),
    origin: { kind: "processTask", taskId: task.id, processStep: "pagamento", threadCommentId: threadComment.id },
    requestedBy: memberActor(actingMemberId),
    reason: "processo",
    object: {
      // D-06 — uma aprovação de processo não é uma Ferramenta.
      toolId: "",
      input: "",
      targetResourceType: "task",
      targetResourceId: task.id,
      effectClass: "escritaIrreversivel",
    },
    approverMemberId: input.approverMemberId,
    createdAt: now(),
  };
  state.approvals.push(approval);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Aprovação solicitada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    ...(input.reason ? { detail: input.reason } : {}),
  });
  return ok(approval);
}

export interface DecideProcessApprovalOptions {
  readonly source: "click" | "comment";
  readonly reason?: string;
}

/**
 * D-09 — a decisão canônica que clique e comentário compartilham: publica a
 * resposta no tópico, grava a decisão, registra a Atividade com a fonte e só
 * então muda o Status. Repetir a MESMA decisão é sucesso idempotente; a
 * decisão oposta é conflito e nunca sobrescreve. D-11 — sem prazo: o ramo
 * `processTask` de `ApprovalOrigin` não tem `deadline`, então não há o que
 * expirar aqui — o timeout de Execução de Agente nunca alcança esta operação.
 */
export function decideProcessApproval(
  state: DataState,
  actingMemberId: Id,
  approvalId: Id,
  decision: "aprovada" | "rejeitada",
  options: DecideProcessApprovalOptions,
): OperationResult<ApprovalRequest> {
  ensureApprovalsNormalized(state);
  const approval = state.approvals.find((a) => a.id === approvalId);
  if (!approval) return fail("Solicitação de Aprovação não encontrada.");
  if (approval.origin.kind !== "processTask") {
    return fail("Esta Solicitação de Aprovação pertence a uma Execução de Agente; use a decisão de Agente.");
  }
  const origin = approval.origin;

  // Replay da MESMA decisão é sucesso idempotente, sem efeito nenhum (D-09).
  if (approval.decision === decision) return ok(approval);
  if (approval.decision) {
    const decisor = state.members.find((m) => m.id === approval.decidedByMemberId)?.displayName ?? "outro Membro";
    return fail(`Esta Solicitação já foi ${approval.decision} por ${decisor}.`);
  }

  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") {
    return fail("Só um Membro ativo decide uma Solicitação de Aprovação.");
  }
  if (!mayDecideApproval(state, actingMemberId, approval.approverMemberId)) {
    return fail("Você não é o aprovador designado desta Solicitação.");
  }

  if (decision === "rejeitada" && !options.reason?.trim()) {
    return fail("Rejeitar exige um motivo.", "reason");
  }

  const task = state.tasks.find((t) => t.id === origin.taskId);
  if (!task) return fail("A Tarefa desta Solicitação não existe mais.");

  // D-09 — a resposta canônica é publicada como resposta ao tópico de roteamento, texto fixo.
  const texto = decision === "aprovada" ? `✅ Aprovado por ${member.displayName}` : `❌ Reprovado por ${member.displayName}`;
  const comentario = addTaskComment(state, actingMemberId, task.id, {
    content: texto,
    parentCommentId: origin.threadCommentId,
  });
  if (!comentario.ok) return fail(comentario.error, comentario.field);

  approval.decision = decision;
  approval.decidedByMemberId = actingMemberId;
  approval.decidedAt = now();
  approval.decisionSource = options.source;
  if (options.reason) approval.decisionReason = options.reason;

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Aprovação decidida",
    objectType: "approvalRequest",
    objectId: approval.id,
    objectName: task.title,
    after: decision,
    detail: `${options.source === "click" ? "por clique" : "por comentário"}${options.reason ? ` — ${options.reason}` : ""}`,
  });

  const statusName = decision === "aprovada" ? "aprovado" : "não aprovado";
  const statusId = resolveProcessStatusId(state, task.listId, statusName);
  if (!statusId) {
    return fail(`Esta Lista não tem o status “${statusName}” configurado.`);
  }
  const moved = changeTaskStatus(state, actingMemberId, task.id, statusId);
  if (!moved.ok) return fail(moved.error, moved.field);

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
