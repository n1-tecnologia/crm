// @vitest-environment jsdom
/**
 * 16-08 (3.8.4, D-16-01, D-16-02, MSG-03) — o leitor SSE da tela. Nenhuma rede, nenhuma api: `fetch` falso devolvendo
 * um `ReadableStream`, sessão falsa e a invalidação do SWR trocada por um espião.
 */

import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { BATIDA_DO_FLUXO_MS, SILENCIO_MAXIMO_DO_FLUXO_MS } from "@n1/dominio/crm/eventos";

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

import {
  AcompanhanteDoTempoReal,
  chavesDoEvento,
  chavesDosEventos,
  criarConexaoDoTempoReal,
  ESPERA_MAXIMA_DE_RECONEXAO_MS,
  INTERVALO_SEM_TEMPO_REAL_MS,
  JANELA_DE_AGRUPAMENTO_MS,
  lerQuadrosSse,
  type OpcoesDaConexao,
} from "./tempo-real";

const QUADRO_NOVA = 'data: {"tipo":"mensagem.nova","conversaId":"c1","mensagemId":"m1"}\n\n';

/** Um fluxo que o teste alimenta aos poucos (`enviar`) e fecha (`fechar`), como o servidor faria. */
function fluxoControlado(): { corpo: ReadableStream<Uint8Array>; enviar(texto: string): void; fechar(): void } {
  const codificador = new TextEncoder();
  let controle!: ReadableStreamDefaultController<Uint8Array>;
  const corpo = new ReadableStream<Uint8Array>({
    start(c) {
      controle = c;
    },
  });
  return { corpo, enviar: (texto) => controle.enqueue(codificador.encode(texto)), fechar: () => controle.close() };
}

function respostaAberta(corpo: ReadableStream<Uint8Array>): Response {
  return { ok: true, status: 200, body: corpo } as Response;
}

function respostaDeErro(status: number): Response {
  return { ok: false, status, body: null } as Response;
}

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

    render(createElement(AcompanhanteDoTempoReal, { ativo: true }));

    await waitFor(() => expect(invalidarCrmComArrays).toHaveBeenCalledWith("/mensagens?conversaId=c1"), { timeout: 2000 });
    expect(invalidarCrmComArrays).toHaveBeenCalledWith("/conversas");
    expect(invalidarCrmComArrays).toHaveBeenCalledWith("/tarefas-conversacionais/resumo");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/eventos");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(url).not.toContain("tok");
  });
});

