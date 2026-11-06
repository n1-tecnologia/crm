"use client";

/**
 * Esqueleto do RED (15-37): só as assinaturas, para o import do teste não ser
 * falha de carga. A implementação vem no GREEN.
 */

import type { ActivityRecord } from "@n1/dominio/types/primitives";

export function chaveDeAtividades(_filtro: { readonly objetoTipo?: string; readonly objetoId?: string; readonly limite?: number; readonly ate?: string }): string {
  throw new Error("nao implementado");
}

export function useAtividades(_alvo: { readonly tipo: string; readonly id: string }): { readonly atividades: ActivityRecord[] } {
  throw new Error("nao implementado");
}

export function useAtividadesDoCrm(_filtro: { readonly limite?: number; readonly ate?: string }): unknown {
  throw new Error("nao implementado");
}
