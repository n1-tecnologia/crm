// @vitest-environment jsdom
/**
 * 15-23 (UCR-07, 3.4.7) — o Início abre sem `contacts`, `deals` e `conversations` do CRM antigo no
 * store: "Leads a atender" vem de `GET /crm/inicio/leads-a-atender` (as Qualificações "Lead" saem do
 * Catálogo, no store), "Mensagens novas" de `GET /conversas?naoLidas=true&atribuidoId=<Membro>` e as
 * estatísticas juntam as Tarefas concluídas (store) com os números de `GET /crm/inicio/estatisticas`.
 *
 * Nenhuma rede: `fetch` roteado por caminho, sessão falsa e `StoreProvider` de verdade com o seed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor, within, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import { conferirJanelaDeEstatisticas, type EstatisticasDoCrm, type LeadAAtenderDoCrm, type PanoramaDoCrm } from "@n1/dominio/crm/inicio";
import { contactDisplayName } from "@n1/dominio/derive";
import { qualificacoesDeLead } from "@n1/dominio/derive-resumo";
import { diaCivilNoFuso } from "@n1/dominio/recortes-de-tarefas";
import { buildSeed } from "@n1/dominio/seed";
import { contatoAntigoDeTeste, conversaAntigaDeTeste } from "@/testes/crm-antigo-de-teste";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import { montarPanorama, useRespostaDoRobo } from "./panorama-do-robo";
import { ResumoDoInicio } from "./resumo-do-inicio";

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

function conversa(id: string, contatoNome: string, naoLidas: number, ultimaRecebidaEm: string): ConversaNaLista {
  return {
    id,
    canalId: "can_1",
    contatoId: `ctt_${id}`,
    titulo: `Conversa ${id}`,
    tituloEditado: false,
    situacao: "aberta",
    estado: "ativo",
    naLixeiraEm: null,
    filaId: null,
    atribuido: { tipo: "membro", id: THIAGO },
    adiadaAte: null,
    adiamentoMotivo: null,
    participantes: [],
    resolvidaEm: null,
    reabertaEm: null,
    reaberturas: 0,
    criadoPor: { tipo: "membro", id: THIAGO },
    criadoEm: "2026-11-01T10:00:00.000Z",
    atualizadoEm: ultimaRecebidaEm,
    contatoNome,
    estrela: false,
    naoLidas,
    ultimaRecebidaEm,
  };
}

const LEADS: readonly LeadAAtenderDoCrm[] = [
  { contatoId: "ctt_lead_1", nome: "Marina Alves do CRM", motivo: "semContato", conversaId: null, desde: "2026-11-01T10:00:00.000Z" },
  { contatoId: "ctt_lead_2", nome: "Otávio Prado do CRM", motivo: "aguardandoResposta", conversaId: "cnv_lead_2", desde: "2026-11-05T10:00:00.000Z" },
];

const CONVERSAS = [
  conversa("cnv_nova_1", "Bianca Lemos do CRM", 4, "2026-11-06T10:00:00.000Z"),
  conversa("cnv_nova_2", "Caio Duarte do CRM", 2, "2026-11-05T10:00:00.000Z"),
];

const SEM_ESTATISTICAS: EstatisticasDoCrm = {
  desde: "2026-10-30T03:00:00.000Z",
  ate: "2026-11-06T23:59:59.999Z",
  fuso: "America/Sao_Paulo",
  mensagensEnviadas: [],
  conversasResolvidas: [],
  negociosGanhos: [],
};

function resposta(corpo: unknown): Response {
  return { ok: true, status: 200, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
let leads: readonly LeadAAtenderDoCrm[];
let conversas: ConversaNaLista[];
let estatisticas: (url: URL) => EstatisticasDoCrm;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  leads = LEADS;
  conversas = CONVERSAS;
  estatisticas = () => SEM_ESTATISTICAS;
  fetchMock = vi.fn(async (url: string) => {
    const alvo = new URL(url);
    if (alvo.pathname === "/crm/inicio/leads-a-atender") return resposta({ ok: true, itens: leads, total: leads.length });
    if (alvo.pathname === "/crm/inicio/estatisticas") return resposta({ ok: true, dados: estatisticas(alvo) });
    if (alvo.pathname === "/conversas") return resposta({ ok: true, itens: conversas, total: conversas.length });
    return resposta({ ok: true, itens: [], total: 0 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function montar() {
  const dados = buildSeed();
  // O seed não cria mais Contato nem Conversa (15-31): o Lead e a Conversa não lida do modelo antigo, que o Início NÃO lê, são postos aqui.
  dados.contacts.push(contatoAntigoDeTeste({ id: "cnt_antigo_lead", firstName: "Lead", lastName: "Antigo", ownerMemberId: THIAGO, qualificationId: "cat_qual_lead" }));
  dados.conversations.push(conversaAntigaDeTeste({ id: "cnv_sdr_1", atribuidaA: THIAGO, title: "Iallas, Full Face Avançado" }));
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: dados, revisao: 1, ordens: {} }} transporte={transporte}>
          <ResumoDoInicio />
        </StoreProvider>
      </SWRConfig>,
    );
  });
  return dados;
}

const chamadas = (caminho: string): URL[] =>
  fetchMock.mock.calls.map((c) => new URL(c[0] as string)).filter((u) => u.pathname === caminho);

const bloco = (titulo: string): HTMLElement => {
  const secao = screen.getByRole("heading", { name: titulo }).closest("section");
  if (!secao) throw new Error(`bloco ${titulo} sem seção`);
  return secao;
};

describe("Início › Leads a atender (15-23, tracer)", () => {
  it("lista os Leads que a api devolveu, com o motivo e o link certo, e pede só as Qualificações Lead do Catálogo", async () => {
    const dados = await montar();
    await waitFor(() => expect(within(bloco("Leads a atender")).getByRole("link", { name: /Marina Alves do CRM/ })).toBeTruthy());

    const leadsBloco = bloco("Leads a atender");
    expect(within(leadsBloco).getByRole("link", { name: /Marina Alves do CRM/ }).getAttribute("href")).toBe("/crm/contatos/ctt_lead_1");
    // Esperando resposta leva direto à Conversa.
    expect(within(leadsBloco).getByRole("link", { name: /Otávio Prado do CRM/ }).getAttribute("href")).toBe("/crm/caixa-de-entrada/cnv_lead_2");
    expect(within(leadsBloco).getByText(/Sem contato/)).toBeTruthy();
    expect(within(leadsBloco).getByText(/Esperando resposta/)).toBeTruthy();

    const pedidos = chamadas("/crm/inicio/leads-a-atender");
    expect(pedidos.length).toBeGreaterThan(0);
    expect(pedidos[0]?.searchParams.getAll("qualificacao")).toEqual([...qualificacoesDeLead(dados)].sort());
    // "Meu" é a sessão: o Membro nunca vai no pedido.
    expect(pedidos[0]?.searchParams.has("membroId")).toBe(false);
  });

  it("os Contatos antigos do Membro com a Qualificação Lead (state.contacts) não entram no bloco", async () => {
    const dados = await montar();
    await waitFor(() => expect(within(bloco("Leads a atender")).getByRole("link", { name: /Marina Alves do CRM/ })).toBeTruthy());
    const antigos = dados.contacts.filter((c) => c.ownerMemberId === THIAGO && c.qualificationId === "cat_qual_lead" && c.lifecycle === "ativo");
    expect(antigos.length).toBeGreaterThan(0);
    const texto = bloco("Leads a atender").textContent ?? "";
    for (const contato of antigos) expect(texto).not.toContain(contactDisplayName(contato));
    // O número do atalho é o das linhas da api (2), não o do store.
    const atalho = screen.getByText("Leads a atender", { selector: "span" }).closest("a");
    expect(atalho?.textContent).toContain("2");
  });

  it("sem resposta da api o bloco não inventa Lead: fica vazio, com a mensagem de sempre", async () => {
    leads = [];
    await montar();
    await waitFor(() => expect(chamadas("/crm/inicio/leads-a-atender").length).toBeGreaterThan(0));
    expect(within(bloco("Leads a atender")).getByText("Nenhum Lead esperando por você.")).toBeTruthy();
  });
});

describe("Início › Mensagens novas (15-23, tracer)", () => {
  it("lista as Conversas de GET /conversas?naoLidas=true&atribuidoId=<Membro> e soma as não lidas delas", async () => {
    await montar();
    await waitFor(() => expect(within(bloco("Mensagens novas")).getByText("Bianca Lemos do CRM")).toBeTruthy());

    const mensagens = bloco("Mensagens novas");
    expect(within(mensagens).getByText("Caio Duarte do CRM")).toBeTruthy();
    expect(within(mensagens).getByText("Bianca Lemos do CRM").closest("a")?.getAttribute("href")).toBe("/crm/caixa-de-entrada/cnv_nova_1");
    expect(within(mensagens).getByText("4 não lidas")).toBeTruthy();
    expect(within(mensagens).getByText("2 não lidas")).toBeTruthy();

    const pedido = chamadas("/conversas").find((u) => u.searchParams.get("naoLidas") === "true");
    expect(pedido?.searchParams.get("atribuidoId")).toBe(THIAGO);
    expect(pedido?.searchParams.get("estado")).toBe("ativo");
    // 4 + 2 mensagens novas no atalho (o mesmo número da soma das linhas).
    const atalho = screen.getByText("Mensagens novas", { selector: "span" }).closest("a");
    expect(atalho?.textContent).toContain("6");
    expect(atalho?.getAttribute("href")).toBe("/crm/caixa-de-entrada?escopo=minhas");
  });

  it("as Conversas antigas do seed com Mensagem não lida do Membro (state.conversations) não aparecem", async () => {
    await montar();
    await waitFor(() => expect(within(bloco("Mensagens novas")).getByText("Bianca Lemos do CRM")).toBeTruthy());
    expect(within(bloco("Mensagens novas")).queryByRole("link", { name: /Iallas/ })).toBeNull();
    const links = within(bloco("Mensagens novas")).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).not.toContain("/crm/caixa-de-entrada/cnv_sdr_1");
  });

  it("passando do que veio, o atalho diz que a leitura é parcial em vez de mostrar um total que não existe", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const alvo = new URL(url);
      if (alvo.pathname === "/conversas") return resposta({ ok: true, itens: conversas, total: 250 });
      if (alvo.pathname === "/crm/inicio/estatisticas") return resposta({ ok: true, dados: SEM_ESTATISTICAS });
      if (alvo.pathname === "/crm/inicio/leads-a-atender") return resposta({ ok: true, itens: [], total: 0 });
      return resposta({ ok: true, itens: [], total: 0 });
    });
    await montar();
    await waitFor(() => expect(screen.getByText(/primeiras 2 de 250 Conversas/)).toBeTruthy());
  });
});

/* ───────────────────────────── Tarefa 2: estatísticas e panorama ───────────────────────────── */

