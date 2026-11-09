/**
 * A fila de saída da mensageria (3.7.1, MSG-02): a Mensagem que a Caixa escreve entra em
 * `plataforma.integration_outbox` como `mensagem.enviar.v1`, no MESMO cliente da transação que a grava.
 *
 * Quem chama passa o `PoolClient` da transação aberta — esta função nunca abre conexão própria. Foi isso que
 * faz "a Mensagem existe se e somente se o evento existe" ser verdade: se o insert do evento falha, a exceção
 * sobe e o `comTransacao` desfaz a Mensagem junto. Nada de rede aqui: quem entrega é outro processo,
 * fora da transação.
 *
 * O evento leva só ids (`EVENTOS["mensagem.enviar.v1"]`, `.strict()`): o texto e o telefone o entregador busca
 * de volta no banco. Um Canal que não está `conectada` guarda a Mensagem `pendente` e NÃO enfileira (B69):
 * nada é descartado, e `reenfileirarPendentesDoCanal` reenfileira as pendentes quando o Canal volta.
 *
 * A 013 só admite UMA linha `mensagem.enviar.v1` por Mensagem (`integration_outbox_mensagem_enviar_uniq`). Por isso
 * "Tentar de novo" e o Canal que volta não inserem outra: `reenfileirarEnvio` REABRE a linha existente por
 * `on conflict ... do update`, repetindo o predicado do índice parcial (sem ele o Postgres não acha o índice).
 */

import type { PoolClient } from "pg";
import type { Canal } from "@n1/dominio/crm/canais";
import type { Mensagem } from "@n1/dominio/crm/mensagens";
import { EVENTOS, gravarEventos } from "../persistencia/outbox";

/** `aggregate_type` do evento: casa com o índice único `integration_outbox_mensagem_enviar_uniq` da 013. */
const TIPO_DO_AGREGADO = "mensagem";

/**
 * Enfileira o envio de uma Mensagem `enviada` pelo cliente da transação corrente. Devolve `true` quando gravou
 * a linha e `false` quando o Canal não está `conectada` (a Mensagem fica `pendente`, sem evento).
 */
export async function enfileirarEnvio(
  cliente: PoolClient,
  workspaceId: string,
  mensagem: Pick<Mensagem, "id" | "conversaId" | "canalId">,
  canal: Pick<Canal, "conexao">,
): Promise<boolean> {
  if (canal.conexao !== "conectada") return false;
  await gravarEventos(cliente, workspaceId, [
    {
      type: "mensagem.enviar.v1",
      aggregateType: TIPO_DO_AGREGADO,
      aggregateId: mensagem.id,
      payload: { mensagemId: mensagem.id, conversaId: mensagem.conversaId, canalId: mensagem.canalId },
    },
  ]);
  return true;
}

/**
 * Põe a Mensagem de volta na fila pelo cliente da transação corrente. Sem linha, insere; com a linha de antes,
 * a reabre (`pending`, sem tentativas, disponível agora, sem trava nem erro): nunca `23505`.
 *
 * Só reabre linha `failed` ou `delivered`. Uma linha `pending` já vai ser entregue e uma `delivering` está nas
 * mãos de um worker: zerá-las agora soltaria a trava debaixo dele e a Mensagem poderia sair duas vezes.
 * Devolve `true` quando a linha foi inserida ou reaberta.
 *
 * Quem chama é responsável por ter a Mensagem `pendente` ANTES (a "Tentar de novo" a devolve a `pendente` antes
 * de reabrir a linha): o entregador só envia o que está `pendente`, e dá por resolvida a que não está.
 */
export async function reenfileirarEnvio(
  cliente: PoolClient,
  workspaceId: string,
  mensagem: Pick<Mensagem, "id" | "conversaId" | "canalId">,
): Promise<boolean> {
  const payload = EVENTOS["mensagem.enviar.v1"].parse({
    mensagemId: mensagem.id,
    conversaId: mensagem.conversaId,
    canalId: mensagem.canalId,
  });
  // `clock_timestamp()` (e não `now()`): várias Mensagens reabertas na mesma transação saem na ordem em que foram
  // reenfileiradas, não num empate de `available_at` desfeito pelo uuid.
  const { rowCount } = await cliente.query(
    `insert into plataforma.integration_outbox (workspace_id, aggregate_type, aggregate_id, event_type, payload)
     values ($1, $2, $3, 'mensagem.enviar.v1', $4::jsonb)
     on conflict (workspace_id, aggregate_type, aggregate_id, event_type) where event_type = 'mensagem.enviar.v1'
     do update set status = 'pending', attempts = 0, available_at = clock_timestamp(), locked_at = null, locked_by = null,
                   last_error_code = null, last_error_summary = null, delivered_at = null, payload = excluded.payload
       where plataforma.integration_outbox.status in ('failed', 'delivered')`,
    [workspaceId, TIPO_DO_AGREGADO, mensagem.id, JSON.stringify(payload)],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * O Canal voltou a `conectada` (B69): todas as Mensagens `enviada` ainda `pendente` dele voltam à fila, na ordem em
 * que foram escritas. Nada é descartado. Devolve quantas linhas foram inseridas ou reabertas.
 */
export async function reenfileirarPendentesDoCanal(cliente: PoolClient, workspaceId: string, canalId: string): Promise<number> {
  const { rows } = await cliente.query<{ id: string; conversa_id: string; canal_id: string }>(
    `select id, conversa_id, canal_id
       from plataforma.mensagens
      where workspace_id = $1 and canal_id = $2 and direcao = 'enviada' and status_entrega = 'pendente'
      order by criado_em, seq`,
    [workspaceId, canalId],
  );
  let reenfileiradas = 0;
  for (const linha of rows) {
    if (await reenfileirarEnvio(cliente, workspaceId, { id: linha.id, conversaId: linha.conversa_id, canalId: linha.canal_id })) {
      reenfileiradas += 1;
    }
  }
  return reenfileiradas;
}
