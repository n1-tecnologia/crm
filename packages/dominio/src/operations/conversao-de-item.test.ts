/**
 * TAR-01 (Fase 11, D-04) — converter Item de Checklist em Subtarefa "sem
 * susto": a recusa é UMA derivada (`conversaoDeItemRecusada`) que a tela
 * consulta para esconder o botão e que a operação consulta primeiro. Os dois
 * lados têm de dizer a MESMA frase, e a recusa vem antes de qualquer efeito.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { conversaoDeItemRecusada, taskWriteRefusal } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { setContainerFeature } from "./configuration";
import { convertChecklistItem, trashTask } from "./tasks";

const THIAGO = "mem_thiago";
const BEATRIZ = "mem_beatriz"; // Convidado
const TAREFA = "tsk_seed_1";
const CHECKLIST = "chk_seed_1";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

/** Empurra um Checklist de um Item na Tarefa, como `operations.test.ts` faz. */
function comChecklist(taskId: string, itemId: string, checklistId = "chk_x"): void {
  state.tasks.find((t) => t.id === taskId)?.checklists.push({
    id: checklistId,
    name: "Passos",
    order: 0,
    items: [{ id: itemId, text: "Passo de teste", order: 0, done: false }],
    createdBy: { kind: "member", id: THIAGO },
    createdAt: new Date().toISOString(),
  });
}

/** A recusa da operação é exatamente a da derivada, e nada mudou. */
function esperaRecusaSemEfeito(
  taskId: string,
  checklistId: string,
  itemId: string,
  quem = THIAGO,
): string {
  const antes = state.tasks.length;
  const item = state.tasks
    .find((t) => t.id === taskId)
    ?.checklists.find((c) => c.id === checklistId)
    ?.items.find((i) => i.id === itemId);
  const derivada = conversaoDeItemRecusada(state, quem, taskId);
  expect(derivada).toBeTypeOf("string");

  const result = convertChecklistItem(state, quem, taskId, checklistId, itemId);

  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("a conversão devia ter sido recusada");
  expect(result.error).toBe(derivada);
  expect(state.tasks.length).toBe(antes);
  expect(item?.converted).toBeUndefined();
  return result.error;
}

describe("conversaoDeItemRecusada — quando dá para converter", () => {
  it("devolve undefined em tsk_seed_1 e a operação cria a Subtarefa sob a própria Tarefa", () => {
    expect(conversaoDeItemRecusada(state, THIAGO, TAREFA)).toBeUndefined();

    const result = convertChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_2");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.parentTaskId).toBe(TAREFA);
  });
});

describe("conversaoDeItemRecusada — o nível máximo (adjacência 7/8)", () => {
  it("tsk_seed_7 (nível 2, máximo − 1) ainda converte", () => {
    comChecklist("tsk_seed_7", "cki_x");
    expect(conversaoDeItemRecusada(state, THIAGO, "tsk_seed_7")).toBeUndefined();

    const result = convertChecklistItem(state, THIAGO, "tsk_seed_7", "chk_x", "cki_x");

    expect(result.ok).toBe(true);
  });

  it("tsk_seed_8 (nível 3, o máximo) recusa com a frase nova, igual na derivada e na operação", () => {
    comChecklist("tsk_seed_8", "cki_x");

    const frase = esperaRecusaSemEfeito("tsk_seed_8", "chk_x", "cki_x");

    expect(frase).toBe("Esta Tarefa já está no nível 3, o último permitido. O item não pode virar Subtarefa aqui.");
  });
});

describe("conversaoDeItemRecusada — Lista sem Subtarefas", () => {
  it("recusa com a frase da Lista, igual na derivada e na operação, sem efeito", () => {
    const lista = state.tasks.find((t) => t.id === TAREFA)!.listId;
    const desligar = setContainerFeature(state, THIAGO, "list", lista, "subtarefas", false);
    if (!desligar.ok) throw new Error(desligar.error);

    const frase = esperaRecusaSemEfeito(TAREFA, CHECKLIST, "cki_2");

    expect(frase).toBe("Esta Lista não usa Subtarefas.");
  });
});

