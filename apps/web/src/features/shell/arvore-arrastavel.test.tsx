// @vitest-environment jsdom
/**
 * Fase 10, 2.3.3 item 1 (D-08, D-09, D-10, D-12, EST-06) — arrastar na árvore
 * da Estrutura. A casca de verdade (`AppShell`) sobre o `StoreProvider` de
 * verdade e um transporte falso que confirma: o que a tela mostra depois de
 * soltar é o que o servidor devolveu, nunca o que a cópia aceitou.
 *
 * Os eventos são os do HTML5 nativo (`dragstart`, `dragover`, `drop`, `dragend`)
 * disparados por `fireEvent`. O jsdom zera `getBoundingClientRect` e não traz
 * `DragEvent`, então cada teste entrega à linha o retângulo e o `clientY`.
 *
 * Molde de `arvore-menu.test.tsx` (10-19) e de `quadro-do-funil.test.tsx`.
 */

import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { MEUS_NEGOCIOS_ID } from "@n1/dominio/seed-comercial";
import type { Ordens } from "@n1/dominio";
import { createFolder, createList, recusaDeMover } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { AppShell } from "@/features/shell/app-shell";
import { TIPO_DE_ARRASTO } from "@/features/shell/arrastar-na-arvore";

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
  segurar: () => () => void;
}

function servidorFalso(): Servidor {
  let seguranca: Promise<void> | null = null;
  const gravar = vi.fn(async (pedido: { readonly copia: DataState; readonly revisao: number; readonly resultado: unknown }): Promise<RespostaDeGravacao> => {
    if (seguranca) await seguranca;
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

/** A linha da árvore pelo id do contêiner: o link `arvore-no-{id}` e a `div` da linha que o contém. */
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

/** O pai visível da linha: o id da Pasta ou do Espaço cujo `ul` a contém. */
const paiNaArvore = (id: string): string | undefined =>
  linha(id).closest("li")?.parentElement?.closest("li")?.querySelector("a")?.id.replace("arvore-no-", "");

async function abrirArvore(memberId = THIAGO) {
  montar(<AppShell>{null}</AppShell>, memberId);
  await screen.findByRole("complementary", { name: "Navegação" });
}

/* ─────────────────────────────────────────────── o gesto, evento a evento */

const transferenciaFalsa = () => ({ effectAllowed: "uninitialized", dropEffect: "none", setData: vi.fn(), getData: vi.fn(() => ""), types: [] as string[] });

/** Dá à linha o retângulo que o jsdom não calcula: 100px de altura a partir do topo. */
function medir(el: HTMLElement) {
  el.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) });
}

function comecar(id: string) {
  const transferencia = transferenciaFalsa();
  fireEvent.dragStart(linha(id), { dataTransfer: transferencia });
  return transferencia;
}

/** `dragover` com o ponteiro a `y`% da altura da linha. Devolve `true` se a zona foi ACEITA (o evento foi cancelado). */
function passarSobre(id: string, y: number): boolean {
  const el = linha(id);
  medir(el);
  const evento = createEvent.dragOver(el, { dataTransfer: transferenciaFalsa() });
  Object.defineProperty(evento, "clientY", { value: y });
  return !fireEvent(el, evento);
}

function soltarEm(id: string, y: number) {
  const el = linha(id);
  medir(el);
  const evento = createEvent.drop(el, { dataTransfer: transferenciaFalsa() });
  Object.defineProperty(evento, "clientY", { value: y });
  fireEvent(el, evento);
}

const zonaAcesa = (id: string): string | null => linha(id).getAttribute("data-soltura");

