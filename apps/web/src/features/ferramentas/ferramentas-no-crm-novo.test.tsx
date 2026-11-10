// @vitest-environment jsdom
/**
 * Fase 15, 3.4.8 (UCR-08) — as Ferramentas (Grupos, Comunidades e Flows) escolhem e mostram Canais e
 * Contatos do CRM novo, não do store.
 *
 * O traçador (15-22, Task 1): criar um Grupo com dois Contatos da ficha nova. As coleções do CRM
 * antigo no seed (Contatos, Canais) ficam VAZIAS aqui, então tudo o que a tela mostra vem da api
 * falsa (`fetch` falso): `GET /canais`, `GET /contatos?comIdentificador=whatsapp` e `POST /crm/nomes`.
 * A operação sai com o `crm` do navegador como último argumento (o servidor o descarta e relê, 15-07).
 */

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal } from "@n1/dominio/crm/canais";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { PedidoDeGravacao, RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { conversaAntigaDeTeste } from "@/testes/crm-antigo-de-teste";
import { AbaComunidades } from "./aba-comunidades";
import { AbaFlows } from "./aba-flows";
import { AbaGrupos } from "./aba-grupos";
import { ConversaDoGrupo } from "./conversa-do-grupo";
import { ComunidadeCompleta } from "./comunidade-popup";
import { CriarComunidadeDialog } from "./criar-comunidade-dialog";
import { CriarFlowDialog } from "./criar-flow-dialog";
import { CriarGrupoDialog } from "./criar-grupo-dialog";
import { EnviarFlowDialog } from "./flow-popup";
import { ImportarGruposDialog } from "./importar-grupos-dialog";
import { SecaoDeParticipacoes } from "./participacoes";
import { SecaoDePedidosDeEntrada } from "./pedidos-de-entrada";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));
vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ferramentas/grupos",
  useSearchParams: () => new URLSearchParams(),
}));

const CANAL = "55555555-5555-4555-8555-555555555555";
/** O Canal do seed (`chn_wpp`) como a tabela o devolve: os Grupos do seed apontam para ele. */
const CANAL_DO_SEED = "chn_wpp";
const CONTATO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONTATO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
/** Um Contato sem Identificador de WhatsApp: a api só o devolve quando o filtro `comIdentificador` não vem. */
const CONTATO_SEM_WHATSAPP = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let state: DataState;
let gravados: PedidoDeGravacao[];
let fetchMock: ReturnType<typeof vi.fn>;
let canaisDaApi: Canal[];
/** Os Contatos que a api falsa devolve quando o filtro de WhatsApp vem; o terceiro só sem filtro. */
let nomesDaApi: Record<string, string | undefined>;

function canal(parcial: Partial<Canal> & Pick<Canal, "id" | "nome">): Canal {
  return {
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: "5511999990001",
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: "2026-11-01T10:00:00.000Z",
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_x",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: true,
    criadoPor: "mem_x",
    criadoEm: "2026-11-01T10:00:00.000Z",
    atualizadoEm: "2026-11-01T10:00:00.000Z",
    ...parcial,
  };
}

