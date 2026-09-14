"use client";

/**
 * T12 as a side panel, opened from a List or a Quadro by `?tarefa=<id>`.
 *
 * The Fase 2 map asks for both forms: the full page is the addressable record
 * that links point at, and this is the quick look that does not cost leaving
 * the collection. What must NOT differ between them is the reasoning — the
 * status block reason comes from `terminalStatusBlockReason`, the same
 * derivation the page reads, so the two can never answer differently about the
 * same Task.
 *
 * The panel deliberately does not repeat the whole record: it carries what
 * decides the next action, and hands over to the page for the rest.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import {
  checklistProgress,
  effectiveLifecycleOfTask,
  effectiveListConfig,
  isBlocked,
  isOverdue,
  memberSeesTask,
  spawnedOccurrenceOf,
  statusDefinition,
  subtaskProgress,
  taskWriteRefusal,
  terminalStatusBlockReason,
  newestFirst,
} from "@/data/derive";
import { changeTaskStatus, statusOptionRefusal } from "@/data/operations";
import { PRIORITY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
  CategoryDot,
  ConditionMarker,
  EmptyState,
  RecordRow,
  ReguaDeSecao,
  SidePanel,
  StateSeal,
  StatusPicker,
  Toast,
} from "@/features/shell/ui";

/** The query key that opens the panel; exported so callers cannot misspell it. */
export const TASK_PANEL_PARAM = "tarefa";

