/**
 * A Unidade de Trabalho: onde uma operação do domínio vira uma transação.
 *
 * Hidrata o Espaço de Trabalho, roda a operação **pura** — a mesma função que
 * `apps/web` roda em memória, sem variante de servidor —, grava o que mudou e
 * confirma. Nada aqui sabe o que a operação faz; se soubesse, haveria duas
 * versões de cada regra, e elas divergiriam.
 *
 * Concorrência: a revisão do Espaço de Trabalho é lida no início e conferida
 * no fim. Se outra escrita entrou no meio, esta não sobrescreve — devolve
 * conflito para quem chamou tentar de novo sobre o estado novo. É o grão certo
 * porque é o grão que a operação enxerga: ela lê o grafo inteiro, então duas
 * escritas simultâneas no mesmo Espaço podem se invalidar mesmo tocando
 * registros diferentes.
 */

import type { PoolClient } from "pg";
import type { DataState, Diferenca, OperationResult } from "@n1/dominio";
import { DIFERENCA_VAZIA } from "@n1/dominio";
import { syncIdSequence } from "@n1/dominio/operations";
import { limitesDoPool, pool } from "./conexao";
import { execucoesNovas, eventosDeNotificacaoPorCanal } from "./eventos-de-canal";
import { gravarEventos, type EventoDeSaida } from "./outbox";
import { gravar, hidratar } from "./repositorio";

export type Conflito = { readonly ok: false; readonly conflito: true; readonly error: string };

export type ResultadoTransacao<T> =
  | (OperationResult<T> & { readonly diferenca: Diferenca; readonly revisao: number; readonly revisaoAnterior: number })
  | Conflito;

export interface OpcoesExecucao<T = unknown> {
  /** Quantas vezes repetir em caso de conflito antes de desistir. */
  readonly tentativas?: number;
  /**
   * Função pura que A ROTA fornece, derivando SEUS PRÓPRIOS eventos de saída
   * do resultado da operação — nunca do `diferenca` (D-18, T-02-16). A
   * operação de domínio continua sem saber que outbox existe: é o mesmo
   * princípio do cabeçalho deste arquivo, "nada aqui reescreve regra de
   * negócio", agora aplicado ao lado de fora dele.
   *
   * O evento de Canal (`automacao.notificar-canal.v1`) NÃO entra por aqui:
   * `executar()` o deriva sozinho, obrigatoriamente (CR-05), a partir das
   * `AutomationExecution` que nasceram na transação — nunca opt-in por rota.
   * Os eventos que a rota fornecer aqui são somados aos de Canal, nunca os
   * substituem.
   */
  readonly eventos?: (valor: T, state: DataState) => readonly EventoDeSaida[];
  /**
   * Quem passa `true` declara que esta transação NÃO PODE gravar evento de
   * saída de nenhum tipo — nem os que `eventos` acima devolveria, nem o de
   * Canal derivado obrigatoriamente. Se, ainda assim, a lista de eventos não
   * estiver vazia, `executar()` lança ANTES de `gravarEventos` e a exceção
   * desfaz a transação inteira (mesmo caminho de qualquer outra exceção
   * dentro deste bloco). Uso: as importações históricas (CR-05/T-5-57), que
   * rodam com `runAutomations: false` e não podem, por construção, acordar
   * Automação nenhuma — muito menos gravar o aviso dela.
   */
  readonly semEventosDeSaida?: true;
  /**
   * Plan 02-16 — roda DEPOIS de gravar Tarefa/anexos e o(s) evento(s) de
   * outbox, ANTES do `commit`: o MESMO `cliente`, a MESMA transação. Único
   * uso até aqui é `consumirSessao` (`./sessoes-de-upload.ts`) — a submissão
   * pública do Formulário precisa marcar a sessão de upload como consumida
   * no mesmo commit que grava a Tarefa (T-02-06: uma sessão vira anexo uma
   * vez só), sem que a Unidade de Trabalho precise saber o que é uma
   * "sessão de upload". Escolhida em vez de expor o `cliente` inteiro à
   * rota: menos superfície para quem chama `executar()` errar (um `cliente`
   * solto convidaria a rodar SQL de negócio fora da revisão otimista desta
   * função). Lançar aqui desfaz a transação inteira — mesmo efeito de uma
   * exceção dentro de `operacao`.
   */
  readonly aoConfirmar?: (cliente: PoolClient, valor: T, state: DataState) => Promise<void>;
}

/**
 * O `begin` e, no MESMO ida-e-volta, a rede do lado do servidor: se este
 * cliente sumir no meio da transação (o pooler derrubou a conexão sem aviso),
 * o Postgres encerra a sessão parada no mesmo prazo do `query_timeout` do pool
 * e solta a revisão do Espaço de Trabalho — que o `update ... revisao` abaixo
 * trava até o `commit`. Sem isto, em 2026-09-29, toda escrita no `ws_n1` ficou
 * esperando o TCP desistir (16 e 10 minutos). `set local` vale só para esta
 * transação; com o `query_timeout` desligado, fica o `begin` puro.
 */
