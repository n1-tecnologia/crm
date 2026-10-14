import { describe, expect, it } from "vitest";
import { dataNoDia, diaDaTarefa, gradeDoMes, instanteNoFuso, mesVizinho } from "./calendario";

const SP = "America/Sao_Paulo";

describe("calendario — o dia de uma Tarefa", () => {
  it("dia civil é o que está escrito, sem fuso", () => {
    expect(diaDaTarefa({ dueDate: { form: "civilDay", value: "2026-10-14" } }, SP)).toBe("2026-10-14");
  });
  it("instante cai no dia do fuso do Espaço, não no dia UTC", () => {
    // 23:30 em São Paulo (UTC-3) do dia 14 é 02:30 UTC do dia 15.
    expect(diaDaTarefa({ dueDate: { form: "instant", value: "2026-10-15T02:30:00.000Z" } }, SP)).toBe("2026-10-14");
    expect(diaDaTarefa({ dueDate: { form: "instant", value: "2026-10-15T02:30:00.000Z" } }, "UTC")).toBe("2026-10-15");
  });
  it("sem vencimento, sem dia", () => {
    expect(diaDaTarefa({}, SP)).toBeUndefined();
  });
});

describe("calendario — a grade do mês", () => {
  it("outubro de 2026 começa numa quinta e tem 5 semanas de 7 dias", () => {
    const grade = gradeDoMes("2026-10");
    expect(grade.length).toBe(5);
    for (const semana of grade) expect(semana.length).toBe(7);
    expect(grade[0]?.[4]).toEqual({ dia: "2026-10-01", doMes: true });
    expect(grade[0]?.[3]).toEqual({ dia: "2026-09-30", doMes: false });
    expect(grade[4]?.[6]).toEqual({ dia: "2026-10-31", doMes: true });
    // Novembro de 2026 começa no domingo e termina numa segunda: a última linha completa com dezembro.
    const novembro = gradeDoMes("2026-11");
    expect(novembro.length).toBe(5);
    expect(novembro[4]?.[6]).toEqual({ dia: "2026-12-05", doMes: false });
  });
  it("fevereiro de 2026 começa no domingo e cabe em 4 semanas", () => {
    const grade = gradeDoMes("2026-02");
    expect(grade.length).toBe(4);
    expect(grade[0]?.[0]).toEqual({ dia: "2026-02-01", doMes: true });
    expect(grade[3]?.[6]).toEqual({ dia: "2026-02-28", doMes: true });
  });
  it("mês vizinho atravessa o ano", () => {
    expect(mesVizinho("2026-12", 1)).toBe("2027-01");
    expect(mesVizinho("2026-01", -1)).toBe("2025-12");
  });
});

describe("calendario — arrastar para outro dia", () => {
  it("dia civil troca só o dia", () => {
    expect(dataNoDia({ form: "civilDay", value: "2026-10-14" }, "2026-10-20", SP)).toEqual({ form: "civilDay", value: "2026-10-20" });
    expect(dataNoDia(undefined, "2026-10-20", SP)).toEqual({ form: "civilDay", value: "2026-10-20" });
  });
  it("instante mantém a hora local e muda o dia", () => {
    const movido = dataNoDia({ form: "instant", value: "2026-10-15T02:30:00.000Z" }, "2026-10-20", SP);
    expect(movido).toEqual({ form: "instant", value: "2026-10-21T02:30:00.000Z" });
  });
  it("instanteNoFuso lê a hora no fuso dado", () => {
    expect(instanteNoFuso("2026-10-20", "09:00", SP)).toBe("2026-10-20T12:00:00.000Z");
    expect(instanteNoFuso("2026-10-20", "09:00", "UTC")).toBe("2026-10-20T09:00:00.000Z");
  });
});
