"use client";

import { useState, type ReactNode } from "react";
import { useRun } from "@/dados/store";
import { changeTaskStatus } from "@n1/dominio/operations";
import type { effectiveListConfig } from "@n1/dominio/derive";
import { STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { useRecente } from "@/features/shell/recente";
import { ColunaDeQuadro, VazioDaColuna } from "@/features/shell/quadro";
import { RolagemNoTopo } from "@/features/shell/ui";
import { BotaoDeMais, CompositorNoGrupo } from "@/features/estrutura/novo-no-grupo";
import { CartaoDeTarefa } from "@/features/estrutura/cartao-de-tarefa";
import { valorDaConta, type FinanceProfile } from "@/features/estrutura/financeiro/lens";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";

type Definition = NonNullable<
  ReturnType<typeof effectiveListConfig>
>["statusSet"]["definitions"][number];

/**
 * O Quadro das Listas operacionais — e das Contas (Financeiro) — no quadro
 * padrão (`features/shell/quadro.tsx`): a mesma coluna e a mesma anatomia de
 * cartão do quadro de Negócios (fim de 2026-09-23: "tudo que for quadro, a
 * visualização deve ser igual à da segunda imagem"). Numa Lista financeira a
 * coluna soma o valor das Contas e o cartão destaca o valor.
 */
export function QuadroDeTarefas({
  state,
  tasks,
  definitions,
  onError,
  openTask,
  financeiro,
  onCreateInGroup,
  seletorDeTipo,
  criacaoRecusada,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly definitions: readonly Definition[];
  readonly onError: (message: string | null) => void;
  readonly openTask: (taskId: string) => void;
  /** A lente financeira da Lista: a coluna soma e o cartão destaca o valor. */
  readonly financeiro?: FinanceProfile;
  /** O "+" da coluna: a Tarefa nasce naquele Status. */
  readonly onCreateInGroup?: (title: string, statusId: string, taskTypeId?: string) => boolean;
  readonly seletorDeTipo?: (valor: string | undefined, aoEscolher: (taskTypeId: string) => void) => ReactNode;
  readonly criacaoRecusada?: string;
}) {
  const run = useRun();
  const fmt = useFormat();
  const [dragging, setDragging] = useState<string | null>(null);
  const recente = useRecente();
  const [criandoEm, setCriandoEm] = useState<string | null>(null);
  const motivoDoMais = onCreateInGroup ? criacaoRecusada : (criacaoRecusada ?? "Esta Lista não recebe Tarefas novas.");

  const drop = (statusId: string) => {
    if (!dragging) return;
    const result = run((data, memberId) =>
      changeTaskStatus(data, memberId, dragging, statusId),
    );
    onError(result.ok ? null : result.error);
    setDragging(null);
  };

  return (
    <RolagemNoTopo>
      <div className="flex gap-4">
        {definitions.map((definition) => {
          const group = tasks.filter((task) => task.statusId === definition.id);
          const soma = financeiro ? group.reduce((total, task) => total + valorDaConta(task), 0) : 0;
          return (
            <ColunaDeQuadro
              key={definition.id}
              contagem={group.length}
              nome={definition.name}
              cor={definition.color}
              onDrop={() => drop(definition.id)}
              mais={
                <BotaoDeMais
                  rotulo={definition.name}
                  aberto={criandoEm === definition.id}
                  onClick={() => setCriandoEm((atual) => (atual === definition.id ? null : definition.id))}
                  {...(motivoDoMais ? { motivo: motivoDoMais } : {})}
                />
              }
              subtitulo={`${STATUS_CATEGORY_LABEL[definition.category] ?? definition.category}${financeiro ? ` · ${fmt.money({ amount: soma, currency: "BRL" })}` : ""}`}
            >
              {criandoEm === definition.id && onCreateInGroup ? (
                <CompositorNoGrupo
                  placeholder={`Nova em ${definition.name}`}
                  onCreate={(title, taskTypeId) => onCreateInGroup(title, definition.id, taskTypeId)}
                  seletor={seletorDeTipo}
                  onCancel={() => setCriandoEm(null)}
                />
              ) : null}
              {group.length === 0 ? (
                <VazioDaColuna
                  texto={`Nenhuma Tarefa em “${definition.name}”.`}
                  {...(onCreateInGroup && !motivoDoMais ? { onCriar: () => setCriandoEm(definition.id) } : {})}
                />
              ) : (
                group.map((task) => (
                  <CartaoDeTarefa
                    key={task.id}
                    state={state}
                    task={task}
                    {...(financeiro ? { financeiro } : {})}
                    onOpen={() => openTask(task.id)}
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => setDragging(null)}
                    recente={task.id === recente}
                  />
                ))
              )}
            </ColunaDeQuadro>
          );
        })}
      </div>
    </RolagemNoTopo>
  );
}
