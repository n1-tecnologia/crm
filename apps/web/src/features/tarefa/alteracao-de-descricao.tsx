"use client";

import type { ActivityRecord } from "@n1/dominio/types";

/** Esqueleto do RED (11-06): ainda não faz nada. */
export function temAlteracaoParaVer(_record: ActivityRecord): boolean {
  return false;
}

export function AlteracaoDeDescricao(_props: { readonly record: ActivityRecord }) {
  return null;
}
