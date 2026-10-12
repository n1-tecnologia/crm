/**
 * Repositório de Canais — a escrita e a leitura de `plataforma.canais` (008).
 *
 * Regras que valem em todo método (as mesmas de `funis.ts`):
 *   - todo `WHERE` leva `workspace_id = $1` (T-08-01): o Espaço vem do serviço,
 *     que o tira da sessão;
 *   - valores sempre `$n`, nunca interpolados; nenhum nome de coluna vem do cliente;
 *   - `atualizar` monta o `SET` de um mapa constante de colunas (nome, Fila e
 *     Origem padrão): `tipo`, `provedor`, `identificador` e `conexao` não mudam
 *     por ali (INV-CXE-02);
 *   - `inserir` NÃO envia `conexao`, `conexao_simulada`, `estado` nem datas: os
 *     defaults da 008 decidem, e o Canal nasce `desconectada` (D-08, T-08-02).
 *
 * Nenhuma coluna guarda credencial de provedor (008, de propósito).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { Canal, ConexaoDoCanal, EdicaoDeCanal, EstadoDoCanal, FiltroDeCanais } from "@n1/dominio/crm/canais";
import type { TipoComProvedor } from "@n1/dominio/provedores-de-canal";
import type { ProvedorDeCanal } from "@n1/dominio/types/crm";
import { CLAUSULA_ESCAPE, contemTexto } from "./sql";

/** O que o serviço decide gravar: o resto (conexão, estado, datas) é default da 008. */
export interface LinhaNovaDeCanal {
  readonly nome: string;
  readonly tipo: TipoComProvedor;
  readonly provedor: ProvedorDeCanal;
  readonly identificadorExterno: string;
  readonly configuradoPor: string;
  readonly criadoPor: string;
  readonly filaPadraoId?: string | undefined;
  readonly origemPadraoId?: string | undefined;
}

/** O que `ativoEmConflito` procura entre os Canais ativos do Espaço: nome, conta (tipo + identificador), ou os dois. */
export interface AlvoDeConflito {
  readonly nome?: string | undefined;
  readonly tipo?: TipoComProvedor | undefined;
  readonly identificadorExterno?: string | undefined;
  /** O próprio Canal, numa edição: ele não conflita consigo. */
  readonly excetoId?: string | undefined;
}

export interface ConflitoDeCanal {
  readonly id: string;
  readonly nome: string;
  readonly motivo: "nome" | "conta";
}

export interface RepositorioDeCanais {
  inserir(workspaceId: string, linha: LinhaNovaDeCanal): Promise<Canal>;
  listar(workspaceId: string, filtro: FiltroDeCanais): Promise<Pagina<Canal>>;
  /** `travar` põe `for update`: a escrita decide sobre a linha que ninguém mais muda. */
  obter(workspaceId: string, id: string, opcoes?: { readonly travar?: boolean }): Promise<Canal | undefined>;
  /** Só `nome`, `fila_padrao_id` e `origem_padrao_id` (INV-CXE-02); só os presentes em `campos`. */
  atualizar(workspaceId: string, id: string, campos: EdicaoDeCanal): Promise<Canal | undefined>;
  /** Grava `conexao`/`conexao_simulada` e a hora da conexão (`now()` ao conectar, nula ao desconectar). */
  definirConexao(
    workspaceId: string,
    id: string,
    alvo: { readonly conexao: ConexaoDoCanal; readonly conexaoSimulada: boolean },
  ): Promise<Canal | undefined>;
  /** Arquiva e desconecta na MESMA linha (11.1): os CHECK da 008 exigem as duas mudanças juntas. */
  arquivar(workspaceId: string, id: string): Promise<Canal | undefined>;
  /** Outro Canal ATIVO do Espaço com o mesmo nome (sem caixa nem espaços) ou a mesma conta (RN-CXE-31, INV-CXE-01). */
  ativoEmConflito(workspaceId: string, alvo: AlvoDeConflito): Promise<ConflitoDeCanal | undefined>;
  /** Os Canais do Espaço em qualquer estado, do mais antigo ao mais novo (a projeção de `GET /estado`). */
  todos(workspaceId: string): Promise<Canal[]>;
}

const COLUNAS_CANAL = `id, nome, tipo, provedor, identificador_externo, conexao, conexao_simulada, conectada_em,
  estado, arquivado_em, configurado_por, fila_padrao_id, proprietario_padrao_id, origem_padrao_id,
  grupos_habilitados, criado_por, criado_em, atualizado_em`;

