import { describe, expect, it } from "vitest";
import { itensDoCampoDeArquivo } from "./campo-de-arquivo";

const files = [
  { id: "fil_1", name: "nota-fiscal.pdf" },
  { id: "fil_2", name: "boleto.pdf" },
];

describe("itensDoCampoDeArquivo — o que o Campo de arquivo guarda", () => {
  it("ids viram arquivos com nome", () => {
    expect(itensDoCampoDeArquivo(["fil_1", "fil_2"], files)).toEqual([
      { tipo: "arquivo", id: "fil_1", nome: "nota-fiscal.pdf" },
      { tipo: "arquivo", id: "fil_2", nome: "boleto.pdf" },
    ]);
  });

  it("o nome solto do editor antigo aparece como nome, sem arquivo", () => {
    expect(itensDoCampoDeArquivo("NFS-e_21_03.pdf", files)).toEqual([{ tipo: "nome", nome: "NFS-e_21_03.pdf" }]);
  });

  it("vazio, nulo ou em branco é nenhum arquivo", () => {
    expect(itensDoCampoDeArquivo(undefined, files)).toEqual([]);
    expect(itensDoCampoDeArquivo(null, files)).toEqual([]);
    expect(itensDoCampoDeArquivo("  ", files)).toEqual([]);
    expect(itensDoCampoDeArquivo([], files)).toEqual([]);
  });
});
