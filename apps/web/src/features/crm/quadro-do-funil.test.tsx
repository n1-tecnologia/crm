// @vitest-environment jsdom
/**
 * 07-10 Task 2 — o quadro de Negócios lê e grava só pela api (D-04, D-05): uma
 * coluna por Etapa do Funil (inclusive vazias), cartões `aberto` na Etapa
 * deles, `ganho`/`perdido` na faixa "Negócios encerrados"; soltar um cartão
 * noutra coluna move NA HORA e chama `POST /negocios/:id/mover`, e uma recusa
 * devolve o cartão (T-07-32); Ganhar/Perder abrem o diálogo com as Regras do
 * Funil; Reabrir de `ganho` é de quem administra (D-14); Novo Negócio cria por
 * `POST /negocios` com Empresa OU Contato. O teste mora em `features/crm/`
 * porque `app/` só guarda convenção de arquivo do Next. Nenhuma rede: `fetch`
 * roteado por URL, sessão falsa, `StoreProvider` de verdade com o seed.
 *
 * O arrastar é simulado com `fireEvent.dragStart`/`fireEvent.drop`; a espera da
 * busca (300 ms) usa o relógio de verdade, porque o `waitFor` do Testing
 * Library não anda com `vi.useFakeTimers`.
 */

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import NegociosPage from "@/app/(shell)/crm/negocios/page";
import { DialogoNovoNegocio } from "./formulario-de-negocio";

const { obterSessao, navegacao } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  navegacao: { busca: "", push: vi.fn() },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/negocios",
  useRouter: () => ({ replace: vi.fn(), push: navegacao.push }),
  useSearchParams: () => new URLSearchParams(navegacao.busca),
}));

import { invalidarCrm } from "@/dados/crm/cliente-crm";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const FUNIL_PADRAO = { id: "f2", nome: "Vendas", padrao: true, estado: "ativo", exigeMotivoPerda: false, exigeValorGanho: false };
const FUNIL_OUTRO = { id: "f1", nome: "Parcerias", padrao: false, estado: "ativo", exigeMotivoPerda: false, exigeValorGanho: false };

const FUNIS_ATIVOS = {
  ok: true,
  total: 2,
  itens: [
    { funil: FUNIL_OUTRO, totalEtapas: 1, negociosAbertos: 0 },
    { funil: FUNIL_PADRAO, totalEtapas: 3, negociosAbertos: 3 },
  ],
};

function etapa(id: string, nome: string, ordem: number, probabilidadePadrao: number) {
  return { id, funilId: "f2", nome, ordem, probabilidadePadrao, cor: null, descricao: null, criadoEm: "2026-10-01T10:00:00.000Z" };
}

function funilDetalhado(regras: { exigeMotivoPerda?: boolean; exigeValorGanho?: boolean } = {}) {
  return {
    ok: true,
    dados: {
      funil: { ...FUNIL_PADRAO, ...regras },
      etapas: [etapa("e3", "Fechamento", 3, 80), etapa("e1", "Prospecção", 1, 10), etapa("e2", "Proposta", 2, 50)],
    },
  };
}

function negocio(id: string, titulo: string, etapaId: string, valor: string | null, probabilidadeEfetiva: number, situacao = "aberto") {
  return {
    id,
    titulo,
    valor,
    moeda: "BRL",
    probabilidadeEfetiva,
    situacao,
    estado: "ativo",
    funilId: "f2",
    etapaId,
    empresa: id === "n3" ? { id: "emp1", nome: "Alfa Comércio" } : null,
    contato: id === "n3" ? null : { id: "c1", nome: "Ana Souza" },
    proprietarioId: "mem_julia",
    dataPrevistaFechamento: id === "n1" ? "2026-11-30" : null,
    encerradoEm: situacao === "aberto" ? null : "2026-10-05T10:00:00.000Z",
    atualizadoEm: "2026-10-01T10:00:00.000Z",
  };
}

const NEGOCIOS = [
  negocio("n1", "Contrato Ana", "e1", "1000.00", 10),
  negocio("n2", "Renovação Beta", "e1", "2000.00", 10),
  negocio("n3", "Proposta Alfa", "e2", "500.50", 50),
  negocio("n4", "Fechado Gama", "e3", "3000.00", 100, "ganho"),
  negocio("n5", "Perdido Delta", "e2", null, 0, "perdido"),
];