/** Mapa constante das colunas que a configuração pode mudar (T-08-14, T-08-18): o corpo nunca nomeia coluna. */
const COLUNAS_EDITAVEIS = {
  nome: "nome",
  filaPadraoId: "fila_padrao_id",
  origemPadraoId: "origem_padrao_id",
} as const satisfies Record<keyof EdicaoDeCanal, string>;

export interface LinhaDoBancoDeCanal {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoComProvedor;
  readonly provedor: ProvedorDeCanal;
  readonly identificador_externo: string;
  readonly conexao: ConexaoDoCanal;
  readonly conexao_simulada: boolean;
  readonly conectada_em: Date | null;
  readonly estado: EstadoDoCanal;
  readonly arquivado_em: Date | null;
  readonly configurado_por: string;
  readonly fila_padrao_id: string | null;
  readonly proprietario_padrao_id: string | null;
  readonly origem_padrao_id: string | null;
  readonly grupos_habilitados: boolean;
  readonly criado_por: string;
  readonly criado_em: Date;
  readonly atualizado_em: Date;
}

/** snake_case → camelCase; `Date` → ISO 8601; nulo continua `null`. */
export function linhaParaCanal(linha: LinhaDoBancoDeCanal): Canal {
  return {
    id: linha.id,
    nome: linha.nome,
    tipo: linha.tipo,
    provedor: linha.provedor,
    identificadorExterno: linha.identificador_externo,
    conexao: linha.conexao,
    conexaoSimulada: linha.conexao_simulada,
    conectadaEm: linha.conectada_em === null ? null : linha.conectada_em.toISOString(),
    estado: linha.estado,
    arquivadoEm: linha.arquivado_em === null ? null : linha.arquivado_em.toISOString(),
    configuradoPor: linha.configurado_por,
    filaPadraoId: linha.fila_padrao_id,
    proprietarioPadraoId: linha.proprietario_padrao_id,
    origemPadraoId: linha.origem_padrao_id,
    gruposHabilitados: linha.grupos_habilitados,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em.toISOString(),
    atualizadoEm: linha.atualizado_em.toISOString(),
  };
}

