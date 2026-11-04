"use server";

/**
 * 12.3.4 — criar a senha depois do link do e-mail. A sessão já existe: quem
 * criou foi `/entrar/confirmar`, ao trocar o `token_hash` do link por ela.
 *
 * No convite (`tipo=invite`), a ação também aceita o convite na api
 * (`POST /convites/aceitar`) com o nome informado; o Membro passa de
 * `pendente` a `ativo`. Na redefinição (`tipo=recovery`), só troca a senha.
 *
 * A senha nunca sai daqui: vai ao Supabase Auth e mais nada.
 */

import { redirect } from "next/navigation";
import { postarNaApi } from "@/autenticacao/api-do-servidor";
import { clienteDoServidor } from "@/autenticacao/cliente-servidor";
import { recusaDaNovaSenha } from "@/autenticacao/senha";

export interface EstadoDaNovaSenha {
  readonly erro?: string;
}

export async function definirSenha(_anterior: EstadoDaNovaSenha, form: FormData): Promise<EstadoDaNovaSenha> {
  const convite = form.get("tipo") === "invite";
  const nome = String(form.get("nome") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");

  if (convite && !nome) return { erro: "Informe o seu nome." };
  const recusa = recusaDaNovaSenha(senha, confirmacao);
  if (recusa) return { erro: recusa };

  const supabase = await clienteDoServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    if (error.code === "same_password") return { erro: "A senha nova precisa ser diferente da anterior." };
    if (error.code === "weak_password") return { erro: "Essa senha é fraca demais. Escolha outra." };
    return { erro: "Não consegui gravar a senha. O link pode ter vencido: peça outro." };
  }

  if (convite) {
    const aceite = await postarNaApi("/convites/aceitar", { nome });
    if (!aceite.ok) return { erro: `A senha foi criada, mas o convite não foi aceito: ${aceite.erro}` };
  }
  redirect("/");
}
