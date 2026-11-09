// @vitest-environment jsdom
/**
 * O fio da Conversa pelo CRM novo (15-20, 3.4.2): ele recebe IDS (`conversaId`,
 * `contatoId`, `canalPreferidoId`) e lê o Contato, os Canais, as Conversas e as
 * Mensagens pela api; responder grava UMA linha em `plataforma.mensagens`
 * (`POST /mensagens`) e não manda operação nenhuma para `/operacoes/`.
 *
 * Mantém o que o fio provou na Fase 8 (D-13, D-14, D-15): uma aba por Canal, a
 * aba que abre no Canal da última recebida, o "Responder por" só com Canais
 * conectados que alcançam o Contato e o envio pelo Canal da aba — agora com dois
 * WhatsApps vindos de `GET /canais`, não do estado.
 *
 * `StoreProvider` de verdade com o seed (Listas, Membros e Tarefas ainda moram no
 * estado); a api é um `fetch` roteado por URL e a sessão é falsa. Nenhuma rede.
 */

import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig, useSWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal } from "@n1/dominio/crm/canais";
import type { ContatoDetalhado, IdentificadorDeContato } from "@n1/dominio/crm/contatos";
import type { ConsentimentoDoContato } from "@n1/dominio/crm/consentimentos";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import type { Mensagem } from "@n1/dominio/crm/mensagens";
import type { DataState } from "@n1/dominio/state";
import { POS_VENDA_LIST_ID } from "@n1/dominio/seed-pos-venda";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { StoreProvider } from "@/dados/store";
import { transporteEmMemoria } from "@/dados/transporte";
import { ConversationThread } from "@/features/crm/conversation-thread";

// 14-16: o botão "Criar Tarefa" de uma Lista conversacional chama a rota da api; a rede é falsa.
const { criarTarefa, rehidratar, obterSessao, revalidador } = vi.hoisted(() => ({
  criarTarefa: vi.fn(),
  rehidratar: vi.fn(async () => undefined),
  obterSessao: vi.fn(),
  // O `mutate` do SWRConfig do teste: o global não alcança o cache isolado, este sim.
  revalidador: { revalidar: undefined as undefined | ((prefixo: string) => Promise<unknown>) },
}));
vi.mock("@/dados/crm/tarefas-conversacionais", () => ({ criarTarefaConversacional: criarTarefa }));
vi.mock("@/dados/store", async (original) => ({
  ...(await original<typeof import("@/dados/store")>()),
  useRehidratar: () => rehidratar,
}));
// `invalidarCrm` real usa o `mutate` global; aqui ele repassa o prefixo ao `mutate` do cache isolado do teste.
vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async (prefixo: string) => revalidador.revalidar?.(prefixo)) };
});
vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

const CONTATO_ID = "ctt_ana";

let estado: DataState;
let canaisDaApi: Canal[];
let conversasDaApi: ConversaNaLista[];
let mensagensDaApi: Record<string, Mensagem[]>;
let identificadoresDaApi: IdentificadorDeContato[];
let fetchMock: ReturnType<typeof vi.fn>;

type Rota = (url: string, init?: RequestInit) => Promise<Response>;
/** A rota padrão da api falsa; os testes que mudam uma resposta delegam o resto a ela. */
let rotaPadrao: Rota;
/** O que `POST /mensagens` responde; os testes trocam para segurar ou recusar. */
let gravarMensagem: (corpo: { conversaId: string; direcao: string; conteudo: string }) => Promise<Response>;
/** O que `POST /contatos/:id/notas` responde (15-25). */
let gravarNota: (corpo: { conteudo: string }) => Promise<Response>;
/** O que `GET /contatos/:id/consentimentos` responde (15-25). */
let consentimentosDaApi: ConsentimentoDoContato[];
/** O que `POST /conversas` responde. */
let abrirNaApi: (corpo: { canalId: string; contatoId: string; mensagem: { conteudo: string } }) => Promise<Response>;

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

function novoCanal(id: string, nome: string, provedor: Canal["provedor"], conexao: Canal["conexao"], criadoEm: string, extras: Partial<Canal> = {}): Canal {
  const tipo = provedor === "instagram-graph" ? "instagram" : provedor === "email-imap-smtp" ? "email" : "whatsapp";
  return {
    id,
    nome,
    tipo,
    provedor,
    identificadorExterno: `+5511${id.length}${nome.length}0000000`,
    conexao,
    conexaoSimulada: false,
    conectadaEm: null,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_thiago",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_thiago",
    criadoEm,
    atualizadoEm: criadoEm,
    ...extras,
  };
}

function novaConversa(id: string, canalId: string, extras: Partial<ConversaNaLista> = {}): ConversaNaLista {
  return {
    id,
    canalId,
    contatoId: CONTATO_ID,
    titulo: `Conversa ${id}`,
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
    contatoNome: "Ana Souza",
    estrela: false,
    naoLidas: 0,
    ultimaRecebidaEm: null,
    ...extras,
  };
}

function novaMensagem(conversaId: string, canalId: string, seq: number, direcao: Mensagem["direcao"], criadoEm: string, conteudo?: string): Mensagem {
  return {
    id: `${conversaId}_m${seq}`,
    conversaId,
    canalId,
    seq,
    direcao,
    ator: direcao === "recebida" ? { tipo: "system", id: "sys" } : { tipo: "member", id: "mem_thiago" },
    delegante: null,
    remetenteParticipanteId: null,
    identificadorId: null,
    remetenteExterno: null,
    conteudo: conteudo ?? `${conversaId} mensagem ${seq}`,
    anexos: [],
    assunto: null,
    enderecosAdicionais: [],
    emRespostaAId: null,
    modeloUsado: null,
    idExterno: null,
    statusEntrega: direcao === "recebida" ? null : "enviada",
    statusEntregaEm: null,
    motivoFalha: null,
    leiturasInternas: [],
    reacoes: [],
    marcacaoExclusao: null,
    edicoesExternas: [],
    anonimizada: false,
    criadoEm,
    registradoEm: criadoEm,
  };
}

