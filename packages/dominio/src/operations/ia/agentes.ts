/**
 * A governança do Agente fora do Construtor (17, seção 12): ativar, pausar,
 * arquivar, lixeira, transferir, permitir e retirar Ferramenta, ensaiar e
 * cancelar Execução. O Construtor grava Versões (`agent-builder.ts`); a ficha
 * muda o estado por aqui (D1).
 *
 * Duas regras que atravessam tudo: toda mudança de comportamento cria uma
 * Versão imutável (RN-AGE-06, D8) — permitir uma Ferramenta é uma Versão nova,
 * transferir a propriedade não é —, e nada volta a agir sem ato explícito:
 * desarquivar e restaurar devolvem `pausado` (B94; `restoreAgent` em `ai.ts`).
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type { Agent, AgentExecution, AgentVersion, ExecutionStep, Id, KnowledgeReference } from "../../types";
import { contactDisplayName } from "../../derive";
import { conhecimentoAcessivel, versaoCorrenteDoAgente } from "../../derive-ia";
import { memberActor, nextId, recordActivity } from "../activity";
import { baseDoPapel, recusaDeGovernarAgente, recusaDeMembroAtivo } from "./permissoes-ia";
import { RESOURCE_TYPE_LABEL } from "../../rotulos";

const now = (): string => new Date().toISOString();

const agentePorId = (state: DataState, id: Id): Agent | undefined => state.agents.find((a) => a.id === id);

/** INV-AGE-11 — o Assistente padrão é o que o Espaço de Trabalho aponta; tudo o que vale para Agente vale para ele, menos o que a seção 12.6 fixa. */
const ehOAssistentePadrao = (state: DataState, agent: Agent): boolean => state.workspace.defaultAgentId === agent.id;

/**
 * RN-AGE-07 — ativar exige objetivo e instruções não vazios e Modelo resolúvel
 * (existente e não descontinuado, ou `padraoDaPlataforma`). É a mesma pergunta
 * que o Construtor faz quando cria já ativando (D1), por isso é exportada.
 */
export function motivoParaNaoAtivar(state: DataState, version: AgentVersion | undefined): string | undefined {
  if (!version) return "O Agente não tem Versão para ativar.";
  if (!version.objective.trim()) return "Escreva o objetivo antes de ativar (RN-AGE-07).";
  if (!version.instructions.trim()) return "Escreva as instruções antes de ativar (RN-AGE-07).";
  if (version.modelId !== "padraoDaPlataforma") {
    const model = state.models.find((m) => m.id === version.modelId);
    if (!model) return "O Modelo desta Versão não existe mais: escolha outro antes de ativar (RN-AGE-07).";
    if (model.discontinued) return `O Modelo “${model.name}” foi descontinuado: escolha outro antes de ativar (RN-AGE-07).`;
  }
  return undefined;
}

// ── Nome (RN-AGE-02) ───────────────────────────────────────────────────────

const chaveDoNome = (name: string): string => name.trim().toLocaleLowerCase("pt-BR");

/**
 * RN-AGE-02 — outro Agente fora da lixeira com o mesmo nome, sem distinção de
 * maiúsculas e espaços nas extremidades; `na lixeira` não reserva. Criar,
 * renomear e restaurar com colisão são rejeitados até renomear.
 */
export function nomeDeAgenteEmUso(state: DataState, name: string, excetoId?: Id): Agent | undefined {
  const chave = chaveDoNome(name);
  return state.agents.find((a) => a.id !== excetoId && a.lifecycle !== "naLixeira" && chaveDoNome(a.name) === chave);
}

// ── A fábrica de Versão (DO-AGE-02, RN-AGE-06, D8) ─────────────────────────

/** O comportamento que uma Versão carrega: tudo menos o número, a foto das Concessões e o carimbo (Ator, momento, motivo). */
export type ConteudoDaVersaoDoAgente = Omit<AgentVersion, "number" | "grantedSkillIds" | "by" | "at" | "reason">;

/**
 * A cópia do comportamento da Versão corrente. As listas são copiadas para a
 * Versão anterior seguir imutável (DO-AGE-02); os campos opcionais do
 * Construtor entram só quando existem (`exactOptionalPropertyTypes`).
 */
