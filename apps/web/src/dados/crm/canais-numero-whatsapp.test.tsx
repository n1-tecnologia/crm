// @vitest-environment jsdom
/**
 * Sessão 7 (7.2.5) — `useNumeroDoWhatsAppOficial`: o número e a conta ligados ao Canal do WhatsApp oficial, lidos de
 * `GET /canais/:id/whatsapp-oficial/numero`. `pausado` não lê nada; o 404 (`SEM_NUMERO`) fica em `error` e não é repetido
 * (recusa 4xx não melhora ao repetir). A api nunca devolve o token, e o hook não o conhece.
 */

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

import { ErroDeApi } from "./cliente-crm";
import { useNumeroDoWhatsAppOficial } from "./canais";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const NUMERO = { phoneNumberId: "1098765432100", wabaId: "100200300400500", numeroExibido: "+55 11 97777-0001" };
let fetchMock: ReturnType<typeof vi.fn>;

const envolver = ({ children }: { readonly children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryInterval: 10 }}>{children}</SWRConfig>
);

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("useNumeroDoWhatsAppOficial", () => {
  it("lê GET /canais/:id/whatsapp-oficial/numero com o Bearer e devolve o número, a conta e o identificador", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: NUMERO }));
    const { result } = renderHook(() => useNumeroDoWhatsAppOficial("uuid-1"), { wrapper: envolver });

    await waitFor(() => expect(result.current.data).toEqual(NUMERO));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/canais/uuid-1/whatsapp-oficial/numero");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer tok");
    expect(JSON.stringify(result.current.data)).not.toMatch(/token/i);
  });

  it("pausado: não lê nada", async () => {
    const { result } = renderHook(() => useNumeroDoWhatsAppOficial("uuid-1", { pausado: true }), { wrapper: envolver });

    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("404 SEM_NUMERO: fica em `error` como ErroDeApi e não é repetido", async () => {
    fetchMock.mockResolvedValue(resposta(404, { ok: false, error: "Este Canal não está conectado a um número do WhatsApp oficial.", codigo: "SEM_NUMERO" }));
    const { result } = renderHook(() => useNumeroDoWhatsAppOficial("uuid-1"), { wrapper: envolver });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ErroDeApi));
    expect(result.current.error).toMatchObject({ status: 404, codigo: "SEM_NUMERO" });
    await new Promise((r) => setTimeout(r, 60));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