/** Arrasta `de` até `para` (no ponto `y`%) e solta. */
function arrastarPara(de: string, para: string, y: number) {
  comecar(de);
  expect(passarSobre(para, y)).toBe(true);
  soltarEm(para, y);
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Arrastar na árvore — o traçador: a Lista \"Propostas\" vai para a Pasta \"Clientes\" (EST-06)", () => {
  it("soltar «dentro» da Pasta move pelo domínio, avisa só depois da resposta do servidor e a árvore mostra o lugar novo", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    const soltar = servidor.segurar();
    await abrirArvore();
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));
    expect(paiNaArvore(PROPOSTAS)).toBe("fld_propostas");

    comecar(PROPOSTAS);
    expect(passarSobre("fld_clientes", 50)).toBe(true);
    expect(zonaAcesa("fld_clientes")).toBe("dentro");
    soltarEm("fld_clientes", 50);

    // O servidor ainda não respondeu: a árvore está ocupada, o aviso não existe, a tela não mudou.
    await waitFor(() => expect(servidor.gravar).toHaveBeenCalledTimes(1));
    expect(document.querySelector("ul[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("Lista Propostas movida para Clientes.")).toBeNull();
    expect(paiNaArvore(PROPOSTAS)).toBe("fld_propostas");

    await act(async () => soltar());

    await waitFor(() => expect(screen.getByText("Lista Propostas movida para Clientes.")).toBeTruthy());
    const chamada = servidor.gravar.mock.calls[0]?.[0]?.chamadas[0];
    expect(chamada?.nome).toBe("moveContainer");
    expect(chamada?.args.slice(0, 3)).toEqual(["list", PROPOSTAS, { parentType: "folder", parentId: "fld_clientes" }]);
    expect(paiNaArvore(PROPOSTAS)).toBe("fld_clientes");
    expect(document.querySelector("ul[aria-busy='true']")).toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe(`arvore-no-${PROPOSTAS}`));
    // O gesto terminou: nenhum realce, nenhum diálogo, nenhum erro.
    expect(zonaAcesa("fld_clientes")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a `div` da linha é arrastável, o `Link` não (A10-bis), e o início do gesto leva só `move` e o tipo próprio (D-12)", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    await abrirArvore();
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));

    expect(linha(PROPOSTAS).getAttribute("draggable")).toBe("true");
    expect(document.getElementById(`arvore-no-${PROPOSTAS}`)?.getAttribute("draggable")).toBe("false");

    const transferencia = comecar(PROPOSTAS);

    expect(transferencia.effectAllowed).toBe("move");
    expect(transferencia.setData).toHaveBeenCalledTimes(1);
    expect(transferencia.setData).toHaveBeenCalledWith(TIPO_DE_ARRASTO, PROPOSTAS);
    expect(TIPO_DE_ARRASTO).toBe("application/x-n1-conteiner");
    // A origem fica a 60%.
    expect(linha(PROPOSTAS).style.opacity).toBe("0.6");
  });

  it("`dragend` apaga a origem e o realce, sem gravar", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    await abrirArvore();
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));

    comecar(PROPOSTAS);
    passarSobre("fld_clientes", 50);
    expect(zonaAcesa("fld_clientes")).toBe("dentro");

    fireEvent.dragEnd(linha(PROPOSTAS));

    expect(zonaAcesa("fld_clientes")).toBeNull();
    expect(linha(PROPOSTAS).style.opacity).toBe("");
    expect(servidor.gravar).not.toHaveBeenCalled();
  });

  it("um arrasto que não saiu da árvore (outra aba, um arquivo) não acende zona nem aceita a soltura (T-10-33)", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha("fld_clientes")).toBe(true));

    expect(passarSobre("fld_clientes", 50)).toBe(false);
    expect(zonaAcesa("fld_clientes")).toBeNull();
    soltarEm("fld_clientes", 50);

    expect(servidor.gravar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Arrastar na árvore — reordenar, Espaços, diálogo, recusa e árvore inerte", () => {
  let P: string;
  let ALFA: string;
  let BETA: string;
  let GAMA: string;
  beforeEach(() => {
    P = pasta("Origem A");
    ALFA = lista("Alfa", P);
    BETA = lista("Beta", P);
    GAMA = lista("Gama", P);
  });

  it("soltar a Lista Gama em «antes» de Alfa (mesmo pai) grava `reorderContainers` com os ids visíveis do grupo, sem Toast", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha(GAMA)).toBe(true));
    expect(filhosDe(P)).toEqual([ALFA, BETA, GAMA]);

    comecar(GAMA);
    expect(passarSobre(ALFA, 10)).toBe(true);
    expect(zonaAcesa(ALFA)).toBe("antes");
    soltarEm(ALFA, 10);

    await waitFor(() => expect(filhosDe(P)).toEqual([GAMA, ALFA, BETA]));
    const chamada = servidor.gravar.mock.calls[0]?.[0]?.chamadas[0];
    expect(chamada?.nome).toBe("reorderContainers");
    expect(chamada?.args).toEqual(["list", { type: "folder", id: P }, [GAMA, ALFA, BETA]]);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("soltar em «depois» de Beta põe a Lista logo depois dela", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha(ALFA)).toBe(true));

    arrastarPara(ALFA, BETA, 90);

    await waitFor(() => expect(filhosDe(P)).toEqual([BETA, ALFA, GAMA]));
    expect(servidor.gravar.mock.calls[0]?.[0]?.chamadas[0]?.args[2]).toEqual([BETA, ALFA, GAMA]);
  });

  it("soltar onde a Lista já está («depois» da vizinha de cima) não grava nada", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha(BETA)).toBe(true));

    arrastarPara(BETA, ALFA, 90);

    expect(servidor.gravar).not.toHaveBeenCalled();
    expect(filhosDe(P)).toEqual([ALFA, BETA, GAMA]);
  });

  it("o que a árvore esconde (Lista na lixeira) não entra no pedido e continua na vaga (UI S1/parcial)", async () => {
    state.lists.find((l) => l.id === BETA)!.lifecycle = "naLixeira";
    await abrirArvore();
    await waitFor(() => expect(temLinha(GAMA)).toBe(true));
    expect(filhosDe(P)).toEqual([ALFA, GAMA]);

    arrastarPara(GAMA, ALFA, 10);

    await waitFor(() => expect(filhosDe(P)).toEqual([GAMA, ALFA]));
    expect(servidor.gravar.mock.calls[0]?.[0]?.chamadas[0]?.args).toEqual(["list", { type: "folder", id: P }, [GAMA, ALFA]]);
    expect(state.lists.find((l) => l.id === BETA)?.lifecycle).toBe("naLixeira");
  });

  it("soltar um Espaço em «depois» de outro reordena os Espaços (`pai: null`), e um Espaço nunca recebe «dentro» (D-09)", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha("spc_com")).toBe(true));
    expect(espacosNaArvore().slice(0, 2)).toEqual(["spc_com", "spc_ops"]);

    comecar("spc_com");
    // Na metade de baixo do Espaço vizinho: «depois», não «dentro»; sobre uma Pasta ou Lista, nada.
    expect(passarSobre("spc_ops", 90)).toBe(true);
    expect(zonaAcesa("spc_ops")).toBe("depois");
    expect(passarSobre("fld_clientes", 50)).toBe(false);
    expect(zonaAcesa("fld_clientes")).toBeNull();
    expect(zonaAcesa("spc_ops")).toBeNull();
    expect(passarSobre("spc_ops", 90)).toBe(true);
    soltarEm("spc_ops", 90);

    await waitFor(() => expect(espacosNaArvore().slice(0, 2)).toEqual(["spc_ops", "spc_com"]));
    const chamada = servidor.gravar.mock.calls[0]?.[0]?.chamadas[0];
    expect(chamada?.nome).toBe("reorderContainers");
    expect(chamada?.args[0]).toBe("space");
    expect(chamada?.args[1]).toBeNull();
  });

  it("soltar uma Pasta com Subpastas «dentro» de outra Pasta mostra a recusa do domínio no Toast de erro e nada muda", async () => {
    const A = pasta("Pasta A");
    pasta("Sub de A", A, "folder");
    const B = pasta("Pasta B");
    const recusa = recusaDeMover(state, THIAGO, "folder", A, { parentType: "folder", parentId: B });
    expect(recusa).toBeTruthy();
    await abrirArvore();
    await waitFor(() => expect(temLinha(B)).toBe(true));
    const antes = filhosDe("spc_com");

    comecar(A);
    // A Pasta B é irmã de A: 50% é «dentro» e o alvo acende, mesmo sabendo que o domínio vai recusar (A2).
    expect(passarSobre(B, 50)).toBe(true);
    expect(zonaAcesa(B)).toBe("dentro");
    soltarEm(B, 50);

    const aviso = await screen.findByRole("alert");
    expect(aviso.textContent).toContain(recusa);
    expect(servidor.gravar).not.toHaveBeenCalled();
    expect(filhosDe("spc_com")).toEqual(antes);
    expect(paiNaArvore(A)).toBe("spc_com");
  });

  it("soltar uma Lista «dentro» de um Espaço com outro Conjunto de Status abre o diálogo de mover com o destino escolhido, e nada muda até confirmar", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha(ALFA)).toBe(true));

    arrastarPara(ALFA, "spc_ops", 50);

    const dialogo = await screen.findByRole("alertdialog", { name: "Mover “Alfa”" });
    expect(dialogo).toBeTruthy();
    const endereco = await enderecoAtual();
    expect(endereco.get("mover")).toBe(ALFA);
    expect(endereco.get("destino")).toBe("spc_ops");
    expect(servidor.gravar).not.toHaveBeenCalled();
    expect(paiNaArvore(ALFA)).toBe(P);
    expect(screen.queryByText(/movida para/)).toBeNull();
  });

  it("soltar em cima do próprio pai não é alvo: sem realce, sem Toast, sem gravar (A10)", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha(ALFA)).toBe(true));

    comecar(ALFA);
    expect(passarSobre(P, 50)).toBe(false);
    expect(zonaAcesa(P)).toBeNull();
    soltarEm(P, 50);

    expect(servidor.gravar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(paiNaArvore(ALFA)).toBe(P);
  });

  it("durante a gravação a árvore fica `aria-busy` e nenhuma linha começa novo arraste nem aceita soltura (A4)", async () => {
    const soltar = servidor.segurar();
    await abrirArvore();
    await waitFor(() => expect(temLinha(ALFA)).toBe(true));

    arrastarPara(GAMA, ALFA, 10);
    await waitFor(() => expect(servidor.gravar).toHaveBeenCalledTimes(1));
    expect(document.querySelector("ul[aria-busy='true']")).not.toBeNull();

    // Um novo arraste não começa: o início é cancelado e nenhuma zona é aceita.
    const iniciado = fireEvent.dragStart(linha(BETA), { dataTransfer: transferenciaFalsa() });
    expect(iniciado).toBe(false);
    expect(passarSobre(ALFA, 10)).toBe(false);
    soltarEm(ALFA, 10);
    expect(servidor.gravar).toHaveBeenCalledTimes(1);

    await act(async () => soltar());
    await waitFor(() => expect(document.querySelector("ul[aria-busy='true']")).toBeNull());
    expect(filhosDe(P)).toEqual([GAMA, ALFA, BETA]);
  });

  it("a Pasta «Meus negócios» e as Listas dela não arrastam nem recebem soltura (A9)", async () => {
    await abrirArvore();
    await waitFor(() => expect(temLinha(MEUS_NEGOCIOS_ID)).toBe(true));
    const listaDeNegocios = filhosDe(MEUS_NEGOCIOS_ID)[0];
    expect(listaDeNegocios).toBeTruthy();

    expect(linha(MEUS_NEGOCIOS_ID).getAttribute("draggable")).toBeNull();
    expect(linha(listaDeNegocios!).getAttribute("draggable")).toBeNull();

    comecar(ALFA);
    expect(passarSobre(MEUS_NEGOCIOS_ID, 50)).toBe(false);
    expect(zonaAcesa(MEUS_NEGOCIOS_ID)).toBeNull();
    soltarEm(MEUS_NEGOCIOS_ID, 50);
    expect(servidor.gravar).not.toHaveBeenCalled();
  });

  it("o Convidado vê a árvore inerte: nenhuma linha é arrastável e a soltura não grava (D-09)", async () => {
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

    expect(painel.querySelectorAll("[draggable='true']")).toHaveLength(0);
    expect(painel.querySelectorAll("[data-soltura]")).toHaveLength(0);
    const alfa = within(painel).getByText("Alfa").closest("div") as HTMLElement;
    fireEvent.dragStart(alfa, { dataTransfer: transferenciaFalsa() });
    fireEvent.drop(alfa, { dataTransfer: transferenciaFalsa() });
    expect(servidor.gravar).not.toHaveBeenCalled();
  });

  it("o Membro que não administra não arrasta nenhuma linha", async () => {
    await abrirArvore(JULIA);
    const painel = await screen.findByRole("complementary", { name: "Navegação" });
    await waitFor(() => expect(painel.querySelectorAll("a[id^='arvore-no-']").length).toBeGreaterThan(0));

    expect(painel.querySelectorAll("[draggable='true']")).toHaveLength(0);
  });

  it("Pasta fechada sob o ponteiro por 600 ms (ABRIR_AO_PAIRAR_MS) abre uma vez; antes disso, não", async () => {
    const dentro = lista("Dentro de Clientes", "fld_clientes");
    await abrirArvore();
    await waitFor(() => expect(temLinha(dentro)).toBe(true));
    fireEvent.click(within(linha("fld_clientes")).getByRole("button", { name: "Recolher Clientes" }));
    expect(temLinha(dentro)).toBe(false);
    comecar(ALFA);

    vi.useFakeTimers();
    act(() => {
      passarSobre("fld_clientes", 50);
    });
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(temLinha(dentro)).toBe(false);
    // O ponteiro continua sobre a linha: os `dragover` seguintes não rearmam nem adiantam o temporizador.
    act(() => {
      passarSobre("fld_clientes", 50);
      vi.advanceTimersByTime(1);
    });
    expect(temLinha(dentro)).toBe(true);
    expect(within(linha("fld_clientes")).getByRole("button", { name: "Recolher Clientes" })).toBeTruthy();
  });

  it("sair da Pasta fechada antes dos 600 ms cancela a abertura", async () => {
    const dentro = lista("Dentro de Clientes", "fld_clientes");
    await abrirArvore();
    await waitFor(() => expect(temLinha(dentro)).toBe(true));
    fireEvent.click(within(linha("fld_clientes")).getByRole("button", { name: "Recolher Clientes" }));
    comecar(ALFA);

    vi.useFakeTimers();
    act(() => {
      passarSobre("fld_clientes", 50);
      vi.advanceTimersByTime(400);
      // Passa para uma linha que não é alvo: o temporizador morre.
      passarSobre(P, 50);
      vi.advanceTimersByTime(1000);
    });

    expect(temLinha(dentro)).toBe(false);
  });
});
