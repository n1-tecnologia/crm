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
import {
  CONTATOS_RECENTES_DO_PANORAMA,
  LIMITE_DE_LEADS,
  type ContagemDoDia,
  type ContatoRecenteDoCrm,
  type GanhosDoDia,
  type LeadAAtenderDoCrm,
  type NegociosAbertosDoCrm,
} from "@n1/dominio/crm/inicio";

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

interface LinhaDeLead {
  readonly contato_id: string;
  readonly nome: string | null;
  readonly sobrenome: string | null;
  readonly identificador: string | null;
  readonly conversa_id: string | null;
  readonly desde: Date;
}

/**
 * Os Leads do Membro que pedem ação dele (uma consulta):
 *   - Contatos `ativo`s de que ele é o Proprietário, com Qualificação na lista pedida;
 *   - `semContato`: nenhuma Mensagem fora a nota interna em Conversa nenhuma; espera desde o
 *     nascimento do Contato;
 *   - `aguardandoResposta`: Conversa `aberta` ativa cuja ÚLTIMA Mensagem externa (fora a
 *     `interna`) é `recebida` — a bola está com a organização. Com várias Conversas assim vale a
 *     que espera há mais tempo (`min`), e `conversa_id` é a dela. A última enviada deixa o Lead
 *     de fora: ele espera pelo Contato, não por nós.
 * Quem espera há mais tempo vem primeiro; empate por id, para a ordem não depender do plano.
 */
const SQL_DE_LEADS = `
  select c.id as contato_id, c.nome, c.sobrenome,
         (select i.valor from plataforma.contato_identificadores i
           where i.workspace_id = $1 and i.contato_id = c.id and i.principal
           order by i.criado_em, i.id limit 1) as identificador,
         esp.conversa_id,
         coalesce(esp.desde, c.criado_em) as desde
    from plataforma.contatos c
    left join lateral (
      select min(u.criado_em) as desde,
             (array_agg(u.conversa_id order by u.criado_em, u.conversa_id))[1] as conversa_id
        from (select distinct on (v.id) v.id as conversa_id, m.direcao, m.criado_em
                from plataforma.conversas v
                join plataforma.mensagens m
                  on m.workspace_id = v.workspace_id and m.conversa_id = v.id and m.direcao <> 'interna'
               where v.workspace_id = $1 and v.contato_id = c.id and v.estado = 'ativo' and v.situacao = 'aberta'
               order by v.id, m.criado_em desc, m.seq desc) u
       where u.direcao = 'recebida'
    ) esp on true
   where c.workspace_id = $1 and c.estado = 'ativo' and c.proprietario_id = $2
     and c.qualificacao = any($3::text[])
     and (esp.desde is not null
          or not exists (select 1
                           from plataforma.conversas v
                           join plataforma.mensagens m
                             on m.workspace_id = v.workspace_id and m.conversa_id = v.id and m.direcao <> 'interna'
                          where v.workspace_id = $1 and v.contato_id = c.id))
   order by coalesce(esp.desde, c.criado_em), c.id
   limit $4::int
`;

export async function leadsDoMembro(
  cliente: Pool | PoolClient,
  workspaceId: string,
  membroId: string,
  qualificacoes: readonly string[],
): Promise<readonly LeadAAtenderDoCrm[]> {
  const { rows } = await cliente.query<LinhaDeLead>(SQL_DE_LEADS, [workspaceId, membroId, [...qualificacoes], LIMITE_DE_LEADS]);
  return rows.map((linha) => ({
    contatoId: linha.contato_id,
    nome: nomeDeExibicaoDoContato({ nome: linha.nome, sobrenome: linha.sobrenome }, linha.identificador),
    motivo: linha.conversa_id === null ? "semContato" : "aguardandoResposta",
    conversaId: linha.conversa_id,
    desde: linha.desde.toISOString(),
  }));
}

/** Quais séries das estatísticas montar: o serviço liga cada uma pelo `ler` do recurso. */
export interface SeriesDasEstatisticas {
  readonly mensagens: boolean;
  readonly conversas: boolean;
  readonly negocios: boolean;
}

export interface EstatisticasLidas {
  readonly mensagensEnviadas: readonly ContagemDoDia[] | null;
  readonly conversasResolvidas: readonly ContagemDoDia[] | null;
  readonly negociosGanhos: readonly GanhosDoDia[] | null;
}

