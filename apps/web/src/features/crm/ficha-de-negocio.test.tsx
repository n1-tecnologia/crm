// @vitest-environment jsdom
/**
 * 07-11 Task 1 — a ficha nova de Negócio em `/crm/negocios/[negocio]` lê
 * `GET /negocios/:id` e mostra título, situação, Funil e Etapa, valor na moeda,
 * probabilidade efetiva (e "ajustada" quando sobrescrita), Proprietário e o
 * dono com link; trocar a Etapa é `POST …/mover` e trocar de Funil exige a
 * Etapa do Funil novo; editar é `PATCH` só com o que mudou; o encerramento
 * passa pelo `DialogoDeEncerramento` com as Regras do Funil; Reabrir um ganho
 * é de quem administra (RN-NEG-10, D-14); arquivado é só leitura (RN-NEG-16);
 * nada do que a 007 não guarda aparece (D-02); e um id do modelo antigo abre a
 * `DealScreen` (D-15). O teste mora em `features/crm/` porque `app/` só guarda
 * convenção de arquivo do Next. Nenhuma rede: `fetch` roteado por método e
 * URL, sessão falsa, `StoreProvider` de verdade com o seed.
 *
 * A espera da busca do `SeletorDeRegistro` (300 ms) usa o relógio de verdade:
 * o `waitFor` do Testing Library não anda com `vi.useFakeTimers`.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { NegocioDetalhado } from "@n1/dominio/crm/negocios";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import NegocioPage from "@/app/(shell)/crm/negocios/[negocio]/page";

const { obterSessao, navegacao } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  navegacao: { push: vi.fn() },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

// `invalidarCrm` é espiado: o `mutate` global do SWR não alcança o cache isolado do `SWRConfig` do teste.
vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/negocios/n1",
  useRouter: () => ({ replace: vi.fn(), push: navegacao.push }),
  useSearchParams: () => new URLSearchParams(),
}));

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const FRASE_RN_NEG_10 = "Só Administrador ou Proprietário reabre um Negócio ganho (RN-NEG-10).";
const FRASE_RN_FUN_15 = "Para trocar de Funil, escolha a Etapa de destino (RN-FUN-15).";
const FRASE_MOTIVO = "Este Funil exige o motivo da perda para marcar o Negócio como perdido.";

const FUNIL_VENDAS = { id: "f2", nome: "Vendas", estado: "ativo" as const, exigeMotivoPerda: false, exigeValorGanho: false };
const ETAPAS_DO_FUNIL = [
  { id: "e2", nome: "Proposta", ordem: 2 },
  { id: "e1", nome: "Prospecção", ordem: 1 },
];

type Negocio = NegocioDetalhado["negocio"];

function detalhado(sobre: Partial<Negocio> = {}, resto: Partial<Omit<NegocioDetalhado, "negocio">> = {}): NegocioDetalhado {
  const negocio: Negocio = {
    id: "n1",
    titulo: "Proposta Alfa",
    objeto: null,
    descricao: null,
    empresaId: null,
    contatoId: "c1",
    funilId: "f2",
    etapaId: "e1",
    valor: "1500.00",
    moeda: "BRL",
    probabilidade: null,
    situacao: "aberto",
    motivoPerda: null,
    motivoGanho: null,
    notaEncerramento: null,
    origem: "Indicação",
    dataPrevistaFechamento: "2026-11-30",
    encerradoEm: null,
    estado: "ativo",
    proprietarioId: "mem_julia",
    criadoPor: "mem_julia",
    criadoEm: "2026-10-01T10:00:00.000Z",
    atualizadoEm: "2026-10-01T10:00:00.000Z",
    ...sobre,
  };
  const etapa = negocio.etapaId === "e2" ? { id: "e2", nome: "Proposta", probabilidadePadrao: 50 } : { id: "e1", nome: "Prospecção", probabilidadePadrao: 10 };
  const probabilidadeEfetiva =
    negocio.situacao === "ganho" ? 100 : negocio.situacao === "perdido" ? 0 : (negocio.probabilidade ?? etapa.probabilidadePadrao);
  return {
    negocio,
    funil: FUNIL_VENDAS,
    etapa,
    etapasDoFunil: ETAPAS_DO_FUNIL,
    empresa: null,
    contato: { id: "c1", nome: "Ana Souza", estado: "ativo" },
    probabilidadeEfetiva,
    ...resto,
  };
}

const GANHO: Partial<Negocio> = {
  situacao: "ganho",
  motivoGanho: "Preço e prazo",
  notaEncerramento: "Fechou na reunião.",
  encerradoEm: "2026-10-05T10:00:00.000Z",
};

const FUNIS_ATIVOS = {
  ok: true,
  total: 2,
  itens: [
    { funil: { id: "f1", nome: "Parcerias", padrao: false, estado: "ativo", exigeMotivoPerda: false, exigeValorGanho: false }, totalEtapas: 1, negociosAbertos: 0 },
    { funil: { ...FUNIL_VENDAS, padrao: true }, totalEtapas: 2, negociosAbertos: 1 },
  ],
};

const FUNIL_F1 = {
  ok: true,
  dados: {
    funil: { id: "f1", nome: "Parcerias", padrao: false, estado: "ativo", exigeMotivoPerda: false, exigeValorGanho: false },
    etapas: [{ id: "e9", funilId: "f1", nome: "Boas-vindas", ordem: 1, probabilidadePadrao: 10, cor: null, descricao: null, criadoEm: "2026-10-01T10:00:00.000Z" }],
  },
};

const EMPRESAS_DA_BUSCA = {
  ok: true,
  total: 1,
  itens: [
    { id: "emp1", nomeDeExibicao: "Alfa Comércio", dominioPrincipal: "alfa.com", documentoPrincipal: null, matriz: null, proprietarioId: "mem_julia", estado: "ativo", atualizadoEm: "2026-10-01T10:00:00.000Z" },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, (init: RequestInit) => Response | Promise<Response>>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  rotas = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = url.replace("http://api", "");
    const metodo = init.method ?? "GET";
    if (metodo === "GET" && caminho.startsWith("/funis?")) return resposta(200, FUNIS_ATIVOS);
    if (metodo === "GET" && caminho === "/funis/f1") return resposta(200, FUNIL_F1);
    if (metodo === "GET" && caminho.startsWith("/empresas?")) return resposta(200, EMPRESAS_DA_BUSCA);
    const rota = rotas[`${metodo} ${caminho}`];
    if (rota) return rota(init);
    return resposta(404, { ok: false, error: "não roteado", codigo: "NAO_ROTEADO" });
  });
  vi.stubGlobal("fetch", fetchMock);
  // O jsdom não tem `ResizeObserver`; a tela antiga (recuo D-15) pode medir a largura. Aqui nada é medido.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  navegacao.push.mockReset();
});

afterEach(() => {
  cleanup();
});

async function montarPagina(id: string, memberId = "mem_julia") {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const params = Promise.resolve({ negocio: id });
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
          <Suspense fallback="carregando">
            <NegocioPage params={params} />
          </Suspense>
        </StoreProvider>
      </SWRConfig>,
    );
  });
}

/** O texto da tela sem o espaço inquebrável do `Intl` ("R$ 1.500,00" compara como texto comum). */
function texto(): string {
  return (document.body.textContent ?? "").replace(/ /g, " ");
}

