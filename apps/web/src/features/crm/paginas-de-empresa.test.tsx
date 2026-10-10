// @vitest-environment jsdom
/**
 * 07-09 Task 3 — as páginas de Empresa leem e gravam só pela api (D-04): a lista
 * com abas Ativas/Arquivadas/Lixeira, a Lixeira que restaura pedindo o Contato
 * admin (D-08), o popup `?empresa=<id>` com a ficha nova e o recuo da página
 * `[empresa]` para a ficha antiga quando a api responde 404 para um id do modelo
 * antigo (D-15). O teste mora em `features/crm/` porque `app/` só guarda
 * convenção de arquivo do Next. Nenhuma rede: `fetch` roteado, sessão falsa,
 * `StoreProvider` de verdade com o seed.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import EmpresaPage from "@/app/(shell)/crm/empresas/[empresa]/page";
import EmpresasPage from "@/app/(shell)/crm/empresas/page";

const { obterSessao, navegacao } = vi.hoisted(() => ({ obterSessao: vi.fn(), navegacao: { busca: "" } }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/empresas",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navegacao.busca),
}));

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const RESUMO = {
  id: "e1",
  nomeDeExibicao: "Alfa",
  dominioPrincipal: "alfa.com",
  documentoPrincipal: "12345678000190",
  matriz: { id: "e0", nome: "Grupo Alfa" },
  proprietarioId: "mem_julia",
  estado: "ativo",
  atualizadoEm: "2026-10-01T10:00:00.000Z",
};

function detalhado(estado: "ativo" | "arquivado" | "na_lixeira" = "ativo") {
  return {
    empresa: {
      id: "e1",
      nomeFantasia: "Alfa",
      razaoSocial: "Alfa Comércio Ltda",
      descricao: null,
      matrizId: null,
      enderecos: [],
      camposAdicionais: {},
      origem: null,
      estado,
      proprietarioId: "mem_julia",
      criadoPor: "mem_julia",
      criadoEm: "2026-10-01T10:00:00.000Z",
      atualizadoEm: "2026-10-01T10:00:00.000Z",
    },
    identificadores: [],
    vinculos: [
      { id: "v1", contatoId: "c1", contatoNome: "Ana Souza", contatoEstado: "ativo", cargo: null, admin: true, inicio: "2025-01-10", fim: estado === "na_lixeira" ? "2026-10-01" : null },
    ],
    matriz: null,
    filiais: [],
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, () => Response>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  navegacao.busca = "";
  rotas = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const rota = rotas[`${init.method ?? "GET"} ${url.replace("http://api", "")}`];
    return rota ? rota() : resposta(404, { ok: false, error: "Empresa não encontrada.", codigo: "EMPRESA_NAO_ENCONTRADA" });
  });
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

function provedores(filhos: React.ReactNode, memberId = "mem_julia") {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        {filhos}
      </StoreProvider>
    </SWRConfig>
  );
}

function listaAtiva(itens: unknown[] = [RESUMO]) {
  rotas["GET /empresas?estado=ativo&limite=50&deslocamento=0"] = () => resposta(200, { ok: true, itens, total: itens.length });
}

describe("página /crm/empresas — a lista pela api", () => {
  it("(a) mostra as colunas vindas da api e abre o popup por ?empresa=<id> mantendo a aba", async () => {
    listaAtiva();
    render(provedores(<EmpresasPage />));
    expect(await screen.findByText("Alfa", undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText("alfa.com")).toBeTruthy();
    expect(screen.getByText("Grupo Alfa")).toBeTruthy();
    expect(screen.getByText("Júlia Prado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nova Empresa" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Alfa/ }).getAttribute("href")).toContain("/crm/empresas?empresa=e1");
    expect(screen.getByRole("tab", { name: "Ativas" })).toBeTruthy();
  });

  it("(a) um Convidado não vê Nova Empresa", async () => {
    listaAtiva();
    render(provedores(<EmpresasPage />, "mem_beatriz"));
    expect(await screen.findByText("Alfa", undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nova Empresa" })).toBeNull();
  });

  it("(a) lista vazia diz que a Empresa nasce com um Contato admin", async () => {
    listaAtiva([]);
    render(provedores(<EmpresasPage />));
    expect(await screen.findByText("Nenhuma Empresa ainda.", undefined, { timeout: 3000 })).toBeTruthy();
    expect(document.body.textContent).toContain("ela nasce com um Contato admin");
  });

  it("(b) o popup ?empresa=e1 abre a ficha nova da api, com o rodapé para a página cheia", async () => {
    navegacao.busca = "empresa=e1";
    listaAtiva();
    rotas["GET /empresas/e1"] = () => resposta(200, { ok: true, dados: detalhado() });
    render(provedores(<EmpresasPage />));
    const link = await screen.findByRole("link", { name: "Abrir página cheia" }, { timeout: 3000 });
    expect(link.getAttribute("href")).toBe("/crm/empresas/e1");
    expect(document.body.textContent).toContain("Alfa Comércio Ltda");
  });

  it("(c) na Lixeira, Restaurar pede o Contato admin (pré-preenchido) e manda POST /restaurar com o admin", async () => {
    navegacao.busca = "estado=na_lixeira";
    rotas["GET /empresas?estado=na_lixeira&limite=50&deslocamento=0"] = () =>
      resposta(200, { ok: true, itens: [{ ...RESUMO, estado: "na_lixeira" }], total: 1 });
    rotas["GET /empresas/e1"] = () => resposta(200, { ok: true, dados: detalhado("na_lixeira") });
    rotas["POST /empresas/e1/restaurar"] = () => resposta(200, { ok: true, dados: detalhado() });
    render(provedores(<EmpresasPage />));

    expect(await screen.findByRole("button", { name: "Excluir permanentemente" }, { timeout: 3000 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    // O diálogo troca de "Carregando…" para o pedido de admin quando a ficha chega: relê o nó.
    await screen.findByRole("alertdialog");
    expect(await screen.findByText("Ana Souza", undefined, { timeout: 3000 })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restaurar Empresa" }));

    await waitFor(() => {
      const chamada = (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>).find(([url, init]) => init?.method === "POST" && url.endsWith("/restaurar"));
      expect(chamada?.[1]?.body).toBe(JSON.stringify({ admin: { contatoId: "c1" } }));
    });
  });

  it("(d) nas Arquivadas, Restaurar vai direto, sem pedir admin", async () => {
    navegacao.busca = "estado=arquivado";
    rotas["GET /empresas?estado=arquivado&limite=50&deslocamento=0"] = () =>
      resposta(200, { ok: true, itens: [{ ...RESUMO, estado: "arquivado" }], total: 1 });
    rotas["POST /empresas/e1/restaurar"] = () => resposta(200, { ok: true, dados: detalhado() });
    render(provedores(<EmpresasPage />));
    fireEvent.click(await screen.findByRole("button", { name: "Restaurar" }, { timeout: 3000 }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => (init as RequestInit | undefined)?.method === "POST" && String(url).endsWith("/restaurar"))).toBe(true));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("página /crm/empresas/[empresa] — a ficha e o recuo para o modelo antigo (D-15)", () => {
  async function montarPagina(id: string) {
    const params = Promise.resolve({ empresa: id });
    let resultado!: ReturnType<typeof render>;
    await act(async () => {
      resultado = render(
        provedores(
          <Suspense fallback="carregando">
            <EmpresaPage params={params} />
          </Suspense>,
        ),
      );
    });
    return resultado.container;
  }

  it("(e) a api conhece o id: desenha a ficha nova", async () => {
    rotas["GET /empresas/e1"] = () => resposta(200, { ok: true, dados: detalhado() });
    const container = await montarPagina("e1");
    await vi.waitFor(() => expect(container.textContent).toContain("Matriz e filiais"), { timeout: 3000 });
    expect(container.textContent).toContain("Alfa Comércio Ltda");
  });

  it("(f) 404 da api para um id que não existe em lugar nenhum mostra Empresa não encontrada", async () => {
    const container = await montarPagina("nao-existe");
    await vi.waitFor(() => expect(container.textContent).toContain("Empresa não encontrada."), { timeout: 3000 });
    expect(container.textContent).toContain("Ela pode ter sido excluída permanentemente.");
  });

  it("(g) 404 da api para um id do modelo antigo abre a ficha antiga, sem o que é só da nova", async () => {
    const antiga = buildSeed().companies[0]!;
    const container = await montarPagina(antiga.id);
    await vi.waitFor(() => expect(container.textContent).toContain("Grupo"), { timeout: 3000 });
    expect(container.textContent).not.toContain("Empresa não encontrada.");
    expect(container.textContent).not.toContain("Matriz e filiais");
  });
});
