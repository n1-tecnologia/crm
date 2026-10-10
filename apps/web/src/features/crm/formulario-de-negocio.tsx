"use client";

// Esqueleto do RED (07-10 Task 2): compila e não desenha nada. O GREEN o substitui.

import type { NegocioDetalhado } from "@n1/dominio/crm/negocios";
import type { RegistroEscolhido } from "@/features/crm/seletor-de-registro";

export interface ValorInicialDoNegocio {
  readonly funilId?: string;
  readonly empresa?: RegistroEscolhido;
  readonly contato?: RegistroEscolhido;
}

export function DialogoNovoNegocio(_props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCriado: (detalhado: NegocioDetalhado) => void;
  readonly valorInicial?: ValorInicialDoNegocio;
}): null {
  return null;
}
