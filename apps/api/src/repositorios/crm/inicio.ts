/**
 * Repositório do agregado do Início (15-18, 3.4.7, UCR-07): o que `derive-resumo` e o
 * panorama do robô calculavam sobre o store, somado no banco.
 *
 * Só LEITURA, e cada função é UMA consulta (uma instrução SQL = uma fotografia
 * consistente, mesmo com escrita concorrente; nunca duas leituras que podem discordar).
 * Regras que valem em toda consulta:
 *   - `workspace_id = $1` em toda tabela: o Espaço vem do serviço, que o tira da sessão
 *     (T-15-45);
 *   - o Membro ("meu") também vem da sessão, sempre como parâmetro `$n`;
 *   - nada do pedido é interpolado no SQL: ids, instantes, limite e fuso viajam como
 *     parâmetro (o fuso, em `at time zone $n`, T-15-47). O SQL de cada função é constante;
 *   - os números somam aqui (`count`, `sum`, `group by`), nunca em listas paginadas
 *     somadas no navegador (`paginaMaxima` é 200, Pitfall 4).
 *
 * Este módulo NÃO decide permissão: o serviço diz quais blocos a consulta deve montar, e
 * o bloco desligado volta `null` sem tocar a tabela dele.
 */

import type { Pool, PoolClient } from "pg";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { CONTATOS_RECENTES_DO_PANORAMA, type ContatoRecenteDoCrm, type NegociosAbertosDoCrm } from "@n1/dominio/crm/inicio";

/** Quais blocos do panorama montar: o serviço liga cada um pelo `ler` do recurso. */
export interface BlocosDoPanorama {
  readonly contatos: boolean;
  readonly negocios: boolean;
  readonly conversas: boolean;
}

export interface PanoramaLido {
  readonly contatosRecentes: readonly ContatoRecenteDoCrm[] | null;
  readonly contatosTotal: number | null;
  readonly negociosAbertos: NegociosAbertosDoCrm | null;
  readonly conversasAbertas: number | null;
}

interface LinhaDoPanorama {
  readonly contatos_total: number | null;
  readonly recentes: readonly { readonly id: string; readonly nome: string | null; readonly sobrenome: string | null; readonly identificador: string | null }[] | null;
  readonly negocios_abertos: number | null;
  readonly moedas: number | null;
  readonly moeda: string | null;
  readonly ponderado: string | null;
  readonly conversas_abertas: number | null;
}

/**
 * Uma consulta para o panorama. Os `case when $n` desligam o bloco que o Papel não lê: o
 * Postgres não executa o subselect do ramo que não vale.
 *
 * Valor ponderado: `valor × (probabilidade do Negócio, senão a padrão da Etapa) / 100` dos
 * Negócios abertos ativos COM Valor (o sem Valor soma 0 e não conta moeda, como o
 * panorama antigo). Mais de uma moeda entre eles: `moedas > 1` e o serviço devolve `null`.
 */
const SQL_DO_PANORAMA = `
  select
    case when $2::boolean then
      (select count(*)::int from plataforma.contatos c where c.workspace_id = $1 and c.estado = 'ativo')
    end as contatos_total,
    case when $2::boolean then
      (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'sobrenome', r.sobrenome, 'identificador', r.identificador)
                                 order by r.criado_em desc, r.id), '[]'::jsonb)
         from (select c.id, c.nome, c.sobrenome, c.criado_em,
                      (select i.valor from plataforma.contato_identificadores i
                        where i.workspace_id = $1 and i.contato_id = c.id and i.principal
                        order by i.criado_em, i.id limit 1) as identificador
                 from plataforma.contatos c
                where c.workspace_id = $1 and c.estado = 'ativo'
                order by c.criado_em desc, c.id
                limit $5::int) r)
    end as recentes,
    case when $3::boolean then
      (select count(*)::int from plataforma.negocios n
        where n.workspace_id = $1 and n.estado = 'ativo' and n.situacao = 'aberto')
    end as negocios_abertos,
    case when $3::boolean then
      (select count(distinct n.moeda)::int from plataforma.negocios n
        where n.workspace_id = $1 and n.estado = 'ativo' and n.situacao = 'aberto' and n.valor is not null)
    end as moedas,
    case when $3::boolean then
      (select min(n.moeda) from plataforma.negocios n
        where n.workspace_id = $1 and n.estado = 'ativo' and n.situacao = 'aberto' and n.valor is not null)
    end as moeda,
    case when $3::boolean then
      (select coalesce(round(sum(n.valor * coalesce(n.probabilidade, e.probabilidade_padrao)::numeric / 100), 2), 0)::text
         from plataforma.negocios n
         join plataforma.etapas e on e.workspace_id = n.workspace_id and e.funil_id = n.funil_id and e.id = n.etapa_id
        where n.workspace_id = $1 and n.estado = 'ativo' and n.situacao = 'aberto' and n.valor is not null)
    end as ponderado,
    case when $4::boolean then
      (select count(*)::int from plataforma.conversas v
        where v.workspace_id = $1 and v.estado = 'ativo' and v.situacao <> 'resolvida')
    end as conversas_abertas
`;

export async function panoramaDoEspaco(cliente: Pool | PoolClient, workspaceId: string, blocos: BlocosDoPanorama): Promise<PanoramaLido> {
  const { rows } = await cliente.query<LinhaDoPanorama>(SQL_DO_PANORAMA, [
    workspaceId,
    blocos.contatos,
    blocos.negocios,
    blocos.conversas,
    CONTATOS_RECENTES_DO_PANORAMA,
  ]);
  const linha = rows[0]!;
  const umaMoeda = linha.moedas === 1 && linha.moeda !== null;
  return {
    contatosRecentes:
      linha.recentes === null
        ? null
        : linha.recentes.map((contato) => ({
            id: contato.id,
            nome: nomeDeExibicaoDoContato({ nome: contato.nome, sobrenome: contato.sobrenome }, contato.identificador),
          })),
    contatosTotal: linha.contatos_total,
    negociosAbertos:
      linha.negocios_abertos === null
        ? null
        : {
            quantidade: linha.negocios_abertos,
            valorPonderado: umaMoeda && linha.ponderado !== null ? Number(linha.ponderado) : null,
            moeda: umaMoeda ? linha.moeda : null,
          },
    conversasAbertas: linha.conversas_abertas,
  };
}
