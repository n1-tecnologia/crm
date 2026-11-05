/** 12.3.8 — `destinoSeguro`: só caminho interno passa; o resto vira `/`. */
import { describe, expect, it } from "vitest";
import { destinoSeguro } from "./destino-seguro";

describe("destinoSeguro", () => {
  it("caminho interno passa, com busca e âncora", () => {
    expect(destinoSeguro("/crm")).toBe("/crm");
    expect(destinoSeguro("/crm/contatos?aba=2#topo")).toBe("/crm/contatos?aba=2#topo");
  });

  it("os casos do plano viram /", () => {
    expect(destinoSeguro("//evil.com")).toBe("/");
    expect(destinoSeguro("/\\evil.com")).toBe("/");
    expect(destinoSeguro("https://evil.com")).toBe("/");
  });

  it("variações do mesmo truque também viram /", () => {
    expect(destinoSeguro("/\\/evil.com")).toBe("/");
    expect(destinoSeguro("/\t/evil.com")).toBe("/");
    expect(destinoSeguro("/%5Cevil.com")).toBe("/%5Cevil.com");
    expect(destinoSeguro("javascript:alert(1)")).toBe("/");
    expect(destinoSeguro("evil.com")).toBe("/");
  });

  it("vazio, nulo ou indefinido vira /", () => {
    expect(destinoSeguro("")).toBe("/");
    expect(destinoSeguro(null)).toBe("/");
    expect(destinoSeguro(undefined)).toBe("/");
  });
});
