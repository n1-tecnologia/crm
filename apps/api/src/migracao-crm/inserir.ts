/**
 * Insere o plano do mapeador nas tabelas novas (15-28), dentro da transação de `executar()`.
 *
 * Um `insert` em lote por tabela e por pedaço de 500 linhas: as linhas viajam como UM parâmetro JSON
 * (`$2`) e o Postgres as lê com `jsonb_to_recordset`, com a lista de colunas EXPLÍCITA. Nome de tabela e de
 * coluna vêm só das constantes deste arquivo e todo valor entra por parâmetro (T-15-69): nenhum texto do
 * dado antigo é concatenado em SQL.
 *
 * A ordem é a das chaves estrangeiras (Canal, Contato sobrevivente, Contato mesclado, Identificador,
 * Empresa, vínculo, Negócio, Conversa, Mensagem, notas, consentimentos, marcações). A única constraint
 * adiada é a do admin da Empresa, conferida no `commit`: por isso o mapeador só entrega Empresa com vínculo
 * admin vigente e os dois vão na mesma transação.
 *
 * O Funil e as Etapas já foram inseridos por `inserirFunis` (15-27), antes: o Negócio guarda o id ANTIGO da
 * Etapa e aqui ele é trocado pelo id novo, lido da linha `funnels/stages` do `crm_de_para`.
 */

import type { PoolClient } from "pg";
import type { LinhaDeNegocio, PlanoDeMigracao } from "./mapeador";

/** Quantas linhas entraram em cada tabela. */
export type Inseridos = Readonly<Record<string, number>>;

interface Coluna {
  readonly nome: string;
  /** O tipo SQL da coluna no `jsonb_to_recordset`; sem tipo, a coluna não vem do JSON e a `expressao` a define. */
  readonly tipo?: string;
  /** O que entra na coluna a partir de `r.<nome>`; o padrão é o próprio valor. */
  readonly expressao?: string;
}

interface TabelaDeInsercao {
  readonly tabela: string;
  readonly colunas: readonly Coluna[];
}

const PEDACO = 500;

const c = (nome: string, tipo: string, expressao?: string): Coluna => (expressao === undefined ? { nome, tipo } : { nome, tipo, expressao });
/** Uma coluna cujo valor é uma constante do script, não do JSON. */
const fixa = (nome: string, expressao: string): Coluna => ({ nome, expressao });

const CRIADO_EM = c("criado_em", "timestamptz", "coalesce(r.criado_em, now())");
const JSON_LISTA = (nome: string): Coluna => c(nome, "jsonb", `coalesce(r.${nome}, '[]'::jsonb)`);

const CANAIS: TabelaDeInsercao = {
  tabela: "canais",
  colunas: [
    c("id", "text"),
    c("nome", "text"),
    c("tipo", "text"),
    c("provedor", "text"),
    c("identificador_externo", "text"),
    // O Canal migrado nasce desconectado: a conexão real só vem do provedor (D-08, 008).
    fixa("conexao", "'desconectada'"),
    c("estado", "text"),
    c("arquivado_em", "timestamptz"),
    c("configurado_por", "text"),
    c("fila_padrao_id", "text"),
    c("proprietario_padrao_id", "text"),
    c("origem_padrao_id", "text"),
    c("grupos_habilitados", "boolean"),
    c("criado_por", "text"),
    CRIADO_EM,
  ],
};

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
    JSON_LISTA("enderecos"),
    c("campos_adicionais", "jsonb", "coalesce(r.campos_adicionais, '{}'::jsonb)"),
    c("origem", "text"),
    c("qualificacao", "text"),
    c("modo_criacao", "text"),
    c("estado", "text"),
    c("mesclado_em_id", "text"),
    c("mesclado_em", "timestamptz"),
    c("proprietario_id", "text"),
    c("criado_por", "text"),
    CRIADO_EM,
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
    CRIADO_EM,
  ],
};

const EMPRESAS: TabelaDeInsercao = {
  tabela: "empresas",
  colunas: [
    c("id", "text"),
    c("nome_fantasia", "text"),
    c("razao_social", "text"),
    c("descricao", "text"),
    c("matriz_id", "text"),
    JSON_LISTA("enderecos"),
    c("campos_adicionais", "jsonb", "coalesce(r.campos_adicionais, '{}'::jsonb)"),
    c("origem", "text"),
    c("estado", "text"),
    c("proprietario_id", "text"),
    c("criado_por", "text"),
    CRIADO_EM,
  ],
};

