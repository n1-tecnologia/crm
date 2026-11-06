/**
 * Insere o plano do mapeador nas tabelas novas (15-28), dentro da transação de `executar()`.
 *
 * Um `insert` em lote por tabela e por pedaço de 500 linhas: as linhas viajam como UM parâmetro JSON
 * (`$2`) e o Postgres as lê com `jsonb_to_recordset`, com a lista de colunas EXPLÍCITA. Nome de tabela e de
 * coluna vêm só das constantes deste arquivo e todo valor entra por parâmetro (T-15-69): nenhum texto do
 * dado antigo é concatenado em SQL.
 *
 * A ordem é a das chaves estrangeiras. Nenhuma constraint é adiada além das da 007 (o admin da Empresa,
 * conferido no `commit`): por isso o mapeador só entrega Empresa com vínculo admin.
 */

import type { PoolClient } from "pg";
import type { PlanoDeMigracao } from "./mapeador";

/** Quantas linhas entraram em cada tabela. */
export type Inseridos = Readonly<Record<string, number>>;

interface Coluna {
  readonly nome: string;
  /** O tipo SQL da coluna no `jsonb_to_recordset`. */
  readonly tipo: string;
  /** O que entra na coluna a partir de `r.<nome>`; o padrão é o próprio valor. */
  readonly expressao?: string;
}

interface TabelaDeInsercao {
  readonly tabela: string;
  readonly colunas: readonly Coluna[];
}

const PEDACO = 500;

const c = (nome: string, tipo: string, expressao?: string): Coluna => (expressao === undefined ? { nome, tipo } : { nome, tipo, expressao });

const CONTATOS: TabelaDeInsercao = {
  tabela: "contatos",
  colunas: [
    c("id", "text"),
    c("nome", "text"),
    c("sobrenome", "text"),
    c("data_nascimento", "date"),
    c("idioma", "text"),
    c("fuso_horario", "text"),
    c("descricao", "text"),
    c("enderecos", "jsonb", "coalesce(r.enderecos, '[]'::jsonb)"),
    c("campos_adicionais", "jsonb", "coalesce(r.campos_adicionais, '{}'::jsonb)"),
    c("origem", "text"),
    c("qualificacao", "text"),
    c("modo_criacao", "text"),
    c("estado", "text"),
    c("mesclado_em_id", "text"),
    c("mesclado_em", "timestamptz"),
    c("proprietario_id", "text"),
    c("criado_por", "text"),
    c("criado_em", "timestamptz", "coalesce(r.criado_em, now())"),
  ],
};

const CONTATO_IDENTIFICADORES: TabelaDeInsercao = {
  tabela: "contato_identificadores",
  colunas: [
    c("id", "text"),
    c("contato_id", "text"),
    c("tipo", "text"),
    c("valor", "text"),
    c("valor_exibido", "text"),
    c("rotulo_canal", "text"),
    c("verificado", "boolean"),
    c("principal", "boolean"),
    c("criado_em", "timestamptz", "coalesce(r.criado_em, now())"),
  ],
};

const CRM_DE_PARA: TabelaDeInsercao = {
  tabela: "crm_de_para",
  colunas: [c("colecao_antiga", "text"), c("id_antigo", "text"), c("tabela_nova", "text"), c("id_novo", "text")],
};

/** O `insert ... select` de uma tabela: `$1` é o Espaço e `$2` o JSON com as linhas (cada uma com `n`, a posição). */
function sqlDeInsercao(spec: TabelaDeInsercao): string {
  const nomes = spec.colunas.map((col) => col.nome).join(", ");
  const expressoes = spec.colunas.map((col) => col.expressao ?? `r.${col.nome}`).join(", ");
  const definicoes = spec.colunas.map((col) => `${col.nome} ${col.tipo}`).join(", ");
  return `insert into plataforma.${spec.tabela} (workspace_id, ${nomes})
          select $1, ${expressoes}
            from jsonb_to_recordset($2::jsonb) as r(${definicoes}, n integer)
           order by r.n`;
}

async function inserirLinhas(cliente: PoolClient, espaco: string, spec: TabelaDeInsercao, linhas: readonly object[]): Promise<number> {
  const sql = sqlDeInsercao(spec);
  let total = 0;
  for (let inicio = 0; inicio < linhas.length; inicio += PEDACO) {
    const pedaco = linhas.slice(inicio, inicio + PEDACO).map((linha, indice) => ({ ...linha, n: inicio + indice }));
    const resultado = await cliente.query(sql, [espaco, JSON.stringify(pedaco)]);
    total += resultado.rowCount ?? 0;
  }
  return total;
}

/**
 * Insere o plano. Devolve quantas linhas entraram em cada tabela. Qualquer constraint que falhe lança e a
 * transação inteira do Espaço volta.
 */
export async function inserirPlano(cliente: PoolClient, espaco: string, plano: PlanoDeMigracao): Promise<Inseridos> {
  const { linhasPorTabela: linhas } = plano;
  const inseridos: Record<string, number> = {};

  // Contatos sobreviventes antes dos mesclados: `contatos_mesclado_em_fk` não é adiável. O mapeador já entrega
  // nessa ordem; a partição aqui só garante que um sobrevivente esteja inteiro numa instrução anterior.
  const sobreviventes = linhas.contatos.filter((contato) => contato.mesclado_em_id === null);
  const absorvidos = linhas.contatos.filter((contato) => contato.mesclado_em_id !== null);
  inseridos.contatos = (await inserirLinhas(cliente, espaco, CONTATOS, sobreviventes)) + (await inserirLinhas(cliente, espaco, CONTATOS, absorvidos));
  inseridos.contato_identificadores = await inserirLinhas(cliente, espaco, CONTATO_IDENTIFICADORES, linhas.contato_identificadores);
  inseridos.crm_de_para = await inserirLinhas(cliente, espaco, CRM_DE_PARA, plano.deParas);
  return inseridos;
}
