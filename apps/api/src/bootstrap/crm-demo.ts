/**
 * Carregador do CRM de demonstração (15-29, UCR-11, D-15-13) — esqueleto do RED: ainda não grava nada.
 */

import type { PoolClient } from "pg";

export interface ResultadoDoDemo {
  readonly carregado: boolean;
  /** Quantas linhas entraram em cada tabela. */
  readonly linhas: Readonly<Record<string, number>>;
}

export async function carregarCrmDemo(_cliente: PoolClient, _opcoes: { readonly workspaceId: string }): Promise<ResultadoDoDemo> {
  return { carregado: false, linhas: {} };
}
