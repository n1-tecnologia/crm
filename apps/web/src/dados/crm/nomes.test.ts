// @vitest-environment jsdom
/**
 * 15-10 — os nomes do CRM novo em lote (3.4.9 e 3.4.10, UCR-08): uma chamada por
 * lista de alvos, com chave estável (alvos únicos e ordenados) e cache SWR. Nenhuma
 * rede: `fetch` falso e sessão falsa.
 */

import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { NOMES_MAXIMO, type AlvoDoCrm } from "@n1/dominio/crm/nomes";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

import { ErroDeApi } from "./cliente-crm";
import { chaveDeNomes, nomeDe, useNomesDoCrm } from "./nomes";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

/** A api falsa: dá `Nome de <id>` a quem o id não começa por `fora-`, e `null` ao resto. */
function apiFalsa() {
  fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
    const { alvos } = JSON.parse(init.body) as { alvos: AlvoDoCrm[] };
    const itens = alvos.map((alvo) => ({ ...alvo, nome: alvo.id.startsWith("fora-") ? null : `Nome de ${alvo.id}` }));
    return resposta(200, { ok: true, itens, total: itens.length });
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

/** Cache novo por teste; `dedupingInterval` padrão, que é o que une dois componentes na mesma chamada. */
function comCache({ children }: { readonly children: ReactNode }) {
  return createElement(SWRConfig, { value: { provider: () => new Map() } }, children);
}

const contato = (id: string): AlvoDoCrm => ({ tipo: "contact", id });
const negocio = (id: string): AlvoDoCrm => ({ tipo: "deal", id });

describe("chaveDeNomes — a chave de SWR", () => {
  it("(a) começa pelo caminho e traz uma assinatura tipo:id por alvo, em ordem", () => {
    expect(chaveDeNomes([negocio("n1"), contato("c2"), contato("c1")])).toEqual(["/crm/nomes", "contact:c1", "contact:c2", "deal:n1"]);
  });

  it("(b) a mesma lista em outra ordem, ou com repetição, dá a mesma chave", () => {
    const a = chaveDeNomes([contato("c1"), negocio("n1"), contato("c2")]);
    const b = chaveDeNomes([contato("c2"), contato("c1"), negocio("n1"), contato("c1")]);
    expect(b).toEqual(a);
  });

  it("(c) o mesmo id em tipos diferentes são alvos diferentes", () => {
    expect(chaveDeNomes([contato("x"), negocio("x")])).toEqual(["/crm/nomes", "contact:x", "deal:x"]);
  });

  it("(d) lista vazia não tem chave: o SWR não busca", () => {
    expect(chaveDeNomes([])).toBeNull();
  });
});

describe("useNomesDoCrm", () => {
  it("(e) dois componentes que pedem os mesmos alvos em ordens diferentes fazem UMA chamada só", async () => {
    apiFalsa();
    function Lista({ alvos }: { readonly alvos: readonly AlvoDoCrm[] }) {
      const nomes = useNomesDoCrm(alvos);
      return createElement("span", null, alvos.map((a) => `${a.id}=${String(nomeDe(nomes, a.tipo, a.id))}`).join(","));
    }
    const { container } = render(
      createElement(
        comCache,
        null,
        createElement(Lista, { alvos: [contato("c1"), negocio("n1")] }),
        createElement(Lista, { alvos: [negocio("n1"), contato("c1")] }),
      ),
    );

    await waitFor(() => expect(container.textContent).toContain("c1=Nome de c1"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("(f) manda POST /crm/nomes com o JWT e só { alvos } no corpo, únicos e ordenados", async () => {
    apiFalsa();
    const { result } = renderHook(() => useNomesDoCrm([negocio("n1"), contato("c1"), contato("c1")]), { wrapper: comCache });
    await waitFor(() => expect(result.current.porAlvo.size).toBe(2));

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://api/crm/nomes");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ alvos: [contato("c1"), negocio("n1")] });
  });

  it("(g) nomeDe: o texto, null quando a api respondeu sem nome e undefined enquanto não chegou", async () => {
    apiFalsa();
    const { result } = renderHook(() => useNomesDoCrm([contato("c1"), contato("fora-1")]), { wrapper: comCache });

    expect(nomeDe(result.current, "contact", "c1")).toBeUndefined();
    expect(result.current.carregando).toBe(true);

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(nomeDe(result.current, "contact", "c1")).toBe("Nome de c1");
    expect(nomeDe(result.current, "contact", "fora-1")).toBeNull();
    // Um alvo que ninguém pediu continua "não sei", não "sem nome".
    expect(nomeDe(result.current, "contact", "outro")).toBeUndefined();
  });

  it("(h) lista vazia não vai à api", async () => {
    apiFalsa();
    const { result } = renderHook(() => useNomesDoCrm([]), { wrapper: comCache });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.carregando).toBe(false);
    expect(result.current.porAlvo.size).toBe(0);
  });

  it(`(i) mais de ${NOMES_MAXIMO} alvos vão em lotes de ${NOMES_MAXIMO}, e todos voltam`, async () => {
    apiFalsa();
    const alvos = Array.from({ length: NOMES_MAXIMO + 5 }, (_, i) => contato(`c-${String(i).padStart(4, "0")}`));
    const { result } = renderHook(() => useNomesDoCrm(alvos), { wrapper: comCache });
    await waitFor(() => expect(result.current.porAlvo.size).toBe(NOMES_MAXIMO + 5));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const tamanhos = fetchMock.mock.calls.map(([, init]) => (JSON.parse((init as { body: string }).body) as { alvos: unknown[] }).alvos.length);
    expect(tamanhos.sort((a, b) => b - a)).toEqual([NOMES_MAXIMO, 5]);
  });

  it("(j) a recusa da api (403 do Membro suspenso) vira erro e deixa o mapa vazio, sem repetir", async () => {
    fetchMock.mockResolvedValue(resposta(403, { ok: false, error: "Membro suspenso não grava.", codigo: "SUSPENSO" }));
    const { result } = renderHook(() => useNomesDoCrm([contato("c1")]), { wrapper: comCache });

    await waitFor(() => expect(result.current.erro).toBeInstanceOf(ErroDeApi));
    expect(result.current.erro?.status).toBe(403);
    expect(result.current.porAlvo.size).toBe(0);
    expect(nomeDe(result.current, "contact", "c1")).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
