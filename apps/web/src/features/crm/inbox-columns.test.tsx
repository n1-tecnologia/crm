// @vitest-environment jsdom
/**
 * A lista de Conversas da Caixa de Entrada vem do CRM novo (`GET /conversas`,
 * `plataforma.conversas`): cada Conversa diz por qual CANAL entrou (D-16), a
 * janela de resposta só existe no provedor oficial (D-02), os escopos e as abas
 * viram filtros da api, a estrela grava por `PUT /conversas/:id/marcacao` e a
 * Conversa de Grupo — que segue no estado antigo (F14-D-05) — continua na lista.
 *
 * `StoreProvider` de verdade com o seed e o transporte em memória; a api é um
 * `fetch` roteado por URL e a sessão é falsa. Nenhuma rede.
 */

import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig, useSWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal } from "@n1/dominio/crm/canais";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import type { DataState } from "@n1/dominio/state";
import type { ConversaDeGrupo } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import { transporteEmMemoria } from "@/dados/transporte";
import CaixaDeEntradaPage from "@/app/(shell)/crm/caixa-de-entrada/page";
import { filtroDoEscopo, foraDaJanela, InboxColumns } from "@/features/crm/inbox-columns";

const { navegacao, obterSessao, revalidador } = vi.hoisted(() => ({
  navegacao: { busca: "" },
  obterSessao: vi.fn(),
  // O `mutate` do SWRConfig do teste: o global não alcança o cache isolado, este sim.
  revalidador: { revalidar: undefined as undefined | ((prefixo: string) => Promise<unknown>) },
}));

// `invalidarCrm` real usa o `mutate` global; aqui ele repassa o prefixo ao `mutate` do cache isolado do teste.
vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async (prefixo: string) => revalidador.revalidar?.(prefixo)) };
});

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navegacao.busca),
}));

let estado: DataState;

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

function canalDoCrm(extras: Partial<Canal> = {}): Canal {
  return {
    id: "k_comercial",
    nome: "Comercial",
    tipo: "whatsapp",
    provedor: "whatsapp-cloud",
    identificadorExterno: "+5511977770001",
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: "2026-10-01T10:00:00.000Z",
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_thiago",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_thiago",
    criadoEm: "2026-10-01T10:00:00.000Z",
    atualizadoEm: "2026-10-01T10:00:00.000Z",
    ...extras,
  };
}

function conversaDoCrm(id: string, extras: Partial<ConversaNaLista> = {}): ConversaNaLista {
  return {
    id,
    canalId: "k_comercial",
    contatoId: `c_${id}`,
    titulo: `Conversa ${id}`,
    tituloEditado: false,
    situacao: "aberta",
    estado: "ativo",
    naLixeiraEm: null,
    filaId: null,
    atribuido: { tipo: "membro", id: "mem_thiago" },
    adiadaAte: null,
    adiamentoMotivo: null,
    participantes: [],
    resolvidaEm: null,
    reabertaEm: null,
    reaberturas: 0,
    criadoPor: { tipo: "member", id: "mem_thiago" },
    criadoEm: "2026-10-01T10:00:00.000Z",
    atualizadoEm: horasAtras(1),
    contatoNome: `Contato ${id}`,
    estrela: false,
    naoLidas: 0,
    ultimaRecebidaEm: null,
    ...extras,
  };
}

/** Uma Conversa de Grupo do estado antigo (F14-D-05): não tem tabela, só `groupIdentifier`. */
function conversaDeGrupo(id: string, nome: string): ConversaDeGrupo {
  const modelo = estado.conversations[0] ?? buildSeed().conversations.find((c) => c.messages.length > 0);
  if (!modelo) throw new Error("o seed precisa de uma Conversa com Mensagem");
  const base = structuredClone(modelo);
  delete base.contactId;
  return {
    ...base,
    id,
    channelId: "k_comercial",
    lifecycle: "ativo",
    state: "aberta",
    title: nome,
    groupIdentifier: { externalId: `g_${id}`, name: nome },
    assignee: undefined,
    queueId: undefined,
    snooze: undefined,
    starredBy: [],
    drafts: [],
    messages: [],
  } as ConversaDeGrupo;
}

