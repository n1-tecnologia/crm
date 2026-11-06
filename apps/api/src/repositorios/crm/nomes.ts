/**
 * Repositório de nomes do CRM novo em lote (15-10, UCR-08): o nome de muitos ids
 * numa leitura por tipo, não numa por id.
 *
 * Só LEITURA. Regras que valem em toda consulta:
 *   - `workspace_id = $1` na junção: o Espaço vem do serviço, que o tira da sessão
 *     (T-15-29). Um id de outro Espaço não casa e volta sem nome;
 *   - os ids viajam num array (`$2::text[]`) e o SQL de cada tipo é constante: nada
 *     do pedido é interpolado;
 *   - `unnest ... with ordinality` + `left join` devolve UMA linha por posição
 *     pedida, na ordem, mesmo com id repetido ou desconhecido (molde do resumo da
 *     Tarefa conversacional);
 *   - o estado do registro não filtra: o que está na lixeira ou arquivado ainda tem
 *     nome (a Auditoria e a IA citam o que foi eliminado). Quem pode ler o tipo lê o
 *     nome, como em `GET /<recurso>?estado=`.
 *
 * Este módulo NÃO decide permissão: o serviço só passa os alvos que o Papel pode ler.
 */

import type { Pool, PoolClient } from "pg";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { nomeDeExibicaoDaEmpresa } from "@n1/dominio/crm/empresas";
import type { AlvoDoCrm } from "@n1/dominio/crm/nomes";
import type { TipoDeObjetoDoCrm } from "@n1/dominio/crm/atividades";

/** Uma posição pedida: `achado` diz se o id existe neste Espaço; `a`, `b` e `c` são as colunas de nome do tipo. */
interface LinhaDeNome {
  readonly ordem: number;
  readonly achado: boolean;
  readonly a: string | null;
  readonly b: string | null;
  readonly c: string | null;
}

interface ConsultaDoTipo {
  readonly sql: string;
  readonly nome: (linha: LinhaDeNome) => string;
}

/** O molde das consultas: só a tabela e as três colunas de nome mudam. */
function consulta(tabela: string, colunas: string, nome: ConsultaDoTipo["nome"]): ConsultaDoTipo {
  return {
    sql: `select e.ordem::int as ordem, x.id is not null as achado, ${colunas}
            from unnest($2::text[]) with ordinality as e(id, ordem)
            left join plataforma.${tabela} x on x.workspace_id = $1 and x.id = e.id
           order by e.ordem`,
    nome,
  };
}

const CONSULTAS: Readonly<Record<TipoDeObjetoDoCrm, ConsultaDoTipo>> = {
  contact: consulta(
    "contatos",
    `x.nome as a, x.sobrenome as b,
            (select i.valor from plataforma.contato_identificadores i
              where i.workspace_id = $1 and i.contato_id = x.id and i.principal
              order by i.criado_em, i.id limit 1) as c`,
    (linha) => nomeDeExibicaoDoContato({ nome: linha.a, sobrenome: linha.b }, linha.c),
  ),
  company: consulta("empresas", "x.nome_fantasia as a, x.razao_social as b, null::text as c", (linha) =>
    nomeDeExibicaoDaEmpresa({ nomeFantasia: linha.a, razaoSocial: linha.b }),
  ),
  deal: consulta("negocios", "x.titulo as a, null::text as b, null::text as c", (linha) => linha.a ?? ""),
  conversation: consulta("conversas", "x.titulo as a, null::text as b, null::text as c", (linha) => linha.a ?? ""),
  funnel: consulta("funis", "x.nome as a, null::text as b, null::text as c", (linha) => linha.a ?? ""),
  channel: consulta("canais", "x.nome as a, null::text as b, null::text as c", (linha) => linha.a ?? ""),
};

/**
 * Um nome por alvo, NA ORDEM pedida; `null` para o id que não é deste Espaço ou não existe.
 * Uma consulta por tipo presente; lista vazia não consulta o banco.
 */
export async function nomesDosAlvos(
  cliente: Pool | PoolClient,
  workspaceId: string,
  alvos: readonly AlvoDoCrm[],
): Promise<readonly (string | null)[]> {
  const nomes: (string | null)[] = alvos.map(() => null);
  if (alvos.length === 0) return nomes;

  // As posições de cada tipo, na ordem pedida: a linha `ordem` da consulta é o índice (1-based) neste vetor.
  const posicoesPorTipo = new Map<TipoDeObjetoDoCrm, number[]>();
  alvos.forEach((alvo, posicao) => {
    const posicoes = posicoesPorTipo.get(alvo.tipo);
    if (posicoes) posicoes.push(posicao);
    else posicoesPorTipo.set(alvo.tipo, [posicao]);
  });

  await Promise.all(
    [...posicoesPorTipo].map(async ([tipo, posicoes]) => {
      const { sql, nome } = CONSULTAS[tipo];
      const ids = posicoes.map((posicao) => alvos[posicao]!.id);
      const { rows } = await cliente.query<LinhaDeNome>(sql, [workspaceId, ids]);
      for (const linha of rows) {
        const posicao = posicoes[linha.ordem - 1];
        if (posicao !== undefined && linha.achado) nomes[posicao] = nome(linha);
      }
    }),
  );
  return nomes;
}
