"use client";

/**
 * O ROBÔ FORA DO PALCO — o recado entre o Início e a casca.
 *
 * Desde 2026-09-24 o Início ROLA: descendo, o robô do palco some (a entrada
 * dele ao contrário) e a tela vira o resumo da pessoa. Com o robô fora da
 * vista, a casca mostra o ROBÔ FLUTUANTE no canto também no Início — como em
 * qualquer outra tela ("quando o user mudar de tela quero que o robô passe a
 * ser um botão flutuante") —, e tocá-lo ali não navega: volta ao palco.
 *
 * O Início marca quando o robô saiu e voltou (`marcarRoboForaDoPalco`) e
 * registra COMO voltar (`registrarVoltaAoPalco`: rolar ao topo e levar o
 * foco ao título); o robô flutuante lê o primeiro e chama o segundo. Um
 * módulo e não um contexto: são dois pedaços da árvore que não se veem, e o
 * estado é um booleano da sessão da aba.
 */

import { useSyncExternalStore } from "react";

let fora = false;
let voltar: (() => void) | null = null;
const ouvintes = new Set<() => void>();

function inscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** O Início avisa que o robô do palco saiu da vista (`true`) ou voltou (`false`). */
export function marcarRoboForaDoPalco(valor: boolean): void {
  if (fora === valor) return;
  fora = valor;
  for (const ouvinte of ouvintes) ouvinte();
}

/** Se o robô do palco do Início está fora da vista (no servidor, nunca). */
export function useRoboForaDoPalco(): boolean {
  return useSyncExternalStore(
    inscrever,
    () => fora,
    () => false,
  );
}

/** O Início registra como voltar ao palco; devolve como desfazer o registro. */
export function registrarVoltaAoPalco(fn: () => void): () => void {
  voltar = fn;
  return () => {
    if (voltar === fn) voltar = null;
  };
}

/** Volta ao palco do Início, se ele estiver montado; diz se voltou. */
export function voltarAoPalco(): boolean {
  if (!voltar) return false;
  voltar();
  return true;
}
