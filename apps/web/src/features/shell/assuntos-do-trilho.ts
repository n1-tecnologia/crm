/**
 * Fase 9, D-03 — quais assuntos do trilho cada Membro vê. O item some, nunca
 * aparece desativado (o mesmo mecanismo do Financeiro, `vePastaFinanceiro`).
 * Quem decide de verdade é o servidor, que não manda as coleções de IA ao
 * Convidado (D-02, 09-02); esconder o assunto aqui é só a consequência visual.
 */

import type { DataState } from "@n1/dominio/state";
import type { Id } from "@n1/dominio/types";

/** Papel base `convidado` — a mesma leitura de `isGuest` em `app-shell.tsx`. */
export function ehConvidado(estado: DataState, memberId: Id | null | undefined): boolean {
  if (!memberId) return false;
  const membro = estado.members.find((m) => m.id === memberId);
  return estado.roles.find((r) => r.id === membro?.roleId)?.base === "convidado";
}

/** Falso só para o Convidado. Sem Membro resolvido (antes da sessão) nada some à toa. */
export function veAssuntoIa(estado: DataState, memberId: Id | null | undefined): boolean {
  return !ehConvidado(estado, memberId);
}
