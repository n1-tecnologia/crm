// @vitest-environment jsdom
/**
 * Fase 15, 3.4.9 (UCR-08) — a IA escolhe e mostra registros do CRM novo, não do store.
 *
 * O traçador (15-21, Task 1): a Âncora do Chat. O `state.deals`, `state.contacts` e
 * `state.conversations` do seed ficam VAZIOS aqui, então tudo o que a tela mostra vem da api
 * falsa (`fetch` falso): a lista de Negócios para escolher e `POST /crm/nomes` para o nome. A
 * operação sai com `nomes` do navegador (o servidor o descarta e relê, 15-08).
 */

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { configureChatSession, createChatSession } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider, useRun } from "@/dados/store";
import type { PedidoDeGravacao, RespostaDeGravacao, Transporte } from "@/dados/transporte";
import {
  NOME_INDISPONIVEL,
  ancoraDaEscolha,
  nomesDaEscolha,
  useDialogoDeAncora,
  useNomeDaEscolha,
  type EscolhaDeAncora,
} from "./ancora-do-chat";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));
vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

const NEGOCIO = "22222222-2222-4222-8222-222222222222";

let state: DataState;
let gravados: PedidoDeGravacao[];
let fetchMock: ReturnType<typeof vi.fn>;
/** O que a api falsa responde a `POST /crm/nomes`: `undefined` = sem nome (`null`). */
let nomesDaApi: Record<string, string | undefined>;

