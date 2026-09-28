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
  ChatFolder,
  ChatMessage,
  ChatSession,
  Id,
  Model,
  Skill,
} from "../types";
import { contactDisplayName, memberSeesTask } from "../derive";
import { agenteEfetivoDaSessao, recusaDeTrocarModelo } from "../derive-ia";
import { memberActor, nextId, recordActivity, systemActor } from "./activity";
import { nomeDeAgenteEmUso } from "./ia/agentes";
import { nomeDeAutomacaoColide } from "./ia/automacoes-editor";
import { validarAutomacao } from "./ia/automacoes-validacao";
import { recusaDeAdministrarAutomacao, recusaDeGovernarAgente } from "./ia/permissoes-ia";

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
  return ok(approval, approval.id);
}

/**
 * RN-AUT-07 — publishing validates, WITHOUT effect on failure: trigger
 * compatible with the scope, at least one action, existing tools, `ativo`
 * agents the automation may execute, skills granted to the agent, and the
 * permission ceiling of the owner (RN-AUT-04). The rules live in
 * `validarAutomacao`, shared with the editor; the first problem is answered
 * with its block as `field`. DO-AUT-19 — publishing makes the previous
 * version `obsoleta` in the same act.
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
   * tabela de 17.1). A verificação vem antes de qualquer validação do
   * rascunho para que quem não pode publicar não descubra, pela mensagem de
   * erro, o que falta nele.
   */
  const recusa = recusaDeAdministrarAutomacao(state, actingMemberId, automation, "publicar");
  if (recusa) return fail(recusa);

  const draft = automation.versions.find((v) => v.state === "rascunho");
  if (!draft) return fail("Não há rascunho para publicar.");

  const primeiro = validarAutomacao(state, automation, draft)[0];
  if (primeiro) return fail(primeiro.mensagem, primeiro.bloco);

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

/**
 * 17.1 — desarquivar é `administrar`; restaurar da lixeira é `excluir`, que
 * no protótipo é administrar. RN-AGE-02 — a lixeira não reservou o nome:
 * restaurar com colisão é rejeitado até renomear. É a frase que a ficha e o
 * catálogo mostram como `disabledReason` de Desarquivar/Restaurar.
 */
export function recusaDeRestaurarAgente(state: DataState, memberId: Id, agent: Agent): string | undefined {
  const recusa = recusaDeGovernarAgente(state, memberId, agent, "administrar");
  if (recusa) return recusa;
  const homonimo = nomeDeAgenteEmUso(state, agent.name, agent.id);
  if (homonimo) return `Já existe um Agente chamado “${homonimo.name}”: renomeie antes de restaurar (RN-AGE-02).`;
  return undefined;
}

/**
 * 17.1 e RN-AUT-03, a mesma pergunta para a Automação: `administrar`, e o
 * nome livre no escopo (a lixeira não reserva).
 */
export function recusaDeRestaurarAutomacao(state: DataState, memberId: Id, automation: Automation): string | undefined {
  const recusa = recusaDeAdministrarAutomacao(state, memberId, automation, "restaurar");
  if (recusa) return recusa;
  if (nomeDeAutomacaoColide(state, automation.scopeType, automation.scopeId, automation.name, automation.id)) {
    return `Já existe uma Automação chamada “${automation.name}” neste escopo: renomeie antes de restaurar (RN-AUT-03).`;
  }
  return undefined;
}

/**
 * B94 — restoring or unarchiving an Agent or an Automation NEVER returns it
 * directly to `ativo`: it returns to `pausado` when the previous state was
 * `ativo` or `pausado`; `rascunho` and `arquivado` come back as they were.
 * Permission and name collision (`recusaDeRestaurarAgente`) come first, so a
 * refusal has no effect.
 */
