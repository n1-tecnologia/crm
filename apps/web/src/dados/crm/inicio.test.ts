// @vitest-environment jsdom
/**
 * 15-18 — o agregado do Início no CRM novo (3.4.7, UCR-07): um hook por bloco, com chave
 * estável e sem mandar o Membro. Nenhuma rede: `fetch` falso e sessão falsa.
 */

import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { LeadAAtenderDoCrm, PanoramaDoCrm } from "@n1/dominio/crm/inicio";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

import { ErroDeApi } from "./cliente-crm";
import { chaveDeEstatisticas, chaveDeLeads, useEstatisticasDoCrm, useLeadsAAtender, usePanoramaDoCrm } from "./inicio";

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

/** Cache novo por teste; `dedupingInterval` padrão, que é o que une dois componentes na mesma chamada. */
function comCache({ children }: { readonly children: ReactNode }) {
  return createElement(SWRConfig, { value: { provider: () => new Map() } }, children);
}

const PANORAMA: PanoramaDoCrm = {
  contatosRecentes: [{ id: "c1", nome: "Maria Silva" }],
  contatosTotal: 1,
  negociosAbertos: { quantidade: 2, valorPonderado: 700, moeda: "BRL" },
  conversasAbertas: 2,
};

const LEAD: LeadAAtenderDoCrm = { contatoId: "c1", nome: "Maria", motivo: "semContato", conversaId: null, desde: "2026-01-10T12:00:00.000Z" };

describe("chaveDeLeads — a chave de SWR", () => {
  it("(a) a mesma lista de Qualificações em outra ordem, ou com repetição, usa a mesma chave", () => {
    expect(chaveDeLeads(["q2", "q1"])).toBe(chaveDeLeads(["q1", "q2"]));
    expect(chaveDeLeads(["q1", "q2", "q1"])).toBe(chaveDeLeads(["q1", "q2"]));
    expect(chaveDeLeads(["q1", "q2"])).toBe("/crm/inicio/leads-a-atender?qualificacao=q1&qualificacao=q2");
  });

  it("(b) listas diferentes têm chaves diferentes, e lista vazia não tem chave", () => {
    expect(chaveDeLeads(["q1"])).not.toBe(chaveDeLeads(["q2"]));
    expect(chaveDeLeads([])).toBeNull();
    expect(chaveDeLeads([""])).toBeNull();
  });
});

describe("useLeadsAAtender", () => {
  it("(c) useLeadsAAtender([q2, q1]) e ([q1, q2]) em dois componentes fazem UMA chamada só, sem mandar o Membro", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [LEAD], total: 1 }));
    function Lista({ qualificacoes }: { readonly qualificacoes: readonly string[] }) {
      const { leads } = useLeadsAAtender(qualificacoes);
      return createElement("span", null, leads.map((lead) => lead.nome).join(","));
    }
    const { container } = render(
      createElement(comCache, null, createElement(Lista, { qualificacoes: ["q2", "q1"] }), createElement(Lista, { qualificacoes: ["q1", "q2"] })),
    );

    await waitFor(() => expect(container.textContent).toContain("Maria"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body?: string }];
    expect(url).toBe("http://api/crm/inicio/leads-a-atender?qualificacao=q1&qualificacao=q2");
    expect(init.method).toBe("GET");
    expect(init.headers.authorization).toBe("Bearer tok");
    expect(init.body).toBeUndefined();
    expect(url).not.toMatch(/membro/i);
  });

  it("(d) lista vazia não vai à api", async () => {
    const { result } = renderHook(() => useLeadsAAtender([]), { wrapper: comCache });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.leads).toEqual([]);
    expect(result.current.carregando).toBe(false);
  });

  it("(e) a recusa da api vira erro, deixa a lista vazia e não repete", async () => {
    fetchMock.mockResolvedValue(resposta(403, { ok: false, error: "Só um Membro ativo ou suspenso consulta o CRM.", codigo: "PERMISSAO" }));
    const { result } = renderHook(() => useLeadsAAtender(["q1"]), { wrapper: comCache });

    await waitFor(() => expect(result.current.erro).toBeInstanceOf(ErroDeApi));
    expect(result.current.erro?.status).toBe(403);
    expect(result.current.leads).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("usePanoramaDoCrm", () => {
  it("(f) lê GET /crm/inicio/panorama e entrega os números como a api somou", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: PANORAMA }));
    const { result } = renderHook(() => usePanoramaDoCrm(), { wrapper: comCache });

    expect(result.current.panorama).toBeUndefined();
    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.panorama).toEqual(PANORAMA));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api/crm/inicio/panorama");
    expect(result.current.carregando).toBe(false);
  });

  it("(g) a recusa da api vira erro e o panorama fica indefinido", async () => {
    fetchMock.mockResolvedValue(resposta(403, { ok: false, error: "Membro não encontrado neste Espaço de Trabalho.", codigo: "PERMISSAO" }));
    const { result } = renderHook(() => usePanoramaDoCrm(), { wrapper: comCache });

    await waitFor(() => expect(result.current.erro).toBeInstanceOf(ErroDeApi));
    expect(result.current.panorama).toBeUndefined();
  });
});

describe("useEstatisticasDoCrm", () => {
  const janela = { desde: "2026-03-01T00:00:00.000Z", ate: "2026-03-31T23:59:59.000Z" };

  it("(h) a chave leva a janela e o fuso, e o pedido não leva o Membro", async () => {
    const dados = { ...janela, fuso: "America/Sao_Paulo", mensagensEnviadas: [{ dia: "2026-03-09", quantidade: 2 }], conversasResolvidas: [], negociosGanhos: [] };
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados }));
    const { result } = renderHook(() => useEstatisticasDoCrm(janela, "America/Sao_Paulo"), { wrapper: comCache });

    await waitFor(() => expect(result.current.estatisticas).toEqual(dados));
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`http://api${chaveDeEstatisticas(janela, "America/Sao_Paulo")}`);
    expect(new URL(url).searchParams.get("fuso")).toBe("America/Sao_Paulo");
    expect(new URL(url).searchParams.get("desde")).toBe(janela.desde);
    expect(new URL(url).searchParams.get("ate")).toBe(janela.ate);
    expect([...new URL(url).searchParams.keys()].sort()).toEqual(["ate", "desde", "fuso"]);
  });

  it("(i) janela ou fuso diferentes são chaves diferentes", () => {
    expect(chaveDeEstatisticas(janela, "UTC")).not.toBe(chaveDeEstatisticas(janela, "America/Sao_Paulo"));
    expect(chaveDeEstatisticas(janela, "UTC")).not.toBe(chaveDeEstatisticas({ ...janela, desde: "2026-02-01T00:00:00.000Z" }, "UTC"));
  });

  it("(j) a recusa da api (400 de janela) vira erro e as estatísticas ficam indefinidas, sem repetir", async () => {
    fetchMock.mockResolvedValue(resposta(400, { ok: false, error: "A janela das estatísticas tem no máximo 400 dias.", codigo: "VALOR_INVALIDO", campo: "desde" }));
    const { result } = renderHook(() => useEstatisticasDoCrm(janela, "UTC"), { wrapper: comCache });

    await waitFor(() => expect(result.current.erro).toBeInstanceOf(ErroDeApi));
    expect(result.current.erro?.campo).toBe("desde");
    expect(result.current.estatisticas).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
