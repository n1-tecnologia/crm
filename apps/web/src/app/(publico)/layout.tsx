import type { ReactNode } from "react";

/**
 * As rotas que se alcançam sem sessão: o Formulário público (`/f/<segredo>`)
 * e a Página com segredo (`/p/<segredo>`). O grupo de rotas não muda a URL;
 * existe para as duas dividirem o prefixo que `proxy.ts` reconhece.
 *
 * Não monta `PublicoProvider` aqui: a partir do Plan 02-20, `/f/<segredo>`
 * fala com o `apps/api` por `transportePublico`, sem o store em memória
 * (D-02) — só `/p/<segredo>` (compartilhamento público de Tarefa) ainda lê o
 * seed em memória, e monta o próprio provider em `p/[segredo]/layout.tsx`.
 */
export default function PublicoLayout({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}
