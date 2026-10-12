/**
 * Repositório de Mensagens — a escrita e a leitura de `plataforma.mensagens` (008).
 *
 * Regras que valem em todo método:
 *   - todo `WHERE` leva `workspace_id = $1` (T-08-25), valores sempre `$n`;
 *   - `carga_bruta` (o payload cru do provedor) NUNCA entra em
 *     `COLUNAS_DE_MENSAGEM` (A9): ela é dado pessoal, só o caminho interno de
 *     ingestão a escreve, e nada que sai pela api pode depender dela;
 *   - a Mensagem é imutável depois de gravada, salvo status de entrega e
 *     marcação de exclusão (RN-CXE-16); por isso não há `atualizar` aqui.
 *
 * 08-06 entrega `inserir` (a primeira Mensagem da Conversa); 08-12 acrescenta
 * a lista do fio, a última recebida (a janela de RN-CXE-19) e a ingestão da
 * `recebida`, que é idempotente por (Canal, id externo) — INV-CXE-08 — e é o
 * único lugar que escreve e lê `carga_bruta`.
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type {
  AnexoDaMensagem,
  AtorDaMensagem,
  DirecaoDaMensagem,
  EnderecoAdicional,
  Mensagem,
  StatusDeEntrega,
  TipoDeAtorDaMensagem,
} from "@n1/dominio/crm/mensagens";

/** O que o serviço decide gravar numa Mensagem enviada por uma pessoa. */
export interface LinhaNovaDeMensagem {
  readonly conversaId: string;
  readonly canalId: string;
  readonly direcao: "enviada" | "interna";
  readonly ator: { readonly tipo: "member"; readonly id: string };
  readonly conteudo: string;
  /** `null` em `interna`; em `enviada`, o status inicial (B69). */
  readonly statusEntrega: StatusDeEntrega | null;
  readonly emRespostaAId?: string;
}

/**
 * O que a integração entrega de uma Mensagem `recebida` (ontologia 7.6). O Ator
 * é sempre o Canal como Integração e `criado_em` é o momento do PROVEDOR
 * (Pitfall 9); `registrado_em` fica com o default do banco, o da plataforma.
 */
export interface LinhaDeMensagemRecebida {
  readonly conversaId: string;
  readonly canalId: string;
  readonly idExterno: string;
  readonly criadoEm: string;
  readonly conteudo: string | null;
  readonly anexos: readonly AnexoDaMensagem[];
  readonly assunto: string | null;
  readonly enderecosAdicionais: readonly EnderecoAdicional[];
  readonly remetenteExterno: string | null;
  readonly identificadorId: string | null;
  readonly cargaBruta: unknown;
}

