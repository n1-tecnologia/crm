/**
 * Repositório de Conversas — a escrita e a leitura de `plataforma.conversas` (008).
 *
 * Regras que valem em todo método (as mesmas de `canais.ts` e `funis.ts`):
 *   - todo `WHERE` leva `workspace_id = $1` (T-08-25): o Espaço vem do serviço,
 *     que o tira da sessão;
 *   - valores sempre `$n`, nunca interpolados; nenhum nome de coluna vem do cliente;
 *   - `inserir` NÃO envia `situacao`, `estado`, `reaberturas` nem datas: os
 *     defaults da 008 decidem, e a Conversa nasce `aberta` e `ativo`;
 *   - os Participantes são um jsonb na própria Conversa (D-09), gravados já em
 *     camelCase, no mesmo formato de `ParticipanteDaConversa`.
 *
 * Uma Conversa pertence a UM Canal para sempre (INV-CXE-04): não há método que
 * troque `canal_id`.
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type {
  Conversa,
  EstadoDaConversa,
  FiltroDeConversas,
  ParticipanteDaConversa,
  SituacaoDaConversa,
} from "@n1/dominio/crm/conversas";

/** O que o serviço decide gravar: o resto (situação, estado, datas) é default da 008. */
export interface LinhaNovaDeConversa {
  readonly canalId: string;
  readonly contatoId: string;
  readonly titulo: string;
  readonly filaId: string | null;
  readonly atribuido: { readonly tipo: "membro"; readonly id: string };
  readonly participantes: readonly ParticipanteDaConversa[];
  readonly criadoPor: { readonly tipo: "member"; readonly id: string };
}

export interface RepositorioDeConversas {
  inserir(workspaceId: string, linha: LinhaNovaDeConversa): Promise<Conversa>;
  /** `travar` põe `for update`: a escrita decide sobre a linha que ninguém mais muda. */
  obter(workspaceId: string, id: string, opcoes?: { readonly travar?: boolean }): Promise<Conversa | undefined>;
  /** A Conversa `aberta` ou `pendente` e `ativa` do par (INV-CXE-03), se houver. */
  abertaDoPar(workspaceId: string, contatoId: string, canalId: string): Promise<Conversa | undefined>;
  listar(workspaceId: string, filtro: FiltroDeConversas): Promise<Pagina<Conversa>>;
  /** `resolvida` fecha o Adiamento; `aberta` conta uma reabertura. Outra situação não é gravada por aqui. */
  definirSituacao(workspaceId: string, id: string, situacao: SituacaoDaConversa): Promise<Conversa | undefined>;
}

const COLUNAS_CONVERSA = `id, canal_id, contato_id, titulo, titulo_editado, situacao, estado, fila_id,
  atribuido_tipo, atribuido_id, adiada_ate, adiamento_motivo, participantes, resolvida_em, reaberta_em,
  reaberturas, criado_por_tipo, criado_por_id, criado_em, atualizado_em`;

export interface LinhaDoBancoDeConversa {
  readonly id: string;
  readonly canal_id: string;
  readonly contato_id: string;
  readonly titulo: string;
  readonly titulo_editado: boolean;
  readonly situacao: SituacaoDaConversa;
  readonly estado: EstadoDaConversa;
  readonly fila_id: string | null;
  readonly atribuido_tipo: "membro" | "agente" | null;
  readonly atribuido_id: string | null;
  readonly adiada_ate: Date | null;
  readonly adiamento_motivo: string | null;
  readonly participantes: readonly ParticipanteDaConversa[];
  readonly resolvida_em: Date | null;
  readonly reaberta_em: Date | null;
  readonly reaberturas: number;
  readonly criado_por_tipo: string;
  readonly criado_por_id: string;
  readonly criado_em: Date;
  readonly atualizado_em: Date;
}

const iso = (data: Date | null): string | null => (data === null ? null : data.toISOString());

/** snake_case → camelCase; `Date` → ISO 8601; nulo continua `null`. */
export function linhaParaConversa(linha: LinhaDoBancoDeConversa): Conversa {
  return {
    id: linha.id,
    canalId: linha.canal_id,
    contatoId: linha.contato_id,
    titulo: linha.titulo,
    tituloEditado: linha.titulo_editado,
    situacao: linha.situacao,
    estado: linha.estado,
    filaId: linha.fila_id,
    atribuido:
      linha.atribuido_tipo === null || linha.atribuido_id === null
        ? null
        : { tipo: linha.atribuido_tipo, id: linha.atribuido_id },
    adiadaAte: iso(linha.adiada_ate),
    adiamentoMotivo: linha.adiamento_motivo,
    participantes: linha.participantes,
    resolvidaEm: iso(linha.resolvida_em),
    reabertaEm: iso(linha.reaberta_em),
    reaberturas: linha.reaberturas,
    criadoPor: { tipo: linha.criado_por_tipo, id: linha.criado_por_id },
    criadoEm: linha.criado_em.toISOString(),
    atualizadoEm: linha.atualizado_em.toISOString(),
  };
}

