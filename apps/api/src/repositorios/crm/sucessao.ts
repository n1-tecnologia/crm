/**
 * A sucessão de um Membro nas tabelas do CRM (14-10, 3.2.8; emendada em 15-03).
 *
 * `removeMember` (domínio) já passa ao Sucessor o que o Membro tinha no
 * modelo antigo, em `plataforma.registros`. Estas duas funções fazem o mesmo
 * nas tabelas novas, onde o domínio não chega:
 *
 *   - RN-ET-09 (a): `proprietario_id` de Contatos, Empresas e Negócios passa
 *     ao Sucessor;
 *   - RN-ET-09 (a) e RN-CXE-24, emendadas por B28-a (D-15-08): a Conversa
 *     atribuída ao Membro (`atribuido_tipo = 'membro'`) passa ao Sucessor como
 *     Atribuído: `atribuido_id` vira o Sucessor e `atribuido_tipo` continua
 *     `membro`. A Conversa atribuída a Agente não muda.
 *
 * Cada registro que muda de mãos deixa um Registro de Atividade em `crm_atividades`
 * (15-09, D-15-08): um `insert ... select` por tabela, ANTES do `update`, no mesmo
 * cliente e portanto no mesmo commit da remoção. A linha leva o ator (quem removeu), o
 * nome de exibição do registro e o nome do Sucessor em `depois`; nada de dado pessoal
 * além do nome que a própria tela já mostra (T-15-27). Como o `update` tira o registro do
 * Membro, repetir a remoção não acha mais nada e não grava linha nova.
 *
 * Todo `WHERE` leva `workspace_id = $1`: o que é de outro Espaço nunca muda
 * (T-14-25). Nenhuma das duas decide se a remoção vale: quem chama é o
 * `aoConfirmar` de `removeMember`, que só roda depois do `ok` do domínio. Valores
 * sempre `$n`, SQL constante. Todos os estados entram (ativo, arquivado, na
 * lixeira): o dono de um registro na lixeira também não pode ficar com quem saiu.
 */

import type { Pool, PoolClient } from "pg";
import { ACOES_DO_CRM } from "@n1/dominio/crm/atividades";
import type { SucessaoNoCrm } from "@n1/dominio/crm/sucessao";
import type { ActorRef } from "@n1/dominio/types/primitives";
import { MOMENTO_DO_GESTO } from "./atividades";
import { nomeDoAtribuido } from "./referencias";

export type { SucessaoNoCrm };

/**
 * Contatos, Empresas e Negócios mudam de `proprietario_id`; `nomeSql` é o nome de exibição
 * (o mesmo de `nomeDeExibicaoDoContato` / `nomeDeExibicaoDaEmpresa`, sem o Identificador, que é
 * dado pessoal). Tudo aqui é constante de código, nunca entrada: o SQL continua constante por tabela.
 */
const TABELAS_COM_DONO = [
  {
    tabela: "contatos",
    tipo: "contact",
    acao: ACOES_DO_CRM.contatoPassadoAoSucessor,
    nomeSql: `coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(nome), ''), nullif(btrim(sobrenome), ''))), ''), 'Contato sem nome')`,
  },
  {
    tabela: "empresas",
    tipo: "company",
    acao: ACOES_DO_CRM.empresaPassadaAoSucessor,
    nomeSql: `coalesce(nullif(btrim(nome_fantasia), ''), nullif(btrim(razao_social), ''), 'Empresa sem nome')`,
  },
  { tabela: "negocios", tipo: "deal", acao: ACOES_DO_CRM.negocioPassadoAoSucessor, nomeSql: "titulo" },
] as const;

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
    conversasPassadas: Number(linha.conversas),
  };
}

/**
 * No MESMO `cliente` (e na mesma transação) da remoção: ou tudo passa, ou nada. `ator` é quem
 * removeu o Membro (o Administrador da sessão), não o Membro removido.
 */
export async function passarAoSucessor(
  cliente: PoolClient,
  workspaceId: string,
  membroId: string,
  sucessorId: string,
  ator: ActorRef,
): Promise<void> {
  // O nome do Sucessor vai em `depois`; sem registro achado, a linha sai sem ele em vez de levar o id.
  const sucessor = (await nomeDoAtribuido(cliente, workspaceId, { tipo: "membro", id: sucessorId })) ?? null;

  for (const { tabela, tipo, acao, nomeSql } of TABELAS_COM_DONO) {
    await cliente.query(
      `insert into plataforma.crm_atividades (workspace_id, ator_tipo, ator_id, acao, objeto_tipo, objeto_id, objeto_nome, depois, em)
       select workspace_id, $3, $4, $5, $6, id, ${nomeSql}, $7::text, ${MOMENTO_DO_GESTO}
         from plataforma.${tabela} where workspace_id = $1 and proprietario_id = $2`,
      [workspaceId, membroId, ator.kind, ator.id, acao, tipo, sucessor],
    );
    await cliente.query(`update plataforma.${tabela} set proprietario_id = $3 where workspace_id = $1 and proprietario_id = $2`, [
      workspaceId,
      membroId,
      sucessorId,
    ]);
  }
  await cliente.query(
    `insert into plataforma.crm_atividades (workspace_id, ator_tipo, ator_id, acao, objeto_tipo, objeto_id, objeto_nome, depois, em)
     select workspace_id, $3, $4, $5, 'conversation', id, titulo, $6::text, ${MOMENTO_DO_GESTO}
       from plataforma.conversas where workspace_id = $1 and atribuido_tipo = 'membro' and atribuido_id = $2`,
    [workspaceId, membroId, ator.kind, ator.id, ACOES_DO_CRM.conversaPassadaAoSucessor, sucessor],
  );
  await cliente.query(
    // Só pega `atribuido_id = <removido>`: repetir a remoção não acha mais nada. O
    // `atribuido_tipo` continua `membro` (conversas_atribuido_ck exige o par).
    `update plataforma.conversas
        set atribuido_id = $3
      where workspace_id = $1 and atribuido_tipo = 'membro' and atribuido_id = $2`,
    [workspaceId, membroId, sucessorId],
  );
}
