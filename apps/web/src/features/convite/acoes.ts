"use server";

/**
 * 12.3.2 e 12.3.3 — as ações do convite que falam com o `apps/api` com o token
 * do cookie da sessão (`postarNaApi`): aceitar o próprio convite e reenviar o
 * convite de outra pessoa. Nenhuma lança: devolvem a frase do desfecho.
 */

import { redirect } from "next/navigation";
import { postarNaApi } from "@/autenticacao/api-do-servidor";

export interface EstadoDoAceite {
  readonly erro?: string;
}

/**
 * O pendente que entrou com a senha que já tinha (o convite não mandou e-mail
 * porque o e-mail já tinha conta) aceita aqui, informando o nome.
 */
export async function aceitarOConvite(_anterior: EstadoDoAceite, form: FormData): Promise<EstadoDoAceite> {
  const nome = String(form.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o seu nome." };
  const resposta = await postarNaApi("/convites/aceitar", { nome });
  if (!resposta.ok) return { erro: resposta.erro };
  redirect("/");
}

export type ResultadoDoReenvio = { readonly ok: true; readonly aviso?: string } | { readonly ok: false; readonly erro: string };

/** Reenviar o convite de um Membro pendente (só Administrador ou Proprietário; quem decide é a api). */
export async function reenviarOConvite(memberId: string): Promise<ResultadoDoReenvio> {
  const resposta = await postarNaApi(`/membros/${encodeURIComponent(memberId)}/convite`);
  if (!resposta.ok) return { ok: false, erro: resposta.erro };
  const aviso = (resposta.corpo as { readonly aviso?: unknown } | undefined)?.aviso;
  return typeof aviso === "string" ? { ok: true, aviso } : { ok: true };
}
