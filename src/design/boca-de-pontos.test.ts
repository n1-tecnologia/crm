import { describe, expect, it } from "vitest";
import { PONTOS_DA_BOCA, pontoDaBocaAceso } from "./boca-de-pontos";

const acesos = (a: number) => PONTOS_DA_BOCA.filter(({ coluna, linha }) => pontoDaBocaAceso(coluna, linha, a));

describe("a boca de pontos do robô", () => {
  it("fechada é uma linha de 9 pontos", () => {
    const fechada = acesos(0);
    expect(fechada).toHaveLength(9);
    expect(fechada.every(({ linha }) => linha === 0)).toBe(true);
  });

  it("uma abertura pequena não acende nada além da linha", () => {
    expect(acesos(0.2)).toHaveLength(9);
  });

  it("mexe DE LEVE: no máximo 5 pontos acima e 5 abaixo, no centro", () => {
    const aberta = acesos(1);
    expect(aberta).toHaveLength(19);
    const fora = aberta.filter(({ linha }) => linha !== 0);
    expect(fora.every(({ linha, coluna }) => Math.abs(linha) === 1 && Math.abs(coluna) <= 2)).toBe(true);
  });

  it("abre em degraus pequenos e nunca acende as linhas de fora", () => {
    const contagens = [0.3, 0.5, 0.75, 1].map((a) => acesos(a).length);
    expect(contagens).toEqual([...contagens].sort((x, y) => x - y));
    for (const a of [0, 0.4, 0.8, 1, 2]) expect(acesos(a).some(({ linha }) => Math.abs(linha) === 2)).toBe(false);
  });
});
