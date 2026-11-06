// @vitest-environment jsdom
/**
 * A página de uma Conversa pelo CRM novo (15-24, 3.4.1 segunda parte, UCR-05):
 * ela lê `useConversa(id)` e cada gesto do cabeçalho (resolver, reabrir, atribuir,
 * mover, lixeira) é uma rota REST de `/conversas/:id/*` — nenhum chega a
 * `POST /operacoes/` nem ao transporte do store, então `plataforma.registros`
 * (`colecao = 'conversations'`) não muda.
 *
 * O ramo do Grupo (F14-D-05) continua pelo store: um id que a api não conhece
 * (404) e que é Conversa de grupo em `state.conversations` abre a Conversa do
 * Grupo; qualquer outro 404 diz "Conversa não encontrada.".
 *
 * O fio é trocado por um marcador (ele tem teste próprio, 15-20); a rede é um
 * `fetch` roteado por URL, a sessão é falsa e o `StoreProvider` é o de verdade
 * com o seed. O teste mora em `features/crm/` porque `app/` só guarda convenção
 * de arquivo do Next.
 */

import { Suspense, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig, useSWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { ConversaDetalhada } from "@n1/dominio/crm/conversas";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import ConversaPage from "@/app/(shell)/crm/caixa-de-entrada/[conversa]/page";
import { empresaDoContato } from "@/features/crm/empresa-do-contato";
import { listaConversacional } from "@n1/dominio/derive-conversacional";
import type { VinculoDoContato } from "@n1/dominio/crm/contatos";

const { obterSessao, revalidador, trocarRota } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  // O `mutate` do SWRConfig do teste: o global não alcança o cache isolado, este sim.
  revalidador: { revalidar: undefined as undefined | ((prefixo: string) => Promise<unknown>) },
  trocarRota: vi.fn(),
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));
vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async (prefixo: string) => revalidador.revalidar?.(prefixo)) };
});
vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada/cnv_1",
  useRouter: () => ({ replace: trocarRota, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
// A lista da Caixa tem teste próprio (15-11); aqui só importa o que a página põe dentro dela.
vi.mock("@/features/crm/inbox-columns", () => ({
  InboxColumns: ({ children }: { children?: React.ReactNode }) => <div data-testid="caixa">{children}</div>,
}));
// O fio tem teste próprio (15-20); aqui basta saber com que ids a página o monta.
vi.mock("@/features/crm/conversation-thread", () => ({
  ConversationThread: (props: { conversaId?: string; contatoId: string; canalPreferidoId?: string }) => (
    <div data-testid="fio" data-conversa={props.conversaId} data-contato={props.contatoId} data-canal={props.canalPreferidoId} />
  ),
  CHANNEL_ICON: {},
}));

const CONTATO_ID = "ctt_ana";
const CONVERSA_ID = "cnv_1";

let estado: DataState;
let conversaDaApi: ConversaDetalhada | null;
let fetchMock: ReturnType<typeof vi.fn>;
let transporte: Transporte;

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

function conversaDeTeste(sobre: Partial<ConversaDetalhada["conversa"]> = {}): ConversaDetalhada {
  return {
    conversa: {
      id: CONVERSA_ID,
      canalId: "chn_wpp",
      contatoId: CONTATO_ID,
      titulo: "Ana Souza",
      tituloEditado: false,
      situacao: "aberta",
      estado: "ativo",
      naLixeiraEm: null,
      filaId: null,
      atribuido: null,
      adiadaAte: null,
      adiamentoMotivo: null,
      participantes: [],
      resolvidaEm: null,
      reabertaEm: null,
      reaberturas: 0,
      criadoPor: { tipo: "member", id: "mem_thiago" },
      criadoEm: "2026-10-01T10:00:00.000Z",
      atualizadoEm: "2026-10-01T10:00:00.000Z",
      ...sobre,
    },
    canal: { id: "chn_wpp", nome: "Comercial SP", tipo: "whatsapp", provedor: "whatsapp-cloud", conexao: "conectada", conexaoSimulada: false },
  };
}

/** O Contato que a api devolve; os testes da coluna trocam vínculos e qualificação. */
let contatoAtual: { qualificacao: string | null; vinculos: VinculoDoContato[] };

function contatoDaApi() {
  return {
    contato: {
      id: CONTATO_ID,
      nome: "Ana",
      sobrenome: "Souza",
      dataNascimento: null,
      idioma: null,
      fusoHorario: null,
      fotoUrl: null,
      descricao: null,
      enderecos: [],
      camposAdicionais: {},
      origem: null,
      qualificacao: contatoAtual.qualificacao,
      modoCriacao: "manual",
      estado: "ativo",
      mescladoEmId: null,
      mescladoEm: null,
      proprietarioId: "mem_julia",
      criadoPor: "mem_thiago",
      criadoEm: "2026-01-01T00:00:00.000Z",
      atualizadoEm: "2026-01-01T00:00:00.000Z",
    },
    identificadores: [
      { id: "ident_wpp", contatoId: CONTATO_ID, tipo: "whatsapp", valor: "5511999990000", valorExibido: null, rotuloCanal: null, verificado: false, principal: true, criadoEm: "2026-01-01T00:00:00.000Z" },
    ],
    vinculos: contatoAtual.vinculos,
  };
}

/** O que `PATCH /contatos/:id` responde; os testes trocam para recusar. */
let editarContatoNaApi: (corpo: { qualificacao?: string }) => Response;

/** Gestos que a api falsa já aceita: mudam a Conversa em memória e devolvem o detalhe. */
let responderGesto: (acao: string, corpo: unknown) => Response;

beforeEach(() => {
  estado = buildSeed();
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  trocarRota.mockClear();
  conversaDaApi = conversaDeTeste();
  contatoAtual = { qualificacao: null, vinculos: [] };
  transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  editarContatoNaApi = (corpo) => {
    if (corpo.qualificacao !== undefined) contatoAtual = { ...contatoAtual, qualificacao: corpo.qualificacao };
    return resposta(200, { ok: true, dados: contatoDaApi() });
  };
  responderGesto = (acao, corpo) => {
    if (!conversaDaApi) return resposta(404, { ok: false, error: "Conversa não encontrada." });
    const c = conversaDaApi.conversa;
    if (acao === "resolver") conversaDaApi = { ...conversaDaApi, conversa: { ...c, situacao: "resolvida" } };
    if (acao === "reabrir") conversaDaApi = { ...conversaDaApi, conversa: { ...c, situacao: "aberta" } };
    if (acao === "lixeira") conversaDaApi = { ...conversaDaApi, conversa: { ...c, estado: "na_lixeira" } };
    if (acao === "atribuir") conversaDaApi = { ...conversaDaApi, conversa: { ...c, atribuido: (corpo as { atribuido: ConversaDetalhada["conversa"]["atribuido"] }).atribuido } };
    return resposta(200, { ok: true, dados: conversaDaApi });
  };
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const alvo = new URL(url);
    const metodo = init.method ?? "GET";
    const corpo = init.body === undefined ? undefined : JSON.parse(String(init.body));
    if (metodo === "GET" && alvo.pathname === `/conversas/${CONVERSA_ID}`) {
      return conversaDaApi ? resposta(200, { ok: true, dados: conversaDaApi }) : resposta(404, { ok: false, error: "Conversa não encontrada." });
    }
    const gesto = /^\/conversas\/([^/]+)\/(resolver|reabrir|atribuir|lixeira|mover)$/.exec(alvo.pathname);
    if (metodo === "POST" && gesto) return responderGesto(gesto[2] as string, corpo);
    if (metodo === "GET" && alvo.pathname === `/contatos/${CONTATO_ID}`) return resposta(200, { ok: true, dados: contatoDaApi() });
    if (metodo === "PATCH" && alvo.pathname === `/contatos/${CONTATO_ID}`) return editarContatoNaApi(corpo as { qualificacao?: string });
    if (metodo === "GET" && alvo.pathname === "/negocios") return resposta(200, { ok: true, itens: [], total: 0 });
    if (metodo === "GET" && alvo.pathname === "/canais") return resposta(200, { ok: true, itens: [], total: 0 });
    return resposta(404, { ok: false, error: "Conversa não encontrada." });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function RegistrarRevalidacao() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    revalidador.revalidar = (prefixo) => mutate((chave) => typeof chave === "string" && chave.startsWith(prefixo));
    return () => {
      revalidador.revalidar = undefined;
    };
  }, [mutate]);
  return null;
}

async function montarPagina(id: string = CONVERSA_ID) {
  const params = Promise.resolve({ conversa: id });
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <RegistrarRevalidacao />
        <StoreProvider sessao={{ memberId: "mem_thiago" }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporte}>
          <Suspense fallback="carregando">
            <ConversaPage params={params} />
          </Suspense>
        </StoreProvider>
      </SWRConfig>,
    );
  });
}

