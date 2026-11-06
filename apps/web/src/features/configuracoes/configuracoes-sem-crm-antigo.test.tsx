// @vitest-environment jsdom
/**
 * 15-16 — Configurações não lê o CRM antigo (3.4.7, D-15-13).
 *
 * O Funil padrão do Espaço vem de `useFunis` (o que tem `padrao = true`), não
 * de `workspace.defaultFunnelId`. O estado é falso e traz de propósito
 * Contatos, Negócios e Funis do modelo antigo: nenhum deles pode aparecer na
 * tela. A api é o hook mockado.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { DataState } from "@n1/dominio/state";

const { estado, funis, contatos } = vi.hoisted(() => ({
  estado: { atual: undefined as unknown },
  funis: { atual: { data: undefined } as { data: unknown; error?: unknown; isLoading?: boolean } },
  contatos: { atual: { data: undefined } as { data: unknown } },
}));

vi.mock("@/dados/store", async (original) => {
  const real = await original<typeof import("@/dados/store")>();
  return {
    ...real,
    useData: <T,>(seletor: (dados: DataState) => T): T => seletor(estado.atual as DataState),
    useRun: () => () => ({ ok: true }),
    useSession: () => ({ memberId: "mem_a", userId: undefined }),
  };
});

vi.mock("@/dados/crm/funis", () => ({
  useFunis: () => funis.atual,
}));

vi.mock("@/dados/crm/contatos", () => ({
  useContatos: () => contatos.atual,
}));

import ConfiguracoesPage from "../../app/(shell)/configuracoes/page";

const LOCALE = { timezone: "America/Sao_Paulo", currency: "BRL", language: "pt-BR" };

/** Um Espaço com CRM antigo "sujo": se a tela o lesse, o nome do Funil antigo apareceria. */
function definirEstado(): DataState {
  const dados = {
    workspace: {
      id: "ws",
      name: "N1 Digital",
      state: "ativo",
      ownerMemberId: "mem_a",
      createdAt: "2026-09-16T12:00:00.000Z",
      locale: LOCALE,
      trashPolicy: { retentionDays: 30 },
      maxSubtaskDepth: 3,
      taskReadableId: { enabled: true, prefix: "N1", next: 1 },
      dealReadableId: { enabled: true, prefix: "NEG", next: 1 },
      limits: {
        members: 25,
        spaces: 10,
        contacts: 5000,
        agents: 10,
        tasksPerList: 500,
        subtaskDepthCeiling: 5,
        executionChainDepth: 5,
        agentToAgentDepth: 3,
        operationsPerExecution: 50,
        approvalTimeoutHoursCeiling: 168,
        widgetsPerPanel: 20,
      },
      defaultAgentId: "agt_padrao",
      suspensions: [],
    },
    members: [{ id: "mem_a", displayName: "Maryane", state: "ativo" }],
    spaces: [],
    agents: [{ id: "agt_padrao", name: "Assistente padrão", lifecycle: "ativo" }],
    // O que o CRM antigo guardava: não pode aparecer.
    funnels: [{ id: "fnl_antigo", name: "Funil Antigo Fantasma", lifecycle: "ativo" }],
    contacts: [{ id: "c1", lifecycle: "ativo" }],
    deals: [],
  } as unknown as DataState;
  estado.atual = dados;
  return dados;
}

function funil(id: string, nome: string, padrao: boolean) {
  return { funil: { id, nome, padrao, estado: "ativo", privado: false }, totalEtapas: 1, negociosAbertos: 0 };
}

afterEach(() => {
  cleanup();
  funis.atual = { data: undefined };
  contatos.atual = { data: undefined };
});

describe("Configurações — Funil padrão (D-15-13)", () => {
  it("sem Funil na tabela, orienta a criar o primeiro e leva a /crm/funis", () => {
    definirEstado();
    funis.atual = { data: { ok: true, itens: [], total: 0 } };
    render(<ConfiguracoesPage />);
    expect(screen.getByText("Crie seu primeiro Funil")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Crie seu primeiro Funil" });
    expect(link.getAttribute("href")).toBe("/crm/funis");
    expect(screen.queryByText("Funil Antigo Fantasma")).toBeNull();
  });

  it("com Funil padrão, mostra o nome do que tem padrao = true", () => {
    definirEstado();
    funis.atual = { data: { ok: true, itens: [funil("f1", "Vendas", false), funil("f2", "Comercial B2B", true)], total: 2 } };
    render(<ConfiguracoesPage />);
    expect(screen.getByText("Comercial B2B")).toBeTruthy();
    expect(screen.queryByText("Vendas")).toBeNull();
    expect(screen.queryByText("Crie seu primeiro Funil")).toBeNull();
    expect(screen.queryByText("Funil Antigo Fantasma")).toBeNull();
  });

  it("enquanto a lista não chegou, não afirma que não há Funil", () => {
    definirEstado();
    funis.atual = { data: undefined };
    render(<ConfiguracoesPage />);
    expect(screen.queryByText("Crie seu primeiro Funil")).toBeNull();
    expect(screen.queryByText("Funil Antigo Fantasma")).toBeNull();
  });

  it("o limite de Contatos conta os da tabela (total da api), não os do CRM antigo", () => {
    definirEstado();
    funis.atual = { data: { ok: true, itens: [], total: 0 } };
    contatos.atual = { data: { ok: true, itens: [], total: 7 } };
    render(<ConfiguracoesPage />);
    expect(screen.getByText(/7 de 5\.000/)).toBeTruthy();
    expect(screen.queryByText(/1 de 5\.000/)).toBeNull();
  });
});
