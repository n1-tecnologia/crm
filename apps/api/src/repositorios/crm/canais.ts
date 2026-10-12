/**
 * Repositório de Canais — a escrita e a leitura de `plataforma.canais` (008).
 *
 * Regras que valem em todo método (as mesmas de `funis.ts`):
 *   - todo `WHERE` leva `workspace_id = $1` (T-08-01): o Espaço vem do serviço,
 *     que o tira da sessão;
 *   - valores sempre `$n`, nunca interpolados; nenhuma coluna é interpolada;
 *   - `inserir` NÃO envia `conexao`, `conexao_simulada`, `estado` nem datas: os
 *     defaults da 008 decidem, e o Canal nasce `desconectada` (D-08, T-08-02).
 *
 * Nenhuma coluna guarda credencial de provedor (008, de propósito).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { Canal, ConexaoDoCanal, EstadoDoCanal, FiltroDeCanais } from "@n1/dominio/crm/canais";
import type { TipoComProvedor } from "@n1/dominio/provedores-de-canal";
import type { ProvedorDeCanal } from "@n1/dominio/types/crm";

/** O que o serviço decide gravar: o resto (conexão, estado, datas) é default da 008. */
export interface LinhaNovaDeCanal {
  readonly nome: string;
  readonly tipo: TipoComProvedor;
  readonly provedor: ProvedorDeCanal;
  readonly identificadorExterno: string;
  readonly configuradoPor: string;
  readonly criadoPor: string;
}

export interface RepositorioDeCanais {
  inserir(workspaceId: string, linha: LinhaNovaDeCanal): Promise<Canal>;
  listar(workspaceId: string, filtro: FiltroDeCanais): Promise<Pagina<Canal>>;
  /** Os Canais do Espaço em qualquer estado, do mais antigo ao mais novo (a projeção de `GET /estado`). */
  todos(workspaceId: string): Promise<Canal[]>;
}

const COLUNAS_CANAL = `id, nome, tipo, provedor, identificador_externo, conexao, conexao_simulada, conectada_em,
  estado, arquivado_em, configurado_por, fila_padrao_id, proprietario_padrao_id, origem_padrao_id,
  grupos_habilitados, criado_por, criado_em, atualizado_em`;

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
           (workspace_id, nome, tipo, provedor, identificador_externo, configurado_por, criado_por)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning ${COLUNAS_CANAL}`,
        [workspaceId, linha.nome, linha.tipo, linha.provedor, linha.identificadorExterno, linha.configuradoPor, linha.criadoPor],
      );
      return linhaParaCanal(rows[0]!);
    },

    async listar(workspaceId, filtro) {
      const total = await cliente.query<{ total: number }>(
        "select count(*)::int as total from plataforma.canais where workspace_id = $1 and estado = $2",
        [workspaceId, filtro.estado],
      );
      const pagina = await cliente.query<LinhaDoBancoDeCanal>(
        `select ${COLUNAS_CANAL}
           from plataforma.canais
          where workspace_id = $1 and estado = $2
          order by lower(nome), id
          limit $3 offset $4`,
        [workspaceId, filtro.estado, filtro.limite, filtro.deslocamento],
      );
      return { total: total.rows[0]?.total ?? 0, itens: pagina.rows.map(linhaParaCanal) };
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
