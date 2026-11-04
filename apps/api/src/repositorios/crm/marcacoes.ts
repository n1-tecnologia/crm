/**
 * Repositório das marcações da Conversa — a estrela e o ponto de leitura de
 * cada Membro (`plataforma.conversa_marcacoes`, 011).
 *
 * Regras que valem em todo método (as mesmas de `conversas.ts`):
 *   - todo `WHERE` e todo `insert` levam `workspace_id = $1` (T-14-18);
 *   - o Membro é parâmetro do serviço, que o tira da sessão: nenhum método
 *     lê um Membro de dentro da edição (T-14-17);
 *   - valores sempre `$n`, SQL constante.
 *
 * A linha só existe depois do primeiro gesto: sem linha, a marcação é o padrão
 * (`estrela: false`, `lidaAte: null`).
 */

import type { Pool, PoolClient } from "pg";
import type { EdicaoDeMarcacao, MarcacaoDaConversa } from "@n1/dominio/crm/conversas";

export interface RepositorioDeMarcacoes {
  obter(workspaceId: string, conversaId: string, membroId: string): Promise<MarcacaoDaConversa>;
  /** Upsert: só os campos presentes na edição mudam; o outro fica como estava. */
  gravar(workspaceId: string, conversaId: string, membroId: string, edicao: EdicaoDeMarcacao): Promise<MarcacaoDaConversa>;
}

interface LinhaDeMarcacao {
  readonly estrela: boolean;
  readonly lida_ate: Date | null;
}

const PADRAO: MarcacaoDaConversa = { estrela: false, lidaAte: null };

const paraMarcacao = (linha: LinhaDeMarcacao): MarcacaoDaConversa => ({
  estrela: linha.estrela,
  lidaAte: linha.lida_ate === null ? null : linha.lida_ate.toISOString(),
});

export function criarRepositorioDeMarcacoesPg(cliente: Pool | PoolClient): RepositorioDeMarcacoes {
  return {
    async obter(workspaceId, conversaId, membroId) {
      const { rows } = await cliente.query<LinhaDeMarcacao>(
        `select estrela, lida_ate
           from plataforma.conversa_marcacoes
          where workspace_id = $1 and conversa_id = $2 and membro_id = $3`,
        [workspaceId, conversaId, membroId],
      );
      return rows[0] ? paraMarcacao(rows[0]) : PADRAO;
    },

    async gravar(workspaceId, conversaId, membroId, edicao) {
      // `null` em `$4`/`$5` quer dizer "não enviado": o coalesce mantém o valor da linha.
      const { rows } = await cliente.query<LinhaDeMarcacao>(
        `insert into plataforma.conversa_marcacoes (workspace_id, conversa_id, membro_id, estrela, lida_ate)
         values ($1, $2, $3, coalesce($4::boolean, false), $5::timestamptz)
         on conflict (workspace_id, conversa_id, membro_id) do update
            set estrela = coalesce($4::boolean, plataforma.conversa_marcacoes.estrela),
                lida_ate = coalesce($5::timestamptz, plataforma.conversa_marcacoes.lida_ate),
                atualizado_em = now()
         returning estrela, lida_ate`,
        [workspaceId, conversaId, membroId, edicao.estrela ?? null, edicao.lidaAte ?? null],
      );
      return paraMarcacao(rows[0]!);
    },
  };
}