export function copiarConteudoDaVersao(corrente: AgentVersion): ConteudoDaVersaoDoAgente {
  return {
    objective: corrente.objective,
    instructions: corrente.instructions,
    modelId: corrente.modelId,
    allowsModelOverride: corrente.allowsModelOverride,
    allowedToolIds: [...corrente.allowedToolIds],
    autonomy: corrente.autonomy,
    approvalPolicy: {
      approverMemberIds: [...corrente.approvalPolicy.approverMemberIds],
      approverTeamIds: [...corrente.approvalPolicy.approverTeamIds],
      timeoutHours: corrente.approvalPolicy.timeoutHours,
    },
    ...(corrente.maxInvocationDepth !== undefined ? { maxInvocationDepth: corrente.maxInvocationDepth } : {}),
    memoryEnabled: corrente.memoryEnabled,
    ...(corrente.icebreakers ? { icebreakers: [...corrente.icebreakers] } : {}),
    ...(corrente.knowledgeSources ? { knowledgeSources: corrente.knowledgeSources.map((k) => ({ kind: k.kind, label: k.label })) } : {}),
    ...(corrente.responseFormat !== undefined ? { responseFormat: corrente.responseFormat } : {}),
    ...(corrente.accessPoints ? { accessPoints: [...corrente.accessPoints] } : {}),
  };
}

/** DO-AGE-02 — as Habilidades concedidas por identidade, relidas das Concessões do Agente no momento da Versão. */
export const habilidadesConcedidas = (state: DataState, agentId: Id): Id[] => state.skillGrants.filter((g) => g.agentId === agentId).map((g) => g.skillId);

/**
 * A ÚNICA fábrica de Versão de Agente — o Construtor, permitir/retirar
 * Ferramenta e conceder/revogar Habilidade passam por aqui. O número segue o
 * maior; as Habilidades concedidas são SEMPRE relidas das Concessões do Agente:
 * a Versão fotografa o momento, nunca copia a foto anterior (DO-AGE-02). O
 * motivo entra quando há um. Quem chama coloca a Versão no Agente.
 */
export function montarVersaoDoAgente(
  state: DataState,
  agentId: Id,
  versoes: readonly AgentVersion[],
  actingMemberId: Id,
  conteudo: ConteudoDaVersaoDoAgente,
  reason?: string,
): AgentVersion {
  const number = versoes.reduce((maior, v) => Math.max(maior, v.number), 0) + 1;
  return {
    number,
    ...conteudo,
    grantedSkillIds: habilidadesConcedidas(state, agentId),
    by: memberActor(actingMemberId),
    ...(reason !== undefined ? { reason } : {}),
    at: now(),
  };
}

// ── RN-AGE-20 — liberar responsabilidades ──────────────────────────────────

/**
 * `arquivado` e `na lixeira` liberam o Agente de todas as Tarefas e Conversas
 * no ato, com evento por registro; a restauração não as devolve. `pausado`
 * preserva — por isso só as duas saídas chamam aqui.
 */
function liberarResponsabilidades(state: DataState, actingMemberId: Id, agent: Agent): { readonly tarefas: number; readonly conversas: number } {
  let tarefas = 0;
  let conversas = 0;
  for (const task of state.tasks) {
    const antes = task.assignees.length;
    task.assignees = task.assignees.filter((a) => !(a.kind === "agent" && a.id === agent.id));
    if (task.assignees.length === antes) continue;
    tarefas += 1;
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Responsável removido",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
      detail: `Agente “${agent.name}” liberado (RN-AGE-20)`,
    });
  }
  for (const conversation of state.conversations) {
    if (conversation.assignee?.kind !== "agent" || conversation.assignee.id !== agent.id) continue;
    delete conversation.assignee;
    conversas += 1;
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Conversa liberada",
      objectType: "conversation",
      objectId: conversation.id,
      objectName: conversation.title,
      detail: `Agente “${agent.name}” liberado (RN-AGE-20)`,
    });
  }
  return { tarefas, conversas };
}

