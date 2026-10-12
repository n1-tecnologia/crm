/**
 * Leituras derivadas da Tarefa conversacional (C35). A Tarefa não guarda
 * Contato, Conversa nem Negócio em campo próprio: aponta para o CRM só por
 * Vínculos (`Link`, RN-TAR-15), e o Canal vem da Conversa vinculada. Nada
 * aqui é gravado; tudo é recomputado do estado a cada leitura.
 */

import type { DataState } from "./state";
import type { Channel, ChannelType, Contact, Conversation, Deal, Id, Link, Message, ModeloDeTarefa, Task } from "./types";
import { ROTULO_DO_TIPO_DE_CANAL } from "./operations/canais";
import { CHANNEL_CAPABILITIES } from "./operations/conversations";
import { PROVEDORES, provedorDoCanal } from "./provedores-de-canal";

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

/**
 * A ordem das abas é da PLATAFORMA, não dos Identificadores do Contato: quem
 * atende usa sempre a mesma tela, e a aba do WhatsApp não pode mudar de lugar
 * porque este Contato tem e-mail e o outro não.
 */
export const ORDEM_DOS_TIPOS_DE_CANAL: readonly ChannelType[] = [
  "whatsapp",
  "instagram",
  "linkedin",
  "email",
  "chatDoSite",
];

/** Uma aba do chat: o Canal e se ele chega ao Contato (se não, a aba aparece desligada). */
export interface CanalDoFio {
  readonly canal: Channel;
  readonly alcancavel: boolean;
}

function alcancaOContato(canal: Channel, contact: Contact | undefined): boolean {
  if (!contact) return true;
  const alcanca = CHANNEL_CAPABILITIES[canal.channelType].resolvesIdentifierTypes;
  return contact.identifiers.some((i) => alcanca.includes(i.type));
}

/**
 * D-14 — uma aba por CANAL, não por tipo: dois WhatsApps dão duas abas. A
 * fileira mostra todos os Canais ativos do Espaço; os que não chegam ao Contato
 * vêm desligados (`alcancavel: false`), para a aba dizer por quê — a mesma ideia
 * de hoje, agora por Canal. O alcance é do TIPO (`resolvesIdentifierTypes`,
 * como em `canaisQueAlcancam`): o provedor não o muda. Ordem estável: tipo
 * (`ORDEM_DOS_TIPOS_DE_CANAL`), criação, id.
 */
