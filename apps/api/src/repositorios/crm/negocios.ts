/**
 * Repositório de Negócios — a escrita e a leitura de `plataforma.negocios`.
 *
 * Regras que valem em todo método (as mesmas de `contatos.ts` e `funis.ts`):
 *   - todo `WHERE` leva `workspace_id = $1` (D-10, T-07-01): o Espaço vem do
 *     serviço, que o tira da sessão;
 *   - valores sempre `$n`, nunca interpolados (T-07-05); as colunas de um
 *     `UPDATE` vêm de lista fixa;
 *   - `valor` volta como texto (`valor::text`, `numeric(15,2)` não passa por
 *     `number`) e `data_prevista_fechamento` como `::text` (Pitfall 5) — nunca
 *     `types.setTypeParser` global, que mudaria o resto da api;
 *   - trocar o dono grava `empresa_id` e `contato_id` no MESMO `UPDATE`
 *     (`negocios_dono_ck` confere por linha, não por comando);
 *   - `atualizado_em` é do trigger da 007; os ids vêm do `default gen_random_uuid()::text`.
 *
 * Regra de negócio não mora aqui: encerrar, mover e reabrir só gravam o que o
 * serviço já decidiu com o domínio.
 */

import type { Pool, PoolClient } from "pg";
import type { EstadoCrm, Pagina, SituacaoNegocio } from "@n1/dominio/crm/comum";
import {
  probabilidadeEfetiva,
  type EdicaoDeNegocio,
  type Negocio,
  type NegocioResumo,
} from "@n1/dominio/crm/negocios";
import { CLAUSULA_ESCAPE, contemTexto } from "./sql";

