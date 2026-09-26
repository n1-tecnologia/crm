"use client";

import { useEffect, useState } from "react";
import { useLastResult } from "@/dados/store";
import type { Id } from "@n1/dominio/types";
import { lerDuracao } from "@/design/movimento";

/**
 * O QUE ACABOU DE MUDAR.
 *
 * Devolve o id do registro do último resultado (`OperationResult.id`) durante
 * `--dur-realce`, e `null` depois. A tela passa `data-recente` à peça com esse
 * id e o CSS acende `--acento-lavado` esmaecendo ao fundo (`destacar`).
 * Um resultado anterior à montagem da tela não conta: a peça "já está", não
 * chegou. Sem id no resultado não há gatilho — e nada quebra.
 */
export function useRecente(): Id | null {
  const ultimo = useLastResult();
  const [montadoEm] = useState(() => Date.now());
  const [expiradoEm, setExpiradoEm] = useState<number | null>(null);
  useEffect(() => {
    if (!ultimo?.ok || ultimo.id === undefined || ultimo.at < montadoEm) return;
    const timer = setTimeout(() => setExpiradoEm(ultimo.at), lerDuracao("--dur-realce", { medidor: true }));
    return () => clearTimeout(timer);
  }, [ultimo, montadoEm]);
  if (!ultimo?.ok || ultimo.id === undefined || ultimo.at < montadoEm || expiradoEm === ultimo.at) return null;
  return ultimo.id;
}

// ── A mensagem que viaja com a navegação ───────────────────────────────────

interface Chegada {
  /** O pathname de destino, sem a barra final. */
  readonly caminho: string;
  readonly mensagem: string;
  readonly at: number;
}

let chegada: Chegada | null = null;

/** Sem a barra final: o Next não distingue `/ia/habilidades/x` de `/ia/habilidades/x/`. */
const semBarraFinal = (caminho: string): string => (caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho);

const caminhoDe = (href: string): string => semBarraFinal(href.split(/[?#]/, 1)[0] ?? href);

/**
 * "CRIAR E ABRIR": o Toast de sucesso pertence à ficha de chegada, não à tela
 * que a navegação desmonta — um `report` dado ali morre com ela. Quem cria e
 * navega marca a chegada com o endereço e a mensagem, e o `useAvisos` da tela
 * que abre nesse endereço a lê uma vez e a acende como se tivesse sido
 * reportada nela. Uma marca que ninguém lê em `--dur-navegacao-max` é dada
 * por morta (a navegação não chegou), como em `navegacao.ts`.
 */
export function marcarChegada(href: string, mensagem: string): void {
  chegada = { caminho: caminhoDe(href), mensagem, at: Date.now() };
}

/** A mensagem marcada para `pathname`, se houver e ainda valer — sem consumi-la (leitura pura, serve ao render). */
export function lerChegada(pathname: string): string | null {
  if (!chegada || chegada.caminho !== semBarraFinal(pathname)) return null;
  if (Date.now() - chegada.at > lerDuracao("--dur-navegacao-max", { medidor: true })) return null;
  return chegada.mensagem;
}

/** A tela chegou e leu: a marca some (efeito, nunca render). Uma marca de outro endereço fica. */
export function consumirChegada(pathname: string): void {
  if (chegada && chegada.caminho === semBarraFinal(pathname)) chegada = null;
}
