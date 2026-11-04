/**
 * `literalEntreDolares` (Fase 13): o texto vai ao banco entre dólares, sem
 * escape, e a marca nunca pode aparecer dentro dele. A prova de que o banco
 * devolve o mesmo texto está em `unidade-de-trabalho-em-lote.test.ts`, que
 * roda contra Postgres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sorteio = vi.hoisted(() => ({ marcas: [] as string[] }));

vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return {
    ...real,
    randomBytes: (tamanho: number) => (sorteio.marcas.length > 0 ? Buffer.from(sorteio.marcas.shift()!, "hex") : real.randomBytes(tamanho)),
  };
});

import { literalEntreDolares } from "./sql-literal";

beforeEach(() => {
  sorteio.marcas.length = 0;
});

describe("literalEntreDolares", () => {
  it("cerca o texto com a mesma marca nas duas pontas, sem tocar no conteúdo", () => {
    sorteio.marcas.push("aaaaaaaaaaaa");
    expect(literalEntreDolares("oi 'mundo' \\ \n")).toBe("$n1_aaaaaaaaaaaa$oi 'mundo' \\ \n$n1_aaaaaaaaaaaa$");
  });

  it("texto vazio também vira literal", () => {
    sorteio.marcas.push("aaaaaaaaaaaa");
    expect(literalEntreDolares("")).toBe("$n1_aaaaaaaaaaaa$$n1_aaaaaaaaaaaa$");
  });

  it("sorteia outra marca quando o texto contém a primeira", () => {
    sorteio.marcas.push("aaaaaaaaaaaa", "bbbbbbbbbbbb");
    expect(literalEntreDolares("antes $n1_aaaaaaaaaaaa$ depois")).toBe("$n1_bbbbbbbbbbbb$antes $n1_aaaaaaaaaaaa$ depois$n1_bbbbbbbbbbbb$");
  });

  it("sorteia outra marca quando o fim do texto, com o $ de fechamento, formaria a marca antes da hora", () => {
    // O texto termina em `$n1_aaaaaaaaaaaa` (sem o $ final): colado ao fechamento, a marca apareceria
    // 1 caractere antes do fechamento de verdade e o literal acabaria cedo.
    sorteio.marcas.push("aaaaaaaaaaaa", "bbbbbbbbbbbb");
    expect(literalEntreDolares("fim $n1_aaaaaaaaaaaa")).toBe("$n1_bbbbbbbbbbbb$fim $n1_aaaaaaaaaaaa$n1_bbbbbbbbbbbb$");
  });

  it("sem sorteio forçado, a marca é imprevisível e a conferência vale para texto que cita dólares", () => {
    const texto = "$$ $1 $n1_ $abc$ ${x}";
    const a = literalEntreDolares(texto);
    const b = literalEntreDolares(texto);
    expect(a).not.toBe(b);
    for (const literal of [a, b]) {
      const marca = /^\$n1_[0-9a-f]{12}\$/.exec(literal)![0];
      expect(literal).toBe(`${marca}${texto}${marca}`);
      expect(texto.includes(marca)).toBe(false);
    }
  });
});