const resumoDaLiberacao = (r: { readonly tarefas: number; readonly conversas: number }): string =>
  `${r.tarefas} Tarefa(s) e ${r.conversas} Conversa(s) liberadas`;

// ── Estado (12.1) ──────────────────────────────────────────────────────────

/** `rascunho` ou `pausado` → `ativo`, com RN-AGE-07 sobre a Versão corrente. Sem efeito quando recusa. */
export function ativarAgente(state: DataState, actingMemberId: Id, agentId: Id): OperationResult<Agent> {
  const agent = agentePorId(state, agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeGovernarAgente(state, actingMemberId, agent, "administrar");
  if (recusa) return fail(recusa);
  if (agent.lifecycle === "naLixeira") return fail("Restaure o Agente da lixeira antes.");
  if (agent.lifecycle === "arquivado") return fail("Desarquive o Agente antes: ele volta a pausado (B94).");
  if (agent.lifecycle === "ativo") return fail("O Agente já está ativo.");
  const motivo = motivoParaNaoAtivar(state, versaoCorrenteDoAgente(agent));
  if (motivo) return fail(motivo);

  const before = agent.lifecycle;
  agent.lifecycle = "ativo";
  agent.activatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Agente ativado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    before,
    after: "ativo",
  });
  return ok(agent, agent.id);
}

/** `ativo` → `pausado`: não aceita Execuções novas; as em curso terminam e as responsabilidades ficam (RN-AGE-19, RN-AGE-20). */
export function pausarAgente(state: DataState, actingMemberId: Id, agentId: Id): OperationResult<Agent> {
  const agent = agentePorId(state, agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeGovernarAgente(state, actingMemberId, agent, "administrar");
  if (recusa) return fail(recusa);
  if (ehOAssistentePadrao(state, agent)) return fail("O Assistente padrão nunca é pausado (INV-AGE-11).");
  if (agent.lifecycle !== "ativo") return fail("Só um Agente ativo é pausado.");

  agent.lifecycle = "pausado";
  agent.pausedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Agente pausado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    before: "ativo",
    after: "pausado",
    detail: "Responsabilidades preservadas; Execuções em curso terminam (RN-AGE-19).",
  });
  return ok(agent, agent.id);
}

/**
 * `rascunho` | `ativo` | `pausado` → `arquivado`: libera Responsável e
 * Atribuído no ato (RN-AGE-20); Concessões, Memória e Execuções ficam.
 * Desarquivar é o `restoreAgent` existente, que devolve `pausado` (B94).
 */
export function arquivarAgente(state: DataState, actingMemberId: Id, agentId: Id): OperationResult<Agent> {
  const agent = agentePorId(state, agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeGovernarAgente(state, actingMemberId, agent, "administrar");
  if (recusa) return fail(recusa);
  if (ehOAssistentePadrao(state, agent)) return fail("O Assistente padrão não é arquivado (INV-AGE-11).");
  if (agent.lifecycle === "naLixeira") return fail("Restaure o Agente da lixeira antes.");
  if (agent.lifecycle === "arquivado") return fail("O Agente já está arquivado.");

  const before = agent.lifecycle;
  agent.lifecycle = "arquivado";
  agent.archivedAt = now();
  // Arquivar não guarda o estado anterior: desarquivar devolve sempre `pausado` (B94).
  delete agent.lifecycleBeforeTrashAi;
  const liberadas = liberarResponsabilidades(state, actingMemberId, agent);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Agente arquivado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    before,
    after: "arquivado",
    detail: resumoDaLiberacao(liberadas),
  });
  return ok(agent, agent.id);
}

/**
 * `excluir` (= administrar no protótipo): como arquivar, e oculto. Guarda o
 * estado anterior (B43) para `restoreAgent` devolver `rascunho` e `arquivado`
 * como estavam, e `pausado` no lugar de `ativo` (B94).
 */
