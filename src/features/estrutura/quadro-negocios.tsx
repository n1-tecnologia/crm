"use client";

/**
 * O Quadro das Listas conversacionais (C35), no quadro padrão
 * (`features/shell/quadro.tsx`) — a mesma cara do quadro de `/crm/negocios`:
 * colunas em trilho com selo de contagem e — quando a Lista é a cópia do Funil
 * (`comValor`) — o subtotal em dinheiro. Cada Tarefa vira o card do que ela
 * carrega: a que espelha um Negócio (Vínculo Tarefa → Negócio, proveniência
 * `deal`) é o card de Negócio; a que nasce de um Contato é o cartão
 * conversacional (rosto, Canal, última Mensagem); a que não tem nem um nem
 * outro, o cartão de Tarefa. Arrastar muda o Status da Tarefa — não a Etapa do
 * Negócio (a Lista é uma cópia, e o cabeçalho avisa).
 */

import { useState, type ReactNode } from "react";
import { changeTaskStatus } from "@/data/operations";
import type { DataState } from "@/data/state";
import { useRun } from "@/data/store";
import type { Deal, StatusDefinition, Task } from "@/data/types";
import { negocioDaTarefa } from "@/data/derive-conversacional";
import { DealCard, dealCardData } from "@/features/crm/deal-card";
import { CartaoConversacional, dadosDoCartaoConversacional } from "@/features/estrutura/cartao-conversacional";
import { CartaoDeTarefa } from "@/features/estrutura/cartao-de-tarefa";
import { STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { ColunaDeQuadro, VazioDaColuna } from "@/features/shell/quadro";
import { RolagemNoTopo } from "@/features/shell/ui";
import { BotaoDeMais, CompositorNoGrupo } from "@/features/estrutura/novo-no-grupo";
import { useFormat } from "@/features/shell/use-format";
import { useRecente } from "@/features/shell/recente";

/** O Negócio da Tarefa — a leitura mora em derive-conversacional; o nome fica pelos chamadores. */
export function dealOfTask(state: DataState, task: Task): Deal | undefined {
  return negocioDaTarefa(state, task);
}

export function QuadroNegocios({
  state,
  tasks,
  definitions,
  onError,
  openTask,
  onCreateInGroup,
  seletorDeTipo,
  criacaoRecusada,
  onMais,
  comValor = false,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly definitions: readonly StatusDefinition[];
  readonly onError: (message: string | null) => void;
  readonly openTask: (taskId: string) => void;
  /** O "+" da coluna (e a coluna vazia): a Tarefa nasce naquele Status. */
  readonly onCreateInGroup?: (title: string, statusId: string, taskTypeId?: string) => boolean;
  /** O seletor de Tipo do compositor de grupo (o estado é do compositor); `undefined` quando não há escolha. */
  readonly seletorDeTipo?: (valor: string | undefined, aoEscolher: (taskTypeId: string) => void) => ReactNode;
  readonly criacaoRecusada?: string;
  /** O "+" da coluna faz OUTRA coisa (iniciar uma conversa naquela Etapa) em vez de abrir o compositor. */
  readonly onMais?: (statusId: string) => void;
  /** O subtotal em dinheiro da coluna: só na cópia do Funil, onde cada Tarefa espelha um Negócio com valor. */
  readonly comValor?: boolean;
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
          const criar = (onMais || onCreateInGroup) && !motivoDoMais ? () => (onMais ? onMais(definition.id) : setCriandoEm(definition.id)) : undefined;
          return (
            <ColunaDeQuadro
              key={definition.id}
              contagem={column.length}
              nome={definition.name}
              cor={definition.color}
              onDrop={() => drop(definition.id)}
              mais={
                <BotaoDeMais
                  rotulo={definition.name}
                  aberto={criandoEm === definition.id}
                  onClick={() => (onMais ? onMais(definition.id) : setCriandoEm((atual) => (atual === definition.id ? null : definition.id)))}
                  {...(motivoDoMais ? { motivo: motivoDoMais } : {})}
                />
              }
              subtitulo={`${STATUS_CATEGORY_LABEL[definition.category] ?? definition.category}${comValor ? ` · ${fmt.money({ amount: columnValue, currency: "BRL" })}` : ""}`}
            >
              {criandoEm === definition.id && onCreateInGroup ? (
                <CompositorNoGrupo
                  placeholder={`Nova em ${definition.name}`}
                  onCreate={(title, taskTypeId) => onCreateInGroup(title, definition.id, taskTypeId)}
                  seletor={seletorDeTipo}
                  onCancel={() => setCriandoEm(null)}
                />
              ) : null}
              {column.length === 0 ? (
                <VazioDaColuna texto={`Nenhuma Tarefa em “${definition.name}”.`} {...(criar ? { onCriar: criar } : {})} />
              ) : (
                column.map((task) => {
                  // Só a Tarefa-espelho vira card de Negócio; uma Reunião ligada ao mesmo Negócio é outra coisa.
                  const deal = task.provenance?.kind === "deal" ? dealOfTask(state, task) : undefined;
                  // Sem Negócio espelhado, o Contato decide: com ele, o cartão conversacional.
                  const conversacional = deal ? undefined : dadosDoCartaoConversacional(state, task);
                  const arraste = { onDragStart: () => setDragging(task.id), onDragEnd: () => setDragging(null) };
                  return deal ? (
                    <DealCard
                      key={task.id}
                      recente={task.id === recente || deal.id === recente}
                      data={dealCardData(state, deal)}
                      href={`/estrutura/tarefas/${task.id}`}
                      onOpen={() => openTask(task.id)}
                      {...arraste}
                    />
                  ) : conversacional ? (
                    <CartaoConversacional key={task.id} recente={task.id === recente} data={conversacional} onOpen={() => openTask(task.id)} {...arraste} />
                  ) : (
                    <CartaoDeTarefa key={task.id} recente={task.id === recente} state={state} task={task} onOpen={() => openTask(task.id)} {...arraste} />
                  );
                })
              )}
            </ColunaDeQuadro>
          );
        })}
      </div>
    </RolagemNoTopo>
  );
}
