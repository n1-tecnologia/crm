/**
 * O e-mail interpretado entra na fila de entrada e o cursor da caixa avança, numa transação só (Fase 17, 17-08, D-17-08 e
 * D-17-10). Nada aqui interpreta MIME nem loga: quem lê os bytes e monta o `corpo` é `traduzir.ts`; esta função só grava.
 *
 * Por que a mesma transação: se o `insert` e o cursor fossem passos separados, uma queda entre os dois perderia o e-mail
 * (cursor passou, linha não entrou) ou o leria de novo para sempre (linha entrou, cursor não passou). Juntos, ou os dois
 * acontecem ou nenhum. O `on conflict ... do nothing` cobre o e-mail que a caixa entrega duas vezes (UIDVALIDITY que
 * mudou, e-mail copiado entre pastas): a linha não duplica e o cursor avança do mesmo jeito.
 */

import type { Pool } from "pg";
import type { CorpoDoEmail } from "./traduzir";
import { gravarCursor, type CursorDaCaixa } from "./repositorio";

const PROVEDOR_DO_EMAIL = "email-imap-smtp";

export async function enfileirarEmailEAvancar(
  pool: () => Pool,
  alvo: { readonly workspaceId: string; readonly canalId: string },
  item: { readonly chave: string; readonly corpo: CorpoDoEmail },
  cursor: CursorDaCaixa,
): Promise<"guardada" | "repetida"> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    const r = await cliente.query(
      `insert into plataforma.webhooks_recebidos (workspace_id, canal_id, provedor, chave, corpo)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (workspace_id, canal_id, chave) where chave is not null do nothing`,
      [alvo.workspaceId, alvo.canalId, PROVEDOR_DO_EMAIL, item.chave, JSON.stringify(item.corpo)],
    );
    await gravarCursor(cliente, alvo.workspaceId, alvo.canalId, cursor);
    await cliente.query("commit");
    return (r.rowCount ?? 0) > 0 ? "guardada" : "repetida";
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}
