"use client";

/**
 * T12 como POPUP, aberto de uma Lista ou de um Quadro por `?tarefa=<id>`.
 *
 * É a Tarefa completa — a mesma da página `/estrutura/tarefas/[tarefa]`: a
 * ficha editável no centro (título, descrição, propriedades, Campos,
 * Checklists, Subtarefas…) e os Comentários e a Atividade à direita. Nada
 * de "olhada rápida" com um botão de editar: o que a página faz, o popup faz,
 * sem custar sair da coleção. O rodapé só guarda o atalho para a página cheia
 * (o endereço que os links apontam).
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SidePanel } from "@/features/shell/ui";
import { TarefaCompleta } from "@/features/estrutura/tarefa-completa";

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
}: {
  readonly taskId: string | null;
  readonly onClose: () => void;
}) {
  if (taskId === null) return null;
  return (
    <SidePanel
      title="Tarefa"
      open
      onClose={onClose}
      semRespiro
      footer={
        <span className="flex flex-1 items-center justify-end">
          <Link href={`/estrutura/tarefas/${taskId}`} className="btn btn-fantasma btn-sm">
            Abrir em página cheia
          </Link>
        </span>
      }
    >
      <TarefaCompleta taskId={taskId} modo="popup" />
    </SidePanel>
  );
}