/** O cabeçalho só desenha a Conversa depois que a leitura chegou. */
async function paginaPronta() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Ações da Conversa" })).toBeTruthy());
}

/** As chamadas que gravam (tudo que não é GET). */
function gravacoes(): Array<{ caminho: string; metodo: string; corpo: unknown }> {
  return fetchMock.mock.calls
    .map((c) => ({ caminho: new URL(String(c[0])).pathname, metodo: (c[1] as RequestInit | undefined)?.method ?? "GET", corpo: (c[1] as RequestInit | undefined)?.body }))
    .filter((c) => c.metodo !== "GET")
    .map((c) => ({ ...c, corpo: c.corpo === undefined ? undefined : JSON.parse(String(c.corpo)) }));
}

function escolherNoMenu(item: string) {
  fireEvent.click(screen.getByRole("button", { name: "Ações da Conversa" }));
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
}

async function abrirDadosDoContato() {
  fireEvent.click(screen.getByRole("button", { name: "Dados do Contato" }));
}

describe("página da Conversa pelo CRM novo — gestos por REST (3.4.1, UCR-05)", () => {
  it("(1) lê a Conversa da api e monta o fio com os ids dela", async () => {
    await montarPagina();
    await paginaPronta();
    const fio = screen.getByTestId("fio");
    expect(fio.getAttribute("data-conversa")).toBe(CONVERSA_ID);
    expect(fio.getAttribute("data-contato")).toBe(CONTATO_ID);
    expect(fio.getAttribute("data-canal")).toBe("chn_wpp");
    await waitFor(() => expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0));
  });

  it("(2) resolver chama POST /conversas/:id/resolver e nada vai a /operacoes nem ao transporte", async () => {
    await montarPagina();
    await paginaPronta();
    escolherNoMenu("Resolver");
    await waitFor(() => expect(screen.getByText("Conversa resolvida.")).toBeTruthy());
    expect(gravacoes()).toEqual([{ caminho: `/conversas/${CONVERSA_ID}/resolver`, metodo: "POST", corpo: undefined }]);
    expect(transporte.gravar).not.toHaveBeenCalled();
    // A leitura foi revalidada: o menu agora oferece Reabrir.
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: "Ações da Conversa" }));
      expect(screen.getByRole("menuitem", { name: "Reabrir" })).toBeTruthy();
    });
  });

  it("(3) reabrir e enviar à lixeira chamam as rotas próprias", async () => {
    conversaDaApi = conversaDeTeste({ situacao: "resolvida", resolvidaEm: "2026-10-02T10:00:00.000Z" });
    await montarPagina();
    await paginaPronta();
    escolherNoMenu("Reabrir");
    await waitFor(() => expect(screen.getByText("Conversa reaberta.")).toBeTruthy());
    expect(gravacoes().map((g) => g.caminho)).toEqual([`/conversas/${CONVERSA_ID}/reabrir`]);

    // De volta a resolvida: a lixeira pede confirmação e depois chama a rota.
    conversaDaApi = conversaDeTeste({ situacao: "resolvida", resolvidaEm: "2026-10-02T10:00:00.000Z" });
    await act(async () => {
      await revalidador.revalidar?.("/conversas");
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: "Ações da Conversa" }));
      expect(screen.getByRole("menuitem", { name: "Reabrir" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Enviar à lixeira" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar à lixeira" }));
    await waitFor(() => expect(screen.getByText("Conversa enviada à lixeira.")).toBeTruthy());
    expect(gravacoes().map((g) => g.caminho)).toEqual([`/conversas/${CONVERSA_ID}/reabrir`, `/conversas/${CONVERSA_ID}/lixeira`]);
    expect(transporte.gravar).not.toHaveBeenCalled();
  });

  it("(4) atribuir a um Membro manda { atribuido: { tipo: 'membro', id } }; 'Sem Atribuído' manda null", async () => {
    await montarPagina();
    await paginaPronta();
    await abrirDadosDoContato();
    const julia = estado.members.find((m) => m.id === "mem_julia")!;
    fireEvent.click(screen.getByRole("combobox", { name: "Atribuído" }));
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent?.includes(julia.displayName)) as HTMLElement);
    await waitFor(() => expect(screen.getByText("Conversa atribuída.")).toBeTruthy());
    expect(gravacoes()).toEqual([{ caminho: `/conversas/${CONVERSA_ID}/atribuir`, metodo: "POST", corpo: { atribuido: { tipo: "membro", id: "mem_julia" } } }]);

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Atribuído" }).textContent).toContain(julia.displayName));
    fireEvent.click(screen.getByRole("combobox", { name: "Atribuído" }));
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent?.includes("Sem Atribuído")) as HTMLElement);
    await waitFor(() => expect(screen.getByText("Atribuição removida.")).toBeTruthy());
    expect(gravacoes()[1]).toEqual({ caminho: `/conversas/${CONVERSA_ID}/atribuir`, metodo: "POST", corpo: { atribuido: null } });
    expect(transporte.gravar).not.toHaveBeenCalled();
  });

  it("(5) borda UCR-05: resolver uma Conversa que outra aba já resolveu mostra a recusa e a página fica coerente", async () => {
    await montarPagina();
    await paginaPronta();
    // Outra aba resolveu primeiro: a página ainda acha que está aberta.
    conversaDaApi = conversaDeTeste({ situacao: "resolvida", resolvidaEm: "2026-10-02T10:00:00.000Z" });
    responderGesto = () => resposta(409, { ok: false, error: "A Conversa já está resolvida.", codigo: "TRANSICAO_INVALIDA" });
    escolherNoMenu("Resolver");
    await waitFor(() => expect(screen.getByText("A Conversa já está resolvida.")).toBeTruthy());
    expect(screen.queryByText("Conversa resolvida.")).toBeNull();
    // Depois da revalidação o menu mostra o estado real.
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: "Ações da Conversa" }));
      expect(screen.getByRole("menuitem", { name: "Reabrir" })).toBeTruthy();
    });
    expect(gravacoes()).toHaveLength(1);
    expect(transporte.gravar).not.toHaveBeenCalled();
  });
});

