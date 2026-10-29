"use client";

/**
 * Os diálogos e o painel que a página da Lista hospeda (Fase 10, 2.1.6): a
 * série de parcelas, «Iniciar conversa», a «Nova Tarefa» conversacional, o
 * painel da Tarefa aberta (conta no Financeiro, Negócio no espelho comercial,
 * Tarefa nos demais) e o diálogo de mover Tarefa. Saíram de `page.tsx` sem mudar
 * comportamento: o estado e os avisos continuam na página, que passa só os
 * callbacks.
 */

import type { ReactNode } from "react";
import { DealScreen } from "@/features/crm/deal-screen";
import { IniciarConversaDialog } from "@/features/crm/iniciar-conversa-dialog";
import { SerieDeParcelasDialog } from "@/features/estrutura/financeiro/serie-dialog";
import { ContaDrawer } from "@/features/estrutura/financeiro/conta-drawer";
import { MoveTaskDialog } from "@/features/estrutura/move-task-dialog";
import { NovaTarefaConversacionalDialog } from "@/features/estrutura/nova-tarefa-conversacional-dialog";
import { TaskPanel } from "@/features/estrutura/task-panel";
import { SidePanel } from "@/features/shell/ui";
import type { Deal, Task } from "@n1/dominio/types";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

export function DialogosDaLista({
  listId,
  financeira,
  espelhoComercial,
  conversacionalPura,
  serie,
  iniciandoConversa,
  aoFecharIniciarConversa,
  aoIniciarConversa,
  conversacionalAberto,
  statusDaConversacional,
  aoFecharConversacional,
  aoNovaConversacional,
  openTaskId,
  aoFecharTarefa,
  negocioAberto,
  caminho,
  movingTaskId,
  aoFecharMover,
  aoMoverTarefa,
  report,
}: {
  readonly listId: string;
  readonly financeira: boolean;
  readonly espelhoComercial: boolean;
  readonly conversacionalPura: boolean;
  /** Só a Lista de Contas a receber tem a série de parcelas. */
  readonly serie?: {
    readonly aberta: boolean;
    readonly aoFechar: () => void;
    readonly aoCriar: (tasks: readonly Task[], cliente: string) => void;
  };
  readonly iniciandoConversa: { readonly stageId?: string } | null;
  readonly aoFecharIniciarConversa: () => void;
  readonly aoIniciarConversa: (text: string) => void;
  readonly conversacionalAberto: boolean;
  readonly statusDaConversacional: string | undefined;
  readonly aoFecharConversacional: () => void;
  readonly aoNovaConversacional: (text: string, taskId: string) => void;
  readonly openTaskId: string | null;
  readonly aoFecharTarefa: () => void;
  readonly negocioAberto: Deal | undefined;
  readonly caminho: readonly { readonly id: string; readonly name: string }[];
  readonly movingTaskId: string | null;
  readonly aoFecharMover: () => void;
  readonly aoMoverTarefa: (text: string) => void;
  readonly report: Report;
}): ReactNode {
  return (
    <>
      {serie ? <SerieDeParcelasDialog open={serie.aberta} onClose={serie.aoFechar} onCreated={serie.aoCriar} /> : null}
      {espelhoComercial && iniciandoConversa ? (
        <IniciarConversaDialog
          listId={listId}
          open
          {...(iniciandoConversa.stageId ? { stageId: iniciandoConversa.stageId } : {})}
          onClose={aoFecharIniciarConversa}
          onDone={aoIniciarConversa}
        />
      ) : null}
      {/* Renderizado sempre e controlado por `open`, como na Caixa de Entrada e
          na ficha do Contato: a saída de `--dur-1` anima (COMPONENTES.md). A
          `key` é a Lista — o diálogo parte dos props a cada abertura, então o
          Status do "+" do grupo vale sem remontar (remontar ao fechar perderia a saída). */}
      {conversacionalPura ? (
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
      ) : negocioAberto ? (
        // O card do Funil abre o Negócio (contato, conversa, roteiro), não a
        // Tarefa que o espelha: é o dado do lead que o Comercial veio ver.
        <SidePanel title={negocioAberto.title} open onClose={aoFecharTarefa} wide bare>
          <DealScreen
            dealId={negocioAberto.id}
            embedded={{
              path: (
                <>
                  {caminho.map((node, index) => (
                    <span key={node.id}>
                      {index > 0 ? " › " : ""}
                      {node.name}
                    </span>
                  ))}
                </>
              ),
              onClose: aoFecharTarefa,
            }}
          />
        </SidePanel>
      ) : (
        <TaskPanel taskId={openTaskId} onClose={aoFecharTarefa} />
      )}
      <MoveTaskDialog taskId={movingTaskId} onClose={aoFecharMover} onDone={aoMoverTarefa} />
    </>
  );
}
