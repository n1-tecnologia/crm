// @vitest-environment jsdom
/**
 * 08-01 Task 1 — a fatia web do traçador: a página `[provedor]` renderiza o
 * formulário, "Conectar" dispara um `POST /canais` só com `provedor`, `nome` e
 * `identificador` (e o Bearer da sessão), o estado é re-hidratado e a lista das
 * Configurações da Caixa de Entrada (que lê `GET /canais`) mostra o Canal novo com
 * o selo do provedor e a marca "cadastrado", ao lado do que já existia (15-12).
 * O slug que não é provedor vira `notFound()` (T-08-08).
 *
 * O teste mora em `features/crm/` porque `app/` só guarda convenção de arquivo
 * do Next. Nenhuma rede: `fetch` roteado, sessão falsa, `StoreProvider` de
 * verdade com o seed e um `Transporte` cujo `hidratar` é espião.
 */

import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig, useSWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import ConectarProvedorPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]/page";
import ConfiguracoesDaCaixaPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/page";

const { obterSessao, router, revalidador } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
  revalidador: { revalidar: undefined as undefined | ((prefixo: string) => Promise<unknown>) },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  // `invalidarCrm` real usa o `mutate` global; aqui ele repassa o prefixo ao `mutate` do cache isolado do teste.
  return { ...real, invalidarCrm: vi.fn(async (prefixo: string) => revalidador.revalidar?.(prefixo)) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada/configuracoes",
  useRouter: () => router,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const ID_DO_POST = "9b2f6c1e-0801-4c3a-9f00-000000000001";
const NOME = "Canal do Traçador";

let fetchMock: ReturnType<typeof vi.fn>;
let hidratar: ReturnType<typeof vi.fn>;
/** Os Canais ativos que `GET /canais` devolve; o POST acrescenta o novo, como a api. */
let canaisDaApi: Array<Record<string, unknown>>;

/** O Canal da 008 como a api o devolve (camelCase em português). */
function canalDaApi(sobre: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "c-seed",
    nome: "Comercial SP",
    tipo: "whatsapp",
    provedor: "whatsapp-cloud",
    identificadorExterno: "+5511987654321",
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: null,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_rafael",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_rafael",
    criadoEm: "2026-11-01T00:00:00.000Z",
    atualizadoEm: "2026-11-01T00:00:00.000Z",
    ...sobre,
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  router.push.mockReset();
  router.replace.mockReset();
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });

  const seed = buildSeed();
  canaisDaApi = [canalDaApi({})];
  // O Canal novo como a api o devolve do POST (nasce `desconectada`, D-08).
  const criado = canalDaApi({ id: ID_DO_POST, nome: NOME, provedor: "whatsapp-nao-oficial", identificadorExterno: "+5511977770001", conexao: "desconectada" });
  hidratar = vi.fn(async () => ({ data: seed, revisao: 2, ordens: {}, memberId: "mem_rafael" }));

  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? "GET";
    if (metodo === "POST" && url === "http://api/canais") {
      canaisDaApi = [...canaisDaApi, criado];
      return resposta(201, { ok: true, dados: criado });
    }
    const alvo = new URL(String(url));
    if (metodo === "GET" && alvo.pathname === "/canais") {
      const itens = alvo.searchParams.get("estado") === "arquivado" ? [] : canaisDaApi;
      return resposta(200, { ok: true, itens, total: itens.length });
    }
    return resposta(404, { ok: false, error: "Rota não encontrada." });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
});

function RegistrarRevalidacao() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    revalidador.revalidar = (prefixo) => mutate((chave) => typeof chave === "string" && chave.startsWith(prefixo));
    return () => {
      revalidador.revalidar = undefined;
    };
  }, [mutate]);
  return null;
}

function provedores(filhos: React.ReactNode) {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: hidratar as unknown as Transporte["hidratar"],
  };
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <RegistrarRevalidacao />
      <StoreProvider sessao={{ memberId: "mem_rafael" }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        {filhos}
      </StoreProvider>
    </SWRConfig>
  );
}

describe("08-01 traçador — web", () => {
  it("(p) a página [provedor] cria o Canal, re-hidrata e a lista mostra os selos de provedor e de origem", async () => {
    const pagina = await ConectarProvedorPage({ params: Promise.resolve({ provedor: "whatsapp-nao-oficial" }) });
    render(
      provedores(
        <>
          {pagina}
          <ConfiguracoesDaCaixaPage />
        </>,
      ),
    );

    expect(screen.queryByText(NOME)).toBeNull();
    expect(screen.getByRole("heading", { name: "Conectar WhatsApp não oficial" })).toBeTruthy();
    expect(screen.getByText("O Canal nasce desconectado: a conexão com o provedor acontece depois.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: NOME } });
    fireEvent.change(screen.getByLabelText(/^Número/), { target: { value: "+55 11 97777-0001" } });
    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));

    const posts = fetchMock.mock.calls.filter(([url, init]) => url === "http://api/canais" && (init as RequestInit | undefined)?.method === "POST");
    expect(posts).toHaveLength(1);
    const init = posts[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer tok");
    expect(Object.keys(JSON.parse(init.body as string) as object).sort()).toEqual(["identificador", "nome", "provedor"]);
    expect(JSON.parse(init.body as string)).toEqual({
      provedor: "whatsapp-nao-oficial",
      nome: NOME,
      identificador: "+55 11 97777-0001",
    });

    expect(hidratar).toHaveBeenCalledTimes(1);
    expect(String(router.push.mock.calls[0]![0]).startsWith("/crm/caixa-de-entrada/configuracoes")).toBe(true);

    const itemNovo = (await screen.findByText(NOME)).closest("li")!;
    expect(within(itemNovo).getByText("não oficial")).toBeTruthy();
    expect(within(itemNovo).getByText("cadastrado")).toBeTruthy();

    // O Canal que já existia na api segue na lista, sem a marca de demonstração (todo Canal é da tabela).
    const itemAntigo = screen.getByText("Comercial SP").closest("li")!;
    expect(within(itemAntigo).getByText("oficial")).toBeTruthy();
    expect(within(itemAntigo).queryByText("demo")).toBeNull();
  });

  it("(q) um slug que não é provedor vira notFound()", async () => {
    await expect(ConectarProvedorPage({ params: Promise.resolve({ provedor: "telegram" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("o botão fica desabilitado com o motivo até o nome e o número estarem certos", async () => {
    const pagina = await ConectarProvedorPage({ params: Promise.resolve({ provedor: "email-imap-smtp" }) });
    render(provedores(pagina));
    const botao = screen.getByRole("button", { name: "Conectar" }) as HTMLButtonElement;
    expect(botao.getAttribute("aria-disabled") === "true" || botao.disabled).toBe(true);
    fireEvent.click(botao);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
