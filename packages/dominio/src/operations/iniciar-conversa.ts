/**
 * INICIAR CONVERSA a partir de uma Lista de "Meus negócios": em vez de criar
 * uma Tarefa, o Membro escolhe o Contato, diz em que Etapa o lead está (e a
 * Qualificação, a Temperatura, o valor), e sai direto para o chat.
 *
 * Um gesto, quatro atos do domínio, na ordem em que as regras valem:
 *   1. o Negócio nasce no Funil da Lista (createDeal — na 1ª Etapa, como manda B59);
 *   2. se a Etapa escolhida é outra, ele MOVE até ela (moveDealToStage, com os
 *      Requisitos de Entrada de cada Etapa);
 *   3. a Qualificação e a Temperatura vão para o Contato (setContactCatalogValue);
 *   4. a Conversa abre no Canal (startConversation — ou a que já está aberta).
 * E o espelho: a Tarefa que representa o Negócio na Lista, no Status da Etapa,
 * com a Proveniência e o Vínculo que o seed usa. Recusado em qualquer ato, o
 * que já nasceu é desfeito — o Membro não fica com meio Negócio.
 */

import { PAPEL_DO_VINCULO } from "../derive-conversacional";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Conversation, Deal, Funnel, Id, Money, Task } from "../types";
import { createTask } from "./tasks";
import { createDeal, moveDealToStage } from "./deals";
import { startConversation } from "./conversations";
import { setContactCatalogValue } from "./contacts";
import { memberActor } from "./activity";
import { canalForaDaLista } from "./canais";

const now = (): string => new Date().toISOString();

/** A Lista `lst_funil_<x>` espelha o Funil `fnl_<x>`. */
export function funilDaLista(state: DataState, listId: Id): Funnel | undefined {
  const m = /^lst_funil_(.+)$/.exec(listId);
  if (!m) return undefined;
  return state.funnels.find((f) => f.id === `fnl_${m[1]}` && f.lifecycle === "ativo");
}

/** O Status da Lista que corresponde à Etapa do Funil. */
export function statusDaEtapa(listId: Id, stageId: Id): Id {
  return `st_${listId}_${stageId}`;
}

export interface IniciarConversaInput {
  readonly listId: Id;
  readonly contactId: Id;
  readonly stageId: Id;
  readonly channelId: Id;
  readonly title?: string;
  readonly value?: Money;
  readonly qualificationId?: Id;
  readonly temperatureId?: Id;
}

export function iniciarConversa(
  state: DataState,
  actingMemberId: Id,
  input: IniciarConversaInput,
): OperationResult<{ readonly deal: Deal; readonly task: Task; readonly conversation: Conversation }> {
  const list = state.lists.find((l) => l.id === input.listId);
  if (!list) return fail("Lista não encontrada.");
  const funnel = funilDaLista(state, list.id);
  if (!funnel) return fail("Esta Lista não espelha um Funil.", "lista");
  const contact = state.contacts.find((c) => c.id === input.contactId && c.lifecycle === "ativo");
  if (!contact) return fail("Escolha um Contato ativo.", "contato");
  const stage = funnel.stages.find((s) => s.id === input.stageId);
  if (!stage) return fail("Escolha a Etapa em que o lead está.", "etapa");
  const channel = state.channels.find((c) => c.id === input.channelId && c.lifecycle === "ativo");
  if (!channel) return fail("Escolha o Canal em que a conversa acontece.", "canal");
  // C36 — o espelho do Funil também atende só pelos canais da Lista.
  const fora = canalForaDaLista(state, list, channel);
  if (fora) return fail(fora, "canal");

  const nomeDoContato = `${contact.firstName} ${contact.lastName}`.trim();
  const title = input.title?.trim() || `${funnel.name} — ${nomeDoContato}`;

  // Tudo o que este gesto cria, para desfazer se um ato recusar.
  const dealsAntes = state.deals.length;
  const tasksAntes = state.tasks.length;
  const linksAntes = state.links.length;
  const conversationsAntes = state.conversations.length;
  const activityAntes = state.activity.length;
  const desfazer = () => {
    state.deals.splice(dealsAntes);
    state.tasks.splice(tasksAntes);
    state.links.splice(linksAntes);
    state.conversations.splice(conversationsAntes);
    // recordActivity insere no início: o que entrou está na frente.
    state.activity.splice(0, state.activity.length - activityAntes);
  };

  // 1) o Negócio nasce na 1ª Etapa
  const nascido = createDeal(state, actingMemberId, {
    title,
    funnelId: funnel.id,
    contactId: contact.id,
    ...(input.value ? { value: input.value } : {}),
  });
  if (!nascido.ok) return nascido;
  let deal = nascido.value;

  // 2) e move até a Etapa escolhida, pelas regras de mover
  if (deal.stageId !== stage.id) {
    const movido = moveDealToStage(state, actingMemberId, deal.id, stage.id);
    if (!movido.ok) {
      desfazer();
      return fail(`O lead não entra em “${stage.name}”: ${movido.error}`);
    }
    deal = movido.value;
  }

  // 3) a Qualificação e a Temperatura são do Contato
  for (const [kind, valor] of [
    ["qualificacao", input.qualificationId],
    ["temperatura", input.temperatureId],
  ] as const) {
    if (!valor) continue;
    const r = setContactCatalogValue(state, actingMemberId, contact.id, kind, valor);
    if (!r.ok) {
      desfazer();
      return r;
    }
  }

  // O espelho na Lista: a Tarefa do Negócio, no Status da Etapa, nascida com
  // os Vínculos ao Negócio e ao Contato principal (a Lista é conversacional).
  // Sem Vínculo à Conversa: ela nasce depois da Tarefa.
  const espelho = createTask(state, actingMemberId, {
    listId: list.id,
    title: deal.title,
    statusId: statusDaEtapa(list.id, deal.stageId),
    assignees: [memberActor(deal.ownerMemberId)],
    vinculos: [
      { toType: "deal", toId: deal.id, role: "espelho do Negócio" },
      { toType: "contact", toId: contact.id, role: PAPEL_DO_VINCULO.contato },
    ],
  });
  if (!espelho.ok) {
    desfazer();
    return fail(`O Negócio nasceu, mas não entrou na Lista: ${espelho.error}`);
  }
  const task = espelho.value;
  task.description = deal.object ?? "";
  task.provenance = { kind: "deal", sourceId: deal.id, sourceName: deal.title, at: now() };

  // 4) a Conversa — a que já está aberta neste Canal, ou uma nova.
  // 1.2.2 — o ator já passou por `createDeal` (Membro ativo, não Convidado) no passo 1:
  // a `startConversation` registrada confere a mesma regra e segue valendo.
  const conversa = startConversation(state, actingMemberId, input.channelId, contact.id);
  if (!conversa.ok) {
    desfazer();
    return conversa;
  }

  return ok({ deal, task, conversation: conversa.value });
}
