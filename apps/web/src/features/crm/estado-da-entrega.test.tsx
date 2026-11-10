// @vitest-environment jsdom
/**
 * 16-11 Task 1 (3.7.3, MSG-02): o estado de entrega de cada Mensagem enviada em
 * palavras de produto, e "Tentar de novo" na que falhou (`POST /mensagens/:id/reenviar`).
 * Nenhuma rede: `fetch` falso, sessão falsa.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Mensagem } from "@n1/dominio/crm/mensagens";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));
vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

import { invalidarCrm } from "@/dados/crm/cliente-crm";
import { EstadoDaEntrega } from "./estado-da-entrega";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

type Parcial = Pick<Mensagem, "id" | "direcao" | "statusEntrega" | "motivoFalha">;

function mensagem(extras: Partial<Parcial> = {}): Parcial {
  return { id: "msg_1", direcao: "enviada", statusEntrega: "enviada", motivoFalha: null, ...extras };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(invalidarCrm).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EstadoDaEntrega", () => {
  it.each([
    ["pendente", "Enviando…"],
    ["enviada", "Enviada"],
    ["entregue", "Entregue"],
    ["lida", "Lida"],
  ] as const)("(a) statusEntrega %s aparece como “%s”, sem botão", (status, rotulo) => {
    render(<EstadoDaEntrega mensagem={mensagem({ statusEntrega: status })} />);
    expect(screen.getByText(rotulo)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });

  it("(b) falhou mostra “Não enviada”, o motivo e o botão “Tentar de novo”", () => {
    render(<EstadoDaEntrega mensagem={mensagem({ statusEntrega: "falhou", motivoFalha: "Este número não tem WhatsApp." })} />);
    expect(screen.getByText("Não enviada")).toBeTruthy();
    expect(screen.getByText("Este número não tem WhatsApp.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("(c) Mensagem interna ou recebida não mostra estado de entrega", () => {
    const { container, rerender } = render(<EstadoDaEntrega mensagem={mensagem({ direcao: "interna", statusEntrega: null })} />);
    expect(container.textContent).toBe("");
    rerender(<EstadoDaEntrega mensagem={mensagem({ direcao: "recebida", statusEntrega: null })} />);
    expect(container.textContent).toBe("");
  });

  it("(d) Tentar de novo chama POST /mensagens/<id>/reenviar e, enquanto espera, o botão fica desabilitado em “Enviando…”", async () => {
    let solta: ((valor: Response) => void) | undefined;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (solta = resolve)));
    render(<EstadoDaEntrega mensagem={mensagem({ id: "msg_9", statusEntrega: "falhou", motivoFalha: "Fora do ar." })} />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/mensagens/msg_9/reenviar");
    expect(init.method).toBe("POST");
    const enviando = await screen.findByRole("button", { name: "Enviando…" });
    expect((enviando as HTMLButtonElement).disabled).toBe(true);
    // Um segundo clique não manda outro pedido.
    fireEvent.click(enviando);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    solta?.(resposta(200, { ok: true, dados: { id: "msg_9", statusEntrega: "pendente" } }));
    await waitFor(() => expect(invalidarCrm).toHaveBeenCalled());
    // Até a leitura nova chegar, o fio não volta a dizer "Não enviada".
    expect(screen.queryByText("Não enviada")).toBeNull();
  });

  it("(e) erro da api mostra a frase dela ao lado e mantém o motivo e o botão", async () => {
    fetchMock.mockResolvedValue(resposta(409, { ok: false, error: "Um Canal arquivado não envia Mensagem.", codigo: "CANAL_ARQUIVADO" }));
    render(<EstadoDaEntrega mensagem={mensagem({ statusEntrega: "falhou", motivoFalha: "Este número não tem WhatsApp." })} />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Um Canal arquivado não envia Mensagem."));
    expect(screen.getByText("Este número não tem WhatsApp.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Tentar de novo" }) as HTMLButtonElement).disabled).toBe(false);
    expect(invalidarCrm).not.toHaveBeenCalled();
  });

  it("(f) o motivo é texto do React, nunca HTML", () => {
    const { container } = render(
      <EstadoDaEntrega mensagem={mensagem({ statusEntrega: "falhou", motivoFalha: "<img src=x onerror=alert(1)>" })} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });
});
