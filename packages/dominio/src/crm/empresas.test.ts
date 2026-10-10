/**
 * Regras de Empresa do domínio (07-05, Task 1). Casos (g)-(k): INV-EMP-01, o
 * Identificador de Empresa (RN-EMP-05), a matriz (INV-EMP-05, RN-EMP-11), o
 * admin vigente (D-08) e a frase de Empresa bloqueada (RN-EMP-09).
 */

import { describe, expect, it } from "vitest";
import {
  adminsVigentes,
  fraseDeEmpresaBloqueada,
  FRASE_EMPRESA_SEM_ADMIN,
  nomeDeExibicaoDaEmpresa,
  TIPOS_IDENTIFICADOR_EMPRESA,
  validarEmpresa,
  validarIdentificadorDeEmpresa,
  validarMatriz,
  validarRetiradaDeAdmin,
  type VinculoDaEmpresa,
} from "./empresas";

describe("validarEmpresa e nomeDeExibicaoDaEmpresa (g)", () => {
  it("recusa Empresa sem nome fantasia nem razão social (INV-EMP-01)", () => {
    const vazia = validarEmpresa({});
    expect(vazia.ok).toBe(false);
    if (!vazia.ok) expect(vazia.field).toBe("nomeFantasia");
    expect(validarEmpresa({ nomeFantasia: "  " }).ok).toBe(false);
    expect(validarEmpresa({ nomeFantasia: null, razaoSocial: "" }).ok).toBe(false);
  });

  it("aceita com razão social ou com nome fantasia", () => {
    expect(validarEmpresa({ razaoSocial: "Acme Comércio Ltda" }).ok).toBe(true);
    expect(validarEmpresa({ nomeFantasia: "Acme" }).ok).toBe(true);
  });

  it("o nome de exibição prefere o nome fantasia", () => {
    expect(nomeDeExibicaoDaEmpresa({ nomeFantasia: " Acme ", razaoSocial: "Acme Comércio Ltda" })).toBe("Acme");
    expect(nomeDeExibicaoDaEmpresa({ nomeFantasia: "  ", razaoSocial: "Acme Comércio Ltda" })).toBe("Acme Comércio Ltda");
    expect(nomeDeExibicaoDaEmpresa({})).toBe("Empresa sem nome");
  });
});

