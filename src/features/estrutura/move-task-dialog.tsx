"use client";

/**
 * D01 — Mover Tarefa com Mapeamento de status, aberto por `?mapear-status=<tarefa>`.
 *
 * O mapeamento vive AQUI, no momento do movimento, e não numa tela de
 * configuração: um mapeamento pré-definido envelhece em silêncio quando o
 * Conjunto de Status muda, e mapear por nome é pior ainda — "Concluído" numa
 * Lista pode ser categoria `concluido` e noutra `fechado`, e é a categoria que
 * decide se a Tarefa está encerrada.
 *
 * O mapeamento é por STATUS DE ORIGEM, não por Tarefa: mover uma árvore inteira
 * exige uma decisão por Status em uso, não uma por registro.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { effectiveListConfig, listPath, memberReachesContainer } from "@/data/derive";
import { moveTask, type StatusMapping } from "@/data/operations";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";
import type { DataState } from "@/data/state";
import type { Task } from "@/data/types";

export const MOVE_TASK_PARAM = "mapear-status";

export function useMoveTaskDialog(): {
  readonly movingTaskId: string | null;
  readonly openMove: (taskId: string) => void;
  readonly closeMove: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    movingTaskId: query.get(MOVE_TASK_PARAM),
    openMove: (taskId) => {
      const next = new URLSearchParams(query.toString());
      next.set(MOVE_TASK_PARAM, taskId);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeMove: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(MOVE_TASK_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

export function MoveTaskDialog({
  taskId,
  onClose,
  onDone,
}: {
  readonly taskId: string | null;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [targetListId, setTargetListId] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const task = taskId === null ? undefined : state.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const from = effectiveListConfig(state, task.listId);
  const to = targetListId ? effectiveListConfig(state, targetListId) : null;

  // Só Listas que este Membro alcança: mover para onde não se vê é perder a Tarefa.
  const lists = state.lists
    .filter((list) => list.id !== task.listId && list.lifecycle === "ativo" && memberReachesContainer(state, memberId, "list", list.id))
    .map((list) => ({
      value: list.id,
      label: list.name,
      detail: listPath(state, list.id)
        .slice(0, -1)
        .map((node) => node.name)
        .join(" › "),
    }));

  // The whole subtree moves together, so every Status in use needs a destination.
  const tree = [task, ...descendantsOf(state, task.id)];
  const statusesInUse = [...new Set(tree.map((t) => t.statusId))];
  const needsMapping = from !== null && to !== null && from.statusSet.id !== to.statusSet.id;
  const unmapped = needsMapping
    ? statusesInUse.filter((statusId) => mapping[statusId] === undefined || mapping[statusId] === "")
    : [];

  // B37 — a value whose Definition stops reaching the Task is archived inside
  // the record, never discarded. Saying so is the difference between "o dado
  // sumiu" and "o dado está guardado".
  const leavingFields =
    from && to
      ? from.fieldDefinitionIds.filter((id) => !to.fieldDefinitionIds.includes(id))
      : [];
  const affectedValues = leavingFields.reduce(
    (total, definitionId) =>
      total +
      tree.filter((t) => t.fieldValues.some((v) => v.definitionId === definitionId && v.state === "ativo"))
        .length,
    0,
  );

  const blockedReason =
    targetListId === ""
      ? "Escolha a Lista de destino."
      : unmapped.length > 0
        ? `${unmapped.length} Status de origem ainda sem destino.`
        : undefined;

  const confirm = () => {
    const entries: StatusMapping[] = Object.entries(mapping)
      .filter(([, toStatusId]) => toStatusId !== "")
      .map(([fromStatusId, toStatusId]) => ({ fromStatusId, toStatusId }));
    const result = run((data, memberId) => moveTask(data, memberId, task.id, targetListId, entries));
    if (result.ok) {
      setError(null);
      setTargetListId("");
      setMapping({});
      onDone(`Tarefa movida para ${state.lists.find((l) => l.id === targetListId)?.name}.`);
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open={taskId !== null}
      title={`Mover “${task.title}”`}
      description={
        tree.length > 1
          ? `A Tarefa e as suas ${tree.length - 1} Subtarefa(s) mudam de Lista juntas.`
          : "A Tarefa muda de Lista."
      }
      confirmLabel="Mover"
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        setError(null);
        setTargetListId("");
        setMapping({});
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field label="Lista de destino">
          {(id) => (
            <Select
              id={id}
              value={targetListId}
              onChange={(value) => {
                setTargetListId(value);
                setMapping({});
              }}
              options={lists}
              searchable
              placeholder="Escolher Lista"
            />
          )}
        </Field>

        {needsMapping && to ? (
          <div>
            <p className="app-sm mb-1.5" style={{ color: "var(--texto-3)" }}>
              Os Conjuntos de Status diferem. Cada Status em uso precisa de um destino — é a{" "}
              <strong>categoria</strong>, não o nome, que decide se a Tarefa está encerrada.
            </p>
            <div className="grid gap-2">
              {statusesInUse.map((statusId) => {
                const origin = from?.statusSet.definitions.find((d) => d.id === statusId);
                const count = tree.filter((t) => t.statusId === statusId).length;
                const chosen = to.statusSet.definitions.find((d) => d.id === mapping[statusId]);
                // B40 — a categoria nunca muda sem ato explícito, então a mudança
                // é nomeada antes de confirmar, com o efeito que ela dispara.
                const categoryChanges = chosen !== undefined && chosen.category !== origin?.category;
                return (
                  <Field
                    key={statusId}
                    label={`${origin?.name ?? statusId} · ${count} Tarefa(s) → destino`}
                    {...(categoryChanges
                      ? {
                          hint: `${count} Tarefa(s) passam de ${origin?.category} para ${chosen.category}${
                            chosen.category === "concluido" ? " e geram o evento de conclusão" : ""
                          }.`,
                        }
                      : origin
                        ? { hint: `categoria de origem: ${origin.category}` }
                        : {})}
                  >
                    {(id) => (
                      <Select
                        id={id}
                        value={mapping[statusId] ?? ""}
                        onChange={(value) => setMapping((current) => ({ ...current, [statusId]: value }))}
                        options={[...to.statusSet.definitions]
                          .sort((a, b) => a.order - b.order)
                          .map((definition) => ({
                            value: definition.id,
                            label: definition.name,
                            detail: definition.category,
                            color: definition.color,
                          }))}
                        placeholder="Escolher Status"
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </div>
        ) : null}

        {affectedValues > 0 ? (
          <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            {affectedValues} Valor(es) de Campo serão arquivados dentro dos registros: as Definições não
            alcançam o destino. Nada é descartado — voltam a valer se a Tarefa retornar.
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

function descendantsOf(state: DataState, taskId: string): Task[] {
  const direct = state.tasks.filter((task) => task.parentTaskId === taskId);
  return direct.flatMap((child) => [child, ...descendantsOf(state, child.id)]);
}
