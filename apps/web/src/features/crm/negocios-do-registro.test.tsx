// @vitest-environment jsdom
/**
 * 07-11 Task 2 — a seção "Negócios" das fichas de Contato e de Empresa lê
 * `GET /negocios?contatoId=…` / `?empresaId=…` (só os `ativo`, até 50) e lista
 * título com link para a ficha, situação, Etapa e valor; vazia, diz de quem é
 * o vazio; "Novo Negócio" abre o `DialogoNovoNegocio` com o dono já escolhido
 * (o Contato ou a Empresa da ficha) e, ao criar, a lista revalida; quem não
 * pode criar (Convidado, D-14) não vê o botão; e as duas fichas renderizam a
 * seção. Nenhuma rede: `fetch` roteado por método e URL, sessão falsa,
 * `StoreProvider` de verdade com o seed.
 */

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { ContatoDetalhado } from "@n1/dominio/crm/contatos";
import type { EmpresaDetalhada } from "@n1/dominio/crm/empresas";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { FichaDeContato } from "./ficha-de-contato";
import { FichaDeEmpresa } from "./ficha-de-empresa";
import { NegociosDoRegistro } from "./negocios-do-registro";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

// `invalidarCrm` é espiado: o `mutate` global do SWR não alcança o cache isolado do `SWRConfig` do teste.
vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/contatos/c1",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const LISTA_DO_CONTATO = "GET /negocios?estado=ativo&contatoId=c1&limite=50&deslocamento=0";
const LISTA_DA_EMPRESA = "GET /negocios?estado=ativo&empresaId=e1&limite=50&deslocamento=0";

function negocio(id: string, titulo: string, etapaId: string, valor: string | null, situacao = "aberto") {
  return {
    id,
    titulo,
    valor,
    moeda: "BRL",
    probabilidadeEfetiva: situacao === "ganho" ? 100 : 10,
    situacao,
    estado: "ativo",
    funilId: "f2",
    etapaId,
    empresa: null,
    contato: { id: "c1", nome: "Ana Souza" },
    proprietarioId: "mem_julia",
    dataPrevistaFechamento: null,
    encerradoEm: situacao === "aberto" ? null : "2026-10-05T10:00:00.000Z",
    atualizadoEm: "2026-10-01T10:00:00.000Z",
  };
}

const NEGOCIOS = { ok: true, total: 2, itens: [negocio("n1", "Proposta Alfa", "e1", "1500.00"), negocio("n2", "Renovação Beta", "e2", null, "ganho")] };
const VAZIA = { ok: true, total: 0, itens: [] };

const FUNIL_VENDAS = { id: "f2", nome: "Vendas", padrao: true, estado: "ativo", exigeMotivoPerda: false, exigeValorGanho: false };
const FUNIS_ATIVOS = { ok: true, total: 1, itens: [{ funil: FUNIL_VENDAS, totalEtapas: 2, negociosAbertos: 1 }] };
const FUNIL_F2 = {
  ok: true,
  dados: {
    funil: FUNIL_VENDAS,
    etapas: [
      { id: "e2", funilId: "f2", nome: "Proposta", ordem: 2, probabilidadePadrao: 50, cor: null, descricao: null, criadoEm: "2026-10-01T10:00:00.000Z" },
      { id: "e1", funilId: "f2", nome: "Prospecção", ordem: 1, probabilidadePadrao: 10, cor: null, descricao: null, criadoEm: "2026-10-01T10:00:00.000Z" },
    ],
  },
};

function contatoDetalhado(): ContatoDetalhado {
  return {
    contato: {
      id: "c1",
      nome: "Ana",
      sobrenome: "Souza",
      dataNascimento: null,
      idioma: "pt-BR",
      fusoHorario: null,
      fotoUrl: null,
      descricao: null,
      enderecos: [],
      camposAdicionais: {},
      origem: null,
      qualificacao: null,
      modoCriacao: "manual",
      estado: "ativo",
      proprietarioId: "mem_julia",
      criadoPor: "mem_julia",
      criadoEm: "2026-10-01T10:00:00.000Z",
      atualizadoEm: "2026-10-01T10:00:00.000Z",
    },
    identificadores: [],
    vinculos: [],
  };
}

