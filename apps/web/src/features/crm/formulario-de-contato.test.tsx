// @vitest-environment jsdom
/**
 * 07-06 Task 2 — o formulário completo de Contato cria por `POST /contatos`
 * com os Identificadores que a pessoa digitou (D-04), pré-valida com o domínio
 * antes de qualquer ida ao servidor, e mostra a recusa 409 com o link do
 * detentor sem fechar o diálogo; os editores de Endereço e Campos adicionais
 * recusam o que o domínio recusa. Nenhuma rede: `fetch` falso, sessão falsa,
 * `StoreProvider` de verdade com o seed.
 */

import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { LIMITES_CRM, type Endereco } from "@n1/dominio/crm/comum";
import { validarContato } from "@n1/dominio/crm/contatos";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { DialogoNovoContato } from "./formulario-de-contato";
import { EditorDeCamposAdicionais } from "./editor-de-campos-adicionais";
import { EditorDeEnderecos } from "./editor-de-enderecos";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/contatos",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

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

function montar(ui: ReactElement, memberId = "mem_julia") {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        {ui}
      </StoreProvider>
    </SWRConfig>,
  );
}

function digitar(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

const CRIADO = { ok: true, dados: { contato: { id: "c1", nome: "Ana", sobrenome: null }, identificadores: [], vinculos: [] } };

describe("DialogoNovoContato", () => {
  it("(a) Nome, E-mail e Telefone viram POST /contatos com nome e identificadores", async () => {
    fetchMock.mockResolvedValue(resposta(201, CRIADO));
    const onCriado = vi.fn();
    montar(<DialogoNovoContato open onClose={vi.fn()} onCriado={onCriado} />);

    digitar("Nome", "Ana");
    digitar("E-mail", "Ana@X.com");
    digitar("Telefone", "(11) 98765-4321");
    fireEvent.click(screen.getByRole("button", { name: "Criar Contato" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/contatos");
    expect(init.method).toBe("POST");
    const corpo = JSON.parse(init.body as string) as { nome: string; identificadores: Array<{ tipo: string; valor: string }> };
    expect(corpo.nome).toBe("Ana");
    expect(corpo.identificadores.map((i) => i.tipo)).toEqual(["email", "telefone"]);
    expect(corpo.identificadores[0]?.valor.toLowerCase()).toBe("ana@x.com");
    await waitFor(() => expect(onCriado).toHaveBeenCalledTimes(1));
  });

  it("(a) sem Nome e sem Identificador mostra o erro do domínio e não chama o fetch", async () => {
    montar(<DialogoNovoContato open onClose={vi.fn()} onCriado={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Criar Contato" }));

    const validacao = validarContato({});
    expect(validacao.ok).toBe(false);
    const frase = validacao.ok ? "" : validacao.error;
    expect(await screen.findByText(frase)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(b) 409 IDENTIFICADOR_EM_USO mostra a frase e o link do detentor, e o diálogo fica aberto com os campos", async () => {
    fetchMock.mockResolvedValue(
      resposta(409, {
        ok: false,
        error: "E-mail ana@x.com já pertence ao Contato Ana Souza. Abra esse Contato ou use outro valor.",
        codigo: "IDENTIFICADOR_EM_USO",
        bloqueios: { contatos: [{ id: "c9", nome: "Ana Souza" }] },
      }),
    );
    const onCriado = vi.fn();
    montar(<DialogoNovoContato open onClose={vi.fn()} onCriado={onCriado} />);

    digitar("Nome", "Ana");
    digitar("E-mail", "ana@x.com");
    fireEvent.click(screen.getByRole("button", { name: "Criar Contato" }));

    expect(await screen.findByText(/já pertence ao Contato Ana Souza/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Ana Souza" });
    expect(link.getAttribute("href")).toBe("/crm/contatos/c9");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Ana");
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("ana@x.com");
    expect(onCriado).not.toHaveBeenCalled();
  });
});

const ENDERECO: Endereco = { rotulo: "residencial", principal: false };

describe("EditorDeEnderecos", () => {
  it("(c) marcar um endereço como principal desmarca o outro", () => {
    const onChange = vi.fn();
    render(<EditorDeEnderecos valor={[{ ...ENDERECO, principal: true }, ENDERECO]} onChange={onChange} />);
    const interruptores = screen.getAllByRole("switch");
    fireEvent.click(interruptores[1] as HTMLElement);
    const [lista, erro] = onChange.mock.calls[0] as [Endereco[], string | undefined];
    expect(lista.map((e) => e.principal)).toEqual([false, true]);
    expect(erro).toBeUndefined();
  });

  it("(c) no teto de endereços o botão de adicionar fica desligado e diz por quê", () => {
    const onChange = vi.fn();
    const cheio = Array.from({ length: LIMITES_CRM.enderecosMaximo }, () => ENDERECO);
    const { container } = render(<EditorDeEnderecos valor={cheio} onChange={onChange} />);
    expect(container.textContent).toContain("Adicionar endereço");
    const botao = screen.getByRole("button", { name: "Adicionar endereço" });
    expect(botao.getAttribute("aria-disabled")).toBe("true");
    expect(botao.getAttribute("title")).toBe(`No máximo ${LIMITES_CRM.enderecosMaximo} endereços.`);
    fireEvent.click(botao);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("EditorDeCamposAdicionais", () => {
  it("(c) recusa chave repetida antes de enviar", () => {
    const onChange = vi.fn();
    render(<EditorDeCamposAdicionais valor={{ signo: "leão" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar campo" }));
    const nomes = screen.getAllByLabelText("Nome do campo");
    fireEvent.change(nomes[1] as HTMLElement, { target: { value: "signo" } });
    fireEvent.change(screen.getAllByLabelText("Valor")[1] as HTMLElement, { target: { value: "touro" } });
    const [, erro] = onChange.mock.calls.at(-1) as [unknown, string | undefined];
    expect(erro).toBe("Já existe um campo adicional chamado “signo”.");
    expect(screen.getByRole("alert").textContent).toBe(erro);
  });

  it("(c) recusa chave vazia quando há valor, e ignora a linha em branco", () => {
    const onChange = vi.fn();
    render(<EditorDeCamposAdicionais valor={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar campo" }));
    expect(onChange.mock.calls.at(-1)?.[1]).toBeUndefined();
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "x" } });
    expect(onChange.mock.calls.at(-1)?.[1]).toBe("O nome de um campo adicional não pode ficar vazio.");
  });

  it("(c) um valor que veio como número e não foi tocado volta como número", () => {
    const onChange = vi.fn();
    render(<EditorDeCamposAdicionais valor={{ filhos: 2 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar campo" }));
    const [campos, erro] = onChange.mock.calls.at(-1) as [Record<string, unknown>, string | undefined];
    expect(campos).toEqual({ filhos: 2 });
    expect(erro).toBeUndefined();
  });
});
