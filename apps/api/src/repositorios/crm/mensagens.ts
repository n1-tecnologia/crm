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
 * único lugar que escreve e lê `carga_bruta`. 16-05 acrescenta `obter`,
 * `gravarEnvio` e `marcarFalha`: o desfecho da entrega pelo provedor. 16-06 acrescenta
 * `voltarParaPendente` ("Tentar de novo") e `atualizarStatusDeEntrega` (o status que o provedor informa): as únicas
 * mudanças de status que o repositório faz. 16-10 acrescenta `completarAnexos` (a mídia recebida que baixou numa passada
 * seguinte): a única mudança de anexo, e só na `recebida`.
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import {
  proximoStatusDeEntrega,
  type AnexoDaMensagem,
  type AtorDaMensagem,
  type DirecaoDaMensagem,
  type EnderecoAdicional,
  type Mensagem,
  type StatusDeEntrega,
  type TipoDeAtorDaMensagem,
} from "@n1/dominio/crm/mensagens";

/** O que o serviço decide gravar numa Mensagem enviada por uma pessoa. */
export interface LinhaNovaDeMensagem {
  readonly conversaId: string;
  readonly canalId: string;
  readonly direcao: "enviada" | "interna";
  readonly ator: { readonly tipo: "member"; readonly id: string };
  /** `null` na Mensagem só com anexo (INV-CXE-07: texto OU anexo). */
  readonly conteudo: string | null;
  /** `null` em `interna`; em `enviada`, o status inicial (B69). */
  readonly statusEntrega: StatusDeEntrega | null;
  readonly emRespostaAId?: string;
  /** Os anexos já conferidos no bucket (16-09); sem eles, a coluna fica com o padrão `[]`. */
  readonly anexos?: readonly AnexoDaMensagem[];
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
  /**
   * O `identificador_id` da `recebida` mais recente da Conversa que tem Identificador (por `criado_em` e `seq`): por onde o
   * Contato escreveu por último (WR-04), ou `null` sem nenhuma. Só escolhe o destino da resposta; quem o usa o confere na lista
   * de Identificadores do Contato da Conversa.
   */
  identificadorDaUltimaRecebida(workspaceId: string, conversaId: string): Promise<string | null>;
  /** Grava a `recebida`; `undefined` quando o id externo já existe no Canal (INV-CXE-08). */
  inserirRecebida(workspaceId: string, linha: LinhaDeMensagemRecebida): Promise<Mensagem | undefined>;
  obterPorIdExterno(workspaceId: string, canalId: string, idExterno: string): Promise<Mensagem | undefined>;
  /** A Mensagem por id, no Espaço, ou `undefined`. Nunca a carga bruta. */
  obter(workspaceId: string, id: string): Promise<Mensagem | undefined>;
  /**
   * O provedor aceitou o envio (16-05): grava o id dele e `enviada`. SÓ de `pendente` (a corrida com um
   * "Tentar de novo" ou com o retorno do provedor não regride nem repete); `undefined` quando já não era.
   */
  gravarEnvio(workspaceId: string, id: string, resultado: { readonly idExterno: string; readonly em: string }): Promise<Mensagem | undefined>;
  /**
   * O envio não saiu (ou não se sabe se saiu): `falhou` com o motivo em português de produto. SÓ de `pendente` ou
   * `enviada`; `undefined` quando já estava em outro estado (`entregue`, `lida`, `falhou`).
   */
  marcarFalha(workspaceId: string, id: string, motivo: string): Promise<Mensagem | undefined>;
  /**
   * "Tentar de novo" (16-06): a Mensagem `falhou` volta a `pendente`, sem o motivo. SÓ de `falhou` (a corrida entre
   * dois cliques ou com o retorno do provedor tem um vencedor só); `undefined` quando já estava em outro estado.
   * O `id_externo` não muda: uma `falhou` por resposta ambígua pode ter saído, e quem a reenvia assume isso.
   */
  voltarParaPendente(workspaceId: string, id: string): Promise<Mensagem | undefined>;
  /**
   * O status que o provedor informa (16-06, 3.6.5): acha a Mensagem por (Canal, id externo) com `for update` e só a
   * muda se o status AVANÇA (`proximoStatusDeEntrega`: uma `lida` seguida de um `entregue` atrasado continua `lida`).
   * `em` é o momento que o provedor deu, e `motivo` só vale quando o novo status é `falhou`. Chamar com o cliente
   * de uma transação, senão o `for update` não segura nada. `undefined` quando nenhuma Mensagem do Canal tem esse
   * id externo; `mudou: false` quando o status não avança (a Mensagem vem como estava).
   */
  atualizarStatusDeEntrega(
    workspaceId: string,
    canalId: string,
    idExterno: string,
    status: StatusDeEntrega,
    em: string,
    motivo?: string,
  ): Promise<{ readonly mensagem: Mensagem; readonly mudou: boolean } | undefined>;
  /**
   * A entrada de mídia (16-10): troca a lista de anexos de uma Mensagem `recebida` já gravada (a mídia que não tinha baixado
   * e agora baixou). SÓ de `recebida`: o anexo da `enviada` nasce pronto e nunca muda. `undefined` quando não há essa Mensagem.
   */
  completarAnexos(workspaceId: string, id: string, anexos: readonly AnexoDaMensagem[]): Promise<Mensagem | undefined>;
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
  /** As linhas antigas (08) não têm `baixado`: `linhaParaMensagem` lê `false`. */
  readonly anexos: readonly (Omit<AnexoDaMensagem, "baixado"> & { readonly baixado?: boolean })[];
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
    anexos: linha.anexos.map((anexo) => ({ ...anexo, baixado: anexo.baixado ?? false })),
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
            status_entrega, status_entrega_em, em_resposta_a_id, anexos)
         values ($1, $2, $3, $4, $5, $6, $7, $8::text,
                 case when $8::text is null then null else now() end, $9, $10::jsonb)
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
          JSON.stringify(linha.anexos ?? []),
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
          order by criado_em, plataforma.mensagens.seq
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

    async identificadorDaUltimaRecebida(workspaceId, conversaId) {
      const { rows } = await cliente.query<{ identificador_id: string }>(
        `select identificador_id
           from plataforma.mensagens
          where workspace_id = $1 and conversa_id = $2 and direcao = 'recebida' and identificador_id is not null
          order by criado_em desc, plataforma.mensagens.seq desc
          limit 1`,
        [workspaceId, conversaId],
      );
      return rows[0]?.identificador_id ?? null;
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

    async obter(workspaceId, id) {
      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `select ${COLUNAS_DE_MENSAGEM} from plataforma.mensagens where workspace_id = $1 and id = $2`,
        [workspaceId, id],
      );
      return rows[0] ? linhaParaMensagem(rows[0]) : undefined;
    },

    async gravarEnvio(workspaceId, id, resultado) {
      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `update plataforma.mensagens
            set id_externo = $3, status_entrega = 'enviada', status_entrega_em = $4::timestamptz, motivo_falha = null
          where workspace_id = $1 and id = $2 and direcao = 'enviada' and status_entrega = 'pendente'
          returning ${COLUNAS_DE_MENSAGEM}`,
        [workspaceId, id, resultado.idExterno, resultado.em],
      );
      return rows[0] ? linhaParaMensagem(rows[0]) : undefined;
    },

    async marcarFalha(workspaceId, id, motivo) {
      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `update plataforma.mensagens
            set status_entrega = 'falhou', status_entrega_em = now(), motivo_falha = $3
          where workspace_id = $1 and id = $2 and direcao = 'enviada' and status_entrega in ('pendente', 'enviada')
          returning ${COLUNAS_DE_MENSAGEM}`,
        [workspaceId, id, motivo],
      );
      return rows[0] ? linhaParaMensagem(rows[0]) : undefined;
    },

    async voltarParaPendente(workspaceId, id) {
      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `update plataforma.mensagens
            set status_entrega = 'pendente', status_entrega_em = now(), motivo_falha = null
          where workspace_id = $1 and id = $2 and direcao = 'enviada' and status_entrega = 'falhou'
          returning ${COLUNAS_DE_MENSAGEM}`,
        [workspaceId, id],
      );
      return rows[0] ? linhaParaMensagem(rows[0]) : undefined;
    },

    async atualizarStatusDeEntrega(workspaceId, canalId, idExterno, status, em, motivo) {
      const atual = await cliente.query<LinhaDoBancoDeMensagem>(
        `select ${COLUNAS_DE_MENSAGEM}
           from plataforma.mensagens
          where workspace_id = $1 and canal_id = $2 and id_externo = $3
            for update`,
        [workspaceId, canalId, idExterno],
      );
      if (!atual.rows[0]) return undefined;
      const mensagem = linhaParaMensagem(atual.rows[0]);
      const proximo = proximoStatusDeEntrega(mensagem.statusEntrega, status);
      if (proximo === null || proximo === mensagem.statusEntrega) return { mensagem, mudou: false };

      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `update plataforma.mensagens
            set status_entrega = $3, status_entrega_em = $4::timestamptz,
                motivo_falha = case when $3::text = 'falhou' then $5::text else null end
          where workspace_id = $1 and id = $2
          returning ${COLUNAS_DE_MENSAGEM}`,
        [workspaceId, mensagem.id, proximo, em, proximo === "falhou" ? (motivo ?? null) : null],
      );
      return { mensagem: linhaParaMensagem(rows[0]!), mudou: true };
    },

    async completarAnexos(workspaceId, id, anexos) {
      const { rows } = await cliente.query<LinhaDoBancoDeMensagem>(
        `update plataforma.mensagens
            set anexos = $3::jsonb
          where workspace_id = $1 and id = $2 and direcao = 'recebida'
          returning ${COLUNAS_DE_MENSAGEM}`,
        [workspaceId, id, JSON.stringify(anexos)],
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
