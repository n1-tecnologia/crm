/**
 * Concede ao papel `n1_api` as mesmas permissões que a `009` concede — para o
 * caso de o papel ter nascido DEPOIS dela (Fase 9, SEG-04).
 *
 * A `009` só concede se `n1_api` existir quando ela roda, e uma migração
 * aplicada é imutável; por isso o SQL mora em `apps/api/deploy/`, fora de
 * `migracoes/` (a única pasta que `migrar()` lê), e roda por `npm run
 * banco:conceder` com o dono do banco (`DATABASE_URL_MIGRACAO`). É idempotente.
 */

import { readFileSync } from "node:fs";
import type { Pool } from "pg";

const ARQUIVO = new URL("../../deploy/conceder-n1-api.sql", import.meta.url);

/**
 * Sem o papel no cluster, não roda mais nada (o SQL também se guardaria, mas
 * dizer "o papel não existe" ao operador vale uma consulta). Com ele, roda o
 * arquivo inteiro numa consulta só.
 */
export async function concederN1Api(cliente: Pick<Pool, "query">): Promise<{ readonly papelExiste: boolean }> {
  const papel = await cliente.query("select 1 from pg_roles where rolname = 'n1_api'");
  if (!papel.rows[0]) return { papelExiste: false };
  await cliente.query(readFileSync(ARQUIVO, "utf8"));
  return { papelExiste: true };
}