type Rota = (url: string, init?: RequestInit) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn>;
/** A rota padrão da api falsa; os testes que mudam uma resposta delegam o resto a ela. */
let rotaPadrao: Rota;
let conversasDaApi: ConversaNaLista[];
let canaisDaApi: Canal[];
/** O que o PUT da marcação responde; os testes trocam para segurar ou recusar. */
let gravarMarcacao: (id: string, corpo: { estrela?: boolean }) => Promise<Response>;

/** Aplica à lista falsa os mesmos filtros que a api aplica, para o teste ler o efeito, não só a URL. */
function filtrar(url: URL): ConversaNaLista[] {
  const p = url.searchParams;
  return conversasDaApi.filter(
    (c) =>
      (p.get("atribuidoId") === null || c.atribuido?.id === p.get("atribuidoId")) &&
      (p.get("canalId") === null || c.canalId === p.get("canalId")) &&
      (p.get("filaId") === null || c.filaId === p.get("filaId")) &&
      (p.get("situacao") === null || c.situacao === p.get("situacao")) &&
      (p.get("naoLidas") !== "true" || c.naoLidas > 0) &&
      (p.get("comEstrela") !== "true" || c.estrela),
  );
}

beforeEach(() => {
  navegacao.busca = "aba=todos";
  estado = buildSeed();
  // O estado antigo só tem o que o teste pôr (Grupo): a lista do seed não entra na conta.
  estado.conversations = [];
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  canaisDaApi = [canalDoCrm()];
  conversasDaApi = [];
  gravarMarcacao = async (id, corpo) => {
    const alvo = conversasDaApi.find((c) => c.id === id);
    if (alvo && corpo.estrela !== undefined) conversasDaApi = conversasDaApi.map((c) => (c.id === id ? { ...c, estrela: corpo.estrela! } : c));
    return resposta(200, { ok: true, dados: { estrela: corpo.estrela ?? false, lidaAte: null } });
  };
  rotaPadrao = async (url, init) => {
    const alvo = new URL(url);
    if (init?.method === "PUT" && /^\/conversas\/[^/]+\/marcacao$/.test(alvo.pathname)) {
      const id = alvo.pathname.split("/")[2]!;
      return gravarMarcacao(id, JSON.parse(String(init.body)) as { estrela?: boolean });
    }
    if (alvo.pathname === "/conversas") {
      const itens = filtrar(alvo);
      // `limite=1` é a consulta de contagem das abas: só o total interessa.
      return resposta(200, { ok: true, itens: itens.slice(0, Number(alvo.searchParams.get("limite") ?? 50)), total: itens.length });
    }
    if (alvo.pathname === "/canais") return resposta(200, { ok: true, itens: canaisDaApi, total: canaisDaApi.length });
    return resposta(404, { ok: false, error: "sem rota" });
  };
  fetchMock = vi.fn((url: string, init?: RequestInit) => rotaPadrao(url, init));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function chamadas(): URL[] {
  return fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method !== "PUT").map((c) => new URL(String(c[0])));
}

/** As consultas de lista (não as de contagem, `limite=1`) que a tela fez. */
function listasPedidas(): URL[] {
  return chamadas().filter((u) => u.pathname === "/conversas" && u.searchParams.get("limite") !== "1");
}

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

function montar(pagina = false) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <RegistrarRevalidacao />
      <StoreProvider
        sessao={{ memberId: "mem_thiago" }}
        estadoInicial={{ data: estado, revisao: 1, ordens: {} }}
        transporte={transporteEmMemoria()}
      >
        {pagina ? <CaixaDeEntradaPage /> : <InboxColumns>{null}</InboxColumns>}
      </StoreProvider>
    </SWRConfig>,
  );
}

/** O link do item da lista de uma Conversa — onde o Canal e os marcadores moram. */
function itemDe(conversaId: string): HTMLElement {
  const link = screen
    .getAllByRole("link")
    .find((a) => a.getAttribute("href")?.startsWith(`/crm/caixa-de-entrada/${conversaId}`));
  if (!link) throw new Error(`sem item para a Conversa ${conversaId}`);
  return link;
}

