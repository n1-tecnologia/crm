import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/features/shell/app-shell";

/**
 * Every route inside this group renders within the shell (MAPA §2).
 *
 * O `<Suspense>` não é decoração: as telas e os quinze diálogos leem o endereço
 * com `useSearchParams()`, e sem uma fronteira acima delas o Next recusa a
 * página inteira — em produção o build falha, e em desenvolvimento a árvore
 * cliente não hidrata, o que deixa a interface de pé e sem responder a clique
 * nenhum.
 */
export default function ShellLayout({ children }: { readonly children: ReactNode }) {
  /**
   * A fronteira envolve o SHELL INTEIRO, não só o conteúdo: a barra lateral
   * também lê o endereço (o "+" de criar contêiner vive nela), e uma fronteira
   * abaixo dela não a cobre — o build recusa a página e, em desenvolvimento, a
   * árvore cliente não hidrata.
   */
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
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
