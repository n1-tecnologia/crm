/**
 * `cliente.ts` — testes puros, sem rede: só a FORMA do request/response e as
 * duas garantias de segurança da fase (token fora de qualquer saída;
 * `Authorization` só para hosts do ClickUp). Fixtures de corpo no formato de
 * developer.clickup.com/reference/gettasks (ids/nomes fictícios); o token de
 * teste é uma string inventada, nunca um token real (D-02).
 */

import { describe, expect, it, vi } from "vitest";
import { BASE_URL, ErroClickUp, TETO_DE_TENTATIVAS, criarClienteClickUp, hostPermitido } from "./cliente";

const TOKEN_DE_TESTE = "pk_teste_nunca_real";

function respostaFalsa(corpo: string, opcoes: { readonly status?: number; readonly headers?: Record<string, string> } = {}): Response {
  return new Response(corpo, { status: opcoes.status ?? 200, headers: opcoes.headers });
}

function filaDeFetch(respostas: readonly Response[]) {
  let indice = 0;
  const fetchFalso = vi.fn(async (_input: URL | string, _init?: RequestInit) => {
    const resposta = respostas[indice];
    indice += 1;
    if (!resposta) throw new Error("fila de respostas esgotada no teste");
    return resposta;
  });
  return fetchFalso;
}

