// @vitest-environment jsdom
/**
 * 07-07 Task 2 — a ficha de Funil lê o `FunilDetalhado` da api, configura
 * Etapas e Regras de encerramento por HTTP, leva a recusa de D-07 ao diálogo
 * certo, deixa a administração (D-14) só para Administrador/Proprietário e não
 * mostra o que a 007 não guarda (D-02). Nenhuma rede: `fetch` roteado por URL,
 * sessão falsa, `StoreProvider` de verdade com o seed.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { podeNoCrm } from "@n1/dominio/crm/permissoes";
import type { ContagemDeNegocios, EtapaDetalhada, FunilDetalhado } from "@n1/dominio/crm/funis";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { useFunil } from "@/dados/crm/funis";
import FunilPage from "@/app/(shell)/crm/funis/[funil]/page";
import { FichaDeFunil } from "./ficha-de-funil";

const { obterSessao, trocarUrl, irPara } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  trocarUrl: vi.fn(),
  irPara: vi.fn(),
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
  usePathname: () => "/crm/funis/f1",
  useRouter: () => ({ replace: trocarUrl, push: irPara }),
  useSearchParams: () => new URLSearchParams(),
}));

const SEM_NEGOCIOS: ContagemDeNegocios = { abertos: 0, ganhos: 0, perdidos: 0, arquivados: 0, naLixeira: 0, total: 0 };

function etapa(id: string, ordem: number, nome: string, probabilidadePadrao: number, negocios: Partial<ContagemDeNegocios> = {}): EtapaDetalhada {
  const contagem = { ...SEM_NEGOCIOS, ...negocios };
  return {
    id,
    funilId: "f1",
    nome,
    ordem,
    probabilidadePadrao,
    cor: null,
    descricao: null,
    criadoEm: "2026-10-01T10:00:00.000Z",
    negocios: {
      ...contagem,
      total: contagem.abertos + contagem.ganhos + contagem.perdidos + contagem.arquivados + contagem.naLixeira,
    },
  };
}

function funil(sobre: Partial<FunilDetalhado["funil"]> = {}, etapas?: EtapaDetalhada[]): FunilDetalhado {
  return {
    funil: {
      id: "f1",
      nome: "Vendas",
      descricao: null,
      cor: null,
      ordem: 0,
      padrao: false,
      privado: false,
      exigeMotivoPerda: false,
      exigeValorGanho: false,
      estado: "ativo",
      criadoPor: "mem_thiago",
      criadoEm: "2026-10-01T10:00:00.000Z",
      atualizadoEm: "2026-10-01T10:00:00.000Z",
      ...sobre,
    },
    // Fora de ordem de propósito: a ficha mostra pela `ordem`.
    etapas: etapas ?? [etapa("e2", 2, "Proposta", 50), etapa("e1", 1, "Novo", 10, { abertos: 2, ganhos: 1, arquivados: 1 })],
  };
}

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  trocarUrl.mockClear();
  irPara.mockClear();
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

/** A página de verdade: `useFunil` lê a ficha e `FichaDeFunil` a desenha. */
function Pagina() {
  const { data } = useFunil("f1");
  return data ? <FichaDeFunil funilId="f1" detalhado={data} /> : null;
}

function transporte(): Transporte {
  return {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
}

function montar(memberId = "mem_thiago") {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte()}>
        <Pagina />
      </StoreProvider>
    </SWRConfig>,
  );
}

/** GET /funis/f1 devolve a ficha; qualquer escrita devolve `escrita` (a ficha, por padrão). */
function rotear(ficha: FunilDetalhado, escrita?: (url: string, init: RequestInit) => Response) {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (init.method === "GET" || init.method === undefined) return resposta(200, { ok: true, dados: ficha });
    return escrita ? escrita(url, init) : resposta(200, { ok: true, dados: ficha });
  });
}

function chamadas(): string[] {
  return (fetchMock.mock.calls as Array<[string, RequestInit]>).map(([url, init]) => `${init.method} ${url.replace("http://api", "")}`);
}

function escritas(): string[] {
  return chamadas().filter((c) => !c.startsWith("GET"));
}

function corpoDa(chamada: string): unknown {
  const achada = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(
    ([url, init]) => `${init.method} ${url.replace("http://api", "")}` === chamada,
  );
  return achada?.[1].body === undefined ? undefined : JSON.parse(achada[1].body as string);
}

function linhasDeEtapa(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "Etapas do Funil" })).getAllByRole("listitem");
}

