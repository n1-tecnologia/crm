"use client";

// ESQUELETO do RED (07-06 Task 2): compila e erra; o GREEN o substitui.

import type { ContatoDetalhado } from "@n1/dominio/crm/contatos";

export function DialogoNovoContato(_props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCriado: (detalhado: ContatoDetalhado) => void;
}) {
  return null;
}
