/**
 * A Tarefa conversacional (C35): a Tarefa da Lista comercial, que nasce de um
 * Contato e carrega a conversa dele. Ela não tem campo novo — aponta para o
 * CRM só por Vínculos (Contato, Conversa, Negócio opcional), e o Canal vem da
 * Conversa vinculada.
 *
 * Um gesto, dois atos do domínio, na ordem em que as regras valem:
 *   1. a Conversa abre no Canal (startConversation — ou a que já está aberta);
 *   2. a Tarefa nasce na Lista com os Vínculos (createTask, um só escritor).
 * Recusado o segundo, o primeiro é desfeito — o Membro não fica com uma
 * Conversa órfã de uma Tarefa que não existe.
 *
 * Também mora aqui o modelo da Lista: `alterarModeloDaLista` só enquanto ela
 * não tem Tarefa nenhuma, porque uma Tarefa operacional numa Lista que virou
 * conversacional quebraria a ficha, e o inverso esconderia o fio.
 */

import { containerAdminRefusal, contactDisplayName, taskWriteRefusal } from "../derive";
import { PAPEL_DO_VINCULO, contatoDaTarefa, conversaDaTarefa, listaConversacional, listaSemCanais, negocioDaTarefa } from "../derive-conversacional";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { ActorRef, Contact, Conversation, Deal, Id, List, ModeloDeTarefa, Money, Priority, Task, TaskDate } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { CANAIS_SO_NA_CONVERSACIONAL, LISTA_SEM_CANAIS, canalForaDaLista, validarCanaisDeAtendimento } from "./canais";
import { startConversation } from "./conversations";
import { nomesDosCanais } from "./structure";
import { createDeal } from "./deals";
import { createTask, listWriteRefusal } from "./tasks";

const now = (): string => new Date().toISOString();

const NEGOCIO_DE_OUTRO_CONTATO = "Este Negócio não é deste Contato.";

/**
 * Um Formulário público cria Tarefa sem Contato — o que a Lista conversacional
 * recusa (FORMULARIO_EM_LISTA_CONVERSACIONAL). Virar conversacional com
 * Formulário ativo deixaria o link no ar recusando todo envio.
 */
export const FORMULARIOS_ANTES_DO_MODELO = "Arquive os Formulários antes: nesta Lista a Tarefa nasce de um Contato.";

/** A Lista tem Formulário ativo — o que impede o modelo conversacional. */
export function temFormularioAtivo(state: DataState, listId: Id): boolean {
  return state.forms.some((f) => f.listId === listId && f.lifecycle === "ativo");
}

/** Tira do estado os Vínculos que SAEM da Tarefa para um tipo de alvo (e papel), no lugar. */
function removerVinculos(state: DataState, taskId: Id, toType: "conversation" | "deal", papel?: string): void {
  for (let i = state.links.length - 1; i >= 0; i -= 1) {
    const l = state.links[i];
    if (l && l.fromType === "task" && l.fromId === taskId && l.toType === toType && (papel === undefined || l.role === papel)) {
      state.links.splice(i, 1);
    }
  }
}

/**
 * O modelo de Tarefa da Lista muda só enquanto ela está vazia — contam até as
 * Tarefas na lixeira, porque restaurá-las traria o modelo errado de volta. E
 * virar conversacional exige que nenhum Formulário esteja ativo: o envio
 * anônimo não traz Contato, e o link ficaria no ar recusando tudo.
 */
export function alterarModeloDaLista(
  state: DataState,
  actingMemberId: Id,
  listId: Id,
  modelo: ModeloDeTarefa,
): OperationResult<List> {
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return fail("Lista não encontrada.");
  const refusal = containerAdminRefusal(state, actingMemberId, "list", listId);
  if (refusal) return fail(refusal);
  if (list.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não muda de configuração.");
  if (list.modeloDeTarefa === modelo) return ok(list);
  if (state.tasks.some((t) => t.listId === listId)) {
    return fail("O modelo de Tarefa não muda numa Lista que já tem Tarefas.");
  }
  if (modelo === "conversacional" && temFormularioAtivo(state, listId)) {
    return fail(FORMULARIOS_ANTES_DO_MODELO);
  }
  const anterior = list.modeloDeTarefa;
  list.modeloDeTarefa = modelo;
  // C36 — a operacional não tem canais de atendimento: o que sobrou seria lixo
  // invisível. A que vira conversacional nasce sem canais, e a tela avisa.
  if (modelo === "operacional") delete list.canaisDeAtendimento;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Modelo de Tarefa alterado",
    objectType: "list",
    objectId: list.id,
    objectName: list.name,
    before: anterior,
    after: modelo,
  });
  return ok(list, list.id);
}

