"use client";

// ESQUELETO do RED (07-06 Task 1): compila e erra; o GREEN o substitui.

import type { AcaoCrm, RecursoCrm } from "@n1/dominio/crm/permissoes";
import type { SituacaoNegocio } from "@n1/dominio/crm/comum";

export function useMembrosAtivos(): ReadonlyArray<{ readonly id: string; readonly nome: string }> {
  return [];
}
export function useNomeDoMembro(): (id: string | null | undefined) => string {
  return () => "";
}
export function usePodeNoCrm(_acao: AcaoCrm, _recurso: RecursoCrm, _contexto?: { readonly situacao?: SituacaoNegocio }): string | undefined {
  return undefined;
}
