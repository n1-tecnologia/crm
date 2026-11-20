// @vitest-environment jsdom
/**
 * Fase 17 (D-17-04) — a página de retorno do login do e-mail
 * (`/crm/caixa-de-entrada/configuracoes/canais/email/retorno`):
 *
 *   - com `code` e `state`, chama `POST /canais/email/oauth/concluir` UMA vez só com `{ codigo, state }`, mostra
 *     "Caixa de e-mail conectada." e o link para a ficha do Canal (que a api devolveu);
 *   - o endereço fica sem `code` nem `state` depois de usados, e nada vai a `localStorage` nem a `sessionStorage`;
 *   - a recusa da api aparece com a frase dela, como texto, e o link "Tentar de novo" leva à ficha do Canal do `state`;
 *   - `?error=access_denied` (cancelou no provedor) diz que nada foi conectado e não chama a api;
 *   - sem `code` nem `error`, diz que o endereço de retorno está incompleto;
 *   - o link nunca leva a uma URL que veio no endereço.
 *
 * O teste mora em `features/crm/` porque `app/` só guarda convenção de arquivo do Next.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import RetornoDoEmailPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/email/retorno/page";

const CAMINHO = "/crm/caixa-de-entrada/configuracoes/canais/email/retorno";

const { obterSessao, parametros } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
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
  usePathname: () => "/crm/caixa-de-entrada/configuracoes/canais/email/retorno",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  hidratar = vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." }));
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

async function montar(busca: string) {
  parametros.atual = new URLSearchParams(busca);
  // O endereço real do navegador, com a query: é o que a página tem de limpar.
  window.history.replaceState(null, "", busca === "" ? CAMINHO : `${CAMINHO}?${busca}`);
  const transporte: Transporte = {
    gravar: vi.fn() as unknown as Transporte["gravar"],
    hidratar: hidratar as unknown as Transporte["hidratar"],
  };
  await act(async () => {
    render(
      <StoreProvider sessao={{ memberId: "mem_rafael" }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        <RetornoDoEmailPage />
      </StoreProvider>,
    );
  });
}

describe("Fase 17 — a volta do login do e-mail", () => {
  it("conclui uma vez só com { codigo, state }, re-hidrata e mostra a caixa conectada com o link da ficha", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { id: "uuid-9", conexao: "conectada" } }));
    await montar(`code=c1&state=${encodeURIComponent(STATE)}`);

    expect(await screen.findByText("Caixa de e-mail conectada.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/canais/email/oauth/concluir");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ codigo: "c1", state: STATE });
    expect(hidratar).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Abrir a ficha do Canal" }).getAttribute("href")).toBe(
      "/crm/caixa-de-entrada/configuracoes/canais/uuid-9",
    );
  });

  it("o endereço fica sem `code` nem `state`, e nada vai ao armazenamento do navegador nem à URL da chamada", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { id: "uuid-9", conexao: "conectada" } }));
    await montar(`code=c1&state=${encodeURIComponent(STATE)}`);
    await screen.findByText("Caixa de e-mail conectada.");

    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe(CAMINHO);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(String((fetchMock.mock.calls[0] as [string])[0])).not.toContain("c1");
    expect(String((fetchMock.mock.calls[0] as [string])[0])).not.toContain("assinatura");
  });

  it("a recusa da api aparece com a frase dela, como texto, e 'Tentar de novo' volta à ficha do Canal do state", async () => {
    fetchMock.mockResolvedValue(
      resposta(409, {
        ok: false,
        error: "Você entrou como outra@exemplo.com, mas este Canal é da caixa vendas@empresa.com.br. <b>x</b>",
        codigo: "CONTA_DIFERENTE",
      }),
    );
    await montar(`code=c&state=${encodeURIComponent(STATE)}`);

    expect(
      await screen.findByText("Você entrou como outra@exemplo.com, mas este Canal é da caixa vendas@empresa.com.br. <b>x</b>"),
    ).toBeTruthy();
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getByText("A caixa de e-mail não foi conectada.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tentar de novo" }).getAttribute("href")).toBe(
      "/crm/caixa-de-entrada/configuracoes/canais/uuid-9",
    );
    expect(screen.queryByText("Caixa de e-mail conectada.")).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("falha sem resposta da api: a frase do cliente, sem chamar de novo", async () => {
    fetchMock.mockRejectedValue(new Error("rede"));
    await montar(`code=c&state=${encodeURIComponent(STATE)}`);
    expect(await screen.findByText("Sem conexão com o servidor.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancelou no provedor (error=access_denied): diz que nada foi conectado e não chama a api", async () => {
    await montar(`error=access_denied&state=${encodeURIComponent(STATE)}`);

    expect(await screen.findByText("Você cancelou a entrada. Nada foi conectado.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Tentar de novo" }).getAttribute("href")).toBe(
      "/crm/caixa-de-entrada/configuracoes/canais/uuid-9",
    );
    expect(window.location.search).toBe("");
  });

  it("outro erro do serviço: uma frase fixa, sem repetir o texto do endereço, e sem chamar a api", async () => {
    await montar(
      `error=server_error&error_description=${encodeURIComponent("<script>alert(1)</script> AADSTS65001")}&state=${encodeURIComponent(STATE)}`,
    );

    expect(await screen.findByText(/O serviço de login não aceitou a entrada\. Nada foi conectado\./)).toBeTruthy();
    expect(document.body.textContent).not.toContain("AADSTS");
    expect(document.querySelector("script")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem `code` nem `error`: o endereço de retorno está incompleto, e não chama a api", async () => {
    await montar("");

    expect(await screen.findByText("O endereço de retorno está incompleto. Comece de novo pela ficha do Canal.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Voltar às configurações" }).getAttribute("href")).toBe(
      "/crm/caixa-de-entrada/configuracoes",
    );
  });

  it("com `code` mas sem `state`: incompleto, e não chama a api", async () => {
    await montar("code=c1");
    expect(await screen.findByText("O endereço de retorno está incompleto. Comece de novo pela ficha do Canal.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("o link nunca leva a um endereço que veio na URL: id fora do formato no state cai nas configurações", async () => {
    const estado = `${btoa(JSON.stringify({ c: "https://mal.exemplo/x" })).replace(/=+$/, "")}.assinatura`;
    fetchMock.mockResolvedValue(resposta(400, { ok: false, error: "O pedido de conexão expirou ou não é válido.", codigo: "ESTADO_INVALIDO" }));
    await montar(`code=c&state=${encodeURIComponent(estado)}`);

    await waitFor(() => expect(screen.getByText("O pedido de conexão expirou ou não é válido.")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Voltar às configurações" }).getAttribute("href")).toBe(
      "/crm/caixa-de-entrada/configuracoes",
    );
  });
});
