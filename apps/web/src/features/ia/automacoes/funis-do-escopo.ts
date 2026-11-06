"use client";

/** Esqueleto (RED, 15-21): os Funis do escopo ainda não vêm da api. */
import { inoperante } from "@n1/dominio/derive-ia";
import type { FunisDoEscopo } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import type { Automation } from "@n1/dominio/types";

export interface FunisParaAEscopo {
  readonly funis: FunisDoEscopo;
  readonly pronto: boolean;
}

export function useFunisDoEscopo(): FunisParaAEscopo {
  return { funis: [], pronto: false };
}

export function inoperanteComFunis(state: DataState, automation: Automation, _funis: FunisParaAEscopo): string | undefined {
  return inoperante(state, automation);
}
