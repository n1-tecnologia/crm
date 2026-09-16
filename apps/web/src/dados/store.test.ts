/**
 * `run()` híbrido (D-05/D-06) contra um `Transporte` falso — sem `fetch`,
 * sem `apps/api` no ar. Prova: recusa do domínio é síncrona e não grava;
 * sucesso otimista some sem tocar `data` real até o diff voltar; revisão
 * defasada e conflito re-hidratam; ids da cópia batem com os de um segundo
 * processo (a UoW do `apps/api` sincroniza do mesmo jeito).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { addTaskComment, changeTaskStatus, CP, createChatSession, resetIdSequence, sendChatMessage, syncIdSequence } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import type { Id, Task } from "@n1/dominio/types";
import { DIFERENCA_VAZIA, type Ordens } from "@n1/dominio";
import type { PedidoDeGravacao, RespostaDeGravacao, Transporte } from "./transporte";
import { criarStore } from "./store";

function achar(estado: DataState, id: Id): Task {
  const t = estado.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

/** `ordem = índice` — o mesmo que `GET /estado` devolveria para um Espaço recém-hidratado. */
function ordensDeTodasAsColecoes(estado: DataState): Ordens {
  const resultado: Ordens = {};
  for (const [colecao, valor] of Object.entries(estado)) {
    if (!Array.isArray(valor)) continue;
    const porId: Record<string, number> = {};
    valor.forEach((registro, indice) => {
      if (registro && typeof registro === "object" && "id" in registro) {
        porId[(registro as { readonly id: string }).id] = indice;
      }
    });
    resultado[colecao] = porId;
  }
  return resultado;
}

interface TransporteFalso extends Transporte {
  readonly gravarMock: ReturnType<typeof vi.fn<Transporte["gravar"]>>;
  readonly hidratarMock: ReturnType<typeof vi.fn<Transporte["hidratar"]>>;
}

function transporteFalso(): TransporteFalso {
  const gravarMock = vi.fn<Transporte["gravar"]>();
  const hidratarMock = vi.fn<Transporte["hidratar"]>();
  // Default hermético: um teste que não configura o mock explicitamente não
  // deixa uma promise nunca resolvida nem uma rejeição sem captura.
  gravarMock.mockResolvedValue({ tipo: "falha", erro: "não configurado neste teste." });
  hidratarMock.mockResolvedValue({ tipo: "falha", erro: "não configurado neste teste." });
  return { gravar: gravarMock, hidratar: hidratarMock, gravarMock, hidratarMock };
}

let state: DataState;
let ordens: Ordens;
let transporte: TransporteFalso;
let store: ReturnType<typeof criarStore>;

beforeEach(() => {
  state = buildSeed();
  ordens = ordensDeTodasAsColecoes(state);
  transporte = transporteFalso();
  store = criarStore({ sessao: { memberId: "mem_maryane" }, estadoInicial: { data: state, revisao: 7, ordens }, transporte });
});

describe("run() — recusa do domínio (D-05)", () => {
  it("(a) recusa é instantânea: sem POST, dado real inalterado", () => {
    const antes = structuredClone(store.getState().data);
    const konq = achar(state, "tsk_cp_konq"); // em autorização — pular direto para pago é recusado (RN-CP-04)

    const resultado = store.getState().run((d, m) => changeTaskStatus(d, m, konq.id, CP.status.pago));

    expect(resultado.ok).toBe(false);
    expect(transporte.gravarMock).not.toHaveBeenCalled();
    expect(store.getState().data).toStrictEqual(antes);
    expect(store.getState().lastResult?.ok).toBe(false);
  });
});

describe("run() — sucesso otimista (D-05)", () => {
  it("(b) roda síncrono; antes do POST resolver, o dado real não mudou", () => {
    transporte.gravarMock.mockImplementationOnce(() => new Promise<RespostaDeGravacao>(() => {})); // nunca resolve neste teste
    const trafego = achar(state, "tsk_cp_trafego");

    const resultado = store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    expect(resultado.ok).toBe(true);
    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const pedido = transporte.gravarMock.mock.calls[0]?.[0] as PedidoDeGravacao;
    expect(pedido.chamadas).toEqual([{ nome: "addTaskComment", args: [trafego.id, { content: "x" }] }]);
    expect(pedido.revisao).toBe(7);

    const contaReal = achar(store.getState().data, trafego.id);
    expect(contaReal.comments.some((c) => c.content === "x")).toBe(false);
    expect(store.getState().pendentes).toBe(1);
  });

  it("(c) depois do diff: Tarefa ganha o comentário, activity[0] é o registro novo, revisaoDoServidor avança", async () => {
    const trafego = achar(state, "tsk_cp_trafego");

    // O "servidor": a mesma operação, rodada numa cópia independente — o
    // diff que ele devolveria de verdade.
    const estadoServidor = structuredClone(state);
    const resultadoNoServidor = addTaskComment(estadoServidor, "mem_maryane", trafego.id, { content: "x" });
    if (!resultadoNoServidor.ok) throw new Error(`setup inválido: ${resultadoNoServidor.error}`);
    const tarefaGravada = estadoServidor.tasks.find((t) => t.id === trafego.id);
    if (!tarefaGravada) throw new Error("setup inválido: tarefa sumiu");
    const atividadeGravada = estadoServidor.activity[0];
    if (!atividadeGravada) throw new Error("setup inválido: sem activity");

    transporte.gravarMock.mockResolvedValueOnce({
      tipo: "diferenca",
      resultado: { ok: true, value: resultadoNoServidor.value },
      diferenca: {
        gravados: [
          { colecao: "tasks", id: tarefaGravada.id, dados: tarefaGravada, ordem: ordens.tasks?.[trafego.id] ?? 0 },
          { colecao: "activity", id: atividadeGravada.id, dados: atividadeGravada, ordem: -1 },
        ],
        removidos: [],
      },
      revisao: 8,
      revisaoAnterior: 7,
    });

    store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    await vi.waitFor(() => expect(store.getState().pendentes).toBe(0));
    expect(store.getState().revisaoDoServidor).toBe(8);
    const contaDepois = achar(store.getState().data, trafego.id);
    expect(contaDepois.comments.some((c) => c.content === "x")).toBe(true);
    expect(store.getState().data.activity[0]?.id).toBe(atividadeGravada.id);
  });
});

