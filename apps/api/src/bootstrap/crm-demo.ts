/**
 * Carregador do CRM de demonstração (15-29, UCR-11, D-15-13): dá a um Espaço de DESENVOLVIMENTO os Contatos,
 * Empresas, Negócios, Canais e Conversas que o seed antigo tinha, agora nas tabelas do CRM novo.
 *
 * As linhas vêm de `crm-demo.json`, gerado UMA vez a partir da fixture sintética congelada do seed (mapeador do
 * 15-28). Este arquivo NÃO importa nada da pasta do script de migração do CRM antigo (que sai do repositório depois do corte) nem do
 * modelo antigo do domínio: só lê o JSON e grava com SQL.
 *
 * Por que JSON + colunas explícitas, e não um `.sql` de dados: a chave primária e as chaves estrangeiras
 * compostas incluem `workspace_id`, então um dump não se reaplica a outro Espaço; e `jsonb_populate_recordset`
 * não serve (coluna ausente vira `NULL`, não o `default`).
 *
 * Segurança (T-15-72, T-15-73):
 * - só roda em banco local: o host de `DATABASE_URL` tem de ser `localhost`, `127.0.0.1` ou `[::1]`, sem query
 *   (`?host=` trocaria o destino do `pg`), e isso é checado ANTES de qualquer consulta; a regra é a de
 *   `persistencia/host-local.ts`, a mesma de `testes/banco-crm.ts` e da CLI do corte (15-44, M-01);
 * - recusa `--espaco` fora de `^ws_[a-z0-9_]+$`, Espaço que não existe e Espaço que já tem Contato;
 * - nome de tabela e de coluna vêm só das constantes deste arquivo; todo valor entra por `$n` (o `workspace_id`
 *   é o argumento, nunca um campo do JSON).
 */

import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";
import { hostEhLocal } from "../persistencia/host-local";

/** Uma recusa esperada (host remoto, Espaço inválido, inexistente ou já carregado): a CLI sai com 2. */
export class RecusaDoDemo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RecusaDoDemo";
  }
}

export interface ResultadoDoDemo {
  readonly carregado: boolean;
  /** Quantas linhas entraram em cada tabela. */
  readonly linhas: Readonly<Record<string, number>>;
}

// --- A regra de host local ---

export { hostEhLocal };

/** Lança `RecusaDoDemo` se a URL não é de banco local. Pura: não conecta, não lê o ambiente. */
export function exigirBancoLocal(url: string | undefined): void {
  if (!hostEhLocal(url)) {
    throw new RecusaDoDemo(
      "O demo do CRM só roda em banco local (host localhost ou 127.0.0.1): ele insere Contatos, Negócios e Conversas de mentira. " +
        "Aponte DATABASE_URL para um Postgres local (por exemplo, o de Docker) e rode de novo.",
    );
  }
}

const ESPACO_VALIDO = /^ws_[a-z0-9_]+$/;

/** Lança `RecusaDoDemo` se o id do Espaço não tem a forma `ws_…`. Pura. */
export function validarEspacoDoDemo(espaco: string): void {
  if (!ESPACO_VALIDO.test(espaco)) {
    throw new RecusaDoDemo(`Espaço inválido: "${espaco}" (esperado algo como ws_dev; só letras minúsculas, números e _).`);
  }
}

// --- As tabelas e as colunas (constantes) ---

interface Coluna {
  readonly nome: string;
  /** O tipo SQL no `jsonb_to_recordset`; sem tipo, a coluna não vem do JSON e a `expressao` a define. */
  readonly tipo?: string;
  /** O que entra na coluna a partir de `r.<nome>`; o padrão é o próprio valor. */
  readonly expressao?: string;
}

const c = (nome: string, tipo: string, expressao?: string): Coluna => (expressao === undefined ? { nome, tipo } : { nome, tipo, expressao });

const CRIADO_EM = c("criado_em", "timestamptz", "coalesce(r.criado_em, now())");
const LISTA_JSON = (nome: string): Coluna => c(nome, "jsonb", `coalesce(r.${nome}, '[]'::jsonb)`);

/**
 * As colunas que entram em cada tabela, NA ORDEM das chaves estrangeiras. Nenhuma lista vem do JSON, e
 * `workspace_id` é sempre o `$1`.
 */
