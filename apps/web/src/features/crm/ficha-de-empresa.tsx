"use client";

// Esqueleto do RED (07-09 Task 2): compila e não faz nada. O GREEN o substitui.

import type { EmpresaDetalhada } from "@n1/dominio/crm/empresas";

export function FichaDeEmpresa(_props: {
  readonly empresaId: string;
  readonly detalhado: EmpresaDetalhada;
  readonly modo: "pagina" | "popup";
  readonly onFechar?: () => void;
}) {
  return null;
}
