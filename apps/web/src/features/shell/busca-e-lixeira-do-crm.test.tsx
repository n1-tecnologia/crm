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
import { SWRConfig } from "swr";
import type { ContatoResumo } from "@n1/dominio/crm/contatos";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import type { EmpresaResumo } from "@n1/dominio/crm/empresas";
import type { NegocioResumo } from "@n1/dominio/crm/negocios";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import BuscarPage from "@/app/(shell)/buscar/page";

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

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  parametros.atual = new URLSearchParams();
  paginas = {};
  recusas = {};
  fetchMock = vi.fn(async (url: string) => {
    const endereco = new URL(url);
    const recurso = endereco.pathname.slice(1) as Recurso;
    const recusa = recusas[recurso];
    if (recusa) return resposta(recusa.status, { ok: false, error: recusa.error });
    const pagina = paginas[`${recurso}:${endereco.searchParams.get("estado") ?? "ativo"}`] ?? { itens: [], total: 0 };
    return resposta(200, { ok: true, ...pagina });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    expect(screen.getByText("Ana Souza").closest("a")?.getAttribute("href")).toBe("/crm/contatos/ctt_nova");
    expect(screen.getByText("Ana Comércio").closest("a")?.getAttribute("href")).toBe("/crm/empresas/emp_nova");
    expect(screen.getByText("Proposta Ana").closest("a")?.getAttribute("href")).toBe("/crm/negocios/neg_novo");
    expect(screen.getByText("Dúvida da Ana").closest("a")?.getAttribute("href")).toBe("/crm/caixa-de-entrada/cnv_nova");
  });

  it("um Contato criado pela ficha nova é achado pelo nome mesmo que o seed antigo não o conheça", async () => {
    parametros.atual = new URLSearchParams("q=Zuleica");
    paginas["contatos:ativo"] = { itens: [contato("ctt_zu", "Zuleica Prado")], total: 1 };
    const seed = buildSeed();
    expect(seed.contacts.some((c) => c.firstName === "Zuleica")).toBe(false);

    await montar(<BuscarPage />, seed);

    await vi.waitFor(() => expect(screen.getByText("Zuleica Prado")).toBeTruthy());
  });

  it("com menos de 2 caracteres não consulta o CRM", async () => {
    parametros.atual = new URLSearchParams("q=A");
    await montar(<BuscarPage />);
    expect(screen.getByText("Escreva ao menos duas letras.")).toBeTruthy();
    expect(chamadas()).toEqual([]);
  });

  it("nada do CRM vem do store: o Contato antigo do seed não aparece quando a api não o devolve", async () => {
    const seed = buildSeed();
    const antigo = seed.contacts[0]!;
    parametros.atual = new URLSearchParams(`q=${encodeURIComponent(antigo.firstName)}`);

    await montar(<BuscarPage />, seed);

    await vi.waitFor(() => expect(chamadas().length).toBeGreaterThan(0));
    expect(document.querySelector(`a[href="/crm/contatos/${antigo.id}"]`)).toBeNull();
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