export function criarRepositorioDeCanaisPg(cliente: Pool | PoolClient): RepositorioDeCanais {
  return {
    async inserir(workspaceId, linha) {
      const { rows } = await cliente.query<LinhaDoBancoDeCanal>(
        `insert into plataforma.canais
           (workspace_id, nome, tipo, provedor, identificador_externo, configurado_por, criado_por,
            fila_padrao_id, origem_padrao_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning ${COLUNAS_CANAL}`,
        [
          workspaceId,
          linha.nome,
          linha.tipo,
          linha.provedor,
          linha.identificadorExterno,
          linha.configuradoPor,
          linha.criadoPor,
          linha.filaPadraoId ?? null,
          linha.origemPadraoId ?? null,
        ],
      );
      return linhaParaCanal(rows[0]!);
    },

    async listar(workspaceId, filtro) {
      // Os fragmentos de WHERE são constantes; todo valor do cliente vai como $n.
      const condicoes = ["workspace_id = $1", "estado = $2"];
      const valores: unknown[] = [workspaceId, filtro.estado];
      const somar = (fragmento: (n: number) => string, valor: unknown) => {
        valores.push(valor);
        condicoes.push(fragmento(valores.length));
      };
      if (filtro.tipo !== undefined) somar((n) => `tipo = $${n}`, filtro.tipo);
      if (filtro.provedor !== undefined) somar((n) => `provedor = $${n}`, filtro.provedor);
      if (filtro.conexao !== undefined) somar((n) => `conexao = $${n}`, filtro.conexao);
      if (filtro.q !== undefined && filtro.q !== "") somar((n) => `nome ilike $${n} ${CLAUSULA_ESCAPE}`, contemTexto(filtro.q!));
      const onde = condicoes.join(" and ");

      const total = await cliente.query<{ total: number }>(`select count(*)::int as total from plataforma.canais where ${onde}`, valores);
      const pagina = await cliente.query<LinhaDoBancoDeCanal>(
        `select ${COLUNAS_CANAL}
           from plataforma.canais
          where ${onde}
          order by lower(nome), id
          limit $${valores.length + 1} offset $${valores.length + 2}`,
        [...valores, filtro.limite, filtro.deslocamento],
      );
      return { total: total.rows[0]?.total ?? 0, itens: pagina.rows.map(linhaParaCanal) };
    },

    async obter(workspaceId, id, opcoes) {
      const { rows } = await cliente.query<LinhaDoBancoDeCanal>(
        `select ${COLUNAS_CANAL} from plataforma.canais where workspace_id = $1 and id = $2${opcoes?.travar ? " for update" : ""}`,
        [workspaceId, id],
      );
      return rows[0] ? linhaParaCanal(rows[0]) : undefined;
    },

    async atualizar(workspaceId, id, campos) {
      const atribuicoes: string[] = [];
      const valores: unknown[] = [workspaceId, id];
      for (const [chave, coluna] of Object.entries(COLUNAS_EDITAVEIS) as Array<[keyof EdicaoDeCanal, string]>) {
        const novo = campos[chave];
        if (novo === undefined) continue;
        valores.push(novo);
        atribuicoes.push(`${coluna} = $${valores.length}`);
      }
      if (atribuicoes.length === 0) {
        const atual = await cliente.query<LinhaDoBancoDeCanal>(
          `select ${COLUNAS_CANAL} from plataforma.canais where workspace_id = $1 and id = $2`,
          valores,
        );
        return atual.rows[0] ? linhaParaCanal(atual.rows[0]) : undefined;
      }
      const { rows } = await cliente.query<LinhaDoBancoDeCanal>(
        `update plataforma.canais set ${atribuicoes.join(", ")} where workspace_id = $1 and id = $2 returning ${COLUNAS_CANAL}`,
        valores,
      );
      return rows[0] ? linhaParaCanal(rows[0]) : undefined;
    },

    async definirConexao(workspaceId, id, alvo) {
      const { rows } = await cliente.query<LinhaDoBancoDeCanal>(
        `update plataforma.canais
            set conexao = $3,
                conexao_simulada = $4,
                conectada_em = case when $3 = 'conectada' then now() else null end
          where workspace_id = $1 and id = $2
          returning ${COLUNAS_CANAL}`,
        [workspaceId, id, alvo.conexao, alvo.conexaoSimulada],
      );
      return rows[0] ? linhaParaCanal(rows[0]) : undefined;
    },

    async arquivar(workspaceId, id) {
      const { rows } = await cliente.query<LinhaDoBancoDeCanal>(
        `update plataforma.canais
            set estado = 'arquivado',
                conexao = 'desconectada',
                conexao_simulada = false,
                conectada_em = null,
                arquivado_em = now()
          where workspace_id = $1 and id = $2
          returning ${COLUNAS_CANAL}`,
        [workspaceId, id],
      );
      return rows[0] ? linhaParaCanal(rows[0]) : undefined;
    },

    async ativoEmConflito(workspaceId, alvo) {
      const valores: unknown[] = [workspaceId];
      const porNome: string[] = [];
      const alternativas: string[] = [];
      if (alvo.nome !== undefined) {
        valores.push(alvo.nome);
        porNome.push(`lower(btrim(nome)) = lower(btrim($${valores.length}))`);
        alternativas.push(porNome[0]!);
      }
      if (alvo.tipo !== undefined && alvo.identificadorExterno !== undefined) {
        valores.push(alvo.tipo, alvo.identificadorExterno);
        alternativas.push(`(tipo = $${valores.length - 1} and identificador_externo = $${valores.length})`);
      }
      if (alternativas.length === 0) return undefined;
      let excecao = "";
      if (alvo.excetoId !== undefined) {
        valores.push(alvo.excetoId);
        excecao = ` and id <> $${valores.length}`;
      }
      const { rows } = await cliente.query<{ id: string; nome: string; por_nome: boolean }>(
        `select id, nome, ${porNome.length > 0 ? porNome[0] : "false"} as por_nome
           from plataforma.canais
          where workspace_id = $1 and estado = 'ativo'${excecao} and (${alternativas.join(" or ")})
          order by por_nome desc, criado_em, id
          limit 1`,
        valores,
      );
      const linha = rows[0];
      return linha ? { id: linha.id, nome: linha.nome, motivo: linha.por_nome ? "nome" : "conta" } : undefined;
    },

    async todos(workspaceId) {
      const { rows } = await cliente.query<LinhaDoBancoDeCanal>(
        `select ${COLUNAS_CANAL}
           from plataforma.canais
          where workspace_id = $1
          order by criado_em, id`,
        [workspaceId],
      );
      return rows.map(linhaParaCanal);
    },
  };
}
