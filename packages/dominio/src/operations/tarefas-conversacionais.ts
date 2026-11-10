/**
 * O modelo da Lista conversacional (C35, C36): `alterarModeloDaLista` só enquanto
 * ela não tem Tarefa nenhuma, porque uma Tarefa operacional numa Lista que virou
 * conversacional quebraria a ficha, e o inverso esconderia o fio; e
 * `definirCanaisDaLista`, os canais de atendimento dela.
 *
 * A Tarefa conversacional em si (criar, trocar o Canal, ligar ou criar o Negócio)
 * não mora mais aqui: nasce e muda só pelas rotas `/tarefas-conversacionais` da
 * api, pelas operações `…NasTabelas` de `tarefa-conversacional-nas-tabelas.ts`,
 * que recebem Contato, Canal, Conversa e Negócio já conferidos nas tabelas do CRM.
 * As quatro operações antigas, que os conferiam no estado do navegador, saíram do
 * registro no 14-17 (só no deploy da Fase 15).
 */

import { containerAdminRefusal } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Id, List, ModeloDeTarefa } from "../types";
import type { Canal } from "../crm/canais";
import { memberActor, recordActivity } from "./activity";
import { CANAIS_SO_NA_CONVERSACIONAL, validarCanaisDeAtendimento } from "./canais";
import { nomesDosCanais } from "./structure";

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
 *
 * 3.3.7 — `canais` são os Canais de `plataforma.canais` que o servidor leu na
 * transação (`lerDoCrm`); quem os preenche é o servidor, nunca o navegador.
 */
export function definirCanaisDaLista(
  state: DataState,
  actingMemberId: Id,
  listId: Id,
  ids: readonly Id[],
  canais?: readonly Canal[],
): OperationResult<List> {
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return fail("Lista não encontrada.");
  const refusal = containerAdminRefusal(state, actingMemberId, "list", listId);
  if (refusal) return fail(refusal);
  if (list.lifecycle !== "ativo") return fail("Um contêiner arquivado ou na lixeira não muda de configuração.");
  if (list.modeloDeTarefa !== "conversacional") return fail(CANAIS_SO_NA_CONVERSACIONAL, "canais");
  const validos = validarCanaisDeAtendimento(state, ids, canais);
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
    before: atuais.length ? nomesDosCanais(state, atuais, canais) : "nenhum",
    after: nomesDosCanais(state, validos.ids, canais),
  });
  return ok(list, list.id);
}
