import { describe, expect, it } from "vitest";
import { relogioFixo } from "./relogio";

describe("relogioFixo", () => {
  it("devolve o instante dado", () => {
    const relogio = relogioFixo("2026-01-01T00:00:00.000Z");
    expect(relogio.agoraIso()).toBe("2026-01-01T00:00:00.000Z");
    expect(relogio.agora()).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("avancar soma exatamente o ms pedido", () => {
    const inicio = "2026-01-01T00:00:00.000Z";
    const relogio = relogioFixo(inicio);
    const noventaDiasEmMs = 90 * 24 * 60 * 60 * 1000; // a janela de 90 dias, D-10
    relogio.avancar(noventaDiasEmMs);
    expect(relogio.agora().getTime()).toBe(new Date(inicio).getTime() + noventaDiasEmMs);
  });

  it("definir substitui o instante", () => {
    const relogio = relogioFixo("2026-01-01T00:00:00.000Z");
    relogio.definir("2027-06-15T12:00:00.000Z");
    expect(relogio.agoraIso()).toBe("2027-06-15T12:00:00.000Z");
  });
});