describe("conversaoDeItemRecusada — quem não escreve na Tarefa", () => {
  it("devolve a frase de taskWriteRefusal para o Convidado, igual na operação", () => {
    const escrita = taskWriteRefusal(state, BEATRIZ, TAREFA);
    expect(escrita).toBeTypeOf("string");

    const frase = esperaRecusaSemEfeito(TAREFA, CHECKLIST, "cki_2", BEATRIZ);

    expect(frase).toBe(escrita);
  });

  it("ordem fixa: sem escrita numa Lista sem Subtarefas, vale a frase de escrita", () => {
    const lista = state.tasks.find((t) => t.id === TAREFA)!.listId;
    const desligar = setContainerFeature(state, THIAGO, "list", lista, "subtarefas", false);
    if (!desligar.ok) throw new Error(desligar.error);
    const escrita = taskWriteRefusal(state, BEATRIZ, TAREFA);

    const frase = esperaRecusaSemEfeito(TAREFA, CHECKLIST, "cki_2", BEATRIZ);

    expect(frase).toBe(escrita);
    expect(frase).not.toBe("Esta Lista não usa Subtarefas.");
  });
});

describe("conversaoDeItemRecusada — Tarefa fora do ativo", () => {
  it("Tarefa na lixeira devolve a frase de Tarefa inativa, igual na operação", () => {
    const lixeira = trashTask(state, THIAGO, TAREFA);
    if (!lixeira.ok) throw new Error(lixeira.error);

    const frase = esperaRecusaSemEfeito(TAREFA, CHECKLIST, "cki_2");

    expect(frase).toBe("Esta Tarefa não está ativa. Restaure-a para editá-la.");
  });
});

describe("conversaoDeItemRecusada e convertChecklistItem — não encontrado", () => {
  it("Id de Tarefa inexistente: a derivada e a operação dizem 'Tarefa não encontrada.'", () => {
    expect(conversaoDeItemRecusada(state, THIAGO, "tsk_nada")).toBe("Tarefa não encontrada.");
    const result = convertChecklistItem(state, THIAGO, "tsk_nada", CHECKLIST, "cki_2");
    expect(result.ok ? "" : result.error).toBe("Tarefa não encontrada.");
  });

  it("Item ou Checklist inexistente numa Tarefa que pode converter: 'Item de Checklist não encontrado.', sem efeito", () => {
    expect(conversaoDeItemRecusada(state, THIAGO, TAREFA)).toBeUndefined();
    const antes = state.tasks.length;

    const semItem = convertChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_nada");
    const semChecklist = convertChecklistItem(state, THIAGO, TAREFA, "chk_nada", "cki_2");

    expect(semItem.ok ? "" : semItem.error).toBe("Item de Checklist não encontrado.");
    expect(semChecklist.ok ? "" : semChecklist.error).toBe("Item de Checklist não encontrado.");
    expect(state.tasks.length).toBe(antes);
  });

  it("Item já convertido: 'Este Item já foi convertido.', sem segunda Subtarefa", () => {
    const primeira = convertChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_2");
    if (!primeira.ok) throw new Error(primeira.error);
    const antes = state.tasks.length;

    const segunda = convertChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_2");

    expect(segunda.ok ? "" : segunda.error).toBe("Este Item já foi convertido.");
    expect(state.tasks.length).toBe(antes);
  });
});

describe("convertChecklistItem — dois Itens em sequência (TAR-02, ordem)", () => {
  it("os dois ficam no mesmo lugar do Checklist, marcados convertidos, e a segunda Subtarefa nasce depois", () => {
    const tarefa = state.tasks.find((t) => t.id === TAREFA)!;
    const idsAntes = tarefa.checklists.find((c) => c.id === CHECKLIST)!.items.map((i) => i.id);

    const a = convertChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_2");
    const b = convertChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_3");
    if (!a.ok) throw new Error(a.error);
    if (!b.ok) throw new Error(b.error);

    const itens = tarefa.checklists.find((c) => c.id === CHECKLIST)!.items;
    expect(itens.map((i) => i.id)).toEqual(idsAntes);
    expect(itens.find((i) => i.id === "cki_2")?.converted).toBeDefined();
    expect(itens.find((i) => i.id === "cki_3")?.converted).toBeDefined();
    expect(b.value.siblingOrder).toBeGreaterThan(a.value.siblingOrder);
  });
});
