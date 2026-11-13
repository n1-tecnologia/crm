// @vitest-environment jsdom
/**
 * 08-08 — a jornada de conexão (D-05..D-08) provada por teste de componente:
 *
 *   - a tela dos quatro cartões (D-06), com o botão desabilitado e o motivo de
 *     B35 para quem não é Administrador ou Proprietário;
 *   - a página de orientação de um provedor (D-07): passos, espaço reservado e o
 *     formulário que cria o Canal por `POST /canais` com Fila padrão (D-08),
 *     re-hidrata e abre a ficha do Canal novo;
 *   - a recusa 409 do servidor, que fica na tela;
 *   - o slug que não é provedor, que vira `notFound()` (T-08-33);
 *   - as rotas novas reconhecidas como `tabela` (Pitfall 7).
 *
 * Nenhuma rede: `fetch` roteado, sessão falsa, `StoreProvider` de verdade com o
 * seed e um `Transporte` cujo `hidratar` é espião.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { PROVEDORES_DE_CANAL } from "@n1/dominio/provedores-de-canal";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import ConectarCanalPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/page";
import ConectarProvedorPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]/page";
import ConfiguracoesDaCaixaPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/page";
import { ORIENTACAO_DO_PROVEDOR } from "@/features/crm/conectar-canal";
import { chaveDeChegada, formaDe } from "@/features/shell/rotas";

const { obterSessao, router } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
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

const ID_DO_CANAL = "9b2f6c1e-0808-4c3a-9f00-000000000001";
const FRASE_B35 = "Só Administrador ou Proprietário conecta, configura, simula conexão, desconecta e arquiva Canais (B35).";
const DESTINO = "/crm/caixa-de-entrada/configuracoes";

const CANAL_DA_LISTA = {
  id: "c-lista",
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
};

let fetchMock: ReturnType<typeof vi.fn>;
let hidratar: ReturnType<typeof vi.fn>;
let respostaDoPost: () => Response;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  router.push.mockReset();
  router.replace.mockReset();
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });

  const seed = buildSeed();
  hidratar = vi.fn(async () => ({ data: seed, revisao: 2, ordens: {}, memberId: "mem_rafael" }));
  respostaDoPost = () => resposta(201, { ok: true, dados: { id: ID_DO_CANAL } });
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if ((init.method ?? "GET") === "POST" && url === "http://api/canais") return respostaDoPost();
    // As Configurações da Caixa leem os Canais da api (15-12): um Canal ativo e nenhum arquivado.
    const alvo = new URL(String(url));
    if ((init.method ?? "GET") === "GET" && alvo.pathname === "/canais") {
      const itens = alvo.searchParams.get("estado") === "arquivado" ? [] : [CANAL_DA_LISTA];
      return resposta(200, { ok: true, itens, total: itens.length });
    }
    return resposta(404, { ok: false, error: "Rota não encontrada." });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
});

function provedores(filhos: React.ReactNode, memberId = "mem_rafael") {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: hidratar as unknown as Transporte["hidratar"],
  };
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        {filhos}
      </StoreProvider>
    </SWRConfig>
  );
}

function posts() {
  return fetchMock.mock.calls.filter(([url, init]) => url === "http://api/canais" && (init as RequestInit | undefined)?.method === "POST");
}

async function preencherEConectar(filaNome?: string) {
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Suporte" } });
  fireEvent.change(screen.getByLabelText(/^Número/), { target: { value: "+55 11 97777-0001" } });
  if (filaNome) {
    fireEvent.click(screen.getByRole("combobox", { name: /Setor/ }));
    fireEvent.click(await screen.findByRole("option", { name: filaNome }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
}

describe("08-08 — a tela dos quatro cartões (D-06)", () => {
  it("mostra exatamente os quatro provedores, cada um com o link para a sua página", () => {
    render(provedores(<ConectarCanalPage />));
    const itens = screen.getAllByRole("listitem");
    expect(itens).toHaveLength(4);
    const rotulos = ["WhatsApp oficial", "WhatsApp não oficial", "Instagram", "E-mail"];
    rotulos.forEach((rotulo, indice) => {
      expect(within(itens[indice]!).getByText(rotulo)).toBeTruthy();
      expect(within(itens[indice]!).getByText(ORIENTACAO_DO_PROVEDOR[PROVEDORES_DE_CANAL[indice]!].quandoUsar)).toBeTruthy();
    });
    const links = screen.getAllByRole("link", { name: "Conectar" }).map((a) => a.getAttribute("href"));
    expect(links).toEqual(PROVEDORES_DE_CANAL.map((p) => `${DESTINO}/canais/conectar/${p}`));
  });

  it("Membro: os quatro Conectar ficam desabilitados com a frase de B35", () => {
    render(provedores(<ConectarCanalPage />, "mem_maryane"));
    expect(screen.queryAllByRole("link", { name: "Conectar" })).toHaveLength(0);
    const botoes = screen.getAllByRole("button", { name: "Conectar" });
    expect(botoes).toHaveLength(4);
    for (const botao of botoes) {
      expect(botao.getAttribute("aria-disabled")).toBe("true");
      expect(botao.getAttribute("title")).toBe(FRASE_B35);
    }
  });

  it("as Configurações da Caixa têm o botão Conectar Canal: link para o Administrador, desabilitado para o Membro", async () => {
    const { unmount } = render(provedores(<ConfiguracoesDaCaixaPage />));
    // Espera os Canais chegarem: sem eles a seção mostraria o estado vazio, com um segundo botão.
    expect(await screen.findByText("Comercial SP")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Conectar Canal" }).getAttribute("href")).toBe(`${DESTINO}/canais/conectar`);
    unmount();

    render(provedores(<ConfiguracoesDaCaixaPage />, "mem_maryane"));
    expect(await screen.findByText("Comercial SP")).toBeTruthy();
    const botao = screen.getByRole("button", { name: "Conectar Canal" });
    expect(botao.getAttribute("aria-disabled")).toBe("true");
    expect(botao.getAttribute("title")).toBe(FRASE_B35);
  });
});

describe("08-08 — a página de orientação do provedor (D-07, D-08)", () => {
  it("mostra os passos e o espaço reservado, e Conectar cria o Canal com a Fila, re-hidrata e abre a ficha com o QR code", async () => {
    const pagina = await ConectarProvedorPage({ params: Promise.resolve({ provedor: "whatsapp-nao-oficial" }) });
    render(provedores(pagina));

    const orientacao = ORIENTACAO_DO_PROVEDOR["whatsapp-nao-oficial"];
    expect(orientacao.passos).toHaveLength(3);
    for (const passo of orientacao.passos) expect(screen.getByText(passo)).toBeTruthy();
    expect(screen.getByText("QR code da sessão")).toBeTruthy();
    // Sessão 4: o WhatsApp não oficial já conecta de verdade pela ficha do Canal, como o Instagram.
    expect(screen.getByText("na ficha do Canal, depois de criar")).toBeTruthy();
    expect(screen.getByText("Depois de criar o Canal, o QR code aparece aqui.")).toBeTruthy();
    expect(screen.queryByText("disponível quando a integração chegar")).toBeNull();

    await preencherEConectar("Suporte");
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));

    expect(posts()).toHaveLength(1);
    const init = posts()[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      provedor: "whatsapp-nao-oficial",
      nome: "Suporte",
      identificador: "+55 11 97777-0001",
      filaPadraoId: "fila_sup",
    });
    expect(hidratar).toHaveBeenCalledTimes(1);
    // Sessão 4 (4.2.4): o não oficial abre a ficha já com o painel do QR code (`?conectar=1`).
    expect(router.push).toHaveBeenCalledWith(`${DESTINO}/canais/${ID_DO_CANAL}?conectar=1`);
  });

  it("Sessão 7: o WhatsApp oficial pede o token na ficha do Canal: os passos de 7.1, a pílula nova e a ficha aberta com `?conectar=1`", async () => {
    const pagina = await ConectarProvedorPage({ params: Promise.resolve({ provedor: "whatsapp-cloud" }) });
    render(provedores(pagina));

    const orientacao = ORIENTACAO_DO_PROVEDOR["whatsapp-cloud"];
    expect(orientacao.passos).toHaveLength(3);
    for (const passo of orientacao.passos) expect(screen.getByText(passo)).toBeTruthy();
    expect(screen.getByText("Token de acesso e número verificado")).toBeTruthy();
    expect(screen.getByText(orientacao.espacoReservado.texto)).toBeTruthy();
    expect(screen.getByText("na ficha do Canal, depois de criar")).toBeTruthy();
    expect(screen.queryByText("disponível quando a integração chegar")).toBeNull();

    await preencherEConectar();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(router.push).toHaveBeenCalledWith(`${DESTINO}/canais/${ID_DO_CANAL}?conectar=1`);
  });

  it("o e-mail segue como estava: a pílula antiga e a ficha aberta sem `?conectar=1`", async () => {
    const pagina = await ConectarProvedorPage({ params: Promise.resolve({ provedor: "email-imap-smtp" }) });
    render(provedores(pagina));

    expect(screen.getByText("disponível quando a integração chegar")).toBeTruthy();
    expect(screen.queryByText("na ficha do Canal, depois de criar")).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Suporte" } });
    fireEvent.change(screen.getByLabelText(/^Endereço de e-mail/), { target: { value: "suporte@exemplo.com.br" } });
    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(router.push).toHaveBeenCalledWith(`${DESTINO}/canais/${ID_DO_CANAL}`);
  });

  it("sem escolher Fila nem Origem, o corpo não leva filaPadraoId nem origemPadraoId", async () => {
    const pagina = await ConectarProvedorPage({ params: Promise.resolve({ provedor: "whatsapp-nao-oficial" }) });
    render(provedores(pagina));
    await preencherEConectar();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(Object.keys(JSON.parse((posts()[0]![1] as RequestInit).body as string) as object).sort()).toEqual(["identificador", "nome", "provedor"]);
  });

  it("409 de conta em uso: a frase do servidor aparece e a tela não navega", async () => {
    respostaDoPost = () =>
      resposta(409, {
        ok: false,
        error: "Esta conta já está conectada em outro Canal ativo.",
        codigo: "CANAL_CONTA_EM_USO",
        campo: "identificador",
        bloqueios: { canais: [{ id: "chn_wpp", nome: "WhatsApp Comercial" }] },
      });
    const pagina = await ConectarProvedorPage({ params: Promise.resolve({ provedor: "whatsapp-nao-oficial" }) });
    render(provedores(pagina));
    await preencherEConectar();

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe("Esta conta já está conectada em outro Canal ativo.");
    expect(screen.getByRole("link", { name: "ver o Canal" }).getAttribute("href")).toBe(`${DESTINO}/canais/chn_wpp`);
    expect(router.push).not.toHaveBeenCalled();
    expect(hidratar).not.toHaveBeenCalled();
  });

  it("um slug que não é provedor vira notFound()", async () => {
    await expect(ConectarProvedorPage({ params: Promise.resolve({ provedor: "telegram" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("08-08 — as rotas novas (Pitfall 7)", () => {
  it("são da família tabela e a chave de chegada é o próprio caminho", () => {
    for (const caminho of [`${DESTINO}/canais/conectar`, `${DESTINO}/canais/conectar/whatsapp-cloud`]) {
      expect(formaDe(caminho)).toBe("tabela");
      expect(chaveDeChegada(caminho)).toBe(caminho);
    }
  });
});
