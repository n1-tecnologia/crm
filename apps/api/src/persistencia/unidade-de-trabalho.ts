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

import type { DataState, Diferenca, OperationResult } from "@n1/dominio";
import { DIFERENCA_VAZIA } from "@n1/dominio";
import { syncIdSequence } from "@n1/dominio/operations";
import { pool } from "./conexao";
import { gravar, hidratar } from "./repositorio";

export type Conflito = { readonly ok: false; readonly conflito: true; readonly error: string };

export type ResultadoTransacao<T> =
  | (OperationResult<T> & { readonly diferenca: Diferenca; readonly revisao: number; readonly revisaoAnterior: number })
  | Conflito;

export interface OpcoesExecucao {
  /** Quantas vezes repetir em caso de conflito antes de desistir. */
  readonly tentativas?: number;
}

export async function executar<T>(
  workspaceId: string,
  operacao: (state: DataState) => OperationResult<T>,
  opcoes: OpcoesExecucao = {},
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
