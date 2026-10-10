/**
 * O cliente HTTP do CRM: `fetch` com o JWT do Supabase contra as rotas REST de
 * `apps/api` (`/contatos`, `/empresas`, `/funis`, `/negocios`). Módulo puro —
 * sem `"use client"`: quem o importa decide onde roda.
 *
 * Duas regras de segurança que o código abaixo segura:
 *   - o token só existe dentro de `chamarCrm`, só vai no cabeçalho
 *     `authorization` e só para `NEXT_PUBLIC_API_URL`; nunca é logado
 *     (T-07-07);
 *   - `content-type: application/json` só sai quando há corpo — um DELETE sem
 *     corpo com esse cabeçalho vira 400 no Fastify 5 (Pitfall 4).
 *
 * Envelope de resposta (ver `apps/api/src/rotas/crm/comum.ts`): sucesso de item
 * `{ ok: true, dados }`, de lista `{ ok: true, itens, total }`, erro
 * `{ ok: false, error, codigo?, campo?, bloqueios? }`.
 */

import { mutate } from "swr";
import { clienteDoNavegador } from "@/autenticacao/cliente-navegador";
import type { BloqueiosCrm } from "@n1/dominio/crm/comum";

/** Uma recusa da api (ou a falta de sessão/rede) com o que a tela precisa para reagir. */
export class ErroDeApi extends Error {
  readonly status: number;
  readonly codigo: string | undefined;
  readonly campo: string | undefined;
  readonly bloqueios: BloqueiosCrm | undefined;

  constructor(
    status: number,
    mensagem: string,
    extra: { readonly codigo?: string | undefined; readonly campo?: string | undefined; readonly bloqueios?: BloqueiosCrm | undefined } = {},
  ) {
    super(mensagem);
    this.name = "ErroDeApi";
    this.status = status;
    this.codigo = extra.codigo;
    this.campo = extra.campo;
    this.bloqueios = extra.bloqueios;
  }
}

interface CorpoDeErro {
  readonly error?: string;
  readonly codigo?: string;
  readonly campo?: string;
  readonly bloqueios?: BloqueiosCrm;
}

export async function chamarCrm<T>(
  caminho: string,
  init: { readonly method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; readonly corpo?: unknown } = {},
): Promise<T> {
  const token = (await clienteDoNavegador().auth.getSession()).data.session?.access_token;
  if (!token) throw new ErroDeApi(401, "Sua sessão expirou. Entre de novo.");

  const temCorpo = init.corpo !== undefined;
  const cabecalhos: Record<string, string> = { authorization: `Bearer ${token}` };
  if (temCorpo) cabecalhos["content-type"] = "application/json";

  let resposta: Response;
  try {
    resposta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${caminho}`, {
      method: init.method ?? "GET",
      headers: cabecalhos,
      ...(temCorpo ? { body: JSON.stringify(init.corpo) } : {}),
    });
  } catch {
    throw new ErroDeApi(0, "Sem conexão com o servidor.");
  }

  if (!resposta.ok) {
    let corpo: CorpoDeErro = {};
    try {
      corpo = (await resposta.json()) as CorpoDeErro;
    } catch {
      // resposta sem JSON: fica a mensagem genérica abaixo
    }
    throw new ErroDeApi(resposta.status, corpo.error ?? "O servidor não respondeu.", {
      codigo: corpo.codigo,
      campo: corpo.campo,
      bloqueios: corpo.bloqueios,
    });
  }
  return (await resposta.json()) as T;
}

/** Revalida toda chave SWR de texto que começa com `prefixo` (ex.: `/contatos`). */
export function invalidarCrm(prefixo: string): Promise<unknown> {
  return mutate((chave) => typeof chave === "string" && chave.startsWith(prefixo));
}
