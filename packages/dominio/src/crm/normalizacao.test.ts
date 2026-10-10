/**
 * Normalização de Identificadores (07-03, Task 1). Casos (a)-(f) do plano:
 * a forma canônica é a chave de unicidade (INV-CON-02, INV-EMP-02), então cada
 * regra é provada por entrada -> saída.
 */

import { describe, expect, it } from "vitest";
import {
  normalizarDocumento,
  normalizarDominio,
  normalizarEmail,
  normalizarIdentificadorDeContato,
  normalizarIdentificadorDeEmpresa,
  normalizarInstagram,
  normalizarTelefone,
  normalizarWhatsapp,
  PROVEDORES_PUBLICOS_DE_EMAIL,
} from "./normalizacao";

describe("normalizarEmail (a)", () => {
  it("apara e põe em minúsculas", () => {
    expect(normalizarEmail(" Ana@Exemplo.COM ")).toEqual({ ok: true, value: "ana@exemplo.com" });
  });

  it.each(["ana@", "ana exemplo.com", "", "@exemplo.com", "ana@exemplo"])("recusa %j com campo valor", (entrada) => {
    const resultado = normalizarEmail(entrada);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("valor");
  });
});

describe("normalizarTelefone (b)", () => {
  it.each([
    ["(11) 98765-4321", "+5511987654321"],
    ["11 3456-7890", "+551134567890"],
    ["5511987654321", "+5511987654321"],
    ["+1 (415) 555-2671", "+14155552671"],
  ])("%j vira %j", (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toEqual({ ok: true, value: esperado });
  });

  it.each(["123", "", "abc", "+123", "9999999999999999"])("recusa %j", (entrada) => {
    const resultado = normalizarTelefone(entrada);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("valor");
  });
});

describe("normalizarInstagram (c)", () => {
  it.each([
    ["@Ana.Silva", "ana.silva"],
    ["https://www.instagram.com/ana_silva/", "ana_silva"],
    ["instagram.com/Ana_Silva?hl=pt", "ana_silva"],
  ])("%j vira %j", (entrada, esperado) => {
    expect(normalizarInstagram(entrada)).toEqual({ ok: true, value: esperado });
  });

  it.each(["ana silva", "", "@", "a".repeat(31)])("recusa %j", (entrada) => {
    expect(normalizarInstagram(entrada).ok).toBe(false);
  });
});

describe("normalizarDominio (d)", () => {
  it("tira protocolo, www, caminho e query", () => {
    expect(normalizarDominio("https://www.Exemplo.com.br/contato?x=1")).toEqual({ ok: true, value: "exemplo.com.br" });
  });

  it("tira porta e ponto final", () => {
    expect(normalizarDominio("Exemplo.com:8080.")).toEqual({ ok: true, value: "exemplo.com" });
  });

  it("recusa o que não é domínio", () => {
    expect(normalizarDominio("exemplo").ok).toBe(false);
    expect(normalizarDominio("").ok).toBe(false);
  });

  it("recusa provedor público de e-mail citando RN-EMP-05", () => {
    for (const entrada of ["gmail.com", "https://hotmail.com"]) {
      const resultado = normalizarDominio(entrada);
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.error).toContain("RN-EMP-05");
    }
  });

  it("a lista de provedores traz os mais comuns", () => {
    expect(PROVEDORES_PUBLICOS_DE_EMAIL).toContain("gmail.com");
    expect(PROVEDORES_PUBLICOS_DE_EMAIL).toContain("outlook.com");
    expect(PROVEDORES_PUBLICOS_DE_EMAIL).toContain("uol.com.br");
  });
});

describe("normalizarDocumento (e)", () => {
  it("mantém só os dígitos", () => {
    expect(normalizarDocumento("12.345.678/0001-90")).toEqual({ ok: true, value: "12345678000190" });
  });

  it("recusa sem dígito", () => {
    expect(normalizarDocumento("--").ok).toBe(false);
  });

  it("documento fiscal de Empresa exige o país", () => {
    const resultado = normalizarIdentificadorDeEmpresa("documento_fiscal", "123", undefined);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("pais");
  });

  it("documento fiscal com país normaliza; domínio e telefone seguem as próprias regras", () => {
    expect(normalizarIdentificadorDeEmpresa("documento_fiscal", "12.345.678/0001-90", "BR")).toEqual({
      ok: true,
      value: "12345678000190",
    });
    expect(normalizarIdentificadorDeEmpresa("dominio", "https://Alfa.com.br", undefined)).toEqual({
      ok: true,
      value: "alfa.com.br",
    });
    expect(normalizarIdentificadorDeEmpresa("telefone", "(11) 3000-0000", undefined)).toEqual({
      ok: true,
      value: "+551130000000",
    });
  });
});

describe("normalizarIdentificadorDeContato (f)", () => {
  it("WhatsApp usa a regra do telefone", () => {
    expect(normalizarIdentificadorDeContato("whatsapp", "(11) 98765-4321")).toEqual({ ok: true, value: "+5511987654321" });
    expect(normalizarWhatsapp("(11) 98765-4321")).toEqual({ ok: true, value: "+5511987654321" });
  });

  it("despacha por tipo", () => {
    expect(normalizarIdentificadorDeContato("email", " A@B.com ")).toEqual({ ok: true, value: "a@b.com" });
    expect(normalizarIdentificadorDeContato("telefone", "11 3456-7890")).toEqual({ ok: true, value: "+551134567890" });
    expect(normalizarIdentificadorDeContato("instagram", "@Ana")).toEqual({ ok: true, value: "ana" });
  });
});
