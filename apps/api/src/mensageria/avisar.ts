/** Esqueleto (16-07, RED): o aviso ainda não grava nada no banco. */

import type { PoolClient } from "pg";
import type { EventoDoCrm } from "@n1/dominio/crm/eventos";

export const CANAL_DO_NOTIFY = "crm_eventos";

export async function avisarCrm(_cliente: Pick<PoolClient, "query">, _evento: EventoDoCrm): Promise<void> {
  return undefined;
}
