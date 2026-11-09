// @vitest-environment jsdom
/**
 * 16-08 (3.8.4, D-16-01, D-16-02, MSG-03) — o leitor SSE da tela. Nenhuma rede, nenhuma api: `fetch` falso devolvendo
 * um `ReadableStream`, sessão falsa e a invalidação do SWR trocada por um espião.
 */

import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const { obterSessao, invalidarCrmComArrays } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  invalidarCrmComArrays: vi.fn(async () => undefined),
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("./crm/cliente-crm", async (original) => {
  const real = await original<typeof import("./crm/cliente-crm")>();
  return { ...real, invalidarCrmComArrays };
});

import { AcompanhanteDoTempoReal, chavesDoEvento, lerQuadrosSse } from "./tempo-real";

const QUADRO_NOVA = 'data: {"tipo":"mensagem.nova","conversaId":"c1","mensagemId":"m1"}\n\n';

function fluxoDe(...pedacos: string[]): { corpo: ReadableStream<Uint8Array>; fechar(): void } {
  const codificador = new TextEncoder();
  let controle!: ReadableStreamDefaultController<Uint8Array>;
  const corpo = new ReadableStream<Uint8Array>({
    start(c) {
      controle = c;
      for (const pedaco of pedacos) c.enqueue(codificador.encode(pedaco));
    },
  });
  return { corpo, fechar: () => controle.close() };
}

afterEach(() => cleanup());

describe("lerQuadrosSse", () => {
  it("um quadro cortado no meio fica no resto e o pedaço seguinte o completa", () => {
    const primeiro = lerQuadrosSse("", ': aberto\n\n' + QUADRO_NOVA + 'data: {"tipo":');
    expect(primeiro.eventos).toEqual([{ tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" }]);
    expect(primeiro.resto).toBe('data: {"tipo":');

    const segundo = lerQuadrosSse(primeiro.resto, '"conversa.mudou","conversaId":"c2"}\n\n');
    expect(segundo.eventos).toEqual([{ tipo: "conversa.mudou", conversaId: "c2" }]);
    expect(segundo.resto).toBe("");
  });

  it("ignora comentário, JSON inválido e evento com campo a mais", () => {
    const { eventos } = lerQuadrosSse(
      "",
      ": batida\n\n" +
        "data: nao-e-json\n\n" +
        'data: {"tipo":"mensagem.nova","conversaId":"c1","texto":"oi"}\n\n' +
        'data: {"tipo":"desconhecido","conversaId":"c1"}\n\n' +
        QUADRO_NOVA,
    );
    expect(eventos).toEqual([{ tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" }]);
  });
});

describe("chavesDoEvento (D-16-02)", () => {
  it("mensagem.nova revalida o fio, a lista e o resumo das Tarefas", () => {
    expect(chavesDoEvento({ tipo: "mensagem.nova", conversaId: "c1" })).toEqual([
      "/mensagens?conversaId=c1",
      "/conversas",
      "/tarefas-conversacionais/resumo",
    ]);
  });

  it("mensagem.status revalida o fio e o resumo; conversa.mudou, a lista e o resumo", () => {
    expect(chavesDoEvento({ tipo: "mensagem.status", conversaId: "c1", mensagemId: "m1" })).toEqual([
      "/mensagens?conversaId=c1",
      "/tarefas-conversacionais/resumo",
    ]);
    expect(chavesDoEvento({ tipo: "conversa.mudou", conversaId: "c1" })).toEqual(["/conversas", "/tarefas-conversacionais/resumo"]);
  });
});

describe("AcompanhanteDoTempoReal (traçador)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    obterSessao.mockReset();
    obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    invalidarCrmComArrays.mockClear();
  });

  it("um mensagem.nova no fluxo revalida o fio da Conversa, a lista da Caixa e o resumo das Tarefas, com o token só no cabeçalho", async () => {
    const { corpo } = fluxoDe(": aberto\n\n", QUADRO_NOVA);
    fetchMock.mockResolvedValue({ ok: true, status: 200, body: corpo } as Response);

    render(createElement(AcompanhanteDoTempoReal));

    await waitFor(() => expect(invalidarCrmComArrays).toHaveBeenCalledWith("/mensagens?conversaId=c1"), { timeout: 2000 });
    expect(invalidarCrmComArrays).toHaveBeenCalledWith("/conversas");
    expect(invalidarCrmComArrays).toHaveBeenCalledWith("/tarefas-conversacionais/resumo");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/eventos");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(url).not.toContain("tok");
  });
});
