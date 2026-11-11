/**
 * A entrada do Instagram na fila da mensageria (Sessão 8, 3.6.3/3.6.4). A Meta chama UM endereço para todas as contas
 * do app (`POST /webhooks/meta/instagram`), não um por Canal como `POST /webhooks/mensageria/:canalId`. Então esta
 * função faz o que a rota por Canal faz, para cada conta do corpo:
 *
 *   1. acha o Canal pela conta (`entry[].id` → `instagram_contas`, índice global): o Espaço vem da linha do Canal,
 *      nunca do corpo;
 *   2. resolve o provedor pelo Canal (`provedorDoCanal`) e confere a chamada INTEIRA com ele (`verificarChamada`: a
 *      assinatura da Meta sobre o corpo cru e a conta deste Canal no corpo);
 *   3. grava cada item (`messaging[]`, ou `changes[]` do botão "Testar" do painel) como UMA linha `pendente` de
 *      `plataforma.webhooks_recebidos`, com o `mid` como chave de deduplicação: a Meta que repete o evento não
 *      duplica a linha.
 *
 * Nada é interpretado aqui: quem lê a linha, troca o IGSID pelo @ e chama `receberMensagem` é o processador de entrada.
 * Conta sem Canal, Canal arquivado ou simulado e provedor não ligado não gravam (só contam). Falha do banco sobe: a
 * rota responde 500 e a Meta reenvia, o que é o certo para uma chamada verificada.
 *
 * Nada aqui loga: quem chama recebe só contagens.
 */

import type { Pool } from "pg";
import { pool as poolPadrao } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import type { ChamadaDoWebhook } from "../../provedor";
import { canalParaProvedor, provedorDoCanal, registroPadrao, type ChavesDoCofre, type RegistroDeProvedores } from "../../registro";
import { contaPeloId } from "./repositorio";
import { entradasDoCorpo, itensDaEntrada } from "./traduzir";

export interface ResultadoDaEntradaDoInstagram {
  /** Linhas novas na fila (a repetida não conta). */
  readonly guardadas: number;
  /** Itens que já estavam na fila (a Meta repetiu o evento). */
  readonly repetidas: number;
  /** Contas do corpo sem Canal ativo e real ligado. */
  readonly semCanal: number;
  /** Contas cujo Canal recusou a chamada (assinatura ou conta), ou sem provedor ligado. */
  readonly recusadas: number;
}

export interface DependenciasDaEntradaDoInstagram {
  readonly pool?: () => Pool;
  /** Padrão: `lerChavesDoCofre()`, lido a cada chamada. */
  readonly chaves?: ChavesDoCofre;
  /** Padrão: `registroPadrao()`. */
  readonly registro?: RegistroDeProvedores;
}

export type EntradaDoInstagram = (chamada: ChamadaDoWebhook) => Promise<ResultadoDaEntradaDoInstagram>;

export function criarEntradaDoInstagram(deps: DependenciasDaEntradaDoInstagram = {}): EntradaDoInstagram {
  const pool = deps.pool ?? poolPadrao;
  const registro = deps.registro ?? registroPadrao();

  return async (chamada) => {
    let guardadas = 0;
    let repetidas = 0;
    let semCanal = 0;
    let recusadas = 0;

    for (const { contaId, entrada } of entradasDoCorpo(chamada.corpo)) {
      const conta = await contaPeloId(pool(), contaId);
      const canal = conta ? await criarRepositorioDeCanaisPg(pool()).obter(conta.workspaceId, conta.canalId) : undefined;
      // O Canal simulado é dos botões da ficha (D-15-12): um evento real da Meta nunca entra nele.
      if (!conta || !canal || canal.estado !== "ativo" || canal.conexaoSimulada || canal.provedor !== "instagram-graph") {
        semCanal += 1;
        continue;
      }

      let verificada = false;
      let provedor;
      try {
        provedor = provedorDoCanal(canal, registro);
        const paraOProvedor = await canalParaProvedor(pool(), deps.chaves, conta.workspaceId, canal);
        verificada = provedor.verificarChamada(chamada, paraOProvedor);
      } catch {
        // Provedor não ligado ou cofre que não decifra: a mesma recusa da rota por Canal (D-16-03).
        verificada = false;
      }
      if (!verificada || !provedor) {
        recusadas += 1;
        continue;
      }

      for (const item of itensDaEntrada(entrada)) {
        // Um item por linha: a chave de deduplicação é dele, e um item que falha não segura os outros.
        const corpo = { object: "instagram", entry: [{ id: contaId, ...(entrada.time === undefined ? {} : { time: entrada.time }), messaging: [item] }] };
        const chave = provedor.chaveDaChamada?.(corpo) ?? null;
        const r = await pool().query(
          `insert into plataforma.webhooks_recebidos (workspace_id, canal_id, provedor, chave, corpo)
           values ($1, $2, $3, $4, $5::jsonb)
           on conflict (workspace_id, canal_id, chave) where chave is not null do nothing`,
          [conta.workspaceId, canal.id, provedor.provedor, chave, JSON.stringify(corpo)],
        );
        if ((r.rowCount ?? 0) > 0) guardadas += 1;
        else repetidas += 1;
      }
    }

    return { guardadas, repetidas, semCanal, recusadas };
  };
}
