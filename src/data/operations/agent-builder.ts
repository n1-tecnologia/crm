/**
 * O que o Construtor de Agentes grava. Um Agente nasce em `rascunho` com a
 * Versão 1 (17, 12.1) — ou já `ativo`, quando quem publica pede e RN-AGE-07
 * deixa; publicar de novo acrescenta uma Versão — a anterior fica no
 * histórico, como a ontologia pede (DO-AGE-02: a Versão é imutável depois de
 * gravada). O estado muda na ficha (`ia/agentes.ts`), não aqui (D1).
 *
 * B76 — o Agente nasce com o Papel Convidado, nunca com o do dono.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Agent, Id } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { montarVersaoDoAgente, motivoParaNaoAtivar, nomeDeAgenteEmUso, type ConteudoDaVersaoDoAgente } from "./ia/agentes";

const now = (): string => new Date().toISOString();

export interface AgentDraft {
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  /** Vazio é o Modelo padrão da plataforma. */
  readonly modelId: Id | "";
  readonly allowedToolIds: readonly string[];
  readonly icebreakers: readonly string[];
  readonly knowledgeSources: ReadonlyArray<{ readonly kind: "arquivo" | "url" | "base"; readonly label: string }>;
  readonly responseFormat: "texto" | "markdown" | "json" | "estruturado";
  readonly accessPoints: ReadonlyArray<"chat" | "whatsapp" | "api" | "webhook">;
}

function validate(state: DataState, actingMemberId: Id, draft: AgentDraft): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo publica um Agente.";
  // Ontologia 17.2 — Convidado nunca cria; o mesmo corte de `publishAutomationVersion`.
  if (state.roles.find((r) => r.id === member.roleId)?.base === "convidado") {
    return "O Papel Convidado não publica Agente.";
  }
  if (!draft.name.trim()) return "Dê um nome ao Agente.";
  if (!draft.instructions.trim()) return "Escreva as instruções: sem elas o Agente não sabe o que fazer.";
  if (draft.instructions.length > 4000) return "As instruções passam de 4000 caracteres.";
  if (draft.modelId) {
    const model = state.models.find((m) => m.id === draft.modelId);
    if (!model) return "Modelo não encontrado.";
    if (model.discontinued) return `O Modelo “${model.name}” foi descontinuado.`;
  }
  for (const toolId of draft.allowedToolIds) {
    if (!state.tools.some((t) => t.id === toolId)) return `Ferramenta “${toolId}” não existe.`;
  }
  if (draft.accessPoints.length === 0) return "Escolha ao menos um ponto de acesso.";
  for (const fonte of draft.knowledgeSources) {
    if (!fonte.label.trim()) return "Uma fonte de conhecimento está sem nome.";
    if (
      fonte.kind === "base" &&
      !state.collections.some((c) => c.lifecycle === "ativo" && c.name === fonte.label)
    ) {
      return `A base de conhecimento “${fonte.label}” não existe ou não está ativa.`;
    }
  }
  return undefined;
}

/**
 * O comportamento que a tela descreve. As Habilidades concedidas vivem nas
 * Concessões: a fábrica única (`montarVersaoDoAgente`) as fotografa (DO-AGE-02).
 */
function conteudoDoRascunho(draft: AgentDraft, actingMemberId: Id): ConteudoDaVersaoDoAgente {
  return {
    objective: draft.description.trim() || draft.name.trim(),
    instructions: draft.instructions.trim(),
    modelId: draft.modelId || "padraoDaPlataforma",
    allowsModelOverride: false,
    allowedToolIds: [...new Set(draft.allowedToolIds)],
    icebreakers: draft.icebreakers.map((s) => s.trim()).filter(Boolean),
    knowledgeSources: draft.knowledgeSources.map((k) => ({ kind: k.kind, label: k.label })),
    responseFormat: draft.responseFormat,
    accessPoints: [...new Set(draft.accessPoints)],
    autonomy: "assistido",
    approvalPolicy: { approverMemberIds: [actingMemberId], approverTeamIds: [], timeoutHours: 72 },
    memoryEnabled: true,
  };
}

/**
 * Nasce `rascunho`; com `ativar`, aplica RN-AGE-07 e grava `ativo` no mesmo
 * ato — a mesma pergunta que `ativarAgente` faz na ficha (D1).
 */
export function createAgent(
  state: DataState,
  actingMemberId: Id,
  draft: AgentDraft,
  opcoes?: { readonly ativar?: boolean },
): OperationResult<Agent> {
  const problem = validate(state, actingMemberId, draft);
  if (problem) return fail(problem);
  if (nomeDeAgenteEmUso(state, draft.name)) return fail(`Já existe um Agente chamado “${draft.name.trim()}”.`, "nome");
  const convidado = state.roles.find((r) => r.system && r.base === "convidado");
  if (!convidado) return fail("O Papel Convidado não existe neste Espaço de Trabalho.");

  // Um Agente nascendo não tem Concessão: a Versão 1 fotografa vazio.
  const id = nextId("agt");
  const primeira = montarVersaoDoAgente(state, id, [], actingMemberId, conteudoDoRascunho(draft, actingMemberId));
  const ativar = opcoes?.ativar === true;
  if (ativar) {
    const motivo = motivoParaNaoAtivar(state, primeira);
    if (motivo) return fail(motivo);
  }

  const agent: Agent = {
    id,
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: ativar ? "ativo" : "rascunho",
    name: draft.name.trim(),
    description: draft.description.trim(),
    ownerMemberId: actingMemberId,
    roleId: convidado.id,
    versions: [primeira],
    memory: [],
    memoryRetention: { maxItems: 200, maxDays: 180, keepDelegated: true },
    ...(ativar ? { activatedAt: now() } : {}),
  };
  state.agents.push(agent);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: ativar ? "Agente criado e ativado" : "Agente criado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    detail: ativar ? "Versão 1" : "Versão 1 em rascunho",
  });
  return ok(agent, agent.id);
}

/** Uma Versão nova sobre um Agente que já existe; nome e descrição acompanham. */
export function publishAgentVersion(
  state: DataState,
  actingMemberId: Id,
  agentId: Id,
  draft: AgentDraft,
): OperationResult<Agent> {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent) return fail("Agente não encontrado.");
  if (agent.lifecycle === "naLixeira") return fail("Este Agente está na lixeira.");
  // Arquivado não se edita (17, 11.1): desarquivar primeiro, e ele volta a pausado (B94).
  if (agent.lifecycle === "arquivado") return fail("Restaure o Agente antes de editar.");
  const problem = validate(state, actingMemberId, draft);
  if (problem) return fail(problem);
  // 17.2 — Administrador e Proprietário do Espaço editam qualquer Agente; os demais, só o próprio.
  const base = state.roles.find((r) => r.id === state.members.find((m) => m.id === actingMemberId)?.roleId)?.base;
  const podeEditar = base === "proprietario" || base === "administrador" || agent.ownerMemberId === actingMemberId;
  if (!podeEditar) return fail("Publicar uma Versão exige ser o Proprietário do Agente ou administrar o Espaço de Trabalho.");
  if (nomeDeAgenteEmUso(state, draft.name, agent.id)) return fail(`Já existe um Agente chamado “${draft.name.trim()}”.`, "nome");

  const versao = montarVersaoDoAgente(state, agent.id, agent.versions, actingMemberId, conteudoDoRascunho(draft, actingMemberId));
  agent.name = draft.name.trim();
  agent.description = draft.description.trim();
  agent.versions.push(versao);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Versão do Agente publicada",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    detail: `Versão ${versao.number}`,
  });
  return ok(agent);
}
