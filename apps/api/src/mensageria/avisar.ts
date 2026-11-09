/**
 * O aviso ao tempo real (16-07, 3.8.2, D-16-01): `pg_notify('crm_eventos', json)` NO MESMO CLIENTE da transação que
 * muda a Mensagem ou a Conversa. O Postgres só entrega a notificação no `commit` e a descarta no `rollback`, então a
 * aba nunca é avisada de uma gravação que não existiu. Nunca abre conexão própria: um aviso fora da transação sairia
 * antes (ou sem) a gravação.
 *
 * O payload é só `{ workspaceId, tipo, conversaId, mensagemId? }` (ids e o tipo, `lerEventoDoCrm` recusa o resto): texto,
 * nome e telefone nunca viajam pelo NOTIFY nem pelo SSE; a tela busca o que precisa pelas rotas que conferem o acesso.
 * Um evento mal formado lança em vez de seguir calado, e o `comTransacao` do serviço desfaz a gravação junto.
 *
 * O ÚNICO lugar do `apps/api` que faz `pg_notify`.
 */

import type { PoolClient } from "pg";
import { lerEventoDoCrm, type EventoDoCrm } from "@n1/dominio/crm/eventos";

/** O canal que `ouvinte-pg.ts` escuta com `LISTEN`. */
export const CANAL_DO_NOTIFY = "crm_eventos";

/** O Postgres recusa payload com 8000 bytes ou mais (`22023`). Com ids de até 64 caracteres isto nunca chega perto. */
const LIMITE_DO_PAYLOAD_EM_BYTES = 8000;

export async function avisarCrm(cliente: Pick<PoolClient, "query">, evento: EventoDoCrm): Promise<void> {
  const lido = lerEventoDoCrm(evento);
  if (!lido) throw new Error("avisarCrm: o evento do CRM é inválido (só o tipo e ids de 1 a 64 caracteres).");
  const payload = JSON.stringify(lido);
  if (Buffer.byteLength(payload, "utf8") >= LIMITE_DO_PAYLOAD_EM_BYTES) throw new Error("avisarCrm: o payload passou do limite do NOTIFY.");
  await cliente.query("select pg_notify($1, $2)", [CANAL_DO_NOTIFY, payload]);
}