async function itemApareceu(conversaId: string): Promise<HTMLElement> {
  await waitFor(() => expect(itemDe(conversaId)).toBeTruthy());
  return itemDe(conversaId);
}

describe("InboxColumns — a lista por Canal", () => {
  beforeEach(() => {
    canaisDaApi = [canalDoCrm({ id: "k_comercial", nome: "Comercial" }), canalDoCrm({ id: "k_suporte", nome: "Suporte", provedor: "whatsapp-nao-oficial", conexaoSimulada: true })];
    // Recebida às 08h e uma resposta 30 h depois: passou da janela de 24 h do WhatsApp oficial.
    const recebida = horasAtras(30);
    conversasDaApi = [
      conversaDoCrm("cnv_comercial", { canalId: "k_comercial", ultimaRecebidaEm: recebida }),
      conversaDoCrm("cnv_suporte", { canalId: "k_suporte", ultimaRecebidaEm: recebida }),
    ];
  });

  it("(1) sem filtro, cada Conversa diz o nome do seu Canal", async () => {
    montar();
    expect(within(await itemApareceu("cnv_comercial")).getByText("Comercial")).toBeTruthy();
    expect(within(await itemApareceu("cnv_suporte")).getByText("Suporte")).toBeTruthy();
    // O disco do Canal também diz o provedor, para leitor de tela e para o `title`.
    expect(within(itemDe("cnv_suporte")).getByText("Suporte · WhatsApp não oficial")).toBeTruthy();
  });

  it("(2) com ?canal=<Suporte>, a api é pedida com canalId e só a Conversa de Suporte aparece", async () => {
    navegacao.busca = "aba=todos&canal=k_suporte";
    montar();
    await itemApareceu("cnv_suporte");
    expect(() => itemDe("cnv_comercial")).toThrow();
    expect(listasPedidas().some((u) => u.searchParams.get("canalId") === "k_suporte")).toBe(true);
  });

  it("(3) o filtro Canal nomeia cada Canal com o rótulo do provedor, lido de useCanais", async () => {
    montar();
    await itemApareceu("cnv_comercial");
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Canal" }));
    expect(screen.getByRole("option", { name: "Suporte · WhatsApp não oficial" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Comercial · WhatsApp oficial" })).toBeTruthy();
  });

  it("(4) fora do Prazo só aparece no Canal oficial: o não oficial não tem janela", async () => {
    montar();
    expect(within(await itemApareceu("cnv_comercial")).getByText("fora do Prazo")).toBeTruthy();
    expect(within(itemDe("cnv_suporte")).queryByText("fora do Prazo")).toBeNull();
  });

  it("(5) o cabeçalho leva às Configurações da Caixa de Entrada, onde moram Canais e Filas", () => {
    montar();
    const atalho = screen.getByRole("link", { name: "Configurações da Caixa de Entrada" });
    expect(atalho.getAttribute("href")).toBe("/crm/caixa-de-entrada/configuracoes");
  });
});

describe("InboxColumns — o escopo Minhas pelo CRM novo", () => {
  it("(6) Minhas lista as Conversas de atribuidoId=<Membro> com nome, avatar e não lidas da api, e a janela de resposta aberta só na recente", async () => {
    navegacao.busca = "aba=todos&escopo=minhas";
    conversasDaApi = [
      conversaDoCrm("v1", { contatoNome: "Ana Souza", naoLidas: 3, ultimaRecebidaEm: horasAtras(2) }),
      conversaDoCrm("v2", { contatoNome: "Beto Lima", naoLidas: 0, ultimaRecebidaEm: horasAtras(30) }),
    ];
    montar();

    const primeira = await itemApareceu("v1");
    expect(listasPedidas().some((u) => u.searchParams.get("atribuidoId") === "mem_thiago")).toBe(true);
    // Nome do Contato vindo da api, avatar com as iniciais e a contagem de não lidas.
    expect(within(primeira).getAllByText("Ana Souza").length).toBeGreaterThan(0);
    expect(within(primeira).getByText("AS")).toBeTruthy();
    expect(within(primeira).getByText("3")).toBeTruthy();
    expect(within(itemDe("v2")).getAllByText("Beto Lima").length).toBeGreaterThan(0);
    // Canal pelo nome; janela de 24 h do WhatsApp oficial: aberta na de 2 h, fechada na de 30 h.
    expect(within(primeira).getByText("Comercial")).toBeTruthy();
    expect(within(primeira).queryByText("fora do Prazo")).toBeNull();
    expect(within(itemDe("v2")).getByText("fora do Prazo")).toBeTruthy();
  });

  it("(7) o Canal não oficial não tem janela: nunca marca fora do Prazo", async () => {
    navegacao.busca = "aba=todos&escopo=minhas";
    canaisDaApi = [canalDoCrm({ provedor: "whatsapp-nao-oficial" })];
    conversasDaApi = [conversaDoCrm("v3", { contatoNome: "Carla", ultimaRecebidaEm: horasAtras(90) })];
    montar();

    expect(within(await itemApareceu("v3")).queryByText("fora do Prazo")).toBeNull();
  });

  it("(8) o texto vindo da api é texto, não HTML (T-15-32)", async () => {
    navegacao.busca = "aba=todos&escopo=minhas";
    conversasDaApi = [conversaDoCrm("v4", { contatoNome: "<img src=x onerror=alert(1)>" })];
    const { container } = montar();

    await itemApareceu("v4");
    expect(container.querySelector("img")).toBeNull();
    expect(within(itemDe("v4")).getAllByText("<img src=x onerror=alert(1)>").length).toBeGreaterThan(0);
  });
});

describe("InboxColumns — os escopos, as abas e os filtros viram filtros da api", () => {
  it("(9) filtroDoEscopo: Minhas é o Membro da sessão; os outros escopos não filtram por atribuição", () => {
    expect(filtroDoEscopo("minhas", "mem_thiago")).toEqual({ atribuidoId: "mem_thiago" });
    expect(filtroDoEscopo("todas", "mem_thiago")).toEqual({});
  });

  it("(10) a aba Não lidos pede naoLidas=true, Marcados pede comEstrela=true, e o estado e a Fila vão como situacao e filaId", async () => {
    conversasDaApi = [conversaDoCrm("a1", { naoLidas: 2, estrela: true, situacao: "pendente", filaId: "fila_com" })];
    navegacao.busca = "aba=naoLidos&estado=pendente&fila=fila_com";
    montar();
    await itemApareceu("a1");
    const naoLidos = listasPedidas().find((u) => u.searchParams.get("naoLidas") === "true");
    expect(naoLidos?.searchParams.get("situacao")).toBe("pendente");
    expect(naoLidos?.searchParams.get("filaId")).toBe("fila_com");

    cleanup();
    fetchMock.mockClear();
    navegacao.busca = "aba=marcados";
    montar();
    await itemApareceu("a1");
    expect(listasPedidas().some((u) => u.searchParams.get("comEstrela") === "true")).toBe(true);
  });

  it("(11) Sem Atribuído filtra no cliente, sobre a página inteira: só a Conversa sem Atribuído aparece", async () => {
    navegacao.busca = "aba=todos&escopo=semAtribuido";
    conversasDaApi = [conversaDoCrm("s1", { atribuido: null }), conversaDoCrm("s2")];
    montar();
    await itemApareceu("s1");
    expect(() => itemDe("s2")).toThrow();
    expect(listasPedidas().some((u) => u.searchParams.get("limite") === "200")).toBe(true);
  });

  it("(12) Adiadas e Sem Fila também: a api não tem esses filtros, a tela recorta a página", async () => {
    navegacao.busca = "aba=todos&escopo=adiadas";
    conversasDaApi = [conversaDoCrm("d1", { adiadaAte: horasAtras(-5) }), conversaDoCrm("d2"), conversaDoCrm("d3", { filaId: "fila_com" })];
    montar();
    await itemApareceu("d1");
    expect(() => itemDe("d2")).toThrow();
    cleanup();

    navegacao.busca = "aba=todos&fila=semFila";
    montar();
    await itemApareceu("d1");
    expect(() => itemDe("d3")).toThrow();
  });

  it("(13) o topo mostra o total da api, não o tamanho da página, e os contadores das abas também", async () => {
    // Duas Conversas na página, 57 no total (a api pagina): o texto diz "2 de 57".
    conversasDaApi = [conversaDoCrm("t1"), conversaDoCrm("t2")];
    const total = 57;
    const original = rotaPadrao;
    rotaPadrao = async (url, init) => {
      const alvo = new URL(url);
      if (alvo.pathname === "/conversas" && init?.method !== "PUT") {
        const naoLidas = alvo.searchParams.get("naoLidas") === "true";
        const estrela = alvo.searchParams.get("comEstrela") === "true";
        return resposta(200, { ok: true, itens: naoLidas || estrela ? [] : conversasDaApi, total: naoLidas ? 7 : estrela ? 4 : total });
      }
      return original(url, init);
    };
    montar();
    await waitFor(() => expect(screen.getByText("Selecionar tudo · 2 de 57")).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("tab", { name: /Não lidos/ }).textContent).toContain("7"));
    expect(screen.getByRole("tab", { name: /Marcados/ }).textContent).toContain("4");
  });
});

describe("InboxColumns — a estrela vai pela api (UCR-05)", () => {
  it("(14) clicar na estrela faz PUT /conversas/<id>/marcacao com { estrela: true } e nenhuma operação antiga", async () => {
    conversasDaApi = [conversaDoCrm("e1")];
    montar();
    await itemApareceu("e1");
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PUT");
      expect(put).toBeTruthy();
      expect(String(put![0])).toBe("http://api/conversas/e1/marcacao");
      expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({ estrela: true });
    });
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/operacoes/"))).toBe(false);
    // A lista recarrega no sucesso e a estrela fica acesa.
    await waitFor(() => expect(screen.getByRole("button", { name: "Desmarcar" }).getAttribute("aria-pressed")).toBe("true"));
  });

  it("(15) dois cliques seguidos: a 2ª gravação só sai depois da 1ª e parte do valor dela; o valor final é o certo", async () => {
    conversasDaApi = [conversaDoCrm("e2")];
    let liberarPrimeira!: () => void;
    const primeira = new Promise<void>((resolve) => (liberarPrimeira = resolve));
    const corpos: boolean[] = [];
    const padrao = gravarMarcacao;
    gravarMarcacao = async (id, corpo) => {
      corpos.push(corpo.estrela!);
      if (corpos.length === 1) await primeira;
      return padrao(id, corpo);
    };
    montar();
    await itemApareceu("e2");

    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));
    // Antes de a api responder, a tela já mostra a marcação; o 2º clique desmarca.
    await waitFor(() => expect(screen.getByRole("button", { name: "Desmarcar" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar" }));
    await act(async () => {});
    expect(corpos).toEqual([true]);

    await act(async () => liberarPrimeira());
    await waitFor(() => expect(corpos).toEqual([true, false]));
    await waitFor(() => expect(screen.getByRole("button", { name: "Marcar" }).getAttribute("aria-pressed")).toBe("false"));
    expect(conversasDaApi[0]?.estrela).toBe(false);
  });

  it("(16) a recusa da api desfaz a marcação mostrada: a estrela não fica acesa sem ter sido gravada", async () => {
    conversasDaApi = [conversaDoCrm("e3")];
    gravarMarcacao = async () => resposta(403, { ok: false, error: "Sem permissão." });
    montar();
    await itemApareceu("e3");
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));

    await waitFor(() => expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "PUT")).toBe(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "Marcar" }).getAttribute("aria-pressed")).toBe("false"));
  });
});

