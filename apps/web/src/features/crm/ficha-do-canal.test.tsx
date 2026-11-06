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
import type { Canal } from "@n1/dominio/crm/canais";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import CanalPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada/configuracoes/canais/uuid-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const AVISO_DA_SIMULACAO = "Conexão simulada: o Canal aparece conectado para testar o chat, mas nenhuma Mensagem sai da plataforma.";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

/** O Canal da 008 como a api o devolve em `GET /canais/:id`. */
function canalRelacional(sobre: Partial<Canal> = {}): Canal {
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
async function montar(id: string, canal: Canal | null, memberId = "mem_rafael", totalDeConversas = 3) {
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

    await waitFor(() => expect(chamadasRest().some(([url]) => url === "http://api/canais/uuid-1")).toBe(true));
    const [, init] = chamadasRest().find(([url]) => url === "http://api/canais/uuid-1")!;
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
