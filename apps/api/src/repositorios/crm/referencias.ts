/**
 * O que o Canal relacional ainda lê do Espaço antigo (`plataforma.registros`)
 * até a fase de unificação (D-11, D-12):
 *
 *   - a Fila e a Origem padrão do Canal (D-09: Fila não tem tabela própria) —
 *     `queues` e o item `kind = 'origem'` de `catalog`, ambos `ativo`;
 *   - a revisão do Espaço (`plataforma.workspaces.revisao`), que outro
 *     navegador compara em `verificarRevisao` para se re-hidratar (A4).
 *
 * É a regra que `operations/canais.ts` (`nomeEmUso`, `filaValida`,
 * `origemValida`) aplica em memória, repetida em SQL. Toda consulta leva
 * `workspace_id = $1` e valores `$n`: um id de outro Espaço nunca casa.
 */

import type { Pool, PoolClient } from "pg";

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

/** O Agente existe NESTE Espaço e está `ativo` (o mesmo filtro de `assignConversation` no modelo antigo). */
export async function agenteAtivo(cliente: Cliente, workspaceId: string, agenteId: string): Promise<boolean> {
  const { rowCount } = await cliente.query(
    `select 1
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'agents'
        and id = $2
        and dados->>'lifecycle' = 'ativo'`,
    [workspaceId, agenteId],
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

/**
 * A finalidade de consentimento existe NESTE Espaço, é `kind = 'finalidadeConsentimento'`
 * e está `ativo` (3.2.4). O Catálogo continua em `registros` até a unificação (OQ7): o
 * consentimento novo só aponta para ele por id.
 */
export async function finalidadeDeConsentimentoAtiva(cliente: Cliente, workspaceId: string, id: string): Promise<boolean> {
  const { rowCount } = await cliente.query(
    `select 1
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'catalog'
        and id = $2
        and dados->>'kind' = 'finalidadeConsentimento'
        and dados->>'lifecycle' = 'ativo'`,
    [workspaceId, id],
  );
  return (rowCount ?? 0) > 0;
}

/** O nome do item `finalidadeConsentimento` ativo do Espaço; `undefined` se não existe, é de outro Espaço ou não está ativo. */
export async function nomeDaFinalidadeAtiva(cliente: Cliente, workspaceId: string, id: string): Promise<string | undefined> {
  const { rows } = await cliente.query<{ nome: string | null }>(
    `select dados->>'name' as nome
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'catalog'
        and id = $2
        and dados->>'kind' = 'finalidadeConsentimento'
        and dados->>'lifecycle' = 'ativo'`,
    [workspaceId, id],
  );
  return rows[0] === undefined ? undefined : (rows[0].nome ?? id);
}

/**
 * O nome de exibição de quem é (ou era) Atribuído de uma Conversa, para a Atividade: o Membro
 * (`displayName`) ou o Agente (`name`) DESTE Espaço, em qualquer estado. `undefined` quando o
 * registro não existe — quem chama omite o nome em vez de inventar um.
 */
export async function nomeDoAtribuido(
  cliente: Cliente,
  workspaceId: string,
  atribuido: { readonly tipo: "membro" | "agente"; readonly id: string },
): Promise<string | undefined> {
  const { rows } = await cliente.query<{ nome: string | null }>(
    `select dados->>$3 as nome
       from plataforma.registros
      where workspace_id = $1 and colecao = $4 and id = $2`,
    [workspaceId, atribuido.id, atribuido.tipo === "membro" ? "displayName" : "name", atribuido.tipo === "membro" ? "members" : "agents"],
  );
  return rows[0]?.nome ?? undefined;
}

/**
 * O id da finalidade "marketing" do Espaço: o item `finalidadeConsentimento` de nome
 * "marketing", sem diferenciar maiúscula — o mesmo critério com que
 * `marketingConsentMissing` (`derive.ts`) a acha no modelo antigo. `undefined` quando
 * o Espaço não tem a finalidade.
 */
export async function finalidadeDeMarketing(cliente: Cliente, workspaceId: string): Promise<string | undefined> {
  const { rows } = await cliente.query<{ id: string }>(
    `select id
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'catalog'
        and dados->>'kind' = 'finalidadeConsentimento'
        and lower(dados->>'name') = 'marketing'
      order by ordem, id
      limit 1`,
    [workspaceId],
  );
  return rows[0]?.id;
}
