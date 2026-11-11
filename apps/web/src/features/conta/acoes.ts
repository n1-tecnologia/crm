"use server";

/**
 * 12.3.6 — trocar a senha em Minha conta. Confere a senha atual entrando de
 * novo com ela (`signInWithPassword` no e-mail da sessão) e só então grava a
 * nova (`updateUser`). Com a atual errada, nada muda.
 *
 * As senhas vão ao Supabase Auth e a mais nada: nem log, nem resposta.
 */

import { clienteDoServidor } from "@/autenticacao/cliente-servidor";
import { recusaDaNovaSenha } from "@/autenticacao/senha";

export interface EstadoDaTroca {
  readonly erro?: string;
  readonly feito?: boolean;
}

export async function trocarSenha(_anterior: EstadoDaTroca, form: FormData): Promise<EstadoDaTroca> {
  const atual = String(form.get("atual") ?? "");
  const nova = String(form.get("nova") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");
  if (!atual) return { erro: "Informe a senha atual." };
  const recusa = recusaDaNovaSenha(nova, confirmacao);
  if (recusa) return { erro: recusa };

  const supabase = await clienteDoServidor();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return { erro: "Sua sessão expirou. Entre de novo." };

  const conferencia = await supabase.auth.signInWithPassword({ email, password: atual });
  if (conferencia.error) return { erro: "Senha atual incorreta." };

  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) {
    if (error.code === "same_password") return { erro: "A senha nova precisa ser diferente da atual." };
    if (error.code === "weak_password") return { erro: "Essa senha é fraca demais. Escolha outra." };
    return { erro: "Não consegui trocar a senha. Tente de novo." };
  }
  return { feito: true };
}