/**
 * C36 — os canais de atendimento da Lista conversacional, a qualquer momento:
 * as Tarefas já criadas continuam com a conversa que têm; os canais governam
 * onde a próxima conversa nasce. Ao menos um, todos ativos e de um tipo de
 * atendimento — a mesma validação com que a Lista nasce.
 */
export function definirCanaisDaLista(
  state: DataState,
  actingMemberId: Id,
  listId: Id,
  ids: readonly Id[],
): OperationResult<List> {
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return fail("Lista não encontrada.");
  const refusal = containerAdminRefusal(state, actingMemberId, "list", listId);
  if (refusal) return fail(refusal);
  if (list.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não muda de configuração.");
  if (list.modeloDeTarefa !== "conversacional") return fail(CANAIS_SO_NA_CONVERSACIONAL, "canais");
  const validos = validarCanaisDeAtendimento(state, ids);
  if (typeof validos === "string") return fail(validos, "canais");
  const atuais = list.canaisDeAtendimento ?? [];
  if (atuais.length === validos.ids.length && atuais.every((id, i) => id === validos.ids[i])) return ok(list);
  list.canaisDeAtendimento = validos.ids;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Canais de atendimento alterados",
    objectType: "list",
    objectId: list.id,
    objectName: list.name,
    before: atuais.length ? nomesDosCanais(state, atuais) : "nenhum",
    after: nomesDosCanais(state, validos.ids),
  });
  return ok(list, list.id);
}

export interface CriarTarefaConversacionalInput {
  readonly listId: Id;
  readonly contactId: Id;
  readonly channelId: Id;
  /** Ausente, o nome do Contato. */
  readonly title?: string;
  readonly statusId?: Id;
  readonly assignees?: readonly ActorRef[];
  readonly priority?: Priority;
  readonly dueDate?: TaskDate;
  /** Um Negócio do Contato, quando já existe. */
  readonly dealId?: Id;
  /** Um dos Tipos que a Lista enxerga; sem ele, o padrão dela. */
  readonly taskTypeId?: Id;
}

/** O Negócio existe, está ativo e tem o Contato entre os seus (item 5 do gesto). */
function negocioDoContato(state: DataState, dealId: Id, contactId: Id): Deal | string {
  const deal = state.deals.find((d) => d.id === dealId && d.lifecycle === "ativo");
  if (!deal || !deal.contactLinks.some((l) => l.contactId === contactId)) return NEGOCIO_DE_OUTRO_CONTATO;
  return deal;
}