export function enviarAgenteALixeira(state: DataState, actingMemberId: Id, agentId: Id): OperationResult<Agent> {
  const agent = agentePorId(state, agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeGovernarAgente(state, actingMemberId, agent, "administrar");
  if (recusa) return fail(recusa);
  if (ehOAssistentePadrao(state, agent)) return fail("O Assistente padrão não vai à lixeira (INV-AGE-11).");
  if (agent.lifecycle === "naLixeira") return fail("O Agente já está na lixeira.");

  const before = agent.lifecycle;
  agent.lifecycleBeforeTrashAi = before;
  agent.lifecycle = "naLixeira";
  agent.trashedAt = now();
  const liberadas = liberarResponsabilidades(state, actingMemberId, agent);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Agente enviado à lixeira",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    before,
    after: "naLixeira",
    detail: resumoDaLiberacao(liberadas),
  });
  return ok(agent, agent.id);
}

/**
 * RN-AGE-04 — ato do Proprietário atual ou de quem administra, para Membro
 * ativo sem base Convidado. Governança, não comportamento: sem Versão nova.
 */
export function transferirAgente(state: DataState, actingMemberId: Id, agentId: Id, novoDonoId: Id): OperationResult<Agent> {
  const agent = agentePorId(state, agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeGovernarAgente(state, actingMemberId, agent, "administrar");
  if (recusa) return fail(recusa);
  if (ehOAssistentePadrao(state, agent)) return fail("O Assistente padrão acompanha o Proprietário do Espaço de Trabalho (B33).");
  const novoDono = state.members.find((m) => m.id === novoDonoId);
  if (!novoDono || novoDono.state !== "ativo" || baseDoPapel(state, novoDonoId) === "convidado") {
    return fail("O novo Proprietário precisa ser um Membro ativo sem base Convidado (RN-AGE-04).", "proprietario");
  }
  if (agent.ownerMemberId === novoDonoId) return fail("Este Membro já é o Proprietário.", "proprietario");

  const anterior = state.members.find((m) => m.id === agent.ownerMemberId);
  agent.ownerMemberId = novoDonoId;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Proprietário do Agente alterado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    before: anterior?.displayName ?? agent.ownerMemberId,
    after: novoDono.displayName,
  });
  return ok(agent, agent.id);
}

// ── Ferramentas permitidas (6.2; D8) ───────────────────────────────────────

/** A recusa comum a tudo que muda a configuração: `editar`, e o Agente fora de arquivado e lixeira. */
function recusaDeEditarConfiguracao(state: DataState, actingMemberId: Id, agent: Agent): string | undefined {
  const recusa = recusaDeGovernarAgente(state, actingMemberId, agent, "editar");
  if (recusa) return recusa;
  if (agent.lifecycle === "arquivado" || agent.lifecycle === "naLixeira") return "Restaure o Agente antes de editar.";
  return undefined;
}

function mudarFerramenta(state: DataState, actingMemberId: Id, agentId: Id, toolId: string, sentido: "permitir" | "retirar"): OperationResult<Agent> {
  const agent = agentePorId(state, agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeEditarConfiguracao(state, actingMemberId, agent);
  if (recusa) return fail(recusa);
  const tool = state.tools.find((t) => t.id === toolId);
  if (!tool) return fail(`A Ferramenta “${toolId}” não existe no Catálogo.`, "ferramenta");
  const corrente = versaoCorrenteDoAgente(agent);
  if (!corrente) return fail("O Agente não tem Versão.");
  const permitida = corrente.allowedToolIds.includes(toolId);
  if (sentido === "permitir" && permitida) return fail("Esta Ferramenta já está permitida ao Agente.", "ferramenta");
  if (sentido === "retirar" && !permitida) return fail("Esta Ferramenta não está permitida ao Agente.", "ferramenta");

  const allowedToolIds = sentido === "permitir" ? [...corrente.allowedToolIds, toolId] : corrente.allowedToolIds.filter((id) => id !== toolId);
  const reason = `Ferramenta “${tool.name}” ${sentido === "permitir" ? "permitida" : "retirada"}`;
  // A mudança de Ferramentas vai por cima da cópia; as Habilidades concedidas a fábrica relê das Concessões.
  const version = montarVersaoDoAgente(state, agent.id, agent.versions, actingMemberId, { ...copiarConteudoDaVersao(corrente), allowedToolIds }, reason);
  agent.versions.push(version);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Versão do Agente criada",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    after: `Versão ${version.number}`,
    detail: reason,
  });
  return ok(agent, agent.id);
}

