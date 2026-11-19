/**
 * A caixa de e-mail caiu (Fase 17, 17-05, D-17-20, EML-07): o leitor e o envio a chamam quando a senha deixa de valer ou a
 * autorização é retirada (o servidor recusou o login e repetir não adianta).
 *
 * O Canal passa de `conectada` a `desconectada`, a conta guarda o MOTIVO e o instante, e as abas são avisadas. A credencial
 * e a conta FICAM: a pessoa reconecta pela ficha (`conectarPorSenha` limpa o motivo e volta a `conectada`).
 *
 * D-17-20 pede `desconectada`, e o Instagram usa `com_erro` (`instagram/conexao.ts`, `marcarComErro`): a diferença é de
 * propósito. `com_erro` diz "conectou e algo falhou, tente de novo"; a caixa que perdeu a senha não tem o que repetir, e
 * `desconectada` é o estado em que a ficha oferece o formulário de conexão. As duas decisões são `[auto]` e o dono ainda
 * não as confirmou.
 *
 * Uma queda só vale uma vez: só o Canal ativo, `conectada` e REAL cai. Chamado de novo, ou num Canal simulado, arquivado ou
 * já desconectado, nada muda (o motivo e o instante da primeira queda ficam). A ordem das travas é a das outras escritas de
 * Canal: a linha do Espaço antes da do Canal.
 */

import type { Pool } from "pg";
import { proximaConexao } from "@n1/dominio/crm/canais";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { avancarRevisaoDoEspaco } from "../../../repositorios/crm/referencias";
import { sucesso } from "../../../servicos/crm/resultado";
import { comTransacao } from "../../../servicos/crm/transacao";
import { avisarCrm } from "../../avisar";
import { marcarQueda } from "./repositorio";

export async function registrarQuedaDoEmail(
  pool: () => Pool,
  alvo: { readonly workspaceId: string; readonly canalId: string },
  motivo: string,
): Promise<{ readonly mudou: boolean }> {
  const resultado = await comTransacao(pool, async (transacao) => {
    await transacao.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [alvo.workspaceId]);
    const canais = criarRepositorioDeCanaisPg(transacao);
    const canal = await canais.obter(alvo.workspaceId, alvo.canalId, { travar: true });
    if (!canal || canal.provedor !== "email-imap-smtp") return sucesso({ mudou: false });
    if (canal.estado !== "ativo" || canal.conexao !== "conectada" || canal.conexaoSimulada) return sucesso({ mudou: false });

    const proxima = proximaConexao(canal, "desconectar");
    if (!proxima.ok) return sucesso({ mudou: false });
    await canais.definirConexao(alvo.workspaceId, alvo.canalId, proxima.value);
    await marcarQueda(transacao, alvo.workspaceId, alvo.canalId, motivo);
    await avancarRevisaoDoEspaco(transacao, alvo.workspaceId);
    await avisarCrm(transacao, { workspaceId: alvo.workspaceId, tipo: "canal.mudou", canalId: alvo.canalId });
    return sucesso({ mudou: true });
  });
  // A transação só devolve sucesso; uma falha de banco chega aqui como exceção, e o chamador (leitor, envio) a trata.
  return resultado.ok ? resultado.valor : { mudou: false };
}
