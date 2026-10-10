/**
 * Repositório de Funis e Etapas — a escrita e a leitura de `plataforma.funis`,
 * `plataforma.etapas` e a contagem/migração dos Negócios que as referenciam.
 *
 * Regras que valem em todo método (as mesmas de `contatos.ts`):
 *   - todo `WHERE` leva `workspace_id = $1` (D-10, T-07-01): o Espaço vem do
 *     serviço, que o tira da sessão;
 *   - valores sempre `$n`, nunca interpolados (T-07-05); as colunas de um
 *     `UPDATE` vêm de lista fixa;
 *   - reordenar é UM `UPDATE` com permutação completa (Pitfall 7): `etapas_ordem_uq`
 *     é `deferrable initially immediate`, então só é conferida no fim do comando;
 *   - Negócio é só lido e movido de Funil/Etapa aqui — a escrita de Negócio é de 07-08.
 */

import type { Pool, PoolClient } from "pg";
import type { ContagemDeNegocios, EdicaoDeEtapa, EdicaoDeFunil, Etapa, EtapaDetalhada, Funil, FunilResumo, MapeamentoDeEtapas } from "@n1/dominio/crm/funis";
import type { EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import { CLAUSULA_ESCAPE, contemTexto } from "./sql";

export interface FiltroDeFunis {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface LinhaDeFunil {
  readonly nome: string;
  readonly descricao?: string | undefined;
  readonly cor?: string | undefined;
  readonly privado: boolean;
  readonly padrao: boolean;
  readonly exigeMotivoPerda: boolean;
  readonly exigeValorGanho: boolean;
  readonly criadoPor: string;
}

export interface LinhaDeEtapa {
  readonly funilId: string;
  readonly nome: string;
  readonly ordem: number;
  readonly probabilidadePadrao: number;
  readonly cor?: string | undefined;
  readonly descricao?: string | undefined;
}

export interface FiltroDeNegocios {
  readonly funilId?: string | undefined;
  readonly etapaId?: string | undefined;
  /** Só `situacao = 'aberto'`, em qualquer estado (RN-FUN-12). */
  readonly apenasAbertos?: boolean | undefined;
}

export interface RepositorioDeFunis {
  listar(workspaceId: string, filtro: FiltroDeFunis): Promise<Pagina<FunilResumo>>;
  /** `travar` faz `select ... for update`: a transação segura o Funil contra corrida. */
  obter(workspaceId: string, id: string, opcoes?: { readonly travar?: boolean }): Promise<Funil | undefined>;
  listarEtapas(workspaceId: string, funilId: string): Promise<EtapaDetalhada[]>;
  obterEtapa(workspaceId: string, etapaId: string): Promise<Etapa | undefined>;
  /** Serializa as decisões sobre o Funil padrão do Espaço até o fim da transação (D-13). */
  travarPadrao(workspaceId: string): Promise<void>;
  existePadrao(workspaceId: string): Promise<boolean>;
  /** O Funil que um Negócio recebe sem Funil explícito (07-08, RN-NEG-03). */
  funilPadrao(workspaceId: string): Promise<Funil | undefined>;
  /** Há outro Funil `ativo` ou `arquivado` com este nome (RN-FUN-02)? Sem distinguir caixa nem espaços. */
  nomeEmUso(workspaceId: string, nome: string, exceto?: string): Promise<boolean>;

  inserirFunil(workspaceId: string, linha: LinhaDeFunil): Promise<Funil>;
  inserirEtapa(workspaceId: string, linha: LinhaDeEtapa): Promise<Etapa>;
  /** UM `UPDATE`: abre espaço para uma Etapa nova na posição `aPartirDe`. */
  deslocarOrdens(workspaceId: string, funilId: string, aPartirDe: number): Promise<void>;
  atualizarFunil(workspaceId: string, id: string, campos: EdicaoDeFunil): Promise<Funil | undefined>;
  atualizarEtapa(workspaceId: string, etapaId: string, campos: EdicaoDeEtapa): Promise<Etapa | undefined>;
  /** UM `UPDATE ... CASE`: `etapaIds` é a permutação completa, na nova ordem (1..n). */
  reordenar(workspaceId: string, funilId: string, etapaIds: readonly string[]): Promise<void>;
  /** Apaga a Etapa e recompacta as ordens do Funil em 1..n. */
  removerEtapa(workspaceId: string, funilId: string, etapaId: string): Promise<boolean>;

  contarNegocios(workspaceId: string, filtro: FiltroDeNegocios): Promise<ContagemDeNegocios>;
  /** Move os Negócios de uma Etapa para outra do MESMO Funil; a probabilidade do Negócio não é tocada (RN-FUN-08). */
  remapear(workspaceId: string, funilId: string, deEtapaId: string, paraEtapaId: string): Promise<number>;
  /** Um `UPDATE` por par, `funil_id` e `etapa_id` juntos — a FK composta exige. Devolve quantos Negócios mudaram. */
  migrar(workspaceId: string, origemId: string, destinoId: string, mapeamento: MapeamentoDeEtapas): Promise<number>;

  definirEstado(workspaceId: string, id: string, estado: EstadoCrm): Promise<Funil | undefined>;
  desmarcarPadrao(workspaceId: string): Promise<void>;
  marcarPadrao(workspaceId: string, id: string): Promise<Funil | undefined>;
  excluir(workspaceId: string, id: string): Promise<boolean>;
}

const COLUNAS_FUNIL = `id, nome, descricao, cor, ordem, padrao, privado, exige_motivo_perda, exige_valor_ganho,
  estado, criado_por, criado_em, atualizado_em`;

const COLUNAS_ETAPA = "id, funil_id, nome, ordem, probabilidade_padrao, cor, descricao, criado_em";

/** `a, b` → `x.a, x.b`: as mesmas colunas, com o alias da tabela numa consulta com junção. */
function comAlias(colunas: string, alias: string): string {
  return colunas
    .split(",")
    .map((coluna) => `${alias}.${coluna.trim()}`)
    .join(", ");
}

interface LinhaDoBancoFunil {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly cor: string | null;
  readonly ordem: number;
  readonly padrao: boolean;
  readonly privado: boolean;
  readonly exige_motivo_perda: boolean;
  readonly exige_valor_ganho: boolean;
  readonly estado: EstadoCrm;
  readonly criado_por: string;
  readonly criado_em: Date;
  readonly atualizado_em: Date;
}

interface LinhaDoBancoEtapa {
  readonly id: string;
  readonly funil_id: string;
  readonly nome: string;
  readonly ordem: number;
  readonly probabilidade_padrao: number;
  readonly cor: string | null;
  readonly descricao: string | null;
  readonly criado_em: Date;
}

/** snake_case → camelCase; `Date` → ISO 8601. */
export function linhaParaFunil(linha: LinhaDoBancoFunil): Funil {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    cor: linha.cor,
    ordem: linha.ordem,
    padrao: linha.padrao,
    privado: linha.privado,
    exigeMotivoPerda: linha.exige_motivo_perda,
    exigeValorGanho: linha.exige_valor_ganho,
    estado: linha.estado,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em.toISOString(),
    atualizadoEm: linha.atualizado_em.toISOString(),
  };
}

export function linhaParaEtapa(linha: LinhaDoBancoEtapa): Etapa {
  return {
    id: linha.id,
    funilId: linha.funil_id,
    nome: linha.nome,
    ordem: linha.ordem,
    probabilidadePadrao: linha.probabilidade_padrao,
    cor: linha.cor,
    descricao: linha.descricao,
    criadoEm: linha.criado_em.toISOString(),
  };
}

interface LinhaDeContagem {
  readonly abertos: number;
  readonly ganhos: number;
  readonly perdidos: number;
  readonly arquivados: number;
  readonly na_lixeira: number;
  readonly total: number;
}

/**
 * Os cinco números disjuntos: `abertos`/`ganhos`/`perdidos` contam Negócios
 * `ativo` por situação; `arquivados` e `naLixeira` contam por estado, em
 * qualquer situação. A soma dos cinco é `total`.
 */
const SELECT_CONTAGEM = `
  count(*) filter (where n.estado = 'ativo' and n.situacao = 'aberto')::int as abertos,
  count(*) filter (where n.estado = 'ativo' and n.situacao = 'ganho')::int as ganhos,
  count(*) filter (where n.estado = 'ativo' and n.situacao = 'perdido')::int as perdidos,
  count(*) filter (where n.estado = 'arquivado')::int as arquivados,
  count(*) filter (where n.estado = 'na_lixeira')::int as na_lixeira,
  count(n.id)::int as total`;

function contagem(linha: LinhaDeContagem | undefined): ContagemDeNegocios {
  return {
    abertos: linha?.abertos ?? 0,
    ganhos: linha?.ganhos ?? 0,
    perdidos: linha?.perdidos ?? 0,
    arquivados: linha?.arquivados ?? 0,
    naLixeira: linha?.na_lixeira ?? 0,
    total: linha?.total ?? 0,
  };
}

/** Texto vazio (depois de aparado) é "sem valor" no banco. */
const textoOuNulo = (texto: string): string | null => (texto.trim() === "" ? null : texto.trim());

export function criarRepositorioDeFunisPg(cliente: Pool | PoolClient): RepositorioDeFunis {
  return {
    async listar(workspaceId, filtro) {
      const parametros: unknown[] = [workspaceId, filtro.estado];
      let busca = "";
      const texto = filtro.q?.trim() ?? "";
      if (texto !== "") {
        parametros.push(contemTexto(texto));
        busca = `and f.nome ilike $${parametros.length} ${CLAUSULA_ESCAPE}`;
      }
      const total = await cliente.query<{ total: number }>(
        `select count(*)::int as total from plataforma.funis f where f.workspace_id = $1 and f.estado = $2 ${busca}`,
        parametros,
      );
      parametros.push(filtro.limite, filtro.deslocamento);
      const pagina = await cliente.query<LinhaDoBancoFunil & { total_etapas: number; negocios_abertos: number }>(
        `select ${comAlias(COLUNAS_FUNIL, "f")},
                (select count(*)::int from plataforma.etapas e
                  where e.workspace_id = f.workspace_id and e.funil_id = f.id) as total_etapas,
                (select count(*)::int from plataforma.negocios n
                  where n.workspace_id = f.workspace_id and n.funil_id = f.id
                    and n.estado = 'ativo' and n.situacao = 'aberto') as negocios_abertos
           from plataforma.funis f
          where f.workspace_id = $1 and f.estado = $2 ${busca}
          order by f.padrao desc, f.ordem, lower(f.nome), f.id
          limit $${parametros.length - 1} offset $${parametros.length}`,
        parametros,
      );
      return {
        total: total.rows[0]?.total ?? 0,
        itens: pagina.rows.map((linha) => ({
          funil: linhaParaFunil(linha),
          totalEtapas: linha.total_etapas,
          negociosAbertos: linha.negocios_abertos,
        })),
      };
    },

    async obter(workspaceId, id, opcoes) {
      const resultado = await cliente.query<LinhaDoBancoFunil>(
        `select ${COLUNAS_FUNIL} from plataforma.funis where workspace_id = $1 and id = $2${opcoes?.travar ? " for update" : ""}`,
        [workspaceId, id],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaFunil(linha) : undefined;
    },

    async listarEtapas(workspaceId, funilId) {
      const resultado = await cliente.query<LinhaDoBancoEtapa & LinhaDeContagem>(
        `select ${comAlias(COLUNAS_ETAPA, "e")}, ${SELECT_CONTAGEM}
           from plataforma.etapas e
           left join plataforma.negocios n
             on n.workspace_id = e.workspace_id and n.funil_id = e.funil_id and n.etapa_id = e.id
          where e.workspace_id = $1 and e.funil_id = $2
          group by e.workspace_id, e.id
          order by e.ordem`,
        [workspaceId, funilId],
      );
      return resultado.rows.map((linha) => ({ ...linhaParaEtapa(linha), negocios: contagem(linha) }));
    },

    async obterEtapa(workspaceId, etapaId) {
      const resultado = await cliente.query<LinhaDoBancoEtapa>(
        `select ${COLUNAS_ETAPA} from plataforma.etapas where workspace_id = $1 and id = $2`,
        [workspaceId, etapaId],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaEtapa(linha) : undefined;
    },

    async travarPadrao(workspaceId) {
      await cliente.query("select pg_advisory_xact_lock(hashtext($1))", [`funil-padrao:${workspaceId}`]);
    },

    async existePadrao(workspaceId) {
      const resultado = await cliente.query(
        "select 1 from plataforma.funis where workspace_id = $1 and padrao limit 1",
        [workspaceId],
      );
      return (resultado.rowCount ?? 0) > 0;
    },

    async funilPadrao(workspaceId) {
      const resultado = await cliente.query<LinhaDoBancoFunil>(
        `select ${COLUNAS_FUNIL} from plataforma.funis where workspace_id = $1 and padrao`,
        [workspaceId],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaFunil(linha) : undefined;
    },

    async nomeEmUso(workspaceId, nome, exceto) {
      const resultado = await cliente.query(
        `select 1 from plataforma.funis
          where workspace_id = $1 and lower(btrim(nome)) = lower(btrim($2)) and estado <> 'na_lixeira'
            and ($3::text is null or id <> $3)
          limit 1`,
        [workspaceId, nome, exceto ?? null],
      );
      return (resultado.rowCount ?? 0) > 0;
    },

    async inserirFunil(workspaceId, linha) {
      const resultado = await cliente.query<LinhaDoBancoFunil>(
        `insert into plataforma.funis
           (workspace_id, nome, descricao, cor, ordem, padrao, privado, exige_motivo_perda, exige_valor_ganho, criado_por)
         values ($1, $2, $3, $4,
                 (select coalesce(max(ordem), 0) + 1 from plataforma.funis where workspace_id = $1),
                 $5, $6, $7, $8, $9)
         returning ${COLUNAS_FUNIL}`,
        [
          workspaceId,
          linha.nome.trim(),
          linha.descricao === undefined ? null : textoOuNulo(linha.descricao),
          linha.cor === undefined ? null : textoOuNulo(linha.cor),
          linha.padrao,
          linha.privado,
          linha.exigeMotivoPerda,
          linha.exigeValorGanho,
          linha.criadoPor,
        ],
      );
      const inserido = resultado.rows[0];
      if (!inserido) throw new Error("O INSERT de Funil não devolveu a linha.");
      return linhaParaFunil(inserido);
    },

    async inserirEtapa(workspaceId, linha) {
      const resultado = await cliente.query<LinhaDoBancoEtapa>(
        `insert into plataforma.etapas (workspace_id, funil_id, nome, ordem, probabilidade_padrao, cor, descricao)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning ${COLUNAS_ETAPA}`,
        [
          workspaceId,
          linha.funilId,
          linha.nome.trim(),
          linha.ordem,
          linha.probabilidadePadrao,
          linha.cor === undefined ? null : textoOuNulo(linha.cor),
          linha.descricao === undefined ? null : textoOuNulo(linha.descricao),
        ],
      );
      const inserida = resultado.rows[0];
      if (!inserida) throw new Error("O INSERT de Etapa não devolveu a linha.");
      return linhaParaEtapa(inserida);
    },

    async deslocarOrdens(workspaceId, funilId, aPartirDe) {
      await cliente.query(
        "update plataforma.etapas set ordem = ordem + 1 where workspace_id = $1 and funil_id = $2 and ordem >= $3",
        [workspaceId, funilId, aPartirDe],
      );
    },

    async atualizarFunil(workspaceId, id, campos) {
      const atribuicoes: string[] = [];
      const parametros: unknown[] = [workspaceId, id];
      const definir = (coluna: string, valor: unknown): void => {
        parametros.push(valor);
        atribuicoes.push(`${coluna} = $${parametros.length}`);
      };
      if (campos.nome !== undefined) definir("nome", campos.nome.trim());
      if (campos.descricao !== undefined) definir("descricao", textoOuNulo(campos.descricao));
      if (campos.cor !== undefined) definir("cor", textoOuNulo(campos.cor));
      if (campos.privado !== undefined) definir("privado", campos.privado);
      if (campos.exigeMotivoPerda !== undefined) definir("exige_motivo_perda", campos.exigeMotivoPerda);
      if (campos.exigeValorGanho !== undefined) definir("exige_valor_ganho", campos.exigeValorGanho);
      if (campos.ordem !== undefined) definir("ordem", campos.ordem);
      if (atribuicoes.length === 0) {
        const atual = await cliente.query<LinhaDoBancoFunil>(
          `select ${COLUNAS_FUNIL} from plataforma.funis where workspace_id = $1 and id = $2`,
          parametros,
        );
        const linha = atual.rows[0];
        return linha ? linhaParaFunil(linha) : undefined;
      }
      const resultado = await cliente.query<LinhaDoBancoFunil>(
        `update plataforma.funis set ${atribuicoes.join(", ")} where workspace_id = $1 and id = $2 returning ${COLUNAS_FUNIL}`,
        parametros,
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaFunil(linha) : undefined;
    },

    async atualizarEtapa(workspaceId, etapaId, campos) {
      const atribuicoes: string[] = [];
      const parametros: unknown[] = [workspaceId, etapaId];
      const definir = (coluna: string, valor: unknown): void => {
        parametros.push(valor);
        atribuicoes.push(`${coluna} = $${parametros.length}`);
      };
      if (campos.nome !== undefined) definir("nome", campos.nome.trim());
      if (campos.probabilidadePadrao !== undefined) definir("probabilidade_padrao", campos.probabilidadePadrao);
      if (campos.cor !== undefined) definir("cor", textoOuNulo(campos.cor));
      if (campos.descricao !== undefined) definir("descricao", textoOuNulo(campos.descricao));
      if (atribuicoes.length === 0) {
        const atual = await cliente.query<LinhaDoBancoEtapa>(
          `select ${COLUNAS_ETAPA} from plataforma.etapas where workspace_id = $1 and id = $2`,
          parametros,
        );
        const linha = atual.rows[0];
        return linha ? linhaParaEtapa(linha) : undefined;
      }
      const resultado = await cliente.query<LinhaDoBancoEtapa>(
        `update plataforma.etapas set ${atribuicoes.join(", ")} where workspace_id = $1 and id = $2 returning ${COLUNAS_ETAPA}`,
        parametros,
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaEtapa(linha) : undefined;
    },

    async reordenar(workspaceId, funilId, etapaIds) {
      if (etapaIds.length === 0) return;
      const parametros: unknown[] = [workspaceId, funilId];
      const quando: string[] = [];
      const ids: string[] = [];
      etapaIds.forEach((id, indice) => {
        parametros.push(id);
        const marcador = `$${parametros.length}`;
        quando.push(`when ${marcador} then ${indice + 1}`);
        ids.push(marcador);
      });
      await cliente.query(
        `update plataforma.etapas
            set ordem = case id ${quando.join(" ")} end
          where workspace_id = $1 and funil_id = $2 and id in (${ids.join(", ")})`,
        parametros,
      );
    },

    async removerEtapa(workspaceId, funilId, etapaId) {
      const apagada = await cliente.query(
        "delete from plataforma.etapas where workspace_id = $1 and funil_id = $2 and id = $3",
        [workspaceId, funilId, etapaId],
      );
      if ((apagada.rowCount ?? 0) === 0) return false;
      // Recompacta em 1..n num comando só (a unicidade de `ordem` é conferida no fim dele).
      await cliente.query(
        `update plataforma.etapas e set ordem = r.nova
           from (select id, row_number() over (order by ordem)::int as nova
                   from plataforma.etapas where workspace_id = $1 and funil_id = $2) r
          where e.workspace_id = $1 and e.funil_id = $2 and e.id = r.id and e.ordem <> r.nova`,
        [workspaceId, funilId],
      );
      return true;
    },

    async contarNegocios(workspaceId, filtro) {
      const parametros: unknown[] = [workspaceId];
      const condicoes = ["n.workspace_id = $1"];
      if (filtro.funilId !== undefined) {
        parametros.push(filtro.funilId);
        condicoes.push(`n.funil_id = $${parametros.length}`);
      }
      if (filtro.etapaId !== undefined) {
        parametros.push(filtro.etapaId);
        condicoes.push(`n.etapa_id = $${parametros.length}`);
      }
      if (filtro.apenasAbertos) condicoes.push("n.situacao = 'aberto'");
      const resultado = await cliente.query<LinhaDeContagem>(
        `select ${SELECT_CONTAGEM} from plataforma.negocios n where ${condicoes.join(" and ")}`,
        parametros,
      );
      return contagem(resultado.rows[0]);
    },

    async remapear(workspaceId, funilId, deEtapaId, paraEtapaId) {
      const resultado = await cliente.query(
        `update plataforma.negocios set etapa_id = $4
          where workspace_id = $1 and funil_id = $2 and etapa_id = $3`,
        [workspaceId, funilId, deEtapaId, paraEtapaId],
      );
      return resultado.rowCount ?? 0;
    },

    async migrar(workspaceId, origemId, destinoId, mapeamento) {
      let migrados = 0;
      for (const [deEtapaId, paraEtapaId] of Object.entries(mapeamento)) {
        const resultado = await cliente.query(
          `update plataforma.negocios set funil_id = $3, etapa_id = $5
            where workspace_id = $1 and funil_id = $2 and etapa_id = $4`,
          [workspaceId, origemId, destinoId, deEtapaId, paraEtapaId],
        );
        migrados += resultado.rowCount ?? 0;
      }
      return migrados;
    },

    async definirEstado(workspaceId, id, estado) {
      const resultado = await cliente.query<LinhaDoBancoFunil>(
        `update plataforma.funis set estado = $3 where workspace_id = $1 and id = $2 returning ${COLUNAS_FUNIL}`,
        [workspaceId, id, estado],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaFunil(linha) : undefined;
    },

    async desmarcarPadrao(workspaceId) {
      await cliente.query("update plataforma.funis set padrao = false where workspace_id = $1 and padrao", [workspaceId]);
    },

    async marcarPadrao(workspaceId, id) {
      const resultado = await cliente.query<LinhaDoBancoFunil>(
        `update plataforma.funis set padrao = true where workspace_id = $1 and id = $2 returning ${COLUNAS_FUNIL}`,
        [workspaceId, id],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaFunil(linha) : undefined;
    },

    async excluir(workspaceId, id) {
      const resultado = await cliente.query("delete from plataforma.funis where workspace_id = $1 and id = $2", [workspaceId, id]);
      return (resultado.rowCount ?? 0) > 0;
    },
  };
}
