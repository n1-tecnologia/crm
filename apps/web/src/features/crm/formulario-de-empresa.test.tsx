// @vitest-environment jsdom
/**
 * 07-09 Task 1 — o `SeletorDeRegistro` busca na api com espera de 300 ms e
 * respeita `excluirIds`; o diálogo "Nova Empresa" exige o Contato admin no mesmo
 * envio (D-08): sem ele, Criar fica desligado com o motivo; com um Contato
 * existente ou um novo, vai tudo num `POST /empresas`; a recusa 409 aparece com
 * o link do detentor e o diálogo continua aberto. Nenhuma rede: `fetch` falso,
 * sessão falsa, `StoreProvider` de verdade com o seed.
 *
 * A espera da busca é provada com o relógio de verdade (o `waitFor` do
 * Testing Library não anda com `vi.useFakeTimers`): nada sai antes dos 300 ms e
 * duas digitações seguidas viram uma ida só.
 */

import { useState, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { validarEmpresa } from "@n1/dominio/crm/empresas";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { DialogoNovaEmpresa } from "./formulario-de-empresa";
import { SeletorDeRegistro, type RegistroEscolhido } from "./seletor-de-registro";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/empresas",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const CONTATOS = {
  ok: true,
  total: 2,
  itens: [
    { id: "c1", nomeDeExibicao: "Ana Souza", estado: "ativo", proprietarioId: "mem_julia", emailPrincipal: "ana@x.com", telefonePrincipal: null, atualizadoEm: "2026-10-01T10:00:00.000Z" },
    { id: "c2", nomeDeExibicao: "Ana Lima", estado: "ativo", proprietarioId: "mem_julia", emailPrincipal: null, telefonePrincipal: "+5511987654321", atualizadoEm: "2026-10-01T10:00:00.000Z" },
  ],
};

const CRIADA = {
  ok: true,
  dados: { empresa: { id: "e1", nomeFantasia: "Alfa" }, identificadores: [], vinculos: [], matriz: null, filiais: [] },
};

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

function urlsChamadas(): string[] {
  return (fetchMock.mock.calls as Array<[string, RequestInit]>).map(([url]) => url.replace("http://api", ""));
}

