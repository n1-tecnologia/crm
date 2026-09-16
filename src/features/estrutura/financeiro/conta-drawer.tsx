"use client";

/**
 * O POPUP DA CONTA: a Conta inteira sem sair da Lista. É a mesma Tarefa
 * completa da página — a ficha editável no centro, os Comentários e a
 * Atividade à direita — sob o título do popup. Nada de "modo leitura" com um
 * botão de editar: o que a página faz, o popup faz.
 *
 * O que é só do Financeiro fica no rodapé: a ação rápida que se aplica a esta
 * conta (Autorizar pagamento / Marcar como paga; Iniciar cobrança / Marcar
 * como recebida), com confirmação, e o atalho para a página cheia.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { changeTaskStatus, statusOptionRefusal } from "@/data/operations";
import { memberSeesTask, taskWriteRefusal } from "@/data/derive";
import { useFormat } from "@/features/shell/use-format";
import { Button, ConfirmDialog, EmptyState, SidePanel } from "@/features/shell/ui";
import { TarefaCompleta } from "@/features/estrutura/tarefa-completa";
import { financeProfileOf, PAGAR_PROFILE, valorDaConta } from "./lens";

type Report = (
  result: { ok: boolean; error?: string },
  message: string,
) => void;

export function ContaDrawer({
  taskId,
  onClose,
  report,
}: {
  readonly taskId: string | null;
  readonly onClose: () => void;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const [confirmando, setConfirmando] = useState<{
    statusId: string;
    label: string;
  } | null>(null);

  const task = taskId
    ? state.tasks.find(
        (t) => t.id === taskId && memberSeesTask(state, memberId, t.id),
      )
    : undefined;
  if (!task) {
    return (
      <SidePanel title="Conta" open={taskId !== null} onClose={onClose}>
        <EmptyState compact title="Conta não encontrada, ou você não tem permissão para vê-la." />
      </SidePanel>
    );
  }
  const profile = financeProfileOf(task.listId) ?? PAGAR_PROFILE;
  const escritaRecusada = taskWriteRefusal(state, memberId, task.id);
  // A ação principal do rodapé: a primeira ação rápida que se aplica a esta
  // conta (Autorizar / Iniciar cobrança); senão, a de fechamento.
  const [acao1, acao2] = profile.quickActions;
  const escolhida = acao1.notApplicable(task) === undefined ? acao1 : acao2;
  const acaoPrincipal = {
    label: escolhida.label,
    statusId: escolhida.statusId,
    motivo:
      escritaRecusada ??
      escolhida.notApplicable(task) ??
      statusOptionRefusal(state, memberId, task, escolhida.statusId),
  };

  return (
    <SidePanel
      title="Conta"
      open
      onClose={onClose}
      semRespiro
      footer={
        <span className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Link href={`/estrutura/tarefas/${task.id}`} className="btn btn-fantasma btn-sm">
            Abrir em página cheia
          </Link>
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              setConfirmando({
                statusId: acaoPrincipal.statusId,
                label: acaoPrincipal.label,
              })
            }
            disabled={acaoPrincipal.motivo !== undefined}
            disabledReason={acaoPrincipal.motivo ?? ""}
          >
            {acaoPrincipal.label}
          </Button>
        </span>
      }
    >
      <ConfirmDialog
        open={confirmando !== null}
        title={`${confirmando?.label ?? ""}: “${task.title}”?`}
        description={`${fmt.money({ amount: valorDaConta(task), currency: "BRL" })} · vence ${task.dueDate ? fmt.taskDate(task.dueDate) : "—"}. Passa pelas regras da Lista e fica na Atividade.`}
        confirmLabel={confirmando?.label ?? "Confirmar"}
        onConfirm={() => {
          if (confirmando)
            report(
              run((data, me) =>
                changeTaskStatus(data, me, task.id, confirmando.statusId),
              ),
              `“${task.title}”: ${confirmando.label.toLocaleLowerCase("pt-BR")}.`,
            );
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />
      <TarefaCompleta taskId={task.id} modo="popup" />
    </SidePanel>
  );
}
