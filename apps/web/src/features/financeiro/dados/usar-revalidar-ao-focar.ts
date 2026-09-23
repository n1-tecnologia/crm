"use client";

/**
 * Revalida a leitura da tela quando a aba volta a ficar visível ou a janela
 * ganha foco — o mesmo gesto do botão "Atualizar" (`router.refresh()`), só
 * que automático quando a pessoa retorna à aba (D4-15). Nenhum temporizador
 * periódico: não há Realtime nesta fase, e um intervalo fingiria que há um
 * canal empurrando dado, quando não há nenhum.
 *
 * Exportada como `useRevalidarAoFocar` (não `usarRevalidarAoFocar`, o nome do
 * arquivo e da UI-SPEC): todo hook deste repositório começa com o `use`
 * literal em inglês, mesmo com o resto do nome em português (`useNomeDoAtor`,
 * `useAgir`, `useAlvo`, `useFormat`…) — é o prefixo que
 * `eslint-plugin-react-hooks` (`rules-of-hooks`) usa para reconhecer a função
 * como Hook e aplicar as regras de chamada condicional. `usarRevalidarAoFocar`
 * reprovaria `npm run lint -w @n1/web`.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRevalidarAoFocar(): void {
  const router = useRouter();

  useEffect(() => {
    function revalidar(): void {
      if (document.visibilityState === "visible") router.refresh();
    }

    document.addEventListener("visibilitychange", revalidar);
    window.addEventListener("focus", revalidar);

    return () => {
      document.removeEventListener("visibilitychange", revalidar);
      window.removeEventListener("focus", revalidar);
    };
  }, [router]);
}
