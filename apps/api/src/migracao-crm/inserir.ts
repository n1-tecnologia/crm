/**
 * Insere o plano do mapeador nas tabelas novas (15-28), dentro da transação de `executar()`.
 */

import type { PoolClient } from "pg";
import type { PlanoDeMigracao } from "./mapeador";

/** Quantas linhas entraram em cada tabela. */
export type Inseridos = Readonly<Record<string, number>>;

export async function inserirPlano(_cliente: PoolClient, _espaco: string, _plano: PlanoDeMigracao): Promise<Inseridos> {
  return {};
}