describe("InboxColumns — o Grupo segue na lista (F14-D-05)", () => {
  it("(17) a Conversa de Grupo do estado antigo aparece junto das Conversas da api, e uma Conversa antiga sem Grupo não", async () => {
    conversasDaApi = [conversaDoCrm("g0")];
    const antiga = conversaDeGrupo("cnv_antiga", "Conversa antiga");
    const semGrupo = structuredClone(antiga);
    delete semGrupo.groupIdentifier;
    estado.conversations = [conversaDeGrupo("cnv_grupo", "Grupo Vendas"), semGrupo];
    montar();

    await itemApareceu("g0");
    expect(within(await itemApareceu("cnv_grupo")).getAllByText("Grupo Vendas").length).toBeGreaterThan(0);
    expect(() => itemDe("cnv_antiga")).toThrow();
  });

  it("(18) o filtro do escopo vale para o Grupo também: em Minhas, o Grupo sem Atribuído não entra", async () => {
    navegacao.busca = "aba=todos&escopo=minhas";
    conversasDaApi = [conversaDoCrm("g1")];
    estado.conversations = [conversaDeGrupo("cnv_grupo", "Grupo Vendas")];
    montar();

    await itemApareceu("g1");
    expect(() => itemDe("cnv_grupo")).toThrow();
  });

  it("(19) a estrela do Grupo segue pela operação antiga: o Grupo não tem Conversa nas tabelas", async () => {
    estado.conversations = [conversaDeGrupo("cnv_grupo", "Grupo Vendas")];
    montar();
    await itemApareceu("cnv_grupo");
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Desmarcar" })).toBeTruthy());
    expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "PUT")).toBe(false);
  });
});

