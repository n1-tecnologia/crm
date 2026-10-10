"use client";

// ESQUELETO do RED (07-06 Task 2): compila e erra; o GREEN o substitui.

import type { CamposAdicionais } from "@n1/dominio/crm/comum";

export function EditorDeCamposAdicionais(_props: {
  readonly valor: CamposAdicionais;
  readonly onChange: (campos: CamposAdicionais, erro?: string) => void;
  readonly disabled?: boolean;
}) {
  return null;
}
