// @vitest-environment jsdom
/**
 * 14-15 Task 3 — a ficha da Tarefa conversacional MOSTRA Contato, Canal, Conversa
 * e Negócio pelo resumo da api (`useResumoDaTarefa`), não pelo estado em memória.
 * A Tarefa do seed (`tsk_lst_funil_sdr_deal_sdr_2`) tem Vínculos para ids do modelo
 * antigo (`cnt_35`, `deal_sdr_2`); o resumo mockado traz OUTROS nomes e ids, e é o
 * que tem de aparecer. Sem Contato no resumo, o aviso de "sem Contato" aparece
 * sem voltar à leitura antiga (D-01). Molde de `tarefa-salvando.test.tsx`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { PAPEL_DO_VINCULO } from "@n1/dominio/derive-conversacional";
import type { ResumoDaTarefaConversacional } from "@n1/dominio/crm/resumo-da-tarefa";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { TarefaCompleta } from "@/features/estrutura/tarefa-completa";

const { resumo } = vi.hoisted(() => ({ resumo: { atual: undefined as unknown } }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/estrutura/tarefas/x",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/dados/crm/tarefas-conversacionais", () => ({
  useResumoDaTarefa: () => resumo.atual,
  // 14-16: os gestos da ficha também vêm deste módulo; aqui só a leitura é o assunto.
  useConversaAbertaDoPar: () => ({ conversa: undefined }),
  trocarCanalDaTarefa: vi.fn(),
  vincularNegocioATarefa: vi.fn(),
  criarNegocioDaTarefa: vi.fn(),
}));

// ...e as listas que os gestos oferecem (Canais, Negócios, Funis, Contato) vêm da api: nenhuma rede aqui.
vi.mock("@/dados/crm/contatos", () => ({ useContato: () => ({ data: undefined }) }));
vi.mock("@/dados/crm/canais", () => ({ useCanais: () => ({ data: undefined }) }));
vi.mock("@/dados/crm/negocios", () => ({ useNegocios: () => ({ data: undefined }) }));
vi.mock("@/dados/crm/funis", () => ({ useFunis: () => ({ data: undefined }) }));

const TAREFA = "tsk_lst_funil_sdr_deal_sdr_2";

const RESUMO: ResumoDaTarefaConversacional = {
  taskId: TAREFA,
  contato: { id: "ct_novo_77", nome: "Helena Prado do Resumo" },
  canal: { id: "ck_novo_1", nome: "Atendimento do Resumo", tipo: "whatsapp", provedor: "whatsapp-nao-oficial", conexao: "conectada" },
  ultimaMensagem: null,
  negocio: { id: "ng_novo_5", titulo: "Proposta do Resumo", etapa: "Etapa do Resumo" },
};

let state: DataState;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state = buildSeed();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar(): void {
  const transporte: Transporte = {
    gravar: vi.fn(),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  render(
    <StoreProvider sessao={{ memberId: state.workspace.ownerMemberId }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
      <TarefaCompleta taskId={TAREFA} modo="popup" />
    </StoreProvider>,
  );
}

describe("a ficha da Tarefa conversacional lê o resumo da api", () => {
  it("(a) mostra o Contato, o Canal (com o selo do provedor) e o Negócio do resumo, com os links dos ids novos", () => {
    resumo.atual = RESUMO;
    montar();
    expect(screen.getByText("Helena Prado do Resumo")).toBeTruthy();
    expect(screen.getByText("Atendimento do Resumo")).toBeTruthy();
    expect(screen.getByText("não oficial")).toBeTruthy();
    expect(screen.getByText("Proposta do Resumo")).toBeTruthy();
    expect(screen.getByText("Etapa do Resumo")).toBeTruthy();
    expect(screen.getByText("Helena Prado do Resumo").closest("a")?.getAttribute("href")).toBe("/crm/contatos/ct_novo_77");
    expect(screen.getByText("Proposta do Resumo").closest("a")?.getAttribute("href")).toBe("/crm/negocios/ng_novo_5");
    expect(screen.queryByText(/Tarefa conversacional sem Contato/)).toBeNull();
  });

  it("(b) o link da Conversa usa o id do Vínculo, sem ler a Conversa do estado", () => {
    // Um Vínculo para um id que NÃO existe em `state.conversations`: a ficha só segue o id.
    state.links.push({
      id: "lk_conversa_nova",
      fromType: "task",
      fromId: TAREFA,
      toType: "conversation",
      toId: "cv_nova_9",
      role: PAPEL_DO_VINCULO.conversa,
      createdBy: { kind: "member", id: state.workspace.ownerMemberId },
      createdAt: "2026-11-04T12:00:00.000Z",
    });
    resumo.atual = RESUMO;
    montar();
    const link = screen.getAllByText("Abrir na Caixa de Entrada").map((el) => el.closest("a")).find((a) => a !== null);
    expect(link?.getAttribute("href")).toBe("/crm/caixa-de-entrada/cv_nova_9");
  });

  it("(c) sem Contato no resumo, o aviso aparece e nada do Contato do seed é mostrado (D-01)", () => {
    resumo.atual = { taskId: TAREFA, contato: null, canal: null, ultimaMensagem: null, negocio: null } satisfies ResumoDaTarefaConversacional;
    montar();
    expect(screen.getByText(/Tarefa conversacional sem Contato/)).toBeTruthy();
    expect(screen.queryByText("CRM")).toBeNull();
  });

  it("(d) sem resumo ainda, não há aviso nem seção: espera a resposta", () => {
    resumo.atual = undefined;
    montar();
    expect(screen.queryByText(/Tarefa conversacional sem Contato/)).toBeNull();
    expect(screen.queryByText("CRM")).toBeNull();
  });
});
