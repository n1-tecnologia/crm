/**
 * A recusa comum às operações de gestão de usuários da Sessão 12 (Papéis,
 * Equipes, suspensão): só um Administrador ou o Proprietário ATIVO age. É a
 * mesma régua de `removeMember` depois da 09-21 (Papel base mais o estado de
 * quem chama).
 */

import type { DataState } from "../state";
import type { Id } from "../types";

/** `oQue` completa a frase: "Só um Administrador ou o Proprietário ativo <oQue>." */
export function recusaDeGovernanca(state: DataState, actingMemberId: Id, oQue: string): string | undefined {
  const acting = state.members.find((m) => m.id === actingMemberId);
  const base = state.roles.find((r) => r.id === acting?.roleId)?.base;
  if (acting?.state === "ativo" && (base === "administrador" || base === "proprietario")) return undefined;
  return `Só um Administrador ou o Proprietário ativo ${oQue}.`;
}
