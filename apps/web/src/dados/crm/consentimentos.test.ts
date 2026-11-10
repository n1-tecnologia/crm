// @vitest-environment jsdom
/**
 * 14-11 Task 1 — o cliente dos Consentimentos do Contato chama a rota certa de
 * `apps/api` (14-08), revalida o histórico daquele Contato no sucesso e deixa a
 * recusa subir como `ErroDeApi`. O histórico é só inserção: o cliente não tem
 * como editar nem apagar. Nenhuma rede: `fetch` falso, sessão falsa.
 */

import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("./cliente-crm", async (original) => {
  const real = await original<typeof import("./cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

import { ErroDeApi, invalidarCrm } from "./cliente-crm";
import { chaveDosConsentimentos, registrarConsentimento, useConsentimentosDoContato } from "./consentimentos";

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

const REGISTRO = {
  id: "k1",
  contatoId: "c1",
  finalidadeId: "cat_fin_mkt",
  tipoDeCanal: "whatsapp",
  decisao: "concedido",
  em: "2026-10-01T10:00:00.000Z",
  origem: "verbal",
  evidenciaMensagemId: null,
  registradoPor: "mem_julia",
  registradoEm: "2026-10-01T10:00:00.000Z",
};

const ENTRADA = { finalidadeId: "cat_fin_mkt", tipoDeCanal: "whatsapp", decisao: "concedido", origem: "verbal" } as const;

describe("consentimentos do Contato — o cliente da api", () => {
  it("(a) a chave do histórico começa por /contatos/<id>/consentimentos", () => {
    expect(chaveDosConsentimentos("c1")).toBe("/contatos/c1/consentimentos");
  });

  it("(a) registrarConsentimento manda POST /contatos/c1/consentimentos com o corpo do domínio", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: REGISTRO }));
    const registro = await registrarConsentimento("c1", ENTRADA);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/contatos/c1/consentimentos");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(ENTRADA));
    expect(registro).toEqual(REGISTRO);
    expect(invalidarCrm).toHaveBeenCalledWith("/contatos/c1/consentimentos");
  });

  it("(b) um 409 vira ErroDeApi com status e codigo, e nada é revalidado", async () => {
    fetchMock.mockResolvedValueOnce(resposta(409, { ok: false, error: "Um Contato mesclado é somente leitura.", codigo: "CONSENTIMENTO_RECUSADO" }));
    const erro = (await registrarConsentimento("c1", ENTRADA).catch((e: unknown) => e)) as ErroDeApi;
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.status).toBe(409);
    expect(erro.codigo).toBe("CONSENTIMENTO_RECUSADO");
    expect(invalidarCrm).not.toHaveBeenCalled();
  });

  it("(b) um 400 chega com o campo", async () => {
    fetchMock.mockResolvedValueOnce(resposta(400, { ok: false, error: "O consentimento não pode ser de uma data futura.", codigo: "VALOR_INVALIDO", campo: "em" }));
    const erro = (await registrarConsentimento("c1", ENTRADA).catch((e: unknown) => e)) as ErroDeApi;
    expect(erro.status).toBe(400);
    expect(erro.campo).toBe("em");
  });

  it("(c) useConsentimentosDoContato lê o histórico da chave do Contato", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [REGISTRO], total: 1 }));
    const envoltorio = ({ children }: { readonly children: ReactNode }) =>
      createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
    const { result } = renderHook(() => useConsentimentosDoContato("c1"), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual({ ok: true, itens: [REGISTRO], total: 1 }));
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("http://api/contatos/c1/consentimentos");
  });
});
