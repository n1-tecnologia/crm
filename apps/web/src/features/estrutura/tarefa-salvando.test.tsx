// @vitest-environment jsdom
/**
 * Fase 12, D-15 (GRV-05) — a Tarefa e a Subtarefa recém-criadas aparecem na hora,
 * mas só abrem depois de o servidor confirmar o id. `openTask` (o ponto único por
 * onde as lentes da Lista abrem uma Tarefa) ignora id pendente; a linha da Tarefa
 * na lente padrão é "salvando" (título não clicável, `aria-busy`, "Salvando…",
 * "Abrir em página cheia" desligado); a Subtarefa pendente aparece sem link.
 *
 * Molde de `pagina-da-lista-visualizacoes.test.tsx`: `StoreProvider` de verdade e
 * um transporte falso que o teste segura e solta.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import ListaPage from "@/app/(shell)/estrutura/listas/[lista]/page";
import { TarefaCompleta } from "@/features/estrutura/tarefa-completa";

const roteador = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/estrutura/listas/lst_prospeccao",
  useRouter: () => roteador,
  useSearchParams: () => new URLSearchParams(),
}));

const LISTA = "lst_prospeccao";
const TITULO = "Tarefa recém-criada";

let state: DataState;
let dono: string;
let soltar: () => void;
let seguranca: Promise<void> | null;

function segurar(): void {
  seguranca = new Promise<void>((resolver) => {
    soltar = resolver;
  });
}

beforeEach(() => {
  // `CorpoDeTela` mede o corpo com `ResizeObserver`, que o jsdom não traz.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  roteador.replace.mockClear();
  roteador.push.mockClear();
  state = buildSeed();
  dono = state.workspace.ownerMemberId;
  seguranca = null;
  soltar = () => undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function transporte(): Transporte {
  return {
    gravar: vi.fn(async (pedido): Promise<RespostaDeGravacao> => {
      if (seguranca) await seguranca;
      return {
        tipo: "estado",
        resultado: pedido.resultado,
        estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: {}, memberId: "" },
      };
    }),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
}

async function montarLista() {
  const params = Promise.resolve({ lista: LISTA });
  await act(async () => {
    render(
      <StoreProvider sessao={{ memberId: dono }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte()}>
        <Suspense fallback="carregando">
          <ListaPage params={params} />
        </Suspense>
      </StoreProvider>,
    );
  });
}

async function criarTarefaPeloCampo(titulo: string) {
  fireEvent.change(screen.getByLabelText("Título da nova Tarefa"), { target: { value: titulo } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
  });
}

/** O título da Tarefa pendente na tabela: o elemento que diz "salvando". */
const tituloSalvando = (): HTMLElement | null => document.querySelector<HTMLElement>("table [aria-busy='true'][title='Salvando…']");

const painelAbertoPara = (): string[] =>
  roteador.replace.mock.calls.map((chamada) => String(chamada[0])).filter((url) => /[?&]tarefa=/.test(url));

describe("a Tarefa nova na Lista — aparece salvando e só abre depois de confirmada (D-15, GRV-05)", () => {
  it("segurando o transporte: o título é 'salvando', não clicável, e clicar não abre o painel; soltando, vira o botão de sempre e abre", async () => {
    await montarLista();
    segurar();

    await criarTarefaPeloCampo(TITULO);

    const salvando = await waitFor(() => {
      const el = tituloSalvando();
      if (!el) throw new Error("a Tarefa pendente ainda não está na tabela como 'salvando'");
      return el;
    });
    expect(salvando.textContent).toContain(TITULO);
    expect(salvando.getAttribute("aria-busy")).toBe("true");
    expect(salvando.tagName).not.toBe("BUTTON");
    expect(within(document.querySelector("table") as HTMLElement).queryByRole("button", { name: TITULO })).toBeNull();

    // Clicar no título, e na linha inteira, não abre painel nenhum.
    fireEvent.click(salvando);
    fireEvent.click(salvando.closest("tr") as HTMLElement);
    expect(painelAbertoPara()).toEqual([]);

    // Soltando o transporte, a linha volta a ser a de sempre e abre.
    await act(async () => {
      soltar();
    });
    const botao = await waitFor(() => within(document.querySelector("table") as HTMLElement).getByRole("button", { name: TITULO }));
    expect(tituloSalvando()).toBeNull();
    fireEvent.click(botao);
    expect(painelAbertoPara()).toHaveLength(1);
  });

  it("'Abrir em página cheia' e 'Abrir detalhes' da linha pendente estão desligados com o motivo 'Salvando…'", async () => {
    await montarLista();
    segurar();
    await criarTarefaPeloCampo(TITULO);
    await waitFor(() => expect(tituloSalvando()).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: `Mais opções de ${TITULO}` }));
    const paginaCheia = screen.getByRole("menuitem", { name: /Abrir em página cheia/ });
    expect(paginaCheia.getAttribute("aria-disabled")).toBe("true");
    expect(paginaCheia.textContent).toContain("Salvando…");
    fireEvent.click(paginaCheia);
    expect(roteador.push).not.toHaveBeenCalled();

    const detalhes = screen.getByRole("menuitem", { name: /Abrir detalhes/ });
    expect(detalhes.getAttribute("aria-disabled")).toBe("true");
    expect(detalhes.textContent).toContain("Salvando…");

    await act(async () => {
      soltar();
    });
  });

  it("uma Tarefa de antes (já confirmada) continua abrindo normalmente", async () => {
    await montarLista();
    const existente = state.tasks.find((t) => t.listId === LISTA);
    if (!existente) throw new Error("o seed não tem Tarefa na Lista de prospecção");

    const botao = within(document.querySelector("table") as HTMLElement).getAllByRole("button", { name: existente.title })[0] as HTMLElement;
    fireEvent.click(botao);

    expect(painelAbertoPara()).toEqual([expect.stringContaining(`tarefa=${existente.id}`)]);
  });
});

describe("a Subtarefa nova na Tarefa aberta — aparece sem link até confirmar (D-15, GRV-05)", () => {
  it("segurando o transporte: a Subtarefa está na lista, sem link e aria-busy; soltando, ganha o link", async () => {
    const mae = state.tasks.find((t) => t.listId === LISTA && t.parentTaskId === undefined && t.lifecycle === "ativo");
    if (!mae) throw new Error("o seed não tem Tarefa-mãe ativa na Lista de prospecção");
    await act(async () => {
      render(
        <StoreProvider sessao={{ memberId: dono }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte()}>
          <TarefaCompleta taskId={mae.id} modo="popup" />
        </StoreProvider>,
      );
    });
    segurar();

    fireEvent.change(screen.getByPlaceholderText("Título da nova Subtarefa"), { target: { value: "Subtarefa recém-criada" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nova Subtarefa" }));
    });

    const salvando = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("li [aria-busy='true']");
      if (!el) throw new Error("a Subtarefa pendente ainda não está na lista como 'salvando'");
      return el;
    });
    expect(salvando.textContent).toContain("Subtarefa recém-criada");
    expect(salvando.closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: /Subtarefa recém-criada/ })).toBeNull();

    await act(async () => {
      soltar();
    });
    const link = await screen.findByRole("link", { name: /Subtarefa recém-criada/ });
    expect(link.getAttribute("href")).toMatch(/^\/estrutura\/tarefas\//);
    expect(document.querySelector("li [aria-busy='true']")).toBeNull();
  });
});
