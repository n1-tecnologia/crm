/**
 * 12.3.4 — o link do e-mail de convite ou de "Esqueci a senha" cai aqui:
 * `/entrar/confirmar?token_hash=…&type=invite|recovery` (os modelos de e-mail
 * do Supabase Auth apontam para cá, 12.3.1).
 *
 * `verifyOtp` troca o `token_hash` por uma sessão, escrita no cookie, e a
 * pessoa segue para criar a senha (`/entrar/nova-senha`). Link vencido, já
 * usado ou adulterado volta para `/entrar` com a frase de cada caso. O token
 * nunca vai a log nem a outra URL.
 */

import { NextResponse, type NextRequest } from "next/server";
import { clienteDoServidor } from "@/autenticacao/cliente-servidor";

const TIPOS = new Set(["invite", "recovery"]);

export async function GET(requisicao: NextRequest) {
  const tokenHash = requisicao.nextUrl.searchParams.get("token_hash");
  const tipo = requisicao.nextUrl.searchParams.get("type");
  const vencido = () =>
    NextResponse.redirect(new URL(`/entrar?aviso=${tipo === "recovery" ? "senha-vencida" : "convite-vencido"}`, requisicao.url), { status: 303 });

  if (!tokenHash || !tipo || !TIPOS.has(tipo)) return vencido();

  const supabase = await clienteDoServidor();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo as "invite" | "recovery" });
  if (error) return vencido();

  return NextResponse.redirect(new URL(`/entrar/nova-senha?tipo=${tipo}`, requisicao.url), { status: 303 });
}
