/**
 * PARA-05 — a leitura pública de uma Tarefa (7.7): o que `/p/<segredo>`
 * mostra a quem não é Membro. É uma projeção, nunca a entidade: só nomes e
 * valores, nunca ids de Membro, de Definição, de Lista ou o segredo. A regra
 * de quando o link abre é a de `taskByPublicSecret` (ativo, Tarefa
 * efetivamente ativa, funcionalidade ligada na Lista); comentários e anexos
 * entram só se o compartilhamento os mostra. A tela e o `apps/api` leem a
 * mesma função — é o que faz a página pública dizer o que o servidor diz.
 */

import { effectiveLifecycleOfTask, statusDefinition } from "./derive";
import { taskByPublicSecret } from "./operations/scale";
import type { DataState } from "./state";
import type { Priority, TaskDate } from "./types";

export interface StatusPublico {
  readonly name: string;
  readonly color: string;
}

export interface TarefaPublica {
  readonly title: string;
  readonly description: string;
  readonly status?: StatusPublico;
  readonly priority: Priority;
  readonly dueDate?: TaskDate;
  /** Nomes de exibição, nunca ids. */
  readonly assignees: readonly string[];
  readonly fields: ReadonlyArray<{ readonly nome: string; readonly valor: string }>;
  readonly subtasks: ReadonlyArray<{ readonly title: string; readonly status?: StatusPublico }>;
  readonly checklists: ReadonlyArray<{ readonly name: string; readonly items: ReadonlyArray<{ readonly text: string; readonly done: boolean }> }>;
  /** Ausente quando o compartilhamento não mostra anexos. */
  readonly attachments?: ReadonlyArray<{ readonly displayName: string; readonly mediaType: string }>;
  /** Ausente quando o compartilhamento não mostra comentários. */
  readonly comments?: ReadonlyArray<{ readonly author: string; readonly createdAt: string; readonly content: string }>;
}

export function projecaoPublicaDaTarefa(state: DataState, segredo: string): TarefaPublica | undefined {
  const task = taskByPublicSecret(state, segredo);
  if (!task?.publicShare) return undefined;
  const share = task.publicShare;
  const statusDe = (listId: string, statusId: string): StatusPublico | undefined => {
    const d = statusDefinition(state, listId, statusId);
    return d ? { name: d.name, color: d.color } : undefined;
  };
  const nomeDe = (id: string) => state.members.find((m) => m.id === id)?.displayName ?? state.agents.find((a) => a.id === id)?.name ?? "—";
  const subtasks = state.tasks
    .filter((t) => t.parentTaskId === task.id && effectiveLifecycleOfTask(state, t.id) === "ativo")
    .sort((a, b) => a.siblingOrder - b.siblingOrder)
    .map((t) => {
      const status = statusDe(t.listId, t.statusId);
      return { title: t.title, ...(status ? { status } : {}) };
    });
  const fields = task.fieldValues
    .filter((v) => v.state === "ativo")
    .map((v) => ({
      nome: state.fieldDefinitions.find((d) => d.id === v.definitionId)?.name ?? "Campo",
      valor: Array.isArray(v.value) ? v.value.join(", ") : v.value === undefined || v.value === null ? "—" : String(v.value),
    }));
  const status = statusDe(task.listId, task.statusId);
  return {
    title: task.title,
    description: task.description,
    ...(status ? { status } : {}),
    priority: task.priority,
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    assignees: task.assignees.map((a) => nomeDe(a.id)),
    fields,
    subtasks,
    checklists: task.checklists.map((c) => ({ name: c.name, items: c.items.filter((i) => !i.converted && !i.parentItemId).map((i) => ({ text: i.text, done: i.done })) })),
    ...(share.showsAttachments ? { attachments: task.attachments.map((a) => ({ displayName: a.displayName ?? "Arquivo", mediaType: a.mediaType })) } : {}),
    ...(share.showsComments
      ? { comments: task.comments.filter((c) => !c.deletedAt).map((c) => ({ author: nomeDe(c.author.id), createdAt: c.createdAt, content: c.content })) }
      : {}),
  };
}
