/**
 * A sucessão de um Membro nas tabelas do CRM (14-10, 3.2.8).
 *
 * `removeMember` (domínio) já passa ao Sucessor o que o Membro tinha no
 * modelo antigo, em `plataforma.registros`. Estas duas funções fazem o mesmo
 * nas tabelas novas, onde o domínio não chega:
 *
 *   - RN-ET-09 (a): `proprietario_id` de Contatos, Empresas e Negócios passa
 *     ao Sucessor;
 *   - RN-ET-09 (b): a Conversa atribuída ao Membro fica LIBERADA
 *     (`atribuido_tipo` e `atribuido_id` nulos), não vai ao Sucessor. Quem
 *     assume a fila decide a quem passar.
 *
 * Todo `WHERE` leva `workspace_id = $1`: o que é de outro Espaço nunca muda
 * (T-14-25). Nenhuma das duas decide se a remoção vale: quem chama é o
 * `aoConfirmar` de `removeMember`, que só roda depois do `ok` do domínio. Valores
 * sempre `$n`, SQL constante. Todos os estados entram (ativo, arquivado, na
 * lixeira): o dono de um registro na lixeira também não pode ficar com quem saiu.
 */

import type { Pool, PoolClient } from "pg";

/** O que a remoção de um Membro move ou libera nas tabelas do CRM. */
export interface SucessaoNoCrm {
  readonly contatos: number;
  readonly empresas: number;
  readonly negocios: number;
  readonly conversasLiberadas: number;
}

const TABELAS_COM_DONO = ["contatos", "empresas", "negocios"] as const;

export async function contarDoMembro(cliente: Pool | PoolClient, workspaceId: string, membroId: string): Promise<SucessaoNoCrm> {
  const { rows } = await cliente.query<{ contatos: string; empresas: string; negocios: string; conversas: string }>(
    `select
       (select count(*) from plataforma.contatos where workspace_id = $1 and proprietario_id = $2)::text as contatos,
       (select count(*) from plataforma.empresas where workspace_id = $1 and proprietario_id = $2)::text as empresas,
       (select count(*) from plataforma.negocios where workspace_id = $1 and proprietario_id = $2)::text as negocios,
       (select count(*) from plataforma.conversas
         where workspace_id = $1 and atribuido_tipo = 'membro' and atribuido_id = $2)::text as conversas`,
    [workspaceId, membroId],
  );
  const linha = rows[0]!;
  return {
    contatos: Number(linha.contatos),
    empresas: Number(linha.empresas),
    negocios: Number(linha.negocios),
    conversasLiberadas: Number(linha.conversas),
  };
}

/** No MESMO `cliente` (e na mesma transação) da remoção: ou tudo passa, ou nada. */
export async function passarAoSucessor(cliente: PoolClient, workspaceId: string, membroId: string, sucessorId: string): Promise<void> {
  // Os nomes vêm de uma lista constante, nunca de entrada: o SQL continua constante por tabela.
  for (const tabela of TABELAS_COM_DONO) {
    await cliente.query(`update plataforma.${tabela} set proprietario_id = $3 where workspace_id = $1 and proprietario_id = $2`, [
      workspaceId,
      membroId,
      sucessorId,
    ]);
  }
  await cliente.query(
    `update plataforma.conversas
        set atribuido_tipo = null, atribuido_id = null
      where workspace_id = $1 and atribuido_tipo = 'membro' and atribuido_id = $2`,
    [workspaceId, membroId],
  );
}
