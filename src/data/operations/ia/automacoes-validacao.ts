/**
 * 19, RN-AUT-07 — a validação da Versão de Automação, aplicada ANTES de
 * publicar (nunca ao editar: um rascunho inválido é salvo, e o editor mostra
 * os problemas ao lado). É pura, como `flows-validacao.ts`: recebe a
 * Automação e a Versão e devolve a lista de problemas, cada um com a regra
 * que o achou e o bloco do editor (Gatilho, Condições, Ações, Política) para
 * a tela levar o Membro até lá. `publishAutomation` responde o primeiro com
 * `field` = bloco, com as mesmas frases de sempre.
 */

import type { DataState } from "../../state";
import type { Agent, Automation, AutomationScopeType, AutomationVersion, Id } from "../../types";
import { disponibilidadeDaConcessao } from "../../derive-ia";
import { eventoCompativel, eventoDoCatalogo } from "./automacoes-catalogo";

export type RegraDeAutomacao = "DO-AUT-02" | "RN-AUT-04" | "RN-AUT-06" | "RN-AUT-07" | "RN-AUT-21";

/** Os quatro blocos do editor; `field` da recusa de publicar. */
export type BlocoDoEditor = "gatilho" | "condicoes" | "acoes" | "politica";

export interface ProblemaDeAutomacao {
  readonly regra: RegraDeAutomacao;
  readonly bloco: BlocoDoEditor;
  /** A posição da Condição (índice) ou da Ação (`order`) com o problema. */
  readonly indice?: number;
  readonly mensagem: string;
}

const problema = (regra: RegraDeAutomacao, bloco: BlocoDoEditor, mensagem: string, indice?: number): ProblemaDeAutomacao => ({
  regra,
  bloco,
  mensagem,
  ...(indice !== undefined ? { indice } : {}),
});

/**
 * RN-AUT-07 — por que um Evento não serve ao escopo: fora do catálogo ou de
 * família que o escopo não alcança. O editor recusa no ato com a mesma frase
 * que a validação lista.
 */
export function recusaDoEvento(scopeType: AutomationScopeType, eventType: string): string | undefined {
  if (!eventoDoCatalogo(eventType)) return `O Evento “${eventType}” não existe no catálogo.`;
  if (!eventoCompativel(scopeType, eventType)) return `O Evento “${eventType}” não ocorre no escopo desta Automação.`;
  return undefined;
}

const BASE_RANK: Record<string, number> = { convidado: 0, membro: 1, administrador: 2, proprietario: 3 };

/** RN-AUT-04 — a base do Papel da Automação passa da base do Proprietário? */
const excede = (a: string, b: string): boolean => (BASE_RANK[a] ?? 0) > (BASE_RANK[b] ?? 0);

