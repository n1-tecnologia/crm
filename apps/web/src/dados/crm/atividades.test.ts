// @vitest-environment jsdom
/**
 * 15-37 — a linha do tempo de um objeto junta as duas fontes (D-15-09): a
 * Atividade antiga, que já veio hidratada em `state.activity`, e a nova, lida de
 * `GET /atividades`. Nenhuma rede: `fetch` falso, sessão falsa, `StoreProvider`
 * de verdade com o seed.
 */

import type { ComponentProps, ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { ActivityRecord } from "@n1/dominio/types/primitives";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

import { chaveDeAtividades, useAtividades, useAtividadesDoCrm } from "./atividades";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

function atividade(id: string, objectId: string, at: string, extra: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id,
    workspaceId: "ws_demo",
    actor: { kind: "member", id: "mem_julia" },
    action: "Algo aconteceu",
    objectType: "contact",
    objectId,
    objectName: "Ana",
    at,
    result: "ok",
    ...extra,
  };
}

/** O Espaço hidratado com as Atividades antigas dadas; a sessão é a de um Membro do seed. */
function comEstado(antigas: ActivityRecord[]) {
  const data = { ...buildSeed(), activity: antigas };
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const props = { sessao: { memberId: "mem_julia" }, estadoInicial: { data, revisao: 1, ordens: {} }, transporte } as ComponentProps<typeof StoreProvider>;
  return function Envoltorio({ children }: { readonly children: ReactNode }) {
    return createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      createElement(StoreProvider, props, children),
    );
  };
}

describe("chaveDeAtividades — a chave de SWR", () => {
  it("(a) começa por /atividades e monta a consulta na ordem objeto, limite, cursor", () => {
    expect(chaveDeAtividades({ objetoTipo: "contact", objetoId: "c1" })).toBe("/atividades?objetoTipo=contact&objetoId=c1&limite=50");
    expect(chaveDeAtividades({ limite: 20, ate: "2026-11-05T10:00:00.000Z" })).toBe(
      "/atividades?limite=20&ate=2026-11-05T10%3A00%3A00.000Z",
    );
    expect(chaveDeAtividades({})).toBe("/atividades?limite=50");
  });
});

describe("useAtividades — as duas fontes, juntas", () => {
  it("(b) devolve a antiga e a nova do mesmo objeto, a nova primeiro; a de outro objeto não entra", async () => {
    const antigaDeX = atividade("act_antiga", "X", "2026-11-01T10:00:00.000Z", { action: "Contato editado" });
    const antigaDeOutro = atividade("act_outro", "Y", "2026-11-03T10:00:00.000Z");
    const nova = atividade("11111111-1111-4111-8111-111111111111", "X", "2026-11-05T10:00:00.000Z", { action: "Nota registrada no Contato" });
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [nova] }));

    const { result } = renderHook(() => useAtividades({ tipo: "contact", id: "X" }), { wrapper: comEstado([antigaDeX, antigaDeOutro]) });

    await waitFor(() => expect(result.current.atividades.map((a) => a.id)).toEqual([nova.id, "act_antiga"]));
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://api/atividades?objetoTipo=contact&objetoId=X&limite=50");
  });

  it("(c) enquanto a rota não responde, a antiga já aparece; o mesmo id nas duas fontes não se repete", async () => {
    const antiga = atividade("act_1", "X", "2026-11-01T10:00:00.000Z");
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [antiga, atividade("act_2", "X", "2026-11-02T10:00:00.000Z")] }));

    const { result } = renderHook(() => useAtividades({ tipo: "contact", id: "X" }), { wrapper: comEstado([antiga]) });

    expect(result.current.atividades.map((a) => a.id)).toEqual(["act_1"]);
    await waitFor(() => expect(result.current.atividades.map((a) => a.id)).toEqual(["act_2", "act_1"]));
  });

  it("(d) a Atividade antiga de outro tipo de objeto com o mesmo id não entra", async () => {
    const dealComMesmoId = atividade("act_deal", "X", "2026-11-04T10:00:00.000Z", { objectType: "deal" });
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [] }));

    const { result } = renderHook(() => useAtividades({ tipo: "contact", id: "X" }), { wrapper: comEstado([dealComMesmoId]) });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.atividades).toEqual([]);
  });
});

describe("useAtividadesDoCrm — a lista sem objeto", () => {
  it("(e) lê /atividades pelo cursor e devolve a resposta da rota", async () => {
    const nova = atividade("11111111-1111-4111-8111-111111111111", "X", "2026-11-05T10:00:00.000Z");
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [nova] }));

    const { result } = renderHook(() => useAtividadesDoCrm({ limite: 20, ate: "2026-11-06T00:00:00.000Z" }), { wrapper: comEstado([]) });

    await waitFor(() => expect(result.current.data).toEqual({ ok: true, itens: [nova] }));
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://api/atividades?limite=20&ate=2026-11-06T00%3A00%3A00.000Z");
  });
});
