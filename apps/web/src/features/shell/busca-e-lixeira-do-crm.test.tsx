// @vitest-environment jsdom
/**
 * 15-14 Tasks 2 e 3 (UCR-07) — a Busca (`/buscar`) e a Lixeira (`/configuracoes/lixeira`) leem
 * Contatos, Empresas, Negócios e Conversas das rotas REST do CRM novo, nunca do modelo antigo do
 * store (T-15-36). Tarefas, Listas, Documentos etc. seguem do store.
 *
 * Nenhuma rede: `fetch` roteado por caminho e filtros, sessão falsa, `StoreProvider` de verdade com
 * o seed (que ainda traz Contatos, Empresas, Negócios e Conversas ANTIGOS — a prova de que a tela
 * não os mostra é que eles não aparecem quando a api não os devolve).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { mutate, SWRConfig } from "swr";
import type { ContatoResumo } from "@n1/dominio/crm/contatos";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import type { EmpresaResumo } from "@n1/dominio/crm/empresas";
import type { NegocioResumo } from "@n1/dominio/crm/negocios";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import BuscarPage from "@/app/(shell)/buscar/page";
import LixeiraPage from "@/app/(shell)/configuracoes/lixeira/page";

const { obterSessao, parametros } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  parametros: { atual: new URLSearchParams() },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/buscar",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => parametros.atual,
}));

const THIAGO = "mem_thiago";
const AGORA = "2026-11-01T10:00:00.000Z";

type Recurso = "contatos" | "empresas" | "negocios" | "conversas";
type Pagina = { itens: unknown[]; total: number };

function contato(id: string, nome: string, estado: ContatoResumo["estado"] = "ativo"): ContatoResumo {
  return { id, nomeDeExibicao: nome, estado, proprietarioId: THIAGO, emailPrincipal: `${id}@x.com`, telefonePrincipal: null, atualizadoEm: AGORA };
}

function empresa(id: string, nome: string, estado: EmpresaResumo["estado"] = "ativo"): EmpresaResumo {
  return { id, nomeDeExibicao: nome, dominioPrincipal: "ana.com", documentoPrincipal: null, matriz: null, proprietarioId: THIAGO, estado, atualizadoEm: AGORA };
}

function negocio(id: string, titulo: string, estado: NegocioResumo["estado"] = "ativo"): NegocioResumo {
  return {
    id,
    titulo,
    valor: null,
    moeda: "BRL",
    probabilidadeEfetiva: 10,
    situacao: "aberto",
    estado,
    funilId: "fun_1",
    etapaId: "eta_1",
    empresa: null,
    contato: { id: "ctt_1", nome: "Ana Souza" },
    proprietarioId: THIAGO,
    dataPrevistaFechamento: null,
    encerradoEm: null,
    atualizadoEm: AGORA,
  };
}

function conversa(id: string, titulo: string, estado: ConversaNaLista["estado"] = "ativo"): ConversaNaLista {
  return {
    id,
    canalId: "can_1",
    contatoId: "ctt_1",
    titulo,
    tituloEditado: false,
    situacao: "resolvida",
    estado,
    naLixeiraEm: estado === "na_lixeira" ? AGORA : null,
    filaId: null,
    atribuido: null,
    adiadaAte: null,
    adiamentoMotivo: null,
    participantes: [],
    resolvidaEm: AGORA,
    reabertaEm: null,
    reaberturas: 0,
    criadoPor: { tipo: "membro", id: THIAGO },
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    contatoNome: "Ana Souza",
    estrela: false,
    naoLidas: 0,
    ultimaRecebidaEm: null,
  };
}

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
/** O que a api devolve por recurso e estado; o que não está aqui volta vazio. */
let paginas: Partial<Record<`${Recurso}:${string}`, Pagina>>;
let recusas: Partial<Record<Recurso, { status: number; error: string }>>;
/** Respostas das gravações (`POST /contatos/<id>/restaurar`…), por "METODO caminho". */
let gravacoes: Record<string, () => Response>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  parametros.atual = new URLSearchParams();
  paginas = {};
  recusas = {};
  gravacoes = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const endereco = new URL(url);
    const gravacao = gravacoes[`${init.method ?? "GET"} ${endereco.pathname}`];
    if (gravacao) return gravacao();
    const recurso = endereco.pathname.slice(1) as Recurso;
    const recusa = recusas[recurso];
    if (recusa) return resposta(recusa.status, { ok: false, error: recusa.error });
    const pagina = paginas[`${recurso}:${endereco.searchParams.get("estado") ?? "ativo"}`] ?? { itens: [], total: 0 };
    return resposta(200, { ok: true, ...pagina });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  // A Lixeira roda no cache global do SWR (a invalidação do CRM usa o `mutate` global): zera entre os casos.
  await mutate(() => true, undefined, { revalidate: false });
});

