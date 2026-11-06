// @vitest-environment jsdom
/**
 * 15-12 Task 3 (3.4.3) — a página da Fila e as Configurações da Caixa contam e
 * listam pelo CRM novo, só por HTTP:
 *
 *   - a Fila F pede `GET /conversas?filaId=F…`; a lista mostra as Conversas com
 *     `contatoNome` e o contador é o `total` da resposta (37), não o tamanho da
 *     página (2);
 *   - a carga de cada Membro elegível pede `GET /conversas?atribuidoId=<membro>&situacao=aberta&limite=1`
 *     (junto com a Fila) e mostra o `total`;
 *   - nas Configurações da Caixa, cada Fila conta por `filaId=<fila>&limite=1` e os
 *     Canais vêm de `GET /canais` (ativos e arquivados);
 *   - Fila e Caixa continuam configuração do Espaço (store): uma Fila que o store
 *     não conhece é "Fila não encontrada." e não pede nenhuma Conversa.
 *
 * Nenhuma rede: um `fetch` falso que registra as URLs pedidas, sessão falsa e
 * `StoreProvider` de verdade com o seed. Molde de `ficha-do-canal.test.tsx`.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { Canal } from "@n1/dominio/crm/canais";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import ConfiguracoesDaCaixaPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/page";
import FilaPage from "@/app/(shell)/crm/caixa-de-entrada/configuracoes/filas/[fila]/page";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada/configuracoes",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

function canal(sobre: Partial<Canal>): Canal {
  return {
    id: "c1",
    nome: "Suporte do Zap",
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: "+5511977770001",
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

function conversa(id: string, contatoNome: string, atribuidoId: string | null) {
  return {
    id,
    canalId: "c1",
    contatoId: `ct_${id}`,
    titulo: `Conversa de ${contatoNome}`,
    tituloEditado: false,
    situacao: "aberta",
    estado: "ativo",
    naLixeiraEm: null,
    filaId: "fila_com",
    atribuido: atribuidoId ? { tipo: "membro", id: atribuidoId } : null,
    adiadaAte: null,
    adiamentoMotivo: null,
    participantes: [],
    resolvidaEm: null,
    reabertaEm: null,
    reaberturas: 0,
    criadoPor: { tipo: "membro", id: "mem_rafael" },
    criadoEm: "2026-11-01T00:00:00.000Z",
    atualizadoEm: "2026-11-02T00:00:00.000Z",
    contatoNome,
    estrela: false,
    naoLidas: 0,
    ultimaRecebidaEm: null,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
/** O que responder a cada `GET /conversas`, decidido pela query string. */
let aoPedirConversas: (parametros: URLSearchParams) => Response;
let canaisAtivos: Canal[];
let canaisArquivados: Canal[];

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  canaisAtivos = [];
  canaisArquivados = [];
  aoPedirConversas = () => resposta(200, { ok: true, itens: [], total: 0 });
  fetchMock = vi.fn(async (url: string) => {
    const alvo = new URL(String(url));
    if (alvo.pathname === "/conversas") return aoPedirConversas(alvo.searchParams);
    if (alvo.pathname === "/canais") {
      const itens = alvo.searchParams.get("estado") === "arquivado" ? canaisArquivados : canaisAtivos;
      return resposta(200, { ok: true, itens, total: itens.length });
    }
    return resposta(404, { ok: false, error: "Rota não prevista no teste.", codigo: "NAO_ENCONTRADO" });
  });
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => cleanup());

const TRANSPORTE: Transporte = {
  gravar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
  hidratar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
};

async function montar(pagina: React.ReactNode) {
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId: "mem_rafael" }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={TRANSPORTE}>
          <Suspense fallback="carregando">{pagina}</Suspense>
        </StoreProvider>
      </SWRConfig>,
    );
  });
}

/** As URLs pedidas à api, já em `URL`. */
function pedidos(caminho: string): URL[] {
  return (fetchMock.mock.calls as Array<[string]>)
    .map(([url]) => new URL(String(url)))
    .filter((url) => url.pathname === caminho);
}

