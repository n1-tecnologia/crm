/**
 * A liberação das Conversas de um Agente nas tabelas do CRM (Fase 15, 3.4.9; RN-AGE-20).
 *
 * `arquivarAgente` e `enviarAgenteALixeira` (domínio) já soltam o Agente das Tarefas e das
 * Conversas de Grupo que moram em `plataforma.registros`. Esta função solta as Conversas de
 * `plataforma.conversas` que estavam atribuídas a ele, no MESMO `cliente` (e na mesma
 * transação) do gesto: o `aoConfirmar` de `executar()` só roda depois do `ok` do domínio, então
 * uma recusa nunca chega aqui e uma exceção desfaz tudo.
 *
 * O `WHERE` leva `workspace_id = $1` (T-15-25: o que é de outro Espaço nunca muda) e
 * `atribuido_tipo = 'agente' and atribuido_id = $2`: repetir não acha mais nada, e uma Conversa
 * de Membro nunca é solta. As duas colunas andam juntas (`conversas_atribuido_ck`). Valores
 * sempre `$n`, SQL constante.
 */

import type { Pool, PoolClient } from "pg";

/** Quantas Conversas do Agente foram soltas (a Fila e o resto da Conversa não mudam). */
export async function liberarDoAgente(cliente: Pool | PoolClient, workspaceId: string, agenteId: string): Promise<number> {
  const resultado = await cliente.query(
    `update plataforma.conversas
        set atribuido_tipo = null, atribuido_id = null
      where workspace_id = $1 and atribuido_tipo = 'agente' and atribuido_id = $2`,
    [workspaceId, agenteId],
  );
  return resultado.rowCount ?? 0;
}
