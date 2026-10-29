/**
 * TAR-07 no domínio (11-03): `tempoRegistrado(state, taskId)` é o número de
 * tempo da Tarefa. Só lançamentos fechados somam (D-16) e a função depende só
 * do estado, nunca do relógio: o seed, os instantes e as durações abaixo são
 * montados à mão.
 */
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
