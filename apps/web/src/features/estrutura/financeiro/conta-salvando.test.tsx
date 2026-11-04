// @vitest-environment jsdom
/**
 * Fase 12, D-15 (GRV-05) — a Conta recém-criada na lente financeira aparece na
 * hora, mas "Editar conta (página completa)" faz `router.push` direto para
 * `/estrutura/tarefas/<id>`: um caminho que a guarda de âncoras não alcança.
 * Enquanto o servidor não confirma o id, o item fica desligado com o motivo
 * "Salvando…"; depois da confirmação, navega como sempre.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { CP, createTask } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider, useRun } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import ListaPage from "@/app/(shell)/estrutura/listas/[lista]/page";

const roteador = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/estrutura/listas/lst_contas_a_pagar",
  useRouter: () => roteador,
  useSearchParams: () => new URLSearchParams(),
}));

const TITULO = "Conta recém-criada";

let state: DataState;
let dono: string;
let soltar: () => void;
let seguranca: Promise<void> | null;

beforeEach(() => {
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
  seguranca = new Promise<void>((resolver) => {
    soltar = resolver;
  });
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

function Criador() {
  const run = useRun();
  return (
    <button type="button" onClick={() => run((estado, quem) => createTask(estado, quem, { listId: CP.listId, title: TITULO }))}>
      criar-conta
    </button>
  );
}

async function montar() {
  const params = Promise.resolve({ lista: CP.listId });
  await act(async () => {
    render(
      <StoreProvider sessao={{ memberId: dono }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte()}>
        <Criador />
        <Suspense fallback="carregando">
          <ListaPage params={params} />
        </Suspense>
      </StoreProvider>,
    );
  });
}

const abrirMenuDaConta = (titulo: string) => {
  const tabela = document.querySelector("table") as HTMLElement;
  fireEvent.click(within(tabela).getAllByRole("button", { name: `Mais opções de ${titulo}` })[0] as HTMLElement);
};

describe("a Conta nova na lente financeira — 'Editar conta (página completa)' espera o servidor (D-15, GRV-05)", () => {
  it("segurando o transporte: o item está desligado com 'Salvando…' e não navega; depois de confirmada, navega para a página", async () => {
    await montar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "criar-conta" }));
    });
    await waitFor(() => expect(within(document.querySelector("table") as HTMLElement).getAllByRole("button", { name: `Mais opções de ${TITULO}` }).length).toBeGreaterThan(0));

    abrirMenuDaConta(TITULO);
    const editar = screen.getByRole("menuitem", { name: /Editar conta \(página completa\)/ });
    expect(editar.getAttribute("aria-disabled")).toBe("true");
    expect(editar.textContent).toContain("Salvando…");
    fireEvent.click(editar);
    expect(roteador.push).not.toHaveBeenCalled();

    await act(async () => {
      soltar();
    });
    // Confirmada, o item volta a navegar. O menu se fechou ao clicar: abre de novo.
    await waitFor(() => {
      abrirMenuDaConta(TITULO);
      const item = screen.getByRole("menuitem", { name: /Editar conta \(página completa\)/ });
      if (item.getAttribute("aria-disabled") === "true") throw new Error("ainda salvando");
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Editar conta \(página completa\)/ }));
    expect(roteador.push).toHaveBeenCalledTimes(1);
    expect(String(roteador.push.mock.calls[0]?.[0])).toMatch(/^\/estrutura\/tarefas\/tsk_/);
  });

  it("uma Conta de antes (já confirmada) navega como sempre", async () => {
    await montar();
    const existente = state.tasks.find((t) => t.listId === CP.listId && t.parentTaskId === undefined && t.lifecycle === "ativo");
    if (!existente) throw new Error("o seed não tem Conta ativa em Contas a pagar");
    abrirMenuDaConta(existente.title);
    const editar = screen.getByRole("menuitem", { name: /Editar conta \(página completa\)/ });
    expect(editar.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(editar);
    // O seed repete títulos de Conta (um por mês): o primeiro menu achado pode ser o de outra, então vale o caminho da página.
    expect(roteador.push).toHaveBeenCalledTimes(1);
    expect(String(roteador.push.mock.calls[0]?.[0])).toMatch(/^\/estrutura\/tarefas\/tsk_/);
  });
});
