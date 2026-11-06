// @vitest-environment jsdom
/**
 * 15-16 — Configurações não lê o CRM antigo (3.4.7, D-15-13).
 *
 * O Funil padrão do Espaço vem de `useFunis` (o que tem `padrao = true`), não
 * de um campo do Workspace. O estado é falso e traz de propósito
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
import CamposPage from "../../app/(shell)/configuracoes/campos/page";
import TagsPage from "../../app/(shell)/configuracoes/tags/page";
import CatalogosPage from "../../app/(shell)/configuracoes/catalogos/page";
import { resolveResource } from "./governance-access-dialog";

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

const FRASE_DO_CRM = "O uso no CRM não aparece aqui.";

/** O CRM antigo "sujo": Contatos, Empresas e Negócios que, se a tela os lesse, apareceriam nas contagens. */
function estadoComCrmAntigo(extra: Record<string, unknown>): DataState {
  const dados = {
    workspace: { locale: LOCALE },
    members: [{ id: "mem_a", displayName: "Maryane", state: "ativo", roleId: "role_prop" }],
    roles: [{ id: "role_prop", base: "proprietario", name: "Proprietário", system: true }],
    spaces: [],
    folders: [],
    lists: [{ id: "l1", name: "Contas a pagar", lifecycle: "ativo" }],
    tasks: [],
    catalog: [],
    tags: [],
    fieldDefinitions: [],
    grants: [],
    contacts: [
      { id: "c1", tagIds: ["tag1"], originId: "o1", qualificationId: "q1", consents: [{ purposeId: "fc1" }], fieldValues: [{ definitionId: "fd_contato", state: "ativo" }] },
      { id: "c2", tagIds: ["tag1"], originId: "o1", qualificationId: "q1", consents: [], fieldValues: [{ definitionId: "fd_contato", state: "ativo" }] },
    ],
    companies: [{ id: "e1", tagIds: ["tag1"], fieldValues: [] }],
    deals: [{ id: "d1", tagIds: ["tag1"], originId: "o1", lossReasonId: "mp1", winReasonId: "mg1", fieldValues: [] }],
    conversations: [],
    funnels: [],
    collections: [],
    ...extra,
  } as unknown as DataState;
  estado.atual = dados;
  return dados;
}

describe("Catálogos — sem contagem do CRM antigo (3.4.7)", () => {
  it("origem, qualificação, finalidade e motivos mostram a frase em vez de contar Contatos e Negócios", () => {
    estadoComCrmAntigo({
      catalog: [
        { id: "o1", kind: "origem", name: "Indicação", order: 0, lifecycle: "ativo" },
        { id: "q1", kind: "qualificacao", name: "Lead quente", order: 0, lifecycle: "ativo" },
        { id: "fc1", kind: "finalidadeConsentimento", name: "Novidades", order: 0, lifecycle: "ativo" },
        { id: "mp1", kind: "motivoPerda", name: "Preço", order: 0, lifecycle: "ativo" },
        { id: "mg1", kind: "motivoGanho", name: "Prazo", order: 0, lifecycle: "ativo" },
      ],
    });
    render(<CatalogosPage />);
    expect(screen.getAllByText(FRASE_DO_CRM)).toHaveLength(5);
    expect(screen.queryByText(/em nenhum Contato/)).toBeNull();
    expect(screen.queryByText(/Contato\(s\)/)).toBeNull();
    expect(screen.queryByText(/Negócio\(s\)/)).toBeNull();
  });
});

describe("Tags — o uso em Tarefas continua, o uso no CRM sai", () => {
  it("conta Tarefas e troca a contagem de Contatos, Empresas e Negócios pela frase", () => {
    estadoComCrmAntigo({
      tags: [{ id: "tag1", name: "Urgente", color: "#ff0000", lifecycle: "ativo" }],
      tasks: [{ id: "t1", tagIds: ["tag1"] }, { id: "t2", tagIds: ["tag1"] }],
    });
    render(<TagsPage />);
    expect(screen.getByText("2 Tarefas")).toBeTruthy();
    expect(screen.getByText(FRASE_DO_CRM)).toBeTruthy();
    expect(screen.queryByText(/Contatos/)).toBeNull();
    expect(screen.queryByText(/Negócios/)).toBeNull();
  });

  it("sem Tarefa com a Tag, a coluna mostra a frase e não afirma 'em nenhum registro'", () => {
    estadoComCrmAntigo({
      tags: [{ id: "tag1", name: "Urgente", color: "#ff0000", lifecycle: "ativo" }],
    });
    render(<TagsPage />);
    expect(screen.getByText(FRASE_DO_CRM)).toBeTruthy();
    expect(screen.queryByText("em nenhum registro")).toBeNull();
  });
});

describe("Campos — o preenchimento em Tarefas continua, o do CRM sai", () => {
  it("Campo de Tarefa conta registros; Campo de Contato mostra a frase", () => {
    estadoComCrmAntigo({
      lists: [{ id: "l1", name: "Contas a pagar", lifecycle: "ativo" }],
      tasks: [{ id: "t1", fieldValues: [{ definitionId: "fd_tarefa", state: "ativo" }] }],
      fieldDefinitions: [
        { id: "fd_tarefa", name: "Valor", type: "numero", target: "task", definedAtType: "list", definedAtId: "l1", required: false, lifecycle: "ativo" },
        { id: "fd_contato", name: "Porte", type: "texto", target: "contact", required: false, lifecycle: "ativo" },
      ],
    });
    render(<CamposPage />);
    expect(screen.getByText("1 registro(s)")).toBeTruthy();
    expect(screen.getAllByText(FRASE_DO_CRM)).toHaveLength(1);
    expect(screen.queryByText("2 registro(s)")).toBeNull();
  });
});

describe("Governança — Funil antigo não é Recurso", () => {
  it("procurar o id de um Funil não acha o recurso 'Funil'", () => {
    const dados = estadoComCrmAntigo({
      funnels: [{ id: "fnl_antigo", name: "Funil Antigo Fantasma", lifecycle: "ativo" }],
      collections: [{ id: "col1", name: "Coleção" }],
    });
    expect(resolveResource(dados, "fnl_antigo")).toBeNull();
  });

  it("Espaço, Pasta, Lista e Coleção continuam sendo Recurso", () => {
    const dados = estadoComCrmAntigo({
      spaces: [{ id: "spc1", name: "Gestão" }],
      folders: [{ id: "fld1", name: "Financeiro" }],
      collections: [{ id: "col1", name: "ERP" }],
    });
    expect(resolveResource(dados, "spc1")?.label).toBe("Espaço");
    expect(resolveResource(dados, "fld1")?.label).toBe("Pasta");
    expect(resolveResource(dados, "l1")?.label).toBe("Lista");
    expect(resolveResource(dados, "col1")?.label).toBe("Coleção");
  });
});
