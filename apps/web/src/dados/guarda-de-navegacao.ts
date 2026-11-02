/**
 * Fase 12, D-15 (GRV-05) — casca do RED: a forma pública da guarda de navegação,
 * sem o comportamento. O GREEN a preenche.
 */

import type { Id } from "@n1/dominio/types";

export interface FonteDosPendentes {
  readonly idsPendentes: () => ReadonlySet<Id>;
  readonly assinar: (ouvinte: () => void) => () => void;
}

export function idNaoConfirmadoNoEndereco(_href: string, _ids: ReadonlySet<Id>, _base?: string): Id | undefined {
  return undefined;
}

export function instalarGuardaDeNavegacao(_fonte: FonteDosPendentes, _documento: Document): () => void {
  return () => undefined;
}
