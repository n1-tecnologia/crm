/**
 * Repositório de Notas do Contato — `plataforma.contato_notas` (011).
 *
 * Regras que valem em todo método:
 *   - todo `WHERE` leva `workspace_id = $1` (T-14-14): o Espaço vem do serviço,
 *     que o tira da sessão; nada aqui o deduz de outro lugar;
 *   - valores sempre `$n`, nunca interpolados; a ordenação é fixa;
 *   - a nota não tem edição nem exclusão por rota: o que sai de cena sai com o
 *     Contato (`on delete cascade`).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { NotaDoContato } from "@n1/dominio/crm/notas";

export interface RepositorioDeNotas {
  inserir(workspaceId: string, contatoId: string, conteudo: string, autorId: string): Promise<NotaDoContato>;
  /** A mais recente primeiro; `total` é o de todas as páginas. */
  listar(
    workspaceId: string,
    contatoId: string,
    pagina: { readonly limite: number; readonly deslocamento: number },
  ): Promise<Pagina<NotaDoContato>>;
}

const COLUNAS = "id, contato_id, conteudo, autor_id, criado_em";

interface LinhaDoBanco {
  readonly id: string;
  readonly contato_id: string;
  readonly conteudo: string;
  readonly autor_id: string;
  readonly criado_em: Date;
}

/** snake_case → camelCase; `Date` → ISO 8601. */
function linhaParaNota(linha: LinhaDoBanco): NotaDoContato {
  return {
    id: linha.id,
    contatoId: linha.contato_id,
    conteudo: linha.conteudo,
    autorId: linha.autor_id,
    criadoEm: linha.criado_em.toISOString(),
  };
}

export function criarRepositorioDeNotasPg(cliente: Pool | PoolClient): RepositorioDeNotas {
  return {
    async inserir(workspaceId, contatoId, conteudo, autorId) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `insert into plataforma.contato_notas (workspace_id, contato_id, conteudo, autor_id)
         values ($1, $2, $3, $4)
         returning ${COLUNAS}`,
        [workspaceId, contatoId, conteudo, autorId],
      );
      const inserida = resultado.rows[0];
      if (!inserida) throw new Error("O INSERT de Nota do Contato não devolveu a linha.");
      return linhaParaNota(inserida);
    },

    async listar(workspaceId, contatoId, pagina) {
      const total = await cliente.query<{ total: number }>(
        "select count(*)::int as total from plataforma.contato_notas where workspace_id = $1 and contato_id = $2",
        [workspaceId, contatoId],
      );
      const itens = await cliente.query<LinhaDoBanco>(
        `select ${COLUNAS} from plataforma.contato_notas
          where workspace_id = $1 and contato_id = $2
          order by criado_em desc, id
          limit $3 offset $4`,
        [workspaceId, contatoId, pagina.limite, pagina.deslocamento],
      );
      return { total: total.rows[0]?.total ?? 0, itens: itens.rows.map(linhaParaNota) };
    },
  };
}
