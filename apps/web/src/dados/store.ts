"use client";

/**
 * O store da interface: o `DataState` do domínio mais a sessão e o resultado
 * da última operação. Continua um store por árvore (via contexto, não
 * singleton — ver o porquê abaixo) e continua revisão em vez de objeto novo
 * — mas agora **o servidor é a verdade**: o `DataState` real só muda quando
 * o diff volta do `apps/api` (D-03); a cópia serve só para recusar na hora.
 *
 * `run()` é o híbrido de D-05: clona o estado (`structuredClone`), roda a
 * operação pura na cópia. Se o domínio recusar, o erro aparece instantâneo e
 * NADA vai à rede — a cópia é descartada. Se aceitar, a cópia também é
 * descartada, mas os nomes+argumentos das operações chamadas (gravados pelo
 * gravador de `@n1/dominio/operations/registro`, Plan 01-03) são mandados ao
 * `apps/api`, e o estado real só muda quando o diff da resposta voltar. Se a
 * revisão do cliente estava defasada — outra pessoa gravou no meio — ou o
 * servidor devolver 409, o store re-hidrata por `GET /estado` em vez de
 * aplicar qualquer coisa parcial (D-06): o cliente nunca fica com um estado
 * que o servidor não tem.
 *
 * Por que uma revisão e não um objeto novo: o grafo é grande e todo ligado
 * (60 Tarefas, 25 Negócios, 20 Conversas com as suas Mensagens), e trocar a
 * referência a cada operação custaria mais do que protege. As leituras
 * passam por `useData`, que recomputa quando a revisão muda.
 *
 * Por que um store por árvore, via contexto, e não um singleton de módulo:
 * no servidor, um singleton é compartilhado por todas as requisições — a
 * página da Maryane saía com a sessão de quem entrou antes — e o
 * `useSyncExternalStore` do SSR devolve o estado *inicial* do store, que num
 * singleton é sempre o Proprietário. Com o store nascendo dentro do
 * `StoreProvider`, cada requisição tem o seu, criado já com a sessão E o
 * estado certos, e o HTML do servidor mostra o Membro certo desde o primeiro
 * byte. É o padrão que o zustand documenta para o App Router.
 *
 * A API pública (`useData`, `useSession`, `useCurrentMember`, `useRun`,
 * `useLastResult`) NÃO muda: os cem arquivos que a consomem não sabem de
 * onde o store vem, nem que ele agora fala com uma API.
 */

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore, useStore as useZustandStore, type StoreApi } from "zustand";
import type { DataState, OperationResult, Session } from "@n1/dominio/state";
import * as operations from "@n1/dominio/operations";
import { gravarChamadas, syncIdSequence } from "@n1/dominio/operations";
import { aplicarDiferenca, type Ordens } from "@n1/dominio";
import type { Id } from "@n1/dominio/types";
import type { PedidoDeGravacao, Transporte } from "./transporte";

