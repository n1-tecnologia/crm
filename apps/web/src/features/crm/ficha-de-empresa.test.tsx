// @vitest-environment jsdom
/**
 * 07-09 Task 2 — a ficha de Empresa lê o `EmpresaDetalhada` da api e gerencia
 * os vínculos com o admin sempre indicado (D-08): vigentes com cargo e selo
 * "admin", encerrados recolhidos; rebaixar ou encerrar o último admin é
 * recusado pelo domínio SEM ir à api e oferece "Trocar admin"; Excluir avisa
 * dos vínculos e mostra os links de RN-EMP-09; restaurar da lixeira pede o
 * Contato admin; nada do que a 007 não guarda aparece (D-02). Nenhuma rede:
 * `fetch` roteado por método e URL, sessão falsa, `StoreProvider` com o seed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { validarRetiradaDeAdmin, type EmpresaDetalhada, type VinculoDaEmpresa } from "@n1/dominio/crm/empresas";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { useEmpresa } from "@/dados/crm/empresas";
import { FichaDeEmpresa } from "./ficha-de-empresa";

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
  usePathname: () => "/crm/empresas/e1",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function vinculo(sobre: Partial<VinculoDaEmpresa> & Pick<VinculoDaEmpresa, "id" | "contatoId" | "contatoNome">): VinculoDaEmpresa {
  return { contatoEstado: "ativo", cargo: null, admin: false, inicio: "2025-01-10", fim: null, ...sobre };
}

const VIGENTES: VinculoDaEmpresa[] = [
  vinculo({ id: "v1", contatoId: "c1", contatoNome: "Ana Souza", cargo: "Diretora", admin: true }),
  vinculo({ id: "v2", contatoId: "c2", contatoNome: "Beto Lima", cargo: "CFO" }),
  vinculo({ id: "v3", contatoId: "c3", contatoNome: "Caio Dias", admin: true, inicio: "2024-01-01", fim: "2025-06-30" }),
];

function detalhado(
  sobre: Partial<EmpresaDetalhada["empresa"]> = {},
  vinculos: readonly VinculoDaEmpresa[] = VIGENTES,
  resto: Partial<Omit<EmpresaDetalhada, "empresa" | "vinculos">> = {},
): EmpresaDetalhada {
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
      ...sobre,
    },
    identificadores: [
      { id: "i1", empresaId: "e1", tipo: "dominio", valor: "alfa.com", pais: null, verificado: false, principal: true, criadoEm: "2026-10-01T10:00:00.000Z" },
      { id: "i2", empresaId: "e1", tipo: "documento_fiscal", valor: "12345678000190", pais: "BR", verificado: true, principal: true, criadoEm: "2026-10-01T10:00:01.000Z" },
    ],
    vinculos,
    matriz: null,
    filiais: [],
    ...resto,
  };
}

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

type Rota = (init: RequestInit) => Response | Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, Rota>;

const CONTATOS_DA_BUSCA = {
  ok: true,
  total: 3,
  itens: [
    { id: "c1", nomeDeExibicao: "Ana Souza", estado: "ativo", proprietarioId: "mem_julia", emailPrincipal: "ana@x.com", telefonePrincipal: null, atualizadoEm: "2026-10-01T10:00:00.000Z" },
    { id: "c2", nomeDeExibicao: "Beto Lima", estado: "ativo", proprietarioId: "mem_julia", emailPrincipal: "beto@x.com", telefonePrincipal: null, atualizadoEm: "2026-10-01T10:00:00.000Z" },
    { id: "c4", nomeDeExibicao: "Dora Reis", estado: "ativo", proprietarioId: "mem_julia", emailPrincipal: "dora@x.com", telefonePrincipal: null, atualizadoEm: "2026-10-01T10:00:00.000Z" },
  ],
};

const EMPRESAS_DA_BUSCA = {
  ok: true,
  total: 1,
  itens: [
    { id: "e0", nomeDeExibicao: "Grupo Alfa", dominioPrincipal: null, documentoPrincipal: null, matriz: null, proprietarioId: "mem_julia", estado: "ativo", atualizadoEm: "2026-10-01T10:00:00.000Z" },
  ],
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  rotas = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = url.replace("http://api", "");
    if (caminho.startsWith("/contatos?")) return resposta(200, CONTATOS_DA_BUSCA);
    if (caminho.startsWith("/empresas?")) return resposta(200, EMPRESAS_DA_BUSCA);
    const rota = rotas[`${init.method ?? "GET"} ${caminho}`];
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

/** A página de verdade: `useEmpresa` lê a ficha e `FichaDeEmpresa` a desenha. */
function Pagina({ modo = "pagina" }: { readonly modo?: "pagina" | "popup" }) {
  const { data } = useEmpresa("e1");
  return data ? <FichaDeEmpresa empresaId="e1" detalhado={data} modo={modo} /> : null;
}