export function inicioDaTransacao(env: NodeJS.ProcessEnv = process.env): string {
  const prazo = limitesDoPool(env).query_timeout;
  return prazo ? `begin; set local idle_in_transaction_session_timeout = ${prazo}` : "begin";
}

export async function executar<T>(
  workspaceId: string,
  operacao: (state: DataState) => OperationResult<T>,
  opcoes: OpcoesExecucao<T> = {},
): Promise<ResultadoTransacao<T>> {
  const tentativas = opcoes.tentativas ?? 3;
  let ultimo: Conflito | undefined;

  for (let n = 0; n < tentativas; n += 1) {
    const cliente = await pool().connect();
    let falhou = false;
    try {
      await cliente.query(inicioDaTransacao());
      const antes = await hidratar(cliente, workspaceId);
      // O contador de `nextId` é de módulo: sem sincronizar com o maior id já
      // presente no estado hidratado, um processo recém-subido geraria
      // `act_000001` de novo e o upsert sobrescreveria um registro real. A
      // operação é síncrona, então reset + execução acontecem no mesmo turno
      // do event loop — duas requisições concorrentes não se misturam (a
      // revisão otimista cuida do resto).
      syncIdSequence(antes.state);
      // CR-05 — capturado AQUI, dentro do laço de tentativas, para que um
      // retry por conflito de revisão recomece do zero: o mesmo cuidado que
      // `rotas/operacoes.ts` e `automacoes/scheduler-worker.ts` já
      // documentavam quando a captura ainda morava em cada chamador.
      const idsAntes = new Set(antes.state.automationExecutions.map((e) => e.id));
      const resultado = operacao(antes.state);

      if (!resultado.ok) {
        // A recusa é resposta legítima do domínio, não falha: nada foi gravado,
        // mas a transação fecha limpa para não segurar conexão.
        await cliente.query("rollback");
        return { ...resultado, diferenca: DIFERENCA_VAZIA, revisao: antes.revisao, revisaoAnterior: antes.revisao };
      }

      const travada = await cliente.query<{ revisao: string }>(
        "update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now() where workspace_id = $1 and revisao = $2 returning revisao",
        [workspaceId, antes.revisao],
      );
      if (travada.rowCount === 0) {
        await cliente.query("rollback");
        ultimo = { ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." };
        continue;
      }

      const diferenca = await gravar(cliente, workspaceId, antes.state, antes);
      // D-18 — o evento nasce no MESMO `cliente`, ANTES do commit: Tarefa e
      // evento são a mesma transação, sem que a operação de domínio saiba
      // que outbox existe. Nunca chamar `fetch`/HTTP neste bloco — a entrega
      // é responsabilidade exclusiva de `outbox-worker.ts`, fora da UoW.
      //
      // CR-05 — o evento de Canal é derivado AQUI, obrigatoriamente, a
      // partir das Execuções que nasceram NESTA transação (nunca do
      // `diferenca`, D-18) — soma-se ao que a rota fornecer em `opcoes.eventos`,
      // para que nenhuma rota que rode Automação consiga esquecê-lo.
      const eventos = [
        ...(opcoes.eventos?.(resultado.value, antes.state) ?? []),
        ...eventosDeNotificacaoPorCanal(antes.state, execucoesNovas(antes.state, idsAntes)),
      ];
      if (opcoes.semEventosDeSaida && eventos.length > 0) {
        throw new Error("Esta operação não pode gravar evento de saída — plataforma.integration_outbox não pode crescer.");
      }
      await gravarEventos(cliente, workspaceId, eventos);
      if (opcoes.aoConfirmar) await opcoes.aoConfirmar(cliente, resultado.value, antes.state);
      await cliente.query("commit");
      // A nova revisão é a que o `update ... returning revisao` devolveu —
      // usar o valor lido em vez de `antes.revisao + 1` evita depender de
      // aritmética paralela com o que o banco de fato gravou.
      return { ...resultado, diferenca, revisao: Number(travada.rows[0]!.revisao), revisaoAnterior: antes.revisao };
    } catch (erro) {
      falhou = true;
      await cliente.query("rollback").catch(() => undefined);
      throw erro;
    } finally {
      // Com falha, a conexão sai do pool (`release(true)` a destrói): a que ficou
      // sem resposta no meio da transação não pode servir à próxima requisição.
      cliente.release(falhou);
    }
  }

  return ultimo ?? { ok: false, conflito: true, error: "Não foi possível gravar após várias tentativas." };
}
