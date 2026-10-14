import "server-only";

/**
 * A carga inicial do store, resolvida no servidor (D-04): `GET /estado` com
 * o token do cookie da sessão. `usuarioAtual()` (`autenticacao/sessao.ts`) já
 * validou QUEM está autenticado antes de a casca decidir se sobe — esta
 * função só pega o token para o `apps/api` decidir O QUE esse Usuário pode
 * ver. `getSession()` (não `getUser()`) porque aqui não estamos validando
 * identidade de novo, só lendo o `access_token` que o cookie já carrega; a
 * validação de verdade é do `apps/api` (`getClaims()`, Plan 01-02).
 *
 * `cache: "no-store"`: o estado muda a cada operação gravada — uma resposta
 * cacheada pelo Next mostraria uma Conta que já não existe mais daquele
 * jeito depois do primeiro F5.
 */

import { cache } from "react";
import { clienteDoServidor } from "@/autenticacao/cliente-servidor";
import type { EstadoDoServidor } from "./transporte";

export type EstadoInicial =
  | { readonly tipo: "ok"; readonly estado: EstadoDoServidor }
  | { readonly tipo: "semSessao" } // 401 — o token do cookie não serviu ao apps/api
  | { readonly tipo: "semAcesso"; readonly motivo: string } // 403 — a frase vem da API
  | { readonly tipo: "indisponivel"; readonly erro: string }; // rede/500

async function corpoDeErro(resposta: Response): Promise<string | undefined> {
  try {
    const corpo = (await resposta.json()) as { readonly error?: string };
    return corpo.error;
  } catch {
    return undefined;
  }
}

/** Memoizada por requisição — a mesma disciplina de `usuarioAtual()`. */
export const carregarEstadoInicial = cache(async (): Promise<EstadoInicial> => {
  const supabase = await clienteDoServidor();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { tipo: "semSessao" };

  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL não definida");

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}/estado`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (erro) {
    return { tipo: "indisponivel", erro: erro instanceof Error ? erro.message : "Sem conexão com o servidor." };
  }

  if (resposta.status === 401) return { tipo: "semSessao" };
  if (resposta.status === 403) {
    return { tipo: "semAcesso", motivo: (await corpoDeErro(resposta)) ?? "Sem acesso." };
  }
  if (!resposta.ok) {
    return { tipo: "indisponivel", erro: (await corpoDeErro(resposta)) ?? `O servidor respondeu ${resposta.status}.` };
  }

  const corpo = (await resposta.json()) as { data: EstadoDoServidor["data"]; revisao: number; ordens: EstadoDoServidor["ordens"]; sessao: { memberId: EstadoDoServidor["memberId"] }; sequencia?: number };
  return {
    tipo: "ok",
    estado: {
      data: corpo.data,
      revisao: corpo.revisao,
      ordens: corpo.ordens,
      memberId: corpo.sessao.memberId,
      ...(typeof corpo.sequencia === "number" ? { sequencia: corpo.sequencia } : {}),
    },
  };
});
