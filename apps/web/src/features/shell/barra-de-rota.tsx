"use client";

import { useEffect, useState } from "react";
import { lerDuracao } from "@/design/movimento";
import { useNavegando } from "./navegacao";

type Estado = "ocioso" | "pendente" | "concluindo";

/**
 * A BARRA DE ROTA: um fio de 2px no topo da coluna da tela, que anda até 80%
 * enquanto a navegação demora e completa quando o endereço muda. Sempre
 * montada, irmã de `<main>` (dentro dele rolaria com o conteúdo).
 *
 * Os 150ms de carência estão no CSS (`transition-delay`): navegação que
 * termina antes nunca a mostra. Em produção o `<Link>` pré-carrega o chunk e
 * a barra é rara; em desenvolvimento aparece mais — comportamento certo.
 *
 * Estados: ocioso → pendente (marcar) → concluindo (limpar) → ocioso ao fim da
 * transição de opacidade. Se a opacidade nem chegou a mudar (navegação mais
 * curta que a carência) o `transitionend` não vem: um timer fecha o ciclo.
 */
export function BarraDeRota() {
  const navegando = useNavegando();
  const [estado, setEstado] = useState<Estado>("ocioso");
  if (navegando && estado !== "pendente") setEstado("pendente");
  if (!navegando && estado === "pendente") setEstado("concluindo");
  useEffect(() => {
    if (estado !== "concluindo") return;
    const timer = setTimeout(() => setEstado("ocioso"), lerDuracao("--dur-2", { medidor: true }) + lerDuracao("--dur-1", { medidor: true }));
    return () => clearTimeout(timer);
  }, [estado]);
  return (
    <div
      className="barra-progresso"
      data-estado={estado}
      aria-hidden="true"
      onTransitionEnd={(event) => {
        if (event.propertyName === "opacity" && estado === "concluindo") setEstado("ocioso");
      }}
    />
  );
}