export function restoreAgent(state: DataState, actingMemberId: Id, agentId: Id): OperationResult<Agent> {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeRestaurarAgente(state, actingMemberId, agent);
  if (recusa) return fail(recusa);
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
  const recusa = recusaDeRestaurarAutomacao(state, actingMemberId, automation);
  if (recusa) return fail(recusa);
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
  // B75 — Modelo escolhido só quando o Agente efetivo admite sobrescrita.
  if (input.chosenModelId) {
    const recusa = recusaDeTrocarModelo(state, input.mainAgentId);
    if (recusa) return fail(recusa, "modelo");
  }

  let anchor: ChatAnchor | undefined;
  if (input.anchor) {
    // RN-CHT-03 — só se ancora no que se vê (a Tarefa alheia não "existe").
    if (input.anchor.type === "task" && !memberSeesTask(state, actingMemberId, input.anchor.id)) {
      return fail("O registro da Âncora não foi encontrado.", "ancora");
    }
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
  return ok(session, session.id);
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

  // ── Primeiro valida tudo: o armazém não desfaz uma operação recusada no
  //    meio, e um ajuste pela metade (o Agente trocado, o Modelo recusado)
  //    ficaria gravado.
  let agenteNovo: Agent | undefined;
  if (input.mainAgentId) {
    agenteNovo = state.agents.find((a) => a.id === input.mainAgentId);
    if (!agenteNovo) return fail("Agente não encontrado.", "agente");
    if (agenteNovo.lifecycle !== "ativo") return fail(`O Agente “${agenteNovo.name}” não está ativo.`, "agente");
  }
  let pasta: ChatFolder | undefined;
  if (input.folderId) {
    pasta = state.chatFolders.find((f) => f.id === input.folderId);
    if (!pasta) return fail("Pasta não encontrada.", "pasta");
    if (pasta.ownerMemberId !== actingMemberId) return fail("Esta pasta é de outro Membro.", "pasta");
  }
  let habilidade: Skill | undefined;
  if (input.skillId) {
    habilidade = state.skills.find((k) => k.id === input.skillId);
    if (!habilidade) return fail("Habilidade não encontrada.", "habilidade");
    if (habilidade.lifecycle !== "ativo") return fail(`A Habilidade “${habilidade.name}” não está ativa.`, "habilidade");
  }
  // O Agente que vai valer depois deste ajuste decide se o Modelo pode ser escolhido.
  const agenteDepois = input.mainAgentId !== undefined ? input.mainAgentId || undefined : session.mainAgentId;
  let modelo: Model | undefined;
  if (input.chosenModelId) {
    modelo = state.models.find((m) => m.id === input.chosenModelId);
    if (!modelo) return fail("Modelo não encontrado.", "modelo");
    if (modelo.discontinued) return fail(`O Modelo “${modelo.name}” foi descontinuado.`, "modelo");
    const recusa = recusaDeTrocarModelo(state, agenteDepois);
    if (recusa) return fail(recusa, "modelo");
  }
  let ancora: ChatAnchor | undefined;
  if (input.anchor !== undefined) {
    if (session.messages.length > 0) {
      return fail("A Âncora é fixada na criação: com Mensagens, ela não muda.", "ancora");
    }
    if (input.anchor) {
      if (input.anchor.type === "task" && !memberSeesTask(state, actingMemberId, input.anchor.id)) {
        return fail("O registro da Âncora não foi encontrado.", "ancora");
      }
      const name = anchorName(state, input.anchor.type, input.anchor.id);
      if (name === undefined) return fail("O registro da Âncora não foi encontrado.", "ancora");
      ancora = { type: input.anchor.type, id: input.anchor.id, nameAtTheTime: name };
    }
  }

  // ── Depois grava — só o que MUDA: escolher de novo o item já marcado não
  //    é ajuste, e não vai ao Registro.
  const mudancas: string[] = [];
  const agenteAntes = agenteEfetivoDaSessao(state, session.mainAgentId);
  const modeloAntes = session.chosenModelId;

  if (input.mainAgentId !== undefined && (agenteNovo?.id ?? undefined) !== session.mainAgentId) {
    if (agenteNovo) {
      session.mainAgentId = agenteNovo.id;
      mudancas.push(`Agente ${agenteNovo.name}`);
    } else {
      delete session.mainAgentId;
      mudancas.push("Assistente padrão");
    }
    // O Agente novo não admite sobrescrita: o Modelo escolhido deixa de valer
    // e a Sessão volta ao Modelo do Agente — dito no Registro e no fio, não em
    // silêncio. Só na troca de Agente: um ajuste de pasta não mexe no Modelo.
    if (input.chosenModelId === undefined && session.chosenModelId && recusaDeTrocarModelo(state, session.mainAgentId)) {
      delete session.chosenModelId;
      mudancas.push("Modelo do Agente");
    }
  }
  if (input.folderId !== undefined && (pasta?.id ?? undefined) !== session.folderId) {
    if (pasta) {
      session.folderId = pasta.id;
      mudancas.push(`pasta ${pasta.name}`);
    } else {
      delete session.folderId;
      mudancas.push("sem pasta");
    }
  }
  if (input.skillId !== undefined && (habilidade?.id ?? undefined) !== session.skillId) {
    if (habilidade) {
      session.skillId = habilidade.id;
      mudancas.push(`Habilidade ${habilidade.name}`);
    } else {
      delete session.skillId;
      mudancas.push("sem Habilidade");
    }
  }
  if (input.chosenModelId !== undefined && (modelo?.id ?? undefined) !== session.chosenModelId) {
    if (modelo) {
      session.chosenModelId = modelo.id;
      mudancas.push(`Modelo ${modelo.name}`);
    } else {
      delete session.chosenModelId;
      mudancas.push("Modelo do Agente");
    }
  }
  const mesmaAncora = ancora
    ? session.anchor?.type === ancora.type && session.anchor.id === ancora.id
    : session.anchor === undefined;
  if (input.anchor !== undefined && !mesmaAncora) {
    if (ancora) {
      session.anchor = ancora;
      mudancas.push(`ancorada em ${ancora.nameAtTheTime}`);
    } else {
      delete session.anchor;
      mudancas.push("sem Âncora");
    }
  }
  if (mudancas.length === 0) return ok(session);

  // DO-CHT-12 / RN-CHT-28 — com a Sessão em curso, trocar o Agente principal
  // ou o Modelo deixa uma Mensagem 'sistema' no fio: quem lê depois sabe a
  // partir de onde outro Agente (ou outro Modelo) passou a responder.
  if (session.messages.length > 0) {
    const agenteDepoisDoAjuste = agenteEfetivoDaSessao(state, session.mainAgentId);
    const avisos: string[] = [];
    if (agenteDepoisDoAjuste && agenteDepoisDoAjuste.id !== agenteAntes?.id) {
      avisos.push(`A partir daqui responde o Agente “${agenteDepoisDoAjuste.name}”.`);
    }
    if (session.chosenModelId !== modeloAntes) {
      const nome = session.chosenModelId ? state.models.find((m) => m.id === session.chosenModelId)?.name : undefined;
      avisos.push(nome ? `Modelo trocado para “${nome}”.` : "O Modelo volta a ser o do Agente.");
    }
    for (const aviso of avisos) {
      session.messages.push({
        id: nextId("cmg"),
        order: session.messages.length,
        role: "sistema",
        author: systemActor,
        content: aviso,
        fileIds: [],
        knowledgeReferences: [],
        complete: true,
        at: now(),
      });
    }
  }

  // Quem responde, antes e depois: o Agente efetivo e o Modelo (o escolhido,
  // senão o do Agente) — o Registro guarda a troca, não só o destino.
  const agenteQueResponde = agenteEfetivoDaSessao(state, session.mainAgentId);
  const quemResponde = (agente: Agent | undefined, modeloId: Id | undefined) =>
    `${agente?.name ?? "Assistente padrão"} · ${modeloId ? (state.models.find((m) => m.id === modeloId)?.name ?? modeloId) : "Modelo do Agente"}`;
  const trocouQuemResponde = agenteQueResponde?.id !== agenteAntes?.id || session.chosenModelId !== modeloAntes;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Sessão de Chat ajustada",
    objectType: "chatSession",
    objectId: session.id,
    objectName: session.title,
    detail: mudancas.join(" · "),
    ...(trocouQuemResponde
      ? { before: quemResponde(agenteAntes, modeloAntes), after: quemResponde(agenteQueResponde, session.chosenModelId) }
      : {}),
  });
  return ok(session, session.id);
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
  return ok(message, message.id);
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
