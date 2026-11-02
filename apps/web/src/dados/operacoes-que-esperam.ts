/**
 * Marcador da RED (Fase 12, plano 07): a lista ainda está vazia e nada espera
 * o servidor. A próxima mudança escreve a lista de verdade.
 */

import type { NomeDeOperacao, ChamadaDeOperacao } from "@n1/dominio/operations/registro";

export const OPERACOES_QUE_ESPERAM: ReadonlyMap<NomeDeOperacao, string> = new Map();

export function esperaOServidor(_chamadas: readonly ChamadaDeOperacao[]): boolean {
  return false;
}
