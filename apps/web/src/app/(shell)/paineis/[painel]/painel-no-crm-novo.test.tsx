// @vitest-environment jsdom
/**
 * 15-23 Task 3 (UCR-07, 3.4.7) — o Painel lê Negócios, Conversas, Contatos e Funis das rotas
 * (`GET /negocios`, `/conversas`, `/contatos`, `/funis`, até 200 cada) e `widgetReading` os recebe por
 * argumento: nada de `state.deals`. Quando o `total` passa do que foi lido, o Widget diz
 * "Parcial: primeiros 200" (T-15-57). Nenhuma rede: `fetch` roteado, sessão falsa, `StoreProvider` real.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { NegocioResumo } from "@n1/dominio/crm/negocios";
import { buildSeed } from "@n1/dominio/seed";
import { negocioAntigoDeTeste } from "@/testes/crm-antigo-de-teste";
import type { DataState } from "@n1/dominio/state";
import type { Widget } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import PainelPage from "./page";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const THIAGO = "mem_thiago";
const FUNIL = "fun_a";

function negocio(id: string, extra: Partial<NegocioResumo> = {}): NegocioResumo {
  return {
    id,
    titulo: `Negócio ${id}`,
    valor: null,
    moeda: "BRL",
    probabilidadeEfetiva: 50,
    situacao: "aberto",
    estado: "ativo",
    funilId: FUNIL,
    etapaId: "eta_novo",
    empresa: null,
    contato: null,
    proprietarioId: THIAGO,
    dataPrevistaFechamento: null,
    encerradoEm: null,
    atualizadoEm: "2026-11-01T10:00:00.000Z",
    ...extra,
  };
}

const NEGOCIOS = [
  negocio("n1"),
  negocio("n2", { etapaId: "eta_proposta" }),
  negocio("n3", { etapaId: "eta_proposta", situacao: "ganho", valor: "500", encerradoEm: "2026-10-15T12:00:00.000Z" }),
];

function resposta(corpo: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => corpo } as Response;
}

let state: DataState;
let fetchMock: ReturnType<typeof vi.fn>;
let totalDeNegocios: number;
let negociosRecusados: boolean;

beforeEach(() => {
  state = buildSeed();
  // O seed não cria mais Negócio (15-31): o Negócio do modelo antigo no Funil Closer, que o Painel NÃO conta, é posto aqui.
  state.deals.push(negocioAntigoDeTeste({ id: "deal_antigo_closer", funnelId: "fnl_closer" }));
  totalDeNegocios = NEGOCIOS.length;
  negociosRecusados = false;
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  fetchMock = vi.fn(async (url: string) => {
    const alvo = new URL(url);
    if (alvo.pathname === "/negocios") {
      return negociosRecusados ? resposta({ ok: false, error: "Sem acesso.", codigo: "SEM_PERMISSAO" }, 403) : resposta({ ok: true, itens: NEGOCIOS, total: totalDeNegocios });
    }
    if (alvo.pathname === "/funis") {
      return resposta({ ok: true, itens: [{ funil: { id: FUNIL, nome: "Funil A" }, totalEtapas: 2, negociosAbertos: 2 }], total: 1 });
    }
    if (alvo.pathname === `/funis/${FUNIL}`) {
      return resposta({
        ok: true,
        dados: {
          funil: { id: FUNIL, nome: "Funil A" },
          etapas: [
            { id: "eta_novo", funilId: FUNIL, nome: "Novo" },
            { id: "eta_proposta", funilId: FUNIL, nome: "Proposta" },
          ],
        },
      });
    }
    return resposta({ ok: true, itens: [], total: 0 });
  });
  vi.stubGlobal("fetch", fetchMock);
  // O jsdom não tem `matchMedia`; a lanterna dos ladrilhos o consulta.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** O Painel "Closer" do seed, com as Fontes apontadas para o Funil do CRM novo. */
function apontarParaOFunilNovo(): void {
  const painel = state.panels.find((p) => p.id === "pnl_closer");
  if (!painel) throw new Error("seed sem pnl_closer");
  painel.widgets = painel.widgets.map(
    (widget): Widget => (widget.dataSource ? { ...widget, dataSource: { ...widget.dataSource, scopeIds: [FUNIL] } } : widget),
  );
}

async function montar() {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
          <Suspense fallback="carregando">
            <PainelPage params={Promise.resolve({ painel: "pnl_closer" })} />
          </Suspense>
        </StoreProvider>
      </SWRConfig>,
    );
  });
}

const chamadas = (caminho: string): URL[] =>
  fetchMock.mock.calls.map((c) => new URL(c[0] as string)).filter((u) => u.pathname === caminho);

describe("Painel › CRM novo por argumento (15-23)", () => {
  it("os Widgets de Negócios leem GET /negocios (200 de uma vez) e nomeiam as Etapas pela ficha do Funil", async () => {
    apontarParaOFunilNovo();
    await montar();
    await waitFor(() => expect(screen.getAllByText("Proposta").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Novo").length).toBeGreaterThan(0);

    const pedido = chamadas("/negocios")[0];
    expect(pedido?.searchParams.get("limite")).toBe("200");
    expect(chamadas("/funis/" + FUNIL).length).toBeGreaterThan(0);
    // Alvos que nenhum Widget deste Painel usa não vão à rede.
    expect(chamadas("/conversas")).toHaveLength(0);
    expect(chamadas("/contatos")).toHaveLength(0);
  });

  it("o Funil do modelo antigo (Fonte com id do seed) não conta os Negócios antigos: lê zero das rotas", async () => {
    expect(state.deals.some((d) => d.funnelId === "fnl_closer")).toBe(true);
    await montar();
    await waitFor(() => expect(chamadas("/negocios").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByText("Lendo os dados do CRM…")).toBeNull());
    expect(screen.queryByText(/Parcial: primeiros/)).toBeNull();
  });

  it("quando o total passa do que foi lido, o Widget diz 'Parcial: primeiros 200'", async () => {
    apontarParaOFunilNovo();
    totalDeNegocios = 250;
    await montar();
    await waitFor(() => expect(screen.getAllByText("Parcial: primeiros 200").length).toBeGreaterThan(0));
  });

  it("lista completa: nenhuma marca de parcial", async () => {
    apontarParaOFunilNovo();
    await montar();
    await waitFor(() => expect(screen.getAllByText("Proposta").length).toBeGreaterThan(0));
    expect(screen.queryByText(/Parcial: primeiros/)).toBeNull();
  });

  it("recusa 403 da api: o Widget diz que a Fonte não é alcançada, não mostra zero", async () => {
    apontarParaOFunilNovo();
    negociosRecusados = true;
    await montar();
    await waitFor(() => expect(screen.getAllByText(/sem acesso/i).length).toBeGreaterThan(0));
  });
});
