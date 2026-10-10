/**
 * Vínculos Contato-Empresa (`plataforma.contato_empresa`).
 *
 * Do lado do Contato (07-03) só se LÊ: a ficha do Contato mostra os vínculos e
 * a lixeira (D-09) pergunta de quais Empresas ele é o único admin. Do lado da
 * Empresa (07-05) também se ESCREVE: criar, editar e encerrar vínculo (D-08).
 * Encerrar é preencher `fim`, nunca apagar: o histórico fica.
 *
 * Todo `WHERE` leva `workspace_id = $1` (D-10); datas voltam como texto
 * (`::text`, Pitfall 5).
 */

import type { Pool, PoolClient } from "pg";
import type { EstadoCrm } from "@n1/dominio/crm/comum";
import { nomeDeExibicaoDoContato, type VinculoDoContato } from "@n1/dominio/crm/contatos";
import type { VinculoDaEmpresa } from "@n1/dominio/crm/empresas";

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

/** Um vínculo como a escrita o enxerga: sem o nome do Contato, que a ficha da Empresa junta depois. */
export interface VinculoGravado {
  readonly id: string;
  readonly contatoId: string;
  readonly empresaId: string;
  readonly cargo: string | null;
  readonly admin: boolean;
  readonly inicio: string | null;
  readonly fim: string | null;
}

export interface LinhaDeVinculo {
  readonly contatoId: string;
  readonly empresaId: string;
  readonly cargo?: string | undefined;
  readonly admin: boolean;
  readonly inicio?: string | undefined;
  readonly criadoPor: string;
}

const COLUNAS_VINCULO = `id, contato_id, empresa_id, cargo, admin, inicio::text as inicio, fim::text as fim`;

interface LinhaDeVinculoNoBanco {
  readonly id: string;
  readonly contato_id: string;
  readonly empresa_id: string;
  readonly cargo: string | null;
  readonly admin: boolean;
  readonly inicio: string | null;
  readonly fim: string | null;
}

function linhaParaVinculo(linha: LinhaDeVinculoNoBanco): VinculoGravado {
  return {
    id: linha.id,
    contatoId: linha.contato_id,
    empresaId: linha.empresa_id,
    cargo: linha.cargo,
    admin: linha.admin,
    inicio: linha.inicio,
    fim: linha.fim,
  };
}

/**
 * Os vínculos da Empresa, os vigentes primeiro (admins no topo), depois os
 * encerrados. `contatoNome` é o de exibição, derivado; `contatoEstado` deixa a
 * regra de "admin vigente" ignorar Contato na lixeira.
 */
export async function listarDaEmpresa(
  cliente: Pool | PoolClient,
  workspaceId: string,
  empresaId: string,
): Promise<VinculoDaEmpresa[]> {
  const resultado = await cliente.query<
    LinhaDeVinculoNoBanco & {
      nome: string | null;
      sobrenome: string | null;
      contato_estado: EstadoCrm;
      email_principal: string | null;
      telefone_principal: string | null;
    }
  >(
    `select v.id, v.contato_id, v.empresa_id, v.cargo, v.admin, v.inicio::text as inicio, v.fim::text as fim,
            c.nome, c.sobrenome, c.estado as contato_estado,
            (select i.valor from plataforma.contato_identificadores i
              where i.workspace_id = c.workspace_id and i.contato_id = c.id
                and i.principal and i.tipo = 'email') as email_principal,
            (select i.valor from plataforma.contato_identificadores i
              where i.workspace_id = c.workspace_id and i.contato_id = c.id
                and i.principal and i.tipo = 'telefone') as telefone_principal
       from plataforma.contato_empresa v
       join plataforma.contatos c on c.workspace_id = v.workspace_id and c.id = v.contato_id
      where v.workspace_id = $1 and v.empresa_id = $2
      order by (v.fim is null) desc, v.admin desc, v.inicio desc nulls last, v.criado_em, v.id`,
    [workspaceId, empresaId],
  );
  return resultado.rows.map((linha) => ({
    id: linha.id,
    contatoId: linha.contato_id,
    contatoNome: nomeDeExibicaoDoContato(linha, linha.email_principal ?? linha.telefone_principal),
    contatoEstado: linha.contato_estado,
    cargo: linha.cargo,
    admin: linha.admin,
    inicio: linha.inicio,
    fim: linha.fim,
  }));
}

