/**
 * 12.3.2 — o convite por e-mail no Supabase Auth: criar o Usuário convidado e
 * mandar o e-mail, reenviar a quem ainda não confirmou, e apagar o Usuário de
 * um convite que o domínio acabou recusando.
 *
 * Os serviços recebem isto por injeção (`AuthDeConvite`): os testes passam um
 * falso e nunca falam com o Auth de verdade. O e-mail (remetente, modelo e o
 * link `/entrar/confirmar?token_hash=…&type=invite`) é configuração do projeto
 * no Supabase (12.3.1); daqui sai só o `redirectTo`.
 *
 * Nada aqui grava token, link ou senha em log (ressalva de segurança da S12).
 */

import { clienteAdmin } from "./verificar-token";

export interface AuthDeConvite {
  /** Cria o Usuário e manda o e-mail de convite. Devolve o id do Usuário criado. */
  convidar(email: string): Promise<string>;
  /**
   * Reenvia o convite a um Usuário que ainda não confirmou. Lança
   * `ContaJaConfirmada` se a pessoa já criou a senha.
   */
  reenviar(email: string): Promise<string>;
  apagar(userId: string): Promise<void>;
}

/** A pessoa já confirmou a conta: não há convite a reenviar, ela entra com a senha dela. */
export class ContaJaConfirmada extends Error {}

/** O Auth recusou por limite de envio de e-mails (o SMTP padrão do Supabase tem teto baixo, 12.3.1). */
export class LimiteDeEnvio extends Error {}

/** A primeira origem de `WEB_ORIGIN` (a lista do CORS): para onde o link do e-mail leva. */
export function origemDaWeb(): string {
  return (process.env.WEB_ORIGIN ?? "http://localhost:3001").split(",")[0]!.trim();
}

const CODIGOS_DE_CONTA_EXISTENTE = new Set(["email_exists", "user_already_exists"]);

function traduzirErro(erro: { readonly code?: string; readonly status?: number; readonly message: string }): Error {
  if (erro.code === "over_email_send_rate_limit") return new LimiteDeEnvio("Limite de envio de e-mails do Auth atingido.");
  if ((erro.code && CODIGOS_DE_CONTA_EXISTENTE.has(erro.code)) || erro.status === 422) {
    return new ContaJaConfirmada("A conta já foi confirmada.");
  }
  return erro instanceof Error ? erro : new Error(erro.message);
}

async function convidarNoSupabase(email: string): Promise<string> {
  const { data, error } = await clienteAdmin().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origemDaWeb()}/entrar/confirmar`,
  });
  if (error) throw traduzirErro(error);
  return data.user.id;
}

export const authDeConviteDoSupabase: AuthDeConvite = {
  convidar: convidarNoSupabase,
  // O GoTrue reenvia o convite quando o Usuário existe e ainda não confirmou; com
  // a conta confirmada, recusa com `email_exists` (traduzido em `ContaJaConfirmada`).
  reenviar: convidarNoSupabase,
  async apagar(userId) {
    const { error } = await clienteAdmin().auth.admin.deleteUser(userId);
    if (error) throw error;
  },
};
