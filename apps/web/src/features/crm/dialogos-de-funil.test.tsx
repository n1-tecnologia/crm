// @vitest-environment jsdom
/**
 * 07-07 Task 3 — os dois diálogos de D-07 sobre a api: remapear uma Etapa
 * (`POST /etapas/:id/remapear`) e migrar os Negócios de um Funil
 * (`POST /funis/:id/migrar-negocios`). Mesmo layout e mesmos parâmetros de URL
 * de antes; só a fonte muda. Nenhuma rede: `fetch` roteado por URL, sessão falsa.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ContagemDeNegocios, EtapaDetalhada, FunilDetalhado, FunilResumo } from "@n1/dominio/crm/funis";
import { MIGRATE_DEALS_PARAM, MigrateFunnelDialog } from "./migrate-funnel-dialog";
import { REMOVE_STAGE_PARAM, RemoveStageDialog } from "./remove-stage-dialog";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/funis/f1",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const SEM_NEGOCIOS: ContagemDeNegocios = { abertos: 0, ganhos: 0, perdidos: 0, arquivados: 0, naLixeira: 0, total: 0 };

function etapa(funilId: string, id: string, ordem: number, nome: string, probabilidadePadrao: number, negocios: Partial<ContagemDeNegocios> = {}): EtapaDetalhada {
  const c = { ...SEM_NEGOCIOS, ...negocios };
  return {
    id,
    funilId,
    nome,
    ordem,
    probabilidadePadrao,
    cor: null,
    descricao: null,
    criadoEm: "2026-10-01T10:00:00.000Z",
    negocios: { ...c, total: c.abertos + c.ganhos + c.perdidos + c.arquivados + c.naLixeira },
  };
}

function funil(id: string, nome: string, etapas: EtapaDetalhada[], sobre: Partial<FunilDetalhado["funil"]> = {}): FunilDetalhado {
  return {
    funil: {
      id,
      nome,
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
    etapas,
  };
}

function resumo(detalhado: FunilDetalhado): FunilResumo {
  return { funil: detalhado.funil, totalEtapas: detalhado.etapas.length, negociosAbertos: 0 };
}

// A origem: "Novo" tem 4 Negócios (2 abertos, 1 ganho, 1 na Lixeira), "Proposta" tem 1 aberto e "Arquivada" nenhum.
const ORIGEM = funil("f1", "Vendas", [
  etapa("f1", "e1", 1, "Novo", 10, { abertos: 2, ganhos: 1, naLixeira: 1 }),
  etapa("f1", "e2", 2, "Proposta", 50, { abertos: 1 }),
  etapa("f1", "e3", 3, "Arquivada", 0),
]);
// O destino: "novo" (outra caixa) existe; "Proposta" não — cai na Etapa inicial, a de menor ordem ("Lead").
const DESTINO = funil("f2", "Pós-venda", [
  etapa("f2", "g2", 2, "novo", 5),
  etapa("f2", "g1", 1, "Lead", 0),
  etapa("f2", "g3", 3, "Fechado", 100),
]);
const DESTINO_SEM_ETAPAS = funil("f3", "Vazio", []);
const ARQUIVADO = funil("f9", "Antigo", [etapa("f9", "h1", 1, "Único", 0)], { estado: "arquivado" });

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

const FICHAS: Record<string, FunilDetalhado> = { f1: ORIGEM, f2: DESTINO, f3: DESTINO_SEM_ETAPAS, f9: ARQUIVADO };

/** GET devolve as fichas e a lista de Funis ativos; a escrita devolve `escrita`. */
function rotear(escrita: (url: string, init: RequestInit) => Response) {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const caminho = url.replace("http://api", "");
    if (init.method === "GET" || init.method === undefined) {
      if (caminho.startsWith("/funis?")) {
        const itens = [ORIGEM, DESTINO, DESTINO_SEM_ETAPAS, ARQUIVADO].map(resumo);
        return resposta(200, { ok: true, itens, total: itens.length });
      }
      const ficha = FICHAS[caminho.replace("/funis/", "")];
      return ficha ? resposta(200, { ok: true, dados: ficha }) : resposta(404, { ok: false, error: "Funil não encontrado." });
    }
    return escrita(url, init);
  });
}