function identificador(tipo: IdentificadorDeContato["tipo"]): IdentificadorDeContato {
  return {
    id: `ident_${tipo}`,
    contatoId: CONTATO_ID,
    tipo,
    valor: tipo === "email" ? "ana@exemplo.com" : "5511999990000",
    valorExibido: null,
    rotuloCanal: null,
    verificado: false,
    principal: true,
    criadoEm: "2026-01-01T00:00:00.000Z",
  };
}

function contatoDaApi(): ContatoDetalhado {
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
      qualificacao: null,
      modoCriacao: "manual",
      estado: "ativo",
      mescladoEmId: null,
      mescladoEm: null,
      proprietarioId: "mem_thiago",
      criadoPor: "mem_thiago",
      criadoEm: "2026-01-01T00:00:00.000Z",
      atualizadoEm: "2026-01-01T00:00:00.000Z",
    },
    identificadores: identificadoresDaApi,
    vinculos: [],
  } as ContatoDetalhado;
}

/** Aplica à lista falsa os mesmos filtros que a api aplica, para o teste ler o efeito, não só a URL. */
function filtrarConversas(url: URL): ConversaNaLista[] {
  const p = url.searchParams;
  return conversasDaApi.filter(
    (c) =>
      (p.get("contatoId") === null || c.contatoId === p.get("contatoId")) &&
      (p.get("canalId") === null || c.canalId === p.get("canalId")) &&
      (p.get("estado") === null || c.estado === p.get("estado")),
  );
}

beforeEach(() => {
  estado = buildSeed();
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });

  // Só o WhatsApp: o Canal de e-mail e os demais não alcançam este Contato.
  identificadoresDaApi = [identificador("whatsapp")];
  canaisDaApi = [
    novoCanal("chn_wpp", "Comercial SP", "whatsapp-cloud", "conectada", "2026-01-01T08:00:00.000Z"),
    novoCanal("chn_comercial", "Comercial", "whatsapp-cloud", "conectada", "2026-01-01T09:00:00.000Z"),
    novoCanal("chn_suporte", "Suporte", "whatsapp-nao-oficial", "conectada", "2026-01-02T09:00:00.000Z", { conexaoSimulada: true }),
    novoCanal("chn_desligado", "Desligado", "whatsapp-nao-oficial", "desconectada", "2026-01-03T09:00:00.000Z"),
    novoCanal("chn_mail", "contato@institutoigoralves.com.br", "email-imap-smtp", "conectada", "2026-01-04T09:00:00.000Z"),
  ];
  // A Mensagem recebida mais recente de todas está em "Suporte".
  conversasDaApi = [
    novaConversa("cnv_wpp", "chn_wpp", { ultimaRecebidaEm: "2026-10-09T10:00:00.000Z", atualizadoEm: "2026-10-12T08:00:00.000Z" }),
    novaConversa("cnv_comercial", "chn_comercial", { ultimaRecebidaEm: "2026-10-10T10:00:00.000Z", atualizadoEm: "2026-10-10T10:00:00.000Z" }),
    novaConversa("cnv_suporte", "chn_suporte", { ultimaRecebidaEm: "2026-10-11T09:00:00.000Z", atualizadoEm: "2026-10-11T09:00:00.000Z" }),
  ];
  mensagensDaApi = {
    cnv_wpp: [novaMensagem("cnv_wpp", "chn_wpp", 1, "recebida", "2026-10-09T10:00:00.000Z"), novaMensagem("cnv_wpp", "chn_wpp", 2, "enviada", "2026-10-12T08:00:00.000Z")],
    cnv_comercial: [novaMensagem("cnv_comercial", "chn_comercial", 1, "recebida", "2026-10-10T10:00:00.000Z")],
    cnv_suporte: [
      novaMensagem("cnv_suporte", "chn_suporte", 1, "recebida", "2026-10-11T08:00:00.000Z"),
      novaMensagem("cnv_suporte", "chn_suporte", 2, "recebida", "2026-10-11T09:00:00.000Z"),
    ],
  };

  gravarMensagem = async (corpo) => {
    const lista = mensagensDaApi[corpo.conversaId] ?? [];
    const canalId = conversasDaApi.find((c) => c.id === corpo.conversaId)?.canalId ?? "";
    const nova = novaMensagem(corpo.conversaId, canalId, lista.length + 1, corpo.direcao as Mensagem["direcao"], new Date().toISOString(), corpo.conteudo);
    mensagensDaApi[corpo.conversaId] = [...lista, nova];
    return resposta(201, { ok: true, dados: nova });
  };
  gravarNota = async (corpo) =>
    resposta(201, {
      ok: true,
      dados: { id: "nota_1", contatoId: CONTATO_ID, conteudo: corpo.conteudo, autorId: "mem_thiago", criadoEm: new Date().toISOString() },
    });
  consentimentosDaApi = [];
  abrirNaApi = async (corpo) => {
    const id = `cnv_nova_${conversasDaApi.length}`;
    const conversa = novaConversa(id, corpo.canalId, { atualizadoEm: new Date().toISOString() });
    conversasDaApi = [conversa, ...conversasDaApi];
    const primeira = novaMensagem(id, corpo.canalId, 1, "enviada", new Date().toISOString(), corpo.mensagem.conteudo);
    mensagensDaApi[id] = [primeira];
    const canal = canaisDaApi.find((c) => c.id === corpo.canalId);
    return resposta(201, { ok: true, dados: { conversa, canal, primeiraMensagem: primeira } });
  };
  rotaPadrao = async (url, init) => {
    const alvo = new URL(url);
    const metodo = init?.method ?? "GET";
    if (metodo === "GET" && alvo.pathname === `/contatos/${CONTATO_ID}`) return resposta(200, { ok: true, dados: contatoDaApi() });
    if (metodo === "GET" && alvo.pathname === "/canais") return resposta(200, { ok: true, itens: canaisDaApi, total: canaisDaApi.length });
    if (metodo === "GET" && alvo.pathname === "/conversas") {
      const itens = filtrarConversas(alvo);
      return resposta(200, { ok: true, itens, total: itens.length });
    }
    const daConversa = /^\/conversas\/([^/]+)$/.exec(alvo.pathname);
    if (metodo === "GET" && daConversa) {
      const conversa = conversasDaApi.find((c) => c.id === daConversa[1]);
      if (!conversa) return resposta(404, { ok: false, error: "Conversa não encontrada." });
      return resposta(200, { ok: true, dados: { conversa, canal: canaisDaApi.find((c) => c.id === conversa.canalId) } });
    }
    if (metodo === "GET" && alvo.pathname === "/mensagens") {
      const itens = mensagensDaApi[alvo.searchParams.get("conversaId") ?? ""] ?? [];
      return resposta(200, { ok: true, itens, total: itens.length });
    }
    if (metodo === "GET" && alvo.pathname === "/negocios") return resposta(200, { ok: true, itens: [], total: 0 });
    if (metodo === "GET" && alvo.pathname === `/contatos/${CONTATO_ID}/consentimentos`) {
      return resposta(200, { ok: true, itens: consentimentosDaApi, total: consentimentosDaApi.length });
    }
    if (metodo === "POST" && alvo.pathname === `/contatos/${CONTATO_ID}/notas`) return gravarNota(JSON.parse(String(init?.body)) as { conteudo: string });
    if (metodo === "POST" && alvo.pathname === "/mensagens") return gravarMensagem(JSON.parse(String(init?.body)) as Parameters<typeof gravarMensagem>[0]);
    if (metodo === "POST" && alvo.pathname === "/conversas") return abrirNaApi(JSON.parse(String(init?.body)) as Parameters<typeof abrirNaApi>[0]);
    return resposta(404, { ok: false, error: "sem rota" });
  };
  fetchMock = vi.fn((url: string, init?: RequestInit) => rotaPadrao(url, init));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  criarTarefa.mockReset();
  rehidratar.mockClear();
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

