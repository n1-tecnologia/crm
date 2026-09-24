/**
 * A ponte entre `pedidosDeNotificacaoPorCanal` (domínio, AUTO-02/05-06) e o
 * evento de outbox `automacao.notificar-canal.v1` (`./outbox.ts`, Task 1).
 *
 * Duas funções PURAS, sem I/O — a mesma disciplina de `unidade-de-trabalho.ts`
 * (`opcoes.eventos` deriva do RESULTADO da operação, nunca do `diferenca`):
 *
 * `execucoesNovas` isola as `AutomationExecution` que NASCERAM durante a
 * transação corrente, comparando o `state.automationExecutions` DEPOIS da
 * operação contra o conjunto de ids capturado ANTES dela — a mesma técnica de
 * captura por fechamento que `apps/api/src/automacoes/scheduler-worker.ts`
 * (`ensaioContagem`/`foiForcadoAoEnsaio`) já usa dentro de `executar()`.
 *
 * `eventosDeNotificacaoPorCanal` chama `pedidosDeNotificacaoPorCanal` do
 * domínio sobre essas Execuções novas e traduz cada pedido pobre num
 * `EventoDeSaida` do tipo `automacao.notificar-canal.v1`. `aggregateId` é o
 * `executionId` — nunca o `taskId` — porque é essa a escolha que faz o
 * índice único parcial da migração `003` virar a barreira de duplicidade:
 * uma Execução gera no máximo um evento de Canal, mesmo que a mesma Tarefa
 * dispare a Automação várias vezes (cada disparo é uma Execução nova, com o
 * seu próprio `id`).
 */

import type { AutomationExecution, DataState } from "@n1/dominio";
import { pedidosDeNotificacaoPorCanal } from "@n1/dominio/operations/automations";
import type { EventoDeSaida } from "./outbox";

/** As Execuções de `state.automationExecutions` cujo `id` não estava em `idsAntes`. */
export function execucoesNovas(state: DataState, idsAntes: ReadonlySet<string>): readonly AutomationExecution[] {
  return state.automationExecutions.filter((execucao) => !idsAntes.has(execucao.id));
}

/**
 * Traduz cada pedido de `pedidosDeNotificacaoPorCanal` num `EventoDeSaida`
 * pronto para `gravarEventos()`. `.strict()` rejeita `undefined` explícito
 * nalgumas formas de objeto — por isso `campoDestinoId`/`rotulos` entram por
 * espalhamento condicional, nunca como chave presente com valor `undefined`
 * (o mesmo estilo de `../servicos/dto-solicitacao.ts` e do próprio
 * `pedidosDeNotificacaoPorCanal` no domínio).
 */
export function eventosDeNotificacaoPorCanal(
  state: DataState,
  execucoes: readonly AutomationExecution[],
): readonly EventoDeSaida[] {
  return pedidosDeNotificacaoPorCanal(state, execucoes).map((pedido) => ({
    type: "automacao.notificar-canal.v1",
    aggregateType: "automationExecution",
    // aggregateId = executionId (nunca taskId): o índice único parcial da
    // migração 003 vira "uma Execução gera no máximo um evento de Canal".
    aggregateId: pedido.executionId,
    payload: {
      taskId: pedido.taskId,
      automationId: pedido.automationId,
      executionId: pedido.executionId,
      canal: pedido.canal,
      destinoTipo: pedido.destinoTipo,
      ...(pedido.campoDestinoId !== undefined ? { campoDestinoId: pedido.campoDestinoId } : {}),
      ...(pedido.rotulos !== undefined ? { rotulos: [...pedido.rotulos] } : {}),
      mensagemId: pedido.mensagemId,
    },
  }));
}
