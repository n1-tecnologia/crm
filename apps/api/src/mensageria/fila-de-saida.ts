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
 * nada é descartado, e o 16-06 reenfileira as pendentes quando o Canal volta.
 */

import type { PoolClient } from "pg";
import type { Canal } from "@n1/dominio/crm/canais";
import type { Mensagem } from "@n1/dominio/crm/mensagens";
import { gravarEventos } from "../persistencia/outbox";

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
