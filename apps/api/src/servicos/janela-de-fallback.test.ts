/**
 * Casos (a)-(g) do Plan 02-24, Task 1 — sem banco, relógio injetado
 * (`../testes/relogio.ts`, V02-08B). `FALLBACK_COMENTARIO_ATE` é salva e
 * restaurada a cada teste: os casos (d)/(e) dependem de manipular o
 * `process.env` sem vazar para os outros arquivos de teste do mesmo
 * processo vitest.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relogioFixo } from "../testes/relogio";
import { calcularDataFinal, dentroDaJanela, metricaDeOrigem } from "./janela-de-fallback";

const VARIAVEL = "FALLBACK_COMENTARIO_ATE";

describe("dentroDaJanela", () => {
  let valorOriginal: string | undefined;

  beforeEach(() => {
    valorOriginal = process.env[VARIAVEL];
  });

  afterEach(() => {
    if (valorOriginal === undefined) delete process.env[VARIAVEL];
    else process.env[VARIAVEL] = valorOriginal;
    vi.restoreAllMocks();
  });

  it("(a) instante antes da data final -> true", () => {
    const relogio = relogioFixo("2026-01-01T00:00:00.000Z");
    expect(dentroDaJanela(relogio, "2026-03-31T23:59:59.000Z")).toBe(true);
  });

  it("(b) instante exatamente na data final -> true (o dia 90 ainda vale)", () => {
    const relogio = relogioFixo("2026-03-31T23:59:59.000Z");
    expect(dentroDaJanela(relogio, "2026-03-31T23:59:59.000Z")).toBe(true);
  });

  it("(c) instante depois da data final -> false", () => {
    const relogio = relogioFixo("2026-04-01T00:00:00.001Z");
    expect(dentroDaJanela(relogio, "2026-03-31T23:59:59.000Z")).toBe(false);
  });

  it("(d) variável ausente -> false (fallback desligado, não ligado para sempre)", () => {
    delete process.env[VARIAVEL];
    const relogio = relogioFixo("2026-01-01T00:00:00.000Z");
    expect(dentroDaJanela(relogio)).toBe(false);
  });

  it("(e) variável com valor inválido -> false e um aviso no log, nunca true", () => {
    process.env[VARIAVEL] = "isto-nao-e-uma-data";
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const relogio = relogioFixo("2026-01-01T00:00:00.000Z");
    expect(dentroDaJanela(relogio)).toBe(false);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso.mock.calls[0]?.[0]).toContain("FALLBACK_COMENTARIO_ATE");
  });
});

describe("calcularDataFinal", () => {
  it("(f) goLive + 90 dias corridos, atravessando virada de mês", () => {
    // 2026-01-15 + 90 dias corridos = 2026-04-15 (31 dias de jan restantes
    // contam desde o dia 15, +28 de fev [2026 não é bissexto] +31 de mar +
    // 15 de abr = 90).
    expect(calcularDataFinal("2026-01-15T00:00:00.000Z")).toBe("2026-04-15T00:00:00.000Z");
  });
});

describe("metricaDeOrigem", () => {
  it("(g) 3 por clique e 1 por comentário -> razao 0.25", () => {
    const aprovacoes = [
      { decidedAt: "2026-01-05T00:00:00.000Z", decisionSource: "click" as const },
      { decidedAt: "2026-01-06T00:00:00.000Z", decisionSource: "click" as const },
      { decidedAt: "2026-01-07T00:00:00.000Z", decisionSource: "click" as const },
      { decidedAt: "2026-01-08T00:00:00.000Z", decisionSource: "comment" as const },
      // Fora do período — não deve entrar na contagem.
      { decidedAt: "2026-02-01T00:00:00.000Z", decisionSource: "comment" as const },
      // Sem decisionSource (aprovação de Execução de Agente) — nunca entra no total de D-10.
      { decidedAt: "2026-01-06T00:00:00.000Z", decisionSource: undefined },
    ];
    const metrica = metricaDeOrigem(aprovacoes, { desde: "2026-01-01T00:00:00.000Z", ate: "2026-01-31T23:59:59.000Z" });
    expect(metrica).toEqual({ porClique: 3, porComentario: 1, total: 4, razao: 0.25 });
  });
});
