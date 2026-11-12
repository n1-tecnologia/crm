/**
 * O que a Meta avisa quando a pessoa tira o acesso do app (Sessão 8; a Meta exige
 * os dois endereços para o login do Instagram):
 *
 *   - desautorização: a pessoa removeu o app nas configurações do Instagram;
 *   - exclusão de dados: a pessoa pediu que o app apague os dados dela.
 *
 * Os dois chegam com um `signed_request` (conferido na rota, por
 * `provedores/meta/assinatura.ts`) que diz o `user_id`. Para cada Canal ligado a
 * esse usuário: a conta e o token SOMEM (não ficam revogados) e o Canal fica
 * `desconectada`. As Conversas e Mensagens do Canal são dado do cliente da
 * plataforma, não da pessoa que conectou, e ficam.
 *
 * O código de confirmação da exclusão é assinado, não guardado: como a exclusão
 * acontece na hora, qualquer código que esta API emitiu corresponde a um pedido já
 * concluído, e a página de situação só precisa provar que o código é nosso.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { avancarRevisaoDoEspaco } from "../../../repositorios/crm/referencias";
import { avisarCrm } from "../../avisar";
import { contasDoUsuarioDaMeta, esquecerConta } from "./repositorio";

const PREFIXO_DO_CODIGO = "n1/instagram/exclusao:";

/** Desliga todo Canal ligado ao `userId` da Meta. Devolve quantos. */
export function criarEsquecimentoDoInstagram(deps: { readonly pool: () => Pool }): (userId: string) => Promise<number> {
  return async (userId) => {
    const contas = await contasDoUsuarioDaMeta(deps.pool(), userId);
    for (const conta of contas) {
      const conexao = await deps.pool().connect();
      try {
        await conexao.query("begin");
        await conexao.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [conta.workspaceId]);
        await esquecerConta(conexao, conta.workspaceId, conta.canalId);
        const canais = criarRepositorioDeCanaisPg(conexao);
        const canal = await canais.obter(conta.workspaceId, conta.canalId, { travar: true });
        if (canal && canal.conexao !== "desconectada") {
          await canais.definirConexao(conta.workspaceId, conta.canalId, { conexao: "desconectada", conexaoSimulada: false });
        }
        await avancarRevisaoDoEspaco(conexao, conta.workspaceId);
        await avisarCrm(conexao, { workspaceId: conta.workspaceId, tipo: "canal.mudou", canalId: conta.canalId });
        await conexao.query("commit");
      } catch (erro) {
        await conexao.query("rollback").catch(() => undefined);
        throw erro;
      } finally {
        conexao.release();
      }
    }
    return contas.length;
  };
}

function assinaturaDoCodigo(segredo: string, instante: string): string {
  return createHmac("sha256", segredo).update(PREFIXO_DO_CODIGO + instante).digest("base64url").slice(0, 22);
}

/** O código de confirmação que a Meta mostra à pessoa: `<instante em base36>-<assinatura>`. */
export function codigoDeExclusao(segredo: string, agora: number = Date.now()): string {
  const instante = agora.toString(36);
  return `${instante}-${assinaturaDoCodigo(segredo, instante)}`;
}

/** O instante do pedido, se o código é desta API; `undefined` se não é. */
export function lerCodigoDeExclusao(segredos: readonly string[], codigo: string): Date | undefined {
  // A assinatura é base64url e pode ter `-`; o instante, em base 36, nunca tem: corta no PRIMEIRO `-`.
  const corte = codigo.indexOf("-");
  if (corte < 0) return undefined;
  const instante = codigo.slice(0, corte);
  const assinado = codigo.slice(corte + 1);
  if (!/^[0-9a-z]{1,12}$/.test(instante) || !/^[A-Za-z0-9_-]{22}$/.test(assinado)) return undefined;
  const recebido = Buffer.from(assinado);
  const confere = segredos.some((segredo) => {
    const esperado = Buffer.from(assinaturaDoCodigo(segredo, instante));
    return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
  });
  if (!confere) return undefined;
  const momento = new Date(parseInt(instante, 36));
  return Number.isNaN(momento.getTime()) ? undefined : momento;
}
