/**
 * Vínculos Contato-Empresa (`plataforma.contato_empresa`), do lado do Contato.
 *
 * Aqui só se LÊ: a ficha do Contato mostra os vínculos e a lixeira (D-09)
 * pergunta de quais Empresas ele é o único admin. Criar, editar e encerrar
 * vínculo é do lado da Empresa — 07-05 acrescenta a escrita neste arquivo (D-08).
 *
 * Todo `WHERE` leva `workspace_id = $1` (D-10); datas voltam como texto
 * (`::text`, Pitfall 5).
 */

import type { Pool, PoolClient } from "pg";
import type { VinculoDoContato } from "@n1/dominio/crm/contatos";

const NOME_DA_EMPRESA = "coalesce(nullif(btrim(e.nome_fantasia), ''), nullif(btrim(e.razao_social), ''))";

/**
 * Os vínculos do Contato, os vigentes primeiro. Vínculo com Empresa na lixeira
 * fica oculto (contatos.md: o lado na lixeira oculta o vínculo).
 */
export async function listarDoContato(
  cliente: Pool | PoolClient,
  workspaceId: string,
  contatoId: string,
): Promise<VinculoDoContato[]> {
  const resultado = await cliente.query<{
    id: string;
    empresa_id: string;
    empresa_nome: string;
    cargo: string | null;
    admin: boolean;
    inicio: string | null;
    fim: string | null;
  }>(
    `select v.id, v.empresa_id, ${NOME_DA_EMPRESA} as empresa_nome, v.cargo, v.admin,
            v.inicio::text as inicio, v.fim::text as fim
       from plataforma.contato_empresa v
       join plataforma.empresas e on e.workspace_id = v.workspace_id and e.id = v.empresa_id
      where v.workspace_id = $1 and v.contato_id = $2 and e.estado <> 'na_lixeira'
      order by (v.fim is null) desc, v.inicio desc nulls last, v.id`,
    [workspaceId, contatoId],
  );
  return resultado.rows.map((linha) => ({
    id: linha.id,
    empresaId: linha.empresa_id,
    empresaNome: linha.empresa_nome,
    cargo: linha.cargo,
    admin: linha.admin,
    inicio: linha.inicio,
    fim: linha.fim,
  }));
}

/**
 * D-09: as Empresas fora da lixeira em que este Contato é o ÚNICO admin
 * vigente — não existe OUTRO vínculo `admin and fim is null` cujo Contato
 * esteja fora da lixeira. Pré-checagem do serviço: enviar o Contato à lixeira
 * não toca `contato_empresa`, então o constraint trigger da 007 não dispara.
 */
export async function empresasEmQueEhUnicoAdmin(
  cliente: Pool | PoolClient,
  workspaceId: string,
  contatoId: string,
): Promise<{ id: string; nome: string }[]> {
  const resultado = await cliente.query<{ id: string; nome: string }>(
    `select e.id, ${NOME_DA_EMPRESA} as nome
       from plataforma.contato_empresa v
       join plataforma.empresas e on e.workspace_id = v.workspace_id and e.id = v.empresa_id
      where v.workspace_id = $1 and v.contato_id = $2 and v.admin and v.fim is null
        and e.estado <> 'na_lixeira'
        and not exists (
          select 1
            from plataforma.contato_empresa outro
            join plataforma.contatos oc on oc.workspace_id = outro.workspace_id and oc.id = outro.contato_id
           where outro.workspace_id = v.workspace_id and outro.empresa_id = v.empresa_id
             and outro.admin and outro.fim is null and outro.contato_id <> v.contato_id
             and oc.estado <> 'na_lixeira')
      order by nome, e.id`,
    [workspaceId, contatoId],
  );
  return resultado.rows;
}
