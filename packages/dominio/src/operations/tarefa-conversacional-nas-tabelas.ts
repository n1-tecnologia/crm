/**
 * A Tarefa conversacional (C35) sobre os ids das tabelas novas do CRM
 * (3.3.4 a 3.3.6). É o par de `tarefas-conversacionais.ts` para quem não tem o
 * CRM antigo no estado: Contato, Canal, Conversa e Negócio não são procurados no
 * estado, chegam em `referencias`, já lidos e conferidos pelo servidor dentro da
 * transação. A Tarefa continua só com Vínculos (`state.links`), e os Vínculos
 * nascem com `alvoConferido: true` para o `createTask` não procurar o alvo.
 *
 * Por que NÃO estão em `OPERACOES` (`registro.ts`): a referência é lida no
 * servidor. Registrar a operação a abriria em `POST /operacoes/:nome` com `args`
 * do corpo, e o navegador poderia dizer que o Contato "conferido" é qualquer
 * id, ou que o nome dele é outro. É o mesmo precedente das variantes
 * `…SemConferencia`: quem as chama é a rota `/tarefas-conversacionais` da api,
 * que confere Contato, Canal, Conversa e Negócio nas tabelas antes.
 *
 * A Mensagem da Conversa nunca entra no estado, e a operação NÃO abre Conversa:
 * quem a abre, em `plataforma.conversas`, é a api, no mesmo commit da Tarefa
 * (D-07). Aqui só se grava o Vínculo para o id que ela devolveu.
 *
 * As operações antigas saíram no corte da Fase 15 (D-01); este é o único caminho.
 */

import { taskWriteRefusal } from "../derive";
import { PAPEL_DO_VINCULO, listaConversacional, vinculosDoCrmDaTarefa } from "../derive-conversacional";
import type { ConexaoDoCanal } from "../crm/canais";
import type { TipoComProvedor } from "../provedores-de-canal";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { ActorRef, Id, Priority, Task, TaskDate } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { LISTA_SEM_CANAIS, canalForaDaListaNasTabelas } from "./canais";
import { createTask, listWriteRefusal } from "./tasks";

const now = (): string => new Date().toISOString();

const LISTA_OPERACIONAL = "Esta Lista é operacional: a Tarefa nasce pelo título, sem Contato.";

/** O que o servidor leu e conferiu nas tabelas antes de chamar a operação. */
export interface ReferenciasDaTarefaConversacional {
  readonly contato: { readonly id: Id; readonly nome: string };
  readonly canal: { readonly id: Id; readonly nome: string; readonly tipo: TipoComProvedor; readonly conexao: ConexaoDoCanal };
  /** A Conversa aberta pela api no Canal, ou a que já estava aberta. */
  readonly conversaId: Id;
  /** Um Negócio do Contato, quando já existe. */
  readonly negocio?: { readonly id: Id; readonly titulo: string };
}

export interface CriarTarefaConversacionalNasTabelasInput {
  readonly listId: Id;
  /** Ausente, o nome do Contato. */
  readonly title?: string;
  readonly statusId?: Id;
  readonly assignees?: readonly ActorRef[];
  readonly priority?: Priority;
  readonly dueDate?: TaskDate;
  /** Um dos Tipos que a Lista enxerga; sem ele, o padrão dela. */
  readonly taskTypeId?: Id;
}

/** Só o caso definitivo recusa: `com_erro` passa, porque pode voltar sozinho. */
const canalDesconectado = (nome: string): string => `O Canal ${nome} está desconectado: escolha outro Canal ou reconecte-o.`;

/**
 * Cria a Tarefa conversacional com os Vínculos para o Contato, a Conversa e,
 * se houver, o Negócio das `referencias`. Uma recusa de `createTask` (Status,
 * limite, permissão) desfaz Tarefa, Vínculos e Atividade: o estado volta igual.
 */
