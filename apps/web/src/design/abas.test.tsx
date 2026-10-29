// @vitest-environment jsdom
/**
 * A13 (Fase 10, 10-UI-SPEC S4) — `Abas` liga cada aba ao painel e anda por
 * teclado. O visual não muda; sem `idBase` o componente se comporta como antes
 * (os outros dez usos), só ganha as setas.
 */

import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Abas } from "./basicos";

afterEach(() => cleanup());

const ABAS = [
  { chave: "a", rotulo: "Alfa" },
  { chave: "b", rotulo: "Beta" },
  { chave: "c", rotulo: "Gama" },
];

function montar(ativa = "a", idBase?: string) {
  const aoTrocar = vi.fn();
  render(<Abas abas={ABAS} ativa={ativa} aoTrocar={aoTrocar} rotulo="Teste" {...(idBase ? { idBase } : {})} />);
  return { aoTrocar };
}

describe("Abas — ligação aba-painel (A13)", () => {
  it("com idBase, a aba tem id e aria-controls casando com o id do painel", () => {
    montar("b", "cfg");
    const beta = screen.getByRole("tab", { name: "Beta" });
    expect(beta.id).toBe("cfg-aba-b");
    expect(beta.getAttribute("aria-controls")).toBe("cfg-painel-b");
  });

  it("sem idBase, a aba não ganha id nem aria-controls (o comportamento de hoje)", () => {
    montar("a");
    const alfa = screen.getByRole("tab", { name: "Alfa" });
    expect(alfa.id).toBe("");
    expect(alfa.hasAttribute("aria-controls")).toBe(false);
  });

  it("só a aba ativa entra na ordem de Tab", () => {
    montar("b");
    expect(screen.getByRole("tab", { name: "Alfa" }).tabIndex).toBe(-1);
    expect(screen.getByRole("tab", { name: "Beta" }).tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "Gama" }).tabIndex).toBe(-1);
  });
});

describe("Abas — teclado (A13)", () => {
  it("ArrowRight na aba ativa chama aoTrocar com a próxima", () => {
    const { aoTrocar } = montar("a");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alfa" }), { key: "ArrowRight" });
    expect(aoTrocar).toHaveBeenCalledWith("b");
  });

  it("ArrowRight na última volta à primeira e ArrowLeft na primeira vai à última", () => {
    const { aoTrocar } = montar("c");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Gama" }), { key: "ArrowRight" });
    expect(aoTrocar).toHaveBeenLastCalledWith("a");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alfa" }), { key: "ArrowLeft" });
    expect(aoTrocar).toHaveBeenLastCalledWith("c");
  });

  it("End vai para a última e Home para a primeira", () => {
    const { aoTrocar } = montar("b");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Beta" }), { key: "End" });
    expect(aoTrocar).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Beta" }), { key: "Home" });
    expect(aoTrocar).toHaveBeenLastCalledWith("a");
  });

  it("outras teclas não trocam de aba", () => {
    const { aoTrocar } = montar("a");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alfa" }), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alfa" }), { key: "a" });
    expect(aoTrocar).not.toHaveBeenCalled();
  });

  it("a tecla troca a aba E leva o foco para ela (controlada por quem chama)", () => {
    function Controlada() {
      const [ativa, setAtiva] = useState("a");
      return <Abas abas={ABAS} ativa={ativa} aoTrocar={setAtiva} />;
    }
    render(<Controlada />);
    const alfa = screen.getByRole("tab", { name: "Alfa" });
    alfa.focus();
    fireEvent.keyDown(alfa, { key: "ArrowRight" });
    const beta = screen.getByRole("tab", { name: "Beta" });
    expect(beta.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(beta);
  });
});