const EMPRESA_IDENTIFICADORES: TabelaDeInsercao = {
  tabela: "empresa_identificadores",
  colunas: [
    c("id", "text"),
    c("empresa_id", "text"),
    c("tipo", "text"),
    c("valor", "text"),
    c("pais", "text"),
    c("verificado", "boolean"),
    c("principal", "boolean"),
    CRIADO_EM,
  ],
};

const CONTATO_EMPRESA: TabelaDeInsercao = {
  tabela: "contato_empresa",
  colunas: [
    c("id", "text"),
    c("contato_id", "text"),
    c("empresa_id", "text"),
    c("cargo", "text"),
    c("admin", "boolean"),
    c("inicio", "date"),
    c("fim", "date"),
    c("criado_por", "text"),
    CRIADO_EM,
  ],
};

const NEGOCIOS: TabelaDeInsercao = {
  tabela: "negocios",
  colunas: [
    c("id", "text"),
    c("titulo", "text"),
    c("objeto", "text"),
    c("descricao", "text"),
    c("empresa_id", "text"),
    c("contato_id", "text"),
    c("funil_id", "text"),
    c("etapa_id", "text"),
    c("valor", "numeric"),
    c("moeda", "text"),
    c("probabilidade", "smallint"),
    c("situacao", "text"),
    c("motivo_perda", "text"),
    c("motivo_ganho", "text"),
    c("nota_encerramento", "text"),
    c("origem", "text"),
    c("data_prevista_fechamento", "date"),
    c("encerrado_em", "timestamptz"),
    c("estado", "text"),
    c("proprietario_id", "text"),
    c("criado_por", "text"),
    CRIADO_EM,
  ],
};

const CONVERSAS: TabelaDeInsercao = {
  tabela: "conversas",
  colunas: [
    c("id", "text"),
    c("canal_id", "text"),
    c("contato_id", "text"),
    c("titulo", "text"),
    c("titulo_editado", "boolean"),
    c("situacao", "text"),
    c("estado", "text"),
    c("fila_id", "text"),
    c("atribuido_tipo", "text"),
    c("atribuido_id", "text"),
    c("adiada_ate", "timestamptz"),
    c("adiamento_motivo", "text"),
    JSON_LISTA("participantes"),
    c("resolvida_em", "timestamptz"),
    c("reaberta_em", "timestamptz"),
    c("reaberturas", "integer"),
    c("criado_por_tipo", "text"),
    c("criado_por_id", "text"),
    CRIADO_EM,
    c("na_lixeira_em", "timestamptz"),
  ],
};

const MENSAGENS: TabelaDeInsercao = {
  tabela: "mensagens",
  colunas: [
    c("id", "text"),
    c("conversa_id", "text"),
    c("canal_id", "text"),
    c("direcao", "text"),
    c("ator_tipo", "text"),
    c("ator_id", "text"),
    c("delegante_tipo", "text"),
    c("delegante_id", "text"),
    c("remetente_participante_id", "text"),
    c("identificador_id", "text"),
    c("conteudo", "text"),
    JSON_LISTA("anexos"),
    c("assunto", "text"),
    JSON_LISTA("enderecos_adicionais"),
    c("em_resposta_a_id", "text"),
    c("id_externo", "text"),
    c("status_entrega", "text"),
    c("motivo_falha", "text"),
    JSON_LISTA("leituras_internas"),
    JSON_LISTA("reacoes"),
    // `jsonb` nulo vindo do JSON seria o `'null'::jsonb`, que NÃO é NULL de SQL e satisfaria `mensagens_conteudo_ck`.
    c("marcacao_exclusao", "jsonb", "nullif(r.marcacao_exclusao, 'null'::jsonb)"),
    JSON_LISTA("edicoes_externas"),
    c("anonimizada", "boolean"),
    CRIADO_EM,
  ],
};

const CONTATO_NOTAS: TabelaDeInsercao = {
  tabela: "contato_notas",
  colunas: [c("contato_id", "text"), c("conteudo", "text"), c("autor_id", "text"), CRIADO_EM],
};

const CONTATO_CONSENTIMENTOS: TabelaDeInsercao = {
  tabela: "contato_consentimentos",
  colunas: [
    c("contato_id", "text"),
    c("finalidade_id", "text"),
    c("tipo_de_canal", "text"),
    c("decisao", "text"),
    c("em", "timestamptz"),
    c("origem", "text"),
    c("evidencia_mensagem_id", "text"),
    c("registrado_por", "text"),
    c("registrado_em", "timestamptz", "coalesce(r.registrado_em, now())"),
  ],
};