describe("validarIdentificadorDeEmpresa (h)", () => {
  it("os tipos são os da 007", () => {
    expect([...TIPOS_IDENTIFICADOR_EMPRESA]).toEqual(["dominio", "documento_fiscal", "telefone"]);
  });

  it("recusa domínio de provedor público (RN-EMP-05)", () => {
    const resultado = validarIdentificadorDeEmpresa({ tipo: "dominio", valor: "gmail.com" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("RN-EMP-05");
  });

  it("normaliza o domínio próprio", () => {
    const resultado = validarIdentificadorDeEmpresa({ tipo: "dominio", valor: "https://www.Acme.com.br/contato" });
    expect(resultado).toEqual({ ok: true, value: { tipo: "dominio", valor: "acme.com.br" } });
  });

  it("documento fiscal exige o país e vira só dígitos", () => {
    const semPais = validarIdentificadorDeEmpresa({ tipo: "documento_fiscal", valor: "12.345.678/0001-90" });
    expect(semPais.ok).toBe(false);
    if (!semPais.ok) expect(semPais.field).toBe("pais");
    const comPais = validarIdentificadorDeEmpresa({ tipo: "documento_fiscal", valor: "12.345.678/0001-90", pais: "br" });
    expect(comPais).toEqual({ ok: true, value: { tipo: "documento_fiscal", valor: "12345678000190", pais: "BR" } });
  });
});

describe("validarMatriz (i)", () => {
  it("recusa a própria Empresa como matriz", () => {
    const resultado = validarMatriz({ empresaId: "e1", matriz: { id: "e1", estado: "ativo" }, ancestraisDaMatriz: [] });
    expect(resultado.ok).toBe(false);
  });

  it("recusa matriz que tem a Empresa entre os ancestrais (INV-EMP-05)", () => {
    const resultado = validarMatriz({ empresaId: "e1", matriz: { id: "e2", estado: "ativo" }, ancestraisDaMatriz: ["e3", "e1"] });
    expect(resultado.ok).toBe(false);
  });

  it("recusa matriz que não está ativa (RN-EMP-11)", () => {
    expect(validarMatriz({ empresaId: "e1", matriz: { id: "e2", estado: "arquivado" }, ancestraisDaMatriz: [] }).ok).toBe(false);
    expect(validarMatriz({ matriz: { id: "e2", estado: "na_lixeira" }, ancestraisDaMatriz: [] }).ok).toBe(false);
  });

  it("aceita matriz ativa fora da própria cadeia", () => {
    expect(validarMatriz({ empresaId: "e1", matriz: { id: "e2", estado: "ativo" }, ancestraisDaMatriz: ["e3"] }).ok).toBe(true);
    expect(validarMatriz({ matriz: { id: "e2", estado: "ativo" }, ancestraisDaMatriz: [] }).ok).toBe(true);
  });
});

function vinculo(id: string, extra: Partial<VinculoDaEmpresa> = {}): VinculoDaEmpresa {
  return {
    id,
    contatoId: `c_${id}`,
    contatoNome: `Contato ${id}`,
    contatoEstado: "ativo",
    cargo: null,
    admin: true,
    inicio: null,
    fim: null,
    ...extra,
  };
}

describe("adminsVigentes e validarRetiradaDeAdmin (j)", () => {
  it("ignora vínculo encerrado, Contato na lixeira e quem não é admin", () => {
    const vinculos = [
      vinculo("v1"),
      vinculo("v2", { fim: "2026-01-31" }),
      vinculo("v3", { contatoEstado: "na_lixeira" }),
      vinculo("v4", { admin: false }),
    ];
    expect(adminsVigentes(vinculos).map((v) => v.id)).toEqual(["v1"]);
  });

  it("recusa retirar o último admin vigente com a frase de D-08", () => {
    const resultado = validarRetiradaDeAdmin([vinculo("v1"), vinculo("v2", { admin: false })], "v1");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Indique o novo admin antes de retirar o último");
  });

  it("aceita retirar um admin quando sobra outro, e retirar quem não é admin", () => {
    const vinculos = [vinculo("v1"), vinculo("v2"), vinculo("v3", { admin: false })];
    expect(validarRetiradaDeAdmin(vinculos, "v1").ok).toBe(true);
    expect(validarRetiradaDeAdmin(vinculos, "v3").ok).toBe(true);
  });

  it("um segundo admin cujo Contato está na lixeira não conta como o que sobra", () => {
    const vinculos = [vinculo("v1"), vinculo("v2", { contatoEstado: "na_lixeira" })];
    expect(validarRetiradaDeAdmin(vinculos, "v1").ok).toBe(false);
  });

  it("a frase de Empresa sem admin pede quem volta a administrá-la", () => {
    expect(FRASE_EMPRESA_SEM_ADMIN).toContain("Indique quem volta a administrá-la");
  });
});

describe("fraseDeEmpresaBloqueada (k)", () => {
  it("cita os Negócios abertos e as Filiais", () => {
    const frase = fraseDeEmpresaBloqueada({
      negocios: { total: 2, itens: [{ id: "n1", titulo: "Venda A" }] },
      filiais: [{ id: "e2", nome: "Filial Sul" }],
    });
    expect(frase).toContain("2 Negócios");
    expect(frase).toContain("Filial Sul");
  });

  it("usa o singular com um Negócio e uma Filial", () => {
    const frase = fraseDeEmpresaBloqueada({
      negocios: { total: 1, itens: [] },
      filiais: [{ id: "e2", nome: "Filial Sul" }],
    });
    expect(frase).toContain("1 Negócio aberto");
    expect(frase).toContain("a filial Filial Sul");
  });
});