export interface FiltroDaListaDeNegocios {
  readonly estado: EstadoCrm;
  readonly funilId?: string | undefined;
  readonly situacao?: SituacaoNegocio | undefined;
  readonly empresaId?: string | undefined;
  readonly contatoId?: string | undefined;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface LinhaDeNegocio {
  readonly titulo: string;
  readonly objeto?: string | undefined;
  readonly descricao?: string | undefined;
  readonly empresaId?: string | undefined;
  readonly contatoId?: string | undefined;
  readonly funilId: string;
  readonly etapaId: string;
  readonly valor?: string | undefined;
  readonly moeda?: string | undefined;
  readonly probabilidade?: number | undefined;
  readonly origem?: string | undefined;
  readonly dataPrevistaFechamento?: string | undefined;
  readonly proprietarioId: string;
  readonly criadoPor: string;
}

export interface DadosDeEncerramento {
  readonly situacao: "ganho" | "perdido";
  readonly valor?: string | undefined;
  readonly motivoPerda?: string | undefined;
  readonly motivoGanho?: string | undefined;
  readonly notaEncerramento?: string | undefined;
}

export interface RepositorioDeNegocios {
  listar(workspaceId: string, filtro: FiltroDaListaDeNegocios): Promise<Pagina<NegocioResumo>>;
  /** `travar` faz `select ... for update`: a transação segura o Negócio contra corrida. */
  obter(workspaceId: string, id: string, opcoes?: { readonly travar?: boolean }): Promise<Negocio | undefined>;
  inserir(workspaceId: string, linha: LinhaDeNegocio): Promise<Negocio>;
  /** Só as colunas presentes em `campos`; texto vazio e `null` limpam a coluna. Funil, Etapa e situação não passam por aqui. */
  atualizar(workspaceId: string, id: string, campos: EdicaoDeNegocio): Promise<Negocio | undefined>;
  /** Grava Funil, Etapa e `probabilidade = null` juntos (RN-NEG-05): a FK composta exige. */
  mover(workspaceId: string, id: string, funilId: string, etapaId: string): Promise<Negocio | undefined>;
  /** `encerrado_em = now()` e `probabilidade = null`; só `ganho` leva `motivo_ganho`, só `perdido` leva `motivo_perda`. */
  encerrar(workspaceId: string, id: string, dados: DadosDeEncerramento): Promise<Negocio | undefined>;
  /** Volta a `aberto` e limpa motivo, nota e momento de encerramento (RN-NEG-11); com destino, muda Funil e Etapa. */
  reabrir(
    workspaceId: string,
    id: string,
    destino?: { readonly funilId: string; readonly etapaId: string },
  ): Promise<Negocio | undefined>;
  definirEstado(workspaceId: string, id: string, estado: EstadoCrm): Promise<Negocio | undefined>;
  excluir(workspaceId: string, id: string): Promise<boolean>;
}

/** As colunas de `plataforma.negocios` na forma que `linhaParaNegocio` lê (numeric e date como texto). */
const COLUNAS = (alias: string): string => {
  const a = alias === "" ? "" : `${alias}.`;
  return `${a}id, ${a}titulo, ${a}objeto, ${a}descricao, ${a}empresa_id, ${a}contato_id, ${a}funil_id, ${a}etapa_id,
  ${a}valor::text as valor, ${a}moeda, ${a}probabilidade, ${a}situacao, ${a}motivo_perda, ${a}motivo_ganho,
  ${a}nota_encerramento, ${a}origem, ${a}data_prevista_fechamento::text as data_prevista_fechamento,
  ${a}encerrado_em, ${a}estado, ${a}proprietario_id, ${a}criado_por, ${a}criado_em, ${a}atualizado_em`;
};

interface LinhaDoBanco {
  readonly id: string;
  readonly titulo: string;
  readonly objeto: string | null;
  readonly descricao: string | null;
  readonly empresa_id: string | null;
  readonly contato_id: string | null;
  readonly funil_id: string;
  readonly etapa_id: string;
  readonly valor: string | null;
  readonly moeda: string;
  readonly probabilidade: number | null;
  readonly situacao: SituacaoNegocio;
  readonly motivo_perda: string | null;
  readonly motivo_ganho: string | null;
  readonly nota_encerramento: string | null;
  readonly origem: string | null;
  readonly data_prevista_fechamento: string | null;
  readonly encerrado_em: Date | null;
  readonly estado: EstadoCrm;
  readonly proprietario_id: string;
  readonly criado_por: string;
  readonly criado_em: Date;
  readonly atualizado_em: Date;
}

/** snake_case → camelCase; `Date` → ISO 8601. */
export function linhaParaNegocio(linha: LinhaDoBanco): Negocio {
  return {
    id: linha.id,
    titulo: linha.titulo,
    objeto: linha.objeto,
    descricao: linha.descricao,
    empresaId: linha.empresa_id,
    contatoId: linha.contato_id,
    funilId: linha.funil_id,
    etapaId: linha.etapa_id,
    valor: linha.valor,
    moeda: linha.moeda,
    probabilidade: linha.probabilidade,
    situacao: linha.situacao,
    motivoPerda: linha.motivo_perda,
    motivoGanho: linha.motivo_ganho,
    notaEncerramento: linha.nota_encerramento,
    origem: linha.origem,
    dataPrevistaFechamento: linha.data_prevista_fechamento,
    encerradoEm: linha.encerrado_em ? linha.encerrado_em.toISOString() : null,
    estado: linha.estado,
    proprietarioId: linha.proprietario_id,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em.toISOString(),
    atualizadoEm: linha.atualizado_em.toISOString(),
  };
}

/** Texto vazio (depois de aparado) é "sem valor" no banco. */
const textoOuNulo = (texto: string | null): string | null => (texto === null || texto.trim() === "" ? null : texto.trim());

/** O nome de exibição da Empresa na própria consulta: nome fantasia, senão razão social. */
const NOME_DA_EMPRESA = `coalesce(nullif(btrim(em.nome_fantasia), ''), nullif(btrim(em.razao_social), ''), 'Empresa sem nome')`;

/** O do Contato: nome completo, senão o Identificador principal (e-mail antes de telefone), senão o rótulo vazio. */
const NOME_DO_CONTATO = `coalesce(
  nullif(btrim(concat_ws(' ', co.nome, co.sobrenome)), ''),
  (select i.valor from plataforma.contato_identificadores i
    where i.workspace_id = co.workspace_id and i.contato_id = co.id and i.principal
    order by (i.tipo = 'email') desc, i.criado_em limit 1),
  'Contato sem nome')`;

interface LinhaDoResumo extends LinhaDoBanco {
  readonly probabilidade_padrao: number;
  readonly empresa_nome: string | null;
  readonly contato_nome: string | null;
}

export function criarRepositorioDeNegociosPg(cliente: Pool | PoolClient): RepositorioDeNegocios {
  return {
    async listar(workspaceId, filtro) {
      // Filtros por coluna em lista FIXA: nenhum nome de coluna vem do cliente (T-07-05).
      const parametros: unknown[] = [workspaceId, filtro.estado];
      const condicoes: string[] = [];
      const adicionar = (coluna: string, valor: unknown): void => {
        parametros.push(valor);
        condicoes.push(`and n.${coluna} = $${parametros.length}`);
      };
      if (filtro.funilId !== undefined) adicionar("funil_id", filtro.funilId);
      if (filtro.situacao !== undefined) adicionar("situacao", filtro.situacao);
      if (filtro.empresaId !== undefined) adicionar("empresa_id", filtro.empresaId);
      if (filtro.contatoId !== undefined) adicionar("contato_id", filtro.contatoId);
      const texto = filtro.q?.trim() ?? "";
      if (texto !== "") {
        parametros.push(contemTexto(texto));
        condicoes.push(`and n.titulo ilike $${parametros.length} ${CLAUSULA_ESCAPE}`);
      }
      const onde = condicoes.join(" ");
      const total = await cliente.query<{ total: number }>(
        `select count(*)::int as total
           from plataforma.negocios n
          where n.workspace_id = $1 and n.estado = $2 ${onde}`,
        parametros,
      );
      parametros.push(filtro.limite, filtro.deslocamento);
      const pagina = await cliente.query<LinhaDoResumo>(
        `select ${COLUNAS("n")},
                e.probabilidade_padrao,
                case when em.id is null then null else ${NOME_DA_EMPRESA} end as empresa_nome,
                case when co.id is null then null else ${NOME_DO_CONTATO} end as contato_nome
           from plataforma.negocios n
           join plataforma.etapas e
             on e.workspace_id = n.workspace_id and e.funil_id = n.funil_id and e.id = n.etapa_id
           left join plataforma.empresas em
             on em.workspace_id = n.workspace_id and em.id = n.empresa_id
           left join plataforma.contatos co
             on co.workspace_id = n.workspace_id and co.id = n.contato_id
          where n.workspace_id = $1 and n.estado = $2 ${onde}
          order by n.atualizado_em desc, n.id
          limit $${parametros.length - 1} offset $${parametros.length}`,
        parametros,
      );
      return {
        total: total.rows[0]?.total ?? 0,
        itens: pagina.rows.map((linha) => {
          const negocio = linhaParaNegocio(linha);
          return {
            id: negocio.id,
            titulo: negocio.titulo,
            valor: negocio.valor,
            moeda: negocio.moeda,
            probabilidadeEfetiva: probabilidadeEfetiva(negocio, { probabilidadePadrao: linha.probabilidade_padrao }),
            situacao: negocio.situacao,
            estado: negocio.estado,
            funilId: negocio.funilId,
            etapaId: negocio.etapaId,
            empresa: negocio.empresaId !== null ? { id: negocio.empresaId, nome: linha.empresa_nome ?? "Empresa sem nome" } : null,
            contato: negocio.contatoId !== null ? { id: negocio.contatoId, nome: linha.contato_nome ?? "Contato sem nome" } : null,
            proprietarioId: negocio.proprietarioId,
            dataPrevistaFechamento: negocio.dataPrevistaFechamento,
            encerradoEm: negocio.encerradoEm,
            atualizadoEm: negocio.atualizadoEm,
          };
        }),
      };
    },

    async obter(workspaceId, id, opcoes) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `select ${COLUNAS("")} from plataforma.negocios where workspace_id = $1 and id = $2${opcoes?.travar ? " for update" : ""}`,
        [workspaceId, id],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaNegocio(linha) : undefined;
    },

    async inserir(workspaceId, linha) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `insert into plataforma.negocios
           (workspace_id, titulo, objeto, descricao, empresa_id, contato_id, funil_id, etapa_id, valor, moeda,
            probabilidade, origem, data_prevista_fechamento, proprietario_id, criado_por)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, coalesce($10, 'BRL'), $11, $12, $13::date, $14, $15)
         returning ${COLUNAS("")}`,
        [
          workspaceId,
          linha.titulo.trim(),
          textoOuNulo(linha.objeto ?? null),
          textoOuNulo(linha.descricao ?? null),
          linha.empresaId ?? null,
          linha.contatoId ?? null,
          linha.funilId,
          linha.etapaId,
          linha.valor ?? null,
          linha.moeda ?? null,
          linha.probabilidade ?? null,
          textoOuNulo(linha.origem ?? null),
          linha.dataPrevistaFechamento ?? null,
          linha.proprietarioId,
          linha.criadoPor,
        ],
      );
      const inserida = resultado.rows[0];
      if (!inserida) throw new Error("O INSERT de Negócio não devolveu a linha.");
      return linhaParaNegocio(inserida);
    },

    async atualizar(workspaceId, id, campos) {
      const valores: unknown[] = [workspaceId, id];
      const definicoes: string[] = [];
      const definir = (coluna: string, valor: unknown, conversao = ""): void => {
        valores.push(valor);
        definicoes.push(`${coluna} = $${valores.length}${conversao}`);
      };
      if (campos.titulo !== undefined) definir("titulo", campos.titulo.trim());
      if (campos.objeto !== undefined) definir("objeto", textoOuNulo(campos.objeto));
      if (campos.descricao !== undefined) definir("descricao", textoOuNulo(campos.descricao));
      // A troca de dono grava os dois lados no MESMO comando (`negocios_dono_ck`).
      if (campos.empresaId !== undefined) definir("empresa_id", campos.empresaId);
      if (campos.contatoId !== undefined) definir("contato_id", campos.contatoId);
      if (campos.valor !== undefined) definir("valor", campos.valor, "::numeric");
      if (campos.moeda !== undefined) definir("moeda", campos.moeda);
      if (campos.probabilidade !== undefined) definir("probabilidade", campos.probabilidade);
      if (campos.origem !== undefined) definir("origem", textoOuNulo(campos.origem));
      if (campos.dataPrevistaFechamento !== undefined) {
        definir("data_prevista_fechamento", campos.dataPrevistaFechamento, "::date");
      }
      if (campos.proprietarioId !== undefined) definir("proprietario_id", campos.proprietarioId);
      if (definicoes.length === 0) return this.obter(workspaceId, id);
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.negocios set ${definicoes.join(", ")} where workspace_id = $1 and id = $2 returning ${COLUNAS("")}`,
        valores,
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaNegocio(linha) : undefined;
    },

    async mover(workspaceId, id, funilId, etapaId) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.negocios
            set funil_id = $3, etapa_id = $4, probabilidade = null
          where workspace_id = $1 and id = $2
          returning ${COLUNAS("")}`,
        [workspaceId, id, funilId, etapaId],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaNegocio(linha) : undefined;
    },

    async encerrar(workspaceId, id, dados) {
      const ganho = dados.situacao === "ganho";
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.negocios
            set situacao = $3,
                encerrado_em = now(),
                probabilidade = null,
                valor = coalesce($4::numeric, valor),
                motivo_perda = $5,
                motivo_ganho = $6,
                nota_encerramento = $7
          where workspace_id = $1 and id = $2
          returning ${COLUNAS("")}`,
        [
          workspaceId,
          id,
          dados.situacao,
          dados.valor ?? null,
          ganho ? null : textoOuNulo(dados.motivoPerda ?? null),
          ganho ? textoOuNulo(dados.motivoGanho ?? null) : null,
          textoOuNulo(dados.notaEncerramento ?? null),
        ],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaNegocio(linha) : undefined;
    },

    async reabrir(workspaceId, id, destino) {
      const valores: unknown[] = [workspaceId, id];
      let mudanca = "";
      if (destino) {
        valores.push(destino.funilId, destino.etapaId);
        mudanca = ", funil_id = $3, etapa_id = $4, probabilidade = null";
      }
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.negocios
            set situacao = 'aberto',
                encerrado_em = null,
                motivo_perda = null,
                motivo_ganho = null,
                nota_encerramento = null${mudanca}
          where workspace_id = $1 and id = $2
          returning ${COLUNAS("")}`,
        valores,
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaNegocio(linha) : undefined;
    },

    async definirEstado(workspaceId, id, estado) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.negocios set estado = $3 where workspace_id = $1 and id = $2 returning ${COLUNAS("")}`,
        [workspaceId, id, estado],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaNegocio(linha) : undefined;
    },

    async excluir(workspaceId, id) {
      const resultado = await cliente.query("delete from plataforma.negocios where workspace_id = $1 and id = $2", [workspaceId, id]);
      return (resultado.rowCount ?? 0) > 0;
    },
  };
}