interface StoreShape {
  readonly data: DataState;
  revision: number;
  session: Session & { readonly userId?: string };
  /** Last operation result, so a screen can render the feedback it produced. */
  lastResult: (OperationResult<unknown> & { readonly at: number }) | null;
  /** colecao → id → ordem — o que `aplicarDiferenca` precisa para saber onde inserir um registro gravado. */
  readonly ordens: Ordens;
  /** A revisão do Espaço de Trabalho que o servidor confirmou por último — não a local, que não existe mais (D-05/D-06). */
  revisaoDoServidor: number;
  /**
   * PRIV-03 — o contador de ids do estado INTEIRO no servidor. `data` chega
   * recortado pelo que o Membro alcança, então o maior id visível pode ser
   * menor que o real: sem este piso, a cópia geraria um id que o servidor não
   * gera, e a tela navegaria para um registro que não existe.
   */
  sequenciaDoServidor: number;
  /** Quantos `run()` aceitos pelo domínio ainda esperam a confirmação do servidor. */
  pendentes: number;
  setSession: (memberId: Id, userId?: string) => void;
  run: <T>(operation: (data: DataState, actingMemberId: Id) => OperationResult<T>) => OperationResult<T>;
  /**
   * `run()` com a confirmação do servidor (checklist E1): `local` é o que a
   * cópia calculou, na hora; `confirmado` resolve com o resultado QUE O
   * SERVIDOR deu. O id que a cópia calcula só bate com o do servidor se
   * ninguém gravou desde a última hidratação — a ponte grava sozinha. Quem
   * navega para o registro recém-criado usa o id de `confirmado`.
   */
  runConfirmado: <T>(operation: (data: DataState, actingMemberId: Id) => OperationResult<T>) => {
    readonly local: OperationResult<T>;
    readonly confirmado: Promise<OperationResult<T>>;
  };
  /** Re-hidrata do zero por `GET /estado` — D-06: revisão defasada ou conflito. */
  rehidratar: () => Promise<void>;
  /**
   * Checklist E2 — pergunta só a revisão do Espaço ao servidor e re-hidrata
   * se ele está à frente (a ponte, o `automation/` ou outra pessoa gravou).
   * Nunca com uma gravação desta tela a caminho: o diff dela é que traz a
   * revisão nova. `true` quando re-hidratou.
   */
  verificarRevisao: () => Promise<boolean>;
}

export interface SessaoInicial {
  readonly memberId: Id;
  readonly userId?: string;
}

interface EstadoInicialDoStore {
  readonly data: DataState;
  readonly revisao: number;
  readonly ordens: Ordens;
  readonly sequencia?: number;
}

/**
 * `criarStore` fica exposta (não só `StoreProvider`) para o teste montar um
 * store sem React — `store.test.ts` injeta um `Transporte` falso e chama
 * `run()`/`rehidratar()` direto no `StoreApi`.
 */