const CHAVE_DA_LISTA = "GET /negocios?estado=ativo&funilId=f2&limite=200&deslocamento=0";

const CONTATOS_DA_BUSCA = {
  ok: true,
  total: 1,
  itens: [{ id: "c9", nomeDeExibicao: "Carla Dias", estado: "ativo", proprietarioId: "mem_julia", emailPrincipal: "carla@x.com", telefonePrincipal: null, atualizadoEm: "2026-10-01T10:00:00.000Z" }],
};

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, (init: RequestInit) => Response | Promise<Response>>;

function rotear(regras: { exigeMotivoPerda?: boolean; exigeValorGanho?: boolean; negocios?: unknown[] } = {}) {
  rotas["GET /funis?estado=ativo&limite=200&deslocamento=0"] = () => resposta(200, FUNIS_ATIVOS);
  rotas["GET /funis/f2"] = () => resposta(200, funilDetalhado(regras));
  rotas[CHAVE_DA_LISTA] = () => resposta(200, { ok: true, itens: regras.negocios ?? NEGOCIOS, total: (regras.negocios ?? NEGOCIOS).length });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  navegacao.busca = "";
  navegacao.push.mockReset();
  vi.mocked(invalidarCrm).mockClear();
  rotas = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = url.replace("http://api", "");
    if (caminho.startsWith("/contatos?")) return resposta(200, CONTATOS_DA_BUSCA);
    const rota = rotas[`${init.method ?? "GET"} ${caminho}`];
    return rota ? rota(init) : resposta(404, { ok: false, error: "não roteado", codigo: "NAO_ROTEADO" });
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
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        {filhos}
      </StoreProvider>
    </SWRConfig>
  );
}

function gravacoes(): string[] {
  return (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>)
    .filter(([, init]) => init?.method !== undefined && init.method !== "GET")
    .map(([url, init]) => `${init?.method} ${url.replace("http://api", "")}`);
}

function corpoDa(rotulo: string): unknown {
  const chamada = (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>).find(
    ([url, init]) => `${init?.method} ${url.replace("http://api", "")}` === rotulo,
  );
  return chamada?.[1]?.body === undefined ? undefined : JSON.parse(chamada[1].body as string);
}

async function abrirQuadro(memberId = "mem_julia", regras: Parameters<typeof rotear>[0] = {}) {
  rotear(regras);
  render(provedores(<NegociosPage />, memberId));
  await screen.findByText("Contrato Ana", undefined, { timeout: 3000 });
}

function coluna(nome: string): HTMLElement {
  const titulo = screen.getByRole("heading", { name: new RegExp(nome) });
  const trilho = titulo.closest("div.trilho");
  expect(trilho, `a coluna "${nome}" está no quadro`).not.toBeNull();
  return trilho as HTMLElement;
}

function cartao(titulo: string): HTMLElement {
  const link = screen.getByText(titulo).closest("a");
  expect(link, `o cartão "${titulo}" está no quadro`).not.toBeNull();
  return link as HTMLElement;
}

function abrirMenu(titulo: string) {
  fireEvent.click(screen.getByRole("button", { name: `Ações de ${titulo}` }));
}

function botao(nome: string): HTMLElement {
  const encontrado = screen.queryByRole("button", { name: nome });
  expect(encontrado, `o botão "${nome}" está na tela`).not.toBeNull();
  return encontrado as HTMLElement;
}

