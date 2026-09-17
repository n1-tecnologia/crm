"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/design/cn";
import { lerDuracao } from "@/design/movimento";
import { limpar } from "./navegacao";

/**
 * A CHEGADA DE TELA.
 *
 * A casca nunca sai do lugar: a tela chega porque as suas peças chegam —
 * cabeçalho, barra, painéis, e as peças em cascata (`estilos/componentes.css`,
 * "Chegada de tela"). Tudo acontece dentro de uma JANELA aberta na montagem
 * e fechada em `--dur-cascata`; fora dela nenhuma peça inserida anima
 * (filtro, "Mostrar mais", tecla). A casca remonta este invólucro por rota
 * (`chaveDeChegada`), e uma mudança só de `?search` não o remonta.
 *
 * O invólucro SÓ esmaece (`.chegada`): é ancestral de todo SidePanel e
 * ConfirmDialog, que são `fixed` sem portal. Nada de transform aqui.
 */

/** Verdadeiro durante a janela de chegada, contada a partir da montagem. Em movimento reduzido fecha no tique seguinte. */
export function useEntrando(): boolean {
  const [entrando, setEntrando] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setEntrando(false), lerDuracao("--dur-cascata"));
    return () => clearTimeout(timer);
  }, []);
  return entrando;
}

export function Chegada({ children }: { readonly children: ReactNode }) {
  const entrando = useEntrando();
  // A tela montou: a navegação chegou. É o que limpa a pendência também fora
  // da casca (login, Entrar), onde não há AppShell para fazê-lo.
  useEffect(() => {
    limpar();
  }, []);
  return (
    <div className="chegada" data-entrando={entrando ? "true" : undefined}>
      {children}
    </div>
  );
}

/**
 * Um `<nav>` fora do invólucro de rota (o painel do assunto) que traz a
 * própria janela: esmaece em 150ms e os filhos diretos caem em cascata. Quem
 * chama põe `key` para remontar na troca de assunto.
 */
export function CascataDeNavegacao({ className, children, ...resto }: React.ComponentProps<"nav">) {
  const entrando = useEntrando();
  return (
    <nav {...resto} className={cn("cascata aparecer", className)} data-entrando={entrando ? "true" : undefined}>
      {children}
    </nav>
  );
}