export function criarStore(opcoes: {
  readonly sessao: SessaoInicial;
  readonly estadoInicial: EstadoInicialDoStore;
  readonly transporte: Transporte;
}): StoreApi<StoreShape> {
  const { sessao, estadoInicial, transporte } = opcoes;

  return createStore<StoreShape>((set, get) => {
    /**
     * Manda o que `run()` já aceitou localmente para o servidor, e aplica a
     * resposta. Roda depois de `run()` já ter devolvido o `OperationResult`
     * da cópia para quem chamou — por isso é sempre disparada com `void`,
     * `await`ada só por `runConfirmado`, que quer o resultado do servidor.
     */
    async function enviar(pedido: PedidoDeGravacao): Promise<OperationResult<unknown>> {
      try {
        const resposta = await transporte.gravar(pedido);

        switch (resposta.tipo) {
          case "diferenca": {
            if (resposta.revisaoAnterior !== get().revisaoDoServidor) {
              // Alguém gravou no meio (D-06): o diff foi calculado sobre uma
              // revisão que já não é a de agora — aplicá-lo por cima seria
              // arriscar um furo de ordem. Re-hidrata tudo.
              await get().rehidratar();
              if (!resposta.resultado.ok) {
                set({ lastResult: { ...resposta.resultado, at: Date.now() } });
              }
              return resposta.resultado;
            }

            // Mutação em lugar — o mesmo modelo do store: `aplicarDiferenca`
            // nunca troca a referência das coleções, só o array por dentro.
            aplicarDiferenca(get().data, get().ordens, resposta.diferenca);
            set((estado) => ({
              revisaoDoServidor: resposta.revisao,
              sequenciaDoServidor: Math.max(estado.sequenciaDoServidor, resposta.sequencia ?? 0),
              revision: estado.revision + 1,
            }));

            if (!resposta.resultado.ok) {
              // O servidor recusou o que a cópia aceitou — só acontece por
              // não-determinismo (ex.: um prazo virou entre o clique e a
              // resposta); o diff (vazio nesse caso) já aplicou, o erro do
              // servidor prevalece sobre o `ok:true` que a cópia calculou.
              set((estado) => ({ lastResult: { ...resposta.resultado, at: Date.now() }, revision: estado.revision + 1 }));
            }
            return resposta.resultado;
          }

          case "estado": {
            // Caminho do transporte em memória (rotas públicas): não há
            // servidor divergindo — a cópia gravada VIRA o estado.
            set((estado) => ({
              data: resposta.estado.data,
              ordens: resposta.estado.ordens,
              revisaoDoServidor: resposta.estado.revisao,
              revision: estado.revision + 1,
            }));
            return resposta.resultado;
          }

          case "conflito": {
            await get().rehidratar();
            set({ lastResult: { ok: false, error: resposta.erro, at: Date.now() } });
            return { ok: false, error: resposta.erro };
          }

          case "falha": {
            set((estado) => ({
              lastResult: { ok: false, error: resposta.erro, at: Date.now() },
              revision: estado.revision + 1,
            }));
            return { ok: false, error: resposta.erro };
          }
        }
      } catch {
        // Revisão de código: um corpo malformado ou um diff que não aplica não pode deixar
        // `runConfirmado` rejeitado — a tela que espera a confirmação ficaria travada.
        const erro = "Não foi possível confirmar a gravação. Recarregue a página para ver o estado atual.";
        set((estado) => ({ lastResult: { ok: false, error: erro, at: Date.now() }, revision: estado.revision + 1 }));
        return { ok: false, error: erro };
      } finally {
        set((estado) => ({ pendentes: estado.pendentes - 1 }));
      }
    }

    let verificando = false;

    /**
     * Roda `operation` numa cópia; se a cópia aceita, dispara o envio e
     * devolve a promessa dele (o resultado do servidor).
     */
    function rodarNaCopia<T>(operation: (data: DataState, actingMemberId: Id) => OperationResult<T>): {
      readonly resultado: OperationResult<T>;
      readonly envio?: Promise<OperationResult<unknown>>;
    } {
      const { data, session, revisaoDoServidor } = get();

      // O clone custa sub-ms para ~475 KB / ~900 registros (RESEARCH.md,
      // Pitfall 3) — não é o gargalo, a rede é. Sincronizar o contador de
      // ids faz a cópia gerar os ids que o servidor vai gerar SE ninguém
      // gravou desde a última hidratação (a Unidade de Trabalho faz o mesmo
      // antes de rodar a operação). Não é garantia: a ponte grava sozinha, e
      // aí o id da cópia é de outro registro — quem navega para o registro
      // recém-criado usa `runConfirmado` (checklist E1).
      const copia = structuredClone(data);
      syncIdSequence(copia, get().sequenciaDoServidor);

      const { resultado, chamadas } = gravarChamadas(() => operation(copia, session.memberId));

      if (!resultado.ok) {
        // Recusa do domínio: a cópia é descartada, nada vai à rede (D-05).
        set({ lastResult: { ...resultado, at: Date.now() } });
        return { resultado };
      }

      set((estado) => ({ pendentes: estado.pendentes + 1, lastResult: { ...resultado, at: Date.now() } }));

      // O estado real só muda quando `enviar` aplicar o diff que voltar do servidor.
      return { resultado, envio: enviar({ chamadas, revisao: revisaoDoServidor, copia, resultado }) };
    }

    return {
      data: estadoInicial.data,
      ordens: estadoInicial.ordens,
      revisaoDoServidor: estadoInicial.revisao,
      sequenciaDoServidor: estadoInicial.sequencia ?? 0,
      revision: 0,
      pendentes: 0,
      session: sessao.userId === undefined ? { memberId: sessao.memberId } : { memberId: sessao.memberId, userId: sessao.userId },
      lastResult: null,

      setSession: (memberId, userId) =>
        set({ session: userId === undefined ? { memberId } : { memberId, userId }, revision: get().revision + 1 }),

      // Síncrono para quem chama: devolve o resultado da cópia e o envio segue sem `await`.
      run: (operation) => rodarNaCopia(operation).resultado,

      runConfirmado: (operation) => {
        const { resultado, envio } = rodarNaCopia(operation);
        // O servidor roda a mesma operação do mesmo domínio: o valor que ele devolve tem a forma de `T`.
        return { local: resultado, confirmado: envio ? (envio as Promise<typeof resultado>) : Promise.resolve(resultado) };
      },

      verificarRevisao: async () => {
        if (!transporte.revisaoAtual || verificando || get().pendentes > 0) return false;
        verificando = true;
        try {
          const noServidor = await transporte.revisaoAtual();
          // Uma gravação pode ter saído enquanto a pergunta ia e voltava: o diff dela decide.
          if (noServidor === undefined || noServidor <= get().revisaoDoServidor || get().pendentes > 0) return false;
          await get().rehidratar();
          return true;
        } finally {
          verificando = false;
        }
      },

      rehidratar: async () => {
        const r = await transporte.hidratar();
        if ("tipo" in r) {
          set({ lastResult: { ok: false, error: r.erro, at: Date.now() } });
          return;
        }
        // Revisão de código: uma re-hidratação que saiu antes e chegou depois traz um estado mais
        // velho — a revisão só cresce, então a menor não sobrescreve a maior.
        if (r.revisao < get().revisaoDoServidor) return;
        set((estado) => ({
          data: r.data,
          ordens: r.ordens,
          revisaoDoServidor: r.revisao,
          sequenciaDoServidor: Math.max(estado.sequenciaDoServidor, r.sequencia ?? 0),
          revision: estado.revision + 1,
        }));
      },
    };
  });
}

