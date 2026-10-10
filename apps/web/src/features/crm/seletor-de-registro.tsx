"use client";

// Esqueleto do RED (07-09 Task 1): compila e não faz nada. O GREEN o substitui.

export interface RegistroEscolhido {
  readonly id: string;
  readonly nome: string;
}

export function SeletorDeRegistro(_props: {
  readonly recurso: "contatos" | "empresas";
  readonly valor: RegistroEscolhido | null;
  readonly onChange: (valor: RegistroEscolhido | null) => void;
  readonly excluirIds?: readonly string[];
  readonly rotulo: string;
  readonly id?: string;
}) {
  return null;
}
