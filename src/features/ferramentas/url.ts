"use client";

/**
 * As telas de Ferramentas guardam na URL o que precisa sobreviver a um F5: o
 * registro aberto no popup (`?grupo=`, `?comunidade=`, `?flow=`), o diálogo
 * de criação (`?criar=`), os filtros e, no construtor, a Tela selecionada
 * (`?tela=`). O gesto é o de `empresas/page.tsx`: `replace` sem rolar, para o
 * popup abrir e fechar sem mexer no histórico.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** As três telas do assunto Ferramentas — uma rota cada: /ferramentas/<aba>. */
export type AbaDeFerramentas = "grupos" | "comunidades" | "flows";

export function useParametros() {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();

  const hrefCom = (mudancas: Record<string, string | null>): string => {
    const next = new URLSearchParams(query.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") next.delete(chave);
      else next.set(chave, valor);
    }
    return next.size > 0 ? `${pathname}?${next}` : pathname;
  };

  return {
    get: (chave: string): string | null => query.get(chave),
    set: (mudancas: Record<string, string | null>): void => {
      router.replace(hrefCom(mudancas), { scroll: false });
    },
    hrefCom,
    pathname,
  };
}