/** Um vínculo da Empresa (vigente ou encerrado), ou `undefined` se não é desta Empresa neste Espaço. */
export async function obterVinculo(
  cliente: Pool | PoolClient,
  workspaceId: string,
  empresaId: string,
  vinculoId: string,
): Promise<VinculoGravado | undefined> {
  const resultado = await cliente.query<LinhaDeVinculoNoBanco>(
    `select ${COLUNAS_VINCULO} from plataforma.contato_empresa
      where workspace_id = $1 and empresa_id = $2 and id = $3`,
    [workspaceId, empresaId, vinculoId],
  );
  const linha = resultado.rows[0];
  return linha ? linhaParaVinculo(linha) : undefined;
}

/** O vínculo vigente (`fim` nulo) do par Contato-Empresa, se houver — só um é possível (índice único parcial). */
export async function vinculoVigente(
  cliente: Pool | PoolClient,
  workspaceId: string,
  contatoId: string,
  empresaId: string,
): Promise<VinculoGravado | undefined> {
  const resultado = await cliente.query<LinhaDeVinculoNoBanco>(
    `select ${COLUNAS_VINCULO} from plataforma.contato_empresa
      where workspace_id = $1 and contato_id = $2 and empresa_id = $3 and fim is null`,
    [workspaceId, contatoId, empresaId],
  );
  const linha = resultado.rows[0];
  return linha ? linhaParaVinculo(linha) : undefined;
}

export async function inserirVinculo(
  cliente: Pool | PoolClient,
  workspaceId: string,
  linha: LinhaDeVinculo,
): Promise<VinculoGravado> {
  const resultado = await cliente.query<LinhaDeVinculoNoBanco>(
    `insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, cargo, admin, inicio, criado_por)
     values ($1, $2, $3, $4, $5, $6::date, $7)
     returning ${COLUNAS_VINCULO}`,
    [
      workspaceId,
      linha.contatoId,
      linha.empresaId,
      linha.cargo !== undefined && linha.cargo.trim() !== "" ? linha.cargo : null,
      linha.admin,
      linha.inicio ?? null,
      linha.criadoPor,
    ],
  );
  const inserida = resultado.rows[0];
  if (!inserida) throw new Error("O INSERT de vínculo não devolveu a linha.");
  return linhaParaVinculo(inserida);
}

/** Cargo (texto vazio limpa) e `admin`; só as colunas presentes em `campos`. */
export async function atualizarVinculo(
  cliente: Pool | PoolClient,
  workspaceId: string,
  vinculoId: string,
  campos: { readonly cargo?: string | undefined; readonly admin?: boolean | undefined },
): Promise<void> {
  const valores: unknown[] = [workspaceId, vinculoId];
  const definicoes: string[] = [];
  if (campos.cargo !== undefined) {
    valores.push(campos.cargo.trim() === "" ? null : campos.cargo);
    definicoes.push(`cargo = $${valores.length}`);
  }
  if (campos.admin !== undefined) {
    valores.push(campos.admin);
    definicoes.push(`admin = $${valores.length}`);
  }
  if (definicoes.length === 0) return;
  await cliente.query(
    `update plataforma.contato_empresa set ${definicoes.join(", ")} where workspace_id = $1 and id = $2`,
    valores,
  );
}

/** Encerra o vínculo em `fim` (data civil AAAA-MM-DD) ou, sem ela, na data de hoje do banco. */
export async function encerrarVinculo(
  cliente: Pool | PoolClient,
  workspaceId: string,
  vinculoId: string,
  fim?: string,
): Promise<void> {
  await cliente.query(
    `update plataforma.contato_empresa set fim = coalesce($3::date, current_date)
      where workspace_id = $1 and id = $2 and fim is null`,
    [workspaceId, vinculoId, fim ?? null],
  );
}

/**
 * D-08: ao enviar a Empresa à lixeira, todo vínculo vigente ganha `fim` = hoje
 * (ou o `inicio`, se este for posterior, para não violar `contato_empresa_periodo_ck`).
 * Os Contatos não são tocados.
 */
export async function encerrarVigentesDaEmpresa(
  cliente: Pool | PoolClient,
  workspaceId: string,
  empresaId: string,
): Promise<void> {
  await cliente.query(
    `update plataforma.contato_empresa set fim = greatest(current_date, coalesce(inicio, current_date))
      where workspace_id = $1 and empresa_id = $2 and fim is null`,
    [workspaceId, empresaId],
  );
}
