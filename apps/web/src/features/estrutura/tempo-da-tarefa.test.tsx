// @vitest-environment jsdom
/**
 * TAR-07 na tela (11-03): o editor `TaskTime` mostra o número que o domínio
 * calcula em `tempoRegistrado` (D-15) — o total da Tarefa, "em andamento" e,
 * só quando alguma Subtarefa tem tempo, o total "com Subtarefas". Mesmo molde
 * de `timeline.test.tsx`: `StoreProvider` real sobre `Transporte` falso.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Task, TimeEntry } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { TaskTime } from "./collaboration-editors";

const THIAGO = "mem_thiago";

function ordensDeTodasAsColecoes(estado: DataState): Ordens {
  const resultado: Ordens = {};
  for (const [colecao, valor] of Object.entries(estado)) {
    if (!Array.isArray(valor)) continue;
    const porId: Record<string, number> = {};
    valor.forEach((registro, indice) => {
      if (registro && typeof registro === "object" && "id" in registro) {
        porId[(registro as { readonly id: string }).id] = indice;
      }
    });
    resultado[colecao] = porId;
  }
  return resultado;
}

function transporteFalso(): Transporte {
  return {
    gravar: vi.fn<Transporte["gravar"]>(),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
}

let sequencia = 0;
function fechado(task: Task, minutos: number): void {
  sequencia += 1;
  const inicio = Date.parse("2026-03-01T10:00:00Z") + sequencia * 3_600_000;
  const entry: TimeEntry = {
    id: `tme_web${sequencia}`,
    memberId: THIAGO,
    start: new Date(inicio).toISOString(),
    end: new Date(inicio + minutos * 60_000).toISOString(),
    durationMinutes: minutos,
    createdBy: { kind: "member", id: THIAGO },
  };
  task.timeEntries.push(entry);
}

function aberto(task: Task): void {
  sequencia += 1;
  task.timeEntries.push({
    id: `tme_web${sequencia}`,
    memberId: "mem_julia",
    start: new Date(Date.parse("2026-03-02T10:00:00Z") + sequencia * 3_600_000).toISOString(),
    createdBy: { kind: "member", id: "mem_julia" },
  });
}

function tarefaDo(state: DataState, id: string, parentTaskId?: string): Task {
  const original = state.tasks[0];
  if (!original) throw new Error("seed sem Tarefas para clonar");
  const task: Task = {
    ...structuredClone(original),
    id,
    title: `Tarefa ${id}`,
    timeEntries: [],
    ...(parentTaskId ? { parentTaskId } : {}),
  };
  state.tasks.push(task);
  return task;
}

function renderizar(state: DataState, task: Task) {
  return render(
    <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }} transporte={transporteFalso()}>
      <TaskTime task={task} report={() => {}} readOnly />
    </StoreProvider>,
  );
}

let state: DataState;
beforeEach(() => {
  state = buildSeed();
  sequencia = 0;
});
afterEach(() => cleanup());

describe("TaskTime — o número do domínio (TAR-07, D-15)", () => {
  it("mostra o total fechado e 'em andamento', sem 'com Subtarefas' quando nenhuma Subtarefa tem tempo", () => {
    const mae = tarefaDo(state, "tsk_tempo_mae");
    fechado(mae, 30);
    fechado(mae, 45);
    aberto(mae);

    const { container } = renderizar(state, mae);
    const resumo = container.querySelector("p")?.textContent ?? "";
    expect(resumo).toContain("Total registrado: 1 h 15 min");
    expect(resumo).toContain("em andamento");
    expect(container.textContent).not.toContain("com Subtarefas");
  });

  it("com uma Subtarefa de 20 min mostra '1 h 35 min com Subtarefas'", () => {
    const mae = tarefaDo(state, "tsk_tempo_mae");
    fechado(mae, 30);
    fechado(mae, 45);
    aberto(mae);
    const filha = tarefaDo(state, "tsk_tempo_filha", mae.id);
    fechado(filha, 20);

    const { container } = renderizar(state, mae);
    const resumo = container.querySelector("p")?.textContent ?? "";
    expect(resumo).toContain("Total registrado: 1 h 15 min");
    expect(resumo).toContain("1 h 35 min com Subtarefas");
  });
});
