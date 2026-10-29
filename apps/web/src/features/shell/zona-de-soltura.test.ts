import { describe, expect, it } from "vitest";
import { zonaDaSoltura } from "./zona-de-soltura";

/** Linha de 100px de altura que começa em y = 0: a posição vertical lida é a porcentagem. */
const TOPO = 0;
const ALTURA = 100;

const lista = (id: string, paiId = "fld_a") => ({ tipo: "list" as const, id, paiTipo: "folder" as const, paiId });
const pasta = (id: string, paiId = "spc_a") => ({ tipo: "folder" as const, id, paiTipo: "space" as const, paiId });
const espaco = (id: string) => ({ tipo: "space" as const, id });

const alvo = (base: { tipo: "space" | "folder" | "list"; id: string; paiTipo?: "space" | "folder"; paiId?: string }, extra: Partial<{ aberto: boolean; temFilhosVisiveis: boolean; descendenteDoArrastado: boolean }> = {}) => ({
  ...base,
  aberto: false,
  temFilhosVisiveis: false,
  descendenteDoArrastado: false,
  ...extra,
});

describe("zonaDaSoltura — Lista arrastada", () => {
  it("sobre uma Pasta de outro pai é «dentro» em qualquer altura", () => {
    for (const y of [5, 50, 95]) {
      expect(zonaDaSoltura(y, TOPO, ALTURA, lista("lst_1"), alvo(pasta("fld_b")))).toBe("dentro");
    }
  });

  it("sobre uma Lista do mesmo pai: metade de cima é «antes», metade de baixo é «depois»", () => {
    expect(zonaDaSoltura(10, TOPO, ALTURA, lista("lst_1"), alvo(lista("lst_2")))).toBe("antes");
    expect(zonaDaSoltura(49, TOPO, ALTURA, lista("lst_1"), alvo(lista("lst_2")))).toBe("antes");
    expect(zonaDaSoltura(51, TOPO, ALTURA, lista("lst_1"), alvo(lista("lst_2")))).toBe("depois");
    expect(zonaDaSoltura(90, TOPO, ALTURA, lista("lst_1"), alvo(lista("lst_2")))).toBe("depois");
  });

  it("sobre uma Lista de outro pai não é alvo", () => {
    expect(zonaDaSoltura(10, TOPO, ALTURA, lista("lst_1"), alvo(lista("lst_9", "fld_outra")))).toBeNull();
  });

  it("sobre o próprio pai não é alvo (A10), nem sobre si mesma", () => {
    expect(zonaDaSoltura(50, TOPO, ALTURA, lista("lst_1"), alvo({ tipo: "folder", id: "fld_a", paiTipo: "space", paiId: "spc_a" }))).toBeNull();
    expect(zonaDaSoltura(50, TOPO, ALTURA, lista("lst_1"), alvo(lista("lst_1")))).toBeNull();
  });

  it("sobre um Espaço é «dentro»; sobre o Espaço que já é o pai, não é alvo", () => {
    const direta = { tipo: "list" as const, id: "lst_1", paiTipo: "space" as const, paiId: "spc_a" };
    expect(zonaDaSoltura(50, TOPO, ALTURA, lista("lst_1"), alvo(espaco("spc_b")))).toBe("dentro");
    expect(zonaDaSoltura(50, TOPO, ALTURA, direta, alvo(espaco("spc_a")))).toBeNull();
  });
});

