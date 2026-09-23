"use client";

/**
 * "Compartilhadas comigo" — o caminho que sobrevive à Grant apagada (T-3-77).
 *
 * Até 03-05, esta seção vivia dentro de `app-shell.tsx` como `SharedTasks` e
 * perguntava a `state.grants`: existe uma concessão de Tarefa para mim, cuja
 * Lista eu não alcanço pela árvore? 03-05 apagou as quatro Grants
 * `gr_cp_pessoa_*` do seed — a visibilidade da Pessoa da conta virou
 * derivação do Campo Pessoa (`List.sharedWithDefinitionIds` +
 * `memberNamedOnTask`, em `@n1/dominio/derive`). Uma seção keyed em
 * `state.grants` teria ficado vazia em silêncio: `tasks.length === 0`, o
 * componente devolve `null`, e nenhum teste falhava, porque `SharedTasks` não
 * tinha teste nenhum.
 *
 * A correção é de pergunta, não de arquitetura: a seção deixa de perguntar
 * "quais Grants de Tarefa existem para mim?" e passa a perguntar "quais
 * Tarefas eu vejo e cuja Lista eu não alcanço?" — `memberSeesTask &&
 * !memberReachesContainer`. Isso cobre os dois mecanismos de uma vez: a
 * Grant, para quem ainda tiver uma, e a derivação pelo Campo, para a Pessoa
 * da conta. Nenhum alcance é alargado: quem alcança a Lista pela árvore não
 * precisa desta seção — ela é só para o que a árvore não dá.
 *
 * Arquivo separado, com teste, para que a próxima remoção de mecanismo quebre
 * um teste em vez de quebrar uma tela em silêncio.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData, useSession } from "@/dados/store";
import {
  effectiveLifecycleOfTask,
  isTerminalCategory,
  memberReachesContainer,
  memberSeesTask,
  statusCategory,
} from "@n1/dominio/derive";
import type { DataState } from "@n1/dominio/state";
import type { Id, Task } from "@n1/dominio/types";

/**
 * Com a visibilidade derivada do Campo, o conjunto deixou de ser "as quatro
 * Grants do seed" e passou a ser "toda conta aberta em que sou a Pessoa" — um
 * trilho sem teto viraria rolagem. Acima disto, uma última linha manda para
 * `/estrutura/tarefas`, que depois da Task 2 deste plano mostra exatamente o
 * que o Membro pode ver.
 */
export const MAXIMO_COMPARTILHADAS = 10;

/**
 * Tarefas que este Membro vê (por Grant ou por ser a Pessoa nomeada num
 * Campo) e cuja Lista ele NÃO alcança pela árvore — o conjunto que
 * "Compartilhadas comigo" existe para mostrar. Puro, sem React.
 */
export function tarefasCompartilhadasCom(state: DataState, memberId: Id): readonly Task[] {
  // Memoizado por Lista, não recalculado por Tarefa: a Lista de Contas a
  // pagar tem milhares de Tarefas e `memberReachesContainer` varre o caminho
  // de contêineres e `state.grants` a cada chamada.
  const alcancePorLista = new Map<Id, boolean>();
  const alcancaLista = (listId: Id): boolean => {
    let alcanca = alcancePorLista.get(listId);
    if (alcanca === undefined) {
      alcanca = memberReachesContainer(state, memberId, "list", listId);
      alcancePorLista.set(listId, alcanca);
    }
    return alcanca;
  };

  const tarefas = state.tasks
    .filter((task) => effectiveLifecycleOfTask(state, task.id) === "ativo")
    .filter((task) => !alcancaLista(task.listId))
    .filter((task) => memberSeesTask(state, memberId, task.id))
    .filter((task) => !isTerminalCategory(statusCategory(state, task)));

  // Vencida/próxima primeiro; sem data vai ao fim — mesmo comparador de
  // `estrutura/tarefas/page.tsx`.
  return [...tarefas].sort((a, b) => {
    const chave = (task: Task) => String(task.dueDate?.value ?? "9999");
    return chave(a).localeCompare(chave(b));
  });
}

export function TarefasCompartilhadas() {
  const { memberId } = useSession();
  const tasks = useData((data) => tarefasCompartilhadasCom(data, memberId));
  const pathname = usePathname();
  if (tasks.length === 0) return null;

  const visiveis = tasks.slice(0, MAXIMO_COMPARTILHADAS);
  const restantes = tasks.length - visiveis.length;

  return (
    <div className="mt-2">
      <p className="app-meta px-3 py-1">Compartilhadas comigo</p>
      <ul>
        {visiveis.map((t) => (
          <li key={t.id}>
            <Link
              href={`/estrutura/tarefas/${t.id}`}
              className={`app-base block truncate rounded-[var(--r-controle)] px-3 py-1 transition-colors hover:bg-[var(--superficie-hover)] ${pathname === `/estrutura/tarefas/${t.id}` ? "bg-[var(--acento-lavado)] text-[var(--texto)]" : "text-[var(--texto-2)]"}`}
            >
              {t.title}
              {t.dueDate ? <span className="text-[var(--texto-4)]"> · vence {t.dueDate.value.slice(0, 10).split("-").reverse().slice(0, 2).join("/")}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {restantes > 0 ? (
        <Link
          href="/estrutura/tarefas"
          className="app-meta block truncate rounded-[var(--r-controle)] px-3 py-1 text-[var(--texto-3)] transition-colors hover:bg-[var(--superficie-hover)]"
        >
          + {restantes} em Todas que eu vejo
        </Link>
      ) : null}
    </div>
  );
}