function montar(servidor: EmpresaDetalhada, memberId = "mem_julia", modo: "pagina" | "popup" = "pagina") {
  rotas["GET /empresas/e1"] = () => resposta(200, { ok: true, dados: servidor });
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        <Pagina modo={modo} />
      </StoreProvider>
    </SWRConfig>,
  );
}

function gravacoes(): string[] {
  return (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>)
    .filter(([, init]) => init?.method !== undefined && init.method !== "GET")
    .map(([url, init]) => `${init?.method} ${url.replace("http://api", "")}`);
}

function corpoDaGravacao(rotulo: string): unknown {
  const chamada = (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>).find(
    ([url, init]) => `${init?.method} ${url.replace("http://api", "")}` === rotulo,
  );
  return chamada?.[1]?.body === undefined ? undefined : JSON.parse(chamada[1].body as string);
}

function linhaDoContato(nome: string): HTMLElement {
  return screen.getByRole("link", { name: nome }).closest("li") as HTMLElement;
}

async function abrirFicha(servidor: EmpresaDetalhada = detalhado(), memberId = "mem_julia") {
  montar(servidor, memberId);
  // `vi.waitFor` (e não o do Testing Library): a falha é a asserção, sem o dump do DOM.
  await vi.waitFor(() => expect(document.body.textContent).toContain("Alfa Comércio Ltda"), { timeout: 3000 });
}

const FRASE_ULTIMO_ADMIN = "Indique o novo admin antes de retirar o último.";

