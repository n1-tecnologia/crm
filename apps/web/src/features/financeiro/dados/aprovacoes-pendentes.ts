import "server-only";

/**
 * A leitura de `/financeiro/aprovacoes-pendentes` — a vista legada (D4-11):
 * deriva de `solicitacoes_pagamentos.Aprovado`, o que o pipeline antigo sabe.
 * Só leitura, sem porta de decisão — quem decide aprovações hoje é a fila
 * viva em `/ia/aprovacoes` (D-08).
 */

import { lerDoFinanceiro, type Leitura } from "./leitura";

export type LinhaDeAprovacaoPendente = {
  readonly id: string;
  readonly fornecedor: string;
  readonly status: string;
  readonly previsao: string;
};

export function lerAprovacoesPendentes(
  empresa?: string,
): Promise<Leitura<{ readonly linhas: ReadonlyArray<LinhaDeAprovacaoPendente> }>> {
  return lerDoFinanceiro<{ readonly linhas: ReadonlyArray<LinhaDeAprovacaoPendente> }>(
    "/financeiro/aprovacoes-pendentes",
    { empresa },
  );
}
