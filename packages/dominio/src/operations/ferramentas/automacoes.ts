/**
 * Os Eventos dos Ativos de Canal como Gatilhos de Automação (24, 18; 25, 18;
 * 23, 18): "Contato entrou no Grupo", "Contato saiu do Grupo", "Pedido de
 * Entrada recebido", "Resposta de Flow recebida". O escopo é avaliado NO
 * MOMENTO DO EVENTO: uma Automação de escopo Comunidade alcança os Grupos
 * vinculados agora, e um Grupo desvinculado deixa de ser alcançado sem que a
 * Automação mude (RN-COM-09, B92).
 *
 * As Ações são as que a ontologia nomeia como Automação e nunca como regra
 * fixa: gravar Tag ou Valor de Campo no Contato (RN-FLW-14), remover
 * Participante (o "Guardião", 24, 20.8), enviar Mensagem ao Contato.
 */

import type { DataState } from "../../state";
import type { Automation, AutomationAction, AutomationExecution, AutomationVersion, Contact, Grupo, Id } from "../../types";
import { contactDisplayName } from "../../derive";
import { participacoesVigentes } from "../../derive-ferramentas";
import { memberActor, nextId, recordActivity } from "../activity";
import { sendMessageSemConferencia, startConversation } from "../conversations";
import { encerrarParticipacao, nomeDoParticipante, registrarNoGrupo } from "./participacoes";

const now = (): string => new Date().toISOString();

export type EventoDeFerramentas =
  | { readonly kind: "contatoEntrouNoGrupo"; readonly grupoId: Id; readonly contactId: Id; readonly participacaoId: Id }
  | { readonly kind: "contatoSaiuDoGrupo"; readonly grupoId: Id; readonly contactId: Id; readonly participacaoId: Id }
  | { readonly kind: "pedidoDeEntradaRecebido"; readonly grupoId: Id; readonly contactId: Id; readonly pedidoId: Id }
  | { readonly kind: "respostaDeFlowRecebida"; readonly flowId: Id; readonly contactId: Id; readonly conversationId: Id; readonly messageId: Id };

interface ActionSpec {
  readonly tagId?: Id;
  readonly definitionId?: Id;
  readonly value?: string | number | boolean;
  /** `mensagem.enviarAoContato`: o texto; `{{nome}}` vira o nome do Contato, `{{grupo}}` o do Grupo. */
  readonly template?: string;
  readonly channelId?: Id;
}

