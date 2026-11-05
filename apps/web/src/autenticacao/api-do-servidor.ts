import "server-only";

/**
 * Chamar o `apps/api` de dentro de uma Server Action, com o `access_token` do
 * cookie da sessão — o mesmo transporte de `features/financeiro/dados/acoes.ts`,
 * para as ações da Sessão 12 (aceitar e reenviar convite).
 *
 * Nunca lança: uma exceção numa Server Action vira tela de erro inteira. O
 * token só vai no cabeçalho, nunca em log nem na resposta.
 */

import { clienteDoServidor } from "./cliente-servidor";

export type RespostaDaApi =
  | { readonly ok: true; readonly corpo: unknown }
  | { readonly ok: false; readonly status: number; readonly erro: string };

export async function postarNaApi(caminho: string, corpo?: unknown): Promise<RespostaDaApi> {
  const supabase = await clienteDoServidor();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo." };
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { ok: false, status: 500, erro: "NEXT_PUBLIC_API_URL não definida." };

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}${caminho}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, ...(corpo === undefined ? {} : { "content-type": "application/json" }) },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, erro: "Sem conexão com o servidor." };
  }

  let json: unknown;
  try {
    json = await resposta.json();
  } catch {
    json = undefined;
  }
  if (resposta.ok) return { ok: true, corpo: json };
  const erro = (json as { readonly error?: unknown } | undefined)?.error;
  return { ok: false, status: resposta.status, erro: typeof erro === "string" ? erro : `O servidor respondeu ${resposta.status}.` };
}