export function criarRepositorioDeConversasPg(cliente: Pool | PoolClient): RepositorioDeConversas {
  return {
    async inserir(workspaceId, linha) {
      const { rows } = await cliente.query<LinhaDoBancoDeConversa>(
        `insert into plataforma.conversas
           (workspace_id, canal_id, contato_id, titulo, fila_id, atribuido_tipo, atribuido_id,
            participantes, criado_por_tipo, criado_por_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
         returning ${COLUNAS_CONVERSA}`,
        [
          workspaceId,
          linha.canalId,
          linha.contatoId,
          linha.titulo,
          linha.filaId,
          linha.atribuido.tipo,
          linha.atribuido.id,
          JSON.stringify(linha.participantes),
          linha.criadoPor.tipo,
          linha.criadoPor.id,
        ],
      );
      return linhaParaConversa(rows[0]!);
    },

    async obter(workspaceId, id, opcoes) {
      const { rows } = await cliente.query<LinhaDoBancoDeConversa>(
        `select ${COLUNAS_CONVERSA} from plataforma.conversas where workspace_id = $1 and id = $2${opcoes?.travar ? " for update" : ""}`,
        [workspaceId, id],
      );
      return rows[0] ? linhaParaConversa(rows[0]) : undefined;
    },

    async abertaDoPar(workspaceId, contatoId, canalId) {
      const { rows } = await cliente.query<LinhaDoBancoDeConversa>(
        `select ${COLUNAS_CONVERSA}
           from plataforma.conversas
          where workspace_id = $1 and contato_id = $2 and canal_id = $3
            and situacao in ('aberta', 'pendente') and estado = 'ativo'
          limit 1`,
        [workspaceId, contatoId, canalId],
      );
      return rows[0] ? linhaParaConversa(rows[0]) : undefined;
    },

    async listar(workspaceId, filtro) {
      // Os fragmentos de WHERE são constantes; todo valor do cliente vai como $n.
      const condicoes = ["workspace_id = $1", "estado = $2"];
      const valores: unknown[] = [workspaceId, filtro.estado];
      const somar = (fragmento: (n: number) => string, valor: unknown) => {
        valores.push(valor);
        condicoes.push(fragmento(valores.length));
      };
      if (filtro.canalId !== undefined) somar((n) => `canal_id = $${n}`, filtro.canalId);
      if (filtro.contatoId !== undefined) somar((n) => `contato_id = $${n}`, filtro.contatoId);
      if (filtro.situacao !== undefined) somar((n) => `situacao = $${n}`, filtro.situacao);
      const onde = condicoes.join(" and ");

      const total = await cliente.query<{ total: number }>(`select count(*)::int as total from plataforma.conversas where ${onde}`, valores);
      const pagina = await cliente.query<LinhaDoBancoDeConversa>(
        `select ${COLUNAS_CONVERSA}
           from plataforma.conversas
          where ${onde}
          order by atualizado_em desc, id
          limit $${valores.length + 1} offset $${valores.length + 2}`,
        [...valores, filtro.limite, filtro.deslocamento],
      );
      return { total: total.rows[0]?.total ?? 0, itens: pagina.rows.map(linhaParaConversa) };
    },

    async definirSituacao(workspaceId, id, situacao) {
      const sql =
        situacao === "resolvida"
          ? `update plataforma.conversas
                set situacao = 'resolvida', resolvida_em = now(), adiada_ate = null, adiamento_motivo = null
              where workspace_id = $1 and id = $2
              returning ${COLUNAS_CONVERSA}`
          : `update plataforma.conversas
                set situacao = $3, reaberta_em = now(), reaberturas = reaberturas + 1
              where workspace_id = $1 and id = $2
              returning ${COLUNAS_CONVERSA}`;
      const { rows } = await cliente.query<LinhaDoBancoDeConversa>(sql, situacao === "resolvida" ? [workspaceId, id] : [workspaceId, id, situacao]);
      return rows[0] ? linhaParaConversa(rows[0]) : undefined;
    },
  };
}
