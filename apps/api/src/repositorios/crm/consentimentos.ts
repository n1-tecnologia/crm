/**
 * Repositório de Consentimentos do Contato — `plataforma.contato_consentimentos` (011).
 *
 * Este repositório só INSERE e LÊ, de propósito (T-14-19): o histórico de
 * consentimento é a prova do que o Contato decidiu e quando, então nenhuma
 * linha é editada nem apagada. Revogar é inserir um registro `revogado`; o que
 * sai de cena sai com o Contato (`on delete cascade`, quando ele é excluído de
 * vez). Quem precisar de "update" ou "delete" aqui está mudando a regra, não
 * adicionando um método.
 *
 * Regras que valem em todo método:
 *   - todo `WHERE` leva `workspace_id = $1`: o Espaço vem do serviço, que o
 *     tira da sessão; nada aqui o deduz de outro lugar;
 *   - valores sempre `$n`, nunca interpolados; a ordenação é fixa;
 *   - `registrado_em` é do banco (`now()`), `registrado_por` é do serviço.
 */

import type { Pool, PoolClient } from "pg";
import type {
  ConsentimentoDoContato,
  DecisaoDeConsentimento,
  NovoConsentimento,
  OrigemDeConsentimento,
  TipoDeCanalDoConsentimento,
} from "@n1/dominio/crm/consentimentos";

export interface RepositorioDeConsentimentos {
  /** `em` ausente vira o instante do banco. */
  inserir(workspaceId: string, contatoId: string, entrada: NovoConsentimento, registradoPor: string): Promise<ConsentimentoDoContato>;
  /** O histórico inteiro do Contato, o mais recente (por `em`) primeiro. */
  listarDoContato(workspaceId: string, contatoId: string): Promise<ConsentimentoDoContato[]>;
  /** A Mensagem existe NESTE Espaço, numa Conversa deste Contato: a única evidência aceita (T-14-20). */
  mensagemEhDoContato(workspaceId: string, contatoId: string, mensagemId: string): Promise<boolean>;
}

const COLUNAS = "id, contato_id, finalidade_id, tipo_de_canal, decisao, em, origem, evidencia_mensagem_id, registrado_por, registrado_em";

interface LinhaDoBanco {
  readonly id: string;
  readonly contato_id: string;
  readonly finalidade_id: string;
  readonly tipo_de_canal: TipoDeCanalDoConsentimento;
  readonly decisao: DecisaoDeConsentimento;
  readonly em: Date;
  readonly origem: OrigemDeConsentimento;
  readonly evidencia_mensagem_id: string | null;
  readonly registrado_por: string;
  readonly registrado_em: Date;
}

/** snake_case → camelCase; `Date` → ISO 8601. */
function linhaParaConsentimento(linha: LinhaDoBanco): ConsentimentoDoContato {
  return {
    id: linha.id,
    contatoId: linha.contato_id,
    finalidadeId: linha.finalidade_id,
    tipoDeCanal: linha.tipo_de_canal,
    decisao: linha.decisao,
    em: linha.em.toISOString(),
    origem: linha.origem,
    evidenciaMensagemId: linha.evidencia_mensagem_id,
    registradoPor: linha.registrado_por,
    registradoEm: linha.registrado_em.toISOString(),
  };
}

export function criarRepositorioDeConsentimentosPg(cliente: Pool | PoolClient): RepositorioDeConsentimentos {
  return {
    async inserir(workspaceId, contatoId, entrada, registradoPor) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `insert into plataforma.contato_consentimentos
           (workspace_id, contato_id, finalidade_id, tipo_de_canal, decisao, em, origem, evidencia_mensagem_id, registrado_por)
         values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7, $8, $9)
         returning ${COLUNAS}`,
        [
          workspaceId,
          contatoId,
          entrada.finalidadeId,
          entrada.tipoDeCanal,
          entrada.decisao,
          entrada.em ?? null,
          entrada.origem,
          entrada.evidenciaMensagemId ?? null,
          registradoPor,
        ],
      );
      const inserida = resultado.rows[0];
      if (!inserida) throw new Error("O INSERT de Consentimento do Contato não devolveu a linha.");
      return linhaParaConsentimento(inserida);
    },

    async listarDoContato(workspaceId, contatoId) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `select ${COLUNAS} from plataforma.contato_consentimentos
          where workspace_id = $1 and contato_id = $2
          order by em desc, registrado_em desc, id`,
        [workspaceId, contatoId],
      );
      return resultado.rows.map(linhaParaConsentimento);
    },

    async mensagemEhDoContato(workspaceId, contatoId, mensagemId) {
      const { rowCount } = await cliente.query(
        `select 1
           from plataforma.mensagens m
           join plataforma.conversas c on c.workspace_id = m.workspace_id and c.id = m.conversa_id
          where m.workspace_id = $1 and m.id = $2 and c.contato_id = $3`,
        [workspaceId, mensagemId, contatoId],
      );
      return (rowCount ?? 0) > 0;
    },
  };
}
