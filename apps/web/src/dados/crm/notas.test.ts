// @vitest-environment jsdom
/**
 * 14-11 Task 1 — o cliente das Notas do Contato chama a rota certa de
 * `apps/api` (14-06), revalida só as notas daquele Contato no sucesso e deixa
 * a recusa subir como `ErroDeApi` com `status`, `codigo` e `campo`. Nenhuma
 * rede: `fetch` falso, sessão falsa.
 */

import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

// `invalidarCrm` é espiado; `chamarCrm`/`ErroDeApi` são os de verdade.
vi.mock("./cliente-crm", async (original) => {
  const real = await original<typeof import("./cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

import { ErroDeApi, invalidarCrm } from "./cliente-crm";
import { adicionarNotaAoContato, chaveDasNotas, useNotasDoContato } from "./notas";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  vi.mocked(invalidarCrm).mockClear();
});

afterEach(() => {
  cleanup();
});

const NOTA = { id: "n1", contatoId: "c1", conteudo: "oi", autorId: "mem_julia", criadoEm: "2026-10-01T10:00:00.000Z" };

describe("notas do Contato — o cliente da api", () => {
  it("(a) a chave das notas começa por /contatos/<id>/notas", () => {
    expect(chaveDasNotas("c1")).toBe("/contatos/c1/notas");
  });

  it("(a) adicionarNotaAoContato manda POST /contatos/c1/notas com { conteudo } e devolve a nota", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: NOTA }));
    const nota = await adicionarNotaAoContato("c1", "oi");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/contatos/c1/notas");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ conteudo: "oi" }));
    expect(nota).toEqual(NOTA);
  });

  it("(a) depois do sucesso, só as notas daquele Contato são revalidadas", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: NOTA }));
    await adicionarNotaAoContato("c1", "oi");
    expect(invalidarCrm).toHaveBeenCalledWith("/contatos/c1/notas");
  });

  it("(b) um 400 vira ErroDeApi com campo, e nada é revalidado", async () => {
    fetchMock.mockResolvedValueOnce(resposta(400, { ok: false, error: "Escreva a nota antes de salvar.", codigo: "VALOR_INVALIDO", campo: "conteudo" }));
    const erro = await adicionarNotaAoContato("c1", " ").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).status).toBe(400);
    expect((erro as ErroDeApi).campo).toBe("conteudo");
    expect(invalidarCrm).not.toHaveBeenCalled();
  });

  it("(b) um 409 do Contato mesclado chega com status e codigo", async () => {
    fetchMock.mockResolvedValueOnce(resposta(409, { ok: false, error: "Um Contato mesclado é somente leitura.", codigo: "NOTA_RECUSADA" }));
    const erro = (await adicionarNotaAoContato("c1", "oi").catch((e: unknown) => e)) as ErroDeApi;
    expect(erro.status).toBe(409);
    expect(erro.codigo).toBe("NOTA_RECUSADA");
  });

  it("(c) useNotasDoContato lê a lista da chave do Contato", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [NOTA], total: 1 }));
    const envoltorio = ({ children }: { readonly children: ReactNode }) =>
      createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
    const { result } = renderHook(() => useNotasDoContato("c1"), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual({ ok: true, itens: [NOTA], total: 1 }));
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("http://api/contatos/c1/notas");
  });
});