/** A Condição `valorDeCampo` lê `{ definitionId }` da expressão, no vocabulário do motor. */
function definicaoDaCondicao(expression: string): string | undefined {
  try {
    const value: unknown = JSON.parse(expression);
    if (typeof value !== "object" || value === null) return undefined;
    const id = (value as { readonly definitionId?: unknown }).definitionId;
    return typeof id === "string" && id ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * RN-AUT-07 — a Habilidade indicada (Condição híbrida ou Ação "invocar
 * Agente") precisa estar concedida ao Agente E a Concessão disponível para
 * ele: Habilidade ativa com Versão corrente (ou fixada publicada), Ferramentas
 * obrigatórias permitidas, Dependências disponíveis (18, 7.2). A frase do
 * problema, ou nada.
 */
function recusaDaHabilidadeIndicada(state: DataState, agent: Agent, skillId: Id): string | undefined {
  const nome = state.skills.find((s) => s.id === skillId)?.name ?? skillId;
  const grant = state.skillGrants.find((g) => g.agentId === agent.id && g.skillId === skillId);
  if (!grant) return `A Habilidade “${nome}” não está concedida ao Agente “${agent.name}”.`;
  const disponibilidade = disponibilidadeDaConcessao(state, grant);
  if (!disponibilidade.disponivel) return `A Habilidade “${nome}” está indisponível para o Agente “${agent.name}”: ${disponibilidade.motivos.join(" · ")}.`;
  return undefined;
}

/**
 * Os problemas da Versão, na ordem dos blocos do editor: Gatilho, Condições,
 * Ações, Política. Sem problemas, a Versão é publicável.
 */
export function validarAutomacao(state: DataState, automation: Automation, version: AutomationVersion): ProblemaDeAutomacao[] {
  const problemas: ProblemaDeAutomacao[] = [];

  // INV-AUT-03 — exatamente um Gatilho, compatível com o escopo (RN-AUT-07).
  const trigger = version.trigger;
  if (!trigger) {
    problemas.push(problema("DO-AUT-02", "gatilho", "Escolha um Gatilho para publicar."));
  } else if (trigger.kind === "evento") {
    if (trigger.eventType === undefined || trigger.eventType === "") {
      problemas.push(problema("DO-AUT-02", "gatilho", "O Gatilho por Evento precisa de um Evento."));
    } else {
      const recusa = recusaDoEvento(automation.scopeType, trigger.eventType);
      if (recusa) problemas.push(problema(eventoDoCatalogo(trigger.eventType) ? "RN-AUT-07" : "RN-AUT-21", "gatilho", recusa));
    }
  } else if (trigger.kind === "agendamento") {
    if (!trigger.schedule || !(trigger.schedule.interval > 0)) {
      problemas.push(problema("DO-AUT-02", "gatilho", "O agendamento precisa de frequência e intervalo maior que zero."));
    }
  } else if (trigger.kind === "condicaoTemporal") {
    if (!trigger.temporalPredicate?.trim()) {
      problemas.push(problema("DO-AUT-02", "gatilho", "A condição temporal precisa de um predicado (dias em relação ao vencimento)."));
    }
  }

  // Condições: a híbrida invoca um Agente ativo com a Habilidade concedida e disponível (RN-AUT-06, RN-AUT-07); a de Campo aponta uma Definição que existe (RN-AUT-21).
  version.conditions.forEach((condition, indice) => {
    if (condition.kind === "hibrida") {
      if (!condition.agentId) {
        problemas.push(problema("RN-AUT-06", "condicoes", "Uma Condição híbrida indica o Agente que classifica (RN-AUT-06).", indice));
        return;
      }
      const agent = state.agents.find((a) => a.id === condition.agentId);
      if (!agent) {
        problemas.push(problema("RN-AUT-21", "condicoes", "O Agente indicado na Condição não existe.", indice));
        return;
      }
      if (agent.lifecycle !== "ativo") problemas.push(problema("RN-AUT-07", "condicoes", `O Agente “${agent.name}” não está ativo.`, indice));
      const habilidade = condition.skillId ? recusaDaHabilidadeIndicada(state, agent, condition.skillId) : undefined;
      if (habilidade) problemas.push(problema("RN-AUT-07", "condicoes", habilidade, indice));
    }
    if (condition.kind === "valorDeCampo") {
      const definitionId = definicaoDaCondicao(condition.expression);
      if (definitionId !== undefined && !state.fieldDefinitions.some((d) => d.id === definitionId)) {
        problemas.push(problema("RN-AUT-21", "condicoes", `A Definição de Campo “${definitionId}” não existe (RN-AUT-21).`, indice));
      }
    }
  });

  // Ações: ao menos uma; toda escrita é Ferramenta do Catálogo (INV-AUT-05); "invocar Agente" pede Agente ativo com a Habilidade concedida e disponível.
  if (version.actions.length === 0) {
    problemas.push(problema("RN-AUT-07", "acoes", "Adicione ao menos uma Ação."));
  }
  for (const action of [...version.actions].sort((a, b) => a.order - b.order)) {
    if (action.kind === "escrita") {
      if (!action.toolId || !state.tools.some((t) => t.id === action.toolId)) {
        problemas.push(problema("RN-AUT-21", "acoes", `A Ferramenta “${action.toolId ?? "—"}” não existe no Catálogo.`, action.order));
      }
    }
    if (action.controlKind === "invocarAgente") {
      const agent = state.agents.find((a) => a.id === action.agentId);
      if (!agent) {
        problemas.push(problema("RN-AUT-21", "acoes", "O Agente indicado na Ação não existe.", action.order));
        continue;
      }
      if (agent.lifecycle !== "ativo") problemas.push(problema("RN-AUT-07", "acoes", `O Agente “${agent.name}” não está ativo.`, action.order));
      const habilidade = action.skillId ? recusaDaHabilidadeIndicada(state, agent, action.skillId) : undefined;
      if (habilidade) problemas.push(problema("RN-AUT-07", "acoes", habilidade, action.order));
    }
  }

  // RN-AUT-04 — a permissão efetiva é própria ∩ Proprietário: um Proprietário
  // fora de ativo/suspenso não tem teto, e a Automação não pode ter mais que ele.
  const owner = state.members.find((m) => m.id === automation.ownerMemberId);
  if (!owner || (owner.state !== "ativo" && owner.state !== "suspenso")) {
    problemas.push(problema("RN-AUT-04", "politica", "A Automação precisa de um Proprietário ativo."));
    return problemas;
  }
  const ownerRole = state.roles.find((r) => r.id === owner.roleId);
  const automationRole = automation.roleId ? state.roles.find((r) => r.id === automation.roleId) : undefined;
  if (automationRole && ownerRole && excede(automationRole.base, ownerRole.base)) {
    problemas.push(
      problema("RN-AUT-04", "politica", "A Automação não pode ter mais permissões que o seu Proprietário. Revise as concessões ou transfira a propriedade."),
    );
  }

  return problemas;
}
