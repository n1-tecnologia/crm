// @vitest-environment jsdom
/**
 * Sessão 8 (8.2.3) — a página de retorno do login do Instagram
 * (`/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno`):
 *
 *   - com `code` e `state`, chama `POST /canais/instagram/concluir` uma vez só,
 *     re-hidrata e reabre a ficha do Canal que a api devolveu;
 *   - a recusa da api aparece com a frase dela, e o link volta à ficha do Canal do `state`;
 *   - cancelado no Instagram (`error=…`), não chama a api.
 *
 * O teste mora em `features/crm/` porque `app/` só guarda convenção de arquivo do Next.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import RetornoDoInstagramPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno/page";

const { obterSessao, substituir, parametros } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  substituir: vi.fn(),
  parametros: { atual: new URLSearchParams() },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno",
  useRouter: () => ({ push: vi.fn(), replace: substituir }),
  useSearchParams: () => parametros.atual,
}));

/** Um `state` com a forma do da api; a assinatura não importa aqui, quem confere é a api. */
const STATE = `${btoa(JSON.stringify({ w: "ws", c: "uuid-9", m: "mem_rafael", e: 1, n: "x" })).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.assinatura`;

let fetchMock: ReturnType<typeof vi.fn>;
let hidratar: ReturnType<typeof vi.fn>;

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  substituir.mockReset();
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  hidratar = vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." }));
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
});

async function montar(busca: string) {
  parametros.atual = new URLSearchParams(busca);
  const transporte: Transporte = {
    gravar: vi.fn() as unknown as Transporte["gravar"],
    hidratar: hidratar as unknown as Transporte["hidratar"],
  };
  await act(async () => {
    render(
      <StoreProvider sessao={{ memberId: "mem_rafael" }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        <RetornoDoInstagramPage />
      </StoreProvider>,
    );
  });
}

describe("Sessão 8 — a volta do login do Instagram", () => {
  it("conclui uma vez só, re-hidrata e reabre a ficha do Canal conectado", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { id: "uuid-9", conexao: "conectada" } }));
    await montar(`code=codigo-do-instagram&state=${encodeURIComponent(STATE)}`);

    await waitFor(() => expect(substituir).toHaveBeenCalledWith("/crm/caixa-de-entrada/configuracoes/canais/uuid-9"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/canais/instagram/concluir");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ codigo: "codigo-do-instagram", state: STATE });
    expect(hidratar).toHaveBeenCalled();
  });

  it("a recusa da api aparece com a frase dela e o link volta à ficha do Canal do state", async () => {
    fetchMock.mockResolvedValue(
      resposta(409, { ok: false, error: "Você entrou como @outra, mas este Canal é da conta @loja.n1.", codigo: "CONTA_DIFERENTE" }),
    );
    await montar(`code=c&state=${encodeURIComponent(STATE)}`);

    expect(await screen.findByText("Você entrou como @outra, mas este Canal é da conta @loja.n1.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar à ficha do Canal" }).getAttribute("href")).toBe(
      "/crm/caixa-de-entrada/configuracoes/canais/uuid-9",
    );
    expect(substituir).not.toHaveBeenCalled();
  });

  it("cancelado no Instagram: diz que nada mudou e não chama a api", async () => {
    await montar(`error=access_denied&error_reason=user_denied&state=${encodeURIComponent(STATE)}`);

    expect(await screen.findByText("A autorização foi cancelada no Instagram. Nada mudou no Canal.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