describe("run() — revisão defasada e conflito (D-06)", () => {
  it("(d) revisaoAnterior diferente da local aciona rehidratar() e substitui o data", async () => {
    const estadoFake = { marcador: "veio-do-rehidratar" } as unknown as DataState;
    transporte.hidratarMock.mockResolvedValueOnce({ data: estadoFake, revisao: 10, ordens: {}, memberId: "mem_maryane" });
    transporte.gravarMock.mockResolvedValueOnce({
      tipo: "diferenca",
      resultado: { ok: true, value: undefined },
      diferenca: DIFERENCA_VAZIA,
      revisao: 10,
      revisaoAnterior: 9, // !== revisaoDoServidor local (7)
    });
    const trafego = achar(state, "tsk_cp_trafego");

    store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    await vi.waitFor(() => expect(transporte.hidratarMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(store.getState().data).toBe(estadoFake));
    expect(store.getState().revisaoDoServidor).toBe(10);
  });

  it("(e) tipo: conflito aciona rehidratar() e marca lastResult com o erro", async () => {
    transporte.hidratarMock.mockResolvedValueOnce({ data: state, revisao: 11, ordens, memberId: "mem_maryane" });
    transporte.gravarMock.mockResolvedValueOnce({ tipo: "conflito", erro: "Outra alteração entrou antes desta." });
    const trafego = achar(state, "tsk_cp_trafego");

    store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    await vi.waitFor(() => expect(transporte.hidratarMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(store.getState().lastResult?.ok).toBe(false));
  });
});

describe("run() — falha de transporte", () => {
  it("(f) tipo: falha marca lastResult.error sem mexer em data", async () => {
    transporte.gravarMock.mockResolvedValueOnce({ tipo: "falha", erro: "Sem conexão com o servidor." });
    const dataAntes = store.getState().data;
    const trafego = achar(state, "tsk_cp_trafego");

    store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    await vi.waitFor(() => expect(store.getState().lastResult?.ok).toBe(false));
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Sem conexão com o servidor.");
    expect(store.getState().data).toBe(dataAntes);
  });
});

describe("run() — ids determinísticos (a cópia gera o que o servidor geraria)", () => {
  it("(g) syncIdSequence evita colisão mesmo com o contador de módulo desalinhado", () => {
    const trafego = achar(state, "tsk_cp_trafego");

    const estadoReferencia = structuredClone(state);
    syncIdSequence(estadoReferencia);
    const referencia = addTaskComment(estadoReferencia, "mem_maryane", trafego.id, { content: "referência" });
    if (!referencia.ok) throw new Error(`setup inválido: ${referencia.error}`);

    // Simula um contador de módulo desalinhado — ex.: outro teste avançou.
    // `run()` precisa corrigir via `syncIdSequence(copia)` antes de gerar o
    // próximo id, senão colidiria com um registro já existente.
    resetIdSequence(0);

    const resultado = store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));
    if (!resultado.ok) throw new Error(`recusa inesperada: ${resultado.error}`);

    expect(resultado.value.id).toBe(referencia.value.id);
  });
});

describe("run() — mais de uma chamada no mesmo run()", () => {
  it("(h) as duas chamadas viajam juntas, na ordem", () => {
    transporte.gravarMock.mockResolvedValueOnce({
      tipo: "diferenca",
      resultado: { ok: true, value: { id: "chat_x" } },
      diferenca: DIFERENCA_VAZIA,
      revisao: 8,
      revisaoAnterior: 7,
    });

    const resultado = store.getState().run((d, m) => {
      const sessao = createChatSession(d, m, { title: "Pergunta" });
      if (!sessao.ok) return sessao;
      sendChatMessage(d, m, sessao.value.id, "Pergunta");
      return sessao;
    });

    expect(resultado.ok).toBe(true);
    const pedido = transporte.gravarMock.mock.calls[0]?.[0] as PedidoDeGravacao;
    expect(pedido.chamadas.map((c) => c.nome)).toEqual(["createChatSession", "sendChatMessage"]);
  });
});

describe("rehidratar()", () => {
  it("(i) hidratar() falho marca lastResult.error", async () => {
    transporte.hidratarMock.mockResolvedValueOnce({ tipo: "falha", erro: "Sem conexão com o servidor." });

    await store.getState().rehidratar();

    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Sem conexão com o servidor.");
  });
});
