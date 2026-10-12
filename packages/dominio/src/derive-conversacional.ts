/**
 * Leituras derivadas da Tarefa conversacional (C35). A Tarefa não guarda
 * Contato, Conversa nem Negócio em campo próprio: aponta para o CRM só por
 * Vínculos (`Link`, RN-TAR-15), e o Canal vem da Conversa vinculada. Nada
 * aqui é gravado; tudo é recomputado do estado a cada leitura.
 */

import type { DataState } from "./state";
import type { Channel, ChannelType, Contact, Conversation, Deal, Id, Link, Message, ModeloDeTarefa, Task } from "./types";
import { CHANNEL_CAPABILITIES } from "./operations/conversations";

/** Os papéis dos Vínculos com que a Tarefa conversacional nasce. */
export const PAPEL_DO_VINCULO = {
  contato: "contato da Tarefa",
  conversa: "conversa da Tarefa",
  negocio: "Negócio da Tarefa",
} as const;

export function modeloDaLista(state: DataState, listId: Id): ModeloDeTarefa | undefined {
  return state.lists.find((l) => l.id === listId)?.modeloDeTarefa;
}

export const listaConversacional = (state: DataState, listId: Id): boolean =>
  modeloDaLista(state, listId) === "conversacional";

/** A Subtarefa herda o Contato da raiz (B1: não é entidade à parte). */
function raizDe(state: DataState, task: Task): Task {
  const rootId = task.rootTaskId ?? task.parentTaskId;
  if (!rootId) return task;
  return state.tasks.find((t) => t.id === rootId) ?? task;
}

/** Onde procurar os Vínculos: na própria Tarefa e, se for Subtarefa, na raiz. */
function alvosDe(state: DataState, task: Task): Task[] {
  const raiz = raizDe(state, task);
  return raiz === task ? [task] : [task, raiz];
}

/** Vínculos que SAEM da Tarefa para um tipo de alvo, o do papel pedido primeiro. */
function vinculosDaTarefa(state: DataState, task: Task, toType: Link["toType"], papel: string): Link[] {
  const links = state.links.filter((l) => l.fromType === "task" && l.fromId === task.id && l.toType === toType);
  return [...links.filter((l) => l.role === papel), ...links.filter((l) => l.role !== papel)];
}

/**
 * O Contato que um Vínculo alcança HOJE. Um `mesclado` responde pelo
 * sobrevivente (RN-CON-14; a mesclagem migra os Vínculos, mas um Vínculo
 * anterior a ela ainda pode apontar para o absorvido — e B14 garante que não
 * há cadeia). Um Contato na lixeira suspende a exibição do Vínculo
 * (RN-TAR-15): a Tarefa fica sem Contato até que ele seja restaurado.
 */
function contatoAlcancado(state: DataState, contactId: Id): Contact | undefined {
  const registro = state.contacts.find((c) => c.id === contactId);
  const contact =
    registro?.lifecycle === "mesclado" && registro.mergedIntoId !== undefined
      ? state.contacts.find((c) => c.id === registro.mergedIntoId)
      : registro;
  if (!contact || contact.lifecycle === "naLixeira" || contact.lifecycle === "mesclado") return undefined;
  return contact;
}

/**
 * O Contato da Tarefa: o Vínculo task→contact (papel "contato da Tarefa"
 * primeiro, depois qualquer). Sem ele, o Contato principal do Negócio
 * vinculado — é o que cobre as Reuniões de "Meus negócios", que só apontam
 * para o Negócio. A Subtarefa lê a raiz.
 */
export function contatoDaTarefa(state: DataState, task: Task): Contact | undefined {
  for (const alvo of alvosDe(state, task)) {
    for (const link of vinculosDaTarefa(state, alvo, "contact", PAPEL_DO_VINCULO.contato)) {
      const contact = contatoAlcancado(state, link.toId);
      if (contact) return contact;
    }
  }
  const deal = negocioDaTarefa(state, task);
  const principal = deal?.contactLinks.find((l) => l.principal) ?? deal?.contactLinks[0];
  return principal ? contatoAlcancado(state, principal.contactId) : undefined;
}

/** A Conversa da Tarefa: o Vínculo task→conversation — suspenso enquanto ela está na lixeira (RN-TAR-15). A Subtarefa lê a raiz. */
export function conversaDaTarefa(state: DataState, task: Task): Conversation | undefined {
  for (const alvo of alvosDe(state, task)) {
    for (const link of vinculosDaTarefa(state, alvo, "conversation", PAPEL_DO_VINCULO.conversa)) {
      const conversation = state.conversations.find((c) => c.id === link.toId);
      if (conversation && conversation.lifecycle !== "naLixeira") return conversation;
    }
  }
  return undefined;
}

/** O Canal é da Conversa (INV-CXE-04): a Tarefa não o guarda. */
export function canalDaTarefa(state: DataState, task: Task): Channel | undefined {
  const conversation = conversaDaTarefa(state, task);
  if (!conversation) return undefined;
  return state.channels.find((c) => c.id === conversation.channelId);
}

/**
 * O primeiro Vínculo task→deal (papel "Negócio da Tarefa" primeiro; o espelho
 * de "Meus negócios" também conta) — suspenso enquanto o Negócio está na
 * lixeira (RN-TAR-15).
 */
export function negocioDaTarefa(state: DataState, task: Task): Deal | undefined {
  for (const alvo of alvosDe(state, task)) {
    for (const link of vinculosDaTarefa(state, alvo, "deal", PAPEL_DO_VINCULO.negocio)) {
      const deal = state.deals.find((d) => d.id === link.toId);
      if (deal && deal.lifecycle !== "naLixeira") return deal;
    }
  }
  return undefined;
}