export interface FiltroDeMensagens {
  readonly conversaId: string;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface RepositorioDeMensagens {
  inserir(workspaceId: string, linha: LinhaNovaDeMensagem): Promise<Mensagem>;
  /** O fio da Conversa por `(criado_em, seq)`; nenhum item carrega a carga bruta. */
  listar(workspaceId: string, filtro: FiltroDeMensagens): Promise<Pagina<Mensagem>>;
  /** O `criadoEm` (do provedor) da `recebida` mais recente da Conversa, ou `null` (RN-CXE-19). */
  ultimaRecebidaEm(workspaceId: string, conversaId: string): Promise<string | null>;
  /** Grava a `recebida`; `undefined` quando o id externo já existe no Canal (INV-CXE-08). */
  inserirRecebida(workspaceId: string, linha: LinhaDeMensagemRecebida): Promise<Mensagem | undefined>;
  obterPorIdExterno(workspaceId: string, canalId: string, idExterno: string): Promise<Mensagem | undefined>;
  /**
   * O payload cru do provedor. SÓ ingestão e teste — nunca rota (A9): é dado
   * pessoal e a anonimização futura precisa zerá-lo.
   */
  cargaBruta(workspaceId: string, id: string): Promise<unknown>;
}

/** Todas as colunas lidas e devolvidas, menos o Espaço e o payload cru do provedor. `seq` vai como texto (bigint). */
export const COLUNAS_DE_MENSAGEM = `id, conversa_id, canal_id, seq::text as seq, direcao, ator_tipo, ator_id,
  delegante_tipo, delegante_id, remetente_participante_id, identificador_id, remetente_externo, conteudo, anexos,
  assunto, enderecos_adicionais, em_resposta_a_id, modelo_usado, id_externo, status_entrega, status_entrega_em,
  motivo_falha, leituras_internas, reacoes, marcacao_exclusao, edicoes_externas, anonimizada, criado_em, registrado_em`;

export interface LinhaDoBancoDeMensagem {
  readonly id: string;
  readonly conversa_id: string;
  readonly canal_id: string;
  readonly seq: string;
  readonly direcao: DirecaoDaMensagem;
  readonly ator_tipo: TipoDeAtorDaMensagem;
  readonly ator_id: string;
  readonly delegante_tipo: TipoDeAtorDaMensagem | null;
  readonly delegante_id: string | null;
  readonly remetente_participante_id: string | null;
  readonly identificador_id: string | null;
  readonly remetente_externo: string | null;
  readonly conteudo: string | null;
  readonly anexos: readonly AnexoDaMensagem[];
  readonly assunto: string | null;
  readonly enderecos_adicionais: readonly EnderecoAdicional[];
  readonly em_resposta_a_id: string | null;
  readonly modelo_usado: { readonly idNoProvedor: string; readonly nome: string } | null;
  readonly id_externo: string | null;
  readonly status_entrega: StatusDeEntrega | null;
  readonly status_entrega_em: Date | null;
  readonly motivo_falha: string | null;
  readonly leituras_internas: readonly unknown[];
  readonly reacoes: readonly unknown[];
  readonly marcacao_exclusao: unknown | null;
  readonly edicoes_externas: readonly unknown[];
  readonly anonimizada: boolean;
  readonly criado_em: Date;
  readonly registrado_em: Date;
}

const ator = (tipo: TipoDeAtorDaMensagem | null, id: string | null): AtorDaMensagem | null =>
  tipo === null || id === null ? null : { tipo, id };

/** snake_case → camelCase; `Date` → ISO 8601; `seq` (bigint em texto) → número. */
export function linhaParaMensagem(linha: LinhaDoBancoDeMensagem): Mensagem {
  return {
    id: linha.id,
    conversaId: linha.conversa_id,
    canalId: linha.canal_id,
    seq: Number(linha.seq),
    direcao: linha.direcao,
    ator: { tipo: linha.ator_tipo, id: linha.ator_id },
    delegante: ator(linha.delegante_tipo, linha.delegante_id),
    remetenteParticipanteId: linha.remetente_participante_id,
    identificadorId: linha.identificador_id,
    remetenteExterno: linha.remetente_externo,
    conteudo: linha.conteudo,
    anexos: linha.anexos,
    assunto: linha.assunto,
    enderecosAdicionais: linha.enderecos_adicionais,
    emRespostaAId: linha.em_resposta_a_id,
    modeloUsado: linha.modelo_usado,
    idExterno: linha.id_externo,
    statusEntrega: linha.status_entrega,
    statusEntregaEm: linha.status_entrega_em === null ? null : linha.status_entrega_em.toISOString(),
    motivoFalha: linha.motivo_falha,
    leiturasInternas: linha.leituras_internas,
    reacoes: linha.reacoes,
    marcacaoExclusao: linha.marcacao_exclusao,
    edicoesExternas: linha.edicoes_externas,
    anonimizada: linha.anonimizada,
    criadoEm: linha.criado_em.toISOString(),
    registradoEm: linha.registrado_em.toISOString(),
  };
}

export function criarRepositorioDeMensagensPg(cliente: Pool | PoolClient): RepositorioDeMensagens {
  return {
    async inserir(workspaceId, linha) {
      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `insert into plataforma.mensagens
           (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo,
            status_entrega, status_entrega_em, em_resposta_a_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8::text,
                 case when $8::text is null then null else now() end, $9)
         returning ${COLUNAS_DE_MENSAGEM}`,
        [
          workspaceId,
          linha.conversaId,
          linha.canalId,
          linha.direcao,
          linha.ator.tipo,
          linha.ator.id,
          linha.conteudo,
          linha.statusEntrega,
          linha.emRespostaAId ?? null,
        ],
      );
      return linhaParaMensagem(rows[0]!);
    },

    async listar(workspaceId, filtro) {
      const total = await cliente.query<{ total: number }>(
        "select count(*)::int as total from plataforma.mensagens where workspace_id = $1 and conversa_id = $2",
        [workspaceId, filtro.conversaId],
      );
      const pagina = await cliente.query<LinhaDoBancoDeMensagem>(
        `select ${COLUNAS_DE_MENSAGEM}
           from plataforma.mensagens
          where workspace_id = $1 and conversa_id = $2
          order by criado_em, seq
          limit $3 offset $4`,
        [workspaceId, filtro.conversaId, filtro.limite, filtro.deslocamento],
      );
      return { total: total.rows[0]?.total ?? 0, itens: pagina.rows.map(linhaParaMensagem) };
    },

    async ultimaRecebidaEm(workspaceId, conversaId) {
      const { rows } = await cliente.query<{ ultima: Date | null }>(
        `select max(criado_em) as ultima
           from plataforma.mensagens
          where workspace_id = $1 and conversa_id = $2 and direcao = 'recebida'`,
        [workspaceId, conversaId],
      );
      const ultima = rows[0]?.ultima;
      return ultima ? ultima.toISOString() : null;
    },

    async inserirRecebida(workspaceId, linha) {
      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `insert into plataforma.mensagens
           (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, id_externo, criado_em,
            conteudo, anexos, assunto, enderecos_adicionais, remetente_externo, identificador_id, carga_bruta)
         values ($1, $2, $3, 'recebida', 'integration', $3, $4, $5::timestamptz,
                 $6, $7::jsonb, $8, $9::jsonb, $10, $11, $12::jsonb)
         on conflict (workspace_id, canal_id, id_externo) where id_externo is not null do nothing
         returning ${COLUNAS_DE_MENSAGEM}`,
        [
          workspaceId,
          linha.conversaId,
          linha.canalId,
          linha.idExterno,
          linha.criadoEm,
          linha.conteudo,
          JSON.stringify(linha.anexos),
          linha.assunto,
          JSON.stringify(linha.enderecosAdicionais),
          linha.remetenteExterno,
          linha.identificadorId,
          JSON.stringify(linha.cargaBruta ?? null),
        ],
      );
      return rows[0] ? linhaParaMensagem(rows[0]) : undefined;
    },

    async obterPorIdExterno(workspaceId, canalId, idExterno) {
      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `select ${COLUNAS_DE_MENSAGEM}
           from plataforma.mensagens
          where workspace_id = $1 and canal_id = $2 and id_externo = $3`,
        [workspaceId, canalId, idExterno],
      );
      return rows[0] ? linhaParaMensagem(rows[0]) : undefined;
    },

    async cargaBruta(workspaceId, id) {
      const { rows } = await cliente.query<{ carga_bruta: unknown }>(
        "select carga_bruta from plataforma.mensagens where workspace_id = $1 and id = $2",
        [workspaceId, id],
      );
      return rows[0]?.carga_bruta ?? null;
    },
  };
}
