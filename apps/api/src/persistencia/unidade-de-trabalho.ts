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

import type { DataState, OperationResult } from "@n1/dominio";
import { pool } from "./conexao";
import { gravar, hidratar, type Diferenca } from "./repositorio";

export type Conflito = { readonly ok: false; readonly conflito: true; readonly error: string };

export type ResultadoTransacao<T> =
  | (OperationResult<T> & { readonly diferenca: Diferenca })
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
      const resultado = operacao(antes.state);

      if (!resultado.ok) {
        // A recusa é resposta legítima do domínio, não falha: nada foi gravado,
        // mas a transação fecha limpa para não segurar conexão.
        await cliente.query("rollback");
        return { ...resultado, diferenca: { gravados: 0, removidos: 0 } };
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
      return { ...resultado, diferenca };
    } catch (erro) {
      await cliente.query("rollback").catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  return ultimo ?? { ok: false, conflito: true, error: "Não foi possível gravar após várias tentativas." };
}
