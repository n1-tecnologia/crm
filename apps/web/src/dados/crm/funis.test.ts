// @vitest-environment jsdom
/**
 * 07-07 Task 1 — as mutações de Funil e Etapa chamam a rota certa de
 * `apps/api` (D-04) e invalidam `/funis` só no sucesso; remapear e migrar
 * invalidam também `/negocios`, porque os Negócios mudaram de Etapa ou de
 * Funil. Nenhuma rede: `fetch` falso, sessão falsa.
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
  adicionarEtapa,
  arquivarFunil,
  chaveDeFunis,
  chaveDoFunil,
  criarFunil,
  definirFunilPadrao,
  editarEtapa,
  editarFunil,
  enviarFunilParaLixeira,
  excluirFunilPermanentemente,
  migrarNegociosDoFunil,
  remapearEtapa,
  removerEtapa,
  reordenarEtapas,
  restaurarFunil,
  useFunis,
} from "./funis";

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

const DETALHADO = { funil: { id: "f1", nome: "Vendas" }, etapas: [] };

function chamadas(): Array<[string, RequestInit]> {
  return fetchMock.mock.calls as Array<[string, RequestInit]>;
}

describe("mutações de Funil e Etapa — a rota certa", () => {
  it("(a) criarFunil manda POST /funis com as Etapas e devolve o FunilDetalhado", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: DETALHADO }));
    const dados = await criarFunil({ nome: "Vendas", etapas: [{ nome: "Novo" }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = chamadas()[0] as [string, RequestInit];
    expect(url).toBe("http://api/funis");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ nome: "Vendas", etapas: [{ nome: "Novo" }] }));
    expect(dados).toEqual(DETALHADO);
  });

  it("(a) editarFunil manda PATCH /funis/f1; definirFunilPadrao manda POST /funis/f1/padrao sem corpo", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await editarFunil("f1", { exigeValorGanho: true });
    await definirFunilPadrao("f1");
    expect(chamadas().map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "PATCH http://api/funis/f1",
      "POST http://api/funis/f1/padrao",
    ]);
    expect(chamadas()[0]?.[1].body).toBe(JSON.stringify({ exigeValorGanho: true }));
    expect(chamadas()[1]?.[1].body).toBeUndefined();
  });

  it("(a) as Etapas: adicionar, editar, reordenar com a permutação inteira e remover sem corpo", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await adicionarEtapa("f1", { nome: "Proposta", probabilidadePadrao: 50, posicao: 2 });
    await editarEtapa("e1", { nome: "Novo lead" });
    await reordenarEtapas("f1", ["e2", "e1"]);
    await removerEtapa("e1");
    expect(chamadas().map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "POST http://api/funis/f1/etapas",
      "PATCH http://api/etapas/e1",
      "PUT http://api/funis/f1/etapas/ordem",
      "DELETE http://api/etapas/e1",
    ]);
    expect(chamadas()[0]?.[1].body).toBe(JSON.stringify({ nome: "Proposta", probabilidadePadrao: 50, posicao: 2 }));
    expect(chamadas()[2]?.[1].body).toBe(JSON.stringify({ etapaIds: ["e2", "e1"] }));
    expect(chamadas()[3]?.[1].body).toBeUndefined();
  });

  it("(a) remapearEtapa manda POST /etapas/e1/remapear com paraEtapaId", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    await remapearEtapa("e1", "e2");
    const [url, init] = chamadas()[0] as [string, RequestInit];
    expect(url).toBe("http://api/etapas/e1/remapear");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ paraEtapaId: "e2" }));
  });

  it("(a) migrarNegociosDoFunil manda POST /funis/f1/migrar-negocios com destino e mapeamento", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: { migrados: 3 } }));
    const dados = await migrarNegociosDoFunil("f1", { paraFunilId: "f2", mapeamento: { e1: "e9" } });
    const [url, init] = chamadas()[0] as [string, RequestInit];
    expect(url).toBe("http://api/funis/f1/migrar-negocios");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ paraFunilId: "f2", mapeamento: { e1: "e9" } }));
    expect(dados).toEqual({ migrados: 3 });
  });

  it("(a) arquivar, restaurar, lixeira e exclusão permanente vão sem corpo para a rota deles", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await arquivarFunil("f1");
    await restaurarFunil("f1");
    await enviarFunilParaLixeira("f1");
    await excluirFunilPermanentemente("f1");
    expect(chamadas().map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "POST http://api/funis/f1/arquivar",
      "POST http://api/funis/f1/restaurar",
      "DELETE http://api/funis/f1",
      "DELETE http://api/funis/f1/permanente",
    ]);
    expect(chamadas().every(([, init]) => init.body === undefined)).toBe(true);
  });

  it("(a) as chaves começam por /funis e carregam o filtro", () => {
    expect(chaveDeFunis({})).toBe("/funis?estado=ativo&limite=50&deslocamento=0");
    expect(chaveDeFunis({ estado: "na_lixeira", limite: 100, deslocamento: 50 })).toBe(
      "/funis?estado=na_lixeira&limite=100&deslocamento=50",
    );
    expect(chaveDoFunil("f1")).toBe("/funis/f1");
  });

  it("(a) useFunis lê a chave do filtro", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [], total: 0 }));
    const envoltorio = ({ children }: { readonly children: ReactNode }) =>
      createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
    const { result } = renderHook(() => useFunis({ estado: "ativo" }), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual({ ok: true, itens: [], total: 0 }));
    expect((chamadas()[0] as [string, RequestInit])[0]).toBe("http://api/funis?estado=ativo&limite=50&deslocamento=0");
  });
});

describe("mutações de Funil e Etapa — invalidação e recusa", () => {
  it("(b) depois do sucesso, invalidarCrm('/funis') é chamado e '/negocios' não", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    await definirFunilPadrao("f1");
    expect(invalidarCrm).toHaveBeenCalledWith("/funis");
    expect(invalidarCrm).not.toHaveBeenCalledWith("/negocios");
  });

  it("(b) remapear e migrar invalidam também '/negocios'", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    await remapearEtapa("e1", "e2");
    expect(invalidarCrm).toHaveBeenCalledWith("/funis");
    expect(invalidarCrm).toHaveBeenCalledWith("/negocios");

    vi.mocked(invalidarCrm).mockClear();
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: { migrados: 2 } }));
    await migrarNegociosDoFunil("f1", { paraFunilId: "f2", mapeamento: { e1: "e9" } });
    expect(invalidarCrm).toHaveBeenCalledWith("/funis");
    expect(invalidarCrm).toHaveBeenCalledWith("/negocios");
  });

  it("(b) numa recusa a ErroDeApi sobe com codigo e bloqueios, e nada é invalidado", async () => {
    const bloqueios = { negocios: { total: 3, itens: [] } };
    fetchMock.mockResolvedValueOnce(
      resposta(409, { ok: false, error: "Esta Etapa ainda tem 3 Negócios.", codigo: "ETAPA_COM_NEGOCIOS", bloqueios }),
    );
    const erro = await removerEtapa("e1").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).codigo).toBe("ETAPA_COM_NEGOCIOS");
    expect((erro as ErroDeApi).bloqueios).toEqual(bloqueios);
    expect(invalidarCrm).not.toHaveBeenCalled();
  });
});