describe("criarConexaoDoTempoReal — reconexão, releitura de 5 s e rajada (3.8.4)", () => {
  let fetchImpl: ReturnType<typeof vi.fn>;
  let obterToken: ReturnType<typeof vi.fn>;
  let aoEventos: ReturnType<typeof vi.fn>;
  let aoReler: ReturnType<typeof vi.fn>;
  let aoAbrir: ReturnType<typeof vi.fn>;
  let aoCair: ReturnType<typeof vi.fn>;
  const conexoes: Array<{ parar(): void }> = [];

  function ligar(extra: Partial<OpcoesDaConexao> = {}): { parar(): void } {
    const conexao = criarConexaoDoTempoReal({
      urlBase: "http://api",
      obterToken: obterToken as unknown as OpcoesDaConexao["obterToken"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      aoEventos: aoEventos as unknown as OpcoesDaConexao["aoEventos"],
      aoReler: aoReler as unknown as OpcoesDaConexao["aoReler"],
      aoAbrir: aoAbrir as unknown as OpcoesDaConexao["aoAbrir"],
      aoCair: aoCair as unknown as OpcoesDaConexao["aoCair"],
      ...extra,
    });
    conexoes.push(conexao);
    return conexao;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    fetchImpl = vi.fn();
    obterToken = vi.fn(async () => "tok");
    aoEventos = vi.fn();
    aoReler = vi.fn();
    aoAbrir = vi.fn();
    aoCair = vi.fn();
  });

  afterEach(() => {
    for (const conexao of conexoes.splice(0)) conexao.parar();
    vi.useRealTimers();
  });

  it("fetch que rejeita: novas tentativas em 1 s, 2 s, 4 s, 8 s, 16 s, 30 s e 30 s", async () => {
    fetchImpl.mockRejectedValue(new TypeError("Failed to fetch"));
    ligar();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const esperas = [1_000, 2_000, 4_000, 8_000, 16_000, ESPERA_MAXIMA_DE_RECONEXAO_MS, ESPERA_MAXIMA_DE_RECONEXAO_MS];
    let chamadas = 1;
    for (const espera of esperas) {
      await vi.advanceTimersByTimeAsync(espera - 1);
      expect(fetchImpl).toHaveBeenCalledTimes(chamadas);
      await vi.advanceTimersByTimeAsync(1);
      chamadas += 1;
      expect(fetchImpl).toHaveBeenCalledTimes(chamadas);
    }
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it("sem conexão, a cada 5 s a releitura completa roda; antes dos 5 s, não", async () => {
    fetchImpl.mockRejectedValue(new TypeError("Failed to fetch"));
    ligar();
    await vi.advanceTimersByTimeAsync(INTERVALO_SEM_TEMPO_REAL_MS - 1);
    expect(aoReler).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(aoReler).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVALO_SEM_TEMPO_REAL_MS);
    expect(aoReler).toHaveBeenCalledTimes(2);
    expect(aoCair).toHaveBeenCalledTimes(1); // aviso por episódio, não por tentativa
  });

  it("a conexão que abre relê tudo uma vez, para a releitura de 5 s e a espera volta a 1 s", async () => {
    const fluxo = fluxoControlado();
    fetchImpl
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(respostaAberta(fluxo.corpo))
      .mockRejectedValue(new TypeError("Failed to fetch"));
    ligar();
    await vi.advanceTimersByTimeAsync(3_000); // t=0, 1 s e 3 s: a terceira tentativa abre
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    fluxo.enviar(": aberto\n\n");
    await vi.advanceTimersByTimeAsync(0);
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoReler).toHaveBeenCalledTimes(1);

    // aberta por 60 s, com a batida do servidor a cada 20 s (sem ela o relógio de silêncio, corretamente, derrubaria): nenhuma releitura de 5 s
    for (let i = 0; i < 3; i += 1) {
      await vi.advanceTimersByTimeAsync(20_000);
      fluxo.enviar(": batida\n\n");
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(aoReler).toHaveBeenCalledTimes(1);

    fluxo.fechar(); // o servidor fecha: cai e volta a tentar em 1 s (a espera foi zerada)
    await vi.advanceTimersByTimeAsync(0);
    expect(aoCair).toHaveBeenCalledTimes(2); // uma por episódio: as duas tentativas que falharam e a queda depois de aberta
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("503 conta como queda: releitura de 5 s e nova tentativa com espera crescente", async () => {
    fetchImpl.mockResolvedValue(respostaDeErro(503));
    ligar();
    await vi.advanceTimersByTimeAsync(0);
    expect(aoCair).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(aoReler).toHaveBeenCalledTimes(1);
  });

  it("401: a tentativa seguinte pede o token de novo e manda o renovado", async () => {
    obterToken.mockResolvedValueOnce("vencido").mockResolvedValue("renovado");
    fetchImpl.mockResolvedValueOnce(respostaDeErro(401)).mockResolvedValue(respostaAberta(fluxoControlado().corpo));
    ligar();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(obterToken).toHaveBeenCalledTimes(2);
    const cabecalhos = fetchImpl.mock.calls.map((c) => ((c[1] as RequestInit).headers as Record<string, string>).authorization);
    expect(cabecalhos).toEqual(["Bearer vencido", "Bearer renovado"]);
  });

  it("sem sessão (token indefinido) o fetch não é chamado e a tentativa se repete depois da espera", async () => {
    obterToken.mockResolvedValue(undefined);
    ligar();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(obterToken).toHaveBeenCalledTimes(2);

    obterToken.mockResolvedValue("tok");
    fetchImpl.mockResolvedValue(respostaAberta(fluxoControlado().corpo));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("obterToken que lança não derruba nada: é queda como qualquer outra", async () => {
    obterToken.mockRejectedValue(new Error("sessão indisponível"));
    ligar();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(obterToken).toHaveBeenCalledTimes(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("dez eventos em 100 ms viram uma rodada só, com os dez, depois da janela de 300 ms", async () => {
    const fluxo = fluxoControlado();
    fetchImpl.mockResolvedValue(respostaAberta(fluxo.corpo));
    ligar();
    await vi.advanceTimersByTimeAsync(0);
    fluxo.enviar(": aberto\n\n");
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 10; i += 1) {
      fluxo.enviar(`data: {"tipo":"mensagem.nova","conversaId":"c1","mensagemId":"m${i}"}\n\n`);
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(aoEventos).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(JANELA_DE_AGRUPAMENTO_MS);
    expect(aoEventos).toHaveBeenCalledTimes(1);
    expect(aoEventos.mock.calls[0]![0]).toHaveLength(10);
    // as chaves unidas não repetem (T-16-30): dez eventos da mesma Conversa são três chaves
    expect(chavesDosEventos(aoEventos.mock.calls[0]![0] as never)).toEqual([
      "/mensagens?conversaId=c1",
      "/conversas",
      "/tarefas-conversacionais/resumo",
    ]);
  });

  it("WR-08: o fluxo aberto que fica 60 s sem nenhum byte cai, religa a releitura de 5 s e reconecta", async () => {
    const fluxo = fluxoControlado();
    fetchImpl.mockResolvedValueOnce(respostaAberta(fluxo.corpo)).mockRejectedValue(new TypeError("Failed to fetch"));
    ligar();
    await vi.advanceTimersByTimeAsync(0);
    fluxo.enviar(": aberto\n\n");
    await vi.advanceTimersByTimeAsync(0);
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoReler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_DO_FLUXO_MS - 1);
    expect(aoCair).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(aoCair).toHaveBeenCalledTimes(1);
    const sinal = (fetchImpl.mock.calls[0]![1] as RequestInit).signal as AbortSignal;
    expect(sinal.aborted).toBe(true);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // a espera da reconexão ainda não acabou
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // a aba reconectou depois de 1 s
    await vi.advanceTimersByTimeAsync(INTERVALO_SEM_TEMPO_REAL_MS - 1_000);
    expect(aoReler).toHaveBeenCalledTimes(2); // e a releitura de 5 s voltou
  });

  it("WR-08: com a batida do servidor a cada 25 s por 3 min a conexão nunca cai e só há um fetch", async () => {
    const fluxo = fluxoControlado();
    fetchImpl.mockResolvedValue(respostaAberta(fluxo.corpo));
    ligar();
    await vi.advanceTimersByTimeAsync(0);
    fluxo.enviar(": aberto\n\n");
    await vi.advanceTimersByTimeAsync(0);
    for (let decorrido = 0; decorrido < 180_000; decorrido += BATIDA_DO_FLUXO_MS) {
      await vi.advanceTimersByTimeAsync(BATIDA_DO_FLUXO_MS);
      fluxo.enviar(": batida\n\n");
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(aoCair).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("WR-08: o fetch que nunca responde é abortado em 60 s e conta como queda", async () => {
    fetchImpl.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolver, rejeitar) => {
          init.signal!.addEventListener("abort", () => rejeitar(new DOMException("aborted", "AbortError")));
        }),
    );
    ligar();
    await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_DO_FLUXO_MS - 1);
    expect(aoCair).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(aoCair).toHaveBeenCalledTimes(1);
    expect(((fetchImpl.mock.calls[0]![1] as RequestInit).signal as AbortSignal).aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("parar() aborta o fetch, limpa os temporizadores e não agenda mais nada", async () => {
    fetchImpl.mockRejectedValue(new TypeError("Failed to fetch"));
    const conexao = ligar();
    await vi.advanceTimersByTimeAsync(1_500);
    const chamadas = fetchImpl.mock.calls.length;
    const reler = aoReler.mock.calls.length;
    const sinal = (fetchImpl.mock.calls[0]![1] as RequestInit).signal as AbortSignal;
    conexao.parar();
    expect(sinal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchImpl).toHaveBeenCalledTimes(chamadas);
    expect(aoReler).toHaveBeenCalledTimes(reler);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("parar() com eventos esperando a janela não os entrega", async () => {
    const fluxo = fluxoControlado();
    fetchImpl.mockResolvedValue(respostaAberta(fluxo.corpo));
    const conexao = ligar();
    await vi.advanceTimersByTimeAsync(0);
    fluxo.enviar(": aberto\n\n" + QUADRO_NOVA);
    await vi.advanceTimersByTimeAsync(100);
    conexao.parar();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(aoEventos).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("AcompanhanteDoTempoReal — D-16-02 e a sessão", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api";
    obterSessao.mockReset();
    obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    invalidarCrmComArrays.mockClear();
  });

  it("a chegada de uma Mensagem não dispara notificação, som nem muda o título da aba", async () => {
    const Notificacao = vi.fn();
    const Som = vi.fn();
    vi.stubGlobal("Notification", Notificacao);
    vi.stubGlobal("Audio", Som);
    document.title = "N1";
    const fetchMock = vi.fn().mockResolvedValue(respostaAberta(fluxoDe(": aberto\n\n", QUADRO_NOVA).corpo));
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(AcompanhanteDoTempoReal, { ativo: true }));
    await waitFor(() => expect(invalidarCrmComArrays).toHaveBeenCalledWith("/conversas"), { timeout: 2000 });

    expect(Notificacao).not.toHaveBeenCalled();
    expect(Som).not.toHaveBeenCalled();
    expect(document.title).toBe("N1");
    vi.unstubAllGlobals();
  });

  it("sem sessão a conexão não abre", async () => {
    obterSessao.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(AcompanhanteDoTempoReal, { ativo: true }));
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("desmontar aborta o fetch (a saída da sessão derruba o fluxo)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaAberta(fluxoControlado().corpo));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(createElement(AcompanhanteDoTempoReal, { ativo: true }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const sinal = (fetchMock.mock.calls[0]![1] as RequestInit).signal as AbortSignal;
    expect(sinal.aborted).toBe(false);
    unmount();
    expect(sinal.aborted).toBe(true);
    vi.unstubAllGlobals();
  });

  it("sob o Vitest, sem `ativo`, o acompanhante não abre conexão (os testes de tela que contam fetch não mudam)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(AcompanhanteDoTempoReal));
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(obterSessao).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
