// @vitest-environment jsdom
/**
 * 07-06 Task 3 — a ficha nova de Contato lê o `ContatoDetalhado` da api,
 * edita por `PATCH`, mostra a recusa D-09 com os links de `bloqueios` e deixa
 * o Contato `ativo` na tela, esconde a edição quando ele está na lixeira, e não
 * mostra nada do que a 007 não guarda (D-02). Nenhuma rede: `fetch` roteado por
 * URL, sessão falsa, `StoreProvider` de verdade com o seed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { podeNoCrm } from "@n1/dominio/crm/permissoes";
import type { ContatoDetalhado } from "@n1/dominio/crm/contatos";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { useContato } from "@/dados/crm/contatos";
import { FichaDeContato } from "./ficha-de-contato";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/contatos/c1",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function detalhado(sobre: Partial<ContatoDetalhado["contato"]> = {}): ContatoDetalhado {
  return {
    contato: {
      id: "c1",
      nome: "Ana",
      sobrenome: "Souza",
      dataNascimento: null,
      idioma: "pt-BR",
      fusoHorario: null,
      fotoUrl: null,
      descricao: null,
      enderecos: [],
      camposAdicionais: {},
      origem: null,
      qualificacao: null,
      modoCriacao: "manual",
      estado: "ativo",
      proprietarioId: "mem_julia",
      criadoPor: "mem_julia",
      criadoEm: "2026-10-01T10:00:00.000Z",
      atualizadoEm: "2026-10-01T10:00:00.000Z",
      ...sobre,
    },
    identificadores: [
      { id: "i1", contatoId: "c1", tipo: "email", valor: "ana@x.com", valorExibido: null, rotuloCanal: null, verificado: false, principal: true, criadoEm: "2026-10-01T10:00:00.000Z" },
      { id: "i2", contatoId: "c1", tipo: "email", valor: "ana2@x.com", valorExibido: null, rotuloCanal: null, verificado: true, principal: false, criadoEm: "2026-10-01T10:00:01.000Z" },
      { id: "i3", contatoId: "c1", tipo: "telefone", valor: "+5511987654321", valorExibido: "(11) 98765-4321", rotuloCanal: null, verificado: false, principal: true, criadoEm: "2026-10-01T10:00:02.000Z" },
    ],
    vinculos: [
      { id: "v1", empresaId: "e1", empresaNome: "Alfa", cargo: "Diretora", admin: true, inicio: "2025-01-10", fim: null },
      { id: "v2", empresaId: "e2", empresaNome: "Beta", cargo: null, admin: false, inicio: "2024-01-01", fim: "2024-12-31" },
    ],
  };
}

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

/** A página de verdade: `useContato` lê a ficha e `FichaDeContato` a desenha, então uma gravação revalida. */
function Pagina() {
  const { data } = useContato("c1");
  return data ? <FichaDeContato contatoId="c1" detalhado={data} /> : null;
}

function montar(memberId = "mem_julia") {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        <Pagina />
      </StoreProvider>
    </SWRConfig>,
  );
}

function chamadas(): string[] {
  return (fetchMock.mock.calls as Array<[string, RequestInit]>).map(([url, init]) => `${init.method} ${url.replace("http://api", "")}`);
}

describe("FichaDeContato — leitura", () => {
  it("(a) mostra nome, Proprietário, Identificadores com rótulo e selo, e Empresas vinculadas", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: detalhado() }));
    const { container } = montar();

    await vi.waitFor(() => expect(container.textContent).toContain("ana@x.com"));
    expect(container.textContent).toContain("Ana Souza");
    expect(container.textContent).toContain("Proprietário: Júlia Prado");
    expect(screen.getAllByText("E-mail").length).toBe(2);
    expect(screen.getByText("Telefone")).toBeTruthy();
    expect(screen.getByText("(11) 98765-4321")).toBeTruthy();
    expect(screen.getAllByText("principal").length).toBe(2);
    expect(screen.getByText("verificado")).toBeTruthy();

    const alfa = screen.getByRole("link", { name: "Alfa" });
    expect(alfa.getAttribute("href")).toBe("/crm/empresas/e1");
    expect(screen.getByText("Diretora")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    expect(container.textContent).toMatch(/desde .*2025/);
    expect(container.textContent).toMatch(/encerrado em .*2024/);
  });

  it("(e) não mostra Tags, Consentimentos, Comentários, Anexos, Conversas, Mesclar nem Temperatura", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: detalhado() }));
    const { container } = montar();
    await screen.findByText("ana@x.com");
    for (const proibido of ["Tags", "Consentimentos", "Comentários", "Anexos", "Conversas", "Mesclar", "Temperatura"]) {
      expect(container.textContent).not.toContain(proibido);
    }
  });
});

describe("FichaDeContato — Identificadores e ciclo de vida", () => {
  it("(b) Tornar principal manda PATCH com principal: true e a ficha revalida", async () => {
    const depois = detalhado();
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (init.method === "PATCH") return resposta(200, { ok: true, dados: depois });
      return resposta(200, { ok: true, dados: detalhado() });
    });
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Tornar principal" }));

    await waitFor(() => expect(chamadas()).toContain("PATCH /contatos/c1/identificadores/i2"));
    const patch = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([, init]) => init.method === "PATCH");
    expect(patch?.[1].body).toBe(JSON.stringify({ principal: true }));
    await waitFor(() => expect(chamadas().filter((c) => c === "GET /contatos/c1").length).toBeGreaterThanOrEqual(2));
  });

  it("(c) Excluir → confirmar → 409 CONTATO_BLOQUEADO mostra a frase e o link da Empresa, e o selo não vira na lixeira", async () => {
    const frase = "Este Contato não pode ir para a lixeira: é o único admin da Empresa Alfa. Antes, nomeie outro admin.";
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.method === "DELETE") {
        return resposta(409, {
          ok: false,
          error: frase,
          codigo: "CONTATO_BLOQUEADO",
          bloqueios: { empresas: [{ id: "e1", nome: "Alfa" }] },
        });
      }
      return resposta(200, { ok: true, dados: detalhado() });
    });
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar para a Lixeira" }));

    const aviso = await screen.findByText(frase);
    const caixa = aviso.closest('[role="alert"]') as HTMLElement;
    expect(within(caixa).getByRole("link", { name: "Alfa" }).getAttribute("href")).toBe("/crm/empresas/e1");
    expect(screen.queryByText("na lixeira")).toBeNull();
    expect(chamadas()).toContain("DELETE /contatos/c1");
  });

  it("(d) Contato na lixeira mostra Restaurar e Excluir permanentemente, e esconde Editar", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: detalhado({ estado: "na_lixeira" }) }));
    montar();

    await screen.findByText("ana@x.com");
    expect(screen.getByText("na lixeira")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir permanentemente" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tornar principal" })).toBeNull();
  });

  it("(f) um Convidado vê as ações desligadas com a frase do Papel", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: detalhado() }));
    montar("mem_beatriz");

    const excluir = await screen.findByRole("button", { name: "Excluir" });
    expect(excluir.getAttribute("aria-disabled")).toBe("true");
    expect(excluir.getAttribute("title")).toBe(podeNoCrm("convidado", "ativo", "enviar_para_lixeira", "contato"));
    fireEvent.click(excluir);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
