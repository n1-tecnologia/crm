"use client";

// ESQUELETO do RED (07-06 Task 2): compila e erra; o GREEN o substitui.

import type { Endereco } from "@n1/dominio/crm/comum";

export function EditorDeEnderecos(_props: {
  readonly valor: readonly Endereco[];
  readonly onChange: (enderecos: readonly Endereco[], erro?: string) => void;
  readonly disabled?: boolean;
}) {
  return null;
}
