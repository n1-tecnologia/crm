"use client";

/**
 * D08 — Migrar Negócios de Funil, aberto por `?migrar-negocios=`.
 *
 * Sem mapeamento por nome nem por posição. Dois Funis podem ter Etapas com o
 * mesmo nome e probabilidades opostas; adivinhar aqui erra em silêncio, e o
 * erro só aparece semanas depois num relatório torto.
 *
 * O escopo distingue as duas obrigações: arquivar o Funil exige migrar os
 * `aberto`; enviar à lixeira exige migrar TODOS, inclusive os que já estão na
 * lixeira.
 */

import { useRouter, useSearchParams } from "next/navigation";

export const MIGRATE_DEALS_PARAM = "migrar-negocios";

export function useMigrateFunnelDialog(): {
  readonly migrating: boolean;
  readonly openMigrate: () => void;
  readonly closeMigrate: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    migrating: query.has(MIGRATE_DEALS_PARAM),
    openMigrate: () => {
      const next = new URLSearchParams(query.toString());
      next.set(MIGRATE_DEALS_PARAM, "");
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeMigrate: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(MIGRATE_DEALS_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

/** Esqueleto do RED: a assinatura nova existe, o comportamento não. */
export function MigrateFunnelDialog(_props: {
  readonly funilId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (mensagem: string) => void;
}) {
  return null;
}
