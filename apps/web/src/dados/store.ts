"use client";

/**
 * O store da interface: o `DataState` do domínio mais a sessão e o resultado
 * da última operação. Continua um store por árvore (via contexto, não
 * singleton — ver o porquê abaixo) e continua revisão em vez de objeto novo.
 *
 * Dois estados (Fase 12, D-13): `confirmado` é o que o servidor já devolveu —
 * o único alvo de `aplicarDiferenca` (D-03) e o dono das `ordens`; `data` é o
 * que a tela mostra, e é o `confirmado` com as gravações ainda a caminho
 * refeitas por cima. Sem nenhuma a caminho, os dois são o MESMO objeto
 * (copy-on-write: nenhuma cópia a mais).
 *
 * `run()` é o híbrido de D-05: clona `data` (`structuredClone`) e roda a
 * operação pura na cópia. Se o domínio recusar, o erro aparece instantâneo e
 * NADA vai à rede — a cópia é descartada. Se aceitar, a cópia vira o `data`
 * na hora (D-13) e os nomes+argumentos das operações chamadas (gravados pelo
 * gravador de `@n1/dominio/operations/registro`, Plan 01-03) são mandados ao
 * `apps/api`. Quando a resposta volta, a diferença entra em `confirmado` e as
 * gravações que ainda esperam são refeitas por cima, pelo registro
 * `OPERACOES` (o mesmo que o servidor roda), para obter o novo `data`.
 * Exceção (D-13): um gesto com qualquer operação de `operacoes-que-esperam.ts`
 * — segredo de link, JID, resolução só do servidor, agendador — NÃO vira `data`
 * na hora; vai ao servidor e só aparece quando a diferença volta, com o valor
 * que o servidor gerou.
 *
 * Recusa do servidor, falha, conflito e erro de corpo tiram a gravação: `data`
 * volta a ser o `confirmado` mais o que sobrou na fila, e o erro aparece pelo
 * canal de sempre (`lastResult`), com a mensagem do servidor (D-14). Se a
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

import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createStore, useStore as useZustandStore, type StoreApi } from "zustand";
import type { DataState, OperationResult, Session } from "@n1/dominio/state";
import * as operations from "@n1/dominio/operations";
import { gravarChamadas, syncIdSequence, type ChamadaDeOperacao } from "@n1/dominio/operations";
import { OPERACOES } from "@n1/dominio/operations/registro";
import { aplicarDiferenca, type Ordens } from "@n1/dominio";
import type { Id } from "@n1/dominio/types";
import type { PedidoDeGravacao, RespostaDeGravacao, Transporte } from "./transporte";
import { esperaOServidor } from "./operacoes-que-esperam";

/**
 * D-11 / Open Question 2 da Fase 12: as implementações reais de `Transporte`
 * devolvem a lista de respostas, uma por chamada; as fakes de teste do store
 * seguem devolvendo uma resposta só. Aqui as duas formas viram a mesma lista.
 */
function respostasDe(retorno: RespostaDeGravacao | readonly RespostaDeGravacao[]): readonly RespostaDeGravacao[] {
  return Array.isArray(retorno) ? retorno : [retorno as RespostaDeGravacao];
}

/**
 * `OPERACOES` é `as const satisfies Record<...>`: indexar por um `NomeDeOperacao`
 * genérico devolve a união das assinaturas, que o TypeScript não deixa chamar.
 * A assinatura comum `(state, actingMemberId, ...args)` é garantida por
 * `registro.ts`; o cast só relaxa o que o compilador não consegue expressar
 * (o mesmo que `apps/api/src/rotas/operacoes.ts` faz).
 */
type OperacaoDoRegistro = (state: DataState, actingMemberId: Id, ...args: unknown[]) => OperationResult<unknown>;

/**
 * Uma gravação que a cópia aceitou e que o servidor ainda não confirmou. As
 * `chamadas` são clonadas ao entrar (o gravador guarda os `args` por
 * referência) e `concluir` resolve a promessa de `runConfirmado`.
 */
interface Pendente {
  readonly chamadas: readonly ChamadaDeOperacao[];
  /**
   * Vira `data` e é refeita sobre o `confirmado`. `false` quando a cópia aceitou
   * sem registrar chamada alguma, ou quando uma chamada está na lista de
   * exceções de D-13 (`operacoes-que-esperam.ts`): o gesto espera o servidor.
   */
  readonly otimista: boolean;
  readonly copia: DataState;
  readonly resultado: OperationResult<unknown>;
  readonly concluir: (resultado: OperationResult<unknown>) => void;
}

