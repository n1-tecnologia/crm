import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { usuarioAtual } from "@/autenticacao/sessao";
import { carregarEstadoInicial } from "@/dados/estado-inicial";
import { SessaoProvider } from "@/dados/sessao-provider";
import { AppShell } from "@/features/shell/app-shell";
import { Painel } from "@/features/shell/ui";

/**
 * Every route inside this group renders within the shell (MAPA §2).
 *
 * É um Server Component: lê quem está autenticado (`usuarioAtual`, que valida
 * o token com o servidor) e carrega o estado inicial do `apps/api` antes de a
 * casca subir. Sem sessão, `/entrar` — o `proxy.ts` já barra antes, mas o
 * layout não confia nele: a verificação de verdade fica perto de quem
 * renderiza.
 *
 * A resolução Usuário → Membro agora é do `apps/api` (`GET /estado` devolve
 * `sessao.memberId`); a casca passa o estado inicial já hidratado para o
 * store — o HTML do servidor sai com os dados certos desde o primeiro byte,
 * não com um seed em memória.
 *
 * O `<Suspense>` não é decoração: as telas e os quinze diálogos leem o endereço
 * com `useSearchParams()`, e sem uma fronteira acima delas o Next recusa a
 * página inteira — em produção o build falha, e em desenvolvimento a árvore
 * cliente não hidrata, o que deixa a interface de pé e sem responder a clique
 * nenhum.
 */
export default async function ShellLayout({ children }: { readonly children: ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");

  const inicial = await carregarEstadoInicial();

  // O token do cookie não serviu ao `apps/api` (expirou entre `usuarioAtual()`
  // e esta chamada, por exemplo) — mesmo destino de não estar autenticado.
  if (inicial.tipo === "semSessao") redirect("/entrar");

  if (inicial.tipo === "indisponivel") {
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <Painel solido className="w-full max-w-md p-6">
          <h1 className="ed-titulo">Servidor indisponível</h1>
          <p className="app-base mt-2" style={{ color: "var(--texto-2)" }}>
            A interface não conseguiu falar com o servidor da plataforma. Tente de novo em instantes.
          </p>
          <form action="/sair" method="post" className="mt-6">
            <button type="submit" className="btn alvo-toque">Sair</button>
          </form>
        </Painel>
      </main>
    );
  }

  /**
   * A fronteira envolve o SHELL INTEIRO, não só o conteúdo: a barra lateral
   * também lê o endereço (o "+" de criar contêiner vive nela), e uma fronteira
   * abaixo dela não a cobre — o build recusa a página e, em desenvolvimento, a
   * árvore cliente não hidrata.
   */
  return (
    <SessaoProvider userId={usuario.id} inicial={inicial}>
      <Suspense fallback={<ShellFallback />}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </SessaoProvider>
  );
}

function ShellFallback() {
  return (
    <div className="p-6">
      <p role="status" className="text-[length:var(--texto-base)] text-[var(--cor-tinta-fraca)]">
        Carregando a tela…
      </p>
    </div>
  );
}
