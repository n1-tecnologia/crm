/**
 * Checklist E3 — na dispensa por Integração manual (D6-04), o Resumo não pede
 * a ninguém que confira: antes, a ponte publicava com o próprio Membro de
 * serviço como avisado e o texto terminava em "Agente do pipeline, confira…",
 * com Menção ao próprio Agente. Sem `dispensada`, o texto de sempre continua
 * byte a byte.
 */
import { describe, expect, it } from "vitest";
import { TEXTOS_DA_CONFERENCIA } from "./financeiro-textos";

const PEDIDO_OK = 'responda "ok" para eu lançar, ou diga o que ajustar.';
const DISPENSA = "Integração manual: a conferência deste Resumo é dispensada.";

describe("TEXTOS_DA_CONFERENCIA — a linha final com a dispensa", () => {
  it("sem dispensa, os quatro textos de sempre", () => {
    expect(TEXTOS_DA_CONFERENCIA.chamada("Maryane")).toBe(`\n\nMaryane, confira: ${PEDIDO_OK}`);
    expect(TEXTOS_DA_CONFERENCIA.revisado("Ana", "troca a categoria", "Maryane")).toBe(
      `\n\nRevisado a pedido de Ana: "troca a categoria".\nMaryane, confira de novo: ${PEDIDO_OK}`,
    );
    expect(TEXTOS_DA_CONFERENCIA.dadosMudaram("Maryane")).toBe(
      `\n\nOs dados da conta mudaram depois da conferência.\nMaryane, confira de novo: ${PEDIDO_OK}`,
    );
    expect(TEXTOS_DA_CONFERENCIA.superada("Maryane")).toBe(
      `\n\nEste Resumo substitui o anterior, que não serve mais ao lançamento.\nMaryane, confira: ${PEDIDO_OK}`,
    );
  });

  it("com dispensa, nenhum texto pede conferência nem cita o Agente", () => {
    const textos = [
      TEXTOS_DA_CONFERENCIA.chamada("Agente do pipeline", true, true),
      TEXTOS_DA_CONFERENCIA.revisado("Ana", "troca a categoria", "Agente do pipeline", true, true),
      TEXTOS_DA_CONFERENCIA.dadosMudaram("Agente do pipeline", true, true),
      TEXTOS_DA_CONFERENCIA.superada("Agente do pipeline", true, true),
    ];
    for (const texto of textos) {
      expect(texto).toContain(DISPENSA);
      expect(texto).not.toContain("confira");
      expect(texto).not.toContain("Agente do pipeline");
    }
    expect(textos[1]).toContain('Revisado a pedido de Ana: "troca a categoria".');
  });
});
