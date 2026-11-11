/**
 * O que a Evolution guarda no banco do CRM (Sessão 4): só o cofre, `plataforma.credenciais`. Não há tabela própria: a
 * instância e o webhook moram na Evolution, e o CRM guarda apenas o token da instância e o segredo do webhook do Canal.
 */

import type { PoolClient } from "pg";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../../provedor";

/** O tipo da credencial do Canal no cofre: o nome do provedor (o que `canalParaProvedor` lê). */
export const TIPO_DA_CREDENCIAL_DA_EVOLUTION = "whatsapp-nao-oficial";

/**
 * 4.3.3: arquivar o Canal apaga do cofre o token da instância e o segredo do webhook, na MESMA transação do arquivamento.
 * Desconectar NÃO chama isto: a instância continua na Evolution, e reconectar reaproveita a credencial (só pede outro QR).
 * As Conversas e Mensagens ficam: são dado do cliente da plataforma.
 */
export async function esquecerCredenciaisDaEvolution(cliente: Pick<PoolClient, "query">, workspaceId: string, canalId: string): Promise<void> {
  await cliente.query(
    `delete from plataforma.credenciais
      where workspace_id = $1 and dono_tipo = 'canal' and dono_id = $2 and tipo = any($3::text[])`,
    [workspaceId, canalId, [TIPO_DA_CREDENCIAL_DA_EVOLUTION, TIPO_DO_SEGREDO_DO_WEBHOOK]],
  );
}