/**
 * D-16: a fila tem dois tipos de item. `gravar` é uma pendente à espera da sua
 * vez (ou em voo, quando é o primeiro); `rehidratar` é um `GET /estado` pedido
 * de fora (`useRehidratar`, `verificarRevisao`) que espera o pedido em voo
 * responder antes de buscar — senão o estado já traria o que a pendente gravou
 * e a reconstrução a faria duas vezes (Pitfall 3).
 */
type ItemDaFila =
  | { readonly tipo: "gravar"; readonly pendente: Pendente }
  | { readonly tipo: "rehidratar"; readonly concluir: () => void; readonly falhar: (erro: unknown) => void };

/**
 * D-13: a cópia aceita vira `data` na hora quando registrou ao menos uma chamada
 * E nenhuma delas está na lista de exceções (`operacoes-que-esperam.ts`): um
 * gesto com qualquer operação cujo resultado local difere do servidor (segredo
 * de link, JID, resolução do servidor, agendador) espera a resposta inteiro.
 */
function otimistaPara(chamadas: readonly ChamadaDeOperacao[]): boolean {
  return chamadas.length > 0 && !esperaOServidor(chamadas);
}

interface StoreShape {
  /** O que a tela mostra: o `confirmado` com as gravações a caminho refeitas por cima (D-13). */
  readonly data: DataState;
  /**
   * O que o servidor já devolveu — leitura. Quando não há gravação otimista a
   * caminho, é o MESMO objeto que `data`.
   */
  readonly confirmado: DataState;
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
     * D-16 (e Pitfall 3): os pedidos de um store saem um de cada vez, na ordem
     * do clique. A fila guarda as gravações que o servidor ainda não confirmou
     * (a primeira pode estar em voo) e as re-hidratações pedidas de fora;
     * `emVoo` diz se `processarFila` já está trabalhando.
     */
    const fila: ItemDaFila[] = [];
    let emVoo = false;

    /** As gravações na fila, na ordem do clique (a primeira pode estar em voo). */
    function gravacoesNaFila(): Pendente[] {
      return fila.flatMap((item) => (item.tipo === "gravar" ? [item.pendente] : []));
    }

    /** Tira o item da fila (se ainda estiver nela). */
    function sairDaFila(item: ItemDaFila): void {
      const indice = fila.indexOf(item);
      if (indice !== -1) fila.splice(indice, 1);
    }

    /** Tira a pendente da fila (se ainda estiver nela). */
    function tirar(pendente: Pendente): void {
      const item = fila.find((candidato) => candidato.tipo === "gravar" && candidato.pendente === pendente);
      if (item) sairDaFila(item);
    }

    /**
     * Refaz uma pendente por cima de `copia`, chamada a chamada, pelo registro
     * `OPERACOES` — o mesmo que o servidor roda. Devolve o erro se alguma
     * chamada recusa ou lança.
     */
    function refazer(copia: DataState, memberId: Id, pendente: Pendente): string | null {
      try {
        for (const chamada of pendente.chamadas) {
          const operacao = OPERACOES[chamada.nome] as OperacaoDoRegistro;
          const r = operacao(copia, memberId, ...chamada.args);
          if (!r.ok) return r.error;
        }
        return null;
      } catch {
        return "Não foi possível refazer esta alteração sobre o estado confirmado pelo servidor.";
      }
    }

    /**
     * D-13/D-14: recalcula `data` a partir do `confirmado` e das pendentes
     * otimistas que sobram. Sem nenhuma, `data` é o próprio `confirmado` (zero
     * cópia). Uma pendente que falha ao ser refeita por cima — a Lista que ela
     * renomeava foi recusada — sai da lista com o erro, NUNCA é enviada ao
     * servidor, e a reconstrução recomeça do `confirmado` sem ela.
     * `causaJaMostrada`: quando a causa (a recusa que derrubou a anterior) já
     * está em `lastResult`, o erro da refeita não a encobre; só a promessa dela
     * resolve com o seu.
     */
    function refazerPendentes(causaJaMostrada: boolean): void {
      const { confirmado, session } = get();
      let erroDaRefeita: string | null = null;
      let data = confirmado;

      for (;;) {
        const otimistas = gravacoesNaFila().filter((p) => p.otimista);
        if (otimistas.length === 0) {
          data = confirmado;
          break;
        }
        const copia = structuredClone(confirmado);
        syncIdSequence(copia, get().sequenciaDoServidor);
        const falhou = otimistas.find((p) => {
          const erro = refazer(copia, session.memberId, p);
          if (erro === null) return false;
          tirar(p);
          p.concluir({ ok: false, error: erro });
          erroDaRefeita = erro;
          return true;
        });
        if (!falhou) {
          data = copia;
          break;
        }
      }

      set((estado) => ({
        data,
        pendentes: gravacoesNaFila().length,
        revision: estado.revision + 1,
        ...(erroDaRefeita !== null && !causaJaMostrada
          ? { lastResult: { ok: false as const, error: erroDaRefeita, at: Date.now() } }
          : {}),
      }));
    }

