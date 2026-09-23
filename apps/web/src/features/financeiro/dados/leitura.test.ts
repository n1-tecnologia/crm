/**
 * `lerDoFinanceiro` contra `fetch` e `clienteDoServidor` mockados — nenhuma
 * rede real, nenhum `apps/api` no ar. Prova os quatro desfechos da união
 * `Leitura<T>` e o bug que este plano fecha: nenhum caminho cai serenamente
 * para um valor vazio quando o backend financeiro recusa ou não responde.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `server-only` (a primeira linha de `leitura.ts`) sempre lança quando
 * importado fora do bundler do Next.js — em produção o webpack/turbopack do
 * Next troca esse módulo por um vazio nos bundles de servidor; o Vitest não
 * tem essa troca. Sem este mock, todo teste desta suíte falharia na
 * importação, não no comportamento. Nenhum outro arquivo `server-only` deste
 * repositório tinha teste antes deste plano.
 */
vi.mock("server-only", () => ({}));

const getSessionMock = vi.fn();

vi.mock("@/autenticacao/cliente-servidor", () => ({
  clienteDoServidor: vi.fn(async () => ({
    auth: { getSession: getSessionMock },
  })),
}));

import { lerDoFinanceiro } from "./leitura";

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
  getSessionMock.mockReset();
  delete process.env.API_URL;
  process.env.NEXT_PUBLIC_API_URL = "http://api";
});

describe("lerDoFinanceiro", () => {
  it("(a) 200 -> tipo ok, dados iguais ao corpo, lidoEm parseável como data", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(respostaFalsa(200, { metricas: [] }));

    const resultado = await lerDoFinanceiro<{ metricas: unknown[] }>("/financeiro/dashboard");

    expect(resultado.tipo).toBe("ok");
    if (resultado.tipo !== "ok") throw new Error("esperava ok");
    expect(resultado.dados).toEqual({ metricas: [] });
    expect(Number.isNaN(new Date(resultado.lidoEm).getTime())).toBe(false);
  });

  it("(b) 401 -> semSessao", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(respostaFalsa(401, {}));

    const resultado = await lerDoFinanceiro("/financeiro/dashboard");

    expect(resultado).toEqual({ tipo: "semSessao" });
  });

  it("(c) 403 -> semAcesso com o motivo vindo do corpo", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(respostaFalsa(403, { error: "Financeiro · sem acesso" }));

    const resultado = await lerDoFinanceiro("/financeiro/dashboard");

    expect(resultado).toEqual({ tipo: "semAcesso", motivo: "Financeiro · sem acesso" });
  });

  it("(d) 500 com { error } -> indisponivel com esse erro", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(respostaFalsa(500, { error: "Erro interno." }));

    const resultado = await lerDoFinanceiro("/financeiro/dashboard");

    expect(resultado).toEqual({ tipo: "indisponivel", erro: "Erro interno." });
  });

  it("(e) fetch que rejeita -> indisponivel, sem lançar", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: "tok" } } });
    fetchMock.mockRejectedValueOnce(new Error("net down"));

    const resultado = await lerDoFinanceiro("/financeiro/dashboard");

    expect(resultado.tipo).toBe("indisponivel");
  });

  it("(f) sessão sem token -> semSessao e fetch NÃO foi chamado", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });

    const resultado = await lerDoFinanceiro("/financeiro/dashboard");

    expect(resultado).toEqual({ tipo: "semSessao" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(g) query com undefined e com valor vazio não aparece na URL; valor com acento é codificado", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(respostaFalsa(200, {}));

    await lerDoFinanceiro("/financeiro/dashboard", { empresa: "São Paulo", vazio: "", ausente: undefined });

    const [url] = fetchMock.mock.calls[0] as [string];
    const esperado = new URLSearchParams();
    esperado.set("empresa", "São Paulo");
    expect(url).toBe(`http://api/financeiro/dashboard?${esperado.toString()}`);
    expect(url).not.toContain("vazio");
    expect(url).not.toContain("ausente");
  });

  it("(h) o cabeçalho authorization chega como Bearer <token> e cache é no-store", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: "tok-123" } } });
    fetchMock.mockResolvedValueOnce(respostaFalsa(200, {}));

    await lerDoFinanceiro("/financeiro/dashboard");

    const [, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(opcoes.headers).toEqual({ authorization: "Bearer tok-123" });
    expect(opcoes.cache).toBe("no-store");
  });
});
