import { describe, expect, it } from "vitest";
import { bezierDe, cubicBezier, lerDuracao, parseBezier, parseDuracao, reduzido } from "./movimento";

describe("movimento — leitura de tokens", () => {
  it("parseDuracao aceita ms e s, e devolve 0 para o resto", () => {
    expect(parseDuracao("300ms")).toBe(300);
    expect(parseDuracao(" 1.5s ")).toBe(1500);
    expect(parseDuracao("1s")).toBe(1000);
    expect(parseDuracao("-9s")).toBe(-9000);
    expect(parseDuracao("")).toBe(0);
    expect(parseDuracao("rápido")).toBe(0);
    expect(parseDuracao("12px")).toBe(0);
  });

  it("no servidor não há movimento: lerDuracao é 0 (com ou sem medidor) e reduzido é falso", () => {
    expect(typeof document).toBe("undefined");
    expect(lerDuracao("--dur-2")).toBe(0);
    expect(lerDuracao("--dur-aviso", { medidor: true })).toBe(0);
    expect(reduzido()).toBe(false);
  });

  it("parseBezier lê a curva do token e recusa o que não é uma", () => {
    expect(parseBezier("cubic-bezier(0.4, 0, 0.2, 1)")).toEqual([0.4, 0, 0.2, 1]);
    expect(parseBezier(" cubic-bezier(0,0,0.2,1) ")).toEqual([0, 0, 0.2, 1]);
    expect(parseBezier("ease-in-out")).toBeNull();
    expect(parseBezier("")).toBeNull();
  });
});

describe("movimento — a curva", () => {
  const curva = cubicBezier(0.4, 0, 0.2, 1);

  it("vai de 0 a 1 e satura fora do intervalo", () => {
    expect(curva(0)).toBe(0);
    expect(curva(1)).toBe(1);
    expect(curva(-1)).toBe(0);
    expect(curva(2)).toBe(1);
  });

  it("é monotônica e acelera no começo, freia no fim", () => {
    let anterior = 0;
    for (let i = 1; i <= 100; i++) {
      const v = curva(i / 100);
      expect(v).toBeGreaterThanOrEqual(anterior);
      anterior = v;
    }
    // A curva padrão do sistema chega adiantada ao meio do caminho.
    expect(curva(0.5)).toBeGreaterThan(0.7);
    expect(curva(0.25)).toBeLessThan(0.4);
  });

  it("a curva linear é a identidade", () => {
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0.3)).toBeCloseTo(0.3, 6);
    expect(linear(0.9)).toBeCloseTo(0.9, 6);
  });

  it("bezierDe no servidor cai na curva padrão do sistema", () => {
    const padrao = bezierDe("--easing");
    expect(padrao(0.5)).toBeCloseTo(curva(0.5), 6);
  });
});
