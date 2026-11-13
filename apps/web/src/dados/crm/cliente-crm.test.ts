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

vi.mock("swr", () => ({ mutate: vi.fn(async () => undefined) }));

import { mutate } from "swr";
import { chamarCrm, ErroDeApi, invalidarCrm, invalidarCrmComArrays } from "./cliente-crm";

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

  it("(f) 409 JANELA_EXPIRADA com `modelos` (7.3): o ErroDeApi os carrega para a tela oferecer; sem eles, `modelos` é undefined", async () => {
    const modelos = [{ id: "m1", nome: "pedido_saiu", enviavel: true }];
    fetchMock.mockResolvedValueOnce(respostaFalsa(409, { ok: false, error: "A janela expirou.", codigo: "JANELA_EXPIRADA", campo: "modelo", modelos }));
    const erro = (await chamarCrm("/mensagens", { method: "POST", corpo: {} }).catch((e: unknown) => e)) as ErroDeApi;
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.codigo).toBe("JANELA_EXPIRADA");
    expect(erro.campo).toBe("modelo");
    expect(erro.modelos).toEqual(modelos);

    fetchMock.mockResolvedValueOnce(respostaFalsa(409, { ok: false, error: "Tem Negócio aberto.", codigo: "TEM_BLOQUEIO" }));
    const semModelos = (await chamarCrm("/contatos/c1", { method: "DELETE" }).catch((e: unknown) => e)) as ErroDeApi;
    expect(semModelos.modelos).toBeUndefined();
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

/** A função que o `mutate` recebeu: o filtro de chaves que decide o que revalida. */
function filtroDoUltimoMutate(): (chave: unknown) => boolean {
  const chamadas = vi.mocked(mutate).mock.calls;
  return chamadas[chamadas.length - 1]![0] as unknown as (chave: unknown) => boolean;
}

describe("invalidarCrmComArrays (16-08, Pitfall 4)", () => {
  it("revalida a chave array cujo primeiro item começa pelo prefixo e a chave de texto", async () => {
    await invalidarCrmComArrays("/tarefas-conversacionais/resumo");
    const filtro = filtroDoUltimoMutate();
    expect(filtro(["/tarefas-conversacionais/resumo", "t1:c1"])).toBe(true);
    expect(filtro("/tarefas-conversacionais/resumo")).toBe(true);
  });

  it("não revalida chave array de outro prefixo nem chave que não é texto nem array", async () => {
    await invalidarCrmComArrays("/tarefas-conversacionais/resumo");
    const filtro = filtroDoUltimoMutate();
    expect(filtro(["/outra", "x"])).toBe(false);
    expect(filtro("/conversas")).toBe(false);
    expect(filtro([1, "x"])).toBe(false);
    expect(filtro(undefined)).toBe(false);
  });

  it("invalidarCrm continua sem casar chave array (os chamadores de hoje não mudam)", async () => {
    await invalidarCrm("/tarefas-conversacionais");
    const filtro = filtroDoUltimoMutate();
    expect(filtro(["/tarefas-conversacionais/resumo", "t1:c1"])).toBe(false);
    expect(filtro("/tarefas-conversacionais/resumo")).toBe(true);
  });
});
