// @vitest-environment jsdom
/**
 * 15-14 Task 1 (UCR-07) — `useNotificacoesDoMembro`: o selo da barra, o painel, a página de Notificações e o
 * panorama do robô contam as Conversas atribuídas ao Membro pelo `total` de `GET /conversas`
 * (uma consulta por situação), não pelo `state.conversations` do modelo antigo. O que não é do CRM
 * (aprovações, Tarefas, menções) segue vindo do store. Nenhuma rede: `fetch` roteado, sessão falsa,
 * `StoreProvider` de verdade com o seed.
 */

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { notificacoesDoMembro } from "@n1/dominio/derive";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { useNotificacoesDoMembro } from "./use-notificacoes";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

const THIAGO = "mem_thiago";

function conversa(id: string, situacao: "aberta" | "pendente", atualizadoEm: string): ConversaNaLista {
  return {
    id,
    canalId: "can_1",
    contatoId: "ctt_1",
    titulo: `Conversa ${id}`,
    tituloEditado: false,
    situacao,
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
    atualizadoEm,
    contatoNome: "Ana Souza",
    estrela: false,
    naoLidas: 0,
    ultimaRecebidaEm: null,
  };
}

function resposta(corpo: unknown): Response {
  return { ok: true, status: 200, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
let porSituacao: Record<"aberta" | "pendente", { itens: ConversaNaLista[]; total: number }>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  porSituacao = { aberta: { itens: [], total: 0 }, pendente: { itens: [], total: 0 } };
  fetchMock = vi.fn(async (url: string) => {
    const situacao = new URL(url).searchParams.get("situacao");
    if (situacao === "aberta" || situacao === "pendente") return resposta({ ok: true, ...porSituacao[situacao] });
    return resposta({ ok: true, itens: [], total: 0 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function envolver() {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const dados = buildSeed();
  const Envoltorio = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: dados, revisao: 1, ordens: {} }} transporte={transporte}>
        {children}
      </StoreProvider>
    </SWRConfig>
  );
  return { Envoltorio, dados };
}

const SEM_CONVERSAS = { itens: [], total: 0 } as const;

describe("useNotificacoesDoMembro (15-14)", () => {
  it("soma o `total` da api de aberta e de pendente: 3 + 1 Conversas entram no total", async () => {
    porSituacao.aberta = { itens: [conversa("a1", "aberta", "2026-11-05T10:00:00.000Z")], total: 3 };
    porSituacao.pendente = { itens: [conversa("p1", "pendente", "2026-11-06T10:00:00.000Z")], total: 1 };
    const { Envoltorio, dados } = envolver();
    const semConversas = notificacoesDoMembro(dados, THIAGO, new Date(), SEM_CONVERSAS).total;
    const { result } = renderHook(() => useNotificacoesDoMembro(), { wrapper: Envoltorio });
    await waitFor(() => expect(result.current.total).toBe(semConversas + 4));
    expect(result.current.carregando).toBe(false);
  });

  it("uma consulta por situação, do Membro da sessão, com limite 20 (o total da api conta, não a página)", async () => {
    const { Envoltorio } = envolver();
    const { result } = renderHook(() => useNotificacoesDoMembro(), { wrapper: Envoltorio });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const urls = fetchMock.mock.calls.map((chamada) => new URL(chamada[0] as string));
    expect(urls.map((u) => u.pathname)).toEqual(["/conversas", "/conversas"]);
    expect(urls.map((u) => u.searchParams.get("situacao")).sort()).toEqual(["aberta", "pendente"]);
    for (const u of urls) {
      expect(u.searchParams.get("atribuidoId")).toBe(THIAGO);
      expect(u.searchParams.get("limite")).toBe("20");
      expect(u.searchParams.get("estado")).toBe("ativo");
    }
  });

  it("as Conversas antigas do seed atribuídas ao Membro não contam; a lista vem das duas situações, a mais recente primeiro", async () => {
    porSituacao.aberta = { itens: [conversa("a1", "aberta", "2026-11-05T10:00:00.000Z")], total: 1 };
    porSituacao.pendente = { itens: [conversa("p1", "pendente", "2026-11-06T10:00:00.000Z")], total: 1 };
    const { Envoltorio, dados } = envolver();
    expect(dados.conversations.some((c) => c.assignee?.kind === "member" && c.assignee.id === THIAGO)).toBe(true);
    const { result } = renderHook(() => useNotificacoesDoMembro(), { wrapper: Envoltorio });
    await waitFor(() => expect(result.current.conversas).toHaveLength(2));
    expect(result.current.conversas.map((c) => c.id)).toEqual(["p1", "a1"]);
  });

  it("enquanto a api não respondeu, `carregando` é verdadeiro e nenhuma Conversa entra; o resto vem do store", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    const { Envoltorio, dados } = envolver();
    const { result } = renderHook(() => useNotificacoesDoMembro(), { wrapper: Envoltorio });
    expect(result.current.carregando).toBe(true);
    expect(result.current.conversas).toEqual([]);
    expect(result.current.total).toBe(notificacoesDoMembro(dados, THIAGO, new Date(), SEM_CONVERSAS).total);
  });
});
