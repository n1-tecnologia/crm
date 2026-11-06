/**
 * Leituras derivadas da Tarefa conversacional (C35). A Tarefa não guarda
 * Contato, Conversa nem Negócio em campo próprio: aponta para o CRM só por
 * Vínculos (`Link`, RN-TAR-15). Nada aqui é gravado; tudo é recomputado do
 * estado a cada leitura.
 *
 * Fase 15 (15-42, 3.5.4): as leituras que procuravam o Contato, a Conversa, o Canal e o
 * Negócio nas coleções do CRM antigo do estado saíram. Quem precisa dessas entidades lê as tabelas do CRM novo pela api; aqui ficam os
 * ids dos Vínculos (`vinculosDoCrmDaTarefa`) e os Canais da Lista sobre os Canais que a
 * api leu (`...NasTabelas`).
 */

import type { DataState } from "./state";
import type { ChannelType, ProvedorDeCanal } from "./crm/capacidades";
import type { Id, Link, List, ModeloDeTarefa, Task } from "./types";
import type { Canal } from "./crm/canais";
import type { IdentificadorDeContato } from "./crm/contatos";
import { TIPO_DE_IDENTIFICADOR_DO_CANAL } from "./crm/conversas";
import { ROTULO_DO_TIPO_DE_CANAL } from "./operations/canais";
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

/** As Tarefas conversacionais ativas do Contato, a mais recente primeiro. */
export function tarefasConversacionaisDoContato(state: DataState, contactId: Id): Task[] {
  const vinculadas = new Set(
    state.links.filter((l) => l.fromType === "task" && l.toType === "contact" && l.toId === contactId).map((l) => l.fromId),
  );
  return state.tasks
    .filter((t) => t.lifecycle === "ativo" && vinculadas.has(t.id) && listaConversacional(state, t.listId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Os ids do CRM novo a que a Tarefa conversacional aponta, lidos só dos Vínculos. */
export interface VinculosDoCrmDaTarefa {
  readonly contatoId?: Id;
  readonly conversaId?: Id;
  readonly negocioId?: Id;
}

/**
 * A Tarefa conversacional lida por ids (3.3.2): o primeiro Vínculo de cada tipo,
 * o do papel "… da Tarefa" na frente, e a Subtarefa lendo a raiz. Só `state.links`
 * e `state.tasks` entram: quem confere se o alvo existe nas tabelas, se está na
 * lixeira ou se é um `mesclado` (que responde pelo sobrevivente) é a api, e é por
 * isso que esta leitura passa num estado sem Contato, Conversa, Canal nem Negócio.
 */
export function vinculosDoCrmDaTarefa(state: DataState, task: Task): VinculosDoCrmDaTarefa {
  const primeiro = (toType: Link["toType"], papel: string): Id | undefined => {
    for (const alvo of alvosDe(state, task)) {
      const link = vinculosDaTarefa(state, alvo, toType, papel)[0];
      if (link) return link.toId;
    }
    return undefined;
  };
  const contatoId = primeiro("contact", PAPEL_DO_VINCULO.contato);
  const conversaId = primeiro("conversation", PAPEL_DO_VINCULO.conversa);
  const negocioId = primeiro("deal", PAPEL_DO_VINCULO.negocio);
  return {
    ...(contatoId !== undefined ? { contatoId } : {}),
    ...(conversaId !== undefined ? { conversaId } : {}),
    ...(negocioId !== undefined ? { negocioId } : {}),
  };
}

type ListaComCanais = Pick<List, "modeloDeTarefa" | "canaisDeAtendimento">;

/**
 * Os canais de atendimento da Lista sobre os Canais das tabelas novas: só os
 * `ativo`, na ordem em que foram marcados. Vazio para a Lista operacional e
 * para a conversacional que ainda não os configurou.
 */
export function canaisDaListaNasTabelas(list: ListaComCanais | undefined, canais: readonly Canal[]): Canal[] {
  if (!list || list.modeloDeTarefa !== "conversacional") return [];
  return (list.canaisDeAtendimento ?? [])
    .map((id) => canais.find((c) => c.id === id))
    .filter((c): c is Canal => c !== undefined && c.estado === "ativo");
}

/**
 * Os canais da Lista que alcançam algum Identificador do Contato, pelo tipo do
 * Identificador que cada tipo de Canal resolve.
 */
export function canaisDaListaQueAlcancamNasTabelas(
  list: ListaComCanais | undefined,
  canais: readonly Canal[],
  identificadores: readonly Pick<IdentificadorDeContato, "tipo">[] | undefined,
): Canal[] {
  const daLista = canaisDaListaNasTabelas(list, canais);
  if (!identificadores) return daLista;
  return daLista.filter((c) => identificadores.some((i) => i.tipo === TIPO_DE_IDENTIFICADOR_DO_CANAL[c.tipo]));
}

/** A Lista conversacional ainda sem canais de atendimento ativos: nada nasce nela até configurá-los. */
export function listaSemCanaisNasTabelas(list: ListaComCanais | undefined, canais: readonly Canal[]): boolean {
  return list?.modeloDeTarefa === "conversacional" && canaisDaListaNasTabelas(list, canais).length === 0;
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

/** O que o rótulo de um Canal lê: o tipo e, quando há, o provedor (o `Canal` de `plataforma.canais` traz os dois por (`tipo`, `provedor`); aqui o nome do campo é o do modelo em inglês das Capacidades). */
interface CanalComTipo {
  readonly channelType: ChannelType;
  readonly provider?: ProvedorDeCanal;
}
interface CanalComNome extends CanalComTipo {
  readonly name: string;
}

/** O que identifica a conta de um Canal além do nome: o provedor ("WhatsApp oficial") ou, sem provedor, o tipo. */
function rotuloDoProvedor(canal: CanalComTipo): string {
  const provedor = provedorDoCanal(canal);
  return provedor !== undefined ? PROVEDORES[provedor].rotulo : ROTULO_DO_TIPO_DE_CANAL[canal.channelType];
}

/** "Comercial · WhatsApp oficial": o nome e o provedor, para o seletor "Responder por" e as abas. */
export function rotuloDoCanal(canal: CanalComNome): string {
  return `${canal.name} · ${rotuloDoProvedor(canal)}`;
}

/** "via Suporte (WhatsApp não oficial)": o texto do separador de troca de Canal. */
export function textoDoSeparadorDeCanal(canal: CanalComNome): string {
  return `via ${canal.name} (${rotuloDoProvedor(canal)})`;
}
