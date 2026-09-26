import { describe, expect, it } from "vitest";
import { horaNoFuso, isoNoFuso, relogio, saudacao } from "./relogio";

const FUSO = "America/Sao_Paulo"; // UTC−3 em setembro de 2026 (sem horário de verão)

/** Um instante que, em BRT, cai na hora e no minuto pedidos de 18/09/2026. */
const emBrt = (hora: number, minuto = 0): Date => new Date(Date.UTC(2026, 8, 18, hora + 3, minuto));

describe("relogio — a saudação no fuso do Espaço de Trabalho", () => {
  it("cumprimenta a madrugada como noite: 00:41 não é 'Bom dia'", () => {
    expect(saudacao(emBrt(0, 41), FUSO)).toBe("Boa noite");
    expect(saudacao(emBrt(4, 59), FUSO)).toBe("Boa noite");
  });

  it("vira o dia às 5h, a tarde ao meio-dia e a noite às 18h", () => {
    expect(saudacao(emBrt(5, 0), FUSO)).toBe("Bom dia");
    expect(saudacao(emBrt(11, 59), FUSO)).toBe("Bom dia");
    expect(saudacao(emBrt(12, 0), FUSO)).toBe("Boa tarde");
    expect(saudacao(emBrt(17, 59), FUSO)).toBe("Boa tarde");
    expect(saudacao(emBrt(18, 0), FUSO)).toBe("Boa noite");
    expect(saudacao(emBrt(23, 59), FUSO)).toBe("Boa noite");
  });

  it("lê a hora no fuso pedido, não no da máquina", () => {
    // 03:41Z = 00:41 em São Paulo, 04:41 em Lisboa (UTC+1 em setembro) e 12:41 em Tóquio.
    const instante = new Date("2026-09-18T03:41:00Z");
    expect(horaNoFuso(instante, FUSO)).toBe(0);
    expect(horaNoFuso(instante, "Europe/Lisbon")).toBe(4);
    expect(saudacao(instante, "Asia/Tokyo")).toBe("Boa tarde");
  });
});

describe("relogio — o HUD", () => {
  it("dá ao <time> um dateTime ISO no fuso do Espaço de Trabalho, com o texto em pt-BR ao lado", () => {
    const r = relogio(emBrt(1, 2), FUSO);
    expect(r.iso).toBe("2026-09-18T01:02");
    expect(r.data).toBe("sex., 18 de set.");
    expect(r.hora).toMatch(/^01:02 /);
  });

  it("à meia-noite escreve 00, nunca 24", () => {
    expect(isoNoFuso(emBrt(0, 0), FUSO)).toBe("2026-09-18T00:00");
  });
});
