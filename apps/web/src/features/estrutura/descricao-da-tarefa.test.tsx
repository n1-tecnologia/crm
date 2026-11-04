// @vitest-environment jsdom
/**
 * D-06 na tela (11-07): na Tarefa aberta, o `@Nome` de cada Membro que a
 * descrição menciona DE FATO aparece destacado (`<span data-mencao>`). O que
 * não está na lista efetiva não destaca (D-09), e nada vira HTML (T-11-17).
 * Mesmo molde de `timeline.test.tsx`: `StoreProvider` real sobre `Transporte`
 * falso.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { DescricaoDaTarefa } from "./descricao-da-tarefa";

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

let state: DataState;

beforeEach(() => {
  state = buildSeed();
});

afterEach(() => {
  cleanup();
});

/** Uma Tarefa emprestada do seed, com a descrição e a lista de menções do teste. */
function tarefaComDescricao(description: string, comMencao: boolean): Task {
  const original = state.tasks[0];
  if (!original) throw new Error("seed sem Tarefas para clonar");
  const task: Task = {
    ...structuredClone(original),
    id: "tsk_teste_descricao",
    description,
  };
  if (comMencao) task.descriptionMentions = [{ type: "member", id: "mem_julia" }];
  else delete task.descriptionMentions;
  state.tasks.push(task);
  return task;
}

function renderizar(task: Task) {
  return render(
    <StoreProvider
      sessao={{ memberId: "mem_thiago" }}
      estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
      transporte={transporteFalso()}
    >
      <p data-testid="descricao">
        <DescricaoDaTarefa task={task} />
      </p>
    </StoreProvider>,
  );
}

describe("DescricaoDaTarefa — o nome mencionado destacado (D-06)", () => {
  it("destaca o @Nome da lista e deixa o texto inteiro igual ao da descrição", () => {
    const descricao = "Pedir a @Júlia Prado a revisão";
    const { container } = renderizar(tarefaComDescricao(descricao, true));

    expect(container.querySelector("[data-mencao]")?.textContent).toBe("@Júlia Prado");
    expect(container.querySelector("[data-testid=descricao]")?.textContent).toBe(descricao);
  });

  it("sem descriptionMentions não destaca nada (D-09)", () => {
    const { container } = renderizar(tarefaComDescricao("Pedir a @Júlia Prado a revisão", false));

    expect(container.querySelector("[data-mencao]")).toBeNull();
  });

  it("não vira HTML: o <b> aparece literal e não existe elemento b (T-11-17)", () => {
    const descricao = "<b>x</b> @Júlia Prado";
    const { container } = renderizar(tarefaComDescricao(descricao, true));

    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("[data-testid=descricao]")?.textContent).toContain("<b>x</b>");
    expect(container.querySelector("[data-mencao]")?.textContent).toBe("@Júlia Prado");
  });

  it("mantém a quebra de linha da descrição de duas linhas", () => {
    const { container } = renderizar(tarefaComDescricao("Primeira linha\nSegunda @Júlia Prado", true));

    expect(container.querySelector("[data-testid=descricao]")?.textContent).toContain("Primeira linha\nSegunda ");
  });
});