export const COLUNAS_POR_TABELA: Readonly<Record<string, readonly Coluna[]>> = {
  funis: [
    c("id", "text"),
    c("nome", "text"),
    c("descricao", "text"),
    c("cor", "text"),
    // Depois dos Funis que o Espaço já tenha.
    c("ordem", "integer", "r.ordem + (select coalesce(max(f.ordem), 0) from plataforma.funis f where f.workspace_id = $1)"),
    // Só um Funil padrão por Espaço (`funis_padrao_uq`): se o Espaço já tem, o do demo entra sem padrão.
    c("padrao", "boolean", "r.padrao and not exists (select 1 from plataforma.funis f where f.workspace_id = $1 and f.padrao)"),
    c("privado", "boolean"),
    c("exige_motivo_perda", "boolean"),
    c("exige_valor_ganho", "boolean"),
    c("estado", "text"),
    c("criado_por", "text"),
    CRIADO_EM,
  ],
  etapas: [
    c("id", "text"),
    c("funil_id", "text"),
    c("nome", "text"),
    c("ordem", "integer"),
    c("probabilidade_padrao", "smallint"),
    c("cor", "text"),
    c("descricao", "text"),
  ],
  canais: [
    c("id", "text"),
    c("nome", "text"),
    c("tipo", "text"),
    c("provedor", "text"),
    c("identificador_externo", "text"),
    // O Canal do demo nasce desconectado: a conexão real só vem do provedor.
    { nome: "conexao", expressao: "'desconectada'" },
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
  contatos: [
    c("id", "text"),
    c("nome", "text"),
    c("sobrenome", "text"),
    c("data_nascimento", "date"),
    c("idioma", "text"),
    c("fuso_horario", "text"),
    c("descricao", "text"),
    LISTA_JSON("enderecos"),
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
  contato_identificadores: [
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
  empresas: [
    c("id", "text"),
    c("nome_fantasia", "text"),
    c("razao_social", "text"),
    c("descricao", "text"),
    c("matriz_id", "text"),
    LISTA_JSON("enderecos"),
    c("campos_adicionais", "jsonb", "coalesce(r.campos_adicionais, '{}'::jsonb)"),
    c("origem", "text"),
    c("estado", "text"),
    c("proprietario_id", "text"),
    c("criado_por", "text"),
    CRIADO_EM,
  ],
  empresa_identificadores: [
    c("id", "text"),
    c("empresa_id", "text"),
    c("tipo", "text"),
    c("valor", "text"),
    c("pais", "text"),
    c("verificado", "boolean"),
    c("principal", "boolean"),
    CRIADO_EM,
  ],
  contato_empresa: [
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
  negocios: [
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
  conversas: [
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
    LISTA_JSON("participantes"),
    c("resolvida_em", "timestamptz"),
    c("reaberta_em", "timestamptz"),
    c("reaberturas", "integer"),
    c("criado_por_tipo", "text"),
    c("criado_por_id", "text"),
    CRIADO_EM,
    c("na_lixeira_em", "timestamptz"),
  ],
  mensagens: [
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
    LISTA_JSON("anexos"),
    c("assunto", "text"),
    LISTA_JSON("enderecos_adicionais"),
    c("em_resposta_a_id", "text"),
    c("id_externo", "text"),
    c("status_entrega", "text"),
    c("motivo_falha", "text"),
    LISTA_JSON("leituras_internas"),
    LISTA_JSON("reacoes"),
    // `jsonb` nulo vindo do JSON é o `'null'::jsonb`, que NÃO é NULL de SQL e satisfaria `mensagens_conteudo_ck`.
    c("marcacao_exclusao", "jsonb", "nullif(r.marcacao_exclusao, 'null'::jsonb)"),
    LISTA_JSON("edicoes_externas"),
    c("anonimizada", "boolean"),
    CRIADO_EM,
  ],
  contato_notas: [c("contato_id", "text"), c("conteudo", "text"), c("autor_id", "text"), CRIADO_EM],
  contato_consentimentos: [
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
  conversa_marcacoes: [c("conversa_id", "text"), c("membro_id", "text"), c("estrela", "boolean")],
};

const PEDACO = 500;

/** O `insert ... select` de uma tabela: `$1` é o Espaço e `$2` o JSON com as linhas (cada uma com `n`, a posição). */
function sqlDeInsercao(tabela: string, colunas: readonly Coluna[]): string {
  const nomes = colunas.map((col) => col.nome).join(", ");
  const expressoes = colunas.map((col) => col.expressao ?? `r.${col.nome}`).join(", ");
  const definicoes = colunas.filter((col) => col.tipo !== undefined).map((col) => `${col.nome} ${col.tipo}`).join(", ");
  return `insert into plataforma.${tabela} (workspace_id, ${nomes})
          select $1, ${expressoes}
            from jsonb_to_recordset($2::jsonb) as r(${definicoes}, n integer)
           order by r.n`;
}

async function inserirLinhas(cliente: PoolClient, espaco: string, tabela: string, linhas: readonly object[]): Promise<number> {
  const colunas = COLUNAS_POR_TABELA[tabela];
  if (colunas === undefined) throw new Error(`Tabela desconhecida no crm-demo.json: ${tabela}.`);
  const sql = sqlDeInsercao(tabela, colunas);
  let total = 0;
  for (let inicio = 0; inicio < linhas.length; inicio += PEDACO) {
    // `n` é a posição: a `seq` (identity) da Mensagem nasce na ordem da inserção.
    const pedaco = linhas.slice(inicio, inicio + PEDACO).map((linha, indice) => ({ ...linha, n: inicio + indice }));
    total += (await cliente.query(sql, [espaco, JSON.stringify(pedaco)])).rowCount ?? 0;
  }
  return total;
}

// --- O demo ---

export interface DemoEmJson {
  readonly tabelas: Readonly<Record<string, readonly object[]>>;
}

let demoEmCache: DemoEmJson | undefined;

/** Lê `crm-demo.json` (uma vez por processo). */
export function lerDemo(): DemoEmJson {
  demoEmCache ??= JSON.parse(readFileSync(new URL("./crm-demo.json", import.meta.url), "utf8")) as DemoEmJson;
  return demoEmCache;
}

export interface OpcoesDoDemo {
  readonly workspaceId: string;
  /** A URL do banco a que `cliente` está ligado; o padrão é `DATABASE_URL`. Existe para o teste provar a recusa. */
  readonly urlDoBanco?: string | undefined;
  /** O JSON do demo; o padrão é `crm-demo.json`. */
  readonly demo?: DemoEmJson;
}

/**
 * Carrega o demo no Espaço, numa transação só, na ordem das chaves estrangeiras. Lança `RecusaDoDemo` (antes
 * de qualquer consulta, no caso do host) se o banco não é local, se o Espaço é inválido ou inexistente, ou se
 * já tem algum Contato — assim, rodar duas vezes nunca duplica nada.
 */
export async function carregarCrmDemo(cliente: PoolClient, opcoes: OpcoesDoDemo): Promise<ResultadoDoDemo> {
  const { workspaceId } = opcoes;
  exigirBancoLocal("urlDoBanco" in opcoes ? opcoes.urlDoBanco : process.env.DATABASE_URL);
  validarEspacoDoDemo(workspaceId);
  const demo = opcoes.demo ?? lerDemo();
  for (const tabela of Object.keys(demo.tabelas)) {
    if (!(tabela in COLUNAS_POR_TABELA)) throw new Error(`Tabela desconhecida no crm-demo.json: ${tabela}.`);
  }

  await cliente.query("begin");
  try {
    // Trava a linha do Espaço: duas cargas ao mesmo tempo não passam juntas pela conferência abaixo.
    const espaco = await cliente.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [workspaceId]);
    if ((espaco.rowCount ?? 0) === 0) throw new RecusaDoDemo(`Espaço não encontrado: ${workspaceId}.`);
    const contatos = await cliente.query<{ n: number }>("select count(*)::int as n from plataforma.contatos where workspace_id = $1", [workspaceId]);
    if ((contatos.rows[0]?.n ?? 0) > 0) {
      throw new RecusaDoDemo(`Recusado: o Espaço já tem Contatos (${workspaceId}); o demo só carrega em Espaço sem Contato. Nada foi gravado.`);
    }

    const linhas: Record<string, number> = {};
    for (const tabela of Object.keys(COLUNAS_POR_TABELA)) {
      const doJson = demo.tabelas[tabela] ?? [];
      if (tabela === "contatos") {
        // O sobrevivente antes do mesclado: `contatos_mesclado_em_fk` não é adiável.
        const mesclado = (linha: object) => (linha as { mesclado_em_id?: string | null }).mesclado_em_id != null;
        linhas[tabela] = (await inserirLinhas(cliente, workspaceId, tabela, doJson.filter((l) => !mesclado(l)))) +
          (await inserirLinhas(cliente, workspaceId, tabela, doJson.filter(mesclado)));
      } else {
        linhas[tabela] = await inserirLinhas(cliente, workspaceId, tabela, doJson);
      }
    }
    await cliente.query("commit");
    return { carregado: true, linhas };
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  }
}