    /** Busca `GET /estado` e põe em `confirmado`. A revisão só cresce: uma resposta mais velha não sobrescreve a mais nova. */
    async function hidratarAgora(): Promise<void> {
      const r = await transporte.hidratar();
      if ("tipo" in r) {
        set({ lastResult: { ok: false, error: r.erro, at: Date.now() } });
        return;
      }
      // Revisão de código: uma re-hidratação que saiu antes e chegou depois traz um estado mais
      // velho — a revisão só cresce, então a menor não sobrescreve a maior.
      if (r.revisao < get().revisaoDoServidor) return;
      set((estado) => ({
        confirmado: r.data,
        ordens: r.ordens,
        revisaoDoServidor: r.revisao,
        sequenciaDoServidor: Math.max(estado.sequenciaDoServidor, r.sequencia ?? 0),
        revision: estado.revision + 1,
      }));
    }

    /**
     * Manda o que `run()` já aceitou localmente para o servidor, e aplica a
     * resposta no `confirmado`. Roda depois de `run()` já ter devolvido o
     * `OperationResult` da cópia para quem chamou — por isso é sempre
     * disparada sem `await`, `await`ada só por `runConfirmado`, que quer o
     * resultado do servidor. Não mexe em `data`: quem reconstrói é
     * `refazerPendentes`, depois de a pendente sair da lista.
     */
    async function enviar(pendente: Pendente): Promise<OperationResult<unknown>> {
      try {
        const pedido: PedidoDeGravacao = {
          chamadas: pendente.chamadas,
          revisao: get().revisaoDoServidor,
          copia: pendente.copia,
          resultado: pendente.resultado,
        };
        const respostas = respostasDe(await transporte.gravar(pedido));
        if (respostas.length === 0) throw new Error("O transporte não devolveu nenhuma resposta.");

        // D-11: as respostas entram em ordem, uma por chamada do `run`. O
        // resultado devolvido é o da última processada (ou o erro do conflito
        // ou da falha que interrompeu a lista).
        let ultimo: OperationResult<unknown> = { ok: true, value: undefined };

        for (const resposta of respostas) {
          switch (resposta.tipo) {
            case "diferenca": {
              if (resposta.revisaoAnterior !== get().revisaoDoServidor) {
                // Alguém gravou no meio (D-06, D-12): o diff foi calculado sobre
                // uma revisão que já não é a de agora — aplicá-lo por cima seria
                // arriscar um furo de ordem (T-12-13). Re-hidrata tudo; o
                // `GET /estado` já traz as chamadas seguintes da lista, e a
                // pendente corrente (que o servidor confirmou) sai antes de
                // `refazerPendentes`, para não ser refeita (Pitfall 3).
                await hidratarAgora();
                if (!resposta.resultado.ok) {
                  set({ lastResult: { ...resposta.resultado, at: Date.now() } });
                }
                return resposta.resultado;
              }

              // Mutação em lugar — o mesmo modelo do store: `aplicarDiferenca`
              // nunca troca a referência das coleções, só o array por dentro.
              // O alvo é sempre o `confirmado` (D-13), nunca o `data` otimista.
              aplicarDiferenca(get().confirmado, get().ordens, resposta.diferenca);
              set((estado) => ({
                revisaoDoServidor: resposta.revisao,
                sequenciaDoServidor: Math.max(estado.sequenciaDoServidor, resposta.sequencia ?? 0),
                revision: estado.revision + 1,
              }));

              if (!resposta.resultado.ok) {
                // O servidor recusou o que a cópia aceitou (D-14): o diff (vazio
                // nesse caso) já aplicou, e o erro do servidor prevalece sobre o
                // `ok:true` que a cópia calculou.
                set((estado) => ({ lastResult: { ...resposta.resultado, at: Date.now() }, revision: estado.revision + 1 }));
              }
              ultimo = resposta.resultado;
              break;
            }

            case "estado": {
              // Caminho do transporte em memória (rotas públicas): não há
              // servidor divergindo — a cópia gravada VIRA o estado confirmado.
              set((estado) => ({
                confirmado: resposta.estado.data,
                ordens: resposta.estado.ordens,
                revisaoDoServidor: resposta.estado.revisao,
                revision: estado.revision + 1,
              }));
              return resposta.resultado;
            }

            case "conflito": {
              await hidratarAgora();
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
        }

        return ultimo;
      } catch {
        // Revisão de código: um corpo malformado ou um diff que não aplica não pode deixar
        // `runConfirmado` rejeitado — a tela que espera a confirmação ficaria travada.
        const erro = "Não foi possível confirmar a gravação. Recarregue a página para ver o estado atual.";
        set((estado) => ({ lastResult: { ok: false, error: erro, at: Date.now() }, revision: estado.revision + 1 }));
        return { ok: false, error: erro };
      }
    }

    /** A pendente respondeu: sai da lista ANTES de reconstruir (nunca refeita duas vezes), `data` é refeito e a promessa resolve. */
    function terminar(pendente: Pendente, resultado: OperationResult<unknown>): void {
      tirar(pendente);
      refazerPendentes(!resultado.ok);
      pendente.concluir(resultado);
    }

    /**
     * Esvazia a fila, um item de cada vez. O `transporte.gravar` do primeiro
     * item é chamado de forma SÍNCRONA dentro desta função (antes do primeiro
     * `await`): o primeiro `run` sai na hora, como o caso (b) de `store.test.ts`
     * afirma (Pitfall 8). Encadear com um `.then` incondicional adiaria o
     * primeiro envio por uma microtarefa — proibido. Enquanto algo está em voo,
     * quem enfileira só põe o item e deixa o laço pegá-lo na sua vez.
     */
    async function processarFila(): Promise<void> {
      if (emVoo) return;
      emVoo = true;
      try {
        while (fila.length > 0) {
          const item = fila[0];
          if (!item) break;
          if (item.tipo === "gravar") {
            const resposta = await enviar(item.pendente);
            terminar(item.pendente, resposta);
            continue;
          }
          try {
            await hidratarAgora();
            sairDaFila(item);
            refazerPendentes(false);
            item.concluir();
          } catch (erro) {
            // Quem pediu a re-hidratação recebe a rejeição, como antes da fila; a fila segue.
            sairDaFila(item);
            refazerPendentes(false);
            item.falhar(erro);
          }
        }
      } finally {
        emVoo = false;
      }
    }

    let verificando = false;

    /**
     * Roda `operation` numa cópia; se a cópia aceita, ela vira o `data` na hora
     * (D-13), dispara o envio e devolve a promessa dele (o resultado do servidor).
     */
    function rodarNaCopia<T>(operation: (data: DataState, actingMemberId: Id) => OperationResult<T>): {
      readonly resultado: OperationResult<T>;
      readonly envio?: Promise<OperationResult<unknown>>;
    } {
      const { data, session } = get();

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

      const otimista = otimistaPara(chamadas);
      let concluir: (r: OperationResult<unknown>) => void = () => undefined;
      const envio = new Promise<OperationResult<unknown>>((resolve) => {
        concluir = resolve;
      });
      const pendente: Pendente = {
        // Os `args` são gravados por referência: clona para a reconstrução não ver o que o chamador mutar depois.
        chamadas: structuredClone(chamadas),
        otimista,
        copia,
        resultado,
        concluir,
      };
      fila.push({ tipo: "gravar", pendente });

      set((estado) => ({
        // D-13: a cópia aceita é o que a tela mostra. Uma cópia sem chamadas nunca vai ao servidor como mudança, e uma com operação da lista de exceções espera a resposta — nenhuma das duas vira `data`.
        ...(otimista ? { data: copia } : {}),
        pendentes: gravacoesNaFila().length,
        lastResult: { ...resultado, at: Date.now() },
        revision: estado.revision + 1,
      }));

      void processarFila();
      return { resultado, envio };
    }

    return {
      data: estadoInicial.data,
      confirmado: estadoInicial.data,
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

      // Pitfall 3: entra na MESMA fila — espera o pedido em voo responder, busca o `GET /estado` e
      // refaz por cima só as pendentes que ainda não saíram. Com a fila vazia, roda na hora.
      rehidratar: () =>
        new Promise<void>((resolve, reject) => {
          fila.push({ tipo: "rehidratar", concluir: resolve, falhar: reject });
          void processarFila();
        }),
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

/**
 * D-15 — esqueleto do RED: ainda não calcula nada.
 */
export function idsNaoConfirmados(_data: DataState, _confirmado: DataState): ReadonlySet<Id> {
  return new Set<Id>();
}

export function useIdsNaoConfirmados(): ReadonlySet<Id> {
  return useMemo(() => new Set<Id>(), []);
}