export function criarTarefaConversacionalNasTabelas(
  state: DataState,
  actingMemberId: Id,
  input: CriarTarefaConversacionalNasTabelasInput,
  referencias: ReferenciasDaTarefaConversacional,
): OperationResult<{ readonly task: Task }> {
  const list = state.lists.find((l) => l.id === input.listId);
  if (!list) return fail("Lista não encontrada.");
  if (!listaConversacional(state, list.id)) return fail(LISTA_OPERACIONAL, "lista");
  // C36 — sem canais de atendimento nada nasce: a barra mostra o mesmo motivo.
  if ((list.canaisDeAtendimento ?? []).length === 0) return fail(LISTA_SEM_CANAIS, "lista");
  // A mesma recusa que a barra da Lista mostra antes do clique.
  const criacao = listWriteRefusal(state, actingMemberId, list.id);
  if (criacao) return fail(criacao);
  // C36 — a conversa nasce por um canal de atendimento da Lista.
  const fora = canalForaDaListaNasTabelas(list, referencias.canal);
  if (fora) return fail(fora, "canal");
  if (referencias.canal.conexao === "desconectada") return fail(canalDesconectado(referencias.canal.nome), "canal");

  // Tudo o que este gesto cria, para desfazer se createTask recusar.
  const tasksAntes = state.tasks.length;
  const linksAntes = state.links.length;
  const activityAntes = state.activity.length;
  const desfazer = (): void => {
    state.tasks.splice(tasksAntes);
    state.links.splice(linksAntes);
    // recordActivity insere no início: o que entrou está na frente.
    state.activity.splice(0, state.activity.length - activityAntes);
  };

  const { contato, canal, conversaId, negocio } = referencias;
  const nascida = createTask(state, actingMemberId, {
    listId: list.id,
    title: input.title?.trim() || contato.nome,
    ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.taskTypeId !== undefined ? { taskTypeId: input.taskTypeId } : {}),
    assignees: input.assignees ?? [memberActor(actingMemberId)],
    vinculos: [
      { toType: "contact", toId: contato.id, role: PAPEL_DO_VINCULO.contato, alvoConferido: true },
      { toType: "conversation", toId: conversaId, role: PAPEL_DO_VINCULO.conversa, alvoConferido: true },
      ...(negocio ? [{ toType: "deal" as const, toId: negocio.id, role: PAPEL_DO_VINCULO.negocio, alvoConferido: true as const }] : []),
    ],
  });
  if (!nascida.ok) {
    desfazer();
    return nascida;
  }
  const task = nascida.value;
  task.provenance = { kind: "contact", sourceId: contato.id, sourceName: contato.nome, at: now() };
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Tarefa vinculada ao Contato",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: `${contato.nome} · ${canal.nome}`,
  });
  return ok({ task }, task.id);
}