const CONVERSA_MARCACOES: TabelaDeInsercao = {
  tabela: "conversa_marcacoes",
  colunas: [c("conversa_id", "text"), c("membro_id", "text"), c("estrela", "boolean")],
};

const CRM_DE_PARA: TabelaDeInsercao = {
  tabela: "crm_de_para",
  colunas: [c("colecao_antiga", "text"), c("id_antigo", "text"), c("tabela_nova", "text"), c("id_novo", "text")],
};

/** O `insert ... select` de uma tabela: `$1` é o Espaço e `$2` o JSON com as linhas (cada uma com `n`, a posição). */
function sqlDeInsercao(spec: TabelaDeInsercao): string {
  const nomes = spec.colunas.map((col) => col.nome).join(", ");
  const expressoes = spec.colunas.map((col) => col.expressao ?? `r.${col.nome}`).join(", ");
  const definicoes = spec.colunas.filter((col) => col.tipo !== undefined).map((col) => `${col.nome} ${col.tipo}`).join(", ");
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

/** O id novo de cada Etapa (`funnels/stages` no `crm_de_para`), pela chave `<funil antigo>/<etapa antiga>`. */
async function lerEtapasMigradas(cliente: PoolClient, espaco: string): Promise<Map<string, string>> {
  const resultado = await cliente.query<{ id_antigo: string; id_novo: string }>(
    "select id_antigo, id_novo from plataforma.crm_de_para where workspace_id = $1 and colecao_antiga = 'funnels/stages'",
    [espaco],
  );
  return new Map(resultado.rows.map((linha) => [linha.id_antigo, linha.id_novo]));
}

/** O Negócio com o id NOVO da Etapa. Etapa sem de-para é falha do plano (o mapeador só entrega Etapa que migra): lança. */
function negocioComEtapaNova(negocio: LinhaDeNegocio, etapas: ReadonlyMap<string, string>): object {
  const etapaId = etapas.get(`${negocio.funil_id}/${negocio.etapa_id_antiga}`);
  if (etapaId === undefined) {
    throw new Error(`O Negócio ${negocio.id} aponta para uma Etapa que não foi migrada (Funil ${negocio.funil_id}). Nada foi gravado.`);
  }
  const { etapa_id_antiga: _antiga, ...resto } = negocio;
  return { ...resto, etapa_id: etapaId };
}

/**
 * Insere o plano. Devolve quantas linhas entraram em cada tabela. Qualquer constraint que falhe lança e a
 * transação inteira do Espaço volta.
 */
export async function inserirPlano(cliente: PoolClient, espaco: string, plano: PlanoDeMigracao): Promise<Inseridos> {
  const { linhasPorTabela: linhas } = plano;
  const inseridos: Record<string, number> = {};
  const inserir = async (spec: TabelaDeInsercao, dados: readonly object[]): Promise<number> => {
    inseridos[spec.tabela] = (inseridos[spec.tabela] ?? 0) + (await inserirLinhas(cliente, espaco, spec, dados));
    return inseridos[spec.tabela]!;
  };

  await inserir(CANAIS, linhas.canais);
  // Contatos sobreviventes antes dos mesclados: `contatos_mesclado_em_fk` não é adiável. O mapeador já entrega
  // nessa ordem; a partição aqui garante que o sobrevivente esteja inteiro numa instrução anterior.
  await inserir(CONTATOS, linhas.contatos.filter((contato) => contato.mesclado_em_id === null));
  await inserir(CONTATOS, linhas.contatos.filter((contato) => contato.mesclado_em_id !== null));
  await inserir(CONTATO_IDENTIFICADORES, linhas.contato_identificadores);
  await inserir(EMPRESAS, linhas.empresas);
  await inserir(EMPRESA_IDENTIFICADORES, linhas.empresa_identificadores);
  await inserir(CONTATO_EMPRESA, linhas.contato_empresa);

  const etapas = linhas.negocios.length > 0 ? await lerEtapasMigradas(cliente, espaco) : new Map<string, string>();
  await inserir(NEGOCIOS, linhas.negocios.map((negocio) => negocioComEtapaNova(negocio, etapas)));

  await inserir(CONVERSAS, linhas.conversas);
  await inserir(MENSAGENS, linhas.mensagens);
  await inserir(CONTATO_NOTAS, linhas.contato_notas);
  await inserir(CONTATO_CONSENTIMENTOS, linhas.contato_consentimentos);
  await inserir(CONVERSA_MARCACOES, linhas.conversa_marcacoes);
  await inserir(CRM_DE_PARA, plano.deParas);
  return inseridos;
}
