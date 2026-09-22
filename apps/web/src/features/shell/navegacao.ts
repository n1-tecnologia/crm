"use client";

/**
 * "ESTÁ NAVEGANDO" — o único sinal de espera entre telas.
 *
 * O Next troca a árvore num quadro quando o chunk já está em cache; quando
 * não está (chunk frio, rede lenta) a tela velha fica de pé, inteira e
 * responsiva, e NADA diz que o clique valeu. Este store de módulo diz: quem
 * dispara uma navegação `marca` o alvo, a casca `limpa` quando o endereço
 * muda, e no meio a barra de rota (`BarraDeRota`), o `aria-busy` do `<main>`
 * e o ícone pendente do trilho contam a espera.
 *
 * Só navegação de VERDADE liga isto: `router.replace` de filtro, aba ou popup
 * por URL nunca marca. Segurança: uma navegação cancelada (chunk 404, não há
 * `error.tsx`) limpa sozinha depois de `--dur-navegacao-max` — longo de
 * propósito: numa rede lenta de verdade o Início leva mais de 8s para chegar,
 * e a espera precisa continuar sendo contada até lá.
 */

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useSyncExternalStore } from "react";
import { lerDuracao } from "@/design/movimento";

let alvo: string | null = null;
let seguranca: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Uma navegação começou rumo a `href`. */
export function marcar(href: string) {
  alvo = href;
  if (seguranca) clearTimeout(seguranca);
  seguranca = setTimeout(limpar, lerDuracao("--dur-navegacao-max", { medidor: true }));
  emitir();
}

/** Para o `onNavigate` de um `<Link>`: marca, salvo se o link aponta para onde já se está (a barra ficaria presa). */
export function marcarSeMuda(href: string) {
  if (!mesmoEndereco(href)) marcar(href);
}

/** O endereço mudou (ou a navegação morreu): nada mais pendente. */
export function limpar() {
  if (seguranca) {
    clearTimeout(seguranca);
    seguranca = null;
  }
  if (alvo === null) return;
  alvo = null;
  emitir();
}

const lerAlvo = () => alvo;
const lerNada = () => null;

/** O alvo pendente, ou `null`. */
export function useAlvo(): string | null {
  return useSyncExternalStore(assinar, lerAlvo, lerNada);
}

/** Há uma navegação a caminho? */
export function useNavegando(): boolean {
  return useAlvo() !== null;
}

/** Sem a barra final: o Next não distingue `/crm/contatos` de `/crm/contatos/`, e a comparação também não pode. */
function semBarraFinal(caminho: string): string {
  return caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho;
}

/** Mesmo pathname e mesma busca do endereço atual: um `push` que não muda nada — e que, marcado, prenderia a barra. */
function mesmoEndereco(href: string): boolean {
  const destino = new URL(href, window.location.href);
  return (
    semBarraFinal(destino.pathname) === semBarraFinal(window.location.pathname) && destino.search === window.location.search
  );
}

/**
 * `router.push` que conta a espera: `[navegar, pendente]`. O push acontece NO
 * ATO — nunca atrasado para uma animação terminar. Dentro de `startTransition`
 * para que a tela velha continue respondendo enquanto o chunk chega.
 */
export function useNavegar(): [(href: string) => void, boolean] {
  const router = useRouter();
  const pendente = useNavegando();
  const navegar = useCallback(
    (href: string) => {
      if (mesmoEndereco(href)) {
        router.push(href);
        return;
      }
      marcar(href);
      startTransition(() => router.push(href));
    },
    [router],
  );
  return [navegar, pendente];
}
