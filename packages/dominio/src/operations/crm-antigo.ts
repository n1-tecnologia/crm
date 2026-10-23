/**
 * Esqueleto da fase RED (1.2.2): a função existe para os testes importarem e
 * falharem na asserção, não no import. Nunca recusa — o GREEN a implementa.
 */
import type { DataState } from "../state";
import type { Id } from "../types";

export function recusaDeEscritaNoCrmAntigo(_state: DataState, _actingMemberId: Id): string | undefined {
  return undefined;
}