describe("página da Conversa — id que a api não conhece (F14-D-05)", () => {
  it("(6) 404 e Conversa de Grupo em state.conversations abre a Conversa do Grupo", async () => {
    conversaDaApi = null;
    const grupal = estado.conversations.find((c) => c.id === "cnv_grp_turma_02")!;
    expect(grupal.groupIdentifier).toBeDefined();
    await montarPagina(grupal.id);
    await waitFor(() => expect(screen.getByText(/Turma #02, sejam bem-vindos!/)).toBeTruthy());
    expect(screen.queryByText("Conversa não encontrada.")).toBeNull();
  });

  it("(7) 404 e Conversa 1:1 do modelo antigo mostra 'Conversa não encontrada.' (sem ponte de id)", async () => {
    const antiga = estado.conversations.find((c) => c.id === "cnv_5")!;
    expect(antiga.groupIdentifier).toBeUndefined();
    await montarPagina(antiga.id);
    await waitFor(() => expect(screen.getAllByText("Conversa não encontrada.").length).toBeGreaterThan(0));
    expect(screen.queryByTestId("fio")).toBeNull();
  });

  it("(8) 404 e id que não existe em lugar nenhum mostra 'Conversa não encontrada.'", async () => {
    await montarPagina("cnv_que_nao_existe");
    await waitFor(() => expect(screen.getAllByText("Conversa não encontrada.").length).toBeGreaterThan(0));
  });
});

function vinculo(id: string, empresaNome: string, sobre: Partial<VinculoDoContato> = {}): VinculoDoContato {
  return { id, empresaId: `emp_${id}`, empresaNome, cargo: null, admin: false, inicio: null, fim: null, ...sobre };
}

describe("a Empresa do cartão do Contato (D-15-05, mesma regra do 15-05)", () => {
  it("(9) é o vínculo vigente admin mais antigo; sem admin, o vigente mais antigo; encerrado nunca", () => {
    const vinculos = [
      vinculo("v1", "Beta", { inicio: "2020-01-01" }),
      vinculo("v2", "Alfa", { admin: true, inicio: "2021-01-01" }),
      vinculo("v3", "Gama", { admin: true, inicio: "2019-01-01" }),
      vinculo("v4", "Antiga", { admin: true, inicio: "2010-01-01", fim: "2015-01-01" }),
    ];
    expect(empresaDoContato(vinculos)?.empresaNome).toBe("Gama");
    expect(empresaDoContato(vinculos.filter((v) => !v.admin))?.empresaNome).toBe("Beta");
    expect(empresaDoContato([vinculo("v4", "Antiga", { fim: "2015-01-01" })])).toBeUndefined();
    expect(empresaDoContato([])).toBeUndefined();
  });
});

describe("a coluna do Contato da Caixa — modelo novo (3.4.4 item 3, UCR-06)", () => {
  it("(10) mostra nome, Identificador, Empresa, Proprietário e qualificação do Contato novo, sem temperatura", async () => {
    contatoAtual = {
      qualificacao: "cat_qual_qualificado",
      vinculos: [vinculo("v1", "Beta", { inicio: "2020-01-01" }), vinculo("v3", "Gama", { admin: true, inicio: "2019-01-01" })],
    };
    await montarPagina();
    await paginaPronta();
    await abrirDadosDoContato();
    const coluna = await screen.findByRole("complementary");
    await waitFor(() => expect(within(coluna).getByText("Gama")).toBeTruthy());
    expect(within(coluna).queryByText("Beta")).toBeNull();
    expect(within(coluna).getAllByText("Ana Souza").length).toBeGreaterThan(0);
    expect(within(coluna).getByText("5511999990000")).toBeTruthy();
    expect(within(coluna).getByText(estado.members.find((m) => m.id === "mem_julia")!.displayName)).toBeTruthy();
    await waitFor(() => expect(within(coluna).getByRole("combobox", { name: "Qualificação" }).textContent).toContain("Qualificado"));
    expect(within(coluna).queryByText(/Temperatura/)).toBeNull();
    // A coluna não lê o Contato antigo: o seed tem um Contato com este nome, mas não este id.
    expect(within(coluna).getByRole("link", { name: /Abrir ficha/ }).getAttribute("href")).toBe(`/crm/contatos/${CONTATO_ID}`);
  });

  it("(11) trocar a qualificação chama PATCH /contatos/:id com { qualificacao } e a recusa da api aparece na coluna", async () => {
    await montarPagina();
    await paginaPronta();
    await abrirDadosDoContato();
    const coluna = await screen.findByRole("complementary");
    await waitFor(() => expect(within(coluna).getByRole("combobox", { name: "Qualificação" })).toBeTruthy());
    fireEvent.click(within(coluna).getByRole("combobox", { name: "Qualificação" }));
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === "Cliente") as HTMLElement);
    await waitFor(() => expect(gravacoes()).toEqual([{ caminho: `/contatos/${CONTATO_ID}`, metodo: "PATCH", corpo: { qualificacao: "cat_qual_cli" } }]));
    await waitFor(() => expect(within(coluna).getByRole("combobox", { name: "Qualificação" }).textContent).toContain("Cliente"));
    expect(transporte.gravar).not.toHaveBeenCalled();

    editarContatoNaApi = () => resposta(403, { ok: false, error: "Só um Membro ativo altera o CRM." });
    fireEvent.click(within(coluna).getByRole("combobox", { name: "Qualificação" }));
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === "Lead") as HTMLElement);
    await waitFor(() => expect(within(coluna).getByRole("alert").textContent).toContain("Só um Membro ativo altera o CRM."));
    // O valor que ficou é o do servidor, não o que a pessoa tentou.
    expect(within(coluna).getByRole("combobox", { name: "Qualificação" }).textContent).toContain("Cliente");
  });

  it("(12) 'Tarefas' do Contato lista as Tarefas conversacionais com Vínculo para o id do Contato novo", async () => {
    const tarefa = estado.tasks.find((t) => t.lifecycle === "ativo" && listaConversacional(estado, t.listId))!;
    estado.links.push({
      id: "lnk_teste_24",
      fromType: "task",
      fromId: tarefa.id,
      toType: "contact",
      toId: CONTATO_ID,
      createdBy: { kind: "member", id: "mem_thiago" },
      createdAt: "2026-10-29T09:00:00.000Z",
    } as DataState["links"][number]);
    await montarPagina();
    await paginaPronta();
    await abrirDadosDoContato();
    const coluna = await screen.findByRole("complementary");
    expect(within(coluna).getByText(tarefa.title)).toBeTruthy();
    expect(within(coluna).getByRole("button", { name: "Criar Tarefa a partir da Conversa" })).toBeTruthy();
  });

  it("(13) Conversa na lixeira deixa a qualificação só leitura", async () => {
    conversaDaApi = conversaDeTeste({ estado: "na_lixeira", naLixeiraEm: "2026-10-03T10:00:00.000Z", situacao: "resolvida" });
    await montarPagina();
    await paginaPronta();
    await abrirDadosDoContato();
    const coluna = await screen.findByRole("complementary");
    await waitFor(() => expect(within(coluna).getByRole("combobox", { name: "Qualificação" })).toBeTruthy());
    const seletor = within(coluna).getByRole("combobox", { name: "Qualificação" });
    expect(seletor.hasAttribute("disabled") || seletor.getAttribute("aria-disabled") === "true").toBe(true);
  });
});
