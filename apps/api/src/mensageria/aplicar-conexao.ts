/**
 * Grava no Canal a conexão que o PROVEDOR disse (ou que a conferência periódica leu nele): o mesmo passo do
 * processador de entrada (evento `conexao`, 3.7.1 item 5 / B69) e da conferência de tempos em tempos (Sessão 4, 4.3.2),
 * num lugar só para as duas nunca divergirem.
 *
 * Só vale para Canal REAL: um Canal simulado continua sendo dos botões da ficha, e o arquivado não tem conexão. A mesma
 * ordem de travas de `servicos/crm/canais.ts` (WR-02): a linha do Espaço ANTES da do Canal. Quem repete a conexão atual
 * não sobe a revisão (a tela não recarrega à toa), mas um Canal `conectada` sempre reenfileira as Mensagens `pendente`:
 * é a rede para a que ficou guardada, e a linha que já está `pending` ou `delivering` não é tocada.
 *
 * Quando a conexão MUDA, as abas abertas são avisadas (`canal.mudou`, só o id do Canal, no mesmo commit): o WhatsApp que
 * foi desconectado pelo celular ou pelo painel da Evolution aparece como desconectado sem ninguém recarregar a tela.
 */

import type { Pool } from "pg";
import { proximaConexao, type ConexaoDoCanal } from "@n1/dominio/crm/canais";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { avancarRevisaoDoEspaco } from "../repositorios/crm/referencias";
import { avisarCrm } from "./avisar";
import { reenfileirarPendentesDoCanal } from "./fila-de-saida";

export interface DesfechoDaConexao {
  /** `ignorado:<motivo>` quando nada foi gravado por regra; `undefined` quando o Canal acompanhou o provedor. */
  readonly resultado?: string;
  /** A conexão do Canal mudou (a revisão do Espaço subiu). */
  readonly mudou: boolean;
  /** As Mensagens `pendente` do Canal foram reenfileiradas: quem chama acorda o worker de saída depois do commit. */
  readonly reenfileirou: boolean;
}

export interface OpcoesDaConexao {
  /**
   * A conexão que FALHOU ao ser feita (o QR foi lido por outro número, a credencial foi recusada, a instância sumiu), e não
   * uma queda de uma conexão que existia. Só ela leva um Canal `desconectada` a `com_erro`: a pessoa pediu para conectar e a
   * tentativa deu errado, então a ficha precisa dizer isso. Uma queda (`close` por outra razão) num Canal já desconectado
   * segue ignorada (`conexao_perdida` do domínio).
   */
  readonly tentativaFalhada?: boolean;
}

export async function aplicarConexaoAoCanal(
  pool: () => Pool,
  alvo: { readonly workspaceId: string; readonly canalId: string },
  conexao: ConexaoDoCanal,
  opcoes: OpcoesDaConexao = {},
): Promise<DesfechoDaConexao> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    await cliente.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [alvo.workspaceId]);
    const canais = criarRepositorioDeCanaisPg(cliente);
    const canal = await canais.obter(alvo.workspaceId, alvo.canalId, { travar: true });
    let resultado: string | undefined;
    let mudou = false;
    let reenfileirou = false;
    if (!canal) {
      resultado = "ignorado:canal_nao_encontrado";
    } else if (canal.estado === "arquivado") {
      resultado = "ignorado:canal_arquivado";
    } else if (canal.conexaoSimulada) {
      resultado = "ignorado:conexao_simulada";
    } else if (conexao === "com_erro" && opcoes.tentativaFalhada !== true && !proximaConexao(canal, "conexao_perdida").ok) {
      // Um `close` por queda num Canal já `desconectada` (depois do "Desconectar", ou de um QR que expirou sem ninguém ler)
      // não tem conexão a perder: o domínio recusa `conexao_perdida` e o Canal segue como está.
      resultado = "ignorado:sem_conexao_a_perder";
    } else {
      if (canal.conexao !== conexao) {
        await canais.definirConexao(alvo.workspaceId, alvo.canalId, { conexao, conexaoSimulada: false });
        await avancarRevisaoDoEspaco(cliente, alvo.workspaceId);
        await avisarCrm(cliente, { workspaceId: alvo.workspaceId, tipo: "canal.mudou", canalId: alvo.canalId });
        mudou = true;
      }
      if (conexao === "conectada") {
        await reenfileirarPendentesDoCanal(cliente, alvo.workspaceId, alvo.canalId);
        reenfileirou = true;
      }
    }
    await cliente.query("commit");
    return { ...(resultado === undefined ? {} : { resultado }), mudou, reenfileirou };
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}