async function abrirFicha(servidor: NegocioDetalhado = detalhado(), memberId = "mem_julia") {
  rotas["GET /negocios/n1"] = () => resposta(200, { ok: true, dados: servidor });
  await montarPagina("n1", memberId);
  // `vi.waitFor` (e não o do Testing Library): a falha é a asserção, sem o dump do DOM.
  await vi.waitFor(() => expect(texto()).toContain("Vendas · "), { timeout: 3000 });
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

function botao(nome: string): HTMLElement {
  const encontrado = screen.queryByRole("button", { name: nome });
  expect(encontrado, `o botão "${nome}" está na tela`).not.toBeNull();
  return encontrado as HTMLElement;
}

describe("FichaDeNegocio — leitura (a)", () => {
  it("(a) mostra título, Aberto, Funil e Etapa, valor na moeda, probabilidade efetiva, Proprietário e o Contato com link", async () => {
    await abrirFicha();
    expect(texto()).toContain("Vendas · Prospecção");
    expect(screen.getByText("Aberto")).toBeTruthy();
    expect(texto()).toContain("R$ 1.500,00");
    expect(texto()).toContain("10%");
    expect(texto()).not.toContain("ajustada");
    expect(texto()).toContain("Júlia Prado");
    expect(texto()).toContain("30/11/2026");
    expect(texto()).toContain("Indicação");
    expect(screen.getByRole("link", { name: "Ana Souza" }).getAttribute("href")).toBe("/crm/contatos/c1");
  });

  it("(a) a probabilidade sobrescrita aparece como efetiva e marcada como ajustada; a Empresa dona tem link", async () => {
    await abrirFicha(detalhado({ probabilidade: 40, contatoId: null, empresaId: "emp1" }, { contato: null, empresa: { id: "emp1", nome: "Alfa Comércio", estado: "ativo" } }));
    expect(texto()).toContain("40%");
    expect(texto()).toContain("ajustada");
    expect(screen.getByRole("link", { name: "Alfa Comércio" }).getAttribute("href")).toBe("/crm/empresas/emp1");
    expect(screen.queryByRole("link", { name: "Ana Souza" })).toBeNull();
  });
});

describe("FichaDeNegocio — Etapa e Funil (b)", () => {
  it("(b) trocar a Etapa no Select chama POST /negocios/n1/mover com { etapaId }", async () => {
    await abrirFicha();
    rotas["POST /negocios/n1/mover"] = () => resposta(200, { ok: true, dados: detalhado({ etapaId: "e2" }) });
    const etapa = screen.getByRole("combobox", { name: "Etapa" });
    expect(etapa.textContent).toContain("Prospecção");
    fireEvent.click(etapa);
    fireEvent.click(screen.getByRole("option", { name: /^Proposta/ }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n1/mover"]));
    expect(corpoDa("POST /negocios/n1/mover")).toEqual({ etapaId: "e2" });
  });

  it("(b) Mudar de Funil exige escolher a Etapa do Funil novo antes de enviar { funilId, etapaId }", async () => {
    await abrirFicha();
    fireEvent.click(botao("Mudar de Funil"));
    fireEvent.click(await screen.findByRole("combobox", { name: "Funil de destino" }));
    fireEvent.click(await screen.findByRole("option", { name: /Parcerias/ }));

    const mover = botao("Mover para o Funil");
    expect(mover.getAttribute("aria-disabled")).toBe("true");
    expect(mover.getAttribute("title")).toBe(FRASE_RN_FUN_15);
    fireEvent.click(mover);
    expect(gravacoes()).toEqual([]);

    const etapaDestino = screen.getByRole("combobox", { name: "Etapa de destino" });
    await waitFor(() => expect(etapaDestino.getAttribute("aria-disabled")).not.toBe("true"));
    fireEvent.click(etapaDestino);
    fireEvent.click(await screen.findByRole("option", { name: /Boas-vindas/ }));

    rotas["POST /negocios/n1/mover"] = () => resposta(200, { ok: true, dados: detalhado({ funilId: "f1", etapaId: "e9" }) });
    fireEvent.click(botao("Mover para o Funil"));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n1/mover"]));
    expect(corpoDa("POST /negocios/n1/mover")).toEqual({ funilId: "f1", etapaId: "e9" });
  });

  it("(b) uma recusa da api ao mover aparece como Toast e a Etapa fica como estava", async () => {
    await abrirFicha();
    rotas["POST /negocios/n1/mover"] = () => resposta(409, { ok: false, error: "Um Funil arquivado ou na lixeira não recebe Negócios (RN-FUN-14).", codigo: "FUNIL_INATIVO" });
    fireEvent.click(screen.getByRole("combobox", { name: "Etapa" }));
    fireEvent.click(screen.getByRole("option", { name: /^Proposta/ }));
    expect(await screen.findByText(/não recebe Negócios/)).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Etapa" }).textContent).toContain("Prospecção");
  });
});

describe("FichaDeNegocio — edição (c)", () => {
  it("(c) editar o valor 2.500,00 envia PATCH /negocios/n1 só com { valor: \"2500.00\" }", async () => {
    await abrirFicha();
    fireEvent.click(botao("Editar"));
    const dialogo = await screen.findByRole("alertdialog");
    expect((within(dialogo).getByLabelText(/^Valor/) as HTMLInputElement).value).toBe("1500,00");
    fireEvent.change(within(dialogo).getByLabelText(/^Valor/), { target: { value: "2.500,00" } });

    rotas["PATCH /negocios/n1"] = () => resposta(200, { ok: true, dados: detalhado({ valor: "2500.00" }) });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(gravacoes()).toEqual(["PATCH /negocios/n1"]));
    expect(corpoDa("PATCH /negocios/n1")).toEqual({ valor: "2500.00" });
    await waitFor(() => expect(texto()).toContain("Alterações salvas."));
  });

  it("(c) um valor ilegível e uma probabilidade fora de 0–100 travam no campo sem ir à api", async () => {
    await abrirFicha();
    fireEvent.click(botao("Editar"));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.change(within(dialogo).getByLabelText(/^Valor/), { target: { value: "abc" } });
    const salvar = within(dialogo).getByRole("button", { name: "Salvar alterações" });
    expect(salvar.getAttribute("aria-disabled")).toBe("true");
    fireEvent.change(within(dialogo).getByLabelText(/^Valor/), { target: { value: "10" } });
    fireEvent.change(within(dialogo).getByLabelText(/^Probabilidade/), { target: { value: "150" } });
    expect(within(dialogo).getByRole("button", { name: "Salvar alterações" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));
    expect(gravacoes()).toEqual([]);
  });

  it("(c) trocar o dono de Contato para Empresa envia { empresaId, contatoId: null }", async () => {
    await abrirFicha();
    fireEvent.click(botao("Trocar dono"));
    fireEvent.click(screen.getByRole("button", { name: "Empresa" }));
    fireEvent.change(screen.getByLabelText("Buscar Empresa"), { target: { value: "alfa" } });
    fireEvent.click(await screen.findByRole("option", { name: /Alfa Comércio/ }, { timeout: 3000 }));

    rotas["PATCH /negocios/n1"] = () =>
      resposta(200, { ok: true, dados: detalhado({ contatoId: null, empresaId: "emp1" }, { contato: null, empresa: { id: "emp1", nome: "Alfa Comércio", estado: "ativo" } }) });
    fireEvent.click(botao("Salvar dono"));
    await waitFor(() => expect(gravacoes()).toEqual(["PATCH /negocios/n1"]));
    expect(corpoDa("PATCH /negocios/n1")).toEqual({ empresaId: "emp1", contatoId: null });
  });
});

describe("FichaDeNegocio — encerramento (d)", () => {
  it("(d) Negócio ganho mostra motivo, nota e data do encerramento; Reabrir fica desabilitado para membro com a frase de RN-NEG-10", async () => {
    await abrirFicha(detalhado(GANHO));
    expect(screen.getByText("Ganho")).toBeTruthy();
    expect(texto()).toContain("Preço e prazo");
    expect(texto()).toContain("Fechou na reunião.");
    expect(texto()).toContain("05/10/2026");
    expect(texto()).toContain("100%");
    expect(screen.queryByRole("button", { name: "Marcar como ganho" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar como perdido" })).toBeNull();
    const reabrir = botao("Reabrir");
    expect(reabrir.getAttribute("aria-disabled")).toBe("true");
    expect(reabrir.getAttribute("title")).toBe(FRASE_RN_NEG_10);
  });

  it("(d) Administrador reabre o ganho pelo diálogo: POST /negocios/n1/reabrir e Toast", async () => {
    await abrirFicha(detalhado(GANHO), "mem_rafael");
    const reabrir = botao("Reabrir");
    expect(reabrir.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(reabrir);
    const dialogo = await screen.findByRole("alertdialog");
    rotas["POST /negocios/n1/reabrir"] = () => resposta(200, { ok: true, dados: detalhado() });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Reabrir Negócio" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n1/reabrir"]));
    await waitFor(() => expect(texto()).toContain("Negócio reaberto."));
  });

  it("(d) Marcar como perdido abre o diálogo com a Regra do Funil e, ao confirmar, POST /negocios/n1/perder", async () => {
    await abrirFicha(detalhado({}, { funil: { ...FUNIL_VENDAS, exigeMotivoPerda: true } }));
    fireEvent.click(botao("Marcar como perdido"));
    const dialogo = await screen.findByRole("alertdialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Marcar como perdido" });
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
    expect(confirmar.getAttribute("title")).toBe(FRASE_MOTIVO);

    rotas["POST /negocios/n1/perder"] = () => resposta(200, { ok: true, dados: detalhado({ situacao: "perdido", motivoPerda: "Preço" }) });
    fireEvent.change(within(dialogo).getByLabelText(/^Motivo da perda/), { target: { value: "Preço" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Marcar como perdido" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n1/perder"]));
    expect(corpoDa("POST /negocios/n1/perder")).toEqual({ motivoPerda: "Preço" });
    await waitFor(() => expect(texto()).toContain("Negócio marcado como perdido."));
  });
});

describe("FichaDeNegocio — ciclo de vida (e) e D-02 (f)", () => {
  it("(e) Negócio arquivado é só leitura: sem Editar, Trocar dono, Select de Etapa nem encerramento; só Restaurar e Excluir", async () => {
    await abrirFicha(detalhado({ estado: "arquivado" }));
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Trocar dono" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Etapa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mudar de Funil" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar como ganho" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar como perdido" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Arquivar" })).toBeNull();
    expect(botao("Excluir")).toBeTruthy();
    // A Etapa continua legível, só não se troca.
    expect(texto()).toContain("Prospecção");

    rotas["POST /negocios/n1/restaurar"] = () => resposta(200, { ok: true, dados: detalhado() });
    fireEvent.click(botao("Restaurar"));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n1/restaurar"]));
  });

  it("(e) Negócio ativo arquiva pelo cabeçalho e Excluir manda para a Lixeira depois de confirmar", async () => {
    await abrirFicha();
    rotas["POST /negocios/n1/arquivar"] = () => resposta(200, { ok: true, dados: detalhado({ estado: "arquivado" }) });
    fireEvent.click(botao("Arquivar"));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n1/arquivar"]));

    rotas["DELETE /negocios/n1"] = () => resposta(200, { ok: true, dados: detalhado({ estado: "na_lixeira" }) });
    fireEvent.click(botao("Excluir"));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar para a Lixeira" }));
    await waitFor(() => expect(gravacoes()).toEqual(["POST /negocios/n1/arquivar", "DELETE /negocios/n1"]));
  });

  it("(f) a ficha não renderiza Tags, Comentários, Anexos nem Requisitos (D-02)", async () => {
    await abrirFicha();
    for (const ausente of ["Tags", "Comentários", "Anexos", "Requisitos", "Vínculos"]) {
      expect(texto(), `"${ausente}" não aparece na ficha`).not.toContain(ausente);
    }
  });
});

describe("página /crm/negocios/[negocio] — recuo para a tela antiga (D-15)", () => {
  const NAO_ENCONTRADO = { ok: false, error: "Negócio não encontrado.", codigo: "NEGOCIO_NAO_ENCONTRADO" };

  it("404 da api para um id que não existe em lugar nenhum mostra Negócio não encontrado", async () => {
    rotas["GET /negocios/nao-existe"] = () => resposta(404, NAO_ENCONTRADO);
    await montarPagina("nao-existe");
    await vi.waitFor(() => expect(texto()).toContain("Negócio não encontrado."), { timeout: 3000 });
    expect(texto()).toContain("Ele pode ter sido excluído permanentemente.");
  });

  it("404 da api para um id do modelo antigo abre a DealScreen intacta", async () => {
    const antigo = buildSeed().deals[0]!;
    rotas[`GET /negocios/${antigo.id}`] = () => resposta(404, NAO_ENCONTRADO);
    await montarPagina(antigo.id);
    await vi.waitFor(() => expect(texto()).toContain(antigo.title), { timeout: 3000 });
    expect(texto()).not.toContain("Negócio não encontrado.");
  });

  it("outro erro da api vira um estado vazio com a mensagem", async () => {
    rotas["GET /negocios/n1"] = () => resposta(500, { ok: false, error: "O banco não respondeu." });
    await montarPagina("n1");
    await vi.waitFor(() => expect(texto()).toContain("Não foi possível abrir o Negócio."), { timeout: 3000 });
    expect(texto()).toContain("O banco não respondeu.");
  });
});