export function criarTarefaConversacional(
  state: DataState,
  actingMemberId: Id,
  input: CriarTarefaConversacionalInput,
): OperationResult<{ readonly task: Task; readonly conversation: Conversation }> {
  const list = state.lists.find((l) => l.id === input.listId);
  if (!list) return fail("Lista não encontrada.");
  if (!listaConversacional(state, list.id)) {
    return fail("Esta Lista é operacional: a Tarefa nasce pelo título, sem Contato.", "lista");
  }
  // C36 — sem canais de atendimento nada nasce: a barra mostra o mesmo motivo.
  if (listaSemCanais(state, list.id)) return fail(LISTA_SEM_CANAIS, "lista");
  // A mesma recusa que a barra da Lista mostra antes do clique.
  const criacao = listWriteRefusal(state, actingMemberId, list.id);
  if (criacao) return fail(criacao);
  const contact = state.contacts.find((c) => c.id === input.contactId && c.lifecycle === "ativo");
  if (!contact) return fail("Escolha um Contato ativo.", "contato");
  const channel = state.channels.find((c) => c.id === input.channelId && c.lifecycle === "ativo");
  if (!channel) return fail("Escolha o Canal em que a conversa acontece.", "canal");
  // C36 — a conversa nasce por um canal de atendimento da Lista.
  const fora = canalForaDaLista(state, list, channel);
  if (fora) return fail(fora, "canal");
  // Só o caso definitivo recusa: `comErro` passa, porque pode voltar sozinho.
  if (channel.connection === "desconectada") {
    return fail(`O Canal ${channel.name} está desconectado: escolha outro Canal ou reconecte-o.`, "canal");
  }
  let deal: Deal | undefined;
  if (input.dealId !== undefined) {
    const encontrado = negocioDoContato(state, input.dealId, contact.id);
    if (typeof encontrado === "string") return fail(encontrado, "negocio");
    deal = encontrado;
  }

  // Tudo o que este gesto cria, para desfazer se um ato recusar.
  const tasksAntes = state.tasks.length;
  const linksAntes = state.links.length;
  const conversationsAntes = state.conversations.length;
  const activityAntes = state.activity.length;
  const desfazer = () => {
    state.tasks.splice(tasksAntes);
    state.links.splice(linksAntes);
    state.conversations.splice(conversationsAntes);
    // recordActivity insere no início: o que entrou está na frente.
    state.activity.splice(0, state.activity.length - activityAntes);
  };

  // 1) a Conversa — a que já está aberta neste Canal, ou uma nova. É ela que
  // recusa o Contato sem Identificador que o Canal alcance.
  const conversa = startConversation(state, actingMemberId, channel.id, contact.id);
  if (!conversa.ok) return conversa;
  const conversation = conversa.value;

  // 2) a Tarefa, com os Vínculos de nascimento — a recusa da Lista
  // (permissão, Status, limite) é a mesma frase da tela.
  const nascida = createTask(state, actingMemberId, {
    listId: list.id,
    title: input.title?.trim() || contactDisplayName(contact),
    ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.taskTypeId !== undefined ? { taskTypeId: input.taskTypeId } : {}),
    assignees: input.assignees ?? [memberActor(actingMemberId)],
    vinculos: [
      { toType: "contact", toId: contact.id, role: PAPEL_DO_VINCULO.contato },
      { toType: "conversation", toId: conversation.id, role: PAPEL_DO_VINCULO.conversa },
      ...(deal ? [{ toType: "deal" as const, toId: deal.id, role: PAPEL_DO_VINCULO.negocio }] : []),
    ],
  });
  if (!nascida.ok) {
    desfazer();
    return nascida;
  }
  const task = nascida.value;
  task.provenance = { kind: "contact", sourceId: contact.id, sourceName: contactDisplayName(contact), at: now() };
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tarefa vinculada ao Contato",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: `${contactDisplayName(contact)} · ${channel.name}`,
  });
  return ok({ task, conversation }, task.id);
}

/** A Tarefa conversacional que a operação vai escrever, ou a frase da recusa. */
function tarefaConversacional(state: DataState, actingMemberId: Id, taskId: Id): { task: Task; contact: Contact } | string {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return "Tarefa não encontrada.";
  const escrita = taskWriteRefusal(state, actingMemberId, taskId);
  if (escrita) return escrita;
  if (!listaConversacional(state, task.listId)) return "Esta Lista é operacional: a Tarefa nasce pelo título, sem Contato.";
  const contact = contatoDaTarefa(state, task);
  if (!contact) return "Esta Tarefa não tem Contato vinculado.";
  return { task, contact };
}

/**
 * Trocar o Canal é trocar a Conversa vinculada: a Tarefa não guarda Canal.
 * A Conversa antiga fica onde está (na Caixa de Entrada); só o Vínculo sai.
 */
