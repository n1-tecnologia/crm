"use client";

// Esqueleto do RED (07-09 Task 1): compila e não faz nada. O GREEN o substitui.

import type { EmpresaDetalhada } from "@n1/dominio/crm/empresas";

export function DialogoNovaEmpresa(_props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCriado: (detalhado: EmpresaDetalhada) => void;
}) {
  return null;
}
