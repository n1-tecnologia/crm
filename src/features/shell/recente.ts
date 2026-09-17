"use client";

import { useEffect, useState } from "react";
import { useLastResult } from "@/data/store";
import type { Id } from "@/data/types";
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
