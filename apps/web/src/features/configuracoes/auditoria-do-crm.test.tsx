// @vitest-environment jsdom
/**
 * 15-09 — a Auditoria mostra as duas fontes (D-15-09, UCR-03): o `state.activity` do
 * modelo antigo e a linha do tempo do CRM novo (`useAtividadesDoCrm`, cursor composto
 * `ate` + `ateId`), misturadas por data. O hook é falso e o estado traz de propósito
 * uma Atividade antiga; nada de rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { DataState } from "@n1/dominio/state";
import type { ActivityRecord } from "@n1/dominio/types/primitives";

const { estado, crm } = vi.hoisted(() => ({
  estado: { atual: undefined as unknown },
  crm: { usar: undefined as unknown as (filtro: Record<string, unknown>) => { data?: unknown; error?: unknown; isLoading?: boolean } },
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const chamadasDoHook: Array<Record<string, unknown>> = [];

vi.mock("@/dados/crm/atividades", () => ({
  useAtividadesDoCrm: (filtro: Record<string, unknown>) => {
    chamadasDoHook.push(filtro);
    return crm.usar(filtro);
  },
}));

import AuditoriaPage from "../../app/(shell)/configuracoes/auditoria/page";

const LOCALE = { timezone: "America/Sao_Paulo", currency: "BRL", language: "pt-BR" };

function atividade(id: string, at: string, extra: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id,
    workspaceId: "ws",
    actor: { kind: "member", id: "mem_a" },
    action: "Algo aconteceu",
    objectType: "contact",
    objectId: "obj",
    objectName: "Objeto",
    at,
    result: "ok",
    ...extra,
  };
}

function definirEstado(antigas: ActivityRecord[]): void {
  estado.atual = {
    workspace: { id: "ws", name: "N1 Digital", locale: LOCALE },
    members: [{ id: "mem_a", displayName: "Maryane", state: "ativo" }],
    agents: [],
    automations: [],
    activity: antigas,
  } as unknown as DataState;
}

const ANTIGA = atividade("act_0001", "2026-11-01T10:00:00.000Z", { action: "Contato editado", objectName: "Ana Antiga" });
const NOVA = atividade("11111111-1111-4111-8111-111111111111", "2026-11-05T10:00:00.000Z", {
  action: "Conversa movida para outro Contato",
  objectType: "conversation",
  objectId: "cv1",
  objectName: "Conversa da Bia",
  before: "Ana",
  after: "Bia",
});

/** O texto da primeira célula de ação de cada linha do corpo da tabela. */
function acoes(): string[] {
  const linhas = screen.getAllByRole("row").slice(1);
  return linhas.map((linha) => within(linha).getAllByRole("cell")[2]!.textContent ?? "");
}

beforeEach(() => {
  chamadasDoHook.length = 0;
  crm.usar = () => ({ data: { ok: true, itens: [NOVA] } });
});

afterEach(() => {
  cleanup();
});

describe("Auditoria — as duas fontes (D-15-09)", () => {
  it("(a) lista a Atividade antiga e a do CRM novo, a mais recente primeiro, e conta as duas", () => {
    definirEstado([ANTIGA]);
    render(<AuditoriaPage />);

    expect(acoes()).toEqual(["Conversa movida para outro Contato", "Contato editado"]);
    expect(screen.getByText("2 Registro(s) de Atividade")).toBeTruthy();
    expect(screen.getByText("Bia", { exact: false })).toBeTruthy();
    // A primeira consulta da fonte nova é a primeira página, sem cursor.
    expect(chamadasDoHook[0]).toEqual({ limite: 50 });
  });

  it("(b) o filtro de tipo de objeto mostra só a Conversa, e o tipo vem da fonte nova", () => {
    definirEstado([ANTIGA]);
    render(<AuditoriaPage />);

    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de objeto" }));
    fireEvent.click(screen.getByRole("option", { name: "Conversa" }));

    expect(acoes()).toEqual(["Conversa movida para outro Contato"]);
  });

  it("(c) a busca e o ator valem para as duas fontes", () => {
    definirEstado([ANTIGA]);
    render(<AuditoriaPage />);

    fireEvent.change(screen.getByPlaceholderText("Buscar na ação ou no objeto"), { target: { value: "ana antiga" } });
    expect(acoes()).toEqual(["Contato editado"]);

    fireEvent.change(screen.getByPlaceholderText("Buscar na ação ou no objeto"), { target: { value: "bia" } });
    expect(acoes()).toEqual(["Conversa movida para outro Contato"]);
  });

  it("(d) página cheia da fonte nova: 'Mostrar mais' avança o cursor composto (ate + ateId) da última linha", () => {
    definirEstado([]);
    const pagina1 = Array.from({ length: 50 }, (_, i) =>
      atividade(`aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`, `2026-11-05T10:00:${String(59 - i).padStart(2, "0")}.000Z`, {
        action: `Gesto ${i}`,
        objectType: "conversation",
      }),
    );
    const pagina2 = [atividade("bbbbbbbb-0000-4000-8000-000000000001", "2026-11-04T09:00:00.000Z", { action: "Gesto antigo", objectType: "conversation" })];
    crm.usar = (filtro) => ({ data: { ok: true, itens: filtro.ate === undefined ? pagina1 : pagina2 } });

    render(<AuditoriaPage />);
    expect(acoes()).toHaveLength(50);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar mais" }));

    const ultima = pagina1[49]!;
    expect(chamadasDoHook.at(-1)).toEqual({ limite: 50, ate: ultima.at, ateId: ultima.id });
    // A página nova soma à já carregada, sem repetir.
    expect(acoes()).toHaveLength(51);
    expect(acoes().at(-1)).toBe("Gesto antigo");
    // A segunda página veio curta: acabou, sem botão.
    expect(screen.queryByRole("button", { name: "Mostrar mais" })).toBeNull();
  });

  it("(e) a fonte nova falhou: a antiga continua à mostra e a tela avisa", () => {
    definirEstado([ANTIGA]);
    crm.usar = () => ({ data: undefined, error: new Error("falhou") });
    render(<AuditoriaPage />);

    expect(acoes()).toEqual(["Contato editado"]);
    expect(screen.getByText(/CRM novo não carregou/)).toBeTruthy();
  });
});