describe("Início › Estatísticas (15-23)", () => {
  it("pede ao servidor a janela atual e a anterior, no fuso do Espaço, e põe os números do CRM nas métricas", async () => {
    const dados = buildSeed();
    const fuso = dados.workspace.locale.timezone;
    const hoje = diaCivilNoFuso(new Date(), fuso);
    // Só a janela que contém "agora" traz o dia de hoje; a anterior vem vazia.
    estatisticas = (url) => {
      const contemAgora = Date.parse(url.searchParams.get("desde") ?? "") <= Date.now() && Date.now() <= Date.parse(url.searchParams.get("ate") ?? "");
      return { ...SEM_ESTATISTICAS, fuso, mensagensEnviadas: contemAgora ? [{ dia: hoje, quantidade: 3 }] : [] };
    };
    await montar();
    await waitFor(() => {
      const botao = screen.getByRole("button", { name: /Mensagens enviadas/ });
      expect(botao.textContent).toContain("3");
    });

    const pedidos = chamadas("/crm/inicio/estatisticas");
    expect(pedidos).toHaveLength(2);
    for (const pedido of pedidos) {
      expect(pedido.searchParams.get("fuso")).toBe(fuso);
      expect(pedido.searchParams.has("membroId")).toBe(false);
      expect(conferirJanelaDeEstatisticas(pedido.searchParams.get("desde") ?? "", pedido.searchParams.get("ate") ?? "", fuso)).toEqual({ ok: true });
    }
  });

  it("no período Ano as duas janelas continuam dentro dos 400 dias que a api aceita", async () => {
    await montar();
    await waitFor(() => expect(chamadas("/crm/inicio/estatisticas")).toHaveLength(2));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ano" }));
    });
    await waitFor(() => expect(chamadas("/crm/inicio/estatisticas")).toHaveLength(4));
    const fuso = buildSeed().workspace.locale.timezone;
    for (const pedido of chamadas("/crm/inicio/estatisticas")) {
      expect(conferirJanelaDeEstatisticas(pedido.searchParams.get("desde") ?? "", pedido.searchParams.get("ate") ?? "", fuso)).toEqual({ ok: true });
    }
  });

  it("os Negócios ganhos do CRM trazem o Valor numa moeda só, formatado", async () => {
    const dados = buildSeed();
    const fuso = dados.workspace.locale.timezone;
    const hoje = diaCivilNoFuso(new Date(), fuso);
    estatisticas = (url) => {
      const contemAgora = Date.parse(url.searchParams.get("desde") ?? "") <= Date.now() && Date.now() <= Date.parse(url.searchParams.get("ate") ?? "");
      return { ...SEM_ESTATISTICAS, fuso, negociosGanhos: contemAgora ? [{ dia: hoje, moeda: "BRL", quantidade: 2, valor: 27994 }] : [] };
    };
    await montar();
    await waitFor(() => {
      const botao = screen.getByRole("button", { name: /Negócios ganhos/ });
      expect(botao.textContent).toContain("2");
      expect(botao.textContent).toMatch(/27\.994/);
    });
  });

  it("recusa da api: as métricas do CRM ficam em zero e a tela diz que não carregaram, sem esconder as Tarefas", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const alvo = new URL(url);
      if (alvo.pathname === "/crm/inicio/estatisticas") {
        return { ok: false, status: 403, json: async () => ({ ok: false, error: "Sem acesso.", codigo: "SEM_PERMISSAO" }) } as Response;
      }
      return resposta({ ok: true, itens: [], total: 0 });
    });
    await montar();
    await waitFor(() => expect(screen.getByText(/estatísticas do CRM não carregaram/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /Tarefas concluídas/ })).toBeTruthy();
  });
});