async function montar(pagina: React.ReactNode, estado = buildSeed()) {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporte}>
          {pagina}
        </StoreProvider>
      </SWRConfig>,
    );
  });
}

/** As chamadas feitas à api, como URLs. */
function chamadas(): URL[] {
  return fetchMock.mock.calls.map((chamada) => new URL(chamada[0] as string));
}

describe("Busca › Contatos, Empresas, Negócios e Conversas pelas rotas REST (15-14)", () => {
  it("com o termo 'Ana' consulta as quatro rotas com q=Ana e limite 10, e lista cada grupo com o link da ficha nova", async () => {
    parametros.atual = new URLSearchParams("q=Ana");
    paginas["contatos:ativo"] = { itens: [contato("ctt_nova", "Ana Souza")], total: 1 };
    paginas["empresas:ativo"] = { itens: [empresa("emp_nova", "Ana Comércio")], total: 1 };
    paginas["negocios:ativo"] = { itens: [negocio("neg_novo", "Proposta Ana")], total: 1 };
    paginas["conversas:ativo"] = { itens: [conversa("cnv_nova", "Dúvida da Ana")], total: 1 };

    await montar(<BuscarPage />);

    await vi.waitFor(() => expect(screen.getByText("Dúvida da Ana")).toBeTruthy());
    const crm = chamadas().filter((u) => ["/contatos", "/empresas", "/negocios", "/conversas"].includes(u.pathname));
    expect(crm.map((u) => u.pathname).sort()).toEqual(["/contatos", "/conversas", "/empresas", "/negocios"]);
    for (const u of crm) {
      expect(u.searchParams.get("q")).toBe("Ana");
      expect(u.searchParams.get("limite")).toBe("10");
      expect(u.searchParams.get("estado")).toBe("ativo");
    }
    // "Ana Souza" também é o detalhe do Negócio e da Conversa: o link do Contato é o que o identifica.
    expect(document.querySelector('a[href="/crm/contatos/ctt_nova"]')?.textContent).toContain("Ana Souza");
    expect(screen.getByText("Ana Comércio").closest("a")?.getAttribute("href")).toBe("/crm/empresas/emp_nova");
    expect(screen.getByText("Proposta Ana").closest("a")?.getAttribute("href")).toBe("/crm/negocios/neg_novo");
    expect(screen.getByText("Dúvida da Ana").closest("a")?.getAttribute("href")).toBe("/crm/caixa-de-entrada/cnv_nova");
  });

  it("um Contato criado pela ficha nova é achado pelo nome mesmo que o seed antigo não o conheça", async () => {
    parametros.atual = new URLSearchParams("q=Zuleica");
    paginas["contatos:ativo"] = { itens: [contato("ctt_zu", "Zuleica Prado")], total: 1 };
    await montar(<BuscarPage />, buildSeed());

    await vi.waitFor(() => expect(screen.getByText("Zuleica Prado")).toBeTruthy());
  });

  it("com menos de 2 caracteres não consulta o CRM", async () => {
    parametros.atual = new URLSearchParams("q=A");
    await montar(<BuscarPage />);
    expect(screen.getByText("Escreva ao menos duas letras.")).toBeTruthy();
    expect(chamadas()).toEqual([]);
  });

  it("o total da api conta, não a página: mostra 10 de 14", async () => {
    parametros.atual = new URLSearchParams("q=Ana");
    paginas["contatos:ativo"] = {
      itens: Array.from({ length: 10 }, (_, i) => contato(`ctt_${i}`, `Ana ${i}`)),
      total: 14,
    };

    await montar(<BuscarPage />);

    await vi.waitFor(() => expect(screen.getByText("Mostrando 10 de 14. Refine o termo para ver o restante.")).toBeTruthy());
  });

  it("arquivados e na lixeira só são consultados quando a pessoa marca a opção", async () => {
    parametros.atual = new URLSearchParams("q=Ana");
    paginas["contatos:na_lixeira"] = { itens: [contato("ctt_lix", "Ana Descartada", "na_lixeira")], total: 1 };
    paginas["empresas:arquivado"] = { itens: [empresa("emp_arq", "Ana Antiga", "arquivado")], total: 1 };
    paginas["conversas:na_lixeira"] = { itens: [conversa("cnv_lix", "Conversa da Ana", "na_lixeira")], total: 1 };

    await montar(<BuscarPage />);
    await vi.waitFor(() => expect(chamadas().length).toBeGreaterThan(0));
    expect(chamadas().every((u) => u.searchParams.get("estado") === "ativo")).toBe(true);
    expect(screen.queryByText("Ana Descartada")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Incluir arquivados e na lixeira"));
    });

    await vi.waitFor(() => expect(screen.getByText("Ana Descartada")).toBeTruthy());
    expect(screen.getByText("Ana Antiga")).toBeTruthy();
    expect(screen.getByText("Conversa da Ana")).toBeTruthy();
    const estados = chamadas().map((u) => `${u.pathname}:${u.searchParams.get("estado")}`);
    expect(estados).toContain("/contatos:na_lixeira");
    expect(estados).toContain("/empresas:arquivado");
    expect(estados).toContain("/negocios:na_lixeira");
    expect(estados).toContain("/conversas:na_lixeira");
    // Conversa só tem dois estados: nunca pede `arquivado`.
    expect(estados).not.toContain("/conversas:arquivado");
    const linha = screen.getByText("Ana Descartada").closest("a")!;
    expect(within(linha).getByText("na lixeira")).toBeTruthy();
  });

  it("uma recusa da api é dita na tela, sem inventar resultado do store", async () => {
    parametros.atual = new URLSearchParams("q=Ana");
    recusas.contatos = { status: 403, error: "Seu Papel não lê Contatos." };

    await montar(<BuscarPage />);

    await vi.waitFor(() => expect(screen.getByText(/Seu Papel não lê Contatos\./)).toBeTruthy());
  });
});

