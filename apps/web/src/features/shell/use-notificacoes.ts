"use client";

/**
 * Esqueleto do RED de 15-14: o corpo vem no GREEN.
 */

import type { NotificacoesDoMembro } from "@n1/dominio/derive";

export function useNotificacoesDoMembro(): NotificacoesDoMembro & { readonly carregando: boolean } {
  throw new Error("não implementado");
}
