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
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { removeStage } from "@n1/dominio/operations";
import { CabecalhoDePainel, ConfirmDialog, Field, Painel, Select } from "@/features/shell/ui";

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

export function RemoveStageDialog({
  funnelId,
  stageId,
  onClose,
  onDone,
}: {
  readonly funnelId: string;
  readonly stageId: string | null;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [targetStageId, setTargetStageId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const funnel = state.funnels.find((f) => f.id === funnelId);
  const stage = funnel?.stages.find((s) => s.id === stageId);
  if (!funnel || !stage) return null;

  // RN-NEG-17 — every Deal counts, including the ones in the trash.
  const affected = state.deals.filter((deal) => deal.funnelId === funnelId && deal.stageId === stage.id);
  const bySituation = {
    aberto: affected.filter((deal) => deal.situation === "aberto").length,
    ganho: affected.filter((deal) => deal.situation === "ganho").length,
    perdido: affected.filter((deal) => deal.situation === "perdido").length,
  };
  const inTrash = affected.filter((deal) => deal.lifecycle === "naLixeira").length;
  const archived = affected.filter((deal) => deal.lifecycle === "arquivado").length;
  const overridden = affected.filter((deal) => deal.overriddenProbability !== undefined).length;

  const others = funnel.stages
    .filter((option) => option.id !== stage.id)
    .sort((a, b) => a.order - b.order);

  const lastStage = funnel.stages.length <= 1;
  const blockedReason = lastStage
    ? "Um Funil precisa de ao menos uma Etapa."
    : targetStageId === ""
      ? "Escolha a Etapa de destino dos Negócios."
      : undefined;

  const confirm = () => {
    const result = run((data, memberId) =>
      removeStage(data, memberId, funnelId, stage.id, targetStageId),
    );
    if (result.ok) {
      const target = others.find((option) => option.id === targetStageId);
      onDone(
        affected.length === 0
          ? `Etapa ${stage.name} removida.`
          : `Etapa ${stage.name} removida. ${affected.length} Negócio(s) passaram para ${target?.name}.`,
      );
      setTargetStageId("");
      setError(null);
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open={stageId !== null}
      title={`Remover a Etapa “${stage.name}”`}
      description={
        affected.length === 0
          ? "Nenhum Negócio ocupa esta Etapa; a remoção não move nada."
          : `${affected.length} Negócio(s) referenciam esta Etapa e precisam de um destino.`
      }
      confirmLabel="Remover Etapa"
      destructive
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        setTargetStageId("");
        setError(null);
        onClose();
      }}
    >
      <div className="grid gap-3">
        {affected.length > 0 ? (
          <Painel>
            <CabecalhoDePainel titulo="O que referencia esta Etapa" />
            <ul className="app-base space-y-0.5 px-4 py-3" style={{ color: "var(--texto-3)" }}>
              <li>{bySituation.aberto} aberto(s)</li>
              <li>
                {bySituation.ganho} ganho(s) e {bySituation.perdido} perdido(s) — encerrados preservam a
                Etapa que ocupavam
              </li>
              {archived > 0 ? <li>{archived} arquivado(s)</li> : null}
              {inTrash > 0 ? <li>{inTrash} na lixeira — também precisam de destino</li> : null}
            </ul>
          </Painel>
        ) : null}

        <Field label="Etapa de destino" hint="Sem mapeamento por nome nem por posição: a escolha é explícita.">
          {(id) => (
            <Select
              id={id}
              value={targetStageId}
              onChange={setTargetStageId}
              placeholder="Escolher Etapa"
              disabled={lastStage}
              disabledReason="Um Funil precisa de ao menos uma Etapa."
              options={others.map((option) => ({
                value: option.id,
                label: option.name,
                detail: `${option.defaultProbability}%`,
                ...(option.color ? { color: option.color } : {}),
              }))}
            />
          )}
        </Field>

        {affected.length > 0 ? (
          <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            O remapeamento não avalia exigências de entrada da Etapa de destino.
            {overridden > 0
              ? ` ${overridden} Negócio(s) têm probabilidade ajustada à mão e a preservam.`
              : ""}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