describe("FichaDeFunil — leitura", () => {
  it("(a) lista as Etapas na ordem com probabilidade e contagens, e marca o Funil padrão", async () => {
    rotear(funil({ padrao: true }));
    const { container } = montar("mem_julia");

    await vi.waitFor(() => expect(container.textContent).toContain("Funil padrão"));
    expect(container.textContent).toContain("2 Etapas · 4 Negócios");
    const linhas = linhasDeEtapa();
    expect(linhas).toHaveLength(2);
    expect(linhas[0]?.textContent).toContain("Novo");
    expect(linhas[0]?.textContent).toContain("Probabilidade padrão 10%");
    expect(linhas[0]?.textContent).toContain("2 abertos · 1 ganhos · 0 perdidos");
    expect(linhas[0]?.textContent).toContain("1 arquivados");
    expect(linhas[0]?.textContent).not.toContain("na Lixeira");
    expect(linhas[1]?.textContent).toContain("Proposta");
    expect(linhas[1]?.textContent).toContain("Probabilidade padrão 50%");
    expect(linhas[1]?.textContent).toContain("0 abertos · 0 ganhos · 0 perdidos");
  });

  it("(g) não mostra Requisitos de Etapa nem Transições permitidas (D-02)", async () => {
    rotear(funil());
    const { container } = montar();
    await vi.waitFor(() => expect(container.textContent).toContain("Proposta"));
    for (const proibido of ["Requisito", "Exigência de", "Transições", "Transição"]) {
      expect(container.textContent).not.toContain(proibido);
    }
  });
});

