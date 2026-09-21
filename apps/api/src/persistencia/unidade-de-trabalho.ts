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
import { pool } from "./conexao";
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
   * Função pura que A ROTA fornece, derivando os eventos de saída do
   * resultado da operação — nunca do `diferenca` (D-18, T-02-16). A operação
   * de domínio continua sem saber que outbox existe: é o mesmo princípio do
   * cabeçalho deste arquivo, "nada aqui reescreve regra de negócio", agora
   * aplicado ao lado de fora dele.
   */
  readonly eventos?: (valor: T, state: DataState) => readonly EventoDeSaida[];
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

export async function executar<T>(
  workspaceId: string,
  operacao: (state: DataState) => OperationResult<T>,
  opcoes: OpcoesExecucao<T> = {},
): Promise<ResultadoTransacao<T>> {
  const tentativas = opcoes.tentativas ?? 3;
  let ultimo: Conflito | undefined;

  for (let n = 0; n < tentativas; n += 1) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const antes = await hidratar(cliente, workspaceId);
      // O contador de `nextId` é de módulo: sem sincronizar com o maior id já
      // presente no estado hidratado, um processo recém-subido geraria
      // `act_000001` de novo e o upsert sobrescreveria um registro real. A
      // operação é síncrona, então reset + execução acontecem no mesmo turno
      // do event loop — duas requisições concorrentes não se misturam (a
      // revisão otimista cuida do resto).
      syncIdSequence(antes.state);
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
      await gravarEventos(cliente, workspaceId, opcoes.eventos?.(resultado.value, antes.state) ?? []);
      if (opcoes.aoConfirmar) await opcoes.aoConfirmar(cliente, resultado.value, antes.state);
      await cliente.query("commit");
      // A nova revisão é a que o `update ... returning revisao` devolveu —
      // usar o valor lido em vez de `antes.revisao + 1` evita depender de
      // aritmética paralela com o que o banco de fato gravou.
      return { ...resultado, diferenca, revisao: Number(travada.rows[0]!.revisao), revisaoAnterior: antes.revisao };
    } catch (erro) {
      await cliente.query("rollback").catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  return ultimo ?? { ok: false, conflito: true, error: "Não foi possível gravar após várias tentativas." };
}
