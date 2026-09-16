/**
 * Acha o Membro de um Usuário dentro de um Espaço de Trabalho, sem hidratar
 * o Espaço inteiro.
 *
 * O hook de autenticação (`plugins/autenticacao.ts`) roda em TODA
 * requisição — hidratar os ~475 KB do Espaço só para achar um Membro
 * dobraria a latência medida (~234 ms por ida e volta, ADR
 * `04-spike-persistencia.md`). A migração `002` (Plan 01-06) já criou
 * `registros_members_user_id_idx`, um índice de expressão sobre
 * `dados->>'userId'` filtrado por `colecao = 'members'`, que é exatamente o
 * que esta consulta usa.
 */

import type { Member } from "@n1/dominio";
import { pool } from "./conexao";

export async function membroPorUsuario(workspaceId: string, userId: string): Promise<Member | undefined> {
  const resultado = await pool().query<{ dados: Member }>(
    `select dados
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'members'
        and dados->>'userId' = $2
      limit 1`,
    [workspaceId, userId],
  );
  return resultado.rows[0]?.dados;
}