function parseJson<T>(text: string | undefined): T | undefined {
  if (!text) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

const publishedVersion = (automation: Automation): AutomationVersion | undefined =>
  [...automation.versions].reverse().find((v) => v.state === "publicada");

/** O escopo alcança o Evento? Avaliado agora, por referência (RN-COM-09). */
function escopoAlcanca(state: DataState, automation: Automation, evento: EventoDeFerramentas): boolean {
  if (automation.scopeType === "workspace") return true;
  if (evento.kind === "respostaDeFlowRecebida") return automation.scopeType === "flow" && automation.scopeId === evento.flowId;
  const grupo = state.grupos.find((g) => g.id === evento.grupoId);
  if (!grupo) return false;
  if (automation.scopeType === "grupo") return automation.scopeId === grupo.id;
  if (automation.scopeType === "comunidade") return grupo.comunidadeId === automation.scopeId;
  return false;
}

function runAction(
  state: DataState,
  automation: Automation,
  evento: EventoDeFerramentas,
  contato: Contact,
  grupo: Grupo | undefined,
  action: AutomationAction,
): { readonly ok: boolean; readonly output: string } {
  const owner = automation.ownerMemberId;
  const spec = parseJson<ActionSpec>(action.params) ?? {};
  const atorDaAutomacao = { kind: "automation" as const, id: automation.id };
  if (action.kind === "controle") return { ok: false, output: `Controle não suportado: ${action.controlKind ?? "?"}` };
  switch (action.toolId) {
    case "contato.adicionarTag": {
      const tag = state.tags.find((t) => t.id === spec.tagId && t.lifecycle === "ativo");
      if (!tag) return { ok: false, output: "Tag não encontrada." };
      if (contato.tagIds.includes(tag.id)) return { ok: true, output: `Já tinha a Tag ${tag.name}` };
      contato.tagIds.push(tag.id);
      recordActivity(state, { actor: atorDaAutomacao, delegate: memberActor(owner), action: "Tag adicionada", objectType: "contact", objectId: contato.id, objectName: contactDisplayName(contato), after: tag.name, detail: automation.name });
      return { ok: true, output: `Tag: ${tag.name}` };
    }
    case "contato.definirCampo": {
      const definicao = state.fieldDefinitions.find((d) => d.id === spec.definitionId && d.target === "contact" && d.lifecycle === "ativo");
      if (!definicao || spec.value === undefined) return { ok: false, output: "Campo ou valor ausente." };
      const atual = contato.fieldValues.find((v) => v.definitionId === definicao.id);
      if (atual) {
        atual.value = spec.value;
        atual.state = "ativo";
      } else contato.fieldValues.push({ definitionId: definicao.id, value: spec.value, state: "ativo" });
      recordActivity(state, { actor: atorDaAutomacao, delegate: memberActor(owner), action: "Valor de Campo definido", objectType: "contact", objectId: contato.id, objectName: contactDisplayName(contato), after: `${definicao.name}: ${String(spec.value)}`, detail: automation.name });
      return { ok: true, output: `${definicao.name}: ${String(spec.value)}` };
    }
    case "grupo.removerParticipante": {
      if (!grupo) return { ok: false, output: "O Evento não é de Grupo." };
      const p = participacoesVigentes(grupo).find((x) => x.contactId === contato.id);
      if (!p) return { ok: true, output: "Já não estava no Grupo" };
      encerrarParticipacao(grupo, p, { causa: "removido", removidoPor: atorDaAutomacao });
      registrarNoGrupo(state, grupo, { actor: atorDaAutomacao, delegate: memberActor(owner), action: "Participante removido", detail: `${nomeDoParticipante(state, p)} — ${automation.name}` });
      return { ok: true, output: `Removido: ${nomeDoParticipante(state, p)}` };
    }
    case "mensagem.enviarAoContato": {
      if (!spec.template) return { ok: false, output: "Sem texto." };
      const canalId = spec.channelId ?? grupo?.canalId ?? state.channels.find((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo")?.id;
      if (!canalId) return { ok: false, output: "Sem Canal para enviar." };
      // 1.2.2 — `startConversation` confere o dono (Membro ativo, não Convidado) e segue
      // exportada; o envio vai pela variante interna: a Automação age por delegação do
      // dono, e `sendMessage` (registrada) passou a recusar pelo ator.
      const conversa = startConversation(state, owner, canalId, contato.id);
      if (!conversa.ok) return { ok: false, output: conversa.error };
      const texto = spec.template.replace(/\{\{nome\}\}/g, contato.firstName || contactDisplayName(contato)).replace(/\{\{grupo\}\}/g, grupo?.nome ?? "");
      const envio = sendMessageSemConferencia(state, owner, { conversationId: conversa.value.id, content: texto, actor: atorDaAutomacao, delegate: memberActor(owner) });
      return envio.ok ? { ok: true, output: "Mensagem enviada" } : { ok: false, output: envio.error };
    }
    default:
      return { ok: false, output: `Ferramenta não suportada: ${action.toolId ?? "?"}` };
  }
}

function execute(state: DataState, automation: Automation, version: AutomationVersion, evento: EventoDeFerramentas, contato: Contact, grupo: Grupo | undefined): AutomationExecution {
  const objectType = evento.kind === "respostaDeFlowRecebida" ? "flow" : "grupo";
  const objectId = evento.kind === "respostaDeFlowRecebida" ? evento.flowId : evento.grupoId;
  const objectName = evento.kind === "respostaDeFlowRecebida" ? (state.flows.find((f) => f.id === evento.flowId)?.nome ?? "Flow") : (grupo?.nome ?? "Grupo");
  const execution: AutomationExecution = {
    id: nextId("aex"),
    workspaceId: state.workspace.id,
    automationId: automation.id,
    automationVersion: version.number,
    state: "executando",
    triggerKind: "evento",
    objectType,
    objectId,
    objectName,
    invokedBy: { kind: "automation", id: automation.id },
    delegate: memberActor(automation.ownerMemberId),
    chain: { depth: 0, visitedAgentIds: [], visitedAutomationObjects: [{ automationId: automation.id, objectId }] },
    steps: [],
    childAgentExecutionIds: [],
    cost: { modelUnits: 0, toolCalls: 0, childExecutions: 0, durationMs: 0 },
    startedAt: now(),
  };
  state.automationExecutions.push(execution);
  const inicio = Date.now();
  for (const action of [...version.actions].sort((a, b) => a.order - b.order)) {
    const result = runAction(state, automation, evento, contato, grupo, action);
    execution.steps.push({
      index: execution.steps.length,
      kind: action.kind === "controle" ? "raciocinio" : "ferramenta",
      ...(action.toolId ? { toolId: action.toolId } : {}),
      input: action.params,
      output: result.output,
      toolAllowed: true,
      resourcePermitted: result.ok,
      result: result.ok ? "concluido" : "falhou",
      at: now(),
    });
    if (!result.ok) {
      execution.state = "falhou";
      execution.terminationReason = result.output;
      break;
    }
  }
  if (execution.state === "executando") execution.state = "concluida";
  execution.endedAt = now();
  execution.cost = { ...execution.cost, toolCalls: execution.steps.length, durationMs: Date.now() - inicio };
  recordActivity(state, {
    actor: { kind: "automation", id: automation.id },
    action: execution.state === "concluida" ? "Automação executada" : "Automação falhou",
    objectType,
    objectId,
    objectName,
    detail: automation.name,
    ...(execution.terminationReason ? { after: execution.terminationReason } : {}),
  });
  return execution;
}

/**
 * Chamada pelas operações que geram o Evento (grupos.ts, captacao.ts,
 * flows.ts) — nunca pela tela. A profundidade corta a corrente: uma
 * Automação que remove um Participante gera "saiu do Grupo", que não volta a
 * dispará-la (DO-AUT-11).
 */
let profundidade = 0;
export function emitirEventoDeFerramentas(state: DataState, evento: EventoDeFerramentas): AutomationExecution[] {
  if (profundidade > 2) return [];
  const contato = state.contacts.find((c) => c.id === evento.contactId);
  if (!contato) return [];
  const grupo = evento.kind === "respostaDeFlowRecebida" ? undefined : state.grupos.find((g) => g.id === evento.grupoId);
  const executions: AutomationExecution[] = [];
  profundidade += 1;
  try {
    for (const automation of state.automations) {
      if (automation.lifecycle !== "ativo") continue;
      const version = publishedVersion(automation);
      if (!version || version.trigger?.kind !== "evento" || version.trigger.eventType !== evento.kind) continue;
      if (!escopoAlcanca(state, automation, evento)) continue;
      executions.push(execute(state, automation, version, evento, contato, grupo));
    }
  } finally {
    profundidade -= 1;
  }
  return executions;
}