function empresaDetalhada(): EmpresaDetalhada {
  return {
    empresa: {
      id: "e1",
      nomeFantasia: "Alfa",
      razaoSocial: "Alfa Comércio Ltda",
      descricao: null,
      matrizId: null,
      enderecos: [],
      camposAdicionais: {},
      origem: null,
      estado: "ativo",
      proprietarioId: "mem_julia",
      criadoPor: "mem_julia",
      criadoEm: "2026-10-01T10:00:00.000Z",
      atualizadoEm: "2026-10-01T10:00:00.000Z",
    },
    identificadores: [],
    vinculos: [{ id: "v1", contatoId: "c1", contatoNome: "Ana Souza", contatoEstado: "ativo", cargo: null, admin: true, inicio: "2025-01-10", fim: null }],
    matriz: null,
    filiais: [],
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, (init: RequestInit) => Response | Promise<Response>>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  rotas = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = url.replace("http://api", "");
    const metodo = init.method ?? "GET";
    if (metodo === "GET" && caminho.startsWith("/funis?")) return resposta(200, FUNIS_ATIVOS);
    if (metodo === "GET" && caminho === "/funis/f2") return resposta(200, FUNIL_F2);
    const rota = rotas[`${metodo} ${caminho}`];
    if (rota) return rota(init);
    return resposta(404, { ok: false, error: "não roteado", codigo: "NAO_ROTEADO" });
  });
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

function provedores(filhos: ReactNode, memberId = "mem_julia") {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        {filhos}
      </StoreProvider>
    </SWRConfig>,
  );
}

/** O texto da tela sem o espaço inquebrável do `Intl` ("R$ 1.500,00" compara como texto comum). */
function texto(): string {
  return (document.body.textContent ?? "").replace(/ /g, " ");
}

function chamadas(rotulo?: string): string[] {
  const todas = (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>).map(([url, init]) => `${init?.method ?? "GET"} ${url.replace("http://api", "")}`);
  return rotulo === undefined ? todas : todas.filter((chamada) => chamada === rotulo);
}

function corpoDa(rotulo: string): unknown {
  const chamada = (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>).find(
    ([url, init]) => `${init?.method} ${url.replace("http://api", "")}` === rotulo,
  );
  return chamada?.[1]?.body === undefined ? undefined : JSON.parse(chamada[1].body as string);
}

function botao(nome: string): HTMLElement {
  const encontrado = screen.queryByRole("button", { name: nome });
  expect(encontrado, `o botão "${nome}" está na tela`).not.toBeNull();
  return encontrado as HTMLElement;
}

describe("NegociosDoRegistro — a lista (a)", () => {
  it("(a) busca GET /negocios?contatoId=c1&estado=ativo e lista título com link, situação, Etapa e valor", async () => {
    rotas[LISTA_DO_CONTATO] = () => resposta(200, NEGOCIOS);
    provedores(<NegociosDoRegistro contato={{ id: "c1", nome: "Ana Souza" }} />);
    // `vi.waitFor` (e não o do Testing Library): a falha é a asserção, sem o dump do DOM.
    await vi.waitFor(() => expect(texto()).toContain("Proposta Alfa"), { timeout: 3000 });
    expect(chamadas(LISTA_DO_CONTATO).length).toBe(1);
    expect(screen.getByRole("link", { name: "Proposta Alfa" }).getAttribute("href")).toBe("/crm/negocios/n1");
    expect(screen.getByRole("link", { name: "Renovação Beta" }).getAttribute("href")).toBe("/crm/negocios/n2");
    expect(screen.getByText("Aberto")).toBeTruthy();
    expect(screen.getByText("Ganho")).toBeTruthy();
    expect(texto()).toContain("R$ 1.500,00");
    await waitFor(() => expect(texto()).toContain("Prospecção"));
    expect(texto()).toContain("Proposta");
    expect(texto()).toContain("Negócios");
  });

  it("(a) sem Negócios diz de quem é o vazio: do Contato ou da Empresa", async () => {
    rotas[LISTA_DO_CONTATO] = () => resposta(200, VAZIA);
    const { unmount } = provedores(<NegociosDoRegistro contato={{ id: "c1", nome: "Ana Souza" }} />);
    await vi.waitFor(() => expect(texto()).toContain("Nenhum Negócio deste Contato."), { timeout: 3000 });
    unmount();

    rotas[LISTA_DA_EMPRESA] = () => resposta(200, VAZIA);
    provedores(<NegociosDoRegistro empresa={{ id: "e1", nome: "Alfa" }} />);
    await vi.waitFor(() => expect(texto()).toContain("Nenhum Negócio desta Empresa."), { timeout: 3000 });
    expect(chamadas(LISTA_DA_EMPRESA).length).toBe(1);
  });
});

