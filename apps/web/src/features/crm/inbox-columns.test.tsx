// @vitest-environment jsdom
/**
 * 08-11 Task 2 — a lista de Conversas da Caixa de Entrada diz por qual CANAL
 * cada Conversa entrou (D-16), provado com dois WhatsApps no mesmo Espaço: o
 * nome do Canal no item, o filtro `?canal=` com o rótulo do provedor e, na
 * lista, a janela de resposta que só o provedor oficial tem (D-02).
 * `StoreProvider` de verdade com o seed e o transporte em memória; nenhuma rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal } from "@n1/dominio/crm/canais";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import type { DataState } from "@n1/dominio/state";
import type { Channel, Contact, Conversation, Message } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import { transporteEmMemoria } from "@/dados/transporte";
import { InboxColumns } from "@/features/crm/inbox-columns";

const { navegacao, obterSessao } = vi.hoisted(() => ({ navegacao: { busca: "" }, obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navegacao.busca),
}));

let estado: DataState;
let contato: Contact;

function novoCanal(
  id: string,
  nome: string,
  provider: NonNullable<Channel["provider"]>,
  extras: Partial<Channel> = {},
): void {
  const base = estado.channels.find((c) => c.id === "chn_wpp");
  if (!base) throw new Error("o seed precisa do Canal chn_wpp");
  estado.channels.push({
    ...structuredClone(base),
    id,
    name: nome,
    externalId: `+5511${id.length}${nome.length}0000000`,
    connection: "conectada",
    provider,
    relational: true,
    messageTemplates: [],
    ...extras,
  });
}

type Troca = readonly [direcao: Message["direction"], criadoEm: string];

function novaConversa(modelo: Conversation, id: string, canalId: string, mensagens: readonly Troca[]): void {
  const mensagem = modelo.messages[0];
  if (!mensagem) throw new Error("o seed precisa de uma Conversa com Mensagem");
  estado.conversations.push({
    ...structuredClone(modelo),
    id,
    channelId: canalId,
    contactId: contato.id,
    lifecycle: "ativo",
    state: "aberta",
    drafts: [],
    messages: mensagens.map(([direction, createdAt], i) => ({
      ...structuredClone(mensagem),
      id: `${id}_m${i}`,
      conversationId: id,
      direction,
      content: `${id} mensagem ${i}`,
      createdAt,
    })),
  });
}

beforeEach(() => {
  navegacao.busca = "aba=todos";
  estado = buildSeed();
  const candidato = estado.contacts.find((c) => c.identifiers.some((i) => i.type === "identidadeDeWhatsApp"));
  const modelo = estado.conversations.find((c) => c.messages.length > 0);
  if (!candidato || !modelo) throw new Error("o seed precisa de um Contato com WhatsApp e de uma Conversa com Mensagem");
  contato = candidato;
  const molde = structuredClone(modelo);
  // Só as duas Conversas deste teste: a lista do seed não entra na conta.
  estado.conversations = [];

  novoCanal("chn_comercial", "Comercial", "whatsapp-cloud");
  novoCanal("chn_suporte", "Suporte", "whatsapp-nao-oficial", { simulatedConnection: true });

  // Recebida às 08h e uma resposta 30 h depois: passou da janela de 24 h do WhatsApp oficial.
  const trocas: readonly Troca[] = [
    ["recebida", "2026-10-10T08:00:00.000Z"],
    ["enviada", "2026-10-11T14:00:00.000Z"],
  ];
  novaConversa(molde, "cnv_comercial", "chn_comercial", trocas);
  novaConversa(molde, "cnv_suporte", "chn_suporte", trocas);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar() {
  return render(
    <StoreProvider
      sessao={{ memberId: "mem_thiago" }}
      estadoInicial={{ data: estado, revisao: 1, ordens: {} }}
      transporte={transporteEmMemoria()}
    >
      <InboxColumns>{null}</InboxColumns>
    </StoreProvider>,
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

describe("InboxColumns — a lista por Canal", () => {
  it("(1) sem filtro, cada Conversa diz o nome do seu Canal", () => {
    montar();
    expect(within(itemDe("cnv_comercial")).getByText("Comercial")).toBeTruthy();
    expect(within(itemDe("cnv_suporte")).getByText("Suporte")).toBeTruthy();
    // O disco do Canal também diz o provedor, para leitor de tela e para o `title`.
    expect(within(itemDe("cnv_suporte")).getByText("Suporte · WhatsApp não oficial")).toBeTruthy();
  });

  it("(2) com ?canal=<Suporte>, só a Conversa de Suporte aparece", () => {
    navegacao.busca = "aba=todos&canal=chn_suporte";
    montar();
    expect(itemDe("cnv_suporte")).toBeTruthy();
    expect(() => itemDe("cnv_comercial")).toThrow();
  });

  it("(3) o filtro Canal nomeia cada Canal com o rótulo do provedor", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Canal" }));
    expect(screen.getByRole("option", { name: "Suporte · WhatsApp não oficial" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Comercial · WhatsApp oficial" })).toBeTruthy();
  });

  it("(4) fora do Prazo só aparece no Canal oficial: o não oficial não tem janela", () => {
    montar();
    expect(within(itemDe("cnv_comercial")).getByText("fora do Prazo")).toBeTruthy();
    expect(within(itemDe("cnv_suporte")).queryByText("fora do Prazo")).toBeNull();
  });

  it("(5) o cabeçalho leva às Configurações da Caixa de Entrada, onde moram Canais e Filas", () => {
    montar();
    const atalho = screen.getByRole("link", { name: "Configurações da Caixa de Entrada" });
    expect(atalho.getAttribute("href")).toBe("/crm/caixa-de-entrada/configuracoes");
  });
});

/* ───────────────────────────── 15-11: a lista vem do CRM novo ───────────────────────────── */

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
    contatoNome: null,
    estrela: false,
    naoLidas: 0,
    ultimaRecebidaEm: null,
    ...extras,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let conversasDaApi: ConversaNaLista[];
