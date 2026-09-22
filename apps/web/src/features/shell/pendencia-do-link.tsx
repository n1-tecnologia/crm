"use client";

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

/**
 * O rótulo de um `<Link>` que sabe que foi clicado: enquanto o Next busca o
 * chunk, a cor vai ao acento. Filho do Link (o `useLinkStatus` lê o contexto
 * dele). Movimento nunca é o único sinal: `data-pendente` fica no DOM.
 */
export function PendenciaDoLink({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={className}
      data-pendente={pending ? "true" : undefined}
      style={{ transition: "color var(--dur-1) var(--easing)", color: pending ? "var(--acento)" : undefined }}
    >
      {children}
    </span>
  );
}