function digitar(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

/** O Seletor num estado de verdade: `onChange` guarda o escolhido e o espia. */
function Harness({
  recurso = "contatos",
  excluirIds,
  aoEscolher,
}: {
  readonly recurso?: "contatos" | "empresas";
  readonly excluirIds?: readonly string[];
  readonly aoEscolher: (valor: RegistroEscolhido | null) => void;
}) {
  const [valor, setValor] = useState<RegistroEscolhido | null>(null);
  return (
    <SeletorDeRegistro
      recurso={recurso}
      rotulo="Buscar Contato"
      valor={valor}
      {...(excluirIds ? { excluirIds } : {})}
      onChange={(proximo) => {
        setValor(proximo);
        aoEscolher(proximo);
      }}
    />
  );
}

describe("SeletorDeRegistro", () => {
  it("(b) busca GET /contatos?q=ana&limite=10&estado=ativo depois de 300 ms, lista os nomes e devolve o id escolhido", async () => {
    fetchMock.mockResolvedValue(resposta(200, CONTATOS));
    const aoEscolher = vi.fn();
    montar(<Harness aoEscolher={aoEscolher} />);

    digitar("Buscar Contato", "an");
    digitar("Buscar Contato", "ana");
    // Antes dos 300 ms nada saiu: digitar não dispara uma ida por letra.
    expect(fetchMock).not.toHaveBeenCalled();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(urlsChamadas()).toEqual(["/contatos?q=ana&limite=10&estado=ativo"]);

    expect(await screen.findByText("Ana Souza")).toBeTruthy();
    expect(screen.getByText("Ana Lima")).toBeTruthy();
    // O desempate vem em segunda linha.
    expect(screen.getByText("ana@x.com")).toBeTruthy();

    fireEvent.click(screen.getByText("Ana Souza"));
    expect(aoEscolher).toHaveBeenCalledWith({ id: "c1", nome: "Ana Souza" });
    // Escolhido: o nome fica e a busca some, com "Trocar" para voltar.
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    expect(aoEscolher).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("(b) ids em excluirIds não aparecem, e lista vazia diz 'Nenhum resultado.'", async () => {
    fetchMock.mockResolvedValue(resposta(200, CONTATOS));
    montar(<Harness aoEscolher={vi.fn()} excluirIds={["c2"]} />);
    digitar("Buscar Contato", "ana");
    expect(await screen.findByText("Ana Souza", undefined, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByText("Ana Lima")).toBeNull();
    cleanup();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [], total: 0 }));
    montar(<Harness aoEscolher={vi.fn()} />);
    digitar("Buscar Contato", "zzz");
    expect(await screen.findByText("Nenhum resultado.", undefined, { timeout: 2000 })).toBeTruthy();
  });

  it("(b) a recusa da api vira a frase dela dentro da lista", async () => {
    fetchMock.mockResolvedValue(resposta(403, { ok: false, error: "Sem permissão para ver Contatos.", codigo: "SEM_PERMISSAO" }));
    montar(<Harness aoEscolher={vi.fn()} />);
    digitar("Buscar Contato", "ana");
    expect(await screen.findByText("Sem permissão para ver Contatos.", undefined, { timeout: 2000 })).toBeTruthy();
  });

  it("(b) Empresas buscam em /empresas e mostram o domínio como desempate", async () => {
    fetchMock.mockResolvedValue(
      resposta(200, {
        ok: true,
        total: 1,
        itens: [
          { id: "e9", nomeDeExibicao: "Alfa SA", dominioPrincipal: "alfa.com", documentoPrincipal: null, matriz: null, proprietarioId: "mem_julia", estado: "ativo", atualizadoEm: "2026-10-01T10:00:00.000Z" },
        ],
      }),
    );
    montar(<Harness recurso="empresas" aoEscolher={vi.fn()} />);
    digitar("Buscar Contato", "alfa");
    expect(await screen.findByText("Alfa SA", undefined, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByText("alfa.com")).toBeTruthy();
    expect(urlsChamadas()[0]).toBe("/empresas?q=alfa&limite=10&estado=ativo");
  });
});

/** Escolhe "Ana Souza" no Seletor de Contato existente do diálogo. */
async function escolherAdminExistente() {
  digitar("Buscar Contato admin", "ana");
  fireEvent.click(await screen.findByText("Ana Souza", undefined, { timeout: 2000 }));
}

function botaoCriar(): HTMLElement {
  return screen.getByRole("button", { name: "Criar Empresa" });
}

function roteador() {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.startsWith("http://api/contatos?")) return resposta(200, CONTATOS);
    if (url === "http://api/empresas" && init?.method === "POST") return resposta(201, CRIADA);
    return resposta(404, { ok: false, error: "não roteado" });
  });
}

