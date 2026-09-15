import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { USUARIOS_DO_SEED } from "@n1/dominio";
import { usuarioAtual } from "@/autenticacao/sessao";
import { SessaoProvider } from "@/dados/sessao-provider";
import { AppShell } from "@/features/shell/app-shell";

/**
 * Every route inside this group renders within the shell (MAPA §2).
 *
 * É um Server Component: lê quem está autenticado (`usuarioAtual`, que valida
 * o token com o servidor) e resolve o Membro antes de a casca subir. Sem
 * sessão, `/entrar` — o `proxy.ts` já barra antes, mas o layout não confia
 * nele: a verificação de verdade fica perto de quem renderiza.
 *
 * A resolução Usuário → Membro é por `Member.userId`, como a ontologia pede
 * (A1.4). Enquanto o estado vive em memória no cliente, o servidor a faz
 * pelo mapa do seed; quando o estado vier da API, será uma consulta.
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

  const memberId = Object.entries(USUARIOS_DO_SEED).find(([, uid]) => uid === usuario.id)?.[0];

  /**
   * A fronteira envolve o SHELL INTEIRO, não só o conteúdo: a barra lateral
   * também lê o endereço (o "+" de criar contêiner vive nela), e uma fronteira
   * abaixo dela não a cobre — o build recusa a página e, em desenvolvimento, a
   * árvore cliente não hidrata.
   */
  return (
    <SessaoProvider userId={usuario.id} memberId={memberId}>
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
