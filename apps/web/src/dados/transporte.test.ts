/**
 * `transporteHttp`/`transporteEmMemoria` contra um `fetch` falso — nenhuma
 * rede real, nenhum `apps/api` no ar (o Plan 01-04, que cria as rotas, é a
 * onda seguinte). Prova o contrato HTTP exato que `01-04-PLAN.md` define e
 * os casos de erro de transporte que `store.ts` (Task 2) precisa distinguir.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFERENCA_VAZIA, type Diferenca } from "@n1/dominio";
import type { OperationResult } from "@n1/dominio/state";
import type { DataState } from "@n1/dominio/state";
import { transporteEmMemoria, transporteHttp } from "./transporte";

function respostaFalsa(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

const DIFERENCA_EXEMPLO: Diferenca = {
  gravados: [{ colecao: "tasks", id: "tsk_x", dados: { id: "tsk_x" }, ordem: 1 }],
  removidos: [],
};

describe("transporteHttp — gravar", () => {
  it("(a) monta URL, header e corpo — args serializados (Date vira marcador) e revisao", async () => {
    fetchMock.mockResolvedValueOnce(respostaFalsa(200, { ok: true, value: { id: "cmt_1" }, diferenca: DIFERENCA_VAZIA, revisao: 8, revisaoAnterior: 7 }));
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    await transporte.gravar({
      chamadas: [{ nome: "addTaskComment", args: [new Date("2026-01-01T00:00:00.000Z"), "x"] }],
      revisao: 7,
      copia: {} as DataState,
      resultado: { ok: true, value: undefined },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/operacoes/addTaskComment");
    expect(opcoes.method).toBe("POST");
    expect(opcoes.headers).toEqual({ "content-type": "application/json", authorization: "Bearer tok" });
    const corpo = JSON.parse(opcoes.body as string) as { args: unknown[]; revisao: number };
    expect(corpo.revisao).toBe(7);
    expect(corpo.args[0]).toEqual({ $tipo: "Date", iso: "2026-01-01T00:00:00.000Z" });
    expect(corpo.args[1]).toBe("x");
  });

  it("(b) 200 vira tipo: diferenca com resultado/diferenca/revisao/revisaoAnterior", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaFalsa(200, { ok: true, value: { id: "cmt_1" }, diferenca: DIFERENCA_EXEMPLO, revisao: 8, revisaoAnterior: 7 }),
    );
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    const resposta = await transporte.gravar({
      chamadas: [{ nome: "addTaskComment", args: ["tsk_x", { content: "x" }] }],
      revisao: 7,
      copia: {} as DataState,
      resultado: { ok: true, value: undefined },
    });

    expect(resposta.tipo).toBe("diferenca");
    if (resposta.tipo !== "diferenca") throw new Error("esperava diferenca");
    expect(resposta.resultado).toEqual({ ok: true, value: { id: "cmt_1" } });
    expect(resposta.diferenca).toEqual(DIFERENCA_EXEMPLO);
    expect(resposta.revisao).toBe(8);
    expect(resposta.revisaoAnterior).toBe(7);
  });

  it("(c) 409 vira tipo: conflito", async () => {
    fetchMock.mockResolvedValueOnce(respostaFalsa(409, { ok: false, conflito: true, error: "Outra alteração entrou antes desta." }));
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    const resposta = await transporte.gravar({
      chamadas: [{ nome: "addTaskComment", args: ["tsk_x", { content: "x" }] }],
      revisao: 7,
      copia: {} as DataState,
      resultado: { ok: true, value: undefined },
    });

    expect(resposta).toEqual({ tipo: "conflito", erro: "Outra alteração entrou antes desta." });
  });

  it("(d) 401 vira tipo: falha com sessaoExpirada", async () => {
    fetchMock.mockResolvedValueOnce(respostaFalsa(401, { ok: false, error: "Sessão inválida." }));
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    const resposta = await transporte.gravar({
      chamadas: [{ nome: "addTaskComment", args: ["tsk_x", { content: "x" }] }],
      revisao: 7,
      copia: {} as DataState,
      resultado: { ok: true, value: undefined },
    });

    expect(resposta.tipo).toBe("falha");
    if (resposta.tipo !== "falha") throw new Error("esperava falha");
    expect(resposta.sessaoExpirada).toBe(true);
  });

  it("(e) exceção de rede vira tipo: falha", async () => {
    fetchMock.mockRejectedValueOnce(new Error("net down"));
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    const resposta = await transporte.gravar({
      chamadas: [{ nome: "addTaskComment", args: ["tsk_x", { content: "x" }] }],
      revisao: 7,
      copia: {} as DataState,
      resultado: { ok: true, value: undefined },
    });

    expect(resposta.tipo).toBe("falha");
  });

  it("(f) zero chamadas vira tipo: falha sem chamar fetch", async () => {
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    const resposta = await transporte.gravar({
      chamadas: [],
      revisao: 7,
      copia: {} as DataState,
      resultado: { ok: true, value: undefined },
    });

    expect(resposta.tipo).toBe("falha");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(g) duas chamadas disparam dois fetch em ordem", async () => {
    fetchMock
      .mockResolvedValueOnce(respostaFalsa(200, { ok: true, value: { id: "chat_1" }, diferenca: DIFERENCA_VAZIA, revisao: 8, revisaoAnterior: 7 }))
      .mockResolvedValueOnce(respostaFalsa(200, { ok: true, value: undefined, diferenca: DIFERENCA_VAZIA, revisao: 9, revisaoAnterior: 8 }));
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    const resposta = await transporte.gravar({
      chamadas: [
        { nome: "createChatSession", args: [{ title: "Pergunta" }] },
        { nome: "sendChatMessage", args: ["chat_1", "Pergunta"] },
      ],
      revisao: 7,
      copia: {} as DataState,
      resultado: { ok: true, value: { id: "chat_1" } },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("http://api/operacoes/createChatSession");
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe("http://api/operacoes/sendChatMessage");
    expect(resposta.tipo).toBe("diferenca");
    if (resposta.tipo !== "diferenca") throw new Error("esperava diferenca");
    expect(resposta.revisao).toBe(9);
  });

  it("(j) 500 sem corpo de erro usa a frase padrão", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error("sem corpo"); } } as unknown as Response);
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    const resposta = await transporte.gravar({
      chamadas: [{ nome: "addTaskComment", args: ["tsk_x", { content: "x" }] }],
      revisao: 7,
      copia: {} as DataState,
      resultado: { ok: true, value: undefined },
    });

    expect(resposta).toEqual({ tipo: "falha", erro: "O servidor não respondeu." });
  });
});

describe("transporteHttp — hidratar", () => {
  it("(h) 200 vira EstadoDoServidor com memberId de sessao.memberId", async () => {
    fetchMock.mockResolvedValueOnce(respostaFalsa(200, { data: { tasks: [] }, revisao: 3, ordens: { tasks: { tsk_x: 1 } }, sessao: { memberId: "mem_maryane" } }));
    const transporte = transporteHttp({ apiUrl: "http://api", obterToken: async () => "tok" });

    const r = await transporte.hidratar();

    if ("tipo" in r) throw new Error("esperava sucesso");
    expect(r.memberId).toBe("mem_maryane");
    expect(r.revisao).toBe(3);
    expect(r.ordens).toEqual({ tasks: { tsk_x: 1 } });
  });
});

describe("transporteEmMemoria", () => {
  it("(i) gravar devolve tipo: estado com data === copia, sem fetch", async () => {
    const transporte = transporteEmMemoria();
    const copia = { tasks: [] } as unknown as DataState;
    const resultado: OperationResult<unknown> = { ok: true, value: undefined };

    const resposta = await transporte.gravar({ chamadas: [], revisao: 5, copia, resultado });

    expect(resposta.tipo).toBe("estado");
    if (resposta.tipo !== "estado") throw new Error("esperava estado");
    expect(resposta.estado.data).toBe(copia);
    expect(resposta.estado.revisao).toBe(6);
    expect(resposta.resultado).toBe(resultado);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hidratar devolve falha — sem servidor nas rotas públicas", async () => {
    const transporte = transporteEmMemoria();
    const r = await transporte.hidratar();
    expect("tipo" in r && r.tipo === "falha").toBe(true);
  });
});
