/**
 * `aplicarDiferenca` é o espelho de `gravar()` (`apps/api/src/persistencia/
 * repositorio.ts`) do lado do cliente: aplica só o que mudou, respeitando a
 * `ordem` fracionária (D-03).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { COLECOES } from "./colecoes";
import { resetIdSequence } from "./operations/activity";
import { aplicarDiferenca, DIFERENCA_VAZIA, type Diferenca, type Ordens } from "./diferenca";
import type { DataState } from "./state";

/** Monta `ordens` como `hidratar()` faria: ordem = índice no array, por coleção. */
function ordensDoSeed(state: DataState): Ordens {
  const ordens: Ordens = {};
  const estado = state as unknown as Record<string, unknown>;
  for (const colecao of COLECOES) {
    const lista = estado[colecao] as ReadonlyArray<{ readonly id: string }>;
    const doColecao: Record<string, number> = {};
    lista.forEach((registro, indice) => {
      doColecao[registro.id] = indice;
    });
    ordens[colecao] = doColecao;
  }
  return ordens;
}

beforeEach(() => {
  resetIdSequence();
});

describe("aplicarDiferenca", () => {
  it("upsert de uma Tarefa existente com título novo substitui no mesmo índice", () => {
    const state = buildSeed();
    const ordens = ordensDoSeed(state);
    const tamanhoAntes = state.tasks.length;
    const tarefa = state.tasks[0]!;
    const diferenca: Diferenca = {
      gravados: [{ colecao: "tasks", id: tarefa.id, dados: { ...tarefa, title: "Outro título" }, ordem: ordens.tasks![tarefa.id]! }],
      removidos: [],
    };

    aplicarDiferenca(state, ordens, diferenca);

    expect(state.tasks.length).toBe(tamanhoAntes);
    expect(state.tasks[0]!.title).toBe("Outro título");
  });

  it("novo ActivityRecord com ordem -1 vira activity[0]", () => {
    const state = buildSeed();
    const ordens = ordensDoSeed(state);
    const novo = {
      id: "act_novo",
      workspaceId: state.workspace.id,
      actor: { kind: "system" as const, id: "sistema" },
      action: "teste",
      objectType: "task",
      objectId: state.tasks[0]!.id,
      objectName: "x",
      at: new Date().toISOString(),
      result: "ok" as const,
    };
    const diferenca: Diferenca = { gravados: [{ colecao: "activity", id: novo.id, dados: novo, ordem: -1 }], removidos: [] };

    aplicarDiferenca(state, ordens, diferenca);

    expect(state.activity[0]!.id).toBe("act_novo");
  });

  it("novo registro com ordem entre dois existentes fica entre eles", () => {
    const state = buildSeed();
    const ordens = ordensDoSeed(state);
    const tamanhoAntes = state.tasks.length;
    const primeira = state.tasks[0]!;
    const segunda = state.tasks[1]!;
    const ordemEntre = (ordens.tasks![primeira.id]! + ordens.tasks![segunda.id]!) / 2;
    const novaTarefa = { ...primeira, id: "tsk_novo_meio", title: "Nova no meio" };
    const diferenca: Diferenca = {
      gravados: [{ colecao: "tasks", id: novaTarefa.id, dados: novaTarefa, ordem: ordemEntre }],
      removidos: [],
    };

    aplicarDiferenca(state, ordens, diferenca);

    expect(state.tasks.length).toBe(tamanhoAntes + 1);
    expect(state.tasks[1]!.id).toBe("tsk_novo_meio");
  });

  it("removidos tira o registro do array e de ordens", () => {
    const state = buildSeed();
    const ordens = ordensDoSeed(state);
    const alvo = state.tasks[2]!;
    const diferenca: Diferenca = { gravados: [], removidos: [{ colecao: "tasks", id: alvo.id }] };

    aplicarDiferenca(state, ordens, diferenca);

    expect(state.tasks.find((t) => t.id === alvo.id)).toBeUndefined();
    expect(ordens.tasks![alvo.id]).toBeUndefined();
  });

  it("singular: gravar workspace substitui o objeto inteiro", () => {
    const state = buildSeed();
    const ordens = ordensDoSeed(state);
    const diferenca: Diferenca = {
      gravados: [{ colecao: "workspace", id: state.workspace.id, dados: { ...state.workspace, name: "Outro" }, ordem: 0 }],
      removidos: [],
    };

    aplicarDiferenca(state, ordens, diferenca);

    expect(state.workspace.name).toBe("Outro");
  });

  it("coleção desconhecida é ignorada sem lançar", () => {
    const state = buildSeed();
    const ordens = ordensDoSeed(state);
    const diferenca: Diferenca = {
      gravados: [{ colecao: "naoExiste", id: "x", dados: {}, ordem: 0 }],
      removidos: [{ colecao: "naoExiste", id: "y" }],
    };

    expect(() => aplicarDiferenca(state, ordens, diferenca)).not.toThrow();
  });

  it("DIFERENCA_VAZIA não muda o estado", () => {
    const state = buildSeed();
    const ordens = ordensDoSeed(state);
    const clone = structuredClone(state);

    aplicarDiferenca(state, ordens, DIFERENCA_VAZIA);

    expect(state).toStrictEqual(clone);
  });
});
