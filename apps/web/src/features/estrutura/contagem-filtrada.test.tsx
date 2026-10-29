// @vitest-environment jsdom
/**
 * Fase 10, 2.1.5 — «Mostrando X de Y Tarefas.»: o plural segue o total (Y), a
 * lente financeira troca o substantivo por «contas»/«conta», e nada vem depois
 * do ponto.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ContagemFiltrada, textoDaContagem } from "./contagem-filtrada";

afterEach(() => {
  cleanup();
});

describe("textoDaContagem", () => {
  it("Tarefas no plural quando o total passa de um", () => {
    expect(textoDaContagem(3, 12, false)).toBe("Mostrando 3 de 12 Tarefas.");
  });

  it("Tarefa no singular quando o total é um", () => {
    expect(textoDaContagem(1, 1, false)).toBe("Mostrando 1 de 1 Tarefa.");
  });

  it("zero visíveis de muitas continua no plural pelo total", () => {
    expect(textoDaContagem(0, 5, false)).toBe("Mostrando 0 de 5 Tarefas.");
  });

  it("lente financeira diz contas no plural", () => {
    expect(textoDaContagem(2, 9, true)).toBe("Mostrando 2 de 9 contas.");
  });

  it("lente financeira diz conta no singular", () => {
    expect(textoDaContagem(1, 1, true)).toBe("Mostrando 1 de 1 conta.");
  });

  it("a contagem segue o total, mesmo com Y grande", () => {
    expect(textoDaContagem(1, 1200, false)).toBe("Mostrando 1 de 1200 Tarefas.");
  });
});

describe("ContagemFiltrada", () => {
  it("desenha o texto em .app-meta, sem nada depois do ponto", () => {
    render(<ContagemFiltrada x={3} y={12} financeira={false} />);
    const linha = screen.getByText("Mostrando 3 de 12 Tarefas.");
    expect(linha.classList.contains("app-meta")).toBe(true);
    expect(linha.textContent?.endsWith(".")).toBe(true);
    expect(linha.textContent).not.toMatch(/filtro|Visualiza/i);
  });

  it("na lente financeira desenha contas", () => {
    render(<ContagemFiltrada x={2} y={9} financeira />);
    expect(screen.getByText("Mostrando 2 de 9 contas.")).toBeTruthy();
  });
});
