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
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { configureChatSession, createChatSession } from "@n1/dominio/operations";
import { versaoCorrenteDoAgente } from "@n1/dominio/derive-ia";
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
import { EnsaiarDialog } from "./agentes/ensaiar-dialog";
import { useConversasDoAgente } from "./agentes/conversas-do-agente";
import { specDaAcao } from "./automacoes/automacao-spec";
import { BlocoForm } from "./automacoes/bloco-form";
import { inoperanteComFunis, useFunisDoEscopo } from "./automacoes/funis-do-escopo";
import { NovaAutomacaoDialog } from "./automacoes/nova-automacao-dialog";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));
vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ia/agentes",
  useSearchParams: () => new URLSearchParams(),
}));

const NEGOCIO = "22222222-2222-4222-8222-222222222222";
const CONTATO = "33333333-3333-4333-8333-333333333333";
const FUNIL = "44444444-4444-4444-8444-444444444444";
const CANAL = "55555555-5555-4555-8555-555555555555";

let state: DataState;
let gravados: PedidoDeGravacao[];
let fetchMock: ReturnType<typeof vi.fn>;
/** O que a api falsa responde a `POST /crm/nomes`: `undefined` = sem nome (`null`). */
let nomesDaApi: Record<string, string | undefined>;
/** Os Funis que a api falsa devolve por estado, os Canais e o total de Conversas atribuídas. */
let funisDaApi: Record<string, Array<{ id: string; nome: string; estado: string }>>;
let canaisDaApi: Array<{ id: string; nome: string; conexao: string; estado: string }>;
let totalDeConversas: number;

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
  nomesDaApi = { [NEGOCIO]: "Proposta Acme", [CONTATO]: "Ana Lima" };
  funisDaApi = { ativo: [{ id: FUNIL, nome: "Funil de Vendas", estado: "ativo" }], arquivado: [] };
  canaisDaApi = [{ id: CANAL, nome: "WhatsApp Vendas", conexao: "conectada", estado: "ativo" }];
  totalDeConversas = 0;
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
    if (caminho.startsWith("/funis")) {
      const estado = new URL(`http://x${caminho}`).searchParams.get("estado") ?? "ativo";
      const itens = (funisDaApi[estado] ?? []).map((funil) => ({ funil, totalEtapas: 0, negociosAbertos: 0 }));
      return resposta({ ok: true, itens, total: itens.length });
    }
    if (caminho.startsWith("/canais")) return resposta({ ok: true, itens: canaisDaApi, total: canaisDaApi.length });
    if (caminho.startsWith("/contatos")) {
      const q = new URL(`http://x${caminho}`).searchParams.get("q") ?? "";
      const itens = q === "" || "ana lima".includes(q.toLowerCase()) ? [{ id: CONTATO, nomeDeExibicao: "Ana Lima" }] : [];
      return resposta({ ok: true, itens, total: itens.length });
    }
    if (caminho.startsWith("/conversas")) return resposta({ ok: true, itens: [], total: totalDeConversas });
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

// ── Task 2: Agentes (ensaio, Conversas atribuídas) e Automações (escopo Funil, Canal) ─────────────

function agenteEnsaiavel() {
  const agente = state.agents.find((a) => a.lifecycle === "ativo" && (versaoCorrenteDoAgente(a)?.instructions ?? "").trim() !== "");
  expect(agente).toBeDefined();
  return agente?.id ?? "";
}

describe("Ensaio de Agente no CRM novo (15-21)", () => {
  it("(h) o Contato vem da lista da api, o nome fica quando a busca o tira da página e a operação leva `nomes`", async () => {
    await montar(<EnsaiarDialog agentId={agenteEnsaiavel()} open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/^Pedido/), { target: { value: "Resuma o Contato" } });

    fireEvent.click(screen.getByLabelText("Âncora"));
    await waitFor(() => expect(screen.getByRole("option", { name: /Ana Lima/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: /Ana Lima/ }));

    // A busca tira o Contato da página de resultados; o nome continua (POST /crm/nomes).
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Buscar registro"), { target: { value: "zzz" } });
    });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => /\/contatos\?.*q=zzz/.test(String(url)))).toBe(true));
    await waitFor(() => expect(screen.getByLabelText("Âncora").textContent).toContain("Ana Lima"));
    const nomes = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/crm/nomes")).map(([, init]) => JSON.parse((init as { body: string }).body));
    expect(nomes.some((n) => n.alvos.some((a: { tipo: string; id: string }) => a.tipo === "contact" && a.id === CONTATO))).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ensaiar" }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("ensaiarAgente");
    expect(chamada?.args[1]).toEqual({ texto: "Resuma o Contato", anchor: { type: "contact", id: CONTATO } });
    expect(chamada?.args[2]).toEqual({ [CONTATO]: "Ana Lima" });
  });

  it("(i) borda UCR-08: o Contato que a api não nomeia aparece como \"Registro indisponível\"", async () => {
    nomesDaApi = {};
    await montar(<EnsaiarDialog agentId={agenteEnsaiavel()} open onClose={() => undefined} />);
    fireEvent.click(screen.getByLabelText("Âncora"));
    await waitFor(() => expect(screen.getByRole("option", { name: /Ana Lima/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: /Ana Lima/ }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Buscar registro"), { target: { value: "zzz" } });
    });
    await waitFor(() => expect(screen.getByLabelText("Âncora").textContent).toContain(NOME_INDISPONIVEL));
  });
});

