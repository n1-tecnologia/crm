import { describe, expect, it } from "vitest";
import { opcaoCasaComBusca } from "./busca-de-opcoes";

const ana = { label: "Ana Ribeiro", detail: "+55 11 97000-1000" };

describe("busca das listas de opções", () => {
  it("acha pelo telefone em qualquer trecho, formatado ou não, e pelas palavras em qualquer ordem", () => {
    for (const busca of ["9700", "970001000", "97000-1000", "1000 9700", "(11) 97000", "+55 11", "ribeiro ana", "ANA", "ribeiro 1000", "  ana  "]) {
      expect(opcaoCasaComBusca(ana, busca), busca).toBe(true);
    }
    for (const busca of ["9711", "ana souza", "12345", "ribeiro 9711"]) {
      expect(opcaoCasaComBusca(ana, busca), busca).toBe(false);
    }
  });

  it("ignora acento e caixa; sem detalhe, busca só no rótulo", () => {
    expect(opcaoCasaComBusca({ label: "João Conceição" }, "joao CONCEICAO")).toBe(true);
    expect(opcaoCasaComBusca({ label: "Comercial SP" }, "sp")).toBe(true);
    expect(opcaoCasaComBusca({ label: "Comercial SP" }, "11")).toBe(false);
  });
});