interface LinhaDeEstatistica {
  readonly serie: "mensagens" | "conversas" | "negocios";
  readonly dia: string;
  readonly moeda: string | null;
  readonly quantidade: number;
  readonly valor: string;
}

/**
 * As três séries do Membro por dia, numa instrução só (`union all`: uma fotografia). O dia é
 * cortado NO FUSO pedido: `date_trunc('day', <instante> at time zone $5)`; o fuso entra como
 * parâmetro e foi conferido contra a lista IANA antes (T-15-47). A janela é `[$3, $4]`, inclusiva
 * como a do resumo antigo, e o `group by` por dia segura o custo mesmo com 400 dias (T-15-46).
 *   - Mensagens: `enviada` de que o Membro é o Ator, em Conversa fora da lixeira;
 *   - Conversas: `resolvida` de que o Membro é o Atribuído (o modelo novo não guarda quem
 *     clicou em resolver), pelo momento de resolução, fora da lixeira;
 *   - Negócios: `ganho` de que o Membro é o Proprietário, pelo momento de encerramento, fora da
 *     lixeira, por dia e moeda (moedas não se somam, RN-PAI-13).
 */
const SQL_DE_ESTATISTICAS = `
  select 'mensagens' as serie,
         to_char(date_trunc('day', m.criado_em at time zone $5::text), 'YYYY-MM-DD') as dia,
         null::text as moeda, count(*)::int as quantidade, '0'::text as valor
    from plataforma.mensagens m
    join plataforma.conversas v on v.workspace_id = m.workspace_id and v.id = m.conversa_id
   where $6::boolean and m.workspace_id = $1 and m.direcao = 'enviada' and m.ator_tipo = 'member' and m.ator_id = $2
     and v.estado <> 'na_lixeira' and m.criado_em >= $3::timestamptz and m.criado_em <= $4::timestamptz
   group by 2
  union all
  select 'conversas',
         to_char(date_trunc('day', v.resolvida_em at time zone $5::text), 'YYYY-MM-DD'),
         null::text, count(*)::int, '0'::text
    from plataforma.conversas v
   where $7::boolean and v.workspace_id = $1 and v.situacao = 'resolvida' and v.estado = 'ativo'
     and v.atribuido_tipo = 'membro' and v.atribuido_id = $2
     and v.resolvida_em >= $3::timestamptz and v.resolvida_em <= $4::timestamptz
   group by 2
  union all
  select 'negocios',
         to_char(date_trunc('day', n.encerrado_em at time zone $5::text), 'YYYY-MM-DD'),
         n.moeda::text, count(*)::int, coalesce(sum(n.valor), 0)::text
    from plataforma.negocios n
   where $8::boolean and n.workspace_id = $1 and n.situacao = 'ganho' and n.estado <> 'na_lixeira'
     and n.proprietario_id = $2 and n.encerrado_em >= $3::timestamptz and n.encerrado_em <= $4::timestamptz
   group by 2, 3
  order by 1, 2, 3
`;

export async function estatisticasDoMembro(
  cliente: Pool | PoolClient,
  workspaceId: string,
  membroId: string,
  janela: { readonly desde: string; readonly ate: string; readonly fuso: string },
  series: SeriesDasEstatisticas,
): Promise<EstatisticasLidas> {
  const { rows } = await cliente.query<LinhaDeEstatistica>(SQL_DE_ESTATISTICAS, [
    workspaceId,
    membroId,
    janela.desde,
    janela.ate,
    janela.fuso,
    series.mensagens,
    series.conversas,
    series.negocios,
  ]);
  const contagens = (serie: "mensagens" | "conversas"): ContagemDoDia[] =>
    rows.filter((linha) => linha.serie === serie).map((linha) => ({ dia: linha.dia, quantidade: linha.quantidade }));
  return {
    mensagensEnviadas: series.mensagens ? contagens("mensagens") : null,
    conversasResolvidas: series.conversas ? contagens("conversas") : null,
    negociosGanhos: series.negocios
      ? rows
          .filter((linha) => linha.serie === "negocios")
          .map((linha) => ({ dia: linha.dia, moeda: linha.moeda ?? "", quantidade: linha.quantidade, valor: Number(linha.valor) }))
      : null,
  };
}
