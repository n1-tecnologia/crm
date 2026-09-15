"use client";

/**
 * Estado recolhido/expandido da barra lateral.
 *
 * A escolha vale entre recargas, então mora no `localStorage`. É lido por
 * `useSyncExternalStore` em vez de ser copiado para dentro do React por um
 * efeito: assim o instantâneo do servidor é explícito ("expandida"), e o
 * cliente corrige na hidratação sem que isso vire erro de hidratação — que é o
 * que acontece quando se lê `localStorage` durante a renderização.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "n1:menu-recolhido";

/** Mudanças na MESMA aba: `storage` só dispara nas outras. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Ler e gravar armazenamento do site lança em alguns contextos — janela
 * anônima, navegador configurado para bloquear dados, gerador de miniatura.
 * Perder a preferência é aceitável; deixar a barra inteira falhar não é.
 *
 * Por isso a escolha vive em memória e é ESPELHADA no armazenamento. Sem isso, numa
 * janela onde gravar lança, o instantâneo continuaria o antigo depois do clique
 * e o botão pareceria morto — a preferência se perderia entre recargas, que é
 * aceitável, mas o controle deixaria de responder, que não é.
 */
let memoria: boolean | null = null;

function getSnapshot(): boolean {
  if (memoria !== null) return memoria;
  try {
    memoria = window.localStorage.getItem(STORAGE_KEY) === "sim";
  } catch (error) {
    console.warn("Preferência do menu não pôde ser lida; abrindo expandido.", error);
    memoria = false;
  }
  return memoria;
}

export function useSidebarCollapsed(): {
  readonly collapsed: boolean;
  readonly toggle: () => void;
} {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);

  return {
    collapsed,
    toggle: () => {
      const next = !collapsed;
      memoria = next;
      try {
        if (next) window.localStorage.setItem(STORAGE_KEY, "sim");
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn("Preferência do menu não pôde ser gravada; vale só nesta sessão.", error);
      }
      for (const notify of listeners) notify();
    },
  };
}