describe("zonaDaSoltura — Pasta arrastada", () => {
  it("sobre uma Pasta irmã: 10% é «antes», 50% é «dentro», 90% é «depois» (25/50/25)", () => {
    expect(zonaDaSoltura(10, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2")))).toBe("antes");
    expect(zonaDaSoltura(50, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2")))).toBe("dentro");
    expect(zonaDaSoltura(90, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2")))).toBe("depois");
  });

  it("as bordas de 25% e 75% pertencem ao meio", () => {
    expect(zonaDaSoltura(24, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2")))).toBe("antes");
    expect(zonaDaSoltura(25, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2")))).toBe("dentro");
    expect(zonaDaSoltura(75, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2")))).toBe("dentro");
    expect(zonaDaSoltura(76, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2")))).toBe("depois");
  });

  it("sobre uma Pasta irmã ABERTA com filhos visíveis, o quarto de baixo vale «dentro»", () => {
    const aberta = alvo(pasta("fld_2"), { aberto: true, temFilhosVisiveis: true });
    expect(zonaDaSoltura(90, TOPO, ALTURA, pasta("fld_1"), aberta)).toBe("dentro");
    expect(zonaDaSoltura(10, TOPO, ALTURA, pasta("fld_1"), aberta)).toBe("antes");
    // Aberta mas vazia (ou fechada com filhos) não muda nada.
    expect(zonaDaSoltura(90, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2"), { aberto: true }))).toBe("depois");
    expect(zonaDaSoltura(90, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_2"), { temFilhosVisiveis: true }))).toBe("depois");
  });

  it("Subpasta sobre Pasta de outro pai e Pasta sobre Subpasta também são alvo «dentro» (A2)", () => {
    const sub = { tipo: "folder" as const, id: "fld_sub", paiTipo: "folder" as const, paiId: "fld_x" };
    expect(zonaDaSoltura(50, TOPO, ALTURA, pasta("fld_1"), alvo(sub))).toBe("dentro");
    expect(zonaDaSoltura(95, TOPO, ALTURA, pasta("fld_1"), alvo(sub))).toBe("dentro");
    expect(zonaDaSoltura(50, TOPO, ALTURA, sub, alvo(pasta("fld_2", "spc_b")))).toBe("dentro");
  });

  it("sobre uma Pasta com Subpastas é «dentro» e a recusa é do domínio (A2)", () => {
    expect(zonaDaSoltura(50, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_com_subs"), { aberto: true, temFilhosVisiveis: true }))).toBe("dentro");
  });

  it("sobre um descendente de si, sobre si mesma ou sobre o pai atual não é alvo", () => {
    expect(zonaDaSoltura(50, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_filha"), { descendenteDoArrastado: true }))).toBeNull();
    expect(zonaDaSoltura(50, TOPO, ALTURA, pasta("fld_1"), alvo(pasta("fld_1")))).toBeNull();
    expect(zonaDaSoltura(50, TOPO, ALTURA, pasta("fld_1", "spc_a"), alvo(espaco("spc_a")))).toBeNull();
    const sub = { tipo: "folder" as const, id: "fld_sub", paiTipo: "folder" as const, paiId: "fld_pai" };
    expect(zonaDaSoltura(50, TOPO, ALTURA, sub, alvo({ tipo: "folder", id: "fld_pai", paiTipo: "space", paiId: "spc_a" }))).toBeNull();
  });

  it("sobre uma Lista não é alvo", () => {
    expect(zonaDaSoltura(50, TOPO, ALTURA, pasta("fld_1"), alvo(lista("lst_1")))).toBeNull();
  });

  it("sobre outro Espaço é «dentro» (promove ou muda de Espaço)", () => {
    expect(zonaDaSoltura(50, TOPO, ALTURA, pasta("fld_1", "spc_a"), alvo(espaco("spc_b")))).toBe("dentro");
  });
});

describe("zonaDaSoltura — Espaço arrastado", () => {
  it("sobre outro Espaço: nunca «dentro»; metade de cima é «antes», de baixo é «depois»", () => {
    for (const y of [1, 30, 49]) expect(zonaDaSoltura(y, TOPO, ALTURA, espaco("spc_1"), alvo(espaco("spc_2")))).toBe("antes");
    for (const y of [51, 70, 99]) expect(zonaDaSoltura(y, TOPO, ALTURA, espaco("spc_1"), alvo(espaco("spc_2")))).toBe("depois");
    // Mesmo aberto e com filhos, o Espaço não recebe «dentro».
    expect(zonaDaSoltura(90, TOPO, ALTURA, espaco("spc_1"), alvo(espaco("spc_2"), { aberto: true, temFilhosVisiveis: true }))).toBe("depois");
  });

  it("sobre si mesmo, sobre Pasta ou sobre Lista não é alvo", () => {
    expect(zonaDaSoltura(50, TOPO, ALTURA, espaco("spc_1"), alvo(espaco("spc_1")))).toBeNull();
    expect(zonaDaSoltura(50, TOPO, ALTURA, espaco("spc_1"), alvo(pasta("fld_1")))).toBeNull();
    expect(zonaDaSoltura(50, TOPO, ALTURA, espaco("spc_1"), alvo(lista("lst_1")))).toBeNull();
  });
});

describe("zonaDaSoltura — números injetáveis", () => {
  it("usa o topo e a altura recebidos, não a tela", () => {
    expect(zonaDaSoltura(210, 200, 40, lista("lst_1"), alvo(lista("lst_2")))).toBe("antes");
    expect(zonaDaSoltura(230, 200, 40, lista("lst_1"), alvo(lista("lst_2")))).toBe("depois");
  });

  it("altura zero (o jsdom zera o retângulo) não quebra: cai no meio", () => {
    expect(zonaDaSoltura(0, 0, 0, pasta("fld_1"), alvo(pasta("fld_2")))).toBe("dentro");
  });
});