describe("FichaDeEmpresa — vínculos e admin (D-08)", () => {
  it("(a) mostra os vigentes com cargo e o selo admin, e os encerrados recolhidos com a data de fim", async () => {
    await abrirFicha();
    const ana = within(linhaDoContato("Ana Souza"));
    expect(ana.getByDisplayValue("Diretora")).toBeTruthy();
    expect(ana.getByText("admin")).toBeTruthy();
    const beto = within(linhaDoContato("Beto Lima"));
    expect(beto.queryByText("admin")).toBeNull();

    // O encerrado fica na lista recolhida, com `fim`; Caio não está entre os vigentes.
    const resumo = screen.getByText(/Vínculos encerrados \(1\)/);
    const recolhido = resumo.closest("details") as HTMLElement;
    expect(within(recolhido).getByText("Caio Dias")).toBeTruthy();
    expect(within(recolhido).getByText(/encerrado em/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ana Souza" }).getAttribute("href")).toBe("/crm/contatos/c1");
  });

  it("(b) desmarcar o único admin mostra a recusa do domínio sem chamar a api e oferece Trocar admin, que troca em POST /trocar-admin", async () => {
    await abrirFicha();
    const chamadasAntes = fetchMock.mock.calls.length;
    fireEvent.click(within(linhaDoContato("Ana Souza")).getByRole("switch"));

    expect(await screen.findByText(FRASE_ULTIMO_ADMIN)).toBeTruthy();
    const esperada = validarRetiradaDeAdmin(VIGENTES, "v1");
    expect(esperada.ok).toBe(false);
    expect(gravacoes()).toEqual([]);
    expect(fetchMock.mock.calls.length).toBe(chamadasAntes);

    fireEvent.click(screen.getAllByRole("button", { name: "Trocar admin" })[0] as HTMLElement);
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/Uma Empresa nunca fica sem Contato admin/)).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText("Buscar novo admin"), { target: { value: "beto" } });
    fireEvent.click(await within(dialogo).findByText("Beto Lima", undefined, { timeout: 2000 }));

    rotas["POST /empresas/e1/trocar-admin"] = () => resposta(200, { ok: true, dados: detalhado() });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Trocar admin" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /empresas/e1/trocar-admin"]));
    expect(corpoDaGravacao("POST /empresas/e1/trocar-admin")).toEqual({ vinculoAtualId: "v1", novoAdmin: { contatoId: "c2" } });
  });

  it("(b) encerrar o único admin é recusado do mesmo jeito; encerrar quem não é admin vai à api", async () => {
    await abrirFicha();
    fireEvent.click(within(linhaDoContato("Ana Souza")).getByRole("button", { name: "Encerrar" }));
    expect(await screen.findByText(FRASE_ULTIMO_ADMIN)).toBeTruthy();
    expect(gravacoes()).toEqual([]);

    rotas["POST /empresas/e1/contatos/v2/encerrar"] = () => resposta(200, { ok: true, dados: detalhado() });
    fireEvent.click(within(linhaDoContato("Beto Lima")).getByRole("button", { name: "Encerrar" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /empresas/e1/contatos/v2/encerrar"]));
  });

  it("(b) o ULTIMO_ADMIN da api (a tela estava velha) mostra a frase e também oferece Trocar admin", async () => {
    const doisAdmins = [
      vinculo({ id: "v1", contatoId: "c1", contatoNome: "Ana Souza", admin: true }),
      vinculo({ id: "v2", contatoId: "c2", contatoNome: "Beto Lima", admin: true }),
    ];
    await abrirFicha(detalhado({}, doisAdmins));
    rotas["POST /empresas/e1/contatos/v1/encerrar"] = () =>
      resposta(409, { ok: false, error: FRASE_ULTIMO_ADMIN, codigo: "ULTIMO_ADMIN", campo: "admin" });
    fireEvent.click(within(linhaDoContato("Ana Souza")).getByRole("button", { name: "Encerrar" }));
    expect(await screen.findByText(FRASE_ULTIMO_ADMIN)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Trocar admin" }).length).toBeGreaterThanOrEqual(1);
  });

  it("(c) Excluir avisa que os vínculos vigentes serão encerrados e os Contatos ficam; o 409 EMPRESA_BLOQUEADA lista Negócios e filiais com link", async () => {
    await abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/Os vínculos vigentes serão encerrados e os Contatos continuam existindo/)).toBeTruthy();

    rotas["DELETE /empresas/e1"] = () =>
      resposta(409, {
        ok: false,
        error: "Esta Empresa não pode ir para a lixeira: tem 1 Negócio aberto e tem a filial Filial Sul.",
        codigo: "EMPRESA_BLOQUEADA",
        bloqueios: { negocios: { total: 1, itens: [{ id: "n1", titulo: "Proposta anual" }] }, filiais: [{ id: "e2", nome: "Filial Sul" }] },
      });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar para a Lixeira" }));

    expect(await screen.findByText(/não pode ir para a lixeira/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Proposta anual" }).getAttribute("href")).toBe("/crm/negocios/n1");
    expect(screen.getByRole("link", { name: "Filial Sul" }).getAttribute("href")).toBe("/crm/empresas/e2");
    // A Empresa continua ativa na tela.
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeTruthy();
  });

  it("(d) Restaurar da lixeira pede o Contato admin, pré-preenchido com o último admin encerrado, e manda { admin: { contatoId } }", async () => {
    const encerrados = [
      vinculo({ id: "v1", contatoId: "c1", contatoNome: "Ana Souza", admin: true, fim: "2026-10-01" }),
      vinculo({ id: "v2", contatoId: "c2", contatoNome: "Beto Lima", fim: "2026-10-01" }),
    ];
    await abrirFicha(detalhado({ estado: "na_lixeira" }, encerrados));
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/Uma Empresa precisa de ao menos um Contato admin/)).toBeTruthy();
    expect(within(dialogo).getByText("Ana Souza")).toBeTruthy();

    rotas["POST /empresas/e1/restaurar"] = () => resposta(200, { ok: true, dados: detalhado() });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Restaurar Empresa" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /empresas/e1/restaurar"]));
    expect(corpoDaGravacao("POST /empresas/e1/restaurar")).toEqual({ admin: { contatoId: "c1" } });
  });

  it("(d) Restaurar de uma Empresa arquivada não pede admin: vai direto, sem corpo", async () => {
    await abrirFicha(detalhado({ estado: "arquivado" }));
    rotas["POST /empresas/e1/restaurar"] = () => resposta(200, { ok: true, dados: detalhado() });
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /empresas/e1/restaurar"]));
    expect(corpoDaGravacao("POST /empresas/e1/restaurar")).toBeUndefined();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("(e) Adicionar Contato (sem os já vinculados) com cargo e admin manda POST /empresas/e1/contatos; VINCULO_JA_EXISTE mostra a frase", async () => {
    await abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Contato" }));
    fireEvent.change(await screen.findByLabelText("Buscar Contato a vincular"), { target: { value: "a" } });
    // Ana e Beto já estão vinculados: só Dora aparece entre os resultados.
    const lista = await screen.findByRole("listbox");
    const dora = await within(lista).findByText("Dora Reis", undefined, { timeout: 2000 });
    expect(within(lista).queryByText("Ana Souza")).toBeNull();
    expect(within(lista).queryByText("Beto Lima")).toBeNull();
    fireEvent.click(dora);
    fireEvent.change(screen.getByLabelText("Cargo do novo vínculo"), { target: { value: "Analista" } });

    rotas["POST /empresas/e1/contatos"] = () =>
      resposta(409, { ok: false, error: "Este Contato já tem um vínculo vigente com a Empresa.", codigo: "VINCULO_JA_EXISTE" });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Este Contato já tem um vínculo vigente com a Empresa.")).toBeTruthy();
    expect(corpoDaGravacao("POST /empresas/e1/contatos")).toEqual({ contatoId: "c4", cargo: "Analista", admin: false });
    // O Contato escolhido continua na tela.
    expect(screen.getByText("Dora Reis")).toBeTruthy();
  });

  it("(f) não mostra Tags, Comentários, Anexos, Mesclar nem Sugestões de Vínculo (D-02) e mostra o que a 007 guarda", async () => {
    await abrirFicha(detalhado({}, VIGENTES, { matriz: { id: "e0", nome: "Grupo Alfa", estado: "ativo" }, filiais: [{ id: "e2", nome: "Filial Sul", estado: "ativo" }] }));
    const texto = document.body.textContent ?? "";
    for (const proibido of ["Tags", "Comentários", "Anexos", "Mesclar", "Sugestões"]) expect(texto).not.toContain(proibido);
    for (const presente of ["Dados", "Identificadores", "Endereços", "Campos adicionais", "Contatos", "Matriz e filiais"]) {
      expect(screen.getAllByText(presente).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("link", { name: "Grupo Alfa" }).getAttribute("href")).toBe("/crm/empresas/e0");
    expect(screen.getByRole("link", { name: "Filial Sul" }).getAttribute("href")).toBe("/crm/empresas/e2");
    expect(screen.getByText("alfa.com")).toBeTruthy();
  });

  it("(g) um Convidado vê tudo e nada grava: os botões de escrita ficam desligados com o motivo (D-14)", async () => {
    await abrirFicha(detalhado(), "mem_beatriz");
    for (const nome of ["Editar", "Adicionar Contato", "Adicionar Identificador", "Arquivar", "Excluir"]) {
      expect(screen.getByRole("button", { name: nome }).getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("(h) no popup o rodapé leva à página cheia da Empresa", async () => {
    montar(detalhado(), "mem_julia", "popup");
    const link = await screen.findByRole("link", { name: "Abrir página cheia" }, { timeout: 3000 });
    expect(link.getAttribute("href")).toBe("/crm/empresas/e1");
  });
});

describe("FichaDeEmpresa — Identificadores e Dados", () => {
  it("(i) adicionar um domínio vai a POST /identificadores; domínio de provedor público é recusado antes da api", async () => {
    await abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Identificador" }));
    fireEvent.change(screen.getByLabelText("Valor do Identificador"), { target: { value: "gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const alertas = await screen.findAllByRole("alert");
    expect(alertas.some((a) => /provedor|público|publico/i.test(a.textContent ?? ""))).toBe(true);
    expect(gravacoes()).toEqual([]);

    rotas["POST /empresas/e1/identificadores"] = () => resposta(201, { ok: true, dados: detalhado() });
    fireEvent.change(screen.getByLabelText("Valor do Identificador"), { target: { value: "alfa.com.br" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /empresas/e1/identificadores"]));
    expect(corpoDaGravacao("POST /empresas/e1/identificadores")).toEqual({ tipo: "dominio", valor: "alfa.com.br" });
  });

  it("(j) editar a matriz: MATRIZ_INVALIDA da api aparece no campo Matriz e o diálogo continua aberto", async () => {
    await abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.change(within(dialogo).getByLabelText("Empresa matriz"), { target: { value: "grupo" } });
    fireEvent.click(await within(dialogo).findByText("Grupo Alfa", undefined, { timeout: 2000 }));

    rotas["PATCH /empresas/e1"] = () =>
      resposta(409, { ok: false, error: "Esta matriz já é filial desta Empresa; a hierarquia não pode fazer um ciclo (INV-EMP-05).", codigo: "MATRIZ_INVALIDA", campo: "matrizId" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    const erro = await within(dialogo).findByText(/a hierarquia não pode fazer um ciclo/);
    expect(erro.closest("[role='alert']")).toBeTruthy();
    expect(corpoDaGravacao("PATCH /empresas/e1")).toMatchObject({ matrizId: "e0" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
