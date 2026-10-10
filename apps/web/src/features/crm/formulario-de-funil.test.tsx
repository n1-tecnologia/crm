// @vitest-environment jsdom
/**
 * 07-07 Task 1 — o diálogo "Novo Funil" pré-valida com o domínio, avisa que o
 * primeiro Funil vira o padrão (D-13) e leva a recusa 409 de nome repetido ao
 * campo Nome, com o diálogo aberto e os campos preservados.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DialogoNovoFunil, montarNovoFunil, valoresIniciaisDoFunil } from "./formulario-de-funil";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

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
});

afterEach(() => {
  cleanup();
});

describe("montarNovoFunil — a pré-validação do domínio", () => {
  it("nome vazio cai no campo Nome", () => {
    const montado = montarNovoFunil(valoresIniciaisDoFunil());
    expect(montado.ok).toBe(false);
    if (!montado.ok) expect(montado.erros.nome).toBe("O Funil precisa de um nome.");
  });

  it("Etapa repetida cai na lista de Etapas, sem caixa nem espaços nas pontas", () => {
    const base = valoresIniciaisDoFunil();
    const montado = montarNovoFunil({
      ...base,
      nome: "Vendas",
      etapas: [
        { chave: 1, nome: "Novo", probabilidade: "" },
        { chave: 2, nome: "  novo ", probabilidade: "" },
      ],
    });
    expect(montado.ok).toBe(false);
    if (!montado.ok) expect(montado.erros.etapas).toContain("Já existe uma Etapa");
  });

  it("monta o corpo: vazios saem, a probabilidade vira número e as Regras vão como estão", () => {
    const base = valoresIniciaisDoFunil();
    const montado = montarNovoFunil({
      ...base,
      nome: " Vendas ",
      exigeValorGanho: true,
      etapas: [
        { chave: 1, nome: "Novo", probabilidade: "10" },
        { chave: 2, nome: "Proposta", probabilidade: "" },
      ],
    });
    expect(montado).toEqual({
      ok: true,
      corpo: {
        nome: "Vendas",
        privado: false,
        exigeMotivoPerda: false,
        exigeValorGanho: true,
        etapas: [{ nome: "Novo", probabilidadePadrao: 10 }, { nome: "Proposta" }],
      },
    });
  });
});

describe("DialogoNovoFunil", () => {
  it("avisa do Funil padrão, grava por POST /funis e devolve o Funil criado", async () => {
    const detalhado = { funil: { id: "f1", nome: "Vendas" }, etapas: [] };
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: detalhado }));
    const onCriado = vi.fn();
    render(<DialogoNovoFunil open onClose={vi.fn()} onCriado={onCriado} />);

    expect(document.body.textContent).toContain("O primeiro Funil do Espaço de Trabalho vira o Funil padrão.");
    fireEvent.change(screen.getByLabelText(/^Nome( \*)?$/), { target: { value: "Vendas" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Funil" }));

    await waitFor(() => expect(onCriado).toHaveBeenCalledWith(detalhado));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/funis");
    expect(JSON.parse(String(init.body))).toMatchObject({ nome: "Vendas", etapas: [{ nome: "Novo" }] });
  });

  it("409 FUNIL_NOME_EM_USO aparece no campo Nome e o diálogo continua aberto com os campos", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(409, { ok: false, error: "Já existe um Funil com este nome.", codigo: "FUNIL_NOME_EM_USO", campo: "nome" }),
    );
    const onCriado = vi.fn();
    render(<DialogoNovoFunil open onClose={vi.fn()} onCriado={onCriado} />);

    fireEvent.change(screen.getByLabelText(/^Nome( \*)?$/), { target: { value: "Vendas" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Funil" }));

    await screen.findByText("Já existe um Funil com este nome.");
    expect(onCriado).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/^Nome( \*)?$/) as HTMLInputElement).value).toBe("Vendas");
  });

  it("a única Etapa não pode ser removida e diz por quê", () => {
    render(<DialogoNovoFunil open onClose={vi.fn()} onCriado={vi.fn()} />);
    const remover = screen.getByRole("button", { name: "Remover" });
    expect(remover.getAttribute("aria-disabled")).toBe("true");
    expect(document.body.textContent).toContain("Um Funil precisa de ao menos uma Etapa.");
  });
});
