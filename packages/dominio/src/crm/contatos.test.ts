/**
 * Regras de Contato do domínio (07-03, Task 1). Casos (g)-(i): endereços e
 * campos adicionais, INV-CON-01, principal por tipo e as frases que a api e a
 * tela mostram nos 409.
 */

import { describe, expect, it } from "vitest";
import { LIMITES_CRM, validarCamposAdicionais, validarEnderecos, type Endereco } from "./comum";
import {
  fraseDeContatoBloqueado,
  fraseDeIdentificadorEmUso,
  primeiroDoTipo,
  ROTULO_DO_TIPO_DE_IDENTIFICADOR,
  TIPOS_IDENTIFICADOR_CONTATO,
  validarContato,
  validarIdentificadorDeContato,
} from "./contatos";

const endereco = (principal: boolean): Endereco => ({ rotulo: "comercial", cidade: "São Paulo", principal });

describe("validarEnderecos (g)", () => {
  it("aceita nenhum, um principal ou nenhum principal", () => {
    expect(validarEnderecos(undefined).ok).toBe(true);
    expect(validarEnderecos([]).ok).toBe(true);
    expect(validarEnderecos([endereco(true), endereco(false)]).ok).toBe(true);
    expect(validarEnderecos([endereco(false), endereco(false)]).ok).toBe(true);
  });

  it("recusa dois principais", () => {
    const resultado = validarEnderecos([endereco(true), endereco(true)]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("enderecos");
  });

  it("recusa mais que o máximo", () => {
    const demais = Array.from({ length: LIMITES_CRM.enderecosMaximo + 1 }, () => endereco(false));
    expect(validarEnderecos(demais).ok).toBe(false);
  });
});

describe("validarCamposAdicionais (g)", () => {
  it("aceita texto, número e booleano", () => {
    expect(validarCamposAdicionais({ signo: "leão", filhos: 2, vip: true }).ok).toBe(true);
    expect(validarCamposAdicionais(undefined).ok).toBe(true);
  });

  it("recusa mais de 50 chaves", () => {
    const muitos = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, "x"]));
    const resultado = validarCamposAdicionais(muitos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("camposAdicionais");
  });

  it("recusa chave vazia ou acima de 60 caracteres", () => {
    expect(validarCamposAdicionais({ "": "x" }).ok).toBe(false);
    expect(validarCamposAdicionais({ ["k".repeat(61)]: "x" }).ok).toBe(false);
    expect(validarCamposAdicionais({ ["k".repeat(60)]: "x" }).ok).toBe(true);
  });

  it("recusa valor texto acima de 500 caracteres", () => {
    expect(validarCamposAdicionais({ k: "x".repeat(501) }).ok).toBe(false);
    expect(validarCamposAdicionais({ k: "x".repeat(500) }).ok).toBe(true);
  });
});

describe("validarContato e primeiroDoTipo (h)", () => {
  it("INV-CON-01: recusa sem nome e sem identificador", () => {
    expect(validarContato({}).ok).toBe(false);
    expect(validarContato({ nome: "  " }).ok).toBe(false);
    expect(validarContato({ nome: "Ana" }).ok).toBe(true);
    expect(validarContato({ identificadores: [{}] }).ok).toBe(true);
  });

  it("o primeiro Identificador de cada tipo nasce principal", () => {
    expect(primeiroDoTipo([], "email")).toBe(true);
    expect(primeiroDoTipo([{ tipo: "telefone" }], "email")).toBe(true);
    expect(primeiroDoTipo([{ tipo: "email" }], "email")).toBe(false);
  });

  it("validarIdentificadorDeContato devolve o valor já normalizado", () => {
    const resultado = validarIdentificadorDeContato({ tipo: "email", valor: " Ana@X.COM " });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.valor).toBe("ana@x.com");
      expect(resultado.value.valorExibido).toBe("Ana@X.COM");
    }
    expect(validarIdentificadorDeContato({ tipo: "email", valor: "sem-arroba" }).ok).toBe(false);
  });

  it("todo tipo tem rótulo em português", () => {
    expect(ROTULO_DO_TIPO_DE_IDENTIFICADOR).toEqual({
      telefone: "Telefone",
      email: "E-mail",
      whatsapp: "WhatsApp",
      instagram: "Instagram",
    });
    expect(Object.keys(ROTULO_DO_TIPO_DE_IDENTIFICADOR).sort()).toEqual([...TIPOS_IDENTIFICADOR_CONTATO].sort());
  });
});

describe("frases de recusa (i)", () => {
  it("fraseDeContatoBloqueado cita a Empresa, o total de Negócios e o que fazer", () => {
    const frase = fraseDeContatoBloqueado({
      empresas: [{ id: "e1", nome: "Alfa" }],
      negocios: { total: 2, itens: [{ id: "n1", titulo: "A" }, { id: "n2", titulo: "B" }] },
    });
    expect(frase).toContain("Alfa");
    expect(frase).toContain("2 Negócios");
    expect(frase).toMatch(/admin/);
    expect(frase).toMatch(/Contato do Negócio|Contato dos Negócios/);
  });

  it("usa o singular para um Negócio e omite o que não bloqueia", () => {
    const frase = fraseDeContatoBloqueado({ negocios: { total: 1, itens: [{ id: "n1", titulo: "A" }] } });
    expect(frase).toContain("1 Negócio");
    expect(frase).not.toContain("1 Negócios");
    expect(frase).not.toMatch(/admin/);
  });

  it("fraseDeIdentificadorEmUso nomeia o detentor", () => {
    const frase = fraseDeIdentificadorEmUso("email", "a@b.com", "Ana Souza");
    expect(frase).toContain("Ana Souza");
    expect(frase).toContain("a@b.com");
    expect(frase).toContain("E-mail");
  });
});
