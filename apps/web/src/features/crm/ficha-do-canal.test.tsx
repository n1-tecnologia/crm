// @vitest-environment jsdom
/**
 * 08-09 Task 2 + 15-12 Task 2 — a ficha do Canal (`/crm/caixa-de-entrada/configuracoes/canais/[canal]`)
 * lê e grava o Canal só pela api (D-11), sem o caminho do Canal do seed:
 *
 *   - o Canal vem de `GET /canais/:id` (`useCanal`); 404 mostra "Canal não encontrado.";
 *   - o Administrador vê "Simular conexão" num Canal `desconectada`; o clique faz
 *     `POST /canais/:id/simular-conexao` sem corpo e sem `content-type` e
 *     re-hidrata o store (D-08);
 *   - o Membro não vê o botão (T-08-37: a tela só esconde, o servidor barra);
 *   - a conexão simulada nunca aparece sem a marca e o aviso de que nenhuma
 *     Mensagem sai da plataforma (T-08-36);
 *   - "Arquivar" pede confirmação e depois faz `POST …/arquivar`;
 *   - Setor/Origem gravam por `PATCH /canais/:id`, nunca pela operação antiga;
 *   - as Conversas do Canal vêm de `GET /conversas?canalId=…&limite=20` e o número
 *     mostrado é o `total` da resposta.
 *
 * O teste mora em `features/crm/` porque `app/` só guarda convenção de arquivo
 * do Next. Nenhuma rede: `fetch` roteado, sessão falsa, `StoreProvider` de
 * verdade com o seed e um `Transporte` cujo `hidratar` e `gravar` são espiões.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { FRASE_DO_CANAL_REAL, type CanalNaFicha } from "@n1/dominio/crm/canais";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import CanalPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page";

const { obterSessao, router, parametros } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
  parametros: { atual: new URLSearchParams() },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

const { irParaForaDoApp } = vi.hoisted(() => ({ irParaForaDoApp: vi.fn() }));
vi.mock("@/features/crm/ir-para-fora", () => ({ irParaForaDoApp }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada/configuracoes/canais/uuid-1",
  useRouter: () => router,
  useSearchParams: () => parametros.atual,
}));

const AVISO_DA_SIMULACAO = "Conexão simulada: o Canal aparece conectado para testar o chat, mas nenhuma Mensagem sai da plataforma.";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

/** O Canal da 008 como a api o devolve em `GET /canais/:id` (com o fato da ligação ao provedor, CR-01). */
function canalRelacional(sobre: Partial<CanalNaFicha> = {}): CanalNaFicha {
  return {
    id: "uuid-1",
    nome: "Suporte do Zap",
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: "+5511977770001",
    conexao: "desconectada",
    conexaoSimulada: false,
    conectadaEm: null,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_rafael",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    ligadoAoProvedor: false,
    // Os testes de 08-09 simulam a conexão: o servidor deles permite (PERMITIR_CONEXAO_SIMULADA, 4.3.4).
    simulacaoPermitida: true,
    criadoPor: "mem_rafael",
    criadoEm: "2026-11-01T00:00:00.000Z",
    atualizadoEm: "2026-11-01T00:00:00.000Z",
    ...sobre,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let hidratar: ReturnType<typeof vi.fn>;
let gravar: ReturnType<typeof vi.fn>;
let rotas: Record<string, () => Response>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  router.push.mockReset();
  router.replace.mockReset();
  parametros.atual = new URLSearchParams();
  rotas = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const rota = rotas[`${init.method ?? "GET"} ${String(url).replace("http://api", "")}`];
    return rota ? rota() : resposta(404, { ok: false, error: "Rota não prevista no teste.", codigo: "NAO_ENCONTRADO" });
  });
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  hidratar = vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." }));
  gravar = vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." }));
});

afterEach(() => {
  cleanup();
});

