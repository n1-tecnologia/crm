/**
 * Leitura do Papel e do estado de um Membro em `plataforma.registros`, para o
 * backend aplicar a permissão do CRM (D-10, D-14).
 *
 * O Membro e o Papel dele são registros do Espaço (`colecao = 'members'` e
 * `'roles'`, no `jsonb` `dados`), gravados pelo store. Esta leitura NÃO
 * hidrata o Espaço: uma consulta só, com `left join`, escopada por
 * `workspace_id = $1` — um Membro de outro Espaço nunca é achado (T-07-40).
 */

import type { Pool, PoolClient } from "pg";
import type { MemberState, SystemRole } from "@n1/dominio/types/workspace";

export interface PapelDoMembro {
  /** `undefined` quando o Papel do Membro não existe (registro órfão). */
  readonly base: SystemRole | undefined;
  readonly estado: MemberState;
}

export async function papelDoMembro(
  cliente: Pool | PoolClient,
  workspaceId: string,
  membroId: string,
): Promise<PapelDoMembro | undefined> {
  const resultado = await cliente.query<{ estado: MemberState; base: SystemRole | null }>(
    `select m.dados->>'state' as estado, r.dados->>'base' as base
       from plataforma.registros m
       left join plataforma.registros r
         on r.workspace_id = m.workspace_id
        and r.colecao = 'roles'
        and r.id = m.dados->>'roleId'
      where m.workspace_id = $1
        and m.colecao = 'members'
        and m.id = $2`,
    [workspaceId, membroId],
  );
  const linha = resultado.rows[0];
  if (!linha) return undefined;
  return { base: linha.base ?? undefined, estado: linha.estado };
}

/** O Membro existe NESTE Espaço e está `ativo`. */
export async function membroAtivo(cliente: Pool | PoolClient, workspaceId: string, membroId: string): Promise<boolean> {
  const resultado = await cliente.query(
    `select 1
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'members'
        and id = $2
        and dados->>'state' = 'ativo'`,
    [workspaceId, membroId],
  );
  return (resultado.rowCount ?? 0) > 0;
}