describe("Início › Panorama do robô (15-23)", () => {
  const PANORAMA: PanoramaDoCrm = {
    contatosRecentes: [
      { id: "c1", nome: "Ana do CRM" },
      { id: "c2", nome: "Bruno do CRM" },
      { id: "c3", nome: "Carla do CRM" },
      { id: "c4", nome: "Dario do CRM" },
      { id: "c5", nome: "Elisa do CRM" },
    ],
    contatosTotal: 42,
    negociosAbertos: { quantidade: 3, valorPonderado: 1500, moeda: "BRL" },
    conversasAbertas: 7,
  };

  it("montarPanorama usa o que o servidor somou: Contatos recentes (3 citados), Negócios abertos com o valor ponderado e Conversas abertas", () => {
    const dados = buildSeed();
    const formato = makeFormatters(dados.workspace.locale);
    const panorama = montarPanorama(dados, THIAGO, formato, new Date(), null, PANORAMA);
    expect(panorama.contatos).toEqual({ total: 42, recentes: ["Ana do CRM", "Bruno do CRM", "Carla do CRM"] });
    expect(panorama.negocios.abertos).toBe(3);
    expect(panorama.negocios.valorPonderado).toBe(formato.money({ amount: 1500, currency: "BRL" }));
    expect(panorama.conversas.abertas).toBe(7);
  });

  it("sem panorama (carregando) ou com bloco null (Papel sem `ler`), zeros e sem valor: o robô não inventa número", () => {
    const dados = buildSeed();
    const formato = makeFormatters(dados.workspace.locale);
    const vazio = montarPanorama(dados, THIAGO, formato, new Date(), null, undefined);
    expect([vazio.contatos.total, vazio.negocios.abertos, vazio.conversas.abertas]).toEqual([0, 0, 0]);
    expect(vazio.negocios.valorPonderado).toBeNull();
    const semAcesso = montarPanorama(dados, THIAGO, formato, new Date(), null, {
      contatosRecentes: null,
      contatosTotal: null,
      negociosAbertos: null,
      conversasAbertas: null,
    });
    expect([semAcesso.contatos.recentes, semAcesso.negocios.abertos, semAcesso.conversas.abertas]).toEqual([[], 0, 0]);
    // Mais de uma moeda: a api devolve null e o robô não escolhe uma.
    const mista = montarPanorama(dados, THIAGO, formato, new Date(), null, { ...PANORAMA, negociosAbertos: { quantidade: 2, valorPonderado: null, moeda: null } });
    expect([mista.negocios.abertos, mista.negocios.valorPonderado]).toEqual([2, null]);
  });

  it("useRespostaDoRobo lê GET /crm/inicio/panorama: a resposta cita os números do servidor, não os do store", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const alvo = new URL(url);
      if (alvo.pathname === "/crm/inicio/panorama") return resposta({ ok: true, dados: PANORAMA });
      return resposta({ ok: true, itens: [], total: 0 });
    });
    const dados = buildSeed();
    expect(dados.deals.filter((d) => d.lifecycle === "ativo" && d.situation === "aberto").length).not.toBe(3);
    const transporte: Transporte = {
      gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
      hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    };
    const Envoltorio = ({ children }: { children: ReactNode }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: dados, revisao: 1, ordens: {} }} transporte={transporte}>
          {children}
        </StoreProvider>
      </SWRConfig>
    );
    const { result } = renderHook(() => useRespostaDoRobo(), { wrapper: Envoltorio });
    await waitFor(() => expect(result.current("quantos negócios abertos?")).toContain("3 negócios abertos"));
    expect(result.current("quantos contatos?")).toContain("42 contatos");
    expect(result.current("quantos contatos?")).toContain("Ana do CRM");
    expect(result.current("tem conversa aberta?")).toContain("7 conversas abertas");
    expect(chamadas("/crm/inicio/panorama").length).toBeGreaterThan(0);
  });
});
