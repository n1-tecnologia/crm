"use client";

import type { Mensagem } from "@n1/dominio/crm/mensagens";

export function EstadoDaEntrega(_props: {
  readonly mensagem: Pick<Mensagem, "id" | "direcao" | "statusEntrega" | "motivoFalha">;
}) {
  return null;
}
