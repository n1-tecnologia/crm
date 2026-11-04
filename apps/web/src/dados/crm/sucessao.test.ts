// @vitest-environment jsdom
/**
 * 14-16 Task 3 — a prévia da sucessão nas tabelas (3.2.8, lado web): o hook lê
 * `GET /membros/:id/sucessao-no-crm`, não lê nada sem Membro, deixa a recusa da
 * api em `error` sem tentar de novo, e `invalidarCrmDaSucessao` revalida o que a
 * remoção moveu. Nenhuma rede: `fetch` falso, sessão falsa.
 */

import type { ReactNode } from "react";
import { createElement } from "react";
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
import { chaveDaSucessao, invalidarCrmDaSucessao, useSucessaoNoCrm } from "./sucessao";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

const envoltorio = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

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

describe("useSucessaoNoCrm", () => {
  it("lê GET /membros/:id/sucessao-no-crm e devolve as quatro contagens", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { contatos: 3, empresas: 1, negocios: 2, conversasLiberadas: 4 } }));
    const { result } = renderHook(() => useSucessaoNoCrm("mem_9"), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual({ contatos: 3, empresas: 1, negocios: 2, conversasLiberadas: 4 }));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/membros/mem_9/sucessao-no-crm");
    expect(init.method).toBe("GET");
    expect(chaveDaSucessao("mem_9")).toBe("/membros/mem_9/sucessao-no-crm");
  });

  it("sem Membro em remoção não vai à api", () => {
    renderHook(() => useSucessaoNoCrm(undefined), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a recusa da api (403) fica em `error` com a mensagem dela e não é repetida", async () => {
    fetchMock.mockResolvedValue(resposta(403, { ok: false, error: "Só um Administrador ou o Proprietário ativo vê a sucessão de um Membro.", codigo: "PERMISSAO" }));
    const { result } = renderHook(() => useSucessaoNoCrm("mem_9"), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ErroDeApi));
    expect(result.current.error?.message).toBe("Só um Administrador ou o Proprietário ativo vê a sucessão de um Membro.");
    expect(result.current.data).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("invalidarCrmDaSucessao", () => {
  it("revalida Contatos, Empresas, Negócios e Conversas", async () => {
    await invalidarCrmDaSucessao();
    expect(vi.mocked(invalidarCrm).mock.calls.map(([prefixo]) => prefixo).sort()).toEqual(["/contatos", "/conversas", "/empresas", "/negocios"]);
  });
});