describe("FichaDeFunil — Etapas", () => {
  it("(b) subir a segunda Etapa manda PUT com a permutação inteira", async () => {
    rotear(funil());
    montar();

    await screen.findByRole("list", { name: "Etapas do Funil" });
    const sobem = screen.getAllByRole("button", { name: "Subir" });
    expect(sobem[0]?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(sobem[1]!);

    await waitFor(() => expect(escritas()).toEqual(["PUT /funis/f1/etapas/ordem"]));
    expect(corpoDa("PUT /funis/f1/etapas/ordem")).toEqual({ etapaIds: ["e2", "e1"] });
  });

  it("(c) Remover Etapa sem Negócios manda DELETE; com Negócios abre o remapeamento em vez de apagar", async () => {
    rotear(funil());
    montar();

    await screen.findByRole("list", { name: "Etapas do Funil" });
    const [novo, proposta] = linhasDeEtapa();
    fireEvent.click(within(novo!).getByRole("button", { name: "Remover" }));
    expect(trocarUrl).toHaveBeenCalledTimes(1);
    expect(String(trocarUrl.mock.calls[0]?.[0])).toContain("remapear-etapa=e1");
    expect(escritas()).toEqual([]);

    fireEvent.click(within(proposta!).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(escritas()).toEqual(["DELETE /etapas/e2"]));
  });

  it("(c) a única Etapa tem Remover desabilitado com o motivo", async () => {
    rotear(funil({}, [etapa("e1", 1, "Novo", 10)]));
    montar();

    await screen.findByRole("list", { name: "Etapas do Funil" });
    const remover = within(linhasDeEtapa()[0]!).getByRole("button", { name: "Remover" });
    expect(remover.getAttribute("aria-disabled")).toBe("true");
    expect(remover.getAttribute("title")).toBe("Um Funil precisa de ao menos uma Etapa.");
    fireEvent.click(remover);
    expect(escritas()).toEqual([]);
  });

  it("(h) renomear a Etapa sai por PATCH /etapas/:id e a probabilidade também", async () => {
    rotear(funil());
    montar();

    const nome = await screen.findByLabelText("Nome da Etapa Novo");
    fireEvent.change(nome, { target: { value: "Lead novo" } });
    fireEvent.blur(nome);
    await waitFor(() => expect(escritas()).toEqual(["PATCH /etapas/e1"]));
    expect(corpoDa("PATCH /etapas/e1")).toEqual({ nome: "Lead novo" });

    const probabilidade = screen.getByLabelText("Probabilidade padrão da Etapa Proposta (%)");
    fireEvent.change(probabilidade, { target: { value: "60" } });
    fireEvent.blur(probabilidade);
    await waitFor(() => expect(escritas()).toContain("PATCH /etapas/e2"));
    expect(corpoDa("PATCH /etapas/e2")).toEqual({ probabilidadePadrao: 60 });
  });

  it("(h) nome de Etapa repetido é recusado no domínio, sem ir ao servidor", async () => {
    rotear(funil());
    montar();

    const nome = await screen.findByLabelText("Nome da Etapa Novo");
    fireEvent.change(nome, { target: { value: " proposta " } });
    fireEvent.blur(nome);
    await screen.findByText('Já existe uma Etapa chamada "proposta" neste Funil.');
    expect(escritas()).toEqual([]);
  });

  it("(i) Adicionar Etapa manda POST com nome, probabilidade e posição", async () => {
    rotear(funil());
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Adicionar Etapa" }));
    fireEvent.change(screen.getByLabelText("Nome da nova Etapa"), { target: { value: "Fechamento" } });
    fireEvent.change(screen.getByLabelText("Probabilidade padrão (%)"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Posição (opcional)"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(escritas()).toEqual(["POST /funis/f1/etapas"]));
    expect(corpoDa("POST /funis/f1/etapas")).toEqual({ nome: "Fechamento", probabilidadePadrao: 90, posicao: 3 });
  });
});

describe("FichaDeFunil — Funil", () => {
  it("(d) Excluir com Negócios: 409 mostra a contagem e o botão que abre a migração", async () => {
    const frase = "Este Funil ainda tem 3 Negócios. Migre os Negócios para outro Funil antes de removê-lo.";
    rotear(funil(), (_url, init) =>
      init.method === "DELETE"
        ? resposta(409, { ok: false, error: frase, codigo: "FUNIL_COM_NEGOCIOS", bloqueios: { negocios: { total: 3, itens: [] } } })
        : resposta(200, { ok: true, dados: funil() }),
    );
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar para a Lixeira" }));

    const aviso = await screen.findByText(frase);
    const caixa = aviso.closest('[role="alert"]') as HTMLElement;
    expect(escritas()).toEqual(["DELETE /funis/f1"]);
    fireEvent.click(within(caixa).getByRole("button", { name: "Migrar Negócios" }));
    expect(String(trocarUrl.mock.calls.at(-1)?.[0])).toContain("migrar-negocios=");
  });

  it("(e) um Membro vê a ficha inteira, sem nenhum botão de escrita habilitado, e a linha de apoio", async () => {
    rotear(funil());
    const { container } = montar("mem_julia");

    await screen.findByRole("list", { name: "Etapas do Funil" });
    expect(container.textContent).toContain("Só Administrador e Proprietário alteram Funis e Etapas.");
    expect(container.textContent).toContain("Novo");
    expect(container.textContent).toContain("Proposta");
    const frase = podeNoCrm("membro", "ativo", "editar", "funil");
    for (const nome of ["Subir", "Descer", "Remover", "Adicionar Etapa", "Definir como padrão", "Migrar Negócios", "Arquivar", "Excluir"]) {
      const botoes = screen.getAllByRole("button", { name: nome });
      for (const botao of botoes) expect(botao.getAttribute("aria-disabled"), nome).toBe("true");
    }
    expect(typeof frase).toBe("string");
    expect(screen.getByRole("button", { name: "Excluir" }).getAttribute("title")).toBe(frase);
    for (const chave of screen.getAllByRole("switch")) expect((chave as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText("Nome da Etapa Novo")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]!);
    expect(escritas()).toEqual([]);
  });

  it("(f) Definir como padrão aparece só para Funil ativo, não privado e não padrão, e manda POST /padrao", async () => {
    rotear(funil());
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Definir como padrão" }));
    await waitFor(() => expect(escritas()).toEqual(["POST /funis/f1/padrao"]));
    await screen.findByText("Vendas é o Funil padrão.");
  });

  it("(f) não há Definir como padrão para o Funil que já é o padrão, o privado nem o arquivado", async () => {
    for (const sobre of [{ padrao: true }, { privado: true }, { estado: "arquivado" as const }]) {
      rotear(funil(sobre));
      const { container, unmount } = montar();
      await vi.waitFor(() => expect(container.textContent).toContain("Proposta"));
      expect(screen.queryByRole("button", { name: "Definir como padrão" })).toBeNull();
      unmount();
    }
  });

  it("(j) as Regras de encerramento são interruptores que mandam PATCH", async () => {
    rotear(funil());
    montar();

    const chave = await screen.findByRole("switch", { name: "Exigir valor ao marcar como ganho" });
    expect(chave.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(chave);
    await waitFor(() => expect(escritas()).toEqual(["PATCH /funis/f1"]));
    expect(corpoDa("PATCH /funis/f1")).toEqual({ exigeValorGanho: true });
  });

  it("(k) Migrar Negócios fica desligado sem Negócios, com o motivo", async () => {
    rotear(funil({}, [etapa("e1", 1, "Novo", 10)]));
    montar();

    const migrar = await screen.findByRole("button", { name: "Migrar Negócios" });
    expect(migrar.getAttribute("aria-disabled")).toBe("true");
    expect(migrar.getAttribute("title")).toBe("Este Funil não tem Negócios.");
  });
});

describe("página /crm/funis/[funil]", () => {
  async function montarPagina(id: string) {
    const params = Promise.resolve({ funil: id });
    let resultado!: ReturnType<typeof render>;
    await act(async () => {
      resultado = render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <StoreProvider sessao={{ memberId: "mem_thiago" }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte()}>
            <Suspense fallback="carregando">
              <FunilPage params={params} />
            </Suspense>
          </StoreProvider>
        </SWRConfig>,
      );
    });
    return resultado.container;
  }

  it("(l) 404 da api mostra Funil não encontrado com a dica do cadastro anterior (D-15)", async () => {
    fetchMock.mockResolvedValue(resposta(404, { ok: false, error: "Funil não encontrado.", codigo: "FUNIL_NAO_ENCONTRADO" }));
    const container = await montarPagina("antigo");
    await vi.waitFor(() => expect(container.textContent).toContain("Funil não encontrado."));
    expect(container.textContent).toContain(
      "Pode ter sido excluído permanentemente, ou ser um Funil do cadastro anterior, que ainda não aparece aqui.",
    );
  });

  it("(m) sucesso desenha a ficha pela api", async () => {
    rotear(funil());
    const container = await montarPagina("f1");
    await vi.waitFor(() => expect(container.textContent).toContain("Proposta"));
    expect(chamadas()[0]).toBe("GET /funis/f1");
  });
});
