"use client";

import { useSyncExternalStore } from "react";

/**
 * `true` só depois de o React assumir a página no navegador. No servidor e na
 * primeira renderização do cliente devolve `false`, sempre — é esse "sempre"
 * que faz o HTML dos dois lados bater. Vive num arquivo próprio para a casca e
 * a barra global o lerem sem se importarem uma à outra.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