function escritas(): Array<[string, RequestInit]> {
  return (fetchMock.mock.calls as Array<[string, RequestInit]>).filter(([, init]) => init.method !== "GET" && init.method !== undefined);
}

function montar(ui: React.ReactNode) {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>);
}

async function escolher(campo: string, opcao: string | RegExp) {
  fireEvent.click(await screen.findByRole("combobox", { name: campo }));
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
}

describe("os parâmetros de URL não mudaram", () => {
  it("continuam ?remapear-etapa= e ?migrar-negocios=", () => {
    expect(REMOVE_STAGE_PARAM).toBe("remapear-etapa");
    expect(MIGRATE_DEALS_PARAM).toBe("migrar-negocios");
  });
});

describe("RemoveStageDialog — remapear e remover pela api", () => {
  it("(a) mostra as contagens da Etapa, lista só as outras como destino e confirma por POST /remapear", async () => {
    rotear(() => resposta(200, { ok: true, dados: ORIGEM }));
    const onDone = vi.fn();
    const onClose = vi.fn();
    montar(<RemoveStageDialog funilId="f1" etapaId="e1" onClose={onClose} onDone={onDone} />);

    await vi.waitFor(() => expect(document.body.textContent).toContain("2 abertos · 1 ganho · 0 perdidos"));
    expect(document.body.textContent).toContain("1 na Lixeira");
    expect(document.body.textContent).not.toContain("arquivados");
    expect(document.body.textContent).toContain("4 Negócios estão nela. Escolha para qual Etapa eles vão antes de removê-la.");
    expect(document.body.textContent).not.toContain("Requisito");

    const confirmar = screen.getByRole("button", { name: "Remapear e remover" });
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
    expect(confirmar.getAttribute("title")).toBe("Escolha a Etapa de destino dos Negócios.");

    fireEvent.click(screen.getByRole("combobox", { name: "Etapa de destino" }));
    const opcoes = screen.getAllByRole("option").map((o) => o.textContent);
    expect(opcoes.some((t) => t?.includes("Proposta"))).toBe(true);
    expect(opcoes.some((t) => t?.includes("Novo"))).toBe(false);
    fireEvent.click(screen.getByRole("option", { name: /Proposta/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remapear e remover" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith("4 Negócios remapeados para “Proposta” e a Etapa foi removida."));
    expect(onClose).toHaveBeenCalledTimes(1);
    const [[url, init]] = escritas() as [[string, RequestInit]];
    expect(url).toBe("http://api/etapas/e1/remapear");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ paraEtapaId: "e2" });
  });

  it("(c) a recusa da api aparece no diálogo, que continua aberto", async () => {
    rotear(() => resposta(409, { ok: false, error: "Um Funil precisa de ao menos uma Etapa.", codigo: "ULTIMA_ETAPA" }));
    const onDone = vi.fn();
    const onClose = vi.fn();
    montar(<RemoveStageDialog funilId="f1" etapaId="e1" onClose={onClose} onDone={onDone} />);

    await escolher("Etapa de destino", /Proposta/);
    fireEvent.click(screen.getByRole("button", { name: "Remapear e remover" }));

    await screen.findByText("Um Funil precisa de ao menos uma Etapa.");
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("não abre sem Etapa escolhida na URL", () => {
    rotear(() => resposta(200, { ok: true, dados: ORIGEM }));
    montar(<RemoveStageDialog funilId="f1" etapaId={null} onClose={vi.fn()} onDone={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("MigrateFunnelDialog — migrar Negócios pela api", () => {
  it("(b) lista só Funis ativos que não são a origem, sugere o mapeamento e confirma por POST /migrar-negocios", async () => {
    rotear(() => resposta(200, { ok: true, dados: { migrados: 5 } }));
    const onDone = vi.fn();
    const onClose = vi.fn();
    montar(<MigrateFunnelDialog funilId="f1" open onClose={onClose} onDone={onDone} />);

    fireEvent.click(await screen.findByRole("combobox", { name: "Funil de destino" }));
    const destinos = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(destinos).toHaveLength(2);
    expect(destinos.some((t) => t.includes("Pós-venda"))).toBe(true);
    expect(destinos.some((t) => t.includes("Vazio"))).toBe(true);
    expect(destinos.some((t) => t.includes("Vendas"))).toBe(false);
    expect(destinos.some((t) => t.includes("Antigo"))).toBe(false);
    fireEvent.click(screen.getByRole("option", { name: /Pós-venda/ }));

    // Só as Etapas de origem COM Negócios ganham linha; "Arquivada" (zero) não.
    const linhaDeNovo = await screen.findByRole("combobox", { name: /Novo · 4 Negócios/ });
    expect(linhaDeNovo.textContent).toContain("novo");
    expect(screen.getByRole("combobox", { name: /Proposta · 1 Negócio →/ }).textContent).toContain("Lead");
    expect(screen.queryByRole("combobox", { name: /Arquivada/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Migrar Negócios" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith("5 Negócios migrados para “Pós-venda”."));
    expect(onClose).toHaveBeenCalledTimes(1);
    const [[url, init]] = escritas() as [[string, RequestInit]];
    expect(url).toBe("http://api/funis/f1/migrar-negocios");
    expect(JSON.parse(init.body as string)).toEqual({ paraFunilId: "f2", mapeamento: { e1: "g2", e2: "g1" } });
  });

  it("(b) trocar a Etapa sugerida muda o mapeamento enviado", async () => {
    rotear(() => resposta(200, { ok: true, dados: { migrados: 5 } }));
    montar(<MigrateFunnelDialog funilId="f1" open onClose={vi.fn()} onDone={vi.fn()} />);

    await escolher("Funil de destino", /Pós-venda/);
    await escolher("Proposta · 1 Negócio → destino", /Fechado/);
    fireEvent.click(screen.getByRole("button", { name: "Migrar Negócios" }));

    await waitFor(() => expect(escritas()).toHaveLength(1));
    expect(JSON.parse((escritas()[0] as [string, RequestInit])[1].body as string)).toEqual({
      paraFunilId: "f2",
      mapeamento: { e1: "g2", e2: "g3" },
    });
  });

  it("(c) sem destino, ou com mapeamento incompleto, Confirmar fica desligado com o motivo e nada é enviado", async () => {
    rotear(() => resposta(200, { ok: true, dados: { migrados: 0 } }));
    montar(<MigrateFunnelDialog funilId="f1" open onClose={vi.fn()} onDone={vi.fn()} />);

    const confirmar = await screen.findByRole("button", { name: "Migrar Negócios" });
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
    expect(confirmar.getAttribute("title")).toBe("Escolha o Funil de destino.");

    // Um destino sem Etapa não tem para onde mapear: a frase é a de `validarMigracao`.
    await escolher("Funil de destino", /Vazio/);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Migrar Negócios" }).getAttribute("title")).toBe(
        "Escolha a Etapa de destino de cada Etapa que tem Negócios.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Migrar Negócios" }));
    expect(escritas()).toHaveLength(0);
  });

  it("(c) a recusa 409 da api aparece no diálogo, que continua aberto", async () => {
    rotear(() =>
      resposta(409, { ok: false, error: "Só um Funil ativo recebe Negócios.", codigo: "MIGRACAO_INVALIDA", campo: "paraFunilId" }),
    );
    const onDone = vi.fn();
    const onClose = vi.fn();
    montar(<MigrateFunnelDialog funilId="f1" open onClose={onClose} onDone={onDone} />);

    await escolher("Funil de destino", /Pós-venda/);
    await screen.findByRole("combobox", { name: /Novo · 4 Negócios/ });
    fireEvent.click(screen.getByRole("button", { name: "Migrar Negócios" }));

    const caixa = (await screen.findByText("Só um Funil ativo recebe Negócios.")).closest('[role="alert"]') as HTMLElement;
    expect(within(caixa).getByText("Só um Funil ativo recebe Negócios.")).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("fechado, não lê nada da api", () => {
    rotear(() => resposta(200, { ok: true, dados: ORIGEM }));
    montar(<MigrateFunnelDialog funilId="f1" open={false} onClose={vi.fn()} onDone={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