describe("DialogoNovaEmpresa — o Contato admin vai junto (D-08)", () => {
  it("(c) sem nome fantasia nem razão social, Criar fica desligado com o motivo", () => {
    montar(<DialogoNovaEmpresa open onClose={vi.fn()} onCriado={vi.fn()} />);
    expect(document.body.textContent).toContain("A Empresa nasce com um Contato admin");
    expect(botaoCriar().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Informe o nome fantasia ou a razão social.")).toBeTruthy();
    // A frase é a do domínio, não uma segunda redação.
    const validacao = validarEmpresa({});
    expect(validacao.ok).toBe(false);
    fireEvent.click(botaoCriar());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(c) com nome mas sem Contato admin, Criar fica desligado dizendo para escolher ou criar o admin", () => {
    montar(<DialogoNovaEmpresa open onClose={vi.fn()} onCriado={vi.fn()} />);
    digitar("Nome fantasia", "Alfa");
    expect(botaoCriar().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Escolha ou crie o Contato admin da Empresa.")).toBeTruthy();
    fireEvent.click(botaoCriar());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(c) com Contato existente envia admin { contatoId, cargo } num POST /empresas só", async () => {
    roteador();
    const onCriado = vi.fn();
    montar(<DialogoNovaEmpresa open onClose={vi.fn()} onCriado={onCriado} />);

    digitar("Nome fantasia", "Alfa");
    await escolherAdminExistente();
    digitar("Cargo", "Sócia");
    expect(botaoCriar().getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(botaoCriar());

    await waitFor(() => expect(onCriado).toHaveBeenCalledTimes(1));
    const gravacoes = (fetchMock.mock.calls as Array<[string, RequestInit]>).filter(([, init]) => init?.method === "POST");
    expect(gravacoes).toHaveLength(1);
    const [url, init] = gravacoes[0] as [string, RequestInit];
    expect(url).toBe("http://api/empresas");
    expect(JSON.parse(init.body as string)).toEqual({
      empresa: { nomeFantasia: "Alfa" },
      admin: { contatoId: "c1", cargo: "Sócia" },
    });
  });

  it("(c) com Novo Contato (Nome + e-mail) envia admin { novoContato, cargo } e os Identificadores da Empresa", async () => {
    roteador();
    const onCriado = vi.fn();
    montar(<DialogoNovaEmpresa open onClose={vi.fn()} onCriado={onCriado} />);

    digitar("Razão social", "Alfa Comércio Ltda");
    digitar("Domínio", "alfa.com");
    fireEvent.click(screen.getByRole("button", { name: "Novo Contato" }));
    digitar("Nome do Contato", "Beto");
    digitar("E-mail do Contato", "beto@alfa.com");
    digitar("Cargo", "CFO");
    expect(botaoCriar().getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(botaoCriar());

    await waitFor(() => expect(onCriado).toHaveBeenCalledTimes(1));
    const [, init] = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([, i]) => i?.method === "POST") as [string, RequestInit];
    const corpo = JSON.parse(init.body as string) as {
      empresa: { razaoSocial: string; identificadores: Array<{ tipo: string; valor: string }> };
      admin: { cargo: string; novoContato: { nome: string; identificadores: Array<{ tipo: string; valor: string }> } };
    };
    expect(corpo.empresa.razaoSocial).toBe("Alfa Comércio Ltda");
    expect(corpo.empresa.identificadores).toEqual([{ tipo: "dominio", valor: "alfa.com" }]);
    expect(corpo.admin.cargo).toBe("CFO");
    expect(corpo.admin.novoContato.nome).toBe("Beto");
    expect(corpo.admin.novoContato.identificadores[0]?.tipo).toBe("email");
    expect(corpo.admin.novoContato.identificadores[0]?.valor.toLowerCase()).toBe("beto@alfa.com");
  });

  it("(c) um domínio de provedor público é recusado pelo domínio antes de qualquer ida ao servidor", async () => {
    roteador();
    montar(<DialogoNovaEmpresa open onClose={vi.fn()} onCriado={vi.fn()} />);
    digitar("Nome fantasia", "Alfa");
    digitar("Domínio", "gmail.com");
    fireEvent.click(screen.getByRole("button", { name: "Novo Contato" }));
    digitar("Nome do Contato", "Beto");
    fireEvent.click(botaoCriar());
    const alertas = await screen.findAllByRole("alert");
    expect(alertas.some((a) => /provedor|público|publico/i.test(a.textContent ?? ""))).toBe(true);
    expect((fetchMock.mock.calls as Array<[string, RequestInit]>).some(([, i]) => i?.method === "POST")).toBe(false);
  });

  it("(c) 409 IDENTIFICADOR_EM_USO mostra a frase com o link do detentor e o diálogo continua aberto com os campos", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://api/contatos?")) return resposta(200, CONTATOS);
      if (init?.method === "POST") {
        return resposta(409, {
          ok: false,
          error: "Domínio alfa.com já pertence à Empresa Alfa SA. Abra essa Empresa ou use outro valor.",
          codigo: "IDENTIFICADOR_EM_USO",
          bloqueios: { empresas: [{ id: "e9", nome: "Alfa SA" }] },
        });
      }
      return resposta(404, { ok: false, error: "não roteado" });
    });
    const onCriado = vi.fn();
    montar(<DialogoNovaEmpresa open onClose={vi.fn()} onCriado={onCriado} />);

    digitar("Nome fantasia", "Alfa");
    digitar("Domínio", "alfa.com");
    await escolherAdminExistente();
    fireEvent.click(botaoCriar());

    expect(await screen.findByText(/já pertence à Empresa Alfa SA/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Alfa SA" });
    expect(link.getAttribute("href")).toBe("/crm/empresas/e9");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect((screen.getByLabelText("Nome fantasia") as HTMLInputElement).value).toBe("Alfa");
    expect((screen.getByLabelText("Domínio") as HTMLInputElement).value).toBe("alfa.com");
    expect(within(screen.getByRole("alertdialog")).getByText("Ana Souza")).toBeTruthy();
    expect(onCriado).not.toHaveBeenCalled();
  });
});