let canaisDaApi: Canal[];

function chamadas(): string[] {
  return fetchMock.mock.calls.map((c) => String(c[0]));
}

function montarComCrm() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider
        sessao={{ memberId: "mem_thiago" }}
        estadoInicial={{ data: estado, revisao: 1, ordens: {} }}
        transporte={transporteEmMemoria()}
      >
        <InboxColumns>{null}</InboxColumns>
      </StoreProvider>
    </SWRConfig>,
  );
}

describe("InboxColumns — a coluna Minhas pelo CRM novo (15-11)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api";
    obterSessao.mockReset();
    obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    canaisDaApi = [canalDoCrm()];
    conversasDaApi = [];
    fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/conversas?")) {
        const naoLidas = new URL(url).searchParams.get("naoLidas") === "true";
        const itens = naoLidas ? conversasDaApi.filter((c) => c.naoLidas > 0) : conversasDaApi;
        return resposta(200, { ok: true, itens, total: itens.length });
      }
      if (url.includes("/canais?")) return resposta(200, { ok: true, itens: canaisDaApi, total: canaisDaApi.length });
      return resposta(404, { ok: false, error: "sem rota" });
    });
    vi.stubGlobal("fetch", fetchMock);
    // Só Grupo (ou nada) no estado antigo: a lista de "Minhas" não pode depender dele.
    estado.conversations = [];
  });

  it("(6) Minhas lista as Conversas de atribuidoId=<Membro> com nome, avatar e não lidas da api, e a janela de resposta aberta só na recente", async () => {
    navegacao.busca = "aba=todos&escopo=minhas";
    conversasDaApi = [
      conversaDoCrm("v1", { contatoNome: "Ana Souza", naoLidas: 3, ultimaRecebidaEm: horasAtras(2) }),
      conversaDoCrm("v2", { contatoNome: "Beto Lima", naoLidas: 0, ultimaRecebidaEm: horasAtras(30) }),
    ];
    montarComCrm();

    await waitFor(() => expect(itemDe("v1")).toBeTruthy());
    expect(chamadas().some((u) => u.includes("/conversas?") && new URL(u).searchParams.get("atribuidoId") === "mem_thiago")).toBe(true);
    // Nome do Contato vindo da api, avatar com as iniciais e a contagem de não lidas.
    const primeira = itemDe("v1");
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
    montarComCrm();

    await waitFor(() => expect(itemDe("v3")).toBeTruthy());
    expect(within(itemDe("v3")).queryByText("fora do Prazo")).toBeNull();
  });

  it("(8) o texto vindo da api é texto, não HTML (T-15-32)", async () => {
    navegacao.busca = "aba=todos&escopo=minhas";
    conversasDaApi = [conversaDoCrm("v4", { contatoNome: "<img src=x onerror=alert(1)>" })];
    const { container } = montarComCrm();

    await waitFor(() => expect(itemDe("v4")).toBeTruthy());
    expect(container.querySelector("img")).toBeNull();
    expect(within(itemDe("v4")).getAllByText("<img src=x onerror=alert(1)>").length).toBeGreaterThan(0);
  });
});
