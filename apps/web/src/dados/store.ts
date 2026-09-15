"use client";

/**
 * O store da interface: o `DataState` do domínio mais a sessão e o resultado
 * da última operação. Toda operação muta o grafo em lugar e incrementa uma
 * revisão para os assinantes recomputarem.
 *
 * Por que uma revisão e não um objeto novo: o grafo é grande e todo ligado
 * (60 Tarefas, 25 Negócios, 20 Conversas com as suas Mensagens), e cloná-lo a
 * cada tecla custaria mais do que protege. As leituras passam por `useData`,
 * que recomputa quando a revisão muda.
 *
 * Por que um store por árvore, via contexto, e não um singleton de módulo:
 * no servidor, um singleton é compartilhado por todas as requisições — a
 * página da Maryane saía com a sessão de quem entrou antes — e o
 * `useSyncExternalStore` do SSR devolve o estado *inicial* do store, que num
 * singleton é sempre o Proprietário. Com o store nascendo dentro do
 * `StoreProvider`, cada requisição tem o seu, criado já com a sessão certa,
 * e o HTML do servidor mostra o Membro certo desde o primeiro byte. É o padrão
 * que o zustand documenta para o App Router.
 *
 * A API pública (`useData`, `useSession`, `useRun`…) não muda: os cem arquivos
 * que a consomem não sabem de onde o store vem.
 */

import { createContext, createElement, useContext, useState, type ReactNode } from "react";
import { createStore, useStore as useZustandStore, type StoreApi } from "zustand";
import { buildProductSeed } from "@n1/dominio/seed-produto";
import type { DataState, OperationResult, Session } from "@n1/dominio/state";
import * as operations from "@n1/dominio/operations";
import type { Id } from "@n1/dominio/types";

interface StoreShape {
  readonly data: DataState;
  revision: number;
  session: Session & { readonly userId?: string };
  /** Last operation result, so a screen can render the feedback it produced. */
  lastResult: (OperationResult<unknown> & { readonly at: number }) | null;
  setSession: (memberId: Id, userId?: string) => void;
  run: <T>(operation: (data: DataState, actingMemberId: Id) => OperationResult<T>) => OperationResult<T>;
  reset: () => void;
}

export interface SessaoInicial {
  readonly memberId: Id;
  readonly userId?: string;
}

function criarStore(sessao: SessaoInicial): StoreApi<StoreShape> {
  return createStore<StoreShape>((set, get) => ({
    data: buildProductSeed(),
    revision: 0,
    session: sessao.userId === undefined ? { memberId: sessao.memberId } : { memberId: sessao.memberId, userId: sessao.userId },
    lastResult: null,

    setSession: (memberId, userId) =>
      set({ session: userId === undefined ? { memberId } : { memberId, userId }, revision: get().revision + 1 }),

    run: (operation) => {
      const { data, session } = get();
      const result = operation(data, session.memberId);
      set({ revision: get().revision + 1, lastResult: { ...result, at: Date.now() } });
      return result;
    },

    reset: () => set({ data: buildProductSeed(), revision: get().revision + 1, lastResult: null }),
  }));
}

const StoreContext = createContext<StoreApi<StoreShape> | null>(null);

/**
 * Cria o store uma vez por montagem, já com a sessão resolvida no servidor.
 * `useState` com inicializador garante uma criação só, mesmo em Strict Mode.
 */
export function StoreProvider({ sessao, children }: { readonly sessao: SessaoInicial; readonly children: ReactNode }) {
  const [store] = useState(() => criarStore(sessao));
  return createElement(StoreContext.Provider, { value: store }, children);
}

function useStore<T>(selector: (state: StoreShape) => T): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore fora de <StoreProvider>: a casca não montou o store desta árvore.");
  return useZustandStore(store, selector);
}

/**
 * Reads a slice of the data. The revision is part of the subscription so the
 * selector re-runs after every operation.
 */
export function useData<T>(selector: (data: DataState) => T): T {
  /*
    A revisão é assinada de verdade, não só lida: o selector devolve fatias do
    mesmo grafo mutado no lugar, e o zustand compara com `Object.is` — quem
    devolvia `data` (a mesma referência) nunca re-renderizava por conta da
    operação, só por um `setState` local que viesse junto. Assinando a revisão,
    cada `run` re-renderiza quem lê.
  */
  const revision = useStore((state) => state.revision);
  const data = useStore((state) => state.data);
  void revision;
  return selector(data);
}

/** O Membro da sessão — resolvido do Usuário autenticado, nunca escolhido. */
export function useSession(): { memberId: Id; userId: string | undefined } {
  const memberId = useStore((state) => state.session.memberId);
  const userId = useStore((state) => state.session.userId);
  return { memberId, userId };
}

/** The acting member's record, for headers and permission checks. */
export function useCurrentMember() {
  const memberId = useStore((state) => state.session.memberId);
  return useData((data) => data.members.find((m) => m.id === memberId));
}

export function useRun() {
  return useStore((state) => state.run);
}

export function useLastResult() {
  return useStore((state) => state.lastResult);
}

export { operations };
