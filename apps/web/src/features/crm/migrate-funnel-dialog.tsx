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
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { migrateDealsToFunnel, type StageMapping } from "@n1/dominio/operations";
import { CabecalhoDePainel, ConfirmDialog, Field, Painel, Select } from "@/features/shell/ui";

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

export function MigrateFunnelDialog({
  funnelId,
  open,
  onClose,
  onDone,
}: {
  readonly funnelId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [toFunnelId, setToFunnelId] = useState("");
  const [scope, setScope] = useState<"abertos" | "todos">("todos");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const from = state.funnels.find((f) => f.id === funnelId);
  const to = toFunnelId ? state.funnels.find((f) => f.id === toFunnelId) : undefined;
  if (!from) return null;

  const scoped = state.deals.filter(
    (deal) => deal.funnelId === from.id && (scope === "todos" || deal.situation === "aberto"),
  );
  const stagesInUse = [...new Set(scoped.map((deal) => deal.stageId))];
  const unmapped = stagesInUse.filter((stageId) => !mapping[stageId]);

  const counts = {
    aberto: scoped.filter((deal) => deal.situation === "aberto").length,
    ganho: scoped.filter((deal) => deal.situation === "ganho").length,
    perdido: scoped.filter((deal) => deal.situation === "perdido").length,
    naLixeira: scoped.filter((deal) => deal.lifecycle === "naLixeira").length,
    arquivado: scoped.filter((deal) => deal.lifecycle === "arquivado").length,
  };

  const blockedReason =
    toFunnelId === ""
      ? "Escolha o Funil de destino."
      : unmapped.length > 0
        ? `${unmapped.length} Etapa(s) de origem ainda sem destino.`
        : undefined;

  const reset = () => {
    setToFunnelId("");
    setMapping({});
    setError(null);
  };

  const confirm = () => {
    const entries: StageMapping[] = Object.entries(mapping)
      .filter(([, value]) => value !== "")
      .map(([fromStatusId, toStatusId]) => ({ fromStatusId, toStatusId }));
    const result = run((data, memberId) =>
      migrateDealsToFunnel(data, memberId, from.id, toFunnelId, entries, scope),
    );
    if (result.ok) {
      onDone(`${result.value} Negócio(s) migrados de ${from.name} para ${to?.name}.`);
      reset();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={`Migrar Negócios de “${from.name}”`}
      description="Cada Etapa de origem escolhe uma Etapa de destino explicitamente. Nomes iguais em Funis diferentes podem significar coisas diferentes."
      confirmLabel="Migrar"
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field
          label="Escopo"
          hint="Arquivar o Funil exige migrar os abertos; enviar à lixeira exige migrar todos."
        >
          {(id) => (
            <Select
              id={id}
              value={scope}
              onChange={(value) => {
                setScope(value as "abertos" | "todos");
                setMapping({});
              }}
              options={[
                { value: "todos", label: "Todos os Negócios", detail: "inclusive na lixeira" },
                { value: "abertos", label: "Só os abertos", detail: "encerrados ficam" },
              ]}
            />
          )}
        </Field>

        <Painel>
          <CabecalhoDePainel titulo={`${scoped.length} Negócio(s) no escopo`} />
          <ul className="app-base app-numero space-y-0.5 px-4 py-3" style={{ color: "var(--texto-3)" }}>
            <li>
              {counts.aberto} aberto(s) · {counts.ganho} ganho(s) · {counts.perdido} perdido(s)
            </li>
            {counts.arquivado > 0 ? <li>{counts.arquivado} arquivado(s)</li> : null}
            {counts.naLixeira > 0 ? <li>{counts.naLixeira} na lixeira</li> : null}
          </ul>
        </Painel>

        <Field label="Funil de destino" hint="Só Funis ativos recebem Negócios.">
          {(id) => (
            <Select
              id={id}
              value={toFunnelId}
              onChange={(value) => {
                setToFunnelId(value);
                setMapping({});
              }}
              searchable
              placeholder="Escolher Funil"
              options={state.funnels
                .filter((funnel) => funnel.id !== from.id && funnel.lifecycle === "ativo")
                .map((funnel) => ({
                  value: funnel.id,
                  label: funnel.name,
                  detail: `${funnel.stages.length} Etapa(s)`,
                }))}
            />
          )}
        </Field>

        {to && stagesInUse.length > 0 ? (
          <div className="grid gap-2">
            {stagesInUse.map((stageId) => {
              const origin = from.stages.find((s) => s.id === stageId);
              const count = scoped.filter((deal) => deal.stageId === stageId).length;
              return (
                <Field key={stageId} label={`${origin?.name ?? stageId} · ${count} Negócio(s) → destino`}>
                  {(id) => (
                    <Select
                      id={id}
                      value={mapping[stageId] ?? ""}
                      onChange={(value) => setMapping((current) => ({ ...current, [stageId]: value }))}
                      placeholder="Escolher Etapa"
                      options={[...to.stages]
                        .sort((a, b) => a.order - b.order)
                        .map((stage) => ({
                          value: stage.id,
                          label: stage.name,
                          detail: `${stage.defaultProbability}%`,
                          ...(stage.color ? { color: stage.color } : {}),
                        }))}
                    />
                  )}
                </Field>
              );
            })}
          </div>
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
