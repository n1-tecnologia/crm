"use client";

/**
 * In-memory store. There is no backend: the seed is built once and every
 * operation mutates it in place, bumping a revision so subscribers recompute.
 *
 * Why a revision instead of a new state object: the graph is large and deeply
 * connected (60 tasks, 25 deals, 20 conversations with their messages), and
 * cloning it on every keystroke would cost more than it protects. Reads go
 * through `useData`, which recomputes when the revision changes.
 */

import { create } from "zustand";
import { buildProductSeed } from "./seed-produto";
import type { DataState, OperationResult, Session } from "./state";
import * as operations from "./operations";
import type { Id } from "./types";

interface StoreShape {
  readonly data: DataState;
  revision: number;
  session: Session;
  /** Last operation result, so a screen can render the feedback it produced. */
  lastResult: (OperationResult<unknown> & { readonly at: number }) | null;
  setSession: (memberId: Id) => void;
  run: <T>(operation: (data: DataState, actingMemberId: Id) => OperationResult<T>) => OperationResult<T>;
  reset: () => void;
}

const seed = buildProductSeed();

export const useStore = create<StoreShape>((set, get) => ({
  data: seed,
  revision: 0,
  session: { memberId: seed.workspace.ownerMemberId },
  lastResult: null,

  setSession: (memberId) => set({ session: { memberId }, revision: get().revision + 1 }),

  run: (operation) => {
    const { data, session } = get();
    const result = operation(data, session.memberId);
    set({ revision: get().revision + 1, lastResult: { ...result, at: Date.now() } });
    return result;
  },

  reset: () => set({ data: buildProductSeed(), revision: get().revision + 1, lastResult: null }),
}));

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

/** The Member simulating the session (`/entrar`). */
export function useSession(): { memberId: Id; setMemberId: (id: Id) => void } {
  const memberId = useStore((state) => state.session.memberId);
  const setMemberId = useStore((state) => state.setSession);
  return { memberId, setMemberId };
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
