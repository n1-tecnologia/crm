// @vitest-environment jsdom
/**
 * Fase 10, 2.1.4 — a seleção em lote da Lista é uma peça só: o botão alterna o
 * rótulo e o painel do lote (a `BulkStatusBar` de sempre) só existe com a
 * seleção ligada. Molde de isolamento de `bulk-status-bar.test.tsx`:
 * `StoreProvider` de verdade sobre um `Transporte` falso, nenhuma rede.
 */

import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import { effectiveListConfig } from "@n1/dominio/derive";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { BotaoDeSelecao, SelecaoEmLote } from "./selecao-em-lote";

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

const transporte: Transporte = {
  gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
};

afterEach(() => {
  cleanup();
});

/** A página em miniatura: o botão e o painel, com a seleção guardada por quem os monta. */
function Pagina({ estado, selecionandoInicial }: { readonly estado: DataState; readonly selecionandoInicial: boolean }) {
  const [selecionando, setSelecionando] = useState(selecionandoInicial);
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set());
  const config = effectiveListConfig(estado, CP.listId);
  if (!config) throw new Error("Lista de Contas a pagar sem configuração efetiva.");
  const tasks = estado.tasks.filter((t) => t.listId === CP.listId).slice(0, 2);
  return (
    <>
      <BotaoDeSelecao
        selecionando={selecionando}
        aoAlternar={() => {
          setSelecionando((v) => !v);
          setSelecionadas(new Set());
        }}
      />
      <SelecaoEmLote
        tasks={tasks}
        definitions={config.statusSet.definitions}
        selecionadas={selecionadas}
        onSelecionar={setSelecionadas}
        onRelatorio={() => {}}
        report={() => {}}
        selecionando={selecionando}
      />
      <output data-testid="marcadas">{selecionadas.size}</output>
    </>
  );
}

function montar(selecionandoInicial: boolean) {
  const estado = buildSeed();
  const ordens = ordensDeTodasAsColecoes(estado);
  return render(
    <StoreProvider
      sessao={{ memberId: CP.financeiroId }}
      estadoInicial={{ data: estado, revisao: 1, ordens }}
      transporte={transporte}
    >
      <Pagina estado={estado} selecionandoInicial={selecionandoInicial} />
    </StoreProvider>,
  );
}

describe("BotaoDeSelecao", () => {
  it("alterna o rótulo entre Selecionar várias e Sair da seleção", () => {
    montar(false);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar várias" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair da seleção" }));
    expect(screen.getByRole("button", { name: "Selecionar várias" })).toBeTruthy();
  });

  it("desligado, mostra o botão sem permitir o clique", () => {
    render(<BotaoDeSelecao selecionando={false} aoAlternar={() => {}} desligadoPor="Sem permissão." />);
    const botao = screen.getByRole("button", { name: "Selecionar várias" });
    expect((botao as HTMLButtonElement).disabled || botao.getAttribute("aria-disabled") === "true").toBe(true);
  });
});

describe("SelecaoEmLote", () => {
  it("sem a seleção ligada não desenha a barra do lote", () => {
    montar(false);
    expect(screen.queryByTestId("selecao-em-lote")).toBeNull();
    expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull();
  });

  it("com a seleção ligada e duas Tarefas marcadas desenha a barra do lote", () => {
    montar(true);
    expect(screen.getByTestId("selecao-em-lote")).toBeTruthy();
    // Marcar todas as visíveis (as duas Tarefas da Lista).
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("2 selecionada(s)")).toBeTruthy();
    expect(screen.getByTestId("marcadas").textContent).toBe("2");
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Limpar seleção" })).toBeTruthy();
  });

  it("sair da seleção limpa as marcadas e remove a barra", () => {
    montar(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Sair da seleção" }));
    expect(screen.queryByTestId("selecao-em-lote")).toBeNull();
    expect(screen.getByTestId("marcadas").textContent).toBe("0");
  });
});