/** Permitir uma Ferramenta é mudança de comportamento: cria Versão (RN-AGE-06). Não cria Solicitação de Aprovação. */
export const permitirFerramenta = (state: DataState, actingMemberId: Id, agentId: Id, toolId: string): OperationResult<Agent> =>
  mudarFerramenta(state, actingMemberId, agentId, toolId, "permitir");

/** Retirar deixa indisponível toda Concessão de Habilidade que a exigia (RN-HAB-13) — derivado, sem ato. */
export const retirarFerramenta = (state: DataState, actingMemberId: Id, agentId: Id, toolId: string): OperationResult<Agent> =>
  mudarFerramenta(state, actingMemberId, agentId, toolId, "retirar");

// ── Ensaio (DO-AGE-13, B82; D10) ───────────────────────────────────────────

export interface EnsaioInput {
  readonly texto: string;
  readonly anchor?: { readonly type: string; readonly id: Id };
}

/** O nome do registro-alvo para a Composição do Contexto; o id quando o tipo não é dos ancoráveis. */
function nomeDaAncora(state: DataState, type: string, id: Id): string {
  switch (type) {
    case "task":
      return state.tasks.find((t) => t.id === id)?.title ?? id;
    case "deal":
      return state.deals.find((d) => d.id === id)?.title ?? id;
    case "contact": {
      const contact = state.contacts.find((c) => c.id === id);
      return contact ? contactDisplayName(contact) : id;
    }
    case "conversation":
      return state.conversations.find((c) => c.id === id)?.title ?? id;
    case "knowledgeDocument":
      return state.documents.find((d) => d.id === id)?.title ?? id;
    case "list":
      return state.lists.find((l) => l.id === id)?.name ?? id;
    default:
      return id;
  }
}

/** DO-AGE-04 — `padraoDaPlataforma` resolve no início da Execução para o primeiro Modelo em uso. */
const modeloResolvido = (state: DataState, version: AgentVersion): { readonly id: Id; readonly motivo?: string } => {
  if (version.modelId === "padraoDaPlataforma") {
    const padrao = state.models.find((m) => !m.discontinued);
    return padrao ? { id: padrao.id } : { id: version.modelId, motivo: "Modelo padrão da plataforma indisponível (RN-AGE-08)" };
  }
  const model = state.models.find((m) => m.id === version.modelId);
  if (!model) return { id: version.modelId, motivo: "Modelo inexistente (RN-AGE-08)" };
  if (model.discontinued) return { id: model.id, motivo: "Modelo descontinuado (RN-AGE-08)" };
  return { id: model.id };
};

/** B98 — até três Documentos processados das Coleções concedidas, o primeiro Fragmento de cada. */
function referenciasDoEnsaio(state: DataState, agentId: Id): KnowledgeReference[] {
  const referencias: KnowledgeReference[] = [];
  for (const colecao of conhecimentoAcessivel(state, agentId)) {
    for (const doc of state.documents) {
      if (referencias.length >= 3) return referencias;
      if (doc.collectionId !== colecao.id || doc.lifecycle !== "ativo") continue;
      const versao = doc.versions.find((v) => v.number === doc.currentVersion);
      const fragmento = versao?.fragments[0];
      if (!versao || versao.processing !== "processado" || !fragmento) continue;
      referencias.push({
        documentId: doc.id,
        documentTitle: doc.title,
        version: versao.number,
        fragmentIds: [fragmento.id],
        collectionId: colecao.id,
        collectionName: colecao.name,
      });
    }
  }
  return referencias;
}

/**
 * Uma Execução real gravada com `rehearsal`: a Composição do Contexto e as
 * Ferramentas de leitura ocorrem; toda escrita é um Passo `simulado`, sem
 * efeito e sem Registro no registro-alvo. Nunca grava Memória. Permitido em
 * `rascunho` e `ativo` — a única Execução que um rascunho admite (RN-AGE-10).
 */
