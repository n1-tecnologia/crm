"use server";

/**
 * Entrar com e-mail e senha. Roda no servidor porque é aqui que o cookie de
 * sessão é escrito; o navegador nunca vê a senha depois do submit.
 *
 * O erro volta em pt-BR e sem dizer se foi o e-mail ou a senha: dizer qual
 * dos dois errou é confirmar que o e-mail existe.
 */

import { redirect } from "next/navigation";
import { clienteDoServidor } from "@/autenticacao/cliente-servidor";

export interface EstadoDoLogin {
  readonly erro?: string;
}

export async function entrar(_anterior: EstadoDoLogin, form: FormData): Promise<EstadoDoLogin> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const para = String(form.get("para") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const supabase = await clienteDoServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { erro: "E-mail ou senha incorretos." };

  // Só volta para caminhos internos: um `para` externo seria redirecionamento aberto.
  redirect(para.startsWith("/") && !para.startsWith("//") ? para : "/");
}
