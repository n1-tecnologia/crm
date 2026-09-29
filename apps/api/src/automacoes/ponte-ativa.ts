/**
 * O registro, no processo, da ponte do Agente que está rodando (D6-12): a
 * rota de operações cutuca a ponte depois de uma gravação numa conta, sem
 * evento de outbox — ponte e rota vivem no MESMO processo. Sem ponte
 * registrada (`AGENTE_CONTAS_A_PAGAR_ATIVO` desligado, ou nos testes da
 * rota), `cutucarPonte()` não faz nada. A ponte só é cutucada pela gravação
 * numa Tarefa do SEU par (Espaço, Lista); cutucar nunca lança exceção.
 */

import type { Id } from "@n1/dominio";

export interface PonteCutucavel {
  cutucar(): void;
}

export interface ParDaPonte {
  readonly workspaceId: Id;
  readonly listId: Id;
}

let registrada: { readonly ponte: PonteCutucavel; readonly par?: ParDaPonte } | undefined;

/** Guarda a ponte ativa (ou `undefined`, para desregistrar na desmontagem). */
export function registrarPonte(ponte: PonteCutucavel | undefined, par?: ParDaPonte): void {
  registrada = ponte ? { ponte, ...(par ? { par } : {}) } : undefined;
}

/** Pede um ciclo à ponte registrada, se a gravação foi no par dela. */
export function cutucarPonte(origem?: ParDaPonte): void {
  if (!registrada) return;
  const { ponte, par } = registrada;
  if (par && origem && (par.workspaceId !== origem.workspaceId || par.listId !== origem.listId)) return;
  try {
    ponte.cutucar();
  } catch {
    // A cutucada é um atalho; o relógio da ponte continua valendo.
  }
}
