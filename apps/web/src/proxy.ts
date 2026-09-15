/**
 * Roda antes de toda requisição (o que o Next chamava de middleware).
 *
 * Faz duas coisas, e só duas: renova o token de sessão no cookie — sem isso
 * a sessão expiraria em uma hora mesmo com a pessoa usando o produto — e
 * manda para `/entrar` quem chega sem sessão numa rota protegida.
 *
 * É uma verificação otimista, lida do cookie, como o guia do Next pede:
 * nenhuma consulta ao banco aqui, porque isto roda inclusive nos prefetches.
 * A verificação de verdade é `usuarioAtual()`, chamada por quem renderiza.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas que se alcançam sem sessão. */
const PUBLICAS = ["/entrar", "/sair"];
/** Prefixos públicos por desenho: os Formulários e as Páginas com segredo na URL. */
const PREFIXOS_PUBLICOS = ["/f/", "/p/"];

export async function proxy(requisicao: NextRequest) {
  let resposta = NextResponse.next({ request: requisicao });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => requisicao.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value } of lista) requisicao.cookies.set(name, value);
          resposta = NextResponse.next({ request: requisicao });
          for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
        },
      },
    },
  );

  // `getUser()` é o que renova o token quando ele está para vencer.
  const { data } = await supabase.auth.getUser();
  const caminho = requisicao.nextUrl.pathname;
  const publica = PUBLICAS.includes(caminho) || PREFIXOS_PUBLICOS.some((p) => caminho.startsWith(p));

  if (!data.user && !publica) {
    const destino = requisicao.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = caminho === "/" ? "" : `?para=${encodeURIComponent(caminho)}`;
    return NextResponse.redirect(destino);
  }
  if (data.user && caminho === "/entrar") {
    return NextResponse.redirect(new URL("/", requisicao.url));
  }
  return resposta;
}

export const config = {
  // Tudo, menos o que o Next serve estático e os ícones.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|membros/|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
