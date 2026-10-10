/**
 * O cliente HTTP do CRM contra um `fetch` falso — nenhuma rede, nenhum
 * `apps/api` no ar. É a prova de T-07-07 (07-01): o token só vai no cabeçalho
 * `authorization`, `content-type` só sai com corpo (um DELETE sem corpo com
 * esse cabeçalho vira 400 no Fastify 5, Pitfall 4), a recusa 409 chega à tela
 * com `codigo` e `bloqueios`, e sem sessão o `fetch` nem é chamado.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

import { chamarCrm, ErroDeApi } from "./cliente-crm";

function respostaFalsa(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("chamarCrm — cabeçalhos", () => {
  it("(f) manda authorization: Bearer com o token da sessão, para a URL da api", async () => {
    fetchMock.mockResolvedValueOnce(respostaFalsa(200, { ok: true, itens: [], total: 0 }));
    await chamarCrm("/contatos");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/contatos");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(init.method).toBe("GET");
  });

  it("(f) DELETE sem corpo vai SEM content-type e sem body", async () => {
    fetchMock.mockResolvedValueOnce(respostaFalsa(200, { ok: true }));
    await chamarCrm("/contatos/c1", { method: "DELETE" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain("content-type");
    expect(init.body).toBeUndefined();
  });

  it("(f) POST com corpo vai com content-type: application/json e o corpo serializado", async () => {
    fetchMock.mockResolvedValueOnce(respostaFalsa(201, { ok: true, dados: {} }));
    await chamarCrm("/contatos", { method: "POST", corpo: { nome: "Ana" } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ nome: "Ana" }));
  });
});

describe("chamarCrm — falhas", () => {
  it("(f) 409 { ok: false, error, codigo, bloqueios } vira ErroDeApi com os três campos", async () => {
    const bloqueios = { negociosAbertos: 2 };
    fetchMock.mockResolvedValueOnce(
      respostaFalsa(409, { ok: false, error: "Tem Negócio aberto.", codigo: "TEM_BLOQUEIO", bloqueios }),
    );
    const erro = await chamarCrm("/contatos/c1", { method: "DELETE" }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    const e = erro as ErroDeApi;
    expect(e.status).toBe(409);
    expect(e.message).toBe("Tem Negócio aberto.");
    expect(e.codigo).toBe("TEM_BLOQUEIO");
    expect(e.bloqueios).toEqual(bloqueios);
  });

  it("(f) sem sessão: ErroDeApi 401 e o fetch nunca é chamado", async () => {
    obterSessao.mockResolvedValue({ data: { session: null } });
    const erro = await chamarCrm("/contatos").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(f) fetch rejeitado: status 0 e \"Sem conexão com o servidor.\"", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const erro = await chamarCrm("/contatos").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).status).toBe(0);
    expect((erro as ErroDeApi).message).toBe("Sem conexão com o servidor.");
  });

  it("(f) resposta de erro sem JSON cai na mensagem genérica, com o status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("sem json");
      },
    } as unknown as Response);
    const erro = (await chamarCrm("/contatos").catch((e: unknown) => e)) as ErroDeApi;
    expect(erro.status).toBe(502);
    expect(erro.message).toBe("O servidor não respondeu.");
  });
});
