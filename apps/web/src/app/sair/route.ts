/**
 * Sair. É uma rota e não uma Server Action porque um link `<a href="/sair">`
 * funciona de qualquer lugar e sem JavaScript; e é POST porque encerrar
 * sessão muda estado — um GET seria disparável por um `<img src>` alheio.
 */

import { NextResponse } from "next/server";
import { clienteDoServidor } from "@/autenticacao/cliente-servidor";

export async function POST(requisicao: Request) {
  const supabase = await clienteDoServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/entrar", requisicao.url), { status: 303 });
}
