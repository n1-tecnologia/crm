// @vitest-environment jsdom
/**
 * 07-09 Task 1 — as mutações de Empresa chamam a rota certa de `apps/api`
 * (D-04, D-08), invalidam `/empresas` e `/contatos` só no sucesso (o vínculo
 * aparece na ficha do Contato) e a recusa sobe como `ErroDeApi` com `codigo` e
 * `bloqueios`. Nenhuma rede: `fetch` falso, sessão falsa.
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
  adicionarIdentificadorDeEmpresa,
  arquivarEmpresa,
  chaveDaEmpresa,
  chaveDeEmpresas,
  criarEmpresa,
  editarEmpresa,
  editarIdentificadorDeEmpresa,
  editarVinculo,
  encerrarVinculo,
  enviarEmpresaParaLixeira,
  excluirEmpresaPermanentemente,
  removerIdentificadorDeEmpresa,
  restaurarEmpresa,
  trocarAdminDaEmpresa,
  useEmpresas,
  vincularContatoAEmpresa,
} from "./empresas";

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

const DETALHADO = { empresa: { id: "e1", nomeFantasia: "Alfa" }, identificadores: [], vinculos: [], matriz: null, filiais: [] };

describe("mutações de Empresa — a rota certa", () => {
  it("(a) criarEmpresa manda POST /empresas com a Empresa e o admin numa chamada só (D-08)", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: DETALHADO }));
    const corpo = { empresa: { nomeFantasia: "Alfa" }, admin: { contatoId: "c1", cargo: "Sócia" } };
    const dados = await criarEmpresa(corpo);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = chamadaFeita();
    expect(url).toBe("http://api/empresas");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(corpo));
    expect(dados).toEqual(DETALHADO);
  });

  it("(a) trocarAdminDaEmpresa manda POST /empresas/e1/trocar-admin", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    const troca = { vinculoAtualId: "v1", novoAdmin: { contatoId: "c2" } };
    await trocarAdminDaEmpresa("e1", troca);
    const { url, init } = chamadaFeita();
    expect(url).toBe("http://api/empresas/e1/trocar-admin");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(troca));
  });

  it("(a) encerrarVinculo manda POST /empresas/e1/contatos/v1/encerrar sem corpo", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    await encerrarVinculo("e1", "v1");
    const { url, init } = chamadaFeita();
    expect(url).toBe("http://api/empresas/e1/contatos/v1/encerrar");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("(a) restaurarEmpresa manda o corpo quando há admin e vai sem corpo e sem content-type quando não há", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await restaurarEmpresa("e1", { admin: { contatoId: "c1" } });
    await restaurarEmpresa("e1");
    const comAdmin = chamadaFeita(0);
    expect(comAdmin.url).toBe("http://api/empresas/e1/restaurar");
    expect(comAdmin.init.method).toBe("POST");
    expect(comAdmin.init.body).toBe(JSON.stringify({ admin: { contatoId: "c1" } }));
    const semAdmin = chamadaFeita(1);
    expect(semAdmin.init.body).toBeUndefined();
    expect(Object.keys((semAdmin.init.headers ?? {}) as Record<string, string>).map((k) => k.toLowerCase())).not.toContain("content-type");
  });

  it("(a) os demais gestos usam o verbo e a rota do contrato", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await editarEmpresa("e1", { nomeFantasia: "Beta" });
    await adicionarIdentificadorDeEmpresa("e1", { tipo: "dominio", valor: "alfa.com" });
    await editarIdentificadorDeEmpresa("e1", "i1", { principal: true });
    await removerIdentificadorDeEmpresa("e1", "i1");
    await vincularContatoAEmpresa("e1", { contatoId: "c2", cargo: "CFO", admin: false });
    await editarVinculo("e1", "v1", { cargo: "CEO" });
    await arquivarEmpresa("e1");
    await enviarEmpresaParaLixeira("e1");
    await excluirEmpresaPermanentemente("e1");
    const chamadas = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(chamadas.map(([url, init]) => `${init.method} ${url.replace("http://api", "")}`)).toEqual([
      "PATCH /empresas/e1",
      "POST /empresas/e1/identificadores",
      "PATCH /empresas/e1/identificadores/i1",
      "DELETE /empresas/e1/identificadores/i1",
      "POST /empresas/e1/contatos",
      "PATCH /empresas/e1/contatos/v1",
      "POST /empresas/e1/arquivar",
      "DELETE /empresas/e1",
      "DELETE /empresas/e1/permanente",
    ]);
    expect(chamadas[2]?.[1].body).toBe(JSON.stringify({ principal: true }));
    expect(chamadas[3]?.[1].body).toBeUndefined();
  });

  it("(a) as chaves começam por /empresas e carregam o filtro", () => {
    expect(chaveDeEmpresas({})).toBe("/empresas?estado=ativo&limite=50&deslocamento=0");
    expect(chaveDeEmpresas({ estado: "na_lixeira", q: "alfa sa", limite: 100, deslocamento: 50 })).toBe(
      "/empresas?estado=na_lixeira&q=alfa+sa&limite=100&deslocamento=50",
    );
    expect(chaveDaEmpresa("e1")).toBe("/empresas/e1");
  });

  it("(a) useEmpresas lê a chave do filtro", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [], total: 0 }));
    const envoltorio = ({ children }: { readonly children: ReactNode }) =>
      createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
    const { result } = renderHook(() => useEmpresas({ estado: "ativo" }), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual({ ok: true, itens: [], total: 0 }));
    expect(chamadaFeita().url).toBe("http://api/empresas?estado=ativo&limite=50&deslocamento=0");
  });
});

describe("mutações de Empresa — invalidação e recusa", () => {
  it("(a) depois do sucesso, /empresas e /contatos são invalidados (o vínculo aparece na ficha do Contato)", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    await arquivarEmpresa("e1");
    expect(invalidarCrm).toHaveBeenCalledWith("/empresas");
    expect(invalidarCrm).toHaveBeenCalledWith("/contatos");
  });

  it("(a) numa recusa a ErroDeApi sobe com codigo e bloqueios, e nada é invalidado", async () => {
    const bloqueios = { negocios: { total: 1, itens: [{ id: "n1", titulo: "Proposta" }] } };
    fetchMock.mockResolvedValueOnce(
      resposta(409, { ok: false, error: "Esta Empresa não pode ir para a lixeira.", codigo: "EMPRESA_BLOQUEADA", bloqueios }),
    );
    const erro = await enviarEmpresaParaLixeira("e1").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).codigo).toBe("EMPRESA_BLOQUEADA");
    expect((erro as ErroDeApi).bloqueios).toEqual(bloqueios);
    expect(invalidarCrm).not.toHaveBeenCalled();
  });
});