function resumo(id: string, nomeDeExibicao: string, telefonePrincipal: string | null) {
  return { id, nomeDeExibicao, estado: "ativo", proprietarioId: "mem_x", emailPrincipal: null, telefonePrincipal, atualizadoEm: "2026-11-01T10:00:00.000Z" };
}

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
  // Sem as coleções do CRM antigo: tudo o que a tela mostra de Canal e Contato vem da api.
  Object.assign(state, { contacts: [], channels: [] });
  gravados = [];
  canaisDaApi = [canal({ id: CANAL, nome: "WhatsApp Vendas" }), canal({ id: CANAL_DO_SEED, nome: "Canal do CRM novo", identificadorExterno: "+5511987654321" })];
  nomesDaApi = { [CONTATO_A]: "Ana Lima", [CONTATO_B]: "Bruno Reis" };
  fetchMock = vi.fn(async (url: string, init?: { body?: string }) => {
    const caminho = String(url).replace("http://api", "");
    const parametros = new URL(`http://x${caminho}`).searchParams;
    if (caminho.startsWith("/crm/nomes")) {
      const { alvos } = JSON.parse(init?.body ?? "{}") as { alvos: Array<{ tipo: string; id: string }> };
      const itens = alvos.map((a) => ({ ...a, nome: nomesDaApi[a.id] ?? null }));
      return resposta({ ok: true, itens, total: itens.length });
    }
    if (caminho.startsWith("/canais")) {
      const itens = parametros.get("estado") === "arquivado" ? [] : canaisDaApi;
      return resposta({ ok: true, itens, total: itens.length });
    }
    if (caminho.startsWith("/contatos")) {
      const q = (parametros.get("q") ?? "").toLowerCase();
      const comWhatsApp = [resumo(CONTATO_A, "Ana Lima", "5511988880001"), resumo(CONTATO_B, "Bruno Reis", null)];
      const todos = parametros.get("comIdentificador") === "whatsapp" ? comWhatsApp : [...comWhatsApp, resumo(CONTATO_SEM_WHATSAPP, "Carla Sem Zap", null)];
      const itens = todos.filter((c) => q === "" || c.nomeDeExibicao.toLowerCase().includes(q));
      return resposta({ ok: true, itens, total: itens.length });
    }
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

const chamadasA = (caminho: RegExp) => fetchMock.mock.calls.filter(([url]) => caminho.test(String(url)));

// ── Task 1 (traçador): criar Grupo com dois Contatos da ficha nova ────────────────────────────────

describe("Criar Grupo no CRM novo (15-22, traçador)", () => {
  async function abrirEPreencher() {
    const aoCriar = vi.fn();
    await montar(<CriarGrupoDialog open onClose={() => undefined} onCreated={aoCriar} />);
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Turma Full Face" } });
    // O Canal vem de GET /canais (o store está vazio).
    fireEvent.click(screen.getByLabelText(/Canal administrador/));
    await waitFor(() => expect(screen.getByRole("option", { name: /WhatsApp Vendas/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: /WhatsApp Vendas/ }));
    return aoCriar;
  }

  async function escolherParticipantes(...nomes: string[]) {
    fireEvent.click(abrirParticipantes());
    for (const nome of nomes) {
      await waitFor(() => expect(screen.getByRole("option", { name: new RegExp(nome) })).toBeTruthy());
      fireEvent.click(screen.getByRole("option", { name: new RegExp(nome) }));
    }
  }

  /** O botão que abre a lista de "Participantes adicionados" (o `Field` aponta o rótulo para ele). */
  function abrirParticipantes(): HTMLElement {
    return screen.getByLabelText(/Participantes adicionados/);
  }

  it("(a) o seletor de Contatos pede à api só os Contatos com WhatsApp (comIdentificador)", async () => {
    await montar(<CriarGrupoDialog open onClose={() => undefined} onCreated={() => undefined} />);
    await waitFor(() => expect(chamadasA(/\/contatos\?/).length).toBeGreaterThan(0));
    expect(chamadasA(/\/contatos\?/).every(([url]) => /comIdentificador=whatsapp/.test(String(url)))).toBe(true);
  });

  it("(b) escolher o Canal K e os Contatos A e B cria o Grupo: criarGrupo leva os ids novos e o `crm` do navegador", async () => {
    const aoCriar = await abrirEPreencher();
    await escolherParticipantes("Ana Lima", "Bruno Reis");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Criar Grupo" }));
    });

    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("criarGrupo");
    expect(chamada?.args[0]).toMatchObject({ canalId: CANAL, participantesIniciaisContactIds: [CONTATO_A, CONTATO_B] });
    const crm = chamada?.args[1] as { canais: Array<{ id: string }>; contatos: Array<{ id: string }> };
    expect(crm.canais.map((c) => c.id)).toContain(CANAL);
    expect(crm.contatos.map((c) => c.id).sort()).toEqual([CONTATO_A, CONTATO_B]);
    // O Grupo nasce com uma Participação por Contato, com o id de plataforma.contatos.
    const grupo = gravados[0]?.copia.grupos.find((g) => g.nome === "Turma Full Face");
    expect(grupo?.canalId).toBe(CANAL);
    expect(grupo?.participacoes.filter((p) => p.contactId === CONTATO_A)).toHaveLength(1);
    expect(grupo?.participacoes.filter((p) => p.contactId === CONTATO_B)).toHaveLength(1);
    expect(aoCriar).toHaveBeenCalledTimes(1);
  });

  it("(c) borda UCR-08: um Contato sem WhatsApp não aparece no seletor, e escolher o mesmo Contato duas vezes não duplica a Participação", async () => {
    await abrirEPreencher();
    fireEvent.click(abrirParticipantes());
    await waitFor(() => expect(screen.getByRole("option", { name: /Ana Lima/ })).toBeTruthy());
    expect(screen.queryByRole("option", { name: /Carla Sem Zap/ })).toBeNull();

    // Ana entra, sai e entra de novo; Ana como Criador a tira de Participantes (um papel por Contato).
    fireEvent.click(screen.getByRole("option", { name: /Ana Lima/ }));
    fireEvent.click(screen.getByRole("option", { name: /Ana Lima/ }));
    fireEvent.click(screen.getByRole("option", { name: /Ana Lima/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Criar Grupo" }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.args[0]).toMatchObject({ participantesIniciaisContactIds: [CONTATO_A] });
    const grupo = gravados[0]?.copia.grupos.find((g) => g.nome === "Turma Full Face");
    expect(grupo?.participacoes.filter((p) => p.contactId === CONTATO_A)).toHaveLength(1);
  });
});

// ── Task 2: Grupos — importar, aba, Participações, Pedidos de Entrada e a Conversa do Grupo ──────────

const grupoDoSeed = (id: string) => {
  const g = state.grupos.find((x) => x.id === id);
  expect(g).toBeDefined();
  return g as NonNullable<typeof g>;
};
const nomesPedidos = () => chamadasA(/\/crm\/nomes/).map(([, init]) => JSON.parse((init as { body: string }).body) as { alvos: Array<{ tipo: string; id: string }> });

describe("Grupos no CRM novo (15-22)", () => {
  it("(d) as Participações mostram o nome pelo POST /crm/nomes (um lote por Grupo) e o Canal pelo GET /canais", async () => {
    nomesDaApi = { cnt_16: "Ana Lima", cnt_17: "Bruno Reis" };
    const grupo = grupoDoSeed("grp_turma_03");
    await montar(<SecaoDeParticipacoes grupo={grupo} report={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Ana Lima")).toBeTruthy());
    expect(screen.getByText("Bruno Reis")).toBeTruthy();
    // O Canal que participa vem de GET /canais (o store está sem Canais).
    expect(screen.getByText("Canal do CRM novo")).toBeTruthy();
    // Um lote só, com os Contatos das Participações (o Canal não é Contato).
    const lotes = nomesPedidos();
    expect(lotes).toHaveLength(1);
    expect(lotes[0]?.alvos.map((a) => a.id).sort()).toEqual(["cnt_16", "cnt_17", "cnt_18", "cnt_19"]);
    expect(lotes[0]?.alvos.every((a) => a.tipo === "contact")).toBe(true);
    // T-15-54: o Contato que a api não nomeou aparece pelo número da própria Participação, sem link para a ficha.
    const semNome = grupo.participacoes.find((p) => p.contactId === "cnt_18");
    expect(screen.getByText(semNome?.identificadorExternoDoParticipante ?? "?")).toBeTruthy();
  });

  it("(e) os Pedidos de Entrada nomeiam o solicitante pela api, e aprovar manda o `crm` com os Canais", async () => {
    nomesDaApi = { cnt_29: "Paula Souza" };
    const grupo = grupoDoSeed("grp_turma_03");
    await montar(<SecaoDePedidosDeEntrada grupo={grupo} report={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Paula Souza")).toBeTruthy());

    // Os botões só valem depois que os Canais chegaram (a recusa de Canal não pisca antes).
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Aprovar" })[0] as HTMLButtonElement).disabled).toBe(false));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Aprovar" })[0] as HTMLElement);
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("aprovarPedidoDeEntrada");
    const crm = chamada?.args[2] as { canais: Array<{ id: string }> };
    expect(crm.canais.map((c) => c.id)).toContain(CANAL_DO_SEED);
  });

  it("(f) simular um Pedido de Entrada no navegador funciona de novo: o Contato do número nasce só na execução local (WINDOWS #17)", async () => {
    const grupo = grupoDoSeed("grp_turma_03");
    const report = vi.fn();
    await montar(<SecaoDePedidosDeEntrada grupo={grupo} report={report} />);
    await waitFor(() => expect(chamadasA(/\/canais\?/).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Simular pedido" }));
    fireEvent.change(screen.getByLabelText(/Número de WhatsApp/), { target: { value: "5511988776655" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Receber Pedido" }) as HTMLButtonElement).disabled).toBe(false));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Receber Pedido" }));
    });
    expect(report).toHaveBeenCalledTimes(1);
    expect((report.mock.calls[0]?.[0] as { ok: boolean }).ok).toBe(true);
  });

  it("(g) importar Grupos do Canal lista o Canal da api e manda `importarGruposDoCanal` com o `crm`", async () => {
    const report = vi.fn();
    await montar(<ImportarGruposDialog open onClose={() => undefined} report={report} />);
    fireEvent.click(screen.getByLabelText(/^Canal/));
    await waitFor(() => expect(screen.getByRole("option", { name: /Canal do CRM novo/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: /Canal do CRM novo/ }));
    // O provedor simulado conhece os grupos pelo Identificador externo do Canal da tabela.
    expect(screen.getByText("Fornecedores Full Face")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Importar 2/ }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("importarGruposDoCanal");
    expect(chamada?.args[0]).toBe(CANAL_DO_SEED);
    expect((chamada?.args[1] as { canais: Array<{ id: string }> }).canais.map((c) => c.id)).toContain(CANAL_DO_SEED);
    expect((report.mock.calls[0]?.[0] as { ok: boolean }).ok).toBe(true);
  });

  it("(j) adicionar participante lista só Contatos com WhatsApp da api e manda `adicionarParticipantes` com os escolhidos no `crm`", async () => {
    const grupo = grupoDoSeed("grp_turma_03");
    const report = vi.fn();
    await montar(<SecaoDeParticipacoes grupo={grupo} report={report} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Adicionar participante" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar participante" }));
    fireEvent.click(screen.getByLabelText(/^Contatos/));
    await waitFor(() => expect(screen.getByRole("option", { name: /Ana Lima/ })).toBeTruthy());
    expect(screen.queryByRole("option", { name: /Carla Sem Zap/ })).toBeNull();
    expect(chamadasA(/\/contatos\?/).every(([url]) => /comIdentificador=whatsapp/.test(String(url)))).toBe(true);
    fireEvent.click(screen.getByRole("option", { name: /Ana Lima/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("adicionarParticipantes");
    expect(chamada?.args[1]).toEqual({ contactIds: [CONTATO_A], comoAdministrador: false });
    expect((chamada?.args[2] as { contatos: Array<{ id: string }> }).contatos.map((c) => c.id)).toEqual([CONTATO_A]);
  });

  it("(h) a aba lista o Canal de cada Grupo pelo GET /canais", async () => {
    await montar(<AbaGrupos report={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("Canal do CRM novo").length).toBeGreaterThan(0));
  });

  it("(i) a Conversa do Grupo continua lida de state.conversations (F14-D-05) e a caixa de envio confere o Canal da api", async () => {
    await montar(<ConversaDoGrupo grupoId="grp_turma_02" report={vi.fn()} />);
    // As Mensagens vêm de `state.conversations`: o store do teste não tem Canais nem Contatos.
    expect(screen.getByText(/Turma #02, sejam bem-vindos/)).toBeTruthy();
    const caixa = screen.getByLabelText("Mensagem ao Grupo") as HTMLTextAreaElement;
    // Enquanto os Canais não chegam a recusa fica quieta; depois disso o Canal da api (`chn_wpp`) libera a caixa.
    await waitFor(() => expect(chamadasA(/\/canais\?/).length).toBeGreaterThan(0));
    await act(async () => undefined);
    expect(caixa.readOnly).toBe(false);
  });
});

// ── Task 3: Comunidades e Flows ───────────────────────────────────────────────────────────────────

describe("Comunidades e Flows no CRM novo (15-22)", () => {
  it("(k) criar Comunidade com o Canal da tabela manda `criarComunidade` com o `crm`", async () => {
    const aoCriar = vi.fn();
    await montar(<CriarComunidadeDialog open onClose={() => undefined} onCreated={aoCriar} />);
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Alunos 2027" } });
    fireEvent.click(screen.getByLabelText(/^Canal administrador/));
    await waitFor(() => expect(screen.getByRole("option", { name: /WhatsApp Vendas/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: /WhatsApp Vendas/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Criar Comunidade" }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("criarComunidade");
    expect(chamada?.args[0]).toMatchObject({ nome: "Alunos 2027", canalId: CANAL });
    expect((chamada?.args[1] as { canais: Array<{ id: string }> }).canais.map((c) => c.id)).toContain(CANAL);
    expect(aoCriar).toHaveBeenCalledTimes(1);
  });

  it("(l) a aba de Comunidades mostra o Canal de cada uma pelo GET /canais", async () => {
    await montar(<AbaComunidades />);
    await waitFor(() => expect(screen.getAllByText("Canal do CRM novo").length).toBeGreaterThan(0));
  });

  it("(m) a ficha da Comunidade mostra o Canal administrador pelo GET /canais", async () => {
    await montar(<ComunidadeCompleta comunidadeId="com_alunos_ff" modo="pagina" />);
    await waitFor(() => expect(screen.getAllByText("Canal do CRM novo").length).toBeGreaterThan(0));
  });

  it("(n) criar Flow lista o Canal publicador da api e manda `criarFlow` com o `crm`", async () => {
    const aoCriar = vi.fn();
    await montar(<CriarFlowDialog open onClose={() => undefined} onCreated={aoCriar} />);
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Agendamento" } });
    fireEvent.click(screen.getByLabelText(/^Canal publicador/));
    await waitFor(() => expect(screen.getByRole("option", { name: /WhatsApp Vendas/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: /WhatsApp Vendas/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Criar e abrir o construtor" }));
    });
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("criarFlow");
    expect(chamada?.args[0]).toMatchObject({ nome: "Agendamento", canalId: CANAL });
    expect((chamada?.args[1] as { canais: Array<{ id: string }> }).canais.map((c) => c.id)).toContain(CANAL);
    expect(aoCriar).toHaveBeenCalledTimes(1);
  });

  it("(o) a aba de Flows mostra o Canal publicador pela api e só avisa \"sem Canal publicador\" quando ele não existe lá", async () => {
    await montar(<AbaFlows onAbrirConstrutor={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText("Canal do CRM novo").length).toBeGreaterThan(0));
    expect(screen.queryByText("sem Canal publicador")).toBeNull();
  });

  it("(p) enviar o Flow a um Contato continua escolhendo a Conversa de state.conversations, com o nome do Contato pelo POST /crm/nomes (F14-D-05)", async () => {
    nomesDaApi = { cnt_2: "Marina Alves" };
    // O seed não cria mais Conversa 1:1 (15-31): a do Contato `cnt_2`, que o diálogo oferece, é posta aqui.
    state.conversations.push(conversaAntigaDeTeste({ id: "cnv_1", contactId: "cnt_2", atribuidaA: "mem_julia" }));
    const flow = state.flows.find((f) => f.id === "flw_triagem");
    expect(flow).toBeDefined();
    await montar(<EnviarFlowDialog flow={flow as NonNullable<typeof flow>} onClose={() => undefined} report={vi.fn()} />);
    await waitFor(() => expect(nomesPedidos().length).toBeGreaterThan(0));
    fireEvent.click(screen.getByLabelText(/^Conversa/));
    await waitFor(() => expect(screen.getByRole("option", { name: /Marina Alves/ })).toBeTruthy());
  });
});
