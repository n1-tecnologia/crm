/**
 * O pool de conexões. Uma instância por processo; quem usa pede `pool()`.
 */

import { Pool } from "pg";

let instancia: Pool | undefined;

export function pool(): Pool {
  if (!instancia) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida.");
    instancia = new Pool({ connectionString, max: 10 });
  }
  return instancia;
}

export async function encerrar(): Promise<void> {
  await instancia?.end();
  instancia = undefined;
}
