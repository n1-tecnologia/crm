/**
 * O recorte por Membro da resposta de uma gravação — o mesmo de `POST /operacoes/:nome`,
 * em módulo próprio para que as rotas mistas (Fase 14, 3.2.1) devolvam o que o
 * Membro enxerga e nada além.
 *
 * PRIV-03 / F1 / 1.1.5 — UM único `visibilidadePara` sobre o estado DEPOIS da
 * operação: o diff sem registro oculto e sem o que é de outro (segredo de link,
 * Memória, e-mail de convite), o `value` (a Tarefa inteira, por exemplo) idem,
 * e o contador de ids do estado inteiro, como `GET /estado`. O recorte roda
 * DEPOIS de `executar()`, nunca dentro do callback: o evento
 * `automacao.notificar-canal.v1` continua derivado do estado inteiro (R6).
 *
 * Extraído de `rotas/operacoes.ts`, não copiado (T-14-07): duas cópias divergem
 * na primeira mudança de visibilidade, e a divergência vaza registro oculto.
 */

import type { DataState, Diferenca, Id } from "@n1/dominio";
import { recortarDiferenca, recortarValor, visibilidadePara } from "@n1/dominio/derive-visibilidade";
import { maiorIdDe } from "@n1/dominio/operations";
import type { ResultadoTransacao } from "../persistencia/unidade-de-trabalho";

/** O que `executar()` devolve quando não houve conflito: a recusa do domínio também traz a `diferenca` (vazia). */
type ResultadoComDiferenca<T> = Extract<ResultadoTransacao<T>, { readonly diferenca: Diferenca }>;

export function recortarResposta<T>(resultado: ResultadoComDiferenca<T>, depois: DataState, membroId: Id) {
  const { ocultos } = visibilidadePara(depois, membroId);
  return {
    ...resultado,
    diferenca: recortarDiferenca(resultado.diferenca, depois, membroId, ocultos),
    ...(resultado.ok ? { value: recortarValor(resultado.value, depois, membroId, ocultos) } : {}),
    sequencia: maiorIdDe(depois),
  };
}
