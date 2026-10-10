// @vitest-environment jsdom
/**
 * 07-06 Task 1 — as mutações de Contato chamam a rota certa de `apps/api`
 * (D-04), invalidam `/contatos` só no sucesso, e `usePodeNoCrm` esconde o que o
 * Papel não alcança com a MESMA função do domínio (D-14). Nenhuma rede: `fetch`
 * falso, sessão falsa, `StoreProvider` de verdade com o seed.
 */

import type { ComponentProps, ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { podeNoCrm } from "@n1/dominio/crm/permissoes";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";

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
  adicionarIdentificador,
  arquivarContato,
  chaveDeContatos,
  chaveDoContato,
  criarContato,
  editarContato,
  editarIdentificador,
  enviarContatoParaLixeira,
  excluirContatoPermanentemente,
  removerIdentificador,
  restaurarContato,
  useContatos,
} from "./contatos";
import { useMembrosAtivos, useNomeDoMembro, usePodeNoCrm } from "./sessao";

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

function chamadaFeita(): { readonly url: string; readonly init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

const DETALHADO = { contato: { id: "c1", nome: "Ana" }, identificadores: [], vinculos: [] };

describe("mutações de Contato — a rota certa", () => {
  it("(a) criarContato manda POST /contatos com o corpo e devolve o ContatoDetalhado", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: DETALHADO }));
    const dados = await criarContato({ nome: "Ana" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = chamadaFeita();
    expect(url).toBe("http://api/contatos");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ nome: "Ana" }));
    expect(dados).toEqual(DETALHADO);
  });

  it("(a) editarContato manda PATCH /contatos/c1 com o corpo", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    await editarContato("c1", { nome: "Ana" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = chamadaFeita();
    expect(url).toBe("http://api/contatos/c1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ nome: "Ana" }));
  });

  it("(a) os Identificadores usam o sub-recurso: POST, PATCH e DELETE sem corpo", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await adicionarIdentificador("c1", { tipo: "email", valor: "a@x.com" });
    await editarIdentificador("c1", "i1", { principal: true });
    await removerIdentificador("c1", "i1");
    const chamadas = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(chamadas.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "POST http://api/contatos/c1/identificadores",
      "PATCH http://api/contatos/c1/identificadores/i1",
      "DELETE http://api/contatos/c1/identificadores/i1",
    ]);
    expect(chamadas[1]?.[1].body).toBe(JSON.stringify({ principal: true }));
    expect(chamadas[2]?.[1].body).toBeUndefined();
  });

  it("(a) arquivar, restaurar, lixeira e exclusão permanente vão sem corpo para a rota deles", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await arquivarContato("c1");
    await restaurarContato("c1");
    await enviarContatoParaLixeira("c1");
    await excluirContatoPermanentemente("c1");
    const chamadas = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(chamadas.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "POST http://api/contatos/c1/arquivar",
      "POST http://api/contatos/c1/restaurar",
      "DELETE http://api/contatos/c1",
      "DELETE http://api/contatos/c1/permanente",
    ]);
    expect(chamadas.every(([, init]) => init.body === undefined)).toBe(true);
  });

  it("(a) as chaves começam por /contatos e carregam o filtro", () => {
    expect(chaveDeContatos({})).toBe("/contatos?estado=ativo&limite=50&deslocamento=0");
    expect(chaveDeContatos({ estado: "na_lixeira", q: "ana souza", limite: 100, deslocamento: 50 })).toBe(
      "/contatos?estado=na_lixeira&q=ana+souza&limite=100&deslocamento=50",
    );
    expect(chaveDoContato("c1")).toBe("/contatos/c1");
  });

  it("(a) useContatos lê a chave do filtro", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [], total: 0 }));
    const envoltorio = ({ children }: { readonly children: ReactNode }) =>
      createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
    const { result } = renderHook(() => useContatos({ estado: "ativo" }), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual({ ok: true, itens: [], total: 0 }));
    expect(chamadaFeita().url).toBe("http://api/contatos?estado=ativo&limite=50&deslocamento=0");
  });
});

describe("mutações de Contato — invalidação e recusa", () => {
  it("(b) depois do sucesso, invalidarCrm('/contatos') é chamado", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    await arquivarContato("c1");
    expect(invalidarCrm).toHaveBeenCalledWith("/contatos");
  });

  it("(b) numa recusa a ErroDeApi sobe com codigo e bloqueios, e nada é invalidado", async () => {
    const bloqueios = { empresas: [{ id: "e1", nome: "Alfa" }] };
    fetchMock.mockResolvedValueOnce(
      resposta(409, { ok: false, error: "Este Contato não pode ir para a lixeira.", codigo: "CONTATO_BLOQUEADO", bloqueios }),
    );
    const erro = await enviarContatoParaLixeira("c1").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).codigo).toBe("CONTATO_BLOQUEADO");
    expect((erro as ErroDeApi).bloqueios).toEqual(bloqueios);
    expect(invalidarCrm).not.toHaveBeenCalled();
  });
});

function comStore(memberId: string) {
  const data = buildSeed();
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const props = { sessao: { memberId }, estadoInicial: { data, revisao: 1, ordens: {} }, transporte } as ComponentProps<typeof StoreProvider>;
  return function Envoltorio({ children }: { readonly children: ReactNode }) {
    return createElement(StoreProvider, props, children);
  };
}

describe("sessão — Membros e permissão (D-11, D-14)", () => {
  it("(c) usePodeNoCrm devolve a frase de recusa para um Convidado e undefined para um Membro", () => {
    const convidado = renderHook(() => usePodeNoCrm("criar", "contato"), { wrapper: comStore("mem_beatriz") });
    expect(convidado.result.current).toBe(podeNoCrm("convidado", "ativo", "criar", "contato"));
    expect(typeof convidado.result.current).toBe("string");
    const membro = renderHook(() => usePodeNoCrm("criar", "contato"), { wrapper: comStore("mem_julia") });
    expect(membro.result.current).toBeUndefined();
  });

  it("(c) useMembrosAtivos só lista Membros ativos e useNomeDoMembro cai em travessão", () => {
    const { result } = renderHook(() => ({ membros: useMembrosAtivos(), nome: useNomeDoMembro() }), {
      wrapper: comStore("mem_julia"),
    });
    const ids = result.current.membros.map((m) => m.id);
    expect(ids).toContain("mem_julia");
    expect(ids).not.toContain("mem_tiago");
    expect(result.current.nome("mem_julia")).toBe("Júlia Prado");
    expect(result.current.nome("desconhecido")).toBe("—");
    expect(result.current.nome(null)).toBe("—");
  });
});
