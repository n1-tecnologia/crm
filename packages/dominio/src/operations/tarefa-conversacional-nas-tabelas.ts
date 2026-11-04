/**
 * A Tarefa conversacional sobre ids das tabelas novas (3.3.4 a 3.3.6).
 * Esqueleto do RED: as quatro operações ainda não fazem nada.
 */

import type { OperationResult } from "../state";
import type { ConexaoDoCanal } from "../crm/canais";
import type { TipoComProvedor } from "../provedores-de-canal";
import type { ActorRef, Id, Priority, Task, TaskDate } from "../types";
import type { DataState } from "../state";

export interface ReferenciasDaTarefaConversacional {
  readonly contato: { readonly id: Id; readonly nome: string };
  readonly canal: { readonly id: Id; readonly nome: string; readonly tipo: TipoComProvedor; readonly conexao: ConexaoDoCanal };
  readonly conversaId: Id;
  readonly negocio?: { readonly id: Id; readonly titulo: string };
}

export interface CriarTarefaConversacionalNasTabelasInput {
  readonly listId: Id;
  readonly title?: string;
  readonly statusId?: Id;
  readonly assignees?: readonly ActorRef[];
  readonly priority?: Priority;
  readonly dueDate?: TaskDate;
  readonly taskTypeId?: Id;
}

const naoImplementado = (): never => {
  throw new Error("não implementado");
};

export function criarTarefaConversacionalNasTabelas(
  _state: DataState,
  _actingMemberId: Id,
  _input: CriarTarefaConversacionalNasTabelasInput,
  _referencias: ReferenciasDaTarefaConversacional,
): OperationResult<{ readonly task: Task }> {
  return naoImplementado();
}

export function trocarCanalDaTarefaNasTabelas(
  _state: DataState,
  _actingMemberId: Id,
  _taskId: Id,
  _referencias: {
    readonly canal: ReferenciasDaTarefaConversacional["canal"];
    readonly conversaId: Id;
    readonly canalAnterior?: { readonly nome: string };
  },
): OperationResult<{ readonly task: Task; readonly mudou: boolean }> {
  return naoImplementado();
}

export function vincularNegocioATarefaNasTabelas(
  _state: DataState,
  _actingMemberId: Id,
  _taskId: Id,
  _negocio: { readonly id: Id; readonly titulo: string } | null,
  _anterior?: { readonly titulo: string },
): OperationResult<Task> {
  return naoImplementado();
}

export function ligarNegocioNovoATarefaNasTabelas(
  _state: DataState,
  _actingMemberId: Id,
  _taskId: Id,
  _negocio: { readonly id: Id; readonly titulo: string },
): OperationResult<Task> {
  return naoImplementado();
}
