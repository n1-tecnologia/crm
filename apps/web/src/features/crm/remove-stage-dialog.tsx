"use client";

/**
 * D02 — Remover Etapa com remapeamento, aberto por `?remapear-etapa=<etapa>`.
 *
 * RN-FUN-10 — remover uma Etapa exige remapear TODO Negócio que a referencia,
 * em qualquer situação e estado, inclusive os que estão na lixeira. O
 * remapeamento não avalia exigências de entrada e preserva a probabilidade
 * ajustada à mão (RN-FUN-08, DO-NEG-05).
 *
 * A contagem por situação e por estado aparece antes do ato porque é ela que
 * mostra o tamanho real do que se está mexendo: um Funil "vazio" pode ter
 * dezenas de Negócios encerrados apontando para a Etapa.
 */

import { useRouter, useSearchParams } from "next/navigation";

export const REMOVE_STAGE_PARAM = "remapear-etapa";

export function useRemoveStageDialog(): {
  readonly removingStageId: string | null;
  readonly openRemoveStage: (stageId: string) => void;
  readonly closeRemoveStage: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    removingStageId: query.get(REMOVE_STAGE_PARAM),
    openRemoveStage: (stageId) => {
      const next = new URLSearchParams(query.toString());
      next.set(REMOVE_STAGE_PARAM, stageId);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeRemoveStage: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(REMOVE_STAGE_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

/** Esqueleto do RED: a assinatura nova existe, o comportamento não. */
export function RemoveStageDialog(_props: {
  readonly funilId: string;
  readonly etapaId: string | null;
  readonly onClose: () => void;
  readonly onDone: (mensagem: string) => void;
}) {
  return null;
}
