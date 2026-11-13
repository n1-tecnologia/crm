/**
 * O SQL das Mensagens de modelo do WhatsApp oficial (Sessão 7, 7.3, migração 016). O modelo nasce e é aprovado na Meta; aqui só
 * se guarda o que a sincronização leu (`substituirDoCanal`) e se lê o que a Caixa oferece. A regra (o que é enviável, as
 * variáveis) mora no domínio (`@n1/dominio/crm/modelos`); este arquivo não decide nada.
 */

import type { Pool, PoolClient } from "pg";
import type { CategoriaDeModelo, ComponenteDeModelo, EstadoDeModelo, ModeloDeMensagem } from "@n1/dominio/crm/modelos";

type Cliente = Pick<Pool | PoolClient, "query">;

/** Um modelo como a sincronização o leu da Meta, já traduzido. */
export interface ModeloLido {
  readonly idNoProvedor: string;
  readonly nome: string;
  readonly idioma: string;
  readonly categoria: CategoriaDeModelo;
  readonly estado: EstadoDeModelo;
  readonly motivoDeRejeicao: string | null;
  readonly componentes: readonly ComponenteDeModelo[];
  readonly quantidadeDeVariaveis: number;
}

export interface ResultadoDaSubstituicao {
  readonly criados: number;
  readonly atualizados: number;
  readonly removidos: number;
}

export interface RepositorioDeModelos {
  /** Os modelos do Canal, do nome A ao Z; `estado` filtra (a Caixa pede só `aprovado`). */
  listarDoCanal(workspaceId: string, canalId: string, filtro?: { readonly estado?: EstadoDeModelo }): Promise<readonly ModeloDeMensagem[]>;
  /** Um modelo do Canal, ou `undefined`: um id de outro Canal ou de outro Espaço nunca serve. */
  obter(workspaceId: string, canalId: string, id: string): Promise<ModeloDeMensagem | undefined>;
  /**
   * Deixa o Canal com exatamente os modelos lidos da Meta: cria os novos, atualiza os que já existiam (por nome e idioma,
   * mantendo o `id`) e APAGA os que sumiram. Numa transação de quem chama, para a lista nunca ficar pela metade.
   */
  substituirDoCanal(workspaceId: string, canalId: string, lidos: readonly ModeloLido[]): Promise<ResultadoDaSubstituicao>;
}

interface LinhaDeModelo {
  readonly id: string;
  readonly canal_id: string;
  readonly id_no_provedor: string;
  readonly nome: string;
  readonly idioma: string;
  readonly categoria: CategoriaDeModelo;
  readonly estado: EstadoDeModelo;
  readonly motivo_rejeicao: string | null;
  readonly componentes: ComponenteDeModelo[];
  readonly quantidade_de_variaveis: number;
  readonly sincronizado_em: Date;
}

const COLUNAS = `id, canal_id, id_no_provedor, nome, idioma, categoria, estado, motivo_rejeicao, componentes,
  quantidade_de_variaveis, sincronizado_em`;

function paraModelo(linha: LinhaDeModelo): ModeloDeMensagem {
  return {
    id: linha.id,
    canalId: linha.canal_id,
    idNoProvedor: linha.id_no_provedor,
    nome: linha.nome,
    idioma: linha.idioma,
    categoria: linha.categoria,
    estado: linha.estado,
    motivoDeRejeicao: linha.motivo_rejeicao,
    componentes: linha.componentes,
    quantidadeDeVariaveis: linha.quantidade_de_variaveis,
    sincronizadoEm: linha.sincronizado_em.toISOString(),
  };
}

export function criarRepositorioDeModelosPg(cliente: Cliente): RepositorioDeModelos {
  return {
    async listarDoCanal(workspaceId, canalId, filtro = {}) {
      const { rows } = await cliente.query<LinhaDeModelo>(
        `select ${COLUNAS} from plataforma.modelos_de_mensagem
          where workspace_id = $1 and canal_id = $2 and ($3::text is null or estado = $3)
          order by nome, idioma`,
        [workspaceId, canalId, filtro.estado ?? null],
      );
      return rows.map(paraModelo);
    },

    async obter(workspaceId, canalId, id) {
      const { rows } = await cliente.query<LinhaDeModelo>(
        `select ${COLUNAS} from plataforma.modelos_de_mensagem where workspace_id = $1 and canal_id = $2 and id = $3`,
        [workspaceId, canalId, id],
      );
      return rows[0] ? paraModelo(rows[0]) : undefined;
    },

    async substituirDoCanal(workspaceId, canalId, lidos) {
      let criados = 0;
      let atualizados = 0;
      for (const m of lidos) {
        // `xmax = 0` é a linha recém-inserida; numa atualização por conflito ele guarda a transação que a mudou.
        const { rows } = await cliente.query<{ criado: boolean }>(
          `insert into plataforma.modelos_de_mensagem
             (workspace_id, canal_id, id_no_provedor, nome, idioma, categoria, estado, motivo_rejeicao, componentes,
              quantidade_de_variaveis, sincronizado_em)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now())
           on conflict (workspace_id, canal_id, nome, idioma) do update
             set id_no_provedor = excluded.id_no_provedor, categoria = excluded.categoria, estado = excluded.estado,
                 motivo_rejeicao = excluded.motivo_rejeicao, componentes = excluded.componentes,
                 quantidade_de_variaveis = excluded.quantidade_de_variaveis, sincronizado_em = now()
           returning (xmax = 0) as criado`,
          [
            workspaceId,
            canalId,
            m.idNoProvedor,
            m.nome,
            m.idioma,
            m.categoria,
            m.estado,
            m.motivoDeRejeicao,
            JSON.stringify(m.componentes),
            m.quantidadeDeVariaveis,
          ],
        );
        if (rows[0]?.criado) criados += 1;
        else atualizados += 1;
      }
      // O que a Meta já não tem sai daqui. `\u0001` separa o nome do idioma: nenhum dos dois o contém.
      const mantidos = lidos.map((m) => `${m.nome}\u0001${m.idioma}`);
      const apagados = await cliente.query(
        `delete from plataforma.modelos_de_mensagem
          where workspace_id = $1 and canal_id = $2 and (nome || E'\\u0001' || idioma) <> all($3::text[])`,
        [workspaceId, canalId, mantidos],
      );
      return { criados, atualizados, removidos: apagados.rowCount ?? 0 };
    },
  };
}
