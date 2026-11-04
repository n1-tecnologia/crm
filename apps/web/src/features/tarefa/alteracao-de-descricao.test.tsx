// @vitest-environment jsdom
/**
 * 11-06 (D-10 a D-14, T-11-15, T-11-16): o botão "Ver alteração" e a expansão
 * do texto anterior e do novo da descrição, em texto puro.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActivityRecord } from "@n1/dominio/types";
import { AlteracaoDeDescricao, temAlteracaoParaVer } from "./alteracao-de-descricao";

afterEach(() => {
  cleanup();
});

function registro(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: "atv_1",
    workspaceId: "ws_1",
    actor: { kind: "member", id: "mem_thiago" },
    action: "Descrição alterada",
    objectType: "task",
    objectId: "tsk_1",
    objectName: "Tarefa",
    result: "ok",
    at: "2026-01-01T10:00:00Z",
    ...overrides,
  };
}

describe("AlteracaoDeDescricao", () => {
  it("expande o Antes e o Depois e recolhe de novo, com aria-expanded", () => {
    render(<AlteracaoDeDescricao record={registro({ before: "A", after: "B" })} />);
    const botao = screen.getByRole("button", { name: "Ver alteração" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Antes")).toBeNull();

    fireEvent.click(botao);
    const aberto = screen.getByRole("button", { name: "Ocultar alteração" });
    expect(aberto.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Antes")).toBeTruthy();
    expect(screen.getByText("Depois")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();

    fireEvent.click(aberto);
    expect(screen.queryByText("Antes")).toBeNull();
    expect(screen.queryByText("B")).toBeNull();
  });

  it("registro sem before e sem after não tem botão (D-12)", () => {
    const { container } = render(<AlteracaoDeDescricao record={registro()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).toBe("");
    expect(temAlteracaoParaVer(registro())).toBe(false);
  });

  it("before vazio conta como presente e mostra 'Sem descrição'", () => {
    render(<AlteracaoDeDescricao record={registro({ before: "", after: "B" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alteração" }));
    expect(screen.getByText("Sem descrição")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });

  it("Ator de integração nunca mostra botão nem texto (D-14, T-02-10)", () => {
    const record = registro({ actor: { kind: "integration", id: "itg_omie" }, before: "12.345.678/0001-95", after: "B" });
    const { container } = render(<AlteracaoDeDescricao record={record} />);
    expect(temAlteracaoParaVer(record)).toBe(false);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("outras ações não têm botão", () => {
    const record = registro({ action: "Título alterado", before: "x", after: "y" });
    expect(temAlteracaoParaVer(record)).toBe(false);
  });

  it("HTML na descrição aparece literal e não cria elemento (T-11-16)", () => {
    const { container } = render(<AlteracaoDeDescricao record={registro({ before: "A", after: "<img src=x onerror=alert(1)>" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alteração" }));
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(container.querySelector("img")).toBeNull();
  });
});