function resposta(corpo: unknown): Response {
  return { ok: true, status: 200, json: async () => corpo } as Response;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state = buildSeed();
  state.deals = [];
  state.contacts = [];
  state.conversations = [];
  gravados = [];
  nomesDaApi = { [NEGOCIO]: "Proposta Acme" };
  fetchMock = vi.fn(async (url: string, init?: { body?: string }) => {
    const caminho = String(url).replace("http://api", "");
    if (caminho.startsWith("/crm/nomes")) {
      const { alvos } = JSON.parse(init?.body ?? "{}") as { alvos: Array<{ tipo: string; id: string }> };
      const itens = alvos.map((a) => ({ ...a, nome: nomesDaApi[a.id] ?? null }));
      return resposta({ ok: true, itens, total: itens.length });
    }
    if (caminho.startsWith("/negocios")) {
      const itens = [{ id: NEGOCIO, titulo: "Proposta Acme" }];
      return resposta({ ok: true, itens, total: itens.length });
    }
    if (caminho.startsWith("/contatos") || caminho.startsWith("/conversas")) return resposta({ ok: true, itens: [], total: 0 });
    return { ok: false, status: 404, json: async () => ({ ok: false, error: "não é desta api falsa" }) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function transporte(): Transporte {
  return {
    gravar: vi.fn(async (pedido): Promise<RespostaDeGravacao> => {
      gravados.push(pedido);
      return { tipo: "estado", resultado: pedido.resultado, estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: {}, memberId: "" } };
    }),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
}

function Tela({ children }: { readonly children: ReactNode }) {
  const membro = state.members.find((m) => m.state === "ativo");
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      <StoreProvider sessao={{ memberId: membro?.id ?? "" }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte()}>
        {children}
      </StoreProvider>
    </SWRConfig>
  );
}

async function montar(filho: ReactNode) {
  await act(async () => {
    render(<Tela>{filho}</Tela>);
  });
}

function Chip({ escolha }: { readonly escolha: EscolhaDeAncora }) {
  const nome = useNomeDaEscolha(escolha);
  return <span data-testid="chip">{nome}</span>;
}

function Dialogo({ aoEscolher }: { readonly aoEscolher: (e: EscolhaDeAncora) => void }) {
  const { dialogo, abrir } = useDialogoDeAncora(aoEscolher);
  return (
    <>
      <button type="button" onClick={() => abrir()}>
        Abrir a Âncora
      </button>
      {dialogo}
    </>
  );
}

/** A tela da home do Chat, no que importa aqui: a Âncora escolhida vira o pedido de `createChatSession`. */
function Ancorar({ escolha, sessao }: { readonly escolha: EscolhaDeAncora; readonly sessao?: string }) {
  const run = useRun();
  return (
    <button
      type="button"
      onClick={() =>
        run((data, me) =>
          sessao
            ? configureChatSession(data, me, sessao, { anchor: ancoraDaEscolha(escolha) }, nomesDaEscolha(escolha))
            : createChatSession(data, me, { title: "Proposta Acme", anchor: ancoraDaEscolha(escolha) }, nomesDaEscolha(escolha)),
        )
      }
    >
      Ancorar
    </button>
  );
}

describe("Âncora do Chat no CRM novo (15-21, traçador)", () => {
  it("(a) a Âncora num Negócio novo mostra o título que POST /crm/nomes devolveu", async () => {
    await montar(<Chip escolha={{ type: "deal", id: NEGOCIO }} />);
    await waitFor(() => expect(screen.getByTestId("chip").textContent).toBe("Proposta Acme"));
    const nomes = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/crm/nomes"));
    expect(JSON.parse((nomes?.[1] as { body: string }).body)).toEqual({ alvos: [{ tipo: "deal", id: NEGOCIO }] });
  });

  it("(b) borda UCR-08: a api respondeu sem nome (sem permissão ou de outro Espaço) → \"Registro indisponível\"", async () => {
    nomesDaApi = {};
    await montar(<Chip escolha={{ type: "deal", id: NEGOCIO }} />);
    await waitFor(() => expect(screen.getByTestId("chip").textContent).toBe(NOME_INDISPONIVEL));
    expect(NOME_INDISPONIVEL).toBe("Registro indisponível");
  });

  it("(c) a Âncora numa Tarefa continua do store (só o CRM mudou de lugar)", async () => {
    const tarefa = state.tasks.find((t) => t.lifecycle === "ativo");
    expect(tarefa).toBeDefined();
    await montar(<Chip escolha={{ type: "task", id: tarefa?.id ?? "" }} />);
    expect(screen.getByTestId("chip").textContent).toBe(tarefa?.title);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/crm/nomes"))).toBe(false);
  });

  it("(d) o diálogo lista os Negócios da api (o store está vazio), busca por q e entrega o nome escolhido", async () => {
    const aoEscolher = vi.fn();
    await montar(<Dialogo aoEscolher={aoEscolher} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir a Âncora" }));
    fireEvent.click(screen.getByLabelText("Ancorar em"));
    fireEvent.click(screen.getByRole("option", { name: "Negócio" }));

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Buscar registro"), { target: { value: "acme" } });
    });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => /\/negocios\?.*q=acme/.test(String(url)))).toBe(true));

    fireEvent.click(screen.getByLabelText("Registro"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Proposta Acme" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Proposta Acme" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar esta Âncora" }));

    expect(aoEscolher).toHaveBeenCalledWith({ type: "deal", id: NEGOCIO, nome: "Proposta Acme" });
  });

  it("(e) criar a Sessão ancorada manda `nomes` do navegador e a Âncora sem o nome", async () => {
    await montar(<Ancorar escolha={{ type: "deal", id: NEGOCIO, nome: "Proposta Acme" }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ancorar" }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("createChatSession");
    expect(chamada?.args[0]).toEqual({ title: "Proposta Acme", anchor: { type: "deal", id: NEGOCIO } });
    expect(chamada?.args[1]).toEqual({ [NEGOCIO]: "Proposta Acme" });
    const criada = gravados[0]?.copia.chatSessions.at(-1);
    expect(criada?.anchor?.nameAtTheTime).toBe("Proposta Acme");
  });

  it("(f) trocar a Âncora de uma Sessão sem Mensagens chama configureChatSession com o id novo e `nomes`", async () => {
    const membro = state.members.find((m) => m.state === "ativo");
    const aberta = createChatSession(state, membro?.id ?? "", { title: "Sessão vazia" });
    expect(aberta.ok).toBe(true);
    const sessao = aberta.ok ? aberta.value.id : "";
    await montar(<Ancorar sessao={sessao} escolha={{ type: "deal", id: NEGOCIO, nome: "Proposta Acme" }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ancorar" }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("configureChatSession");
    expect(chamada?.args).toEqual([sessao, { anchor: { type: "deal", id: NEGOCIO } }, { [NEGOCIO]: "Proposta Acme" }]);
  });

  it("(g) uma Âncora do store (Tarefa) não leva `nomes`", () => {
    expect(nomesDaEscolha({ type: "task", id: "tsk_1", nome: "Qualquer" })).toEqual({});
    expect(ancoraDaEscolha({ type: "deal", id: NEGOCIO, nome: "x" })).toEqual({ type: "deal", id: NEGOCIO });
  });
});