describe("cliente ClickUp — auth, 429 e token fora de qualquer saída", () => {
  it("(a) get monta a URL a partir de BASE_URL + caminho + querystring, com Authorization sem Bearer e Accept: application/json", async () => {
    const fetchFalso = filaDeFetch([respostaFalsa('{"tasks":[]}')]);
    const cliente = criarClienteClickUp({ token: TOKEN_DE_TESTE, fetch: fetchFalso as unknown as typeof fetch });

    await cliente.get("/list/1/task", { page: "0" });

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE_URL}/list/1/task?page=0`);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(TOKEN_DE_TESTE);
    expect(headers.Authorization!.startsWith("Bearer")).toBe(false);
    expect(headers.Accept).toBe("application/json");
  });

  it("(b) 429 com X-RateLimit-Reset espera max(1000, reset*1000 - agora + 250) e repete a MESMA chamada", async () => {
    const agoraFixo = 1_700_000_000_000;
    const resetEpochSegundos = Math.floor(agoraFixo / 1000) + 10;
    const fetchFalso = filaDeFetch([
      respostaFalsa("", { status: 429, headers: { "X-RateLimit-Reset": String(resetEpochSegundos) } }),
      respostaFalsa('{"tasks":[],"last_page":true}'),
    ]);
    const dormirFalso = vi.fn(async (_ms: number) => {});
    const cliente = criarClienteClickUp({
      token: TOKEN_DE_TESTE,
      fetch: fetchFalso as unknown as typeof fetch,
      dormir: dormirFalso,
      agora: () => agoraFixo,
    });

    const resposta = await cliente.get("/list/1/task");

    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(dormirFalso).toHaveBeenCalledTimes(1);
    const esperaEsperada = Math.max(1000, resetEpochSegundos * 1000 - agoraFixo + 250);
    expect(dormirFalso).toHaveBeenCalledWith(esperaEsperada);
    expect(resposta.status).toBe(200);
  });

  it("(c) 429 repetido TETO_DE_TENTATIVAS vezes desiste com ErroClickUp status 429 e o caminho pedido", async () => {
    const respostas429 = Array.from({ length: TETO_DE_TENTATIVAS }, () =>
      respostaFalsa("", { status: 429, headers: { "X-RateLimit-Reset": "0" } }),
    );
    const fetchFalso = filaDeFetch(respostas429);
    const dormirFalso = vi.fn(async (_ms: number) => {});
    const cliente = criarClienteClickUp({
      token: TOKEN_DE_TESTE,
      fetch: fetchFalso as unknown as typeof fetch,
      dormir: dormirFalso,
      agora: () => 1_700_000_000_000,
    });

    let erroCapturado: unknown;
    try {
      await cliente.get("/list/1/task");
    } catch (erro) {
      erroCapturado = erro;
    }

    expect(erroCapturado).toBeInstanceOf(ErroClickUp);
    expect(erroCapturado).toMatchObject({ status: 429, caminho: "/list/1/task" });
    expect(fetchFalso).toHaveBeenCalledTimes(TETO_DE_TENTATIVAS);
  });

  it("(d) 401 lança ErroClickUp cujo status é 401, cuja mensagem não contém o token e nenhum console.* recebe o token", async () => {
    const corpoDeErro = '{"err":"Oauth token not found","ECODE":"OAUTH_019"}';
    const fetchFalso = filaDeFetch([respostaFalsa(corpoDeErro, { status: 401 })]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cliente = criarClienteClickUp({ token: TOKEN_DE_TESTE, fetch: fetchFalso as unknown as typeof fetch });

    let erroCapturado: unknown;
    try {
      await cliente.get("/list/1/task");
    } catch (erro) {
      erroCapturado = erro;
    }

    expect(erroCapturado).toBeInstanceOf(ErroClickUp);
    const erro = erroCapturado as ErroClickUp;
    expect(erro.status).toBe(401);
    expect(erro.message).not.toContain(TOKEN_DE_TESTE);
    expect(erro.message).toContain("/list/1/task");

    for (const spy of [logSpy, warnSpy, errorSpy]) {
      for (const chamada of spy.mock.calls) {
        expect(chamada.map(String).join(" ")).not.toContain(TOKEN_DE_TESTE);
      }
    }
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("(e) corpoCru é o texto exato da resposta (não reserializado); json é o parse desse texto", async () => {
    const corpoOriginal = '{"tasks": [ ],  "last_page":true }';
    const fetchFalso = filaDeFetch([respostaFalsa(corpoOriginal)]);
    const cliente = criarClienteClickUp({ token: TOKEN_DE_TESTE, fetch: fetchFalso as unknown as typeof fetch });

    const resposta = await cliente.get("/list/1/task");

    expect(resposta.corpoCru).toBe(corpoOriginal);
    expect(resposta.json).toEqual({ tasks: [], last_page: true });
  });

  it("(f) hostPermitido exige sufixo com ponto; baixar recusa host fora da allowlist sem chamar fetch", async () => {
    expect(hostPermitido("https://t9011731314.p.clickup-attachments.com/x")).toBe(true);
    expect(hostPermitido("https://attacker.example.com/x")).toBe(false);
    expect(hostPermitido("https://evil-clickup.com/x")).toBe(false);

    const fetchFalso = filaDeFetch([]);
    const cliente = criarClienteClickUp({ token: TOKEN_DE_TESTE, fetch: fetchFalso as unknown as typeof fetch });

    await expect(cliente.baixar("https://attacker.example.com/x")).rejects.toBeInstanceOf(ErroClickUp);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("(g) X-RateLimit-Remaining: 0 faz a chamada SEGUINTE esperar antes do fetch (pacing)", async () => {
    const agoraFixo = 1_700_000_000_000;
    const resetFuturoSegundos = Math.floor(agoraFixo / 1000) + 5;
    const fetchFalso = filaDeFetch([
      respostaFalsa('{"tasks":[]}', {
        headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(resetFuturoSegundos) },
      }),
      respostaFalsa('{"tasks":[]}'),
    ]);
    const dormirFalso = vi.fn(async (_ms: number) => {});
    const cliente = criarClienteClickUp({
      token: TOKEN_DE_TESTE,
      fetch: fetchFalso as unknown as typeof fetch,
      dormir: dormirFalso,
      agora: () => agoraFixo,
    });

    await cliente.get("/list/1/task");
    expect(dormirFalso).not.toHaveBeenCalled();

    await cliente.get("/list/1/task");
    expect(dormirFalso).toHaveBeenCalledTimes(1);
    expect(dormirFalso).toHaveBeenCalledWith(resetFuturoSegundos * 1000 - agoraFixo);
  });
});
