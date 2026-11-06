"use client";

/**
 * O Quadro das Listas conversacionais (C35), no quadro padrão
 * (`features/shell/quadro.tsx`): colunas em trilho com selo de contagem. Cada
 * Tarefa vira o card do que ela carrega: a que nasce de um Contato é o cartão
 * conversacional (rosto, Canal, última Mensagem); a que não tem Contato, o
 * cartão de Tarefa. Arrastar muda o Status da Tarefa.
 *
 * 15-40 (F14-D-06): este arquivo era `quadro-negocios.tsx` e também desenhava o
 * card de Negócio da Lista espelho de «Meus negócios» (subtotal em dinheiro
 * incluído). O espelho saiu; o Negócio vive em `/crm/negocios`, no quadro do Funil.
 */

import { useState, type ReactNode } from "react";
import { changeTaskStatus } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { useRun } from "@/dados/store";
import type { StatusDefinition, Task } from "@n1/dominio/types";
import { CartaoConversacional, dadosDoCartaoConversacional } from "@/features/estrutura/cartao-conversacional";
import { CartaoDeTarefa } from "@/features/estrutura/cartao-de-tarefa";
import { STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { ColunaDeQuadro, VazioDaColuna } from "@/features/shell/quadro";
import { RolagemNoTopo } from "@/features/shell/ui";
import { BotaoDeMais, CompositorNoGrupo } from "@/features/estrutura/novo-no-grupo";
import { useRecente } from "@/features/shell/recente";

export function QuadroConversacional({
  state,
  tasks,
  definitions,
  onError,
  openTask,
  onCreateInGroup,
  seletorDeTipo,
  criacaoRecusada,
  onMais,
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
}) {
  // O cartão que acabou de nascer ou mudar de coluna (o drop já devolve o id).
  const recente = useRecente();
  const run = useRun();
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
              subtitulo={STATUS_CATEGORY_LABEL[definition.category] ?? definition.category}
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
                  // O Contato decide: com ele, o cartão conversacional.
                  const conversacional = dadosDoCartaoConversacional(state, task);
                  const arraste = { onDragStart: () => setDragging(task.id), onDragEnd: () => setDragging(null) };
                  return conversacional ? (
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