type PropsDoFio = Partial<Parameters<typeof ConversationThread>[0]>;

function montar(props: PropsDoFio = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <RegistrarRevalidacao />
      <StoreProvider sessao={{ memberId: "mem_thiago" }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporteEmMemoria()}>
        <ConversationThread contatoId={CONTATO_ID} {...props} />
      </StoreProvider>
    </SWRConfig>,
  );
}

/** Chamadas à api que gravam (tudo que não é GET). */
function gravacoes(): Array<{ caminho: string; metodo: string; corpo: unknown }> {
  return fetchMock.mock.calls
    .map((c) => ({ caminho: new URL(String(c[0])).pathname, metodo: (c[1] as RequestInit | undefined)?.method ?? "GET", corpo: (c[1] as RequestInit | undefined)?.body }))
    .filter((c) => c.metodo !== "GET")
    .map((c) => ({ ...c, corpo: c.corpo === undefined ? undefined : JSON.parse(String(c.corpo)) }));
}

const abas = () => screen.getAllByRole("tab");
const abaDe = (trecho: string) => {
  const aba = abas().find((a) => a.textContent?.includes(trecho));
  if (!aba) throw new Error(`sem aba com “${trecho}”`);
  return aba;
};
const respondePor = () => screen.getByRole("combobox", { name: "Responder por" });
const compositor = () => screen.getByRole("textbox", { name: /Escrever para|Primeira Mensagem/ });

/** O fio só desenha depois que Contato, Canais, Conversas e Mensagens chegaram. */
async function fioPronto(trecho = "mensagem 0"): Promise<void> {
  await waitFor(() => expect(screen.getAllByText(new RegExp(trecho)).length).toBeGreaterThan(0));
}