describe("foraDaJanela", () => {
  const agora = Date.parse("2026-11-06T12:00:00.000Z");
  const oficial = { tipo: "whatsapp", provedor: "whatsapp-cloud" } as const;

  it("(20) o WhatsApp oficial fecha 24 h depois da última recebida; sem recebida, sem Canal ou sem janela, nunca", () => {
    expect(foraDaJanela(oficial, "2026-11-05T13:00:00.000Z", agora)).toBe(false);
    expect(foraDaJanela(oficial, "2026-11-05T11:00:00.000Z", agora)).toBe(true);
    expect(foraDaJanela(oficial, null, agora)).toBe(false);
    expect(foraDaJanela(undefined, "2026-10-01T00:00:00.000Z", agora)).toBe(false);
    expect(foraDaJanela({ tipo: "whatsapp", provedor: "whatsapp-nao-oficial" }, "2026-10-01T00:00:00.000Z", agora)).toBe(false);
  });
});

describe("Caixa de entrada sem Conversa aberta — a contagem do topo", () => {
  it("(21) conta as aguardando resposta pelo total da api (abertas e pendentes), não por state.conversations", async () => {
    const original = rotaPadrao;
    rotaPadrao = async (url, init) => {
      const alvo = new URL(url);
      if (alvo.pathname === "/conversas") {
        const situacao = alvo.searchParams.get("situacao");
        return resposta(200, { ok: true, itens: [], total: situacao === "aberta" ? 5 : situacao === "pendente" ? 2 : 0 });
      }
      return original(url, init);
    };
    montar(true);

    await waitFor(() => expect(screen.getByText("Caixa de entrada da equipe: 7 Conversa(s) aguardando resposta.")).toBeTruthy());
    expect(chamadas().some((u) => u.pathname === "/conversas" && u.searchParams.get("situacao") === "aberta" && u.searchParams.get("limite") === "1")).toBe(true);
  });

  it("(22) as Conversas de Grupo do estado antigo entram na contagem", async () => {
    const original = rotaPadrao;
    rotaPadrao = async (url, init) => {
      const alvo = new URL(url);
      if (alvo.pathname === "/conversas") return resposta(200, { ok: true, itens: [], total: alvo.searchParams.get("situacao") === "aberta" ? 1 : 0 });
      return original(url, init);
    };
    estado.conversations = [conversaDeGrupo("cnv_grupo", "Grupo Vendas")];
    montar(true);

    await waitFor(() => expect(screen.getByText("Caixa de entrada da equipe: 2 Conversa(s) aguardando resposta.")).toBeTruthy());
  });
});