export function useTaskPanel(): {
  readonly openTaskId: string | null;
  readonly openTask: (taskId: string) => void;
  readonly closeTask: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  // Do roteador, não de `window.location`: na primeira renderização após uma
  // navegação no cliente a URL ainda é a da página anterior.
  const pathname = usePathname();

  const openTask = (taskId: string) => {
    const next = new URLSearchParams(query.toString());
    next.set(TASK_PANEL_PARAM, taskId);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const closeTask = () => {
    const next = new URLSearchParams(query.toString());
    next.delete(TASK_PANEL_PARAM);
    router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return { openTaskId: query.get(TASK_PANEL_PARAM), openTask, closeTask };
}

export function TaskPanel({
  taskId,
  onClose,
  onMove,
}: {
  readonly taskId: string | null;
  readonly onClose: () => void;
  /** Opens D01 — moving needs the Status Mapping dialog, never a bare action. */
  readonly onMove?: (taskId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const task = taskId === null ? undefined : state.tasks.find((t) => t.id === taskId && memberSeesTask(state, memberId, t.id));
  const escritaRecusada = task ? taskWriteRefusal(state, memberId, task.id) : undefined;
  const config = task ? effectiveListConfig(state, task.listId) : null;

  if (!task || !config) {
    return (
      <SidePanel title="Tarefa" open={taskId !== null} onClose={onClose}>
        <EmptyState
          compact
          title="Tarefa não encontrada."
          hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la."
        />
      </SidePanel>
    );
  }

  const effective = effectiveLifecycleOfTask(state, task.id);
  const definition = statusDefinition(state, task.listId, task.statusId);
  const blockReason = terminalStatusBlockReason(state, task);
  const checklist = checklistProgress(task);
  const subtasks = subtaskProgress(state, task.id);
  // O popup é largo: mostra também o que a página mostra, em leitura.
  const comentarios = [...task.comments].filter((c) => !c.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const atividade = newestFirst(state.activity.filter((r) => r.objectId === task.id));
  const nomeDe = (id: string) =>
    state.members.find((m) => m.id === id)?.displayName ??
    state.agents.find((a) => a.id === id)?.name ??
    state.automations.find((a) => a.id === id)?.name ??
    id;

  const changeStatus = (statusId: string) => {
    const tinhaRecorrencia = task.recurrence !== undefined;
    const result = run((data, memberId) => changeTaskStatus(data, memberId, task.id, statusId));
    const proxima = result.ok && tinhaRecorrencia && result.value.recurrence === undefined ? spawnedOccurrenceOf(state, task.id) : undefined;
    setMessage(
      result.ok
        ? { tone: "success", text: proxima ? `Status alterado. Próxima ocorrência criada: ${proxima.title}.` : "Status alterado." }
        : { tone: "error", text: result.error },
    );
  };

  return (
    <SidePanel
      title={task.title}
      open={taskId !== null}
      onClose={onClose}
      footer={
        <div className="flex flex-1 items-center justify-between gap-2">
          <span className="app-meta">Marcar itens, comentar e editar campos fica na página.</span>
          <Link href={`/estrutura/tarefas/${task.id}`} className="btn btn-solido btn-sm shrink-0">
            Abrir em página cheia
          </Link>
        </div>
      }
    >
      {/* Popup largo, em duas colunas: à esquerda o que se FAZ e o que se LÊ
          (Status, descrição, checklists, comentários); à direita o que ela É
          (atributos) e o que aconteceu (atividade). Editar checklists e
          comentar continua na página — aqui é leitura. */}
      <div className="flex flex-wrap items-center gap-2">
        {task.readableId ? <span className="identificador">{task.readableId}</span> : null}
        <StateSeal state={effective} />
        {isOverdue(state, task, new Date()) ? (
          <ConditionMarker tone="danger">Vencida</ConditionMarker>
        ) : null}
        {isBlocked(state, task) ? <ConditionMarker tone="warning">Bloqueada</ConditionMarker> : null}
      </div>

      {message ? (
        <div className="mt-4">
          <Toast tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Toast>
        </div>
      ) : null}

      <div className="mt-6 grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-6">
          <section>
            <ReguaDeSecao rotulo="Status" className="pt-0" />
            <StatusPicker
              options={[...config.statusSet.definitions]
                .sort((a, b) => a.order - b.order)
                .map((option) => ({
                  id: option.id,
                  name: option.name,
                  category: option.category,
                  color: option.color,
                }))}
              value={task.statusId}
              onChange={changeStatus}
              {...(blockReason ? { terminalBlockReason: blockReason } : {})}
              optionBlockReason={(optionId) => statusOptionRefusal(state, memberId, task, optionId)}
              readOnly={effective !== "ativo" || escritaRecusada !== undefined}
              readOnlyReason={effective !== "ativo" ? `Esta Tarefa está ${effective === "arquivado" ? "arquivada" : "na lixeira"} e é somente leitura.` : (escritaRecusada ?? "")}
            />
            {blockReason ? (
              <p className="app-base mt-2" style={{ color: "var(--texto-3)" }}>
                Concluir está indisponível: {blockReason}{" "}
                <Link href={`/estrutura/listas/${task.listId}/configuracoes`} className="underline">
                  Ver a exigência
                </Link>
                .
              </p>
            ) : null}
          </section>

          {effective !== "ativo" ? (
            <p
              className="app-base rounded-[var(--r-controle)] px-3 py-2"
              style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}
            >
              {effective === "arquivado" ? "Arquivada" : "Na lixeira"} — o estado pode vir da própria
              Tarefa ou da Lista que a contém.
            </p>
          ) : null}

          {task.description ? (
            <section>
              <ReguaDeSecao rotulo="Descrição" className="pt-0" />
              <p className="app-base whitespace-pre-wrap" style={{ color: "var(--texto-1)" }}>
                {task.description}
              </p>
            </section>
          ) : null}

          <section>
            <ReguaDeSecao rotulo="Checklists" contagem={task.checklists.length} className="pt-0" />
            {task.checklists.length === 0 ? (
              <EmptyState compact title="Nenhum Checklist." />
            ) : (
              <div className="grid gap-3">
                {task.checklists.map((group) => {
                  const itens = group.items.filter((item) => item.parentItemId === undefined && item.converted === undefined);
                  const feitos = itens.filter((item) => item.done).length;
                  return (
                    <div key={group.id} className="painel p-3">
                      <p className="flex items-center justify-between gap-2">
                        <span className="app-md" style={{ color: "var(--texto)" }}>
                          {group.name}
                        </span>
                        <span className="app-meta app-numero">
                          {feitos} de {itens.length}
                        </span>
                      </p>
                      <ul className="mt-2 grid gap-1">
                        {itens.map((item) => (
                          <li key={item.id} className="app-base flex items-center gap-2" style={{ color: item.done ? "var(--texto-4)" : "var(--texto-1)" }}>
                            <span aria-hidden="true" className="caixa" data-state={item.done ? "checked" : undefined} />
                            <span style={{ textDecoration: item.done ? "line-through" : undefined }}>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <ReguaDeSecao rotulo="Comentários" contagem={comentarios.length} className="pt-0" />
            {comentarios.length === 0 ? (
              <EmptyState compact title="Nenhum Comentário ainda." />
            ) : (
              <ol className="pilha-solta">
                {comentarios.map((c) => (
                  <li key={c.id} className="item-solto" data-bloco="true" data-estatico="true">
                    <span className="app-base block whitespace-pre-wrap" style={{ color: "var(--texto)" }}>
                      {c.content}
                    </span>
                    <span className="app-meta mt-1 block">
                      {nomeDe(c.author.id)} · {fmt.relative(c.createdAt)}
                      {c.resolved ? " · resolvido" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            {onMove ? (
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  onMove(task.id);
                }}
                disabled={effective !== "ativo" || task.parentTaskId !== undefined}
                disabledReason={
                  task.parentTaskId !== undefined
                    ? "Uma Subtarefa só muda de Lista depois de promovida a Tarefa raiz."
                    : "Uma Tarefa arquivada ou na lixeira é somente leitura."
                }
              >
                Mover para outra Lista
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>

        <div className="grid content-start gap-6">
          <section>
            <ReguaDeSecao rotulo="Atributos" className="pt-0" />
            <dl>
              <RecordRow label="Status">
                {definition ? <CategoryDot color={definition.color} label={definition.name} /> : "—"}
              </RecordRow>
              <RecordRow label="Prioridade">{PRIORITY_LABEL[task.priority] ?? task.priority}</RecordRow>
              <RecordRow label="Responsáveis">
                {task.assignees.length === 0
                  ? "sem Responsável"
                  : task.assignees
                      .map((assignee) =>
                        assignee.kind === "member"
                          ? (state.members.find((m) => m.id === assignee.id)?.displayName ?? "Membro")
                          : (state.agents.find((a) => a.id === assignee.id)?.name ?? "Agente"),
                      )
                      .join(", ")}
              </RecordRow>
              <RecordRow label="Vencimento">{task.dueDate ? fmt.taskDate(task.dueDate) : "—"}</RecordRow>
              <RecordRow label="Checklists">{checklist ? `${checklist.done} de ${checklist.total}` : "—"}</RecordRow>
              <RecordRow label="Subtarefas">{subtasks ? `${subtasks.done} de ${subtasks.total}` : "—"}</RecordRow>
            </dl>
          </section>

          <section>
            <ReguaDeSecao rotulo="Atividade" contagem={atividade.length} className="pt-0" />
            {atividade.length === 0 ? (
              <EmptyState compact title="Nenhum Registro de Atividade." />
            ) : (
              <ol className="pilha-solta">
                {atividade.slice(0, 8).map((r) => (
                  <li key={r.id} className="item-solto" data-bloco="true" data-estatico="true">
                    <span className="app-base block" style={{ color: "var(--texto)" }}>
                      {r.action}
                      {r.before || r.after ? (
                        <span style={{ color: "var(--texto-3)" }}>
                          {" "}
                          {r.before ? `${r.before} → ` : ""}
                          {r.after ?? ""}
                        </span>
                      ) : null}
                    </span>
                    <span className="app-meta mt-1 block">
                      {nomeDe(r.actor.id)} · {fmt.relative(r.at)}
                    </span>
                  </li>
                ))}
                {atividade.length > 8 ? (
                  <li className="app-meta app-numero px-1">Mostrando 8 de {atividade.length} — o resto fica na página.</li>
                ) : null}
              </ol>
            )}
          </section>
        </div>
      </div>
    </SidePanel>
  );
}