export function trocarCanalDaTarefa(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  channelId: Id,
): OperationResult<{ readonly task: Task; readonly conversation: Conversation }> {
  const alvo = tarefaConversacional(state, actingMemberId, taskId);
  if (typeof alvo === "string") return fail(alvo);
  const { task, contact } = alvo;
  const channel = state.channels.find((c) => c.id === channelId && c.lifecycle === "ativo");
  if (!channel) return fail("Escolha o Canal em que a conversa acontece.", "canal");
  // C36 — trocar é abrir a conversa por outro canal: tem de ser um da Lista.
  const listaDaTarefa = state.lists.find((l) => l.id === task.listId);
  const fora = listaDaTarefa ? canalForaDaLista(state, listaDaTarefa, channel) : undefined;
  if (fora) return fail(fora, "canal");
  if (channel.connection === "desconectada") {
    return fail(`O Canal ${channel.name} está desconectado: escolha outro Canal ou reconecte-o.`, "canal");
  }
  const anterior = conversaDaTarefa(state, task);
  const canalAnterior = anterior ? state.channels.find((c) => c.id === anterior.channelId) : undefined;

  const conversa = startConversation(state, actingMemberId, channel.id, contact.id);
  if (!conversa.ok) return conversa;
  const conversation = conversa.value;
  if (anterior?.id === conversation.id) return ok({ task, conversation });

  removerVinculos(state, task.id, "conversation");
  state.links.push({
    id: nextId("lnk"),
    fromType: "task",
    fromId: task.id,
    toType: "conversation",
    toId: conversation.id,
    role: PAPEL_DO_VINCULO.conversa,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  });
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Canal da Tarefa alterado",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    ...(canalAnterior ? { before: canalAnterior.name } : {}),
    after: channel.name,
  });
  return ok({ task, conversation }, task.id);
}

/** Liga (ou, com `null`, desliga) o Negócio da Tarefa — sempre um Negócio do Contato dela. */
export function vincularNegocioATarefa(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  dealId: Id | null,
): OperationResult<Task> {
  const alvo = tarefaConversacional(state, actingMemberId, taskId);
  if (typeof alvo === "string") return fail(alvo);
  const { task, contact } = alvo;
  // Só o Vínculo com o papel "Negócio da Tarefa" entra e sai por aqui: o
  // espelho de "Meus negócios" ("espelho do Negócio") não se desfaz nesta porta.
  const vinculoAtual = state.links.find((l) => l.fromType === "task" && l.fromId === task.id && l.toType === "deal" && l.role === PAPEL_DO_VINCULO.negocio);
  const atual = vinculoAtual ? state.deals.find((d) => d.id === vinculoAtual.toId) : undefined;
  if (dealId === null) {
    if (!vinculoAtual) return ok(task);
    removerVinculos(state, task.id, "deal", PAPEL_DO_VINCULO.negocio);
    task.updatedAt = now();
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Negócio desvinculado da Tarefa",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
      ...(atual ? { before: atual.title } : {}),
    });
    return ok(task, task.id);
  }
  const encontrado = negocioDoContato(state, dealId, contact.id);
  if (typeof encontrado === "string") return fail(encontrado, "negocio");
  const deal = encontrado;
  if (vinculoAtual?.toId === deal.id) return ok(task);
  removerVinculos(state, task.id, "deal", PAPEL_DO_VINCULO.negocio);
  state.links.push({
    id: nextId("lnk"),
    fromType: "task",
    fromId: task.id,
    toType: "deal",
    toId: deal.id,
    role: PAPEL_DO_VINCULO.negocio,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  });
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Negócio vinculado à Tarefa",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    ...(atual ? { before: atual.title } : {}),
    after: deal.title,
  });
  return ok(task, task.id);
}

/** O Negócio nasce do Contato da Tarefa (createDeal, na 1ª Etapa do Funil) e já vinculado a ela. */
export function criarNegocioDaTarefa(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  input: { readonly funnelId: Id; readonly title?: string; readonly value?: Money },
): OperationResult<{ readonly task: Task; readonly deal: Deal }> {
  const alvo = tarefaConversacional(state, actingMemberId, taskId);
  if (typeof alvo === "string") return fail(alvo);
  const { task, contact } = alvo;
  if (negocioDaTarefa(state, task)) return fail("Esta Tarefa já tem Negócio vinculado.");

  const dealsAntes = state.deals.length;
  const linksAntes = state.links.length;
  const activityAntes = state.activity.length;
  const nascido = createDeal(state, actingMemberId, {
    title: input.title?.trim() || task.title,
    funnelId: input.funnelId,
    contactId: contact.id,
    ...(input.value ? { value: input.value } : {}),
  });
  if (!nascido.ok) return nascido;
  const deal = nascido.value;
  const vinculado = vincularNegocioATarefa(state, actingMemberId, task.id, deal.id);
  if (!vinculado.ok) {
    state.deals.splice(dealsAntes);
    state.links.splice(linksAntes);
    state.activity.splice(0, state.activity.length - activityAntes);
    return fail(vinculado.error);
  }
  return ok({ task, deal }, deal.id);
}