export function ensaiarAgente(state: DataState, actingMemberId: Id, agentId: Id, input: EnsaioInput): OperationResult<AgentExecution> {
  const agent = agentePorId(state, agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeGovernarAgente(state, actingMemberId, agent, "editar");
  if (recusa) return fail(recusa);
  if (agent.lifecycle !== "rascunho" && agent.lifecycle !== "ativo") return fail("Só um Agente em rascunho ou ativo ensaia (DO-AGE-13).");
  const texto = input.texto.trim();
  if (!texto) return fail("Escreva o pedido do ensaio.", "texto");
  const version = versaoCorrenteDoAgente(agent);
  if (!version) return fail("O Agente não tem Versão.");
  if (!version.instructions.trim()) return fail("Escreva as instruções antes de ensaiar: sem elas o Agente não sabe o que fazer.");

  const at = now();
  const modelo = modeloResolvido(state, version);
  const anchor = input.anchor ? { type: input.anchor.type, id: input.anchor.id } : undefined;
  const base = {
    id: nextId("exe"),
    workspaceId: state.workspace.id,
    agentId: agent.id,
    agentVersion: version.number,
    origin: "acaoDireta" as const,
    invokedBy: memberActor(actingMemberId),
    delegate: memberActor(actingMemberId),
    chain: { depth: 0, visitedAgentIds: [agent.id], visitedAutomationObjects: [] },
    ...(anchor ? { anchor } : {}),
    modelId: modelo.id,
    effectiveAutonomy: version.autonomy,
    rehearsal: true,
    input: texto,
    startedAt: at,
    endedAt: at,
  };

  // RN-AGE-08 — Disponibilidade verificada no início: falha antes de qualquer consumo de Modelo.
  if (modelo.motivo) {
    const execution: AgentExecution = {
      ...base,
      state: "falhou",
      steps: [],
      contextComposition: { readRecordIds: [], fragmentRefs: [], memoryItemIds: [], chatMessageIds: [] },
      knowledgeReferences: [],
      cost: { modelUnits: 0, toolCalls: 0, childExecutions: 0, durationMs: 0 },
      terminationReason: modelo.motivo,
    };
    state.agentExecutions.push(execution);
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Ensaio executado",
      objectType: "agent",
      objectId: agent.id,
      objectName: agent.name,
      result: "failed",
      detail: modelo.motivo,
    });
    return ok(execution, execution.id);
  }

  const steps: ExecutionStep[] = [
    { index: 0, kind: "raciocinio", output: `Ensaio: responder a “${texto}” com as instruções da Versão ${version.number}.`, result: "concluido", at },
  ];
  let escritas = 0;
  for (const toolId of version.allowedToolIds) {
    const tool = state.tools.find((t) => t.id === toolId);
    const index = steps.length;
    if (!tool) {
      steps.push({ index, kind: "ferramenta", toolId, output: `A Ferramenta “${toolId}” não existe no Catálogo`, toolAllowed: true, resourcePermitted: false, result: "falhou", at });
      continue;
    }
    const leitura = tool.effectClass === "leitura";
    if (!leitura) escritas += 1;
    steps.push({
      index,
      kind: "ferramenta",
      toolId,
      output: leitura ? `Leitura simulada de ${RESOURCE_TYPE_LABEL[tool.targetResourceType] ?? tool.targetResourceType}` : "Escrita não aplicada: ensaio (B82)",
      toolAllowed: true,
      resourcePermitted: true,
      effectClass: tool.effectClass,
      result: leitura ? "concluido" : "simulado",
      at,
    });
  }
  const knowledgeReferences = version.allowedToolIds.includes("consultar_conhecimento") ? referenciasDoEnsaio(state, agent.id) : [];

  const execution: AgentExecution = {
    ...base,
    state: "concluida",
    steps,
    output: `Ensaio concluído: ${steps.length} passo(s), ${escritas} escrita(s) simulada(s).`,
    contextComposition: {
      ...(anchor ? { anchor: { ...anchor, name: nomeDaAncora(state, anchor.type, anchor.id) } } : {}),
      readRecordIds: anchor ? [anchor.id] : [],
      fragmentRefs: knowledgeReferences.flatMap((r) => r.fragmentIds.map((fragmentId) => ({ documentId: r.documentId, version: r.version, fragmentId }))),
      memoryItemIds: [],
      chatMessageIds: [],
    },
    knowledgeReferences,
    cost: { modelUnits: 1, toolCalls: steps.length - 1, childExecutions: 0, durationMs: 0 },
  };
  state.agentExecutions.push(execution);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Ensaio executado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    detail: `${steps.length} passo(s), ${escritas} escrita(s) simulada(s)`,
  });
  return ok(execution, execution.id);
}

