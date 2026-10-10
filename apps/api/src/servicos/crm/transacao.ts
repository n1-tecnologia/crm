/**
 * Esqueleto do RED: abre a conexão e chama `fn`, sem `begin`/`commit`/`rollback`
 * e sem tradução de SQLSTATE. O GREEN troca isto pela transação de verdade.
 */

import type { Pool, PoolClient } from "pg";
import type { Recusa, ResultadoCrm } from "./resultado";

export type FrasesDeRestricao = Readonly<Record<string, { codigo: string; error: string; status?: 409 | 404 }>>;

export function traduzirErroDePg(_erro: unknown, _frases: FrasesDeRestricao): Recusa | undefined {
  return undefined;
}

export async function comTransacao<T>(
  pool: () => Pool,
  fn: (cliente: PoolClient) => Promise<ResultadoCrm<T>>,
  _frases: FrasesDeRestricao = {},
): Promise<ResultadoCrm<T>> {
  const cliente = await pool().connect();
  try {
    return await fn(cliente);
  } finally {
    cliente.release();
  }
}