/** Seed + `GET /canais/<id>` devolvendo o Canal; `memberId` decide o Papel (Rafael administra, Júlia é Membro). */
async function montar(id: string, canal: CanalNaFicha | null, memberId = "mem_rafael", totalDeConversas = 3) {
  if (canal) rotas[`GET /canais/${id}`] = () => resposta(200, { ok: true, dados: canal });
  else rotas[`GET /canais/${id}`] = () => resposta(404, { ok: false, error: "Canal não encontrado.", codigo: "NAO_ENCONTRADO" });
  rotas[`GET /conversas?estado=ativo&canalId=${id}&limite=20&deslocamento=0`] = () =>
    resposta(200, { ok: true, itens: [], total: totalDeConversas });
  const transporte: Transporte = {
    gravar: gravar as unknown as Transporte["gravar"],
    hidratar: hidratar as unknown as Transporte["hidratar"],
  };
  const params = Promise.resolve({ canal: id });
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
          <Suspense fallback="carregando">
            <CanalPage params={params} />
          </Suspense>
        </StoreProvider>
      </SWRConfig>,
    );
  });
}

function chamadasRest() {
  return fetchMock.mock.calls as Array<[string, RequestInit | undefined]>;
}

describe("08-09 — a ficha do Canal relacional", () => {
  it("(1) Administrador: mostra provedor, origem e Simular conexão; o clique faz POST sem corpo e re-hidrata", async () => {
    rotas["POST /canais/uuid-1/simular-conexao"] = () => resposta(200, { ok: true, dados: { id: "uuid-1", conexao: "conectada" } });
    await montar("uuid-1", canalRelacional());

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    // No cabeçalho e na linha do painel: o selo do provedor e a origem aparecem nos dois.
    expect(screen.getAllByText("não oficial").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("WhatsApp não oficial", { selector: "span" })).toBeTruthy();
    expect(screen.getAllByText("cadastrado").length).toBeGreaterThanOrEqual(2);
    const botao = screen.getByRole("button", { name: "Simular conexão" });
    expect(screen.queryByRole("button", { name: "Desconectar" })).toBeNull();

    fireEvent.click(botao);

    await waitFor(() => expect(hidratar).toHaveBeenCalled());
    const posts = chamadasRest().filter(([url]) => url === "http://api/canais/uuid-1/simular-conexao");
    expect(posts).toHaveLength(1);
    const [, init] = posts[0]!;
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    const cabecalhos = init?.headers as Record<string, string>;
    expect(cabecalhos["authorization"]).toBe("Bearer tok");
    expect(Object.keys(cabecalhos).map((k) => k.toLowerCase())).not.toContain("content-type");
    expect(await screen.findByText("Conexão simulada.")).toBeTruthy();
  });

  it("(2) Membro: o botão Simular conexão não existe (e nenhuma ação de Canal é oferecida)", async () => {
    await montar("uuid-1", canalRelacional(), "mem_julia");

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desconectar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Arquivar" })).toBeNull();
  });

  it("(3) Canal conectado por simulação: marca, aviso fixo e o botão Desconectar", async () => {
    rotas["POST /canais/uuid-1/desconectar"] = () => resposta(200, { ok: true, dados: { id: "uuid-1", conexao: "desconectada" } });
    await montar("uuid-1", canalRelacional({ conexao: "conectada", conexaoSimulada: true }));

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.getAllByText("conexão simulada").length).toBeGreaterThan(0);
    expect(screen.getByText(AVISO_DA_SIMULACAO)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));

    await waitFor(() => expect(chamadasRest().some(([url]) => url === "http://api/canais/uuid-1/desconectar")).toBe(true));
    await waitFor(() => expect(hidratar).toHaveBeenCalled());
    expect(await screen.findByText("Canal desconectado.")).toBeTruthy();
  });

  it("CR-01 (16-17): Canal ligado a um provedor e desconectado: sem Simular conexão, com a frase de como reconectar", async () => {
    // O WhatsApp oficial não conecta por QR code: a frase do CR-01 segue sendo o caminho dele.
    await montar("uuid-1", canalRelacional({ provedor: "whatsapp-cloud", ligadoAoProvedor: true, conexao: "desconectada" }));

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();
    expect(screen.getByText(FRASE_DO_CANAL_REAL)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeTruthy();
  });

  it("CR-01 + Sessão 4: o não oficial ligado e desconectado não simula, e reconectar é o botão Conectar (QR code), não a frase antiga", async () => {
    await montar("uuid-1", canalRelacional({ ligadoAoProvedor: true, conexao: "desconectada" }));

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();
    expect(screen.getByRole("button", { name: "Conectar" })).toBeTruthy();
    expect(screen.queryByText(FRASE_DO_CANAL_REAL)).toBeNull();
  });

  it("CR-01 (16-17): Canal ligado a um provedor e conectado: Desconectar aparece e Simular conexão não", async () => {
    await montar("uuid-1", canalRelacional({ ligadoAoProvedor: true, conexao: "conectada" }));

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desconectar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();
  });

  it("(4) Arquivar pede confirmação e só então faz POST …/arquivar", async () => {
    rotas["POST /canais/uuid-1/arquivar"] = () => resposta(200, { ok: true, dados: { id: "uuid-1", estado: "arquivado" } });
    await montar("uuid-1", canalRelacional());

    fireEvent.click(await screen.findByRole("button", { name: "Arquivar" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Arquivar o Canal?")).toBeTruthy();
    expect(
      within(dialogo).getByText(
        "Ele é desconectado e sai das listas de Canais ativos. As Conversas ficam como histórico; o número pode ser conectado de novo num Canal novo.",
      ),
    ).toBeTruthy();
    expect(chamadasRest().some(([url]) => String(url).endsWith("/arquivar"))).toBe(false);

    fireEvent.click(within(dialogo).getByRole("button", { name: "Arquivar" }));

    await waitFor(() => expect(chamadasRest().some(([url]) => url === "http://api/canais/uuid-1/arquivar")).toBe(true));
    await waitFor(() => expect(hidratar).toHaveBeenCalled());
    expect(await screen.findByText("Canal arquivado.")).toBeTruthy();
  });

  it("(5) Setor do Canal relacional grava por PATCH /canais/:id e re-hidrata, sem a operação antiga", async () => {
    rotas["PATCH /canais/uuid-1"] = () => resposta(200, { ok: true, dados: { id: "uuid-1", filaPadraoId: "fila_com" } });
    await montar("uuid-1", canalRelacional());

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("combobox")[0]!);
    fireEvent.click(await screen.findByRole("option", { name: "Comercial" }));

    // O mesmo endereço também é o GET da ficha: o PATCH é a chamada com método próprio.
    const patch = () => chamadasRest().find(([url, init]) => url === "http://api/canais/uuid-1" && init?.method === "PATCH");
    await waitFor(() => expect(patch()).toBeTruthy());
    const [, init] = patch()!;
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({ filaPadraoId: "fila_com" });
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/json");
    await waitFor(() => expect(hidratar).toHaveBeenCalled());
    expect(gravar).not.toHaveBeenCalled();
  });

  it("(6) Canal que a api não conhece (404): \"Canal não encontrado.\", sem gravar nada", async () => {
    await montar("chn_wpp", null);

    expect(await screen.findByText("Canal não encontrado.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();
    expect(gravar).not.toHaveBeenCalled();
    // Nenhuma Conversa é pedida para um Canal que não existe.
    expect(chamadasRest().some(([url]) => String(url).includes("/conversas"))).toBe(false);
  });

  it("(7) as Conversas do Canal vêm de /conversas?canalId=…&limite=20 e o número é o total da resposta", async () => {
    await montar("uuid-1", canalRelacional(), "mem_rafael", 37);

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(await screen.findByText(/37 Conversa\(s\)/)).toBeTruthy();
    const pedido = chamadasRest().find(([url]) => String(url).includes("/conversas"));
    expect(pedido).toBeTruthy();
    const url = new URL(String(pedido![0]));
    expect(url.searchParams.get("canalId")).toBe("uuid-1");
    expect(url.searchParams.get("limite")).toBe("20");
  });

  it("(8) a ficha mostra o Setor, o identificador e quem configurou a partir do Canal da api", async () => {
    await montar("uuid-1", canalRelacional({ filaPadraoId: "fila_com", configuradoPor: "mem_rafael" }));

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.getByText("+5511977770001")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ver a Fila" }).getAttribute("href")).toBe("/crm/caixa-de-entrada/configuracoes/filas/fila_com");
    const seed = buildSeed();
    expect(screen.getByText(seed.members.find((m) => m.id === "mem_rafael")!.displayName)).toBeTruthy();
  });
});

describe("Sessão 8 — a ficha do Canal do Instagram conecta de verdade", () => {
  const instagram = (sobre: Partial<CanalNaFicha> = {}) =>
    canalRelacional({ nome: "Instagram da loja", tipo: "instagram", provedor: "instagram-graph", identificadorExterno: "loja.n1", ...sobre });

  it("Administrador: \"Conectar com o Instagram\" no lugar de Simular; o clique pede a URL e leva o navegador para lá", async () => {
    irParaForaDoApp.mockReset();
    rotas["POST /canais/uuid-1/instagram/autorizar"] = () =>
      resposta(200, { ok: true, dados: { url: "https://www.instagram.com/oauth/authorize?state=abc" } });
    await montar("uuid-1", instagram());

    expect(await screen.findByRole("heading", { name: /Instagram da loja/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();
    expect(screen.getByText(/entre com a conta @loja\.n1/)).toBeTruthy();
    expect(screen.getByText("só o Contato reabre a conversa")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Conectar com o Instagram" }));

    await waitFor(() => expect(irParaForaDoApp).toHaveBeenCalledWith("https://www.instagram.com/oauth/authorize?state=abc"));
    const posts = chamadasRest().filter(([url]) => url === "http://api/canais/uuid-1/instagram/autorizar");
    expect(posts).toHaveLength(1);
    expect(posts[0]![1]?.method).toBe("POST");
  });

  it("a recusa da api (integração não configurada) aparece na ficha e não sai do app", async () => {
    irParaForaDoApp.mockReset();
    rotas["POST /canais/uuid-1/instagram/autorizar"] = () =>
      resposta(503, { ok: false, error: "A integração com o Instagram não está configurada neste ambiente.", codigo: "INSTAGRAM_NAO_CONFIGURADO" });
    await montar("uuid-1", instagram());

    fireEvent.click(await screen.findByRole("button", { name: "Conectar com o Instagram" }));

    expect(await screen.findByText("A integração com o Instagram não está configurada neste ambiente.")).toBeTruthy();
    expect(irParaForaDoApp).not.toHaveBeenCalled();
  });

  it("conectado de verdade: mostra a conta lida da Meta, sem marca de simulação nem botão de conectar", async () => {
    rotas["GET /canais/uuid-1/instagram/conta"] = () =>
      resposta(200, { ok: true, dados: { usuario: "loja.n1", nome: "Loja N1", fotoUrl: "https://cdn.exemplo/loja.jpg" } });
    await montar("uuid-1", instagram({ conexao: "conectada", conexaoSimulada: false, conectadaEm: "2026-11-09T12:00:00.000Z" }));

    expect(await screen.findByText("Loja N1")).toBeTruthy();
    expect(screen.getByText("Conectado como")).toBeTruthy();
    expect(screen.queryByText(AVISO_DA_SIMULACAO)).toBeNull();
    expect(screen.queryByRole("button", { name: "Conectar com o Instagram" })).toBeNull();
    expect(screen.getByRole("button", { name: "Desconectar" })).toBeTruthy();
  });

  it("Membro não vê o botão de conectar", async () => {
    await montar("uuid-1", instagram(), "mem_julia");
    expect(await screen.findByRole("heading", { name: /Instagram da loja/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar com o Instagram" })).toBeNull();
  });
});

describe("Sessão 4 — a ficha do WhatsApp não oficial conecta lendo um QR code", () => {
  const QR = {
    ok: true,
    dados: { situacao: "qrcode", qrcode: { imagem: "data:image/png;base64,iVBORw0KGgo=", codigoDePareamento: "WXYZ1234" } },
  };
  const semSimulacao = (sobre: Partial<CanalNaFicha> = {}) => canalRelacional({ simulacaoPermitida: false, ...sobre });

  it("produção (sem simulação): Conectar é o botão de conexão e Simular conexão não existe", async () => {
    await montar("uuid-1", semSimulacao());

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conectar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();
    expect(screen.getByText(/leia\. Desconectar tira o aparelho da lista/)).toBeTruthy();
  });

  it("onde a simulação é permitida (desenvolvimento): Conectar e Simular conexão convivem", async () => {
    await montar("uuid-1", canalRelacional());

    expect(await screen.findByRole("button", { name: "Conectar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simular conexão" })).toBeTruthy();
  });

  it("Canal com erro: o botão serve de Reconectar", async () => {
    await montar("uuid-1", semSimulacao({ conexao: "com_erro", ligadoAoProvedor: true }));

    expect(await screen.findByRole("button", { name: "Reconectar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Desconectar" })).toBeTruthy();
  });

  it("Canal conectado de verdade: sem Conectar, com Desconectar", async () => {
    await montar("uuid-1", semSimulacao({ conexao: "conectada", ligadoAoProvedor: true }));

    expect(await screen.findByRole("button", { name: "Desconectar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reconectar" })).toBeNull();
  });

  it("Membro não vê Conectar (a tela só esconde; quem barra é o servidor)", async () => {
    await montar("uuid-1", semSimulacao(), "mem_julia");

    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar" })).toBeNull();
  });

  it("outros provedores não ganham Conectar: o Instagram tem o login dele e o WhatsApp oficial nem simulação em produção", async () => {
    await montar("uuid-1", semSimulacao({ tipo: "instagram", provedor: "instagram-graph", identificadorExterno: "loja.n1" }));
    expect(await screen.findByRole("button", { name: "Conectar com o Instagram" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar" })).toBeNull();
    cleanup();

    await montar("uuid-1", semSimulacao({ provedor: "whatsapp-cloud" }));
    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Simular conexão" })).toBeNull();
  });

  it("o clique em Conectar abre o painel: POST …/conectar sem corpo, o QR code, o código de pareamento e só o final do número", async () => {
    rotas["POST /canais/uuid-1/conectar"] = () => resposta(200, QR);
    await montar("uuid-1", semSimulacao());

    fireEvent.click(await screen.findByRole("button", { name: "Conectar" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Conectar o WhatsApp")).toBeTruthy();
    expect(within(dialogo).getByText(/final 0001/)).toBeTruthy();
    const imagem = await within(dialogo).findByAltText("QR code para conectar o WhatsApp deste Canal");
    expect(imagem.getAttribute("src")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(within(dialogo).getByText("WXYZ1234")).toBeTruthy();
    // O número inteiro nunca aparece no painel.
    expect(dialogo.textContent).not.toContain("5511977770001");

    const posts = chamadasRest().filter(([url, init]) => url === "http://api/canais/uuid-1/conectar" && init?.method === "POST");
    expect(posts).toHaveLength(1);
    const [, init] = posts[0]!;
    expect(init?.body).toBeUndefined();
    const cabecalhos = init?.headers as Record<string, string>;
    expect(cabecalhos["authorization"]).toBe("Bearer tok");
    expect(Object.keys(cabecalhos).map((k) => k.toLowerCase())).not.toContain("content-type");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("?conectar=1 (depois de criar o Canal): abre o painel sozinho, uma vez, e limpa o endereço", async () => {
    rotas["POST /canais/uuid-1/conectar"] = () => resposta(200, QR);
    parametros.atual = new URLSearchParams("conectar=1");
    await montar("uuid-1", semSimulacao());

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(await screen.findByAltText("QR code para conectar o WhatsApp deste Canal")).toBeTruthy();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/crm/caixa-de-entrada/configuracoes/canais/uuid-1"));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(chamadasRest().filter(([url, init]) => url === "http://api/canais/uuid-1/conectar" && init?.method === "POST")).toHaveLength(1);
  });

  it("sem ?conectar=1, o painel não abre e o endereço não é tocado", async () => {
    await montar("uuid-1", semSimulacao());

    expect(await screen.findByRole("button", { name: "Conectar" })).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(chamadasRest().some(([url]) => String(url).endsWith("/conectar"))).toBe(false);
  });

  it("?conectar=1 para quem não pode conectar, ou num Canal que não conecta por QR: não abre, mas limpa o endereço", async () => {
    parametros.atual = new URLSearchParams("conectar=1");
    await montar("uuid-1", semSimulacao(), "mem_julia");
    expect(await screen.findByRole("heading", { name: /Suporte do Zap/ })).toBeTruthy();
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    cleanup();
    router.replace.mockReset();

    await montar("uuid-1", semSimulacao({ tipo: "instagram", provedor: "instagram-graph", identificadorExterno: "loja.n1" }));
    expect(await screen.findByRole("button", { name: "Conectar com o Instagram" })).toBeTruthy();
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(chamadasRest().some(([url]) => String(url).endsWith("/conectar"))).toBe(false);
  });
});