describe("NegociosDoRegistro — Novo Negócio (b)", () => {
  it("(b) Novo Negócio abre o diálogo com o Contato da ficha já escolhido; ao criar, POST /negocios leva contatoId e a lista revalida", async () => {
    rotas[LISTA_DO_CONTATO] = () => resposta(200, VAZIA);
    provedores(<NegociosDoRegistro contato={{ id: "c1", nome: "Ana Souza" }} />);
    await vi.waitFor(() => expect(texto()).toContain("Nenhum Negócio deste Contato."), { timeout: 3000 });

    fireEvent.click(botao("Novo Negócio"));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Novo Negócio")).toBeTruthy();
    // O dono já veio da ficha: o seletor mostra o Contato escolhido, com "Trocar".
    expect(within(within(dialogo).getByRole("group", { name: "Buscar Contato" })).getByText("Ana Souza")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Contato", pressed: true })).toBeTruthy();

    fireEvent.change(within(dialogo).getByLabelText(/^Título/), { target: { value: "Contrato anual" } });
    await waitFor(() => expect(within(dialogo).getByRole("combobox", { name: "Etapa" }).textContent).toContain("Prospecção"), { timeout: 3000 });

    rotas["POST /negocios"] = () => resposta(201, { ok: true, dados: { negocio: { id: "n9", titulo: "Contrato anual" } } });
    rotas[LISTA_DO_CONTATO] = () => resposta(200, { ok: true, total: 1, itens: [negocio("n9", "Contrato anual", "e1", null)] });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Criar Negócio" }));
    await waitFor(() => expect(chamadas("POST /negocios").length).toBe(1));
    expect(corpoDa("POST /negocios")).toEqual({ titulo: "Contrato anual", contatoId: "c1", funilId: "f2", etapaId: "e1" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(texto()).toContain("Contrato anual"), { timeout: 3000 });
    expect(chamadas(LISTA_DO_CONTATO).length).toBeGreaterThanOrEqual(2);
    expect(texto()).toContain("Negócio criado.");
  });

  it("(b) na ficha de Empresa o dono já escolhido é a Empresa e o POST leva empresaId", async () => {
    rotas[LISTA_DA_EMPRESA] = () => resposta(200, VAZIA);
    provedores(<NegociosDoRegistro empresa={{ id: "e1", nome: "Alfa" }} />);
    await vi.waitFor(() => expect(texto()).toContain("Nenhum Negócio desta Empresa."), { timeout: 3000 });

    fireEvent.click(botao("Novo Negócio"));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(within(dialogo).getByRole("group", { name: "Buscar Empresa" })).getByText("Alfa")).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText(/^Título/), { target: { value: "Parceria" } });
    await waitFor(() => expect(within(dialogo).getByRole("combobox", { name: "Etapa" }).textContent).toContain("Prospecção"), { timeout: 3000 });

    rotas["POST /negocios"] = () => resposta(201, { ok: true, dados: { negocio: { id: "n8", titulo: "Parceria" } } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Criar Negócio" }));
    await waitFor(() => expect(chamadas("POST /negocios").length).toBe(1));
    expect(corpoDa("POST /negocios")).toEqual({ titulo: "Parceria", empresaId: "e1", funilId: "f2", etapaId: "e1" });
  });

  it("(b) um Convidado vê a lista mas não o botão Novo Negócio (D-14)", async () => {
    rotas[LISTA_DO_CONTATO] = () => resposta(200, NEGOCIOS);
    provedores(<NegociosDoRegistro contato={{ id: "c1", nome: "Ana Souza" }} />, "mem_beatriz");
    await vi.waitFor(() => expect(texto()).toContain("Proposta Alfa"), { timeout: 3000 });
    expect(screen.queryByRole("button", { name: "Novo Negócio" })).toBeNull();
  });
});

describe("as fichas renderizam a seção Negócios (c)", () => {
  it("(c) a ficha de Contato pede GET /negocios?contatoId=c1 e mostra a seção", async () => {
    rotas[LISTA_DO_CONTATO] = () => resposta(200, NEGOCIOS);
    provedores(<FichaDeContato contatoId="c1" detalhado={contatoDetalhado()} />);
    await vi.waitFor(() => expect(texto()).toContain("Proposta Alfa"), { timeout: 3000 });
    expect(chamadas(LISTA_DO_CONTATO).length).toBe(1);
    expect(screen.getByRole("link", { name: "Proposta Alfa" }).getAttribute("href")).toBe("/crm/negocios/n1");
    expect(botao("Novo Negócio")).toBeTruthy();
  });

  it("(c) a ficha de Empresa pede GET /negocios?empresaId=e1 e mostra a seção", async () => {
    rotas[LISTA_DA_EMPRESA] = () => resposta(200, NEGOCIOS);
    provedores(<FichaDeEmpresa empresaId="e1" detalhado={empresaDetalhada()} modo="pagina" />);
    await vi.waitFor(() => expect(texto()).toContain("Proposta Alfa"), { timeout: 3000 });
    expect(chamadas(LISTA_DA_EMPRESA).length).toBe(1);
    expect(botao("Novo Negócio")).toBeTruthy();
  });
});
