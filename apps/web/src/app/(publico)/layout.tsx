import type { ReactNode } from "react";

/**
 * As rotas que se alcançam sem sessão: o Formulário público (`/f/<segredo>`)
 * e a Página com segredo (`/p/<segredo>`). O grupo de rotas não muda a URL;
 * existe para as duas dividirem o prefixo que `proxy.ts` reconhece.
 *
 * Nenhum store aqui: `/f/<segredo>` (Plan 02-20) e `/p/<segredo>` (PARA-05)
 * falam com o `apps/api` por `transportePublico`, como Server Components,
 * sem seed em memória.
 */
export default function PublicoLayout({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}