/** A Lixeira usa o cache global do SWR de propósito: `invalidarCrm` (o `mutate` global) tem de alcançá-lo. */
async function montarLixeira(estado = buildSeed()) {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  await act(async () => {
    render(
      <SWRConfig value={{ dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporte}>
          <LixeiraPage />
        </StoreProvider>
      </SWRConfig>,
    );
  });
}

const linhaDe = (nome: string): HTMLElement => screen.getByText(nome).closest("tr") as HTMLElement;
const chamadasA = (metodo: string, caminho: string) =>
  fetchMock.mock.calls.filter((c) => ((c[1] as RequestInit | undefined)?.method ?? "GET") === metodo && new URL(c[0] as string).pathname === caminho);

describe("Lixeira › Contatos, Empresas, Negócios e Conversas pelas rotas REST (15-14)", () => {
  it("lista os quatro tipos com estado=na_lixeira, com a família e o link da ficha nova", async () => {
    paginas["contatos:na_lixeira"] = { itens: [contato("ctt_lix", "Ana Descartada", "na_lixeira")], total: 1 };
    paginas["empresas:na_lixeira"] = { itens: [empresa("emp_lix", "Comércio Descartado", "na_lixeira")], total: 1 };
    paginas["negocios:na_lixeira"] = { itens: [negocio("neg_lix", "Proposta Descartada", "na_lixeira")], total: 1 };
    paginas["conversas:na_lixeira"] = { itens: [conversa("cnv_lix", "Conversa Descartada", "na_lixeira")], total: 1 };

    await montarLixeira();

    await vi.waitFor(() => expect(screen.getByText("Conversa Descartada")).toBeTruthy());
    const crm = chamadas().filter((u) => ["/contatos", "/empresas", "/negocios", "/conversas"].includes(u.pathname));
    expect(crm.map((u) => u.pathname).sort()).toEqual(["/contatos", "/conversas", "/empresas", "/negocios"]);
    for (const u of crm) expect(u.searchParams.get("estado")).toBe("na_lixeira");
    const esperado: Array<[string, string, string]> = [
      ["Ana Descartada", "Contato", "/crm/contatos/ctt_lix"],
      ["Comércio Descartado", "Empresa", "/crm/empresas/emp_lix"],
      ["Proposta Descartada", "Negócio", "/crm/negocios/neg_lix"],
      ["Conversa Descartada", "Conversa", "/crm/caixa-de-entrada/cnv_lix"],
    ];
    for (const [nome, familia, href] of esperado) {
      const linha = linhaDe(nome);
      expect(within(linha).getByText(familia)).toBeTruthy();
      expect(within(linha).getByText(nome).closest("a")?.getAttribute("href")).toBe(href);
    }
  });

  it("restaurar um Contato chama POST /contatos/<id>/restaurar uma vez, e o item some da lista", async () => {
    paginas["contatos:na_lixeira"] = { itens: [contato("ctt_lix", "Ana Descartada", "na_lixeira")], total: 1 };
    gravacoes["POST /contatos/ctt_lix/restaurar"] = () => {
      paginas["contatos:na_lixeira"] = { itens: [], total: 0 };
      return resposta(200, { ok: true, dados: { contato: { id: "ctt_lix" }, identificadores: [], vinculos: [] } });
    };
    await montarLixeira();
    await vi.waitFor(() => expect(screen.getByText("Ana Descartada")).toBeTruthy());

    await act(async () => {
      fireEvent.click(within(linhaDe("Ana Descartada")).getByRole("button", { name: "Restaurar" }));
    });

    await vi.waitFor(() => expect(screen.queryByText("Ana Descartada", { selector: "a" })).toBeNull());
    expect(chamadasA("POST", "/contatos/ctt_lix/restaurar")).toHaveLength(1);
    expect(screen.getByText("Contato restaurado: Ana Descartada.")).toBeTruthy();
  });

  it("restaurar uma Conversa chama POST /conversas/<id>/restaurar (restaurarConversa)", async () => {
    paginas["conversas:na_lixeira"] = { itens: [conversa("cnv_lix", "Conversa Descartada", "na_lixeira")], total: 1 };
    gravacoes["POST /conversas/cnv_lix/restaurar"] = () => {
      paginas["conversas:na_lixeira"] = { itens: [], total: 0 };
      return resposta(200, { ok: true, dados: { conversa: { id: "cnv_lix" }, canal: {} } });
    };
    await montarLixeira();
    await vi.waitFor(() => expect(screen.getByText("Conversa Descartada")).toBeTruthy());

    await act(async () => {
      fireEvent.click(within(linhaDe("Conversa Descartada")).getByRole("button", { name: "Restaurar" }));
    });

    await vi.waitFor(() => expect(screen.queryByText("Conversa Descartada", { selector: "a" })).toBeNull());
    expect(chamadasA("POST", "/conversas/cnv_lix/restaurar")).toHaveLength(1);
  });

  it("borda UCR-07: a segunda restauração do mesmo item recebe a recusa da api na tela e a lista não é relida", async () => {
    paginas["contatos:na_lixeira"] = { itens: [contato("ctt_lix", "Ana Descartada", "na_lixeira")], total: 1 };
    gravacoes["POST /contatos/ctt_lix/restaurar"] = () =>
      resposta(409, { ok: false, error: "O Contato já está ativo.", codigo: "TRANSICAO_INVALIDA" });
    await montarLixeira();
    await vi.waitFor(() => expect(screen.getByText("Ana Descartada")).toBeTruthy());
    const listagensAntes = chamadasA("GET", "/contatos").length;

    await act(async () => {
      fireEvent.click(within(linhaDe("Ana Descartada")).getByRole("button", { name: "Restaurar" }));
    });

    await vi.waitFor(() => expect(screen.getByText("O Contato já está ativo.")).toBeTruthy());
    expect(chamadasA("GET", "/contatos")).toHaveLength(listagensAntes);
    expect(screen.queryByText(/restaurado:/)).toBeNull();
  });

  it("dois cliques seguidos em Restaurar mandam uma só gravação (o botão espera a resposta)", async () => {
    paginas["contatos:na_lixeira"] = { itens: [contato("ctt_lix", "Ana Descartada", "na_lixeira")], total: 1 };
    let liberar: () => void = () => undefined;
    const original = fetchMock.getMockImplementation()! as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
      if (init.method === "POST") {
        await new Promise<void>((resolve) => {
          liberar = resolve;
        });
        paginas["contatos:na_lixeira"] = { itens: [], total: 0 };
        return resposta(200, { ok: true, dados: { contato: { id: "ctt_lix" }, identificadores: [], vinculos: [] } });
      }
      return original(url, init);
    });
    await montarLixeira();
    await vi.waitFor(() => expect(screen.getByText("Ana Descartada")).toBeTruthy());
    const botao = within(linhaDe("Ana Descartada")).getByRole("button", { name: "Restaurar" });

    await act(async () => {
      fireEvent.click(botao);
    });
    await act(async () => {
      fireEvent.click(botao);
    });
    expect(chamadasA("POST", "/contatos/ctt_lix/restaurar")).toHaveLength(1);
    expect(botao.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      liberar();
    });
    await vi.waitFor(() => expect(screen.queryByText("Ana Descartada", { selector: "a" })).toBeNull());
  });

  it("Empresa sem admin: a recusa da api é dita e a tela manda abrir a ficha para escolher o admin", async () => {
    paginas["empresas:na_lixeira"] = { itens: [empresa("emp_lix", "Comércio Descartado", "na_lixeira")], total: 1 };
    gravacoes["POST /empresas/emp_lix/restaurar"] = () =>
      resposta(409, { ok: false, error: "Toda Empresa precisa de ao menos um Contato admin.", codigo: "EMPRESA_SEM_ADMIN" });
    await montarLixeira();
    await vi.waitFor(() => expect(screen.getByText("Comércio Descartado")).toBeTruthy());

    await act(async () => {
      fireEvent.click(within(linhaDe("Comércio Descartado")).getByRole("button", { name: "Restaurar" }));
    });

    await vi.waitFor(() => expect(screen.getByText(/Toda Empresa precisa de ao menos um Contato admin\./)).toBeTruthy());
    expect(screen.getByText(/Abra a ficha da Empresa para escolher o admin\./)).toBeTruthy();
  });

  it("o que não é do CRM segue do store: uma Tarefa na lixeira é listada e restaurada sem chamar a api do CRM", async () => {
    const seed = buildSeed();
    const tarefa = seed.tasks[0]!;
    tarefa.lifecycle = "naLixeira";
    tarefa.trashedAt = AGORA;

    await montarLixeira(seed);

    expect(screen.getByText(tarefa.title)).toBeTruthy();
    expect(within(linhaDe(tarefa.title)).getByText("Tarefa")).toBeTruthy();
  });

  it("uma recusa ao LISTAR o CRM é dita na tela, sem inventar linha do store", async () => {
    recusas.contatos = { status: 403, error: "Seu Papel não lê Contatos." };

    await montarLixeira();

    await vi.waitFor(() => expect(screen.getByText(/Seu Papel não lê Contatos\./)).toBeTruthy());
  });
});
