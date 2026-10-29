import type { DataState } from "../state";
import type { Id } from "../types";

// RED (10-05): esqueleto sem regra — o corpo vem no commit GREEN.
export function listaTemAgendaPorVencimento(_state: DataState, _listId: Id): boolean {
  return false;
}

export type RegimeDaPrimeiraVolta = "ensaio" | "direto";

export function regimeDaPrimeiraVolta(_state: DataState, _listId: Id): RegimeDaPrimeiraVolta {
  return "direto";
}

export function atorDoRelogio(_state: DataState, _listId: Id, _preferidoId: Id | undefined): Id | undefined {
  return undefined;
}