describe("ConversationThread — responder numa Conversa aberta grava em plataforma.mensagens", () => {
  it("(1) mostra as duas Mensagens da Conversa em ordem e envia UMA vez por POST /mensagens, sem /operacoes", async () => {
    montar({ conversaId: "cnv_suporte" });
    await waitFor(() => expect(screen.getByText("cnv_suporte mensagem 1")).toBeTruthy());
    const textos = screen.getAllByText(/cnv_suporte mensagem/).map((n) => n.textContent);
    expect(textos).toEqual(["cnv_suporte mensagem 1", "cnv_suporte mensagem 2"]);

    fireEvent.change(compositor(), { target: { value: "olá, pelo Suporte" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(screen.getByText("olá, pelo Suporte")).toBeTruthy());
    expect(gravacoes()).toEqual([
      { caminho: "/mensagens", metodo: "POST", corpo: { conversaId: "cnv_suporte", direcao: "enviada", conteudo: "olá, pelo Suporte" } },
    ]);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/operacoes/"))).toBe(false);
    // O campo esvaziou e o aviso diz o que aconteceu.
    expect((compositor() as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("status").textContent).toContain("Mensagem enviada.");
  });

  it("(2) borda UCR-05: clicar em Enviar duas vezes seguidas manda uma Mensagem só", async () => {
    let solta: (() => void) | undefined;
    const segurada = new Promise<void>((resolve) => {
      solta = resolve;
    });
    const original = gravarMensagem;
    gravarMensagem = async (corpo) => {
      await segurada;
      return original(corpo);
    };
    montar({ conversaId: "cnv_suporte" });
    await fioPronto("cnv_suporte mensagem");
    fireEvent.change(compositor(), { target: { value: "uma só" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const dialogo = await screen.findByRole("alertdialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Enviar" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    await act(async () => {
      solta?.();
      await segurada;
    });
    await waitFor(() => expect(screen.getByText("uma só")).toBeTruthy());
    expect(gravacoes().filter((g) => g.caminho === "/mensagens")).toHaveLength(1);
  });

  it("(3) borda UCR-05: a recusa 409 da api aparece no fio com a frase dela e o texto digitado continua no campo", async () => {
    gravarMensagem = async () =>
      resposta(409, { ok: false, error: "A janela de resposta deste Canal expirou. Só é possível enviar uma Mensagem de modelo aprovada.", codigo: "JANELA_EXPIRADA" });
    montar({ conversaId: "cnv_suporte" });
    await fioPronto("cnv_suporte mensagem");
    fireEvent.change(compositor(), { target: { value: "fora da hora" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("A janela de resposta deste Canal expirou."));
    expect((compositor() as HTMLTextAreaElement).value).toBe("fora da hora");
    // Nada foi gravado: o fio não ganhou a Mensagem.
    expect(within(document.querySelector("[data-fio='mensagens']") as HTMLElement).queryByText("fora da hora")).toBeNull();
  });

  it("(4) o fio não tem Rascunho nem botão de descartar (D-15-11)", async () => {
    montar({ conversaId: "cnv_suporte" });
    await fioPronto("cnv_suporte mensagem");
    expect(screen.queryByRole("button", { name: /Descartar/ })).toBeNull();
    expect(screen.queryByText(/Rascunho/)).toBeNull();
  });

  it("(5) T-15-50: o texto de uma Mensagem recebida é texto, nunca HTML", async () => {
    mensagensDaApi.cnv_suporte = [novaMensagem("cnv_suporte", "chn_suporte", 1, "recebida", "2026-10-11T09:00:00.000Z", "<script>alert(1)</script><img src=x onerror=alert(2)>")];
    montar({ conversaId: "cnv_suporte" });
    await waitFor(() => expect(screen.getByText("<script>alert(1)</script><img src=x onerror=alert(2)>")).toBeTruthy());
    expect(document.querySelector("[data-fio='mensagens'] script")).toBeNull();
    expect(document.querySelector("[data-fio='mensagens'] img")).toBeNull();
  });

  it("(6) a Conversa que o fio segue vem de GET /conversas/:id: o Canal dela decide a aba mesmo sem a lista", async () => {
    // A Conversa pedida não está na lista do Contato (por exemplo, é de um Canal que o Contato não alcança agora).
    conversasDaApi = conversasDaApi.filter((c) => c.id !== "cnv_comercial").concat(novaConversa("cnv_so_por_id", "chn_comercial", { estado: "ativo" }));
    mensagensDaApi.cnv_so_por_id = [novaMensagem("cnv_so_por_id", "chn_comercial", 1, "recebida", "2026-10-13T10:00:00.000Z")];
    montar({ conversaId: "cnv_so_por_id" });
    await waitFor(() => expect(screen.getByText("cnv_so_por_id mensagem 1")).toBeTruthy());
    expect(abaDe("Comercial · WhatsApp oficial").getAttribute("aria-selected")).toBe("true");
  });
});

describe("ConversationThread — o fio por Canal", () => {
  it("(7) uma aba por Canal ativo, com dois WhatsApps; a do Canal de e-mail fica desligada dizendo o que falta", async () => {
    montar();
    await waitFor(() => expect(abas().length).toBeGreaterThan(3));
    expect(abaDe("Comercial · WhatsApp oficial")).toBeTruthy();
    expect(abaDe("Suporte · WhatsApp não oficial")).toBeTruthy();
    expect(abaDe("Comercial SP · WhatsApp oficial")).toBeTruthy();
    expect(abaDe("Comercial · WhatsApp oficial").getAttribute("aria-disabled")).toBe("false");
    expect(abaDe("contato@institutoigoralves.com.br").getAttribute("aria-disabled")).toBe("true");
    expect(abaDe("contato@institutoigoralves.com.br").textContent).toContain("Este Contato não tem E-mail.");
  });

  it("(8) abre na aba do Canal da última recebida e a barra do topo mostra Canal, selo e conexão simulada", async () => {
    montar();
    await fioPronto("cnv_suporte mensagem");
    expect(abaDe("Suporte · WhatsApp não oficial").getAttribute("aria-selected")).toBe("true");
    expect(abaDe("Comercial · WhatsApp oficial").getAttribute("aria-selected")).toBe("false");
    const barra = document.querySelector<HTMLElement>("[data-regra-do-canal]");
    expect(barra).not.toBeNull();
    const dentro = within(barra as HTMLElement);
    expect(dentro.getByText("Suporte")).toBeTruthy();
    expect(dentro.getByText("não oficial")).toBeTruthy();
    expect(dentro.getByText("conexão simulada")).toBeTruthy();
    // A Conversa da aba é a do Canal da aba, não a de outro WhatsApp.
    expect(screen.queryByText("cnv_comercial mensagem 1")).toBeNull();
  });

  it("(9) o “Responder por” vale o Canal da última recebida e só oferece Canais conectados que alcançam o Contato", async () => {
    montar();
    await fioPronto("cnv_suporte mensagem");
    expect(respondePor().textContent).toContain("Suporte · WhatsApp não oficial");
    fireEvent.click(respondePor());
    const opcoes = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(opcoes.some((o) => o.includes("Comercial · WhatsApp oficial"))).toBe(true);
    expect(opcoes.some((o) => o.includes("Comercial SP · WhatsApp oficial"))).toBe(true);
    expect(opcoes.some((o) => o.includes("Suporte · WhatsApp não oficial"))).toBe(true);
    // Desconectado, de outro tipo ou sem Identificador do Contato: não é opção.
    expect(opcoes.some((o) => o.includes("Desligado"))).toBe(false);
    expect(opcoes.some((o) => o.includes("E-mail"))).toBe(false);
    expect(opcoes).toHaveLength(3);
    // A aba do Canal desconectado existe (o Contato o alcança), só não recebe resposta nova.
    expect(abaDe("Desligado · WhatsApp não oficial").getAttribute("aria-disabled")).toBe("false");
  });

  it("(10) trocar o “Responder por” muda a aba para a Conversa que já existe no outro Canal, sem gravar nada", async () => {
    montar();
    await fioPronto("cnv_suporte mensagem");
    fireEvent.click(respondePor());
    const opcao = screen.getAllByRole("option").find((o) => o.textContent === "Comercial · WhatsApp oficial");
    expect(opcao).toBeTruthy();
    fireEvent.click(opcao as HTMLElement);

    await waitFor(() => expect(abaDe("Comercial · WhatsApp oficial").getAttribute("aria-selected")).toBe("true"));
    expect(abaDe("Suporte · WhatsApp não oficial").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain("Respondendo por Comercial · WhatsApp oficial.");
    // O fio passou a mostrar a Conversa de “Comercial”.
    await waitFor(() => expect(screen.getByText("cnv_comercial mensagem 1")).toBeTruthy());
    // INV-CXE-04: trocar de aba não move nem cria Conversa.
    expect(gravacoes()).toEqual([]);
  });

  it("(11) numa aba por Canal a sequência é de um Canal só: nenhum separador “via …” no fio", async () => {
    montar();
    await fioPronto("cnv_suporte mensagem");
    const separadoresVia = screen.queryAllByRole("separator").filter((s) => s.textContent?.startsWith("via "));
    expect(separadoresVia).toHaveLength(0);
  });

  it("(12) a Mensagem sai pela Conversa do Canal da aba, não pela de outro WhatsApp", async () => {
    montar({ canalPreferidoId: "chn_comercial" });
    await waitFor(() => expect(screen.getByText("cnv_comercial mensagem 1")).toBeTruthy());
    // Canal oficial e recebida há mais de 24 h: a janela fechou e só Mensagem de modelo sairia.
    fireEvent.change(compositor(), { target: { value: "fora da janela" } });
    expect(screen.getByRole("button", { name: "Enviar" }).getAttribute("aria-disabled")).toBe("true");
    expect(document.querySelector("[data-regra-do-canal]")?.textContent).toContain("janela expirada");

    // No Suporte (não oficial) não há janela: a Mensagem sai pela Conversa dele.
    fireEvent.click(abaDe("Suporte · WhatsApp não oficial"));
    await waitFor(() => expect(screen.getByText("cnv_suporte mensagem 1")).toBeTruthy());
    fireEvent.change(compositor(), { target: { value: "olá, pelo Suporte" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const dialogo = await screen.findByRole("alertdialog");
    // O diálogo de confirmação diz por qual Canal a Mensagem sai.
    expect(dialogo.textContent).toContain("Suporte · WhatsApp não oficial");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(gravacoes()).toHaveLength(1));
    expect(gravacoes()[0]?.corpo).toMatchObject({ conversaId: "cnv_suporte", conteudo: "olá, pelo Suporte" });
  });

  it("(13) o Contato que nenhum Canal do Espaço alcança vê a frase do que falta", async () => {
    identificadoresDaApi = [identificador("telefone")];
    montar();
    await waitFor(() => expect(screen.getByText("Nenhum Canal deste Espaço alcança este Contato.")).toBeTruthy());
  });

  it("(14) um Contato que a api não conhece (404) não abre fio", async () => {
    rotaPadrao = async () => resposta(404, { ok: false, error: "Contato não encontrado." });
    montar();
    await waitFor(() => expect(screen.getByText("Contato não encontrado.")).toBeTruthy());
  });
});

describe("ConversationThread — abrir a Conversa pelo fio com a primeira Mensagem (F14-D-07)", () => {
  /** O Contato nunca falou em "Comercial": o Canal alcança, mas não há Conversa nele. */
  function semConversaEmComercial() {
    conversasDaApi = conversasDaApi.filter((c) => c.id !== "cnv_comercial");
    delete mensagensDaApi.cnv_comercial;
  }

  async function irParaComercial() {
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Responder por" })).toBeTruthy());
    fireEvent.click(respondePor());
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === "Comercial · WhatsApp oficial") as HTMLElement);
    await waitFor(() => expect(abaDe("Comercial · WhatsApp oficial").getAttribute("aria-selected")).toBe("true"));
  }

  async function enviarPeloFio(texto: string) {
    fireEvent.change(compositor(), { target: { value: texto } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar" }));
  }

  it("(17) sem Conversa no Canal escolhido o fio pede a “Primeira Mensagem”; Enviar chama POST /conversas e passa a mostrar a Conversa criada", async () => {
    semConversaEmComercial();
    const aberta = vi.fn();
    montar({ onConversaAberta: aberta });
    await irParaComercial();
    expect(screen.getByRole("textbox", { name: "Primeira Mensagem" })).toBeTruthy();
    expect(screen.getByText("Nenhuma Conversa em Comercial · WhatsApp oficial.")).toBeTruthy();

    await enviarPeloFio("oi, aqui é do Comercial");

    await waitFor(() => expect(screen.getByText("oi, aqui é do Comercial")).toBeTruthy());
    expect(gravacoes()).toEqual([
      { caminho: "/conversas", metodo: "POST", corpo: { canalId: "chn_comercial", contatoId: CONTATO_ID, mensagem: { conteudo: "oi, aqui é do Comercial" } } },
    ]);
    expect(aberta).toHaveBeenCalledTimes(1);
    expect(aberta.mock.calls[0]?.[0]).toMatch(/^cnv_nova_/);
    // Depois da primeira, o campo volta a ser o de responder.
    expect(screen.getByRole("textbox", { name: /Escrever para/ })).toBeTruthy();
  });

  it("(18) com Conversa já aberta no par o fio a reaproveita: a Mensagem vai por POST /mensagens e nenhuma Conversa nasce", async () => {
    // A recebida de há uma hora: a janela de 24 h do Comercial (oficial) está aberta.
    conversasDaApi = conversasDaApi.map((c) => (c.id === "cnv_comercial" ? { ...c, ultimaRecebidaEm: new Date(Date.now() - 3_600_000).toISOString() } : c));
    montar();
    await irParaComercial();
    await waitFor(() => expect(screen.getByText("cnv_comercial mensagem 1")).toBeTruthy());
    expect(screen.queryByRole("textbox", { name: "Primeira Mensagem" })).toBeNull();
    expect(screen.queryByText(/Nenhuma Conversa em/)).toBeNull();

    await enviarPeloFio("na Conversa que já existe");

    await waitFor(() => expect(screen.getByText("na Conversa que já existe")).toBeTruthy());
    expect(gravacoes()).toEqual([
      { caminho: "/mensagens", metodo: "POST", corpo: { conversaId: "cnv_comercial", direcao: "enviada", conteudo: "na Conversa que já existe" } },
    ]);
  });

  it("(19) borda UCR-05: duas vezes Enviar na primeira Mensagem abre uma Conversa só", async () => {
    semConversaEmComercial();
    let solta: (() => void) | undefined;
    const segurada = new Promise<void>((resolve) => {
      solta = resolve;
    });
    const original = abrirNaApi;
    abrirNaApi = async (corpo) => {
      await segurada;
      return original(corpo);
    };
    montar();
    await irParaComercial();
    fireEvent.change(compositor(), { target: { value: "uma só" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const dialogo = await screen.findByRole("alertdialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Enviar" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    await act(async () => {
      solta?.();
      await segurada;
    });
    await waitFor(() => expect(screen.getByText("uma só")).toBeTruthy());
    expect(gravacoes().filter((g) => g.caminho === "/conversas")).toHaveLength(1);
  });

  it("(20) a recusa da api ao abrir a Conversa aparece no fio, o texto fica no campo e nenhuma Conversa passa a existir", async () => {
    semConversaEmComercial();
    abrirNaApi = async () => resposta(409, { ok: false, error: "Já existe uma Conversa aberta deste Contato neste Canal.", codigo: "CONVERSA_ABERTA_NO_PAR" });
    const aberta = vi.fn();
    montar({ onConversaAberta: aberta });
    await irParaComercial();
    await enviarPeloFio("tentativa");

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Já existe uma Conversa aberta deste Contato neste Canal."));
    expect((screen.getByRole("textbox", { name: "Primeira Mensagem" }) as HTMLTextAreaElement).value).toBe("tentativa");
    expect(aberta).not.toHaveBeenCalled();
    expect(screen.getByText("Nenhuma Conversa em Comercial · WhatsApp oficial.")).toBeTruthy();
  });
});

describe("ConversationThread — Criar Tarefa numa Lista conversacional (14-16)", () => {
  async function criarPeloFio() {
    montar({ canalSelecionado: "chn_wpp" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Tarefa" })).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: "Tarefa" }));
    fireEvent.change(screen.getByLabelText("Título da Tarefa"), { target: { value: "Retomar a matrícula" } });
    fireEvent.click(document.getElementById("lista-da-tarefa") as HTMLElement);
    fireEvent.click(screen.getByRole("option", { name: /Pós-venda/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar Tarefa" }));
  }

  it("(15) chama a rota com o Contato e o Canal da aba, sem Mensagem, e re-hidrata depois", async () => {
    criarTarefa.mockResolvedValue({ task: { id: "t_9", title: "Retomar a matrícula" }, conversa: { id: "cv_9", aberta: false } });
    await criarPeloFio();
    await waitFor(() => expect(screen.getByText("Tarefa criada com o Contato e atribuída a você.")).toBeTruthy());
    expect(criarTarefa).toHaveBeenCalledTimes(1);
    // O Tipo da Tarefa vem do seletor (o padrão da Lista); a Mensagem não vai: a Conversa do fio já está aberta.
    expect(criarTarefa.mock.calls[0]?.[0]).toMatchObject({
      listId: POS_VENDA_LIST_ID,
      contatoId: CONTATO_ID,
      canalId: "chn_wpp",
      title: "Retomar a matrícula",
    });
    expect(criarTarefa.mock.calls[0]?.[0]).not.toHaveProperty("mensagem");
    expect(rehidratar).toHaveBeenCalledTimes(1);
  });

  it("(16) a recusa da api (por exemplo, pedir a primeira Mensagem) aparece no fio e nada é re-hidratado", async () => {
    criarTarefa.mockRejectedValue(new ErroDeApi(400, "Escreva a primeira Mensagem.", { codigo: "VALOR_INVALIDO", campo: "mensagem" }));
    await criarPeloFio();
    await waitFor(() => expect(screen.getByText("Escreva a primeira Mensagem.")).toBeTruthy());
    expect(rehidratar).not.toHaveBeenCalled();
  });
});

describe("ConversationThread — Nota interna grava em contato_notas (15-25, 3.4.2 / 3.2.7)", () => {
  async function abrirNota() {
    montar({ canalSelecionado: "chn_wpp" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Nota interna" })).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: "Nota interna" }));
  }
  const campoDaNota = () => screen.getByLabelText("Nota interna") as HTMLTextAreaElement;
  const registrar = () => screen.getByRole("button", { name: "Registrar nota" });

  it("(21) registrar a nota chama POST /contatos/:id/notas uma vez, sem operação do store, e esvazia o campo", async () => {
    await abrirNota();
    fireEvent.change(campoDaNota(), { target: { value: "  Pediu retorno na sexta.  " } });
    fireEvent.click(registrar());

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Nota registrada no Contato."));
    // O texto sai aparado, como o domínio o aparou (`validarNovaNota`).
    expect(gravacoes()).toEqual([{ caminho: `/contatos/${CONTATO_ID}/notas`, metodo: "POST", corpo: { conteudo: "Pediu retorno na sexta." } }]);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/operacoes/"))).toBe(false);
    expect(campoDaNota().value).toBe("");
  });

  it("(22) borda UCR-05: duplo clique em Registrar nota grava uma nota só", async () => {
    let solta: (() => void) | undefined;
    const segurada = new Promise<void>((resolve) => {
      solta = resolve;
    });
    const original = gravarNota;
    gravarNota = async (corpo) => {
      await segurada;
      return original(corpo);
    };
    await abrirNota();
    fireEvent.change(campoDaNota(), { target: { value: "uma só" } });
    const botao = registrar();
    fireEvent.click(botao);
    fireEvent.click(botao);
    fireEvent.submit(botao.closest("form") as HTMLFormElement);
    await act(async () => {
      solta?.();
      await segurada;
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Nota registrada no Contato."));
    expect(gravacoes().filter((g) => g.caminho === `/contatos/${CONTATO_ID}/notas`)).toHaveLength(1);
  });

  it("(23) borda UCR-05: nota só com espaços não chega à api e mostra a frase da regra do domínio", async () => {
    await abrirNota();
    fireEvent.change(campoDaNota(), { target: { value: "   \n  " } });
    // O botão já vem desligado; o envio do formulário (Enter num leitor de tela, por exemplo) cai na mesma regra.
    fireEvent.submit(registrar().closest("form") as HTMLFormElement);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Escreva a nota antes de salvar."));
    expect(gravacoes()).toEqual([]);
  });

  it("(24) a recusa da api aparece no fio, a nota continua no campo e nada é dado por registrado", async () => {
    gravarNota = async () => resposta(409, { ok: false, error: "Um Contato mesclado é somente leitura. Escreva a nota no Contato que ficou.", codigo: "CONTATO_MESCLADO" });
    await abrirNota();
    fireEvent.change(campoDaNota(), { target: { value: "vai ser recusada" } });
    fireEvent.click(registrar());

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Um Contato mesclado é somente leitura."));
    expect(campoDaNota().value).toBe("vai ser recusada");
    expect(screen.queryByText("Nota registrada no Contato.")).toBeNull();
  });
});

describe("ConversationThread — o aviso de consentimento de marketing pela regra do CRM novo (15-25, 3.4.2)", () => {
  const AVISO = /não tem consentimento vigente para marketing neste Canal/;
  const MARKETING_ID = "cat_fin_mkt";

  function consentimento(extras: Partial<ConsentimentoDoContato>): ConsentimentoDoContato {
    return {
      id: `cns_${Math.random().toString(36).slice(2, 8)}`,
      contatoId: CONTATO_ID,
      finalidadeId: MARKETING_ID,
      tipoDeCanal: "whatsapp",
      decisao: "concedido",
      em: "2026-09-01T10:00:00.000Z",
      origem: "formulario",
      evidenciaMensagemId: null,
      registradoPor: "mem_thiago",
      registradoEm: "2026-09-01T10:00:00.000Z",
      ...extras,
    };
  }

  /** O fio na aba do Suporte (WhatsApp), pronto, com os consentimentos já lidos. */
  async function fioDoSuporte() {
    montar({ canalSelecionado: "chn_suporte" });
    await fioPronto("cnv_suporte mensagem");
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/consentimentos"))).toBe(true));
  }

  it("(25) consentimento de marketing revogado no tipo do Canal da aba: o aviso aparece, lido de GET /contatos/:id/consentimentos", async () => {
    consentimentosDaApi = [
      consentimento({ decisao: "concedido", em: "2026-08-01T10:00:00.000Z" }),
      consentimento({ decisao: "revogado", em: "2026-09-15T10:00:00.000Z", registradoEm: "2026-09-15T10:00:00.000Z" }),
    ];
    await fioDoSuporte();
    await waitFor(() => expect(screen.getByText(AVISO)).toBeTruthy());
    // É aviso, não bloqueio: o texto livre dentro da janela continua saindo (marketing é só o modelo).
    fireEvent.change(compositor(), { target: { value: "oi" } });
    expect(screen.getByRole("button", { name: "Enviar" }).getAttribute("aria-disabled")).not.toBe("true");
  });

  it("(26) consentimento concedido (do tipo do Canal ou de “todos”): o aviso não aparece", async () => {
    consentimentosDaApi = [consentimento({ tipoDeCanal: "todos", decisao: "concedido" })];
    await fioDoSuporte();
    // Dá um instante para o aviso aparecer, se fosse aparecer, depois de a leitura chegar.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it("(27) sem registro nenhum vale a regra de antes: sem consentimento vigente, o aviso aparece", async () => {
    consentimentosDaApi = [];
    await fioDoSuporte();
    await waitFor(() => expect(screen.getByText(AVISO)).toBeTruthy());
  });

  it("(28) a revogação de OUTRO tipo de Canal não pesa neste: concedido no WhatsApp, revogado no Instagram, sem aviso na aba do WhatsApp", async () => {
    consentimentosDaApi = [
      consentimento({ tipoDeCanal: "whatsapp", decisao: "concedido", em: "2026-08-01T10:00:00.000Z" }),
      consentimento({ tipoDeCanal: "instagram", decisao: "revogado", em: "2026-09-15T10:00:00.000Z" }),
    ];
    await fioDoSuporte();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it("(29) enquanto a leitura dos consentimentos não chegou (ou falhou) o fio não inventa aviso", async () => {
    const padrao = rotaPadrao;
    rotaPadrao = async (url, init) => {
      if (new URL(url).pathname.endsWith("/consentimentos")) return resposta(500, { ok: false, error: "falhou" });
      return padrao(url, init);
    };
    montar({ canalSelecionado: "chn_suporte" });
    await fioPronto("cnv_suporte mensagem");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.queryByText(AVISO)).toBeNull();
  });
});

describe("ConversationThread — o estado de entrega de cada Mensagem enviada (16-11, 3.7.3)", () => {
  it("(30) a Mensagem enviada mostra o estado em palavras de produto, e a recebida e a interna não mostram nenhum", async () => {
    const [recebida, enviada] = mensagensDaApi.cnv_wpp as [Mensagem, Mensagem];
    mensagensDaApi.cnv_wpp = [recebida, { ...enviada, statusEntrega: "lida" }, { ...novaMensagem("cnv_wpp", "chn_wpp", 3, "interna", "2026-10-12T09:00:00.000Z"), statusEntrega: null }];
    montar({ conversaId: "cnv_wpp" });
    await fioPronto("cnv_wpp mensagem");
    const fio = within(document.querySelector("[data-fio='mensagens']") as HTMLElement);
    expect(fio.getAllByText("Lida")).toHaveLength(1);
    expect(fio.queryByText(/· lida/)).toBeNull();
  });

  it("(31) a que falhou mostra o motivo; Tentar de novo chama POST /mensagens/:id/reenviar e o fio passa a dizer Enviando…", async () => {
    const [recebida, enviada] = mensagensDaApi.cnv_wpp as [Mensagem, Mensagem];
    mensagensDaApi.cnv_wpp = [recebida, { ...enviada, statusEntrega: "falhou", motivoFalha: "Este número não tem WhatsApp." }];
    const padrao = rotaPadrao;
    rotaPadrao = async (url, init) => {
      if ((init?.method ?? "GET") === "POST" && new URL(url).pathname === `/mensagens/${enviada.id}/reenviar`) {
        mensagensDaApi.cnv_wpp = [recebida, { ...enviada, statusEntrega: "pendente", motivoFalha: null }];
        return resposta(200, { ok: true, dados: { ...enviada, statusEntrega: "pendente", motivoFalha: null } });
      }
      return padrao(url, init);
    };
    montar({ conversaId: "cnv_wpp" });
    await fioPronto("cnv_wpp mensagem");
    expect(screen.getByText("Não enviada")).toBeTruthy();
    expect(screen.getByText("Este número não tem WhatsApp.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => expect(screen.queryByText("Não enviada")).toBeNull());
    expect(gravacoes()).toEqual([{ caminho: `/mensagens/${enviada.id}/reenviar`, metodo: "POST", corpo: undefined }]);
    expect(screen.getByText("Enviando…")).toBeTruthy();
  });
});

describe("ConversationThread — os anexos no fio (16-11, 3.9.5)", () => {
  const anexoDeVoz = { tipoDeMidia: "audio/ogg", nome: "voz.ogg", objectKey: "workspace/ws/voz.ogg", tamanhoBytes: 2048, baixado: true } as const;

  function comAnexos(anexos: Mensagem["anexos"], conteudo: string | null) {
    const [recebida] = mensagensDaApi.cnv_suporte as [Mensagem];
    mensagensDaApi.cnv_suporte = [{ ...recebida, anexos, conteudo }];
    const padrao = rotaPadrao;
    rotaPadrao = async (url, init) => {
      if (/^\/mensagens\/[^/]+\/anexos\/\d+$/.test(new URL(url).pathname)) {
        return resposta(200, { ok: true, dados: { url: "https://armazem.test/voz?assinatura=1", expiraEm: "2026-11-09T20:05:00.000Z" } });
      }
      return padrao(url, init);
    };
  }

  it("(32) a Mensagem recebida com áudio mostra o player com a URL de GET /mensagens/:id/anexos/0, e a legenda como texto", async () => {
    comAnexos([anexoDeVoz], "ouça isto");
    montar({ conversaId: "cnv_suporte" });
    await waitFor(() => expect(document.querySelector("[data-fio='mensagens'] audio")).not.toBeNull());
    const audio = document.querySelector("[data-fio='mensagens'] audio") as HTMLAudioElement;
    expect(audio.getAttribute("src")).toBe("https://armazem.test/voz?assinatura=1");
    expect(screen.getByText("ouça isto")).toBeTruthy();
    expect(fetchMock.mock.calls.some((c) => String(c[0]) === `http://api/mensagens/cnv_suporte_m1/anexos/0`)).toBe(true);
  });

  it("(33) anexo que o provedor não entregou aparece como indisponível, sem sumir da Mensagem", async () => {
    comAnexos([{ tipoDeMidia: "image/jpeg", nome: "foto.jpg", referenciaExterna: "wamid-1", baixado: false }], null);
    montar({ conversaId: "cnv_suporte" });
    await waitFor(() => expect(screen.getByText("Arquivo indisponível: o provedor não entregou este arquivo.")).toBeTruthy());
    expect(fetchMock.mock.calls.some((c) => /\/anexos\/\d+$/.test(String(c[0])))).toBe(false);
  });
});
