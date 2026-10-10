/**
 * Regras de Funil e Etapa do domínio (07-04, Task 1). Casos (a)-(i): criação
 * atômica com Etapas, Etapa inicial, reordenação, última Etapa, Funil padrão,
 * migração de Negócios e as frases dos 409 de D-07.
 */

import { describe, expect, it } from "vitest";
import {
  deveNascerPadrao,
  etapaInicial,
  fraseEtapaComNegocios,
  fraseFunilComNegocios,
  fraseFunilComNegociosAbertos,
  validarMigracao,
  validarMudancaDeEstado,
  validarNovoFunil,
  validarNovoPadrao,
  validarPrivacidade,
  validarReordenacao,
  validarRemocaoDeEtapa,
  type NovoFunil,
} from "./funis";

const funilValido = (sobre: Partial<NovoFunil> = {}): NovoFunil => ({
  nome: "Vendas",
  etapas: [{ nome: "Novo" }, { nome: "Proposta", probabilidadePadrao: 40 }],
  ...sobre,
});

describe("validarNovoFunil (a)", () => {
  it("aceita um Funil com uma Etapa", () => {
    expect(validarNovoFunil(funilValido({ etapas: [{ nome: "Única" }] })).ok).toBe(true);
  });

  it("recusa nome vazio", () => {
    expect(validarNovoFunil(funilValido({ nome: "   " })).ok).toBe(false);
  });

  it("recusa etapas vazias (RN-FUN-04)", () => {
    const resultado = validarNovoFunil(funilValido({ etapas: [] }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/ao menos uma Etapa/);
  });

  it("recusa duas Etapas com o mesmo nome, sem distinguir caixa e espaços (RN-FUN-03)", () => {
    const resultado = validarNovoFunil(funilValido({ etapas: [{ nome: " Novo " }, { nome: "novo" }] }));
    expect(resultado.ok).toBe(false);
  });

  it("recusa probabilidade acima de 100", () => {
    expect(validarNovoFunil(funilValido({ etapas: [{ nome: "A", probabilidadePadrao: 101 }] })).ok).toBe(false);
  });

  it("recusa probabilidade fracionária", () => {
    expect(validarNovoFunil(funilValido({ etapas: [{ nome: "A", probabilidadePadrao: 2.5 }] })).ok).toBe(false);
  });

  it("recusa Etapa de nome vazio", () => {
    expect(validarNovoFunil(funilValido({ etapas: [{ nome: "" }] })).ok).toBe(false);
  });
});

describe("etapaInicial (b)", () => {
  it("devolve a Etapa de menor ordem (RN-FUN-06)", () => {
    const etapas = [
      { id: "b", ordem: 2 },
      { id: "a", ordem: 1 },
      { id: "c", ordem: 3 },
    ];
    expect(etapaInicial(etapas)?.id).toBe("a");
  });

  it("devolve undefined sem Etapas", () => {
    expect(etapaInicial([])).toBeUndefined();
  });
});

describe("validarReordenacao (c)", () => {
  it("aceita a permutação completa", () => {
    expect(validarReordenacao(["a", "b", "c"], ["c", "a", "b"]).ok).toBe(true);
  });

  it("recusa id faltando", () => {
    expect(validarReordenacao(["a", "b", "c"], ["c", "a"]).ok).toBe(false);
  });

  it("recusa id repetido", () => {
    expect(validarReordenacao(["a", "b", "c"], ["a", "a", "c"]).ok).toBe(false);
  });

  it("recusa id estranho ao Funil", () => {
    expect(validarReordenacao(["a", "b", "c"], ["a", "b", "x"]).ok).toBe(false);
  });
});

describe("validarRemocaoDeEtapa (d)", () => {
  it("recusa remover a única Etapa", () => {
    const resultado = validarRemocaoDeEtapa(1);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBe("Um Funil precisa de ao menos uma Etapa.");
  });

  it("aceita com duas Etapas", () => {
    expect(validarRemocaoDeEtapa(2).ok).toBe(true);
  });
});

describe("Funil padrão no ciclo de vida (e)", () => {
  it("o padrão não vai para a lixeira nem é arquivado (RN-FUN-16)", () => {
    expect(validarMudancaDeEstado({ padrao: true }, "na_lixeira").ok).toBe(false);
    expect(validarMudancaDeEstado({ padrao: true }, "arquivado").ok).toBe(false);
  });

  it("o padrão pode seguir ativo", () => {
    expect(validarMudancaDeEstado({ padrao: true }, "ativo").ok).toBe(true);
  });

  it("um Funil que não é padrão muda de estado", () => {
    expect(validarMudancaDeEstado({ padrao: false }, "na_lixeira").ok).toBe(true);
    expect(validarMudancaDeEstado({ padrao: false }, "arquivado").ok).toBe(true);
  });

  it("o padrão não é privatizado", () => {
    expect(validarPrivacidade({ padrao: true }, true).ok).toBe(false);
    expect(validarPrivacidade({ padrao: true }, false).ok).toBe(true);
    expect(validarPrivacidade({ padrao: false }, true).ok).toBe(true);
  });
});

describe("deveNascerPadrao (f)", () => {
  it("o primeiro Funil não privado nasce padrão (D-13)", () => {
    expect(deveNascerPadrao(false, false)).toBe(true);
  });

  it("havendo padrão, o seguinte nasce sem ser", () => {
    expect(deveNascerPadrao(true, false)).toBe(false);
  });

  it("um Funil privado nunca nasce padrão (funis_padrao_ck)", () => {
    expect(deveNascerPadrao(false, true)).toBe(false);
  });
});

describe("validarNovoPadrao (g)", () => {
  it("aceita Funil ativo e não privado", () => {
    expect(validarNovoPadrao({ estado: "ativo", privado: false }).ok).toBe(true);
  });

  it("recusa Funil arquivado", () => {
    expect(validarNovoPadrao({ estado: "arquivado", privado: false }).ok).toBe(false);
  });

  it("recusa Funil na lixeira", () => {
    expect(validarNovoPadrao({ estado: "na_lixeira", privado: false }).ok).toBe(false);
  });

  it("recusa Funil privado", () => {
    expect(validarNovoPadrao({ estado: "ativo", privado: true }).ok).toBe(false);
  });
});

describe("validarMigracao (h)", () => {
  const base = {
    origem: { id: "f1" },
    destino: { id: "f2", estado: "ativo" as const },
    etapasDoDestino: [{ id: "d1" }, { id: "d2" }],
    etapasDeOrigemComNegocios: ["o1", "o2"],
    mapeamento: { o1: "d1", o2: "d2" } as Record<string, string>,
  };

  it("aceita o mapeamento completo", () => {
    expect(validarMigracao(base).ok).toBe(true);
  });

  it("recusa destino igual à origem", () => {
    expect(validarMigracao({ ...base, destino: { id: "f1", estado: "ativo" } }).ok).toBe(false);
  });

  it("recusa destino que não está ativo", () => {
    expect(validarMigracao({ ...base, destino: { id: "f2", estado: "arquivado" } }).ok).toBe(false);
    expect(validarMigracao({ ...base, destino: { id: "f2", estado: "na_lixeira" } }).ok).toBe(false);
  });

  it("recusa Etapa de origem com Negócio sem mapeamento", () => {
    expect(validarMigracao({ ...base, mapeamento: { o1: "d1" } }).ok).toBe(false);
  });

  it("recusa mapeamento para Etapa de outro Funil", () => {
    expect(validarMigracao({ ...base, mapeamento: { o1: "d1", o2: "x9" } }).ok).toBe(false);
  });

  it("aceita Etapa de origem sem Negócios fora do mapeamento", () => {
    expect(validarMigracao({ ...base, etapasDeOrigemComNegocios: ["o1"], mapeamento: { o1: "d2" } }).ok).toBe(true);
  });
});

describe("frases de D-07 (i)", () => {
  it("fraseFunilComNegocios diz a contagem e aponta para migrar", () => {
    const frase = fraseFunilComNegocios(3);
    expect(frase).toContain("3 Negócios");
    expect(frase.toLowerCase()).toContain("migre");
  });

  it("fraseEtapaComNegocios usa o singular e aponta para remapear", () => {
    const frase = fraseEtapaComNegocios(1);
    expect(frase).toContain("1 Negócio");
    expect(frase).not.toContain("1 Negócios");
    expect(frase.toLowerCase()).toContain("remape");
  });

  it("fraseFunilComNegociosAbertos diz a contagem e aponta para migrar", () => {
    const frase = fraseFunilComNegociosAbertos(2);
    expect(frase).toContain("2 Negócios abertos");
    expect(frase.toLowerCase()).toContain("migre");
  });
});
