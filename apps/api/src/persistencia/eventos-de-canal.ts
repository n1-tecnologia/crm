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
 * `EventoDeSaida` do tipo `automacao.notificar-canal.v1`.
 *
 * `aggregateId` (WR-04, 05-13 Task 2) é `<executionId>:<indicePasso>` —
 * NUNCA só o `executionId`. Verdade corrigida: hoje NENHUM índice único do
 * banco cobre `automacao.notificar-canal.v1` — o índice parcial da migração
 * `004-outbox-indice-unico-por-workspace.sql` tem
 * `where event_type = 'solicitacao.criada.v1'`, e o comentário anterior
 * deste arquivo, que atribuía essa barreira à migração `003`, estava errado
 * (o índice de duplicidade do evento de Canal nasce só na migração `006`,
 * plano 05-21). O índice DO PASSO no `aggregateId` existe para que uma
 * Execução com dois passos de Canal produza dois eventos distintos — nunca
 * colidam entre si — quando esse índice único chegar: sem o índice do
 * passo, `<executionId>` sozinho colidiria consigo mesmo no segundo passo da
 * MESMA Execução.
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
    // aggregateId = `${executionId}:${indicePasso}` (WR-04) — nunca só o
    // executionId: uma Execução com dois passos de Canal precisa de dois
    // aggregateId distintos para não colidir quando o índice único da
    // migração 006 (plano 05-21) existir.
    aggregateId: `${pedido.executionId}:${pedido.indicePasso}`,
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
