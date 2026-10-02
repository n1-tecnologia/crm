"use client";

/**
 * A LARGURA DA CONVERSA — estreita ou larga —, escolhida no compositor do Chat
 * (o "layout" do PromptBar pedido em 2026-09-25). Não é domínio: é conforto de
 * quem lê, então mora no armazenamento DESTE navegador e nunca na Sessão. Sem
 * armazenamento (janela privada, bloqueio), a escolha vale enquanto a página
 * vive. No servidor e na hidratação é sempre "estreita" — o HTML dos dois
 * lados bate; logo depois o React lê a escolha guardada.
 */

import { useSyncExternalStore } from "react";

export type LarguraDoChat = "estreita" | "larga";

const CHAVE = "n1:chat:largura";
const ouvintes = new Set<() => void>();
/** A escolha desta página, quando o armazenamento recusa gravar. */
let naMemoria: LarguraDoChat | null = null;

function ler(): LarguraDoChat {
  if (naMemoria) return naMemoria;
  try {
    return window.localStorage.getItem(CHAVE) === "larga" ? "larga" : "estreita";
  } catch {
    return "estreita";
  }
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
}

export function useLarguraDoChat(): readonly [LarguraDoChat, (largura: LarguraDoChat) => void] {
  const largura = useSyncExternalStore(assinar, ler, () => "estreita" as const);
  const escolher = (nova: LarguraDoChat) => {
    naMemoria = nova;
    try {
      window.localStorage.setItem(CHAVE, nova);
    } catch {
      // Sem armazenamento: fica só na memória desta página.
    }
    for (const avisar of ouvintes) avisar();
  };
  return [largura, escolher] as const;
}
