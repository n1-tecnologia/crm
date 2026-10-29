/**
 * Esqueleto do RED de 11-07: os componentes existem para o teste importar, mas
 * ainda não fazem nada. A implementação entra no commit seguinte.
 */

import type { Task } from "@n1/dominio/types";

export function BotaoDeConversao(_props: { readonly task: Task; readonly onConverter: () => void }): null {
  return null;
}

export function DialogoDeConversao(_props: {
  readonly task: Task;
  readonly checklistId: string;
  readonly itemId: string;
  readonly onFechar: () => void;
  readonly onConvertida: (subtarefa: { readonly id: string; readonly title: string }) => void;
  readonly onErro: (mensagem: string) => void;
}): null {
  return null;
}
