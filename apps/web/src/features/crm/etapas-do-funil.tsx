"use client";

/** Esqueleto do RED: a assinatura existe, o comportamento não. */

import type { FunilDetalhado } from "@n1/dominio/crm/funis";

export function EtapasDoFunil(_props: {
  readonly detalhado: FunilDetalhado;
  readonly podeEditar: boolean;
  readonly motivo: string | undefined;
  readonly onRemoverComNegocios: (etapaId: string) => void;
  readonly onAviso?: (texto: string) => void;
}) {
  return null;
}
