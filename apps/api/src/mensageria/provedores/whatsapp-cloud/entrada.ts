/**
 * A entrada do WhatsApp oficial na fila da mensageria (Sessão 7, 7.2.4). A Meta chama UM endereço para todos os números do
 * app (`POST /webhooks/meta/whatsapp`), não um por Canal como `POST /webhooks/mensageria/:canalId`. Então esta função faz o
 * que a rota por Canal faz, para cada `value` do corpo (o mesmo desenho de `../instagram/entrada.ts`):
 *
 *   1. acha o Canal pelo número (`metadata.phone_number_id` → `whatsapp_cloud_numeros`, índice global): o Espaço vem da
 *      linha do Canal, nunca do corpo;
 *   2. resolve o provedor pelo Canal (`provedorDoCanal`) e confere a chamada INTEIRA com ele (`verificarChamada`: a
 *      assinatura da Meta sobre o corpo cru e o número deste Canal no corpo);
 *   3. grava cada item (uma mensagem ou um status) como UMA linha `pendente` de `plataforma.webhooks_recebidos`, com o id
 *      da mensagem (ou `status:<id>:<estado>`) como chave de deduplicação: a Meta que repete o evento não duplica a linha.
 *
 * Nada é interpretado aqui: quem lê a linha, acha ou cria o Contato e chama `receberMensagem` é o processador de entrada.
 * Número sem Canal, Canal arquivado ou simulado e provedor não ligado não gravam (só contam). Falha do banco sobe: a rota
 * responde 500 e a Meta reenvia, o que é o certo para uma chamada verificada.
 *
 * Nada aqui loga: quem chama recebe só contagens (o corpo tem número de telefone e texto de terceiros).
 */

import type { Pool } from "pg";
import { pool as poolPadrao } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import type { ChamadaDoWebhook } from "../../provedor";
import { canalParaProvedor, provedorDoCanal, registroPadrao, type ChavesDoCofre, type RegistroDeProvedores } from "../../registro";
import { numeroPeloId } from "./repositorio";
import { chaveDoItem, corpoDeUmItem, itensDoValor, valoresDoCorpo } from "./traduzir";

export interface ResultadoDaEntradaDaCloudApi {
  /** Linhas novas na fila (a repetida não conta). */
  readonly guardadas: number;
  /** Itens que já estavam na fila (a Meta repetiu o evento). */
  readonly repetidas: number;
  /** Números do corpo sem Canal ativo e real ligado. */
  readonly semCanal: number;
  /** Números cujo Canal recusou a chamada (assinatura ou número), ou sem provedor ligado. */
  readonly recusadas: number;
}

export interface DependenciasDaEntradaDaCloudApi {
  readonly pool?: () => Pool;
  /** Padrão: `lerChavesDoCofre()`, lido a cada chamada. */
  readonly chaves?: ChavesDoCofre;
  /** Padrão: `registroPadrao()`. */
  readonly registro?: RegistroDeProvedores;
}

export type EntradaDaCloudApi = (chamada: ChamadaDoWebhook) => Promise<ResultadoDaEntradaDaCloudApi>;

export function criarEntradaDaCloudApi(deps: DependenciasDaEntradaDaCloudApi = {}): EntradaDaCloudApi {
  const pool = deps.pool ?? poolPadrao;

  return async (chamada) => {
    // Lido a cada chamada, como a do Instagram: o ambiente pode mudar entre uma e outra, e os testes injetam o registro.
    const registro = deps.registro ?? registroPadrao();
    let guardadas = 0;
    let repetidas = 0;
    let semCanal = 0;
    let recusadas = 0;

    for (const valor of valoresDoCorpo(chamada.corpo)) {
      const numero = await numeroPeloId(pool(), valor.phoneNumberId);
      const canal = numero ? await criarRepositorioDeCanaisPg(pool()).obter(numero.workspaceId, numero.canalId) : undefined;
      // O Canal simulado é dos botões da ficha (D-15-12): um evento real da Meta nunca entra nele.
      if (!numero || !canal || canal.estado !== "ativo" || canal.conexaoSimulada || canal.provedor !== "whatsapp-cloud") {
        semCanal += 1;
        continue;
      }

      let verificada = false;
      let provedor;
      try {
        provedor = provedorDoCanal(canal, registro);
        const paraOProvedor = await canalParaProvedor(pool(), deps.chaves, numero.workspaceId, canal);
        verificada = provedor.verificarChamada(chamada, paraOProvedor);
      } catch {
        // Provedor não ligado ou cofre que não decifra: a mesma recusa da rota por Canal (D-16-03).
        verificada = false;
      }
      if (!verificada || !provedor) {
        recusadas += 1;
        continue;
      }

      for (const item of itensDoValor(valor.valor)) {
        // Um item por linha: a chave de deduplicação é dele, e um item que falha não segura os outros.
        const corpo = corpoDeUmItem(valor, item);
        const chave = provedor.chaveDaChamada?.(corpo) ?? chaveDoItem(corpo) ?? null;
        const r = await pool().query(
          `insert into plataforma.webhooks_recebidos (workspace_id, canal_id, provedor, chave, corpo)
           values ($1, $2, $3, $4, $5::jsonb)
           on conflict (workspace_id, canal_id, chave) where chave is not null do nothing`,
          [numero.workspaceId, canal.id, provedor.provedor, chave, JSON.stringify(corpo)],
        );
        if ((r.rowCount ?? 0) > 0) guardadas += 1;
        else repetidas += 1;
      }
    }

    return { guardadas, repetidas, semCanal, recusadas };
  };
}