/**
 * A última Mensagem trocada com o Contato no Canal da Tarefa — ou, sem
 * Canal, em qualquer Conversa dele. Nota interna não conta: não foi trocada
 * com o Contato (mesma leitura de `lastInteraction`).
 */
export function ultimaMensagemDaTarefa(state: DataState, task: Task): Message | undefined {
  const contact = contatoDaTarefa(state, task);
  if (!contact) return undefined;
  const channel = canalDaTarefa(state, task);
  let ultima: Message | undefined;
  for (const conversation of state.conversations) {
    if (conversation.contactId !== contact.id || conversation.lifecycle !== "ativo") continue;
    if (channel && conversation.channelId !== channel.id) continue;
    for (const message of conversation.messages) {
      if (message.direction === "interna") continue;
      if (!ultima || message.createdAt > ultima.createdAt) ultima = message;
    }
  }
  return ultima;
}

/** As Tarefas conversacionais ativas do Contato, a mais recente primeiro. */
export function tarefasConversacionaisDoContato(state: DataState, contactId: Id): Task[] {
  const vinculadas = new Set(
    state.links.filter((l) => l.fromType === "task" && l.toType === "contact" && l.toId === contactId).map((l) => l.fromId),
  );
  return state.tasks
    .filter((t) => t.lifecycle === "ativo" && vinculadas.has(t.id) && listaConversacional(state, t.listId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Os Canais ativos que alcançam algum Identificador do Contato — a regra do
 * diálogo de Iniciar Conversa, no domínio: a capacidade é do TIPO de Canal
 * (documento 14, 7.1). Sem Contato escolhido, todos os Canais ativos.
 */
export function canaisQueAlcancam(state: DataState, contact: Contact | undefined): Channel[] {
  return state.channels
    .filter((ch) => ch.lifecycle === "ativo")
    .filter((ch) => {
      if (!contact) return true;
      const alcanca = CHANNEL_CAPABILITIES[ch.channelType].resolvesIdentifierTypes;
      return contact.identifiers.some((i) => alcanca.includes(i.type));
    });
}

/**
 * C36 — os canais de atendimento da Lista, como Canais ativos, na ordem em que
 * foram marcados. Vazio para a Lista operacional e para a conversacional que
 * ainda não os configurou.
 */
export function canaisDaLista(state: DataState, listId: Id): Channel[] {
  const list = state.lists.find((l) => l.id === listId);
  if (!list || list.modeloDeTarefa !== "conversacional") return [];
  return (list.canaisDeAtendimento ?? [])
    .map((id) => state.channels.find((c) => c.id === id))
    .filter((c): c is Channel => c !== undefined && c.lifecycle === "ativo");
}

/** Os canais da Lista que alcançam algum Identificador do Contato (sem Contato, todos os da Lista). */
export function canaisDaListaQueAlcancam(state: DataState, listId: Id, contact: Contact | undefined): Channel[] {
  const alcancam = new Set(canaisQueAlcancam(state, contact).map((c) => c.id));
  return canaisDaLista(state, listId).filter((c) => alcancam.has(c.id));
}

/** A Lista conversacional ainda sem canais de atendimento: nada nasce nela até configurá-los. */
export function listaSemCanais(state: DataState, listId: Id): boolean {
  return listaConversacional(state, listId) && canaisDaLista(state, listId).length === 0;
}

// ── Esqueleto do passo RED (08-05, Task 3): as assinaturas são as definitivas ──

export const ORDEM_DOS_TIPOS_DE_CANAL: readonly ChannelType[] = [
  "whatsapp",
  "instagram",
  "linkedin",
  "email",
  "chatDoSite",
];

export interface CanalDoFio {
  readonly canal: Channel;
  readonly alcancavel: boolean;
}

export function canaisDoFio(_state: DataState, _contact: Contact | undefined): CanalDoFio[] {
  throw new Error("canaisDoFio: ainda não implementada");
}

export function canaisDeResposta(_state: DataState, _contact: Contact | undefined): Channel[] {
  throw new Error("canaisDeResposta: ainda não implementada");
}

export function canalPadraoDeResposta(_state: DataState, _contact: Contact | undefined): Id | undefined {
  throw new Error("canalPadraoDeResposta: ainda não implementada");
}

export function canalDaAbaInicial(_state: DataState, _contact: Contact | undefined): Id | undefined {
  throw new Error("canalDaAbaInicial: ainda não implementada");
}

export function canalPadraoDoTipo(_state: DataState, _contact: Contact | undefined, _tipo: ChannelType): Id | undefined {
  throw new Error("canalPadraoDoTipo: ainda não implementada");
}

export function marcadoresDeCanal<T extends { readonly channelId: Id }>(
  _itens: readonly T[],
): Array<{ readonly tipo: "item"; readonly item: T } | { readonly tipo: "via"; readonly channelId: Id }> {
  throw new Error("marcadoresDeCanal: ainda não implementada");
}

export function rotuloDoCanal(_canal: Pick<Channel, "name" | "channelType" | "provider">): string {
  throw new Error("rotuloDoCanal: ainda não implementada");
}

export function textoDoSeparadorDeCanal(_canal: Pick<Channel, "name" | "channelType" | "provider">): string {
  throw new Error("textoDoSeparadorDeCanal: ainda não implementada");
}
