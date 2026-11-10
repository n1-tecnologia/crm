"use client";

/**
 * Os diálogos e o painel que a página da Lista hospeda (Fase 10, 2.1.6): a
 * série de parcelas, a «Nova Tarefa» conversacional, o painel da Tarefa aberta
 * (conta no Financeiro, Tarefa nos demais) e o diálogo de mover Tarefa. Saíram de `page.tsx` sem mudar
 * comportamento: o estado e os avisos continuam na página, que passa só os
 * callbacks.
 */

import type { ReactNode } from "react";
import { SerieDeParcelasDialog } from "@/features/estrutura/financeiro/serie-dialog";
import { ContaDrawer } from "@/features/estrutura/financeiro/conta-drawer";
import { MoveTaskDialog } from "@/features/estrutura/move-task-dialog";
import { NovaTarefaConversacionalDialog } from "@/features/estrutura/nova-tarefa-conversacional-dialog";
import { TaskPanel } from "@/features/estrutura/task-panel";
import type { Task } from "@n1/dominio/types";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

export function DialogosDaLista({
  listId,
  financeira,
  conversacional,
  serie,
  conversacionalAberto,
  statusDaConversacional,
  aoFecharConversacional,
  aoNovaConversacional,
  openTaskId,
  aoFecharTarefa,
  movingTaskId,
  aoFecharMover,
  aoMoverTarefa,
  report,
}: {
  readonly listId: string;
  readonly financeira: boolean;
  readonly conversacional: boolean;
  /** Só a Lista de Contas a receber tem a série de parcelas. */
  readonly serie?: {
    readonly aberta: boolean;
    readonly aoFechar: () => void;
    readonly aoCriar: (tasks: readonly Task[], cliente: string) => void;
  };
  readonly conversacionalAberto: boolean;
  readonly statusDaConversacional: string | undefined;
  readonly aoFecharConversacional: () => void;
  readonly aoNovaConversacional: (text: string, taskId: string) => void;
  readonly openTaskId: string | null;
  readonly aoFecharTarefa: () => void;
  readonly movingTaskId: string | null;
  readonly aoFecharMover: () => void;
  readonly aoMoverTarefa: (text: string) => void;
  readonly report: Report;
}): ReactNode {
  return (
    <>
      {serie ? <SerieDeParcelasDialog open={serie.aberta} onClose={serie.aoFechar} onCreated={serie.aoCriar} /> : null}
      {/* Renderizado sempre e controlado por `open`, como na Caixa de Entrada e
          na ficha do Contato: a saída de `--dur-1` anima (COMPONENTES.md). A
          `key` é a Lista — o diálogo parte dos props a cada abertura, então o
          Status do "+" do grupo vale sem remontar (remontar ao fechar perderia a saída). */}
      {conversacional ? (
        <NovaTarefaConversacionalDialog
          key={listId}
          listId={listId}
          open={conversacionalAberto}
          {...(statusDaConversacional ? { statusId: statusDaConversacional } : {})}
          onClose={aoFecharConversacional}
          onDone={aoNovaConversacional}
        />
      ) : null}
      {financeira ? (
        <ContaDrawer key={openTaskId ?? "fechado"} taskId={openTaskId} onClose={aoFecharTarefa} report={report} />
      ) : (
        <TaskPanel taskId={openTaskId} onClose={aoFecharTarefa} />
      )}
      <MoveTaskDialog taskId={movingTaskId} onClose={aoFecharMover} onDone={aoMoverTarefa} />
    </>
  );
}
