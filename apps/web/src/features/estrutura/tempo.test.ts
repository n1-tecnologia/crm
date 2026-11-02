/**
 * Formato do tempo registrado (D-15, 11-03): o editor e a linha "Rastrear
 * tempo" saem do mesmo formatador. Sem jsdom.
 */
import { describe, expect, it } from "vitest";
import type { TempoRegistrado } from "@n1/dominio/derive";
import { minutos, textoDoTempo, valorDaLinhaDeTempo } from "./tempo";

const tempo = (parcial: Partial<TempoRegistrado>): TempoRegistrado => ({
  minutos: 0,
  lancamentos: 0,
  emAndamento: false,
  minutosComSubtarefas: 0,
  ...parcial,
});

describe("minutos", () => {
  it("formata em horas e minutos de dois dígitos", () => {
    expect(minutos(0)).toBe("0 min");
    expect(minutos(59)).toBe("59 min");
    expect(minutos(60)).toBe("1 h 00 min");
    expect(minutos(135)).toBe("2 h 15 min");
  });
});

describe("textoDoTempo", () => {
  it("com Subtarefas com tempo, mostra o total delas", () => {
    expect(textoDoTempo(tempo({ minutos: 75, lancamentos: 3, emAndamento: true, minutosComSubtarefas: 95 }))).toEqual({
      total: "1 h 15 min",
      emAndamento: true,
      comSubtarefas: "1 h 35 min com Subtarefas",
    });
  });

  it("sem tempo nas Subtarefas, não há comSubtarefas", () => {
    const texto = textoDoTempo(tempo({ minutos: 75, lancamentos: 3, emAndamento: true, minutosComSubtarefas: 75 }));
    expect(texto.comSubtarefas).toBeUndefined();
    expect(texto.total).toBe("1 h 15 min");
  });
});

describe("valorDaLinhaDeTempo", () => {
  it("sem lançamentos e sem Subtarefas com tempo: Iniciar", () => {
    expect(valorDaLinhaDeTempo(tempo({}))).toBe("Iniciar");
  });

  it("só um cronômetro aberto", () => {
    expect(valorDaLinhaDeTempo(tempo({ lancamentos: 1, emAndamento: true }))).toBe("0 min · 1 registro · em andamento");
  });

  it("só fechados", () => {
    expect(valorDaLinhaDeTempo(tempo({ minutos: 75, lancamentos: 2, minutosComSubtarefas: 75 }))).toBe("1 h 15 min · 2 registros");
  });

  it("sem lançamento próprio e 20 min nas Subtarefas", () => {
    expect(valorDaLinhaDeTempo(tempo({ minutosComSubtarefas: 20 }))).toBe("0 min · 20 min com Subtarefas");
  });

  it("começa pelo mesmo total que o editor mostra (D-15)", () => {
    const casos = [
      tempo({ minutos: 75, lancamentos: 3, emAndamento: true, minutosComSubtarefas: 95 }),
      tempo({ lancamentos: 1, emAndamento: true }),
      tempo({ minutos: 135, lancamentos: 1, minutosComSubtarefas: 135 }),
      tempo({ minutosComSubtarefas: 20 }),
      tempo({}),
    ];
    for (const t of casos) {
      const linha = valorDaLinhaDeTempo(t);
      if (linha === "Iniciar") continue;
      expect(linha.startsWith(textoDoTempo(t).total)).toBe(true);
    }
  });
});
