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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { montarTarefaConversacional } from "./tarefa-conversacional-de-teste";
import { PAPEL_DO_VINCULO } from "@n1/dominio/derive-conversacional";
import type { ResumoDaTarefaConversacional } from "@n1/dominio/crm/resumo-da-tarefa";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { TarefaCompleta } from "@/features/estrutura/tarefa-completa";

const { resumo, funis } = vi.hoisted(() => ({
  resumo: { atual: undefined as unknown },
  funis: { atual: undefined as unknown },
}));

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
vi.mock("@/dados/crm/funis", () => ({ useFunis: () => ({ data: funis.atual }) }));

const TAREFA = "tsk_lst_funil_sdr_deal_sdr_2";

const RESUMO: ResumoDaTarefaConversacional = {
  taskId: TAREFA,
  contato: { id: "ct_novo_77", nome: "Helena Prado do Resumo" },
  canal: { id: "ck_novo_1", nome: "Atendimento do Resumo", tipo: "whatsapp", provedor: "whatsapp-nao-oficial", conexao: "conectada" },
  ultimaMensagem: null,
  negocio: { id: "ng_novo_5", titulo: "Proposta do Resumo", etapa: "Etapa do Resumo" },
  empresa: null,
  qualificacaoId: null,
  conversa: null,
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
  // O seed não cria mais a Pasta Meus negócios nem as Tarefas-espelho (15-31): a ficha lê a Tarefa conversacional montada aqui.
  montarTarefaConversacional(state);
  funis.atual = undefined;
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
    resumo.atual = { taskId: TAREFA, contato: null, canal: null, ultimaMensagem: null, negocio: null, empresa: null, qualificacaoId: null, conversa: null } satisfies ResumoDaTarefaConversacional;
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

describe("a ficha mostra Empresa, qualificação, estado e Atribuído do resumo (D-15-05)", () => {
  const CONVERSA = { situacao: "pendente", estado: "ativo", atribuido: null } as const;

  it("(e) Empresa e qualificação (rótulo do Catálogo) no bloco do Contato; a Empresa leva à ficha dela", () => {
    state.catalog.push({ id: "cat_qual_resumo", workspaceId: state.workspace.id, kind: "qualificacao", name: "Qualificação do Resumo", order: 99, lifecycle: "ativo" });
    resumo.atual = { ...RESUMO, empresa: { id: "emp_77", nome: "Acme do Resumo" }, qualificacaoId: "cat_qual_resumo" };
    montar();
    expect(screen.getByText("Acme do Resumo").closest("a")?.getAttribute("href")).toBe("/crm/empresas/emp_77");
    expect(screen.getByText("Qualificação do Resumo")).toBeTruthy();
  });

  it("(f) qualificação com id que o Catálogo não tem: a linha não inventa rótulo", () => {
    resumo.atual = { ...RESUMO, qualificacaoId: "cat_que_nao_existe" };
    montar();
    expect(screen.queryByText("cat_que_nao_existe")).toBeNull();
  });

  it("(g) estado da Conversa (Aberta, Pendente ou Resolvida) e o Atribuído Membro pelo nome de exibição", () => {
    const dono = state.members.find((m) => m.id === state.workspace.ownerMemberId)!;
    resumo.atual = { ...RESUMO, conversa: { ...CONVERSA, atribuido: { tipo: "membro", id: dono.id } } };
    montar();
    expect(screen.getByText("Pendente")).toBeTruthy();
    expect(screen.getAllByText(dono.displayName).length).toBeGreaterThan(0);
    expect(screen.queryByText("Sem Atribuído")).toBeNull();
  });

  it("(h) Atribuído Agente pelo nome do Agente; sem Atribuído, \"Sem Atribuído\"", () => {
    state.agents.push({ id: "ag_resumo", name: "Agente do Resumo" } as unknown as DataState["agents"][number]);
    resumo.atual = { ...RESUMO, conversa: { ...CONVERSA, atribuido: { tipo: "agente", id: "ag_resumo" } } };
    montar();
    expect(screen.getByText("Agente do Resumo")).toBeTruthy();
    cleanup();

    resumo.atual = { ...RESUMO, conversa: { ...CONVERSA, atribuido: null } };
    montar();
    expect(screen.getByText("Sem Atribuído")).toBeTruthy();
  });

  it("(i) D-15-06: a temperatura do Contato não aparece na ficha", () => {
    resumo.atual = { ...RESUMO, empresa: { id: "emp_77", nome: "Acme do Resumo" }, conversa: CONVERSA };
    montar();
    expect(screen.queryByText(/temperatura/i)).toBeNull();
  });
});

describe("criar Negócio num Espaço sem Funil (D-15-13)", () => {
  function abrirOMenuECriar(): void {
    fireEvent.click(screen.getAllByRole("button", { name: "Ações" })[0] as HTMLElement);
    fireEvent.click(screen.getByRole("menuitem", { name: "Criar Negócio a partir desta Tarefa" }));
  }

  it("(j) sem Funil, o diálogo diz \"Crie seu primeiro Funil\" com o link para /crm/funis e não deixa confirmar", () => {
    resumo.atual = { ...RESUMO, negocio: null };
    funis.atual = { ok: true, total: 0, itens: [] };
    montar();
    abrirOMenuECriar();
    expect(screen.getByRole("link", { name: /Crie seu primeiro Funil/ }).getAttribute("href")).toBe("/crm/funis");
    const confirmar = screen.getByRole("button", { name: "Criar Negócio" }) as HTMLButtonElement;
    expect(confirmar.disabled || confirmar.getAttribute("aria-disabled") === "true").toBe(true);
    expect(screen.queryByRole("combobox", { name: /Funil/ })).toBeNull();
  });

  it("(k) com Funil, o seletor continua (nada mudou para quem tem Funil)", () => {
    resumo.atual = { ...RESUMO, negocio: null };
    funis.atual = { ok: true, total: 1, itens: [{ funil: { id: "fn_1", nome: "Funil de Vendas" }, totalEtapas: 3, negociosAbertos: 0 }] };
    montar();
    abrirOMenuECriar();
    expect(screen.queryByText(/Crie seu primeiro Funil/)).toBeNull();
    expect(screen.getByRole("combobox", { name: /Funil/ })).toBeTruthy();
  });
});