export function canaisDoFio(state: DataState, contact: Contact | undefined): CanalDoFio[] {
  const posicao = (tipo: ChannelType): number => ORDEM_DOS_TIPOS_DE_CANAL.indexOf(tipo);
  return state.channels
    .filter((canal) => canal.lifecycle === "ativo")
    .sort(
      (a, b) =>
        posicao(a.channelType) - posicao(b.channelType) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .map((canal) => ({ canal, alcancavel: alcancaOContato(canal, contact) }));
}

/**
 * D-15 — o que o seletor "Responder por" oferece: só os Canais que alcançam o
 * Contato E estão `conectada`. Um Canal desligado não aceita resposta nova;
 * mandar por ele só criaria Mensagem `pendente`.
 */
export function canaisDeResposta(state: DataState, contact: Contact | undefined): Channel[] {
  return canaisDoFio(state, contact)
    .filter((c) => c.alcancavel && c.canal.connection === "conectada")
    .map((c) => c.canal);
}

/** Conversas ativas do Contato; sem Contato, nenhuma. */
function conversasAtivasDoContato(state: DataState, contact: Contact | undefined): Conversation[] {
  if (!contact) return [];
  return state.conversations.filter((c) => c.contactId === contact.id && c.lifecycle === "ativo");
}

/** O Canal da Conversa onde está a Mensagem `recebida` mais recente do Contato (entre os Canais aceitos por `serve`). */
function canalDaUltimaRecebida(
  state: DataState,
  contact: Contact | undefined,
  serve: (canalId: Id) => boolean,
): Id | undefined {
  let melhor: { readonly canalId: Id; readonly em: string } | undefined;
  for (const conversa of conversasAtivasDoContato(state, contact)) {
    if (!serve(conversa.channelId)) continue;
    for (const mensagem of conversa.messages) {
      if (mensagem.direction !== "recebida") continue;
      if (!melhor || mensagem.createdAt > melhor.em) melhor = { canalId: conversa.channelId, em: mensagem.createdAt };
    }
  }
  return melhor?.canalId;
}

/**
 * D-15 — o "Responder por" já vem preenchido com o Canal por onde o Contato
 * falou por último. Se esse Canal não serve mais (desconectado, arquivado), o
 * primeiro Canal de resposta do MESMO tipo; sem ele, o primeiro de resposta.
 * `undefined` quando nenhum Canal serve.
 */
export function canalPadraoDeResposta(state: DataState, contact: Contact | undefined): Id | undefined {
  const resposta = canaisDeResposta(state, contact);
  const ultimo = canalDaUltimaRecebida(state, contact, () => true);
  const doUltimo = resposta.find((c) => c.id === ultimo);
  if (doUltimo) return doUltimo.id;
  const tipoDoUltimo = state.channels.find((c) => c.id === ultimo)?.channelType;
  const domesmoTipo = tipoDoUltimo ? resposta.find((c) => c.channelType === tipoDoUltimo) : undefined;
  return (domesmoTipo ?? resposta[0])?.id;
}

/**
 * D-14 — a aba que abre é a do Canal da Conversa mais recente (nota interna
 * não conta: não foi trocada com o Contato). Abrir numa aba vazia enquanto há
 * Conversa viva em outro Canal esconde justamente o que a pessoa veio ver. Sem
 * Conversa, o primeiro Canal alcançável.
 */
export function canalDaAbaInicial(state: DataState, contact: Contact | undefined): Id | undefined {
  const fio = canaisDoFio(state, contact);
  const noFio = new Set(fio.map((c) => c.canal.id));
  let melhor: { readonly canalId: Id; readonly em: string } | undefined;
  for (const conversa of conversasAtivasDoContato(state, contact)) {
    if (!noFio.has(conversa.channelId)) continue;
    for (const mensagem of conversa.messages) {
      if (mensagem.direction === "interna") continue;
      if (!melhor || mensagem.createdAt > melhor.em) melhor = { canalId: conversa.channelId, em: mensagem.createdAt };
    }
  }
  return melhor?.canalId ?? fio.find((c) => c.alcancavel)?.canal.id;
}

/**
 * O Canal que um gesto "por tipo" (abrir atendimento, iniciar Conversa) usa
 * quando só o tipo é conhecido: entre os Canais de resposta do tipo, o da
 * última recebida naquele tipo; senão o primeiro. `undefined` se o Contato não
 * tem Canal conectado desse tipo.
 */
export function canalPadraoDoTipo(state: DataState, contact: Contact | undefined, tipo: ChannelType): Id | undefined {
  const doTipo = canaisDeResposta(state, contact).filter((c) => c.channelType === tipo);
  if (doTipo.length === 0) return undefined;
  const ultimo = canalDaUltimaRecebida(state, contact, (id) => doTipo.some((c) => c.id === id));
  return doTipo.find((c) => c.id === ultimo)?.id ?? doTipo[0]?.id;
}

/**
 * D-13 — o separador "via …" marca a TROCA de Canal numa sequência de itens
 * (Mensagens): vem antes de todo item cujo Canal difere do anterior. Com uma
 * aba por Canal a sequência de uma aba é de um Canal só e não ganha separador;
 * ele serve às listas que misturam Canais (Mensagens do Contato, histórico).
 */
export function marcadoresDeCanal<T extends { readonly channelId: Id }>(
  itens: readonly T[],
): Array<{ readonly tipo: "item"; readonly item: T } | { readonly tipo: "via"; readonly channelId: Id }> {
  const saida: Array<{ readonly tipo: "item"; readonly item: T } | { readonly tipo: "via"; readonly channelId: Id }> = [];
  let anterior: Id | undefined;
  for (const item of itens) {
    if (anterior !== undefined && item.channelId !== anterior) saida.push({ tipo: "via", channelId: item.channelId });
    saida.push({ tipo: "item", item });
    anterior = item.channelId;
  }
  return saida;
}

/** O que identifica a conta de um Canal além do nome: o provedor ("WhatsApp oficial") ou, sem provedor, o tipo. */
function rotuloDoProvedor(canal: Pick<Channel, "channelType" | "provider">): string {
  const provedor = provedorDoCanal(canal);
  return provedor !== undefined ? PROVEDORES[provedor].rotulo : ROTULO_DO_TIPO_DE_CANAL[canal.channelType];
}

/** "Comercial · WhatsApp oficial": o nome e o provedor, para o seletor "Responder por" e as abas. */
export function rotuloDoCanal(canal: Pick<Channel, "name" | "channelType" | "provider">): string {
  return `${canal.name} · ${rotuloDoProvedor(canal)}`;
}

/** "via Suporte (WhatsApp não oficial)": o texto do separador de troca de Canal. */
export function textoDoSeparadorDeCanal(canal: Pick<Channel, "name" | "channelType" | "provider">): string {
  return `via ${canal.name} (${rotuloDoProvedor(canal)})`;
}