describe("15-12 — a página da Fila pelo CRM novo", () => {
  it("(1) lista as Conversas de filaId=F com contatoNome e o contador é o total da resposta, não a página", async () => {
    aoPedirConversas = (p) =>
      p.get("situacao") === "aberta"
        ? resposta(200, { ok: true, itens: [], total: 0 })
        : resposta(200, {
            ok: true,
            itens: [conversa("v1", "Ana Souza", "mem_julia"), conversa("v2", "Bruno Lima", null)],
            total: 37,
          });
    await montar(<FilaPage params={Promise.resolve({ fila: "fila_com" })} />);

    expect(await screen.findByText("Ana Souza")).toBeTruthy();
    expect(screen.getByText("Bruno Lima")).toBeTruthy();
    // O contador do cabeçalho e o rodapé da lista usam o total (37), nunca as 2 linhas da página: "2 de 37".
    expect(screen.getByText(/37 Conversa\(s\) ativa\(s\)/)).toBeTruthy();
    expect(screen.getByText(/Mostrando 2 de 37/)).toBeTruthy();
    // O Atribuído vem do store (Membro) e a ausência dele é dita.
    expect(screen.getByText("sem Atribuído")).toBeTruthy();

    const daLista = pedidos("/conversas").filter((u) => u.searchParams.get("situacao") === null);
    expect(daLista.length).toBeGreaterThan(0);
    expect(daLista[0]!.searchParams.get("filaId")).toBe("fila_com");
    expect(daLista[0]!.searchParams.get("limite")).toBe("20");
  });

  it("(2) a carga de cada Membro elegível pede atribuidoId, situacao=aberta e limite=1 e mostra o total", async () => {
    aoPedirConversas = (p) => {
      if (p.get("situacao") !== "aberta") return resposta(200, { ok: true, itens: [], total: 0 });
      const total = p.get("atribuidoId") === "mem_julia" ? 5 : 0;
      return resposta(200, { ok: true, itens: [], total });
    };
    await montar(<FilaPage params={Promise.resolve({ fila: "fila_com" })} />);

    expect(await screen.findByText("5 de 15 Conversa(s)")).toBeTruthy();
    expect(screen.getByText("0 de 15 Conversa(s)")).toBeTruthy();

    const cargas = pedidos("/conversas").filter((u) => u.searchParams.get("atribuidoId") !== null);
    expect(cargas.map((u) => u.searchParams.get("atribuidoId")).sort()).toEqual(["mem_julia", "mem_rafael"]);
    for (const url of cargas) {
      expect(url.searchParams.get("situacao")).toBe("aberta");
      expect(url.searchParams.get("limite")).toBe("1");
      expect(url.searchParams.get("filaId")).toBe("fila_com");
    }
  });

  it("(3) os Canais que entram aqui vêm de /canais e só os da Fila padrão aparecem", async () => {
    canaisAtivos = [canal({ id: "c1", nome: "Suporte do Zap", filaPadraoId: "fila_com" }), canal({ id: "c2", nome: "Outro Zap", filaPadraoId: null })];
    await montar(<FilaPage params={Promise.resolve({ fila: "fila_com" })} />);

    const link = await screen.findByRole("link", { name: /Suporte do Zap/ });
    expect(link.getAttribute("href")).toBe("/crm/caixa-de-entrada/configuracoes/canais/c1");
    expect(screen.queryByText("Outro Zap")).toBeNull();
  });

  it("(4) uma Fila que o store não conhece é \"Fila não encontrada.\" e não pede nenhuma Conversa", async () => {
    await montar(<FilaPage params={Promise.resolve({ fila: "fila_que_nao_existe" })} />);

    expect(await screen.findByText("Fila não encontrada.")).toBeTruthy();
    expect(pedidos("/conversas")).toHaveLength(0);
  });
});

describe("15-12 — as Configurações da Caixa pelo CRM novo", () => {
  it("(5) cada Fila conta por filaId=<fila>&limite=1 e mostra o total da api", async () => {
    aoPedirConversas = (p) => resposta(200, { ok: true, itens: [], total: p.get("filaId") === "fila_com" ? 12 : 3 });
    await montar(<ConfiguracoesDaCaixaPage />);

    expect(await screen.findByText(/12 Conversa\(s\)/)).toBeTruthy();
    expect(screen.getByText(/ 3 Conversa\(s\)/)).toBeTruthy();
    const porFila = pedidos("/conversas");
    expect(porFila.map((u) => u.searchParams.get("filaId")).sort()).toEqual(["fila_com", "fila_sup"]);
    for (const url of porFila) expect(url.searchParams.get("limite")).toBe("1");
  });

  it("(6) os Canais vêm de GET /canais, ativos e arquivados, com a Fila padrão pelo filaPadraoId", async () => {
    canaisAtivos = [canal({ id: "c1", nome: "Suporte do Zap", filaPadraoId: "fila_com" })];
    canaisArquivados = [canal({ id: "c9", nome: "Zap antigo", estado: "arquivado", conexao: "desconectada" })];
    await montar(<ConfiguracoesDaCaixaPage />);

    expect(await screen.findByText("Suporte do Zap")).toBeTruthy();
    expect(await screen.findByText("Zap antigo")).toBeTruthy();
    expect(screen.getByText(/fila Comercial/)).toBeTruthy();
    expect(screen.getByText(/2 Canal\(is\)/)).toBeTruthy();
    const estados = pedidos("/canais").map((u) => u.searchParams.get("estado"));
    expect(estados).toContain("ativo");
    expect(estados).toContain("arquivado");
    await waitFor(() => expect(screen.getAllByRole("link", { name: /Suporte do Zap/ })[0]!.getAttribute("href")).toBe("/crm/caixa-de-entrada/configuracoes/canais/c1"));
  });
});
