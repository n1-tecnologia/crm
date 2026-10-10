"use client";

// Esqueleto do RED (07-09 Task 2): compila e não faz nada. O GREEN o substitui.

import type { EmpresaDetalhada } from "@n1/dominio/crm/empresas";

export function VinculosDaEmpresa(_props: {
  readonly detalhado: EmpresaDetalhada;
  readonly podeEditar: boolean;
  readonly motivo: string | undefined;
  readonly avisar: (texto: string) => void;
}) {
  return null;
}