/** A Tarefa conversacional que a operação vai escrever, ou a frase da recusa. */
function tarefaConversacionalNasTabelas(state: DataState, actingMemberId: Id, taskId: Id): Task | string {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return "Tarefa não encontrada.";
  const escrita = taskWriteRefusal(state, actingMemberId, taskId);
  if (escrita) return escrita;
  if (!listaConversacional(state, task.listId)) return LISTA_OPERACIONAL;
  if (vinculosDoCrmDaTarefa(state, task).contatoId === undefined) return "Esta Tarefa não tem Contato vinculado.";
  return task;
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
 * Trocar o Canal é trocar a Conversa vinculada: a Tarefa não guarda Canal. A
 * Conversa antiga fica onde está (na Caixa de Entrada); só o Vínculo sai. A
 * Conversa nova, a api já a abriu (ou reaproveitou) e passa em `conversaId`.
 */
export function trocarCanalDaTarefaNasTabelas(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  referencias: {
    readonly canal: ReferenciasDaTarefaConversacional["canal"];
    readonly conversaId: Id;
    /** O nome do Canal da Conversa que sai, para a Atividade. */
    readonly canalAnterior?: { readonly nome: string };
  },
): OperationResult<{ readonly task: Task; readonly mudou: boolean }> {
  const alvo = tarefaConversacionalNasTabelas(state, actingMemberId, taskId);
  if (typeof alvo === "string") return fail(alvo);
  const task = alvo;
  const { canal, conversaId, canalAnterior } = referencias;
  // C36 — trocar é abrir a conversa por outro canal: tem de ser um da Lista.
  const lista = state.lists.find((l) => l.id === task.listId);
  const fora = lista ? canalForaDaListaNasTabelas(lista, canal) : undefined;
  if (fora) return fail(fora, "canal");
  if (canal.conexao === "desconectada") return fail(canalDesconectado(canal.nome), "canal");

  if (vinculosDoCrmDaTarefa(state, task).conversaId === conversaId) return ok({ task, mudou: false });

  removerVinculos(state, task.id, "conversation");
  state.links.push({
    id: nextId("lnk"),
    fromType: "task",
    fromId: task.id,
    toType: "conversation",
    toId: conversaId,
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
    ...(canalAnterior ? { before: canalAnterior.nome } : {}),
    after: canal.nome,
  });
  return ok({ task, mudou: true }, task.id);
}

/**
 * Liga (ou, com `null`, desliga) o Negócio da Tarefa. Que o Negócio é do
 * Contato dela, quem confere é a api. `anterior` é o título do Negócio que sai,
 * para a Atividade.
 */
export function vincularNegocioATarefaNasTabelas(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  negocio: { readonly id: Id; readonly titulo: string } | null,
  anterior?: { readonly titulo: string },
): OperationResult<Task> {
  const alvo = tarefaConversacionalNasTabelas(state, actingMemberId, taskId);
  if (typeof alvo === "string") return fail(alvo);
  const task = alvo;
  // Só o Vínculo com o papel "Negócio da Tarefa" entra e sai por aqui: o
  // espelho de "Meus negócios" não se desfaz nesta porta.
  const vinculoAtual = state.links.find(
    (l) => l.fromType === "task" && l.fromId === task.id && l.toType === "deal" && l.role === PAPEL_DO_VINCULO.negocio,
  );
  if (negocio === null) {
    if (!vinculoAtual) return ok(task);
    removerVinculos(state, task.id, "deal", PAPEL_DO_VINCULO.negocio);
    task.updatedAt = now();
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Negócio desvinculado da Tarefa",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
      ...(anterior ? { before: anterior.titulo } : {}),
    });
    return ok(task, task.id);
  }
  if (vinculoAtual?.toId === negocio.id) return ok(task);
  removerVinculos(state, task.id, "deal", PAPEL_DO_VINCULO.negocio);
  state.links.push({
    id: nextId("lnk"),
    fromType: "task",
    fromId: task.id,
    toType: "deal",
    toId: negocio.id,
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
    ...(anterior ? { before: anterior.titulo } : {}),
    after: negocio.titulo,
  });
  return ok(task, task.id);
}

/**
 * Liga à Tarefa o Negócio que a api acabou de criar do Contato dela. Recusa se
 * a Tarefa já tem Negócio vinculado, como a antiga; a criação do Negócio em si
 * (na 1ª Etapa do Funil) é da api, e se esta recusa, a transação dela desfaz.
 */
export function ligarNegocioNovoATarefaNasTabelas(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  negocio: { readonly id: Id; readonly titulo: string },
): OperationResult<Task> {
  const alvo = tarefaConversacionalNasTabelas(state, actingMemberId, taskId);
  if (typeof alvo === "string") return fail(alvo);
  if (vinculosDoCrmDaTarefa(state, alvo).negocioId !== undefined) return fail("Esta Tarefa já tem Negócio vinculado.");
  const ligada = vincularNegocioATarefaNasTabelas(state, actingMemberId, taskId, negocio);
  return ligada.ok ? ok(ligada.value, negocio.id) : ligada;
}