const StoreContext = createContext<StoreApi<StoreShape> | null>(null);

/**
 * Cria o store uma vez por montagem, já com a sessão E o estado resolvidos
 * no servidor. `useState` com inicializador garante uma criação só, mesmo em
 * Strict Mode.
 */
export function StoreProvider({
  sessao,
  estadoInicial,
  transporte,
  children,
}: {
  readonly sessao: SessaoInicial;
  readonly estadoInicial: EstadoInicialDoStore;
  readonly transporte: Transporte;
  readonly children: ReactNode;
}) {
  const [store] = useState(() => criarStore({ sessao, estadoInicial, transporte }));
  return createElement(StoreContext.Provider, { value: store }, createElement(AcompanhanteDaRevisao, { store }), children);
}

/** Checklist E2 — de quanto em quanto tempo a tela pergunta a revisão do Espaço. */
export const INTERVALO_DA_REVISAO_MS = 5_000;

/**
 * Checklist E2 — com a aba visível, pergunta a revisão a cada
 * `INTERVALO_DA_REVISAO_MS` e ao voltar à aba; o que a ponte grava aparece
 * sem recarregar a página. Aba escondida não pergunta nada.
 */
function AcompanhanteDaRevisao({ store }: { readonly store: StoreApi<StoreShape> }): null {
  useEffect(() => {
    const verificar = () => {
      if (document.visibilityState === "visible") void store.getState().verificarRevisao();
    };
    const intervalo = window.setInterval(verificar, INTERVALO_DA_REVISAO_MS);
    document.addEventListener("visibilitychange", verificar);
    window.addEventListener("focus", verificar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", verificar);
      window.removeEventListener("focus", verificar);
    };
  }, [store]);
  return null;
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

/** `run()` com a confirmação do servidor — ver `StoreShape.runConfirmado`. */
export function useRunConfirmado() {
  return useStore((state) => state.runConfirmado);
}

export function useLastResult() {
  return useStore((state) => state.lastResult);
}

/**
 * Re-hidrata do servidor (`GET /estado`). Para o que gravou por uma rota que
 * não é `run()` — o anexo enviado ao Storage, por exemplo — e precisa ver o
 * resultado na tela.
 */
export function useRehidratar() {
  return useStore((state) => state.rehidratar);
}

export { operations };
