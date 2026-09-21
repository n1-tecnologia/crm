import type { ReactNode } from "react";
import { PublicoProvider } from "@/dados/publico-provider";

/**
 * Escopo movido do `(publico)/layout.tsx` (Plan 02-20): só `/p/<segredo>`
 * (compartilhamento público de Tarefa) ainda lê o seed em memória via
 * `PublicoProvider` — `/f/<segredo>` fala direto com o `apps/api`.
 */
export default function PaginaPublicaLayout({ children }: { readonly children: ReactNode }) {
  return <PublicoProvider>{children}</PublicoProvider>;
}
