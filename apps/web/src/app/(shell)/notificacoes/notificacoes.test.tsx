// @vitest-environment jsdom
/**
 * 11-04 (TAR-05) — Notificações › "Menções a você" com as duas origens: o
 * Comentário (texto de sempre) e a descrição da Tarefa ("na descrição de").
 *
 * Molde de `pagina-do-espaco.test.tsx`: `buildSeed()`, `StoreProvider` de
 * verdade, zero rede.
 *
 * 15-14 — a seção "Conversas atribuídas a você" lê do CRM novo (`GET /conversas`): `fetch`
 * roteado e sessão falsa, sem tocar no `state.conversations` do modelo antigo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { addTaskComment, changeTaskStatus, updateTask } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { SWRConfig } from "swr";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import NotificacoesPage from "@/app/(shell)/notificacoes/page";

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
const JULIA = "mem_julia";
const TAREFA = "tsk_seed_1";

let state: DataState;

beforeEach(() => {
  state = buildSeed();
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  // Sem Conversa na api por padrão: a lista de Conversas só aparece nos casos que a montam.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, itens: [], total: 0 }) }) as Response),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function montar(memberId = JULIA) {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
          <NotificacoesPage />
        </StoreProvider>
      </SWRConfig>,
    );
  });
}

const tarefa = () => state.tasks.find((t) => t.id === TAREFA)!;

describe("Notificações › Menções a você (11-04)", () => {
  it("mostra a menção da descrição com o título, o trecho e o link para a Tarefa", async () => {
    const r = updateTask(state, THIAGO, TAREFA, {
      description: "Pedir a @Júlia Prado a revisão",
      descriptionMentions: [{ type: "member", id: JULIA }],
    });
    expect(r.ok).toBe(true);

    await montar();

    expect(screen.getByText("Menções a você")).toBeTruthy();
    expect(screen.getByText(`Menção a você na descrição de “${tarefa().title}”`)).toBeTruthy();
    expect(screen.getByText("Pedir a @Júlia Prado a revisão")).toBeTruthy();
    const link = screen.getByText(`Menção a você na descrição de “${tarefa().title}”`).closest("a");
    expect(link?.getAttribute("href")).toBe(`/estrutura/tarefas/${TAREFA}`);
  });

  it("o aviso de Comentário continua com o texto e o link de sempre", async () => {
    const c = addTaskComment(state, THIAGO, TAREFA, { content: "Júlia, olha isto", mentions: [{ type: "member", id: JULIA }] });
    expect(c.ok).toBe(true);

    await montar();

    const texto = screen.getByText(`Thiago Nascimento mencionou você em “${tarefa().title}”`);
    expect(texto.closest("a")?.getAttribute("href")).toBe(`/estrutura/tarefas/${TAREFA}#comentario-${c.ok ? c.value.id : ""}`);
    expect(screen.queryByText(/na descrição de/)).toBeNull();
  });

  it("com a Tarefa fechada, a menção da descrição não aparece", async () => {
    const r = updateTask(state, THIAGO, TAREFA, {
      description: "Pedir a @Júlia Prado a revisão",
      descriptionMentions: [{ type: "member", id: JULIA }],
    });
    expect(r.ok).toBe(true);
    for (const item of tarefa().checklists.flatMap((c) => c.items)) item.done = true;
    expect(changeTaskStatus(state, THIAGO, TAREFA, "st_ops_conc").ok).toBe(true);

    await montar();

    expect(screen.queryByText(/na descrição de/)).toBeNull();
  });
});

describe("Notificações › Conversas atribuídas a você (15-14)", () => {
  function conversa(id: string, situacao: "aberta" | "pendente"): ConversaNaLista {
    return {
      id,
      canalId: "can_1",
      contatoId: "ctt_1",
      titulo: `Pedido ${id}`,
      tituloEditado: false,
      situacao,
      estado: "ativo",
      naLixeiraEm: null,
      filaId: null,
      atribuido: { tipo: "membro", id: JULIA },
      adiadaAte: null,
      adiamentoMotivo: null,
      participantes: [],
      resolvidaEm: null,
      reabertaEm: null,
      reaberturas: 0,
      criadoPor: { tipo: "membro", id: JULIA },
      criadoEm: "2026-11-01T10:00:00.000Z",
      atualizadoEm: "2026-11-01T10:00:00.000Z",
      contatoNome: "Ana Souza",
      estrela: false,
      naoLidas: 0,
      ultimaRecebidaEm: null,
    };
  }

  it("lista a Conversa da api pelo nome do Contato e leva à Caixa de Entrada; o número da seção é o total da api", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const situacao = new URL(url).searchParams.get("situacao");
        const corpo = situacao === "aberta" ? { ok: true, itens: [conversa("cnv_nova", "aberta")], total: 5 } : { ok: true, itens: [], total: 0 };
        return { ok: true, status: 200, json: async () => corpo } as Response;
      }),
    );

    await montar();

    await vi.waitFor(() => expect(screen.getByText("Conversas atribuídas a você")).toBeTruthy());
    const nome = screen.getByText("Ana Souza");
    expect(nome.closest("a")?.getAttribute("href")).toBe("/crm/caixa-de-entrada/cnv_nova");
    expect(screen.getByText("aberta · Pedido cnv_nova")).toBeTruthy();
    expect(screen.getByText("Mostrando 1 de 5. As demais estão na Caixa de Entrada.")).toBeTruthy();
  });

  it("as Conversas antigas do seed atribuídas ao Membro não aparecem", async () => {
    expect(state.conversations.some((c) => c.assignee?.kind === "member" && c.assignee.id === JULIA)).toBe(true);
    await montar();
    expect(screen.queryByText("Conversas atribuídas a você")).toBeNull();
  });
});