// ── Execução (12.3; RN-AGE-21) ─────────────────────────────────────────────

const ESTADOS_TERMINAIS: ReadonlySet<AgentExecution["state"]> = new Set(["concluida", "falhou", "cancelada"]);

/**
 * Cancelar é ato de quem administra o Agente ou do delegante da Execução. O
 * que já saiu, saiu: Passos e Registros ficam, o efeito não é revertido. As
 * Solicitações pendentes da Execução morrem com ela.
 */
export function cancelarExecucao(state: DataState, actingMemberId: Id, executionId: Id, motivo?: string): OperationResult<AgentExecution> {
  const execution = state.agentExecutions.find((e) => e.id === executionId);
  if (!execution) return fail("Execução não encontrada.");
  if (ESTADOS_TERMINAIS.has(execution.state)) return fail("Uma Execução terminal não é cancelada (11.2).");
  const ativo = recusaDeMembroAtivo(state, actingMemberId);
  if (ativo) return fail(ativo);
  const agent = agentePorId(state, execution.agentId);
  if (!agent) return fail("Agente não encontrado.");
  const delegante = execution.delegate?.kind === "member" && execution.delegate.id === actingMemberId;
  if (!delegante && recusaDeGovernarAgente(state, actingMemberId, agent, "administrar")) {
    return fail("Cancelar exige administrar o Agente ou ser o delegante da Execução (RN-AGE-21).");
  }

  const at = now();
  const before = execution.state;
  execution.state = "cancelada";
  execution.terminationReason = motivo?.trim() || "Cancelada por Membro";
  execution.endedAt = at;
  // O Passo que esperava aprovação não vai receber uma: fecha como cancelado; os produzidos ficam.
  execution.steps = execution.steps.map((s) => (s.result === "aguardando" ? { ...s, result: "cancelado" } : s));
  let solicitacoes = 0;
  for (const approval of state.approvals) {
    const origem = approval.origin;
    if (origem.kind !== "agentExecution" || origem.executionId !== execution.id || approval.decision !== undefined) continue;
    approval.decision = "cancelada";
    approval.decidedByMemberId = actingMemberId;
    approval.decidedAt = at;
    solicitacoes += 1;
  }
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Execução cancelada",
    objectType: "agentExecution",
    objectId: execution.id,
    objectName: execution.input,
    before,
    after: "cancelada",
    detail: solicitacoes > 0 ? `${execution.terminationReason} · ${solicitacoes} Solicitação(ões) de Aprovação cancelada(s)` : execution.terminationReason,
  });
  return ok(execution, execution.id);
}

// ── Memória (7.5) ──────────────────────────────────────────────────────────

/** Apagar um item é `editar` no Agente; a Memória é dele, não do Membro que a originou. */
export function apagarItemDeMemoria(state: DataState, actingMemberId: Id, agentId: Id, itemId: Id): OperationResult<Agent> {
  const agent = agentePorId(state, agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeEditarConfiguracao(state, actingMemberId, agent);
  if (recusa) return fail(recusa);
  const item = agent.memory.find((m) => m.id === itemId);
  if (!item) return fail("Item de Memória não encontrado.");

  agent.memory = agent.memory.filter((m) => m.id !== itemId);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Item de Memória apagado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    detail: item.content.length > 80 ? `${item.content.slice(0, 77)}…` : item.content,
  });
  return ok(agent, agent.id);
}