describe("Conversas atribuídas ao Agente (15-21)", () => {
  it("(j) o total vem de GET /conversas?atribuidoId=, não do store", async () => {
    totalDeConversas = 7;
    state.conversations = [];
    const { result } = renderHook(() => useConversasDoAgente("agt_x"), { wrapper: Tela });
    await waitFor(() => expect(result.current).toBe(7));
    expect(fetchMock.mock.calls.some(([url]) => /\/conversas\?.*atribuidoId=agt_x/.test(String(url)))).toBe(true);
  });
});

describe("Escopo Funil das Automações no CRM novo (15-21)", () => {
  const automacaoDoFunil = () => {
    const a = state.automations.find((x) => x.scopeType === "funnel");
    expect(a).toBeDefined();
    return a as NonNullable<typeof a>;
  };

  async function montarMotivo(id: string) {
    function MotivoDoFunil() {
      const funis = useFunisDoEscopo();
      const a = { ...automacaoDoFunil(), scopeId: id };
      return <span data-testid="motivo">{inoperanteComFunis(state, a, funis) ?? "sem motivo"}</span>;
    }
    await montar(<MotivoDoFunil />);
  }

  it("(k) o Funil que a api lista (ativo) não deixa a Automação inoperante", async () => {
    await montarMotivo(FUNIL);
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => /\/funis\?.*estado=ativo/.test(String(url)))).toBe(true));
    await waitFor(() => expect(screen.getByTestId("motivo").textContent).toBe("sem motivo"));
  });

  it("(l) o Funil que a api não lista é \"escopo eliminado\"; o arquivado, \"escopo arquivado\"", async () => {
    funisDaApi = { ativo: [], arquivado: [{ id: "fnl-velho", nome: "Velho", estado: "arquivado" }] };
    await montarMotivo("fnl-que-nao-existe");
    await waitFor(() => expect(screen.getByTestId("motivo").textContent).toBe("escopo eliminado (Funil)"));
    cleanup();
    await montarMotivo("fnl-velho");
    await waitFor(() => expect(screen.getByTestId("motivo").textContent).toBe("escopo arquivado (Funil)"));
  });

  it("(m) enquanto a lista de Funis não chegou, não acusa \"escopo eliminado\" (sem piscar o aviso)", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    await montarMotivo(FUNIL);
    expect(screen.getByTestId("motivo").textContent).toBe("sem motivo");
  });

  it("(n) Nova Automação com escopo Funil lista os Funis da api e manda `funis` na operação", async () => {
    await montar(<NovaAutomacaoDialog open onClose={() => undefined} onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Avisar o SDR" } });
    fireEvent.click(screen.getByLabelText(/^Escopo/));
    fireEvent.click(screen.getByRole("option", { name: "Funil" }));
    fireEvent.click(screen.getByLabelText(/^Funil/));
    await waitFor(() => expect(screen.getByRole("option", { name: "Funil de Vendas" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Funil de Vendas" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Criar e abrir o editor" }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("criarAutomacao");
    expect(chamada?.args[0]).toMatchObject({ scopeType: "funnel", scopeId: FUNIL });
    expect(chamada?.args[1]).toEqual([{ id: FUNIL, estado: "ativo" }]);
  });
});

describe("Canal das Automações no CRM novo (15-21)", () => {
  it("(o) o campo Canal da Ação de mensagem lista os Canais de GET /canais (o store não tem Canais)", async () => {
    state.channels = [];
    const spec = specDaAcao(state, { kind: "escrita", toolId: "mensagem.enviarAoContato" });
    await montar(<BlocoForm spec={spec} valor={{}} onChange={() => undefined} scopeType="grupo" scopeId="grp_x" />);
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => /\/canais\?/.test(String(url)))).toBe(true));
    fireEvent.click(screen.getByLabelText("Canal"));
    await waitFor(() => expect(screen.getByRole("option", { name: /WhatsApp Vendas/ })).toBeTruthy());
  });
});
