/**
 * O que o Canal relacional ainda lê do Espaço antigo (`plataforma.registros`)
 * até a fase de unificação (D-11, D-12):
 *
 *   - a Fila e a Origem padrão do Canal (D-09: Fila não tem tabela própria) —
 *     `queues` e o item `kind = 'origem'` de `catalog`, ambos `ativo`;
 *   - os Canais do seed (`channels`), para a unicidade de nome e de conta valer
 *     entre os dois acervos (A5; RN-CXE-31 e INV-CXE-01 não podem ter um
 *     furo entre a tabela nova e a antiga);
 *   - a revisão do Espaço (`plataforma.workspaces.revisao`), que outro
 *     navegador compara em `verificarRevisao` para se re-hidratar (A4).
 *
 * É a regra que `operations/canais.ts` (`nomeEmUso`, `filaValida`,
 * `origemValida`) aplica em memória, repetida em SQL. Toda consulta leva
 * `workspace_id = $1` e valores `$n`: um id de outro Espaço nunca casa.
 */

import type { Pool, PoolClient } from "pg";
import type { TipoComProvedor } from "@n1/dominio/provedores-de-canal";

type Cliente = Pool | PoolClient;

/** A Fila existe NESTE Espaço e está `ativo`. */
export async function filaAtiva(cliente: Cliente, workspaceId: string, filaId: string): Promise<boolean> {
  const { rowCount } = await cliente.query(
    `select 1
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'queues'
        and id = $2
        and dados->>'lifecycle' = 'ativo'`,
    [workspaceId, filaId],
  );
  return (rowCount ?? 0) > 0;
}

/** O item do catálogo existe NESTE Espaço, é `kind = 'origem'` e está `ativo`. */
export async function origemAtiva(cliente: Cliente, workspaceId: string, origemId: string): Promise<boolean> {
  const { rowCount } = await cliente.query(
    `select 1
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'catalog'
        and id = $2
        and dados->>'kind' = 'origem'
        and dados->>'lifecycle' = 'ativo'`,
    [workspaceId, origemId],
  );
  return (rowCount ?? 0) > 0;
}

export interface ConflitoComCanalAntigo {
  readonly id: string;
  readonly nome: string;
  readonly motivo: "nome" | "conta";
}

/**
 * Um Canal do seed, ativo, com o mesmo nome (sem caixa nem espaços nas pontas)
 * ou a mesma conta (`channelType` + `externalId`) do alvo. O nome pesa mais que
 * a conta quando os dois casam.
 */
export async function canalAntigoEmConflito(
  cliente: Cliente,
  workspaceId: string,
  alvo: { readonly nome?: string | undefined; readonly tipo?: TipoComProvedor | undefined; readonly identificadorExterno?: string | undefined },
): Promise<ConflitoComCanalAntigo | undefined> {
  const valores: unknown[] = [workspaceId];
  const alternativas: string[] = [];
  let porNome = "false";
  if (alvo.nome !== undefined) {
    valores.push(alvo.nome);
    porNome = `lower(btrim(dados->>'name')) = lower(btrim($${valores.length}))`;
    alternativas.push(porNome);
  }
  if (alvo.tipo !== undefined && alvo.identificadorExterno !== undefined) {
    valores.push(alvo.tipo, alvo.identificadorExterno);
    alternativas.push(`(dados->>'channelType' = $${valores.length - 1} and dados->>'externalId' = $${valores.length})`);
  }
  if (alternativas.length === 0) return undefined;
  const { rows } = await cliente.query<{ id: string; nome: string; por_nome: boolean }>(
    `select id, dados->>'name' as nome, ${porNome} as por_nome
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'channels'
        and dados->>'lifecycle' = 'ativo'
        and (${alternativas.join(" or ")})
      order by por_nome desc, ordem, id
      limit 1`,
    valores,
  );
  const linha = rows[0];
  return linha ? { id: linha.id, nome: linha.nome, motivo: linha.por_nome ? "nome" : "conta" } : undefined;
}

/**
 * Soma 1 em `plataforma.workspaces.revisao` (A4), na transação da escrita do
 * Canal: o Canal relacional não passa pelo store, então é aqui que o outro
 * navegador fica sabendo que o Espaço mudou. Um Espaço sem linha (os de teste
 * do CRM nem sempre têm) não falha: são 0 linhas atualizadas.
 */
export async function avancarRevisaoDoEspaco(cliente: Cliente, workspaceId: string): Promise<void> {
  await cliente.query(
    "update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now() where workspace_id = $1",
    [workspaceId],
  );
}