describe("QuadroDoFunil — as colunas e os cartões", () => {
  it("(a) abre no Funil padrão, com uma coluna por Etapa na ordem (inclusive a vazia) e os cartões abertos na Etapa deles; os encerrados ficam na faixa", async () => {
    await abrirQuadro();
    expect((screen.getByRole("combobox", { name: "Funil" }) as HTMLElement).textContent).toContain("Vendas");

    const nomes = screen.getAllByRole("heading", { level: 2 }).map((titulo) => titulo.textContent ?? "");
    const ordem = ["Prospecção", "Proposta", "Fechamento"].map((nome) => nomes.findIndex((texto) => texto.includes(nome)));
    expect(ordem.every((posicao) => posicao >= 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);

    expect(within(coluna("Prospecção")).getByText("Contrato Ana")).toBeTruthy();
    expect(within(coluna("Prospecção")).getByText("Renovação Beta")).toBeTruthy();
    expect(within(coluna("Proposta")).getByText("Proposta Alfa")).toBeTruthy();
    expect(within(coluna("Fechamento")).getByText("Nenhum Negócio nesta Etapa.")).toBeTruthy();
    expect(within(coluna("Prospecção")).getByText("10% padrão · R$ 3.000,00".replace("R$ ", "R$ "), { exact: false })).toBeTruthy();

    // ganho e perdido não são colunas (B58): só aparecem na faixa, recolhida
    expect(screen.queryByText("Fechado Gama")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar encerrados" }));
    expect(screen.getByText("Fechado Gama")).toBeTruthy();
    expect(screen.getByText("Perdido Delta")).toBeTruthy();
    expect(screen.getByText("Ganho")).toBeTruthy();
    expect(screen.getByText("Perdido")).toBeTruthy();
    expect(within(screen.getByText("Fechado Gama").closest("li") as HTMLElement).getByText(/Última Etapa: Fechamento/)).toBeTruthy();
  });

  it("(c) o cabeçalho soma o valor declarado dos abertos e o ponderado pela probabilidade", async () => {
    await abrirQuadro();
    const fmt = makeFormatters(buildSeed().workspace.locale);
    const declarado = fmt.money({ amount: 3500.5, currency: "BRL" });
    const ponderado = fmt.money({ amount: 550.25, currency: "BRL" });
    expect(screen.getByText(new RegExp(`${declarado.replace(/\s/g, "\\s")}.*declarado`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${ponderado.replace(/\s/g, "\\s")}.*ponderado`))).toBeTruthy();
    expect(screen.getByText("3 abertos")).toBeTruthy();
  });

  it("(d) sem Funil ativo, o estado vazio leva a /crm/funis", async () => {
    rotas["GET /funis?estado=ativo&limite=200&deslocamento=0"] = () => resposta(200, { ok: true, itens: [], total: 0 });
    render(provedores(<NegociosPage />));
    expect(await screen.findByText("Nenhum Funil ativo.", undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir para Funis" }).getAttribute("href")).toBe("/crm/funis");
  });
});

describe("QuadroDoFunil — arrastar é mover (D-05, T-07-32)", () => {
  it("(b) soltar na coluna move o cartão na hora e chama POST /negocios/n1/mover com a Etapa", async () => {
    await abrirQuadro();
    let concluir: () => void = () => undefined;
    rotas["POST /negocios/n1/mover"] = () =>
      new Promise<Response>((resolver) => {
        concluir = () => resolver(resposta(200, { ok: true, dados: {} }));
      });
    fireEvent.dragStart(cartao("Contrato Ana"));
    fireEvent.drop(coluna("Proposta"));

    // antes da resposta da api o cartão já está na coluna nova
    await waitFor(() => expect(within(coluna("Proposta")).getByText("Contrato Ana")).toBeTruthy());
    expect(within(coluna("Prospecção")).queryByText("Contrato Ana")).toBeNull();
    expect(corpoDa("POST /negocios/n1/mover")).toEqual({ etapaId: "e2" });

    concluir();
    await waitFor(() => expect(invalidarCrm).toHaveBeenCalledWith("/negocios"));
    expect(within(coluna("Proposta")).getByText("Contrato Ana")).toBeTruthy();
    // mover não dá Toast de sucesso: o cartão mudar de coluna já é o feedback
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("(b) a recusa 409 devolve o cartão à coluna de origem e mostra a frase", async () => {
    await abrirQuadro();
    const frase = "Um Funil arquivado ou na lixeira não recebe Negócios (RN-FUN-14).";
    rotas["POST /negocios/n1/mover"] = () => resposta(409, { ok: false, error: frase, codigo: "FUNIL_INATIVO" });
    fireEvent.dragStart(cartao("Contrato Ana"));
    fireEvent.drop(coluna("Proposta"));

    expect(await screen.findByText(frase)).toBeTruthy();
    await waitFor(() => expect(within(coluna("Prospecção")).getByText("Contrato Ana")).toBeTruthy());
    expect(within(coluna("Proposta")).queryByText("Contrato Ana")).toBeNull();
  });

  it("(b) soltar na própria coluna não chama a api", async () => {
    await abrirQuadro();
    fireEvent.dragStart(cartao("Contrato Ana"));
    fireEvent.drop(coluna("Prospecção"));
    expect(gravacoes()).toEqual([]);
  });

  it("(b) o menu do cartão tem Abrir, Ganhar, Perder e um Mover para cada outra Etapa — a alternativa a arrastar — e Mover chama o mesmo POST", async () => {
    await abrirQuadro();
    abrirMenu("Contrato Ana");
    const itens = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(itens).toEqual(["Abrir", "Ganhar", "Perder", "Mover para Proposta", "Mover para Fechamento"]);
    rotas["POST /negocios/n1/mover"] = () => resposta(200, { ok: true, dados: {} });
    fireEvent.click(screen.getByRole("menuitem", { name: "Mover para Fechamento" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n1/mover"]));
    expect(corpoDa("POST /negocios/n1/mover")).toEqual({ etapaId: "e3" });
  });

  it("(b) Abrir leva à ficha do Negócio", async () => {
    await abrirQuadro();
    expect(cartao("Contrato Ana").getAttribute("href")).toBe("/crm/negocios/n1");
    abrirMenu("Contrato Ana");
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir" }));
    expect(navegacao.push).toHaveBeenCalledWith("/crm/negocios/n1");
  });

  it("(b) um Convidado só abre: arrastar não move e o menu só tem Abrir (D-14)", async () => {
    await abrirQuadro("mem_beatriz");
    fireEvent.dragStart(cartao("Contrato Ana"));
    fireEvent.drop(coluna("Proposta"));
    expect(gravacoes()).toEqual([]);
    abrirMenu("Contrato Ana");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Abrir"]);
  });
});

describe("QuadroDoFunil — encerrar e reabrir (D-05, D-14)", () => {
  it("(b) Perder abre o diálogo com a Regra do Funil: sem motivo Confirmar fica desligado; com motivo envia POST …/perder e avisa", async () => {
    await abrirQuadro("mem_julia", { exigeMotivoPerda: true });
    abrirMenu("Contrato Ana");
    fireEvent.click(screen.getByRole("menuitem", { name: "Perder" }));
    const confirmar = screen.getByRole("button", { name: "Marcar como perdido" });
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
    rotas["POST /negocios/n1/perder"] = () => resposta(200, { ok: true, dados: {} });
    fireEvent.change(screen.getByLabelText(/^Motivo da perda/), { target: { value: "Preço" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como perdido" }));
    await waitFor(() => expect(screen.getByText("Negócio marcado como perdido.")).toBeTruthy());
    expect(corpoDa("POST /negocios/n1/perder")).toEqual({ motivoPerda: "Preço" });
    expect(screen.queryByRole("button", { name: "Marcar como perdido" })).toBeNull();
  });

  it("(b) a faixa de encerrados reabre um perdido (qualquer Membro) e desliga o ganho para quem não administra", async () => {
    await abrirQuadro("mem_julia");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar encerrados" }));
    const linhaDoGanho = screen.getByText("Fechado Gama").closest("li") as HTMLElement;
    const reabrirGanho = within(linhaDoGanho).getByRole("button", { name: "Reabrir" });
    expect(reabrirGanho.getAttribute("aria-disabled")).toBe("true");
    expect(reabrirGanho.getAttribute("title")).toBe("Só Administrador ou Proprietário reabre um Negócio ganho (RN-NEG-10).");

    rotas["POST /negocios/n5/reabrir"] = () => resposta(200, { ok: true, dados: {} });
    const linhaDoPerdido = screen.getByText("Perdido Delta").closest("li") as HTMLElement;
    fireEvent.click(within(linhaDoPerdido).getByRole("button", { name: "Reabrir" }));
    fireEvent.click(screen.getByRole("button", { name: "Reabrir Negócio" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n5/reabrir"]));
    await waitFor(() => expect(screen.getByText("Negócio reaberto.")).toBeTruthy());
  });

  it("(b) Administrador reabre o ganho", async () => {
    await abrirQuadro("mem_rafael");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar encerrados" }));
    const linhaDoGanho = screen.getByText("Fechado Gama").closest("li") as HTMLElement;
    expect(within(linhaDoGanho).getByRole("button", { name: "Reabrir" }).getAttribute("aria-disabled")).not.toBe("true");
  });
});

describe("DialogoNovoNegocio — Empresa OU Contato, Funil e Etapa padrão (D-11)", () => {
  function montarDialogo(valorInicial?: { funilId?: string }) {
    rotear();
    const onCriado = vi.fn();
    const onClose = vi.fn();
    render(provedores(<DialogoNovoNegocio open onClose={onClose} onCriado={onCriado} {...(valorInicial ? { valorInicial } : {})} />));
    return { onCriado, onClose };
  }

  it("(e) sem título ou sem Empresa/Contato, Criar Negócio fica desligado; com tudo, envia { titulo, contatoId, funilId, etapaId } e o quadro revalida", async () => {
    const { onCriado } = montarDialogo();
    const criar = () => botao("Criar Negócio");
    expect(criar().getAttribute("aria-disabled")).toBe("true");

    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Projeto Carla" } });
    expect(criar().getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Contato" }));
    fireEvent.change(screen.getByLabelText("Buscar Contato"), { target: { value: "carla" } });
    fireEvent.click(await screen.findByRole("option", { name: /Carla Dias/ }, { timeout: 3000 }));

    // o Funil padrão e a Etapa inicial chegam da api
    await waitFor(() => expect(criar().getAttribute("aria-disabled")).not.toBe("true"), { timeout: 3000 });
    expect(screen.getByRole("combobox", { name: "Funil" }).textContent).toContain("Vendas");
    expect(screen.getByRole("combobox", { name: "Etapa" }).textContent).toContain("Prospecção");

    const criado = { ok: true, dados: { negocio: { id: "n9", titulo: "Projeto Carla" } } };
    rotas["POST /negocios"] = () => resposta(201, criado);
    fireEvent.click(criar());
    await waitFor(() => expect(onCriado).toHaveBeenCalledTimes(1));
    expect(corpoDa("POST /negocios")).toEqual({ titulo: "Projeto Carla", contatoId: "c9", funilId: "f2", etapaId: "e1" });
    expect(invalidarCrm).toHaveBeenCalledWith("/negocios");
  });

  it("(e) o valor é digitado à brasileira e vai como texto decimal; um valor ilegível trava o envio no campo", async () => {
    const { onCriado } = montarDialogo();
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Projeto Carla" } });
    fireEvent.click(screen.getByRole("button", { name: "Contato" }));
    fireEvent.change(screen.getByLabelText("Buscar Contato"), { target: { value: "carla" } });
    fireEvent.click(await screen.findByRole("option", { name: /Carla Dias/ }, { timeout: 3000 }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Etapa" }).textContent).toContain("Prospecção"), { timeout: 3000 });

    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "abc" } });
    expect(screen.getByRole("button", { name: "Criar Negócio" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("alert").textContent).toMatch(/valor/i);

    rotas["POST /negocios"] = () => resposta(201, { ok: true, dados: { negocio: { id: "n9" } } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "1.234,56" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Negócio" }));
    await waitFor(() => expect(onCriado).toHaveBeenCalledTimes(1));
    expect(corpoDa("POST /negocios")).toMatchObject({ valor: "1234.56", moeda: "BRL" });
  });

  it("(e) a recusa SEM_FUNIL_PADRAO da api aparece com o link para Funis e o diálogo continua aberto", async () => {
    const { onCriado } = montarDialogo();
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Projeto Carla" } });
    fireEvent.click(screen.getByRole("button", { name: "Contato" }));
    fireEvent.change(screen.getByLabelText("Buscar Contato"), { target: { value: "carla" } });
    fireEvent.click(await screen.findByRole("option", { name: /Carla Dias/ }, { timeout: 3000 }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Etapa" }).textContent).toContain("Prospecção"), { timeout: 3000 });

    const frase = "Este Espaço de Trabalho não tem Funil padrão.";
    rotas["POST /negocios"] = () => resposta(409, { ok: false, error: frase, codigo: "SEM_FUNIL_PADRAO" });
    fireEvent.click(screen.getByRole("button", { name: "Criar Negócio" }));
    expect(await screen.findByText(frase)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir para Funis" }).getAttribute("href")).toBe("/crm/funis");
    expect(onCriado).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/^Título/) as HTMLInputElement).value).toBe("Projeto Carla");
  });
});
