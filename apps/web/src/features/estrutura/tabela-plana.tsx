"use client";

import { useRun, useSession } from "@/dados/store";
import {
  effectiveLifecycleOfTask,
  effectiveListConfig,
  statusCategory,
  statusDefinition,
} from "@n1/dominio/derive";
import { changeTaskStatus, statusOptionRefusal } from "@n1/dominio/operations";
import { PRIORITY_LABEL, STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { useRecente } from "@/features/shell/recente";
import { CategoryDot, StatusPicker } from "@/features/shell/ui";
import { TaskAttributeEditors } from "@/features/estrutura/task-editors";
import { nomeDoAgente } from "@/features/estrutura/nome-do-ator";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";

/**
 * PARD-01 — a Tabela edita em linha o que a Tarefa tem de mais mexido: Status
 * (com a mesma recusa por opção do painel), prioridade e vencimento, pelos
 * mesmos editores da ficha. Fora disso, o título abre a Tarefa.
 */
export function TabelaPlana({
  state,
  tasks,
  editavel,
  report,
  openTask,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly editavel: boolean;
  readonly report: (result: { ok: boolean; error?: string }, message: string) => void;
  readonly openTask: (taskId: string) => void;
}) {
  const fmt = useFormat();
  const run = useRun();
  const { memberId } = useSession();
  const recente = useRecente();
  const somenteLeitura = editavel ? undefined : "Esta Lista não está ativa: a Tabela é só leitura.";
  return (
    <div>
      <table className="tabela">
        <thead>
          <tr>
            {[
              "Título",
              "Status",
              "Categoria",
              "Prioridade",
              "Vencimento",
              "Responsáveis",
            ].map((label) => (
              <th key={label} className="app-coluna">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="cascata">
          {tasks.map((task) => {
            const definition = statusDefinition(
              state,
              task.listId,
              task.statusId,
            );
            const category = statusCategory(state, task);
            const config = effectiveListConfig(state, task.listId);
            const motivo = somenteLeitura ?? (effectiveLifecycleOfTask(state, task.id) !== "ativo" ? "Esta Tarefa não está ativa." : undefined);
            return (
              <tr key={task.id} data-recente={task.id === recente ? "true" : undefined}>
                <td>
                  <button
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="app-md text-left hover:underline"
                    style={{ color: "var(--texto)" }}
                  >
                    {task.title}
                  </button>
                </td>
                <td>
                  {config && definition ? (
                    <StatusPicker
                      options={config.statusSet.definitions}
                      value={task.statusId}
                      onChange={(statusId) =>
                        report(
                          run((data, me) => changeTaskStatus(data, me, task.id, statusId)),
                          `“${task.title}” foi para ${config.statusSet.definitions.find((d) => d.id === statusId)?.name ?? "outro Status"}.`,
                        )
                      }
                      readOnly={motivo !== undefined}
                      {...(motivo ? { readOnlyReason: motivo } : {})}
                      optionBlockReason={(optionId) => statusOptionRefusal(state, memberId, task, optionId)}
                    />
                  ) : definition ? (
                    <CategoryDot color={definition.color} label={definition.name} />
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ color: "var(--texto-3)" }}>
                  {category ? STATUS_CATEGORY_LABEL[category] : "—"}
                </td>
                <td style={{ color: "var(--texto-3)" }}>
                  {motivo ? (
                    <span title={motivo}>{PRIORITY_LABEL[task.priority]}</span>
                  ) : (
                    <span className="block w-40">
                      <TaskAttributeEditors task={task} report={report} features={{ prioridade: true, estimativa: false }} apenas="prioridade" />
                    </span>
                  )}
                </td>
                <td style={{ color: "var(--texto-3)" }}>
                  {motivo ? (
                    <span title={motivo}>{task.dueDate ? fmt.taskDate(task.dueDate) : "—"}</span>
                  ) : (
                    <span className="block w-44">
                      <TaskAttributeEditors task={task} report={report} features={{ prioridade: true, estimativa: false }} apenas="vencimento" />
                    </span>
                  )}
                </td>
                <td style={{ color: "var(--texto-3)" }}>
                  {task.assignees.length === 0
                    ? "—"
                    : task.assignees
                        .map((assignee) =>
                          assignee.kind === "member"
                            ? state.members.find((m) => m.id === assignee.id)
                                ?.displayName
                            : nomeDoAgente(state, assignee.id),
                        )
                        .filter(Boolean)
                        .join(", ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
