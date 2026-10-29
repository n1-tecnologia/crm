// @vitest-environment jsdom
/**
 * Fase 10, 2.3.3 (D-08, D-09, D-10, EST-06) — «Subir»/«Descer» no menu de linha
 * da árvore, a ordem gravada na árvore e na página da Pasta, e o «Mais ações» da
 * Pasta. A casca de verdade (`AppShell`) sobre o `StoreProvider` de verdade e um
 * transporte falso que confirma: o que a tela mostra depois de reordenar é o que
 * o servidor devolveu, nunca o que a cópia aceitou.
 *
 * Molde de `mover-conteiner-dialog.test.tsx`.
 */

import { Suspense, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { MEUS_NEGOCIOS_ID } from "@n1/dominio/seed-comercial";
import type { Ordens } from "@n1/dominio";
import { containerAdminRefusal } from "@n1/dominio/derive";
import { createFolder, createList, recusaDeReordenar } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { AppShell } from "@/features/shell/app-shell";
import { MoverConteinerDialog } from "@/features/estrutura/mover-conteiner-dialog";
import PastaPage from "@/app/(shell)/estrutura/pastas/[pasta]/page";

// O robô flutuante mede a tela com APIs que o jsdom não tem, e o Guia do Financeiro não é o assunto aqui.
vi.mock("@/features/shell/robo-flutuante", () => ({ RoboFlutuante: () => null }));
vi.mock("@/features/financeiro/guia/guia-do-financeiro-dialogo", () => ({
  GuiaDoFinanceiro: () => null,
  abrirGuiaDoFinanceiro: () => undefined,
}));

vi.mock("next/navigation", async () => {
  const React = await import("react");
  let atuais = new URLSearchParams();
  const ouvintes = new Set<() => void>();
  const definir = (proximos: URLSearchParams) => {
    atuais = proximos;
    for (const ouvinte of ouvintes) ouvinte();
  };
  const assinar = (ouvinte: () => void) => {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  };
  return {
    usePathname: () => "/estrutura/espacos/spc_com",
    useRouter: () => ({
      replace: (url: string) => definir(new URLSearchParams(url.split("?")[1] ?? "")),
      push: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => React.useSyncExternalStore(assinar, () => atuais, () => atuais),
    __params: () => atuais,
    __definir: definir,
  };
});

async function enderecoAtual(): Promise<URLSearchParams> {
  const nav = (await import("next/navigation")) as unknown as { __params: () => URLSearchParams };
  return nav.__params();
}

async function limparEndereco() {
  const nav = (await import("next/navigation")) as unknown as { __definir: (p: URLSearchParams) => void };
  nav.__definir(new URLSearchParams());
}

function ordensDeTodasAsColecoes(estado: DataState): Ordens {
  const resultado: Ordens = {};
  for (const [colecao, valor] of Object.entries(estado)) {
    if (!Array.isArray(valor)) continue;
    const porId: Record<string, number> = {};
    valor.forEach((registro, indice) => {
      if (registro && typeof registro === "object" && "id" in registro) {
        porId[(registro as { readonly id: string }).id] = indice;
      }
    });
    resultado[colecao] = porId;
  }
  return resultado;
}

/** O que o servidor responde a cada gravação: confirma pondo a cópia como estado, ou recusa com a frase pedida. */
interface Servidor {
  readonly transporte: Transporte;
  readonly gravar: ReturnType<typeof vi.fn>;
  recusarCom: (frase: string | null) => void;
  segurar: () => () => void;
}

function servidorFalso(): Servidor {
  let recusa: string | null = null;
  let seguranca: Promise<void> | null = null;
  const gravar = vi.fn(async (pedido: { readonly copia: DataState; readonly revisao: number; readonly resultado: unknown }): Promise<RespostaDeGravacao> => {
    if (seguranca) await seguranca;
    if (recusa !== null) return { tipo: "falha", erro: recusa };
    return {
      tipo: "estado",
      resultado: pedido.resultado as never,
      estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: ordensDeTodasAsColecoes(pedido.copia), memberId: "" },
    };
  });
  return {
    transporte: {
      gravar: gravar as unknown as Transporte["gravar"],
      hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    },
    gravar,
    recusarCom: (frase) => {
      recusa = frase;
    },
    segurar: () => {
      let soltar: () => void = () => undefined;
      seguranca = new Promise<void>((resolver) => {
        soltar = resolver;
      });
      return () => {
        soltar();
        seguranca = null;
      };
    },
  };
}

let state: DataState;
let servidor: Servidor;

const THIAGO = "mem_thiago"; // Proprietário
const JULIA = "mem_julia"; // Papel de vendas: não administra
const BEATRIZ = "mem_beatriz"; // Convidada

function montar(ui: ReactElement, memberId = THIAGO) {
  return render(
    <StoreProvider
      sessao={{ memberId }}
      estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
      transporte={servidor.transporte}
    >
      {ui}
    </StoreProvider>,
  );
}

const pasta = (nome: string, parentId = "spc_com", parentType: "space" | "folder" = "space"): string => {
  const r = createFolder(state, THIAGO, { name: nome, parentType, parentId });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

const lista = (nome: string, parentId: string, parentType: "space" | "folder" = "folder"): string => {
  const r = createList(state, THIAGO, { name: nome, parentType, parentId });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

/** A linha da árvore pelo id do contêiner: o link `arvore-no-{id}` e a linha que o contém. */
function linha(id: string): HTMLElement {
  const link = document.getElementById(`arvore-no-${id}`);
  if (!link) throw new Error(`Sem linha da árvore para ${id}`);
  return link.parentElement as HTMLElement;
}

const temLinha = (id: string): boolean => document.getElementById(`arvore-no-${id}`) !== null;

/** Os ids dos filhos diretos de uma linha (Pasta ou Espaço), na ordem em que a árvore os desenha. */
function filhosDe(id: string): string[] {
  const itens = linha(id).closest("li")?.querySelectorAll(":scope > ul > li > div > a[id^='arvore-no-']") ?? [];
  return [...itens].map((a) => a.id.replace("arvore-no-", ""));
}

/** Os ids dos Espaços, na ordem da árvore. */
function espacosNaArvore(): string[] {
  return [...document.querySelectorAll("a[id^='arvore-no-spc_']")].map((a) => a.id.replace("arvore-no-", ""));
}

function abrirMenuDaLinha(id: string): HTMLElement[] {
  fireEvent.click(within(linha(id)).getByRole("button", { name: /^Ações de / }));
  return screen.queryAllByRole("menuitem");
}

const nomes = (itens: HTMLElement[]): string[] => itens.map((i) => i.querySelector("span.block")?.textContent ?? "");

function item(nome: string): HTMLElement {
  return screen.getByRole("menuitem", { name: nome });
}

const desligado = (el: HTMLElement): boolean => el.getAttribute("aria-disabled") === "true";

/** Três Listas numa Pasta nova, em `order` 0, 1, 2. */
function pastaComTresListas(): { pasta: string; alfa: string; beta: string; gama: string } {
  const p = pasta("Origem A");
  return { pasta: p, alfa: lista("Alfa", p), beta: lista("Beta", p), gama: lista("Gama", p) };
}

async function abrirArvore(memberId = THIAGO) {
  montar(<AppShell>{null}</AppShell>, memberId);
  await screen.findByRole("complementary", { name: "Navegação" });
}

beforeEach(async () => {
  // A casca mede o robô flutuante e a barra com observadores que o jsdom não traz.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state = buildSeed();
  servidor = servidorFalso();
  await limparEndereco();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Subir e Descer — o traçador: «Descer» na primeira Lista da Pasta reordena (EST-06)", () => {
  it("a árvore mostra as Listas, as Pastas e os Espaços na ordem de `order` (inverter `order` inverte a tela)", async () => {
    const { pasta: P, alfa, beta, gama } = pastaComTresListas();
    state.lists.find((l) => l.id === alfa)!.order = 2;
    state.lists.find((l) => l.id === gama)!.order = 0;
    // Pastas do Espaço Comercial: Clientes (0) e Propostas (1) trocam de lugar.
    state.folders.find((f) => f.id === "fld_clientes")!.order = 5;
    // Os Espaços: Comercial (0) passa para depois de Entrega (1).
    state.spaces.find((s) => s.id === "spc_com")!.order = 3;
    await abrirArvore();
    await waitFor(() => expect(temLinha(alfa)).toBe(true));

    expect(filhosDe(P)).toEqual([gama, beta, alfa]);
    const pastasDoEspaco = filhosDe("spc_com");
    expect(pastasDoEspaco.indexOf("fld_propostas")).toBeLessThan(pastasDoEspaco.indexOf("fld_clientes"));
    const espacos = espacosNaArvore();
    expect(espacos.indexOf("spc_ops")).toBeLessThan(espacos.indexOf("spc_com"));
  });

  it("«Descer» na primeira Lista grava `reorderContainers` com os ids visíveis do grupo e a árvore mostra a ordem nova, sem Toast", async () => {
    const { pasta: P, alfa, beta, gama } = pastaComTresListas();
    await abrirArvore();
    await waitFor(() => expect(temLinha(alfa)).toBe(true));
    expect(filhosDe(P)).toEqual([alfa, beta, gama]);

    abrirMenuDaLinha(alfa);
    fireEvent.click(item("Descer"));

    await waitFor(() => expect(filhosDe(P)).toEqual([beta, alfa, gama]));
    expect(servidor.gravar).toHaveBeenCalledTimes(1);
    const chamada = servidor.gravar.mock.calls[0]?.[0]?.chamadas[0];
    expect(chamada?.nome).toBe("reorderContainers");
    expect(chamada?.args).toEqual(["list", { type: "folder", id: P }, [beta, alfa, gama]]);
    // Sem Toast no sucesso: a linha mudar de lugar é o aviso.
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("«Subir» na primeira Lista está desligado com «Já está no topo.», e «Descer» na última com «Já está no fim.»", async () => {
    const { alfa, beta, gama } = pastaComTresListas();
    await abrirArvore();
    await waitFor(() => expect(temLinha(alfa)).toBe(true));

    abrirMenuDaLinha(alfa);
    expect(desligado(item("Subir"))).toBe(true);
    expect(item("Subir").getAttribute("title")).toBe("Já está no topo.");
    expect(desligado(item("Descer"))).toBe(false);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    cleanup();

    await abrirArvore();
    abrirMenuDaLinha(gama);
    expect(desligado(item("Descer"))).toBe(true);
    expect(item("Descer").getAttribute("title")).toBe("Já está no fim.");
    expect(desligado(item("Subir"))).toBe(false);
    cleanup();

    // No meio, os dois valem.
    await abrirArvore();
    abrirMenuDaLinha(beta);
    expect(desligado(item("Subir"))).toBe(false);
    expect(desligado(item("Descer"))).toBe(false);
  });

  it("o único irmão tem os dois desligados, cada um com o motivo", async () => {
    // «Propostas em curso» é a única Lista da Pasta «Propostas».
    await abrirArvore();
    await waitFor(() => expect(temLinha("lst_propostas")).toBe(true));

    abrirMenuDaLinha("lst_propostas");

    expect(desligado(item("Subir"))).toBe(true);
    expect(item("Subir").getAttribute("title")).toBe("Já está no topo.");
    expect(desligado(item("Descer"))).toBe(true);
    expect(item("Descer").getAttribute("title")).toBe("Já está no fim.");
  });

  it("as linhas de Espaço têm só «Subir» e «Descer»; as de Pasta, Subpasta e Lista têm «Mover para…», «Subir» e «Descer», nessa ordem", async () => {
    const { pasta: P, alfa } = pastaComTresListas();
    const sub = pasta("Sub A", P, "folder");
    await abrirArvore();
    await waitFor(() => expect(temLinha(alfa)).toBe(true));

    expect(nomes(abrirMenuDaLinha("spc_com"))).toEqual(["Subir", "Descer"]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    cleanup();
    await abrirArvore();
    expect(nomes(abrirMenuDaLinha(P))).toEqual(["Mover para…", "Subir", "Descer"]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    cleanup();
    await abrirArvore();
    expect(nomes(abrirMenuDaLinha(sub))).toEqual(["Mover para…", "Subir", "Descer"]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    cleanup();
    await abrirArvore();
    expect(nomes(abrirMenuDaLinha(alfa))).toEqual(["Mover para…", "Subir", "Descer"]);
  });

  it("«Descer» no Espaço Comercial manda os Espaços que o Membro alcança, com `pai: null`, e a árvore mostra a ordem nova", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha("spc_com")).toBe(true));
    const antes = espacosNaArvore();
    expect(antes.slice(0, 2)).toEqual(["spc_com", "spc_ops"]);

    abrirMenuDaLinha("spc_com");
    fireEvent.click(item("Descer"));

    await waitFor(() => expect(espacosNaArvore().slice(0, 2)).toEqual(["spc_ops", "spc_com"]));
    const chamada = servidor.gravar.mock.calls[0]?.[0]?.chamadas[0];
    expect(chamada?.nome).toBe("reorderContainers");
    expect(chamada?.args[0]).toBe("space");
    expect(chamada?.args[1]).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Subir e Descer — a fatia visível, a falha e a gravação (EST-06, T-10-50, T-10-51)", () => {
  it("o que a árvore esconde fica no lugar: uma Lista na lixeira entre duas visíveis não entra no pedido nem sai do lugar", async () => {
    // «Ativação» (order 0) e «Piloto de onboarding» (order 1, na lixeira) já moram em fld_ativacao.
    const nova = lista("Nova", "fld_ativacao");
    await abrirArvore();
    await waitFor(() => expect(temLinha("lst_ativacao")).toBe(true));
    expect(temLinha("lst_piloto")).toBe(false);
    expect(filhosDe("fld_ativacao")).toEqual(["lst_ativacao", nova]);

    abrirMenuDaLinha("lst_ativacao");
    fireEvent.click(item("Descer"));

    await waitFor(() => expect(filhosDe("fld_ativacao")).toEqual([nova, "lst_ativacao"]));
    const pedido = servidor.gravar.mock.calls[0]?.[0];
    expect(pedido?.chamadas[0]?.args[2]).toEqual([nova, "lst_ativacao"]);
    // O escondido continua na vaga do meio.
    const grupo = (pedido.copia as DataState).lists.filter((l) => l.parentId === "fld_ativacao").sort((a, b) => a.order - b.order);
    expect(grupo.map((l) => l.id)).toEqual([nova, "lst_piloto", "lst_ativacao"]);
  });

  it("a recusa do servidor vai ao Toast de erro com a frase, e a árvore fica como estava", async () => {
    const { pasta: P, alfa, beta, gama } = pastaComTresListas();
    servidor.recusarCom("Outra pessoa mexeu na ordem desta Pasta.");
    await abrirArvore();
    await waitFor(() => expect(temLinha(alfa)).toBe(true));

    abrirMenuDaLinha(alfa);
    fireEvent.click(item("Descer"));

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("Outra pessoa mexeu na ordem desta Pasta.");
    expect(filhosDe(P)).toEqual([alfa, beta, gama]);
  });

  it("durante a gravação a árvore fica aria-busy e os itens de ordem e de mover não permitem um segundo comando", async () => {
    const { pasta: P, alfa, beta, gama } = pastaComTresListas();
    const soltar = servidor.segurar();
    await abrirArvore();
    await waitFor(() => expect(temLinha(alfa)).toBe(true));
    const raiz = linha("spc_com").closest("ul") as HTMLElement;
    expect(raiz.getAttribute("aria-busy")).toBeNull();

    abrirMenuDaLinha(alfa);
    fireEvent.click(item("Descer"));

    await waitFor(() => expect(raiz.getAttribute("aria-busy")).toBe("true"));
    // A tela ainda não mudou: só muda quando o servidor responde.
    expect(filhosDe(P)).toEqual([alfa, beta, gama]);
    abrirMenuDaLinha(beta);
    for (const nome of ["Mover para…", "Subir", "Descer"]) {
      expect(desligado(item(nome))).toBe(true);
      fireEvent.click(item(nome));
    }
    expect(servidor.gravar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await act(async () => {
      soltar();
    });
    await waitFor(() => expect(raiz.getAttribute("aria-busy")).toBeNull());
    expect(filhosDe(P)).toEqual([beta, alfa, gama]);
  });

  it("com a Pasta arquivada (aberta por «Mostrar arquivados»), «Subir» e «Descer» ficam desligados com a frase de `recusaDeReordenar`", async () => {
    const { pasta: P, alfa } = pastaComTresListas();
    state.folders.find((f) => f.id === P)!.lifecycle = "arquivado";
    const frase = recusaDeReordenar(state, THIAGO, "list", { type: "folder", id: P });
    expect(frase).toBeTruthy();
    await abrirArvore();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar arquivados" }));
    await waitFor(() => expect(temLinha(alfa)).toBe(true));

    abrirMenuDaLinha(alfa);

    for (const nome of ["Subir", "Descer"]) {
      expect(desligado(item(nome))).toBe(true);
      expect(item(nome).getAttribute("title")).toBe(frase);
    }
  });

  it("o Membro que não administra os Espaços vê «Subir» e «Descer» do Espaço desligados com a frase do domínio (T-10-50)", async () => {
    const frase = recusaDeReordenar(state, JULIA, "space", null);
    expect(frase).toBeTruthy();
    await abrirArvore(JULIA);
    await waitFor(() => expect(temLinha("spc_com")).toBe(true));

    abrirMenuDaLinha("spc_com");

    for (const nome of ["Subir", "Descer"]) {
      expect(desligado(item(nome))).toBe(true);
      expect(item(nome).getAttribute("title")).toBe(frase);
    }
    fireEvent.click(item("Descer"));
    expect(servidor.gravar).not.toHaveBeenCalled();
  });

  it("a Pasta Meus negócios e as Listas dela não ganham «⋯» (A9), e a vizinha fora dela, sim", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha(MEUS_NEGOCIOS_ID)).toBe(true));

    expect(within(linha(MEUS_NEGOCIOS_ID)).queryByRole("button", { name: /^Ações de / })).toBeNull();
    const dela = state.lists.filter((l) => l.parentId === MEUS_NEGOCIOS_ID && temLinha(l.id));
    expect(dela.length).toBeGreaterThan(0);
    for (const l of dela) expect(within(linha(l.id)).queryByRole("button", { name: /^Ações de / })).toBeNull();
    expect(within(linha("lst_prospeccao")).queryByRole("button", { name: /^Ações de / })).not.toBeNull();
  });

  it("o Convidado vê a árvore inerte como hoje: nenhuma linha tem «⋯»", async () => {
    const ALFA = lista("Alfa", pasta("Origem A"));
    for (const [resourceType, resourceId] of [["space", "spc_com"], ["list", ALFA]] as const) {
      state.grants.push({
        id: `gr_teste_${resourceId}`,
        workspaceId: state.workspace.id,
        subjectKind: "member",
        subjectId: BEATRIZ,
        action: "ver",
        resourceType,
        resourceId,
        scope: "subarvore",
        origin: "compartilhamento",
        grantedBy: THIAGO,
        grantedAt: new Date().toISOString(),
      });
    }
    montar(<AppShell>{null}</AppShell>, BEATRIZ);
    const painel = await screen.findByRole("complementary", { name: "Navegação" });
    await waitFor(() => expect(within(painel).getByText("Alfa")).toBeTruthy());

    expect(within(painel).queryAllByRole("button", { name: /^Ações de / })).toHaveLength(0);
  });
});

describe("A árvore em telas sem hover (A7)", () => {
  it("o «+» e o «⋯» de cada linha ficam sempre visíveis sob `(hover: none)`", async () => {
    const { alfa } = pastaComTresListas();
    await abrirArvore();
    await waitFor(() => expect(temLinha(alfa)).toBe(true));

    const mais = within(linha(alfa)).getByRole("button", { name: `Criar dentro de Alfa` }).closest("span.shrink-0");
    const acoes = within(linha(alfa)).getByRole("button", { name: "Ações de Alfa" }).closest("span.shrink-0");
    for (const envoltorio of [mais, acoes]) {
      expect(envoltorio?.className).toContain("[@media(hover:none)]:opacity-100");
      // Continua escondido sem hover nem foco quando há ponteiro.
      expect(envoltorio?.className).toContain("opacity-0");
    }
  });
});

describe("A página da Pasta e da Subpasta (D-10, A8-bis, F2)", () => {
  async function montarPagina(pastaId: string, memberId = THIAGO) {
    const params = Promise.resolve({ pasta: pastaId });
    await act(async () => {
      render(
        <StoreProvider
          sessao={{ memberId }}
          estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
          transporte={servidor.transporte}
        >
          <Suspense fallback="carregando">
            <PastaPage params={params} />
          </Suspense>
          <MoverConteinerDialog />
        </StoreProvider>,
      );
    });
  }

  const idsDeListas = (): string[] =>
    screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/estrutura/listas/"))
      .map((h) => h.replace("/estrutura/listas/", ""));

  const idsDePastas = (): string[] =>
    screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/estrutura/pastas/") && !h.endsWith("/configuracoes"))
      .map((h) => h.replace("/estrutura/pastas/", ""));

  it("mostra as Listas e as Subpastas na ordem gravada (inverter `order` inverte a página)", async () => {
    const { pasta: P, alfa, beta, gama } = pastaComTresListas();
    const s1 = pasta("Sub 1", P, "folder");
    const s2 = pasta("Sub 2", P, "folder");
    state.lists.find((l) => l.id === alfa)!.order = 2;
    state.lists.find((l) => l.id === gama)!.order = 0;
    state.folders.find((f) => f.id === s1)!.order = 1;
    state.folders.find((f) => f.id === s2)!.order = 0;

    await montarPagina(P);

    expect(idsDeListas()).toEqual([gama, beta, alfa]);
    expect(idsDePastas()).toEqual([s2, s1]);
  });

  it("«Mais ações» vem depois de «Configurações» e de «Criar» e «Mover para…» abre o diálogo da Pasta", async () => {
    const { pasta: P } = pastaComTresListas();
    await montarPagina(P);

    const configuracoes = screen.getByRole("link", { name: /Configurações/ });
    const criar = screen.getByRole("button", { name: "Criar nesta Pasta" });
    const mais = screen.getByRole("button", { name: "Mais ações" });
    expect(configuracoes.compareDocumentPosition(criar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(criar.compareDocumentPosition(mais) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mais.className).toContain("btn-icone");

    fireEvent.click(mais);
    expect(nomes(screen.getAllByRole("menuitem"))).toEqual(["Mover para…"]);
    fireEvent.click(item("Mover para…"));

    expect(await screen.findByRole("alertdialog", { name: "Mover “Origem A”" })).toBeTruthy();
    expect((await enderecoAtual()).get("mover")).toBe(P);
  });

  it("a Subpasta também tem «Mais ações»", async () => {
    const { pasta: P } = pastaComTresListas();
    const sub = pasta("Sub A", P, "folder");
    await montarPagina(sub);

    fireEvent.click(screen.getByRole("button", { name: "Mais ações" }));

    expect(nomes(screen.getAllByRole("menuitem"))).toEqual(["Mover para…"]);
  });

  it("o Membro que não administra vê «Mover para…» desligado com a frase de `containerAdminRefusal`", async () => {
    const { pasta: P } = pastaComTresListas();
    const frase = containerAdminRefusal(state, JULIA, "folder", P);
    expect(frase).toBeTruthy();
    await montarPagina(P, JULIA);

    fireEvent.click(screen.getByRole("button", { name: "Mais ações" }));

    expect(desligado(item("Mover para…"))).toBe(true);
    expect(item("Mover para…").getAttribute("title")).toBe(frase);
    fireEvent.click(item("Mover para…"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("a Pasta Meus negócios não tem «Mais ações» (A9)", async () => {
    await montarPagina(MEUS_NEGOCIOS_ID);

    expect(screen.queryByRole("button", { name: "Mais ações" })).toBeNull();
    // O controle: o botão «Criar» da Pasta continua lá.
    expect(screen.getByRole("button", { name: "Criar nesta Pasta" })).toBeTruthy();
  });

  it("EST-06: «Descer» na primeira Lista troca a ordem na árvore e na página da Pasta, no mesmo estado", async () => {
    const { pasta: P, alfa, beta, gama } = pastaComTresListas();
    const params = Promise.resolve({ pasta: P });
    await act(async () => {
      montar(
        <>
          <AppShell>{null}</AppShell>
          <div data-testid="pagina">
            <Suspense fallback="carregando">
              <PastaPage params={params} />
            </Suspense>
          </div>
        </>,
      );
    });
    await waitFor(() => expect(temLinha(alfa)).toBe(true));
    const pagina = screen.getByTestId("pagina");
    const naPagina = (): string[] =>
      within(pagina)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href") ?? "")
        .filter((h) => h.startsWith("/estrutura/listas/"))
        .map((h) => h.replace("/estrutura/listas/", ""));
    expect(filhosDe(P)).toEqual([alfa, beta, gama]);
    expect(naPagina()).toEqual([alfa, beta, gama]);

    abrirMenuDaLinha(alfa);
    fireEvent.click(item("Descer"));

    await waitFor(() => expect(filhosDe(P)).toEqual([beta, alfa, gama]));
    expect(naPagina()).toEqual([beta, alfa, gama]);
  });
});
