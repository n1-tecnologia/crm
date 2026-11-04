"use server";

/**
 * 12.3.5 — pedir o link de redefinição de senha. A resposta é SEMPRE a mesma,
 * exista ou não o e-mail: dizer "não achamos este e-mail" é confirmar quem
 * tem conta (o mesmo cuidado de `../actions.ts`). O link do e-mail cai em
 * `/entrar/confirmar?type=recovery`, que segue para `/entrar/nova-senha`.
 */

import { headers } from "next/headers";
import { clienteDoServidor } from "@/autenticacao/cliente-servidor";

export interface EstadoDoPedido {
  readonly erro?: string;
  readonly enviado?: boolean;
}

export async function pedirLinkDeSenha(_anterior: EstadoDoPedido, form: FormData): Promise<EstadoDoPedido> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { erro: "Informe o e-mail." };

  // O Auth só aceita `redirectTo` da lista de URLs permitidas do projeto (12.3.1).
  const origem = (await headers()).get("origin");
  const supabase = await clienteDoServidor();
  // O erro (e-mail inexistente, limite de envio) não muda a resposta: ver o comentário do arquivo.
  await supabase.auth.resetPasswordForEmail(email, origem ? { redirectTo: `${origem}/entrar/confirmar` } : {});
  return { enviado: true };
}
