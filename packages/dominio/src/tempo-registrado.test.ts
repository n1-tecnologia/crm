/**
 * TAR-07 no domínio (11-03): `tempoRegistrado(state, taskId)` é o número de
 * tempo da Tarefa. Só lançamentos fechados somam (D-16) e a função depende só
 * do estado, nunca do relógio: o seed, os instantes e as durações abaixo são
 * montados à mão.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { tempoRegistrado } from "./derive";
import { createTask, trashTask } from "./operations/tasks";
import type { DataState } from "./state";
import type { Id, Task, TimeEntry } from "./types";

const THIAGO = "mem_thiago";
const LISTA = "lst_propostas";
let state: DataState;
let sequencia = 0;

beforeEach(() => {
  state = buildSeed();
  sequencia = 0;
});

function novaTarefa(titulo: string, parentTaskId?: Id): Task {
  const r = createTask(state, THIAGO, { listId: LISTA, title: titulo, ...(parentTaskId ? { parentTaskId } : {}) });
  if (!r.ok) throw new Error(`createTask recusou: ${r.error}`);
  return state.tasks.find((t) => t.id === r.value.id)!;
}

function fechado(task: Task, minutos: number): void {
  sequencia += 1;
  const inicio = Date.parse("2026-03-01T10:00:00Z") + sequencia * 3_600_000;
  const entry: TimeEntry = {
    id: `tme_t${sequencia}`,
    memberId: THIAGO,
    start: new Date(inicio).toISOString(),
    end: new Date(inicio + minutos * 60_000).toISOString(),
    durationMinutes: minutos,
    createdBy: { kind: "member", id: THIAGO },
  };
  task.timeEntries.push(entry);
}

function aberto(task: Task, memberId: Id = THIAGO): void {
  sequencia += 1;
  task.timeEntries.push({
    id: `tme_t${sequencia}`,
    memberId,
    start: new Date(Date.parse("2026-03-02T10:00:00Z") + sequencia * 3_600_000).toISOString(),
    createdBy: { kind: "member", id: memberId },
  });
}

describe("tempoRegistrado — o número da Tarefa (TAR-07, D-15)", () => {
  it("30 + 45 min fechados e um cronômetro aberto: 75 min, 3 lançamentos, em andamento", () => {
    const mae = novaTarefa("Mãe");
    fechado(mae, 30);
    fechado(mae, 45);
    aberto(mae);

    expect(tempoRegistrado(state, mae.id)).toEqual({ minutos: 75, lancamentos: 3, emAndamento: true, minutosComSubtarefas: 75 });
  });

  it("uma Subtarefa ativa com 20 min leva o total com Subtarefas a 95", () => {
    const mae = novaTarefa("Mãe");
    fechado(mae, 30);
    fechado(mae, 45);
    aberto(mae);
    const filha = novaTarefa("Filha", mae.id);
    fechado(filha, 20);

    expect(tempoRegistrado(state, mae.id)).toEqual({ minutos: 75, lancamentos: 3, emAndamento: true, minutosComSubtarefas: 95 });
    // O número da própria Subtarefa não inclui a mãe.
    expect(tempoRegistrado(state, filha.id).minutos).toBe(20);
  });

  it("Tarefa inexistente devolve tudo zerado", () => {
    expect(tempoRegistrado(state, "tsk_que_nao_existe")).toEqual({ minutos: 0, lancamentos: 0, emAndamento: false, minutosComSubtarefas: 0 });
  });
});

describe("tempoRegistrado — bordas (TAR-07)", () => {
  it("Tarefa sem lançamentos: tudo zerado", () => {
    const mae = novaTarefa("Mãe");
    expect(tempoRegistrado(state, mae.id)).toEqual({ minutos: 0, lancamentos: 0, emAndamento: false, minutosComSubtarefas: 0 });
  });

  it("só um cronômetro aberto: 0 min, 1 lançamento, em andamento", () => {
    const mae = novaTarefa("Mãe");
    aberto(mae);
    expect(tempoRegistrado(state, mae.id)).toEqual({ minutos: 0, lancamentos: 1, emAndamento: true, minutosComSubtarefas: 0 });
  });

  it("só fechados: não está em andamento", () => {
    const mae = novaTarefa("Mãe");
    fechado(mae, 30);
    fechado(mae, 45);
    expect(tempoRegistrado(state, mae.id)).toEqual({ minutos: 75, lancamentos: 2, emAndamento: false, minutosComSubtarefas: 75 });
  });

  it("Subtarefa na lixeira não soma, e a neta dela também não (A3)", () => {
    const mae = novaTarefa("Mãe");
    fechado(mae, 30);
    fechado(mae, 45);
    const filha = novaTarefa("Filha", mae.id);
    fechado(filha, 20);
    const neta = novaTarefa("Neta", filha.id);
    fechado(neta, 10);
    expect(tempoRegistrado(state, mae.id).minutosComSubtarefas).toBe(105);

    expect(trashTask(state, THIAGO, filha.id).ok).toBe(true);

    expect(tempoRegistrado(state, mae.id).minutosComSubtarefas).toBe(75);
  });

  it("cronômetro aberto só na Subtarefa não muda o 'em andamento' da mãe", () => {
    const mae = novaTarefa("Mãe");
    fechado(mae, 30);
    const filha = novaTarefa("Filha", mae.id);
    aberto(filha);
    expect(tempoRegistrado(state, mae.id).emAndamento).toBe(false);
    expect(tempoRegistrado(state, filha.id).emAndamento).toBe(true);
  });

  it("a neta (Subtarefa da Subtarefa) entra no total da avó", () => {
    const avo = novaTarefa("Avó");
    fechado(avo, 30);
    const mae = novaTarefa("Mãe", avo.id);
    const neta = novaTarefa("Neta", mae.id);
    fechado(neta, 10);
    expect(tempoRegistrado(state, avo.id)).toMatchObject({ minutos: 30, minutosComSubtarefas: 40 });
  });

  it("parentTaskId em ciclo não trava a soma", () => {
    const avo = novaTarefa("Avó");
    fechado(avo, 30);
    const filha = novaTarefa("Filha", avo.id);
    const neta = novaTarefa("Neta", filha.id);
    fechado(filha, 20);
    fechado(neta, 10);
    // Ciclo forjado: filha aponta para a neta, neta aponta para a filha.
    filha.parentTaskId = neta.id;
    neta.parentTaskId = filha.id;

    const tempo = tempoRegistrado(state, avo.id);
    expect(Number.isFinite(tempo.minutosComSubtarefas)).toBe(true);
    expect(tempoRegistrado(state, filha.id).minutosComSubtarefas).toBeGreaterThanOrEqual(20);
  });

  it("lançamento fechado sem durationMinutes (registro antigo) conta 0", () => {
    const mae = novaTarefa("Mãe");
    fechado(mae, 30);
    mae.timeEntries.push({
      id: "tme_antigo",
      memberId: THIAGO,
      start: "2026-01-01T10:00:00.000Z",
      end: "2026-01-01T11:00:00.000Z",
      createdBy: { kind: "member", id: THIAGO },
    });
    expect(tempoRegistrado(state, mae.id)).toMatchObject({ minutos: 30, lancamentos: 2, emAndamento: false });
  });

  it("duas chamadas seguidas com o mesmo estado devolvem o mesmo objeto (D-16)", () => {
    const mae = novaTarefa("Mãe");
    fechado(mae, 30);
    aberto(mae);
    expect(tempoRegistrado(state, mae.id)).toEqual(tempoRegistrado(state, mae.id));
  });

  it("o corpo de tempoRegistrado não chama relógio nenhum (D-16)", () => {
    const fonte = readFileSync(new URL("./derive.ts", import.meta.url), "utf8");
    const inicio = fonte.indexOf("export function tempoRegistrado");
    expect(inicio).toBeGreaterThan(-1);
    const proxima = fonte.indexOf("\nexport function", inicio + 10);
    const corpo = fonte.slice(inicio, proxima === -1 ? undefined : proxima);
    expect(corpo).not.toContain("Date");
    expect(corpo).not.toContain("now(");
  });
});
