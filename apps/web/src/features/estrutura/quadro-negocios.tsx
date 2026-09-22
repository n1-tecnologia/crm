"use client";

/**
 * O Quadro das Listas de "Meus negócios", com a mesma cara do quadro de
 * `/crm/negocios`: palco, colunas em trilho com selo de contagem e subtotal, e
 * o card de Negócio. Cada Tarefa espelha um Negócio (Vínculo Tarefa → Negócio);
 * a que não espelha nenhum ganha um card simples. Arrastar muda o Status da
 * Tarefa — não a Etapa do Negócio (a Lista é uma cópia, e o cabeçalho avisa).
 */

import { Plus, Video } from "lucide-react";
import { useState } from "react";
import { changeTaskStatus } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { useRun } from "@/dados/store";
import type { Deal, StatusDefinition, Task } from "@n1/dominio/types";
import { DealCard, dealCardData } from "@/features/crm/deal-card";
import { STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { ActorAvatar, Icone, Pilula, RolagemNoTopo } from "@/features/shell/ui";
import { BotaoDeMais, CompositorNoGrupo } from "@/features/estrutura/novo-no-grupo";
import { useFormat } from "@/features/shell/use-format";
import { useRecente } from "@/features/shell/recente";

export function dealOfTask(state: DataState, task: Task): Deal | undefined {
  const link = state.links.find((l) => l.fromType === "task" && l.fromId === task.id && l.toType === "deal");
  return link ? state.deals.find((d) => d.id === link.toId) : undefined;
}

export function QuadroNegocios({
  state,
  tasks,
  definitions,
  onError,
  openTask,
  onCreateInGroup,
  criacaoRecusada,
  onMais,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly definitions: readonly StatusDefinition[];
  readonly onError: (message: string | null) => void;
  readonly openTask: (taskId: string) => void;
  /** O "+" da coluna (e a coluna vazia): a Tarefa nasce naquele Status. */
  readonly onCreateInGroup?: (title: string, statusId: string) => boolean;
  readonly criacaoRecusada?: string;
  /** O "+" da coluna faz OUTRA coisa (iniciar uma conversa naquela Etapa) em vez de abrir o compositor. */
  readonly onMais?: (statusId: string) => void;
}) {
  // O cartão que acabou de nascer ou mudar de coluna (o drop já devolve o id).
  const recente = useRecente();
  const run = useRun();
  const fmt = useFormat();
  const [dragging, setDragging] = useState<string | null>(null);
  const [criandoEm, setCriandoEm] = useState<string | null>(null);
  const motivoDoMais = onMais ? undefined : onCreateInGroup ? criacaoRecusada : (criacaoRecusada ?? "Esta Lista não recebe Tarefas novas.");
  const drop = (statusId: string) => {
    if (!dragging) return;
    const result = run((data, memberId) => changeTaskStatus(data, memberId, dragging, statusId));
    onError(result.ok ? null : result.error);
    setDragging(null);
  };

  return (
    <RolagemNoTopo>
    <div className="flex gap-4">
      {definitions.map((definition) => {
        const column = tasks.filter((task) => task.statusId === definition.id);
        // Só a Tarefa-espelho conta o valor: uma Reunião ligada ao mesmo Negócio não o soma duas vezes.
        const columnValue = column.reduce((sum, task) => sum + (task.provenance?.kind === "deal" ? (dealOfTask(state, task)?.value?.amount ?? 0) : 0), 0);
        return (
          <div
            key={definition.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => drop(definition.id)}
            className="trilho flex w-[19.2rem] shrink-0 flex-col p-3"
          >
            <div className="mb-3 flex items-start gap-2.5">
              {/* A contagem em selo: é o que se lê primeiro ao varrer o quadro. */}
              <span
                aria-hidden="true"
                className="app-base app-numero grid shrink-0 place-items-center rounded-[var(--r-controle)]"
                style={{
                  width: "var(--controle-h-sm)",
                  height: "var(--controle-h-sm)",
                  background: "var(--acento-lavado)",
                  color: "var(--acento)",
                  fontWeight: 600,
                }}
              >
                {column.length}
              </span>
              <span className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 truncate">
                  <Pilula cor={definition.color}>{definition.name}</Pilula>
                  <BotaoDeMais
                    rotulo={definition.name}
                    aberto={criandoEm === definition.id}
                    onClick={() => (onMais ? onMais(definition.id) : setCriandoEm((atual) => (atual === definition.id ? null : definition.id)))}
                    {...(motivoDoMais ? { motivo: motivoDoMais } : {})}
                  />
                </h2>
                <span className="app-meta app-numero block truncate">
                  {STATUS_CATEGORY_LABEL[definition.category] ?? definition.category} · {fmt.money({ amount: columnValue, currency: "BRL" })}
                </span>
              </span>
            </div>

            <div className="pilha-solta">
              {criandoEm === definition.id && onCreateInGroup ? (
                <CompositorNoGrupo
                  placeholder={`Nova em ${definition.name}`}
                  onCreate={(title) => onCreateInGroup(title, definition.id)}
                  onCancel={() => setCriandoEm(null)}
                />
              ) : null}
              {column.length === 0 ? (
                (onMais || onCreateInGroup) && !motivoDoMais ? (
                  <button
                    type="button"
                    onClick={() => (onMais ? onMais(definition.id) : setCriandoEm(definition.id))}
                    className="app-sm grid place-items-center gap-2 rounded-[var(--r-painel)] border border-dashed border-[var(--linha-forte)] px-2 py-6 text-[var(--texto-3)] transition-colors hover:border-[var(--acento)] hover:text-[var(--texto)]"
                  >
                    <span
                      aria-hidden="true"
                      className="grid place-items-center rounded-full border border-[var(--linha-forte)]"
                      style={{ width: "var(--controle-h-sm)", height: "var(--controle-h-sm)" }}
                    >
                      <Icone de={Plus} tamanho="sm" />
                    </span>
                    Nenhuma Tarefa em “{definition.name}”.
                  </button>
                ) : (
                  <p className="app-sm grid place-items-center rounded-[var(--r-painel)] border border-dashed border-[var(--linha-forte)] px-2 py-6 text-[var(--texto-3)]">
                    Nenhuma Tarefa em “{definition.name}”.
                  </p>
                )
              ) : (
                column.map((task) => {
                  // Só a Tarefa-espelho vira card de Negócio; uma Reunião ligada ao mesmo Negócio é outra coisa.
                  const deal = task.provenance?.kind === "deal" ? dealOfTask(state, task) : undefined;
                  return deal ? (
                    <DealCard
                      key={task.id}
                      recente={task.id === recente || deal.id === recente}
                      data={dealCardData(state, deal)}
                      href={`/estrutura/tarefas/${task.id}`}
                      onOpen={() => openTask(task.id)}
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                    />
                  ) : (
                    <TaskOnlyCard
                      key={task.id}
                      recente={task.id === recente}
                      state={state}
                      task={task}
                      onOpen={() => openTask(task.id)}
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
    </RolagemNoTopo>
  );
}

/** A Tarefa que não espelha um Negócio (uma Reunião, uma Tarefa à mão): o mesmo card, com o que ela tem. */
function TaskOnlyCard({
  state,
  task,
  onOpen,
  onDragStart,
  onDragEnd,
  recente = false,
}: {
  readonly state: DataState;
  readonly task: Task;
  readonly onOpen: () => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  readonly recente?: boolean;
}) {
  const fmt = useFormat();
  const responsavel = task.assignees.find((a) => a.kind === "member");
  const membro = responsavel ? state.members.find((m) => m.id === responsavel.id) : undefined;
  const reuniao = state.taskTypes.find((t) => t.id === task.taskTypeId)?.name === "Reunião";
  const negocio = dealOfTask(state, task);
  return (
    // `card-negocio`, não `item-solto`: o arraste briga com o lift do hover.
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="card-negocio block w-full cursor-grab p-3 text-left active:cursor-grabbing"
      data-recente={recente ? "true" : undefined}
    >
      <p className="ed-subtitulo flex items-center gap-1.5 truncate">
        {reuniao ? <Icone de={Video} tamanho="sm" style={{ color: "var(--acento)" }} /> : null}
        <span className="truncate">{task.title}</span>
      </p>
      <p className="app-base truncate" style={{ color: "var(--texto-3)" }}>
        {reuniao ? `Reunião${negocio ? ` · ${negocio.title}` : ""}` : "Tarefa sem Negócio"} · {task.dueDate ? fmt.taskDate(task.dueDate) : "sem data"}
      </p>
      <div className="mt-3 flex items-center gap-1.5 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
        {membro ? (
          <>
            <ActorAvatar kind="member" name={membro.displayName} {...(membro.photoFileId ? { photoFileId: membro.photoFileId } : {})} />
            <span className="app-base min-w-0 truncate" style={{ color: "var(--texto)" }}>{membro.displayName}</span>
          </>
        ) : (
          <span className="app-base" style={{ color: "var(--texto-3)" }}>Sem Responsável</span>
        )}
      </div>
    </button>
  );
}
