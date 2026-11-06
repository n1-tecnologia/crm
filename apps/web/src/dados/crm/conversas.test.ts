// @vitest-environment jsdom
/**
 * 15-06 Task 1 — os hooks e as mutações de Conversa falam com as rotas de
 * `apps/api` (`/conversas`) por HTTP, na chave de SWR de ordem fixa, e
 * invalidam só no sucesso (D-04). Nenhuma rede: `fetch` falso e sessão falsa.
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
import {
  abrirConversa,
  atribuirConversa,
  chaveDaConversa,
  chaveDeConversas,
  conversaParaLixeira,
  marcarConversa,
  moverConversa,
  reabrirConversa,
  resolverConversa,
  restaurarConversa,
  useConversa,
  useConversas,
} from "./conversas";

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

function chamadaFeita(indice = 0): { readonly url: string; readonly init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[indice] as [string, RequestInit];
  return { url, init };
}

const DETALHE = { conversa: { id: "v1" }, canal: { id: "k1" } };

const envoltorio = ({ children }: { readonly children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

describe("chaves e hooks de leitura de Conversa", () => {
  it("(a) a chave começa por /conversas e tem a ordem fixa de chaves", () => {
    expect(chaveDeConversas({})).toBe("/conversas?estado=ativo&limite=50&deslocamento=0");
    expect(chaveDeConversas({ naoLidas: true, atribuidoId: "M" })).toBe(
      "/conversas?estado=ativo&naoLidas=true&atribuidoId=M&limite=50&deslocamento=0",
    );
    // A ordem das propriedades no objeto não muda a chave (um só item de cache por filtro).
    expect(chaveDeConversas({ atribuidoId: "M", naoLidas: true })).toBe(chaveDeConversas({ naoLidas: true, atribuidoId: "M" }));
    expect(chaveDeConversas({ naoLidas: false, comEstrela: true, q: " joão ", limite: 100, deslocamento: 50 })).toBe(
      "/conversas?estado=ativo&naoLidas=false&comEstrela=true&q=jo%C3%A3o&limite=100&deslocamento=50",
    );
    expect(chaveDaConversa("v1")).toBe("/conversas/v1");
  });

  it("(a) useConversas({ naoLidas: true, atribuidoId }) chama a rota na ordem fixa e devolve itens e total", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [{ id: "v1" }], total: 1 }));
    const { result } = renderHook(() => useConversas({ naoLidas: true, atribuidoId: "M" }), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual({ ok: true, itens: [{ id: "v1" }], total: 1 }));
    expect(chamadaFeita().url).toBe("http://api/conversas?estado=ativo&naoLidas=true&atribuidoId=M&limite=50&deslocamento=0");
  });

  it("(a) useConversa(id) lê /conversas/<id> e devolve o detalhe; sem id não chama a rede", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHE }));
    const { result } = renderHook(() => useConversa("v1"), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual(DETALHE));
    expect(chamadaFeita().url).toBe("http://api/conversas/v1");

    fetchMock.mockClear();
    renderHook(() => useConversa(undefined), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(a) um 404 da api fica em error como ErroDeApi, sem repetir", async () => {
    fetchMock.mockResolvedValue(resposta(404, { ok: false, error: "Conversa não encontrada.", codigo: "CONVERSA_NAO_ENCONTRADA" }));
    const { result } = renderHook(() => useConversa("zzz"), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ErroDeApi));
    expect((result.current.error as ErroDeApi).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("mutações de Conversa — a rota certa e a invalidação", () => {
  it("(b) abrirConversa manda POST /conversas com o corpo e invalida /conversas", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: { ...DETALHE, primeiraMensagem: { id: "m1" } } }));
    const entrada = { canalId: "k1", contatoId: "p1", mensagem: { conteudo: "oi" } };
    const dados = await abrirConversa(entrada);
    const { url, init } = chamadaFeita();
    expect(url).toBe("http://api/conversas");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(entrada));
    expect(dados.conversa.id).toBe("v1");
    expect(invalidarCrm).toHaveBeenCalledWith("/conversas");
  });

  it("(b) resolver, reabrir, lixeira e restaurar vão sem corpo para a rota deles", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHE }));
    await resolverConversa("v1");
    await reabrirConversa("v1");
    await conversaParaLixeira("v1");
    await restaurarConversa("v1");
    const chamadas = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(chamadas.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "POST http://api/conversas/v1/resolver",
      "POST http://api/conversas/v1/reabrir",
      "POST http://api/conversas/v1/lixeira",
      "POST http://api/conversas/v1/restaurar",
    ]);
    expect(chamadas.every(([, init]) => init.body === undefined)).toBe(true);
    expect(vi.mocked(invalidarCrm).mock.calls.map(([prefixo]) => prefixo)).toEqual(["/conversas", "/conversas", "/conversas", "/conversas"]);
  });

  it("(b) moverConversa manda { contatoId, resolverExistente } e atribuirConversa manda { atribuido }", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHE }));
    await moverConversa("v1", "p2", true);
    await moverConversa("v1", "p3");
    await atribuirConversa("v1", { tipo: "membro", id: "mem_ana" });
    await atribuirConversa("v1", null);
    const chamadas = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(chamadas.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "POST http://api/conversas/v1/mover",
      "POST http://api/conversas/v1/mover",
      "POST http://api/conversas/v1/atribuir",
      "POST http://api/conversas/v1/atribuir",
    ]);
    expect(chamadas[0]?.[1].body).toBe(JSON.stringify({ contatoId: "p2", resolverExistente: true }));
    expect(chamadas[1]?.[1].body).toBe(JSON.stringify({ contatoId: "p3" }));
    expect(chamadas[2]?.[1].body).toBe(JSON.stringify({ atribuido: { tipo: "membro", id: "mem_ana" } }));
    expect(chamadas[3]?.[1].body).toBe(JSON.stringify({ atribuido: null }));
  });

  it("(c) marcarConversa manda PUT /conversas/<id>/marcacao; só lidaAte invalida a chave da Conversa, não a lista", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { estrela: false, lidaAte: "2026-11-06T10:00:00.000Z" } }));
    const marcacao = await marcarConversa("v1", { lidaAte: "2026-11-06T10:00:00.000Z" });
    const { url, init } = chamadaFeita();
    expect(url).toBe("http://api/conversas/v1/marcacao");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ lidaAte: "2026-11-06T10:00:00.000Z" }));
    expect(marcacao.estrela).toBe(false);
    expect(invalidarCrm).toHaveBeenCalledTimes(1);
    expect(invalidarCrm).toHaveBeenCalledWith("/conversas/v1");
    expect(invalidarCrm).not.toHaveBeenCalledWith("/conversas");
  });

  it("(c) marcarConversa com estrela invalida a lista inteira (/conversas)", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { estrela: true, lidaAte: null } }));
    await marcarConversa("v1", { estrela: true });
    expect(invalidarCrm).toHaveBeenCalledWith("/conversas");
    vi.mocked(invalidarCrm).mockClear();
    await marcarConversa("v1", { estrela: true, lidaAte: "2026-11-06T10:00:00.000Z" });
    expect(invalidarCrm).toHaveBeenCalledWith("/conversas");
  });

  it("(d) numa recusa a ErroDeApi sobe com status e codigo e nada é invalidado", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(409, { ok: false, error: "Esta Conversa já está resolvida.", codigo: "CONVERSA_SITUACAO_INVALIDA" }),
    );
    const erro = (await resolverConversa("v1").catch((e: unknown) => e)) as ErroDeApi;
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.status).toBe(409);
    expect(erro.codigo).toBe("CONVERSA_SITUACAO_INVALIDA");
    expect(invalidarCrm).not.toHaveBeenCalled();
  });

  it("(d) resolver duas vezes: a primeira invalida, a segunda devolve a recusa da api sem quebrar o cache", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHE }))
      .mockResolvedValueOnce(resposta(409, { ok: false, error: "Esta Conversa já está resolvida.", codigo: "CONVERSA_SITUACAO_INVALIDA" }));
    await resolverConversa("v1");
    expect(invalidarCrm).toHaveBeenCalledTimes(1);
    const erro = (await resolverConversa("v1").catch((e: unknown) => e)) as ErroDeApi;
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.codigo).toBe("CONVERSA_SITUACAO_INVALIDA");
    expect(invalidarCrm).toHaveBeenCalledTimes(1);
  });
});
