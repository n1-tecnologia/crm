// @vitest-environment jsdom
/**
 * 11-06 (TAR-06, tela): a edição da descrição de "A" para "B", gravada por
 * `updateTask`, aparece no Feed de Atividade como "Descrição alterada" com o
 * botão "Ver alteração".
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { updateTask } from "@n1/dominio/operations";
import type { ActorRef } from "@n1/dominio/types";
import { FeedDeAtividade } from "./feed-de-atividade";

afterEach(() => {
  cleanup();
});

const TAREFA = "tsk_seed_1";
const autor = (actor: ActorRef) => (actor.kind === "member" ? "Thiago" : "Integração");

function registrosAposEdicao() {
  const state = buildSeed();
  expect(updateTask(state, "mem_thiago", TAREFA, { description: "A" }).ok).toBe(true);
  expect(updateTask(state, "mem_thiago", TAREFA, { description: "B" }).ok).toBe(true);
  return state.activity.filter((a) => a.objectId === TAREFA);
}

function feed(registros: ReturnType<typeof registrosAposEdicao>, busca = "") {
  return <FeedDeAtividade registros={registros} authorLabel={autor} timeZone="America/Sao_Paulo" busca={busca} />;
}

describe("FeedDeAtividade — Descrição alterada (11-06)", () => {
  it("mostra só 'Descrição alterada' e o botão; expande Antes A e Depois B; recolhe", () => {
    const registros = registrosAposEdicao();
    const { container } = render(feed(registros));
    expect(container.textContent).toContain("Descrição alterada");
    expect(container.textContent).not.toContain("(A → B)");

    const botoes = screen.getAllByRole("button", { name: "Ver alteração" });
    fireEvent.click(botoes[botoes.length - 1]!);
    expect(screen.getByText("Antes")).toBeTruthy();
    expect(screen.getByText("Depois")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    const ocultar = screen.getByRole("button", { name: "Ocultar alteração" });
    expect(ocultar.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(ocultar);
    expect(screen.queryByText("Antes")).toBeNull();
    expect(screen.queryByText("Depois")).toBeNull();
  });

  it("a expansão sobrevive a um re-render do Feed", () => {
    const registros = registrosAposEdicao();
    const { rerender } = render(feed(registros));
    const botoes = screen.getAllByRole("button", { name: "Ver alteração" });
    fireEvent.click(botoes[botoes.length - 1]!);
    rerender(feed(registros, ""));
    rerender(feed([...registros]));
    expect(screen.getByText("Antes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ocultar alteração" })).toBeTruthy();
  });

  it("'Título alterado' segue com (antigo → novo)", () => {
    const state = buildSeed();
    expect(updateTask(state, "mem_thiago", TAREFA, { title: "Novo título" }).ok).toBe(true);
    const registros = state.activity.filter((a) => a.objectId === TAREFA && a.action.startsWith("Título"));
    const { container } = render(feed(registros));
    expect(container.textContent).toMatch(/\(.+ → Novo título\)/);
    expect(screen.queryByRole("button", { name: "Ver alteração" })).toBeNull();
  });

  it("Ator de integração com antes/depois não vê botão nem texto (D-14)", () => {
    const registros = [
      {
        id: "atv_i",
        workspaceId: "ws",
        actor: { kind: "integration", id: "itg_omie" },
        action: "Descrição alterada",
        objectType: "task",
        objectId: TAREFA,
        objectName: "T",
        result: "ok",
        at: "2026-01-01T10:00:00Z",
        before: "12.345.678/0001-95",
        after: "B",
      },
    ] as ReturnType<typeof registrosAposEdicao>;
    const { container } = render(feed(registros));
    expect(container.textContent).toContain("Descrição alterada");
    expect(screen.queryByRole("button", { name: "Ver alteração" })).toBeNull();
    expect(container.textContent).not.toContain("12.345.678");
  });
});
