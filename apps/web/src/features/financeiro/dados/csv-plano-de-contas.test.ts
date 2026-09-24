import { describe, expect, it } from "vitest";
import { lerCsvDePlanoDeContas } from "./csv-plano-de-contas";

describe("lerCsvDePlanoDeContas", () => {
  it("lê separado por vírgula", () => {
    const resultado = lerCsvDePlanoDeContas(
      "cod,categoria,categoria_clickup,descricao\n001,Categoria A,CC1,Descrição A",
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.linhas).toEqual([
      { cod: "001", categoria: "Categoria A", categoria_clickup: "CC1", descricao: "Descrição A" },
    ]);
  });

  it("lê separado por ponto e vírgula", () => {
    const resultado = lerCsvDePlanoDeContas(
      "cod;categoria;categoria_clickup;descricao\n001;Categoria A;CC1;Descrição A",
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.linhas).toEqual([
      { cod: "001", categoria: "Categoria A", categoria_clickup: "CC1", descricao: "Descrição A" },
    ]);
  });

  it("respeita campo entre aspas com o separador dentro", () => {
    const resultado = lerCsvDePlanoDeContas(
      'cod,categoria,categoria_clickup,descricao\n001,"Categoria, com vírgula",CC1,Descrição A',
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.linhas).toEqual([
      { cod: "001", categoria: "Categoria, com vírgula", categoria_clickup: "CC1", descricao: "Descrição A" },
    ]);
  });

  it("respeita aspa escapada dentro de campo entre aspas", () => {
    const resultado = lerCsvDePlanoDeContas(
      'cod,categoria,categoria_clickup,descricao\n001,"Categoria ""especial""",CC1,Descrição A',
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.linhas).toEqual([
      { cod: "001", categoria: 'Categoria "especial"', categoria_clickup: "CC1", descricao: "Descrição A" },
    ]);
  });

  it("casa cabeçalho com acento e caixa alta", () => {
    const resultado = lerCsvDePlanoDeContas(
      "Código,Categoria,Categoria ClickUp,Descrição\n001,Categoria A,CC1,Descrição A",
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.linhas).toEqual([
      { cod: "001", categoria: "Categoria A", categoria_clickup: "CC1", descricao: "Descrição A" },
    ]);
  });

  it("ignora coluna desconhecida sem levantar erro", () => {
    const resultado = lerCsvDePlanoDeContas(
      "cod,categoria,coluna_estranha,descricao\n001,Categoria A,valor ignorado,Descrição A",
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.linhas).toEqual([{ cod: "001", categoria: "Categoria A", descricao: "Descrição A" }]);
  });

  it("pula linha em branco", () => {
    const resultado = lerCsvDePlanoDeContas(
      "cod,categoria,categoria_clickup,descricao\n001,Categoria A,CC1,Descrição A\n\n002,Categoria B,CC2,Descrição B",
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.linhas).toHaveLength(2);
  });

  it("devolve erro quando nenhuma coluna conhecida existe no cabeçalho", () => {
    const resultado = lerCsvDePlanoDeContas("coluna1,coluna2\nvalor1,valor2");
    expect(resultado.linhas).toEqual([]);
    expect(resultado.erro).toBe(
      "O arquivo não tem nenhuma coluna reconhecida (código, categoria, categoria ClickUp, descrição).",
    );
  });

  it("devolve erro acima de 2000 linhas", () => {
    const linhasDeDados = Array.from({ length: 2001 }, (_, indice) => `${indice},Categoria,CC,Descrição`).join("\n");
    const resultado = lerCsvDePlanoDeContas(`cod,categoria,categoria_clickup,descricao\n${linhasDeDados}`);
    expect(resultado.linhas).toEqual([]);
    expect(resultado.erro).toMatch(/2000/);
  });

  it("trata CRLF como quebra de linha", () => {
    const resultado = lerCsvDePlanoDeContas(
      "cod,categoria,categoria_clickup,descricao\r\n001,Categoria A,CC1,Descrição A\r\n002,Categoria B,CC2,Descrição B",
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.linhas).toHaveLength(2);
  });
});
