/**
 * PARA-01 — remover Checklist e Item de Checklist (checklist.md, seção 12):
 * edição da Tarefa, definitiva (não há lixeira de componente), com o conteúdo
 * removido preservado no Registro de Atividade. Remover um Checklist leva os
 * Itens; remover um Item leva os Subitens; um Item `convertido` sai do
 * Checklist sem efeito sobre a Subtarefa (B48).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { checklistProgress } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { convertChecklistItem, removeChecklist, removeChecklistItem } from "./tasks";

const THIAGO = "mem_thiago";
const TAREFA = "tsk_seed_1";
const CHECKLIST = "chk_seed_1";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const tarefa = () => state.tasks.find((t) => t.id === TAREFA)!;
const checklist = () => tarefa().checklists.find((c) => c.id === CHECKLIST);

describe("removeChecklistItem", () => {
  it("tira o Item do Checklist e do progresso, e guarda o texto no Registro de Atividade", () => {
    expect(checklistProgress(tarefa())).toEqual({ done: 1, total: 3 });

    const result = removeChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_2");

    expect(result.ok).toBe(true);
    expect(checklist()?.items.map((i) => i.id)).toEqual(["cki_1", "cki_3"]);
    expect(checklistProgress(tarefa())).toEqual({ done: 1, total: 2 });
    const registro = state.activity.find((a) => a.action === "Item de Checklist removido");
    expect(registro?.objectId).toBe(TAREFA);
    expect(registro?.before).toBe("Validar com o responsável pela conta");
    expect(registro?.detail).toBe("Revisão");
  });

  it("leva os Subitens junto e diz quantos foram", () => {
    checklist()?.items.push(
      { id: "cki_sub_a", text: "Subitem A", order: 3, done: false, parentItemId: "cki_3" },
      { id: "cki_sub_b", text: "Subitem B", order: 4, done: true, parentItemId: "cki_3" },
    );

    const result = removeChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_3");

    expect(result.ok).toBe(true);
    expect(checklist()?.items.map((i) => i.id)).toEqual(["cki_1", "cki_2"]);
    const registro = state.activity.find((a) => a.action === "Item de Checklist removido");
    expect(registro?.detail).toContain("2 Subitem(ns) removido(s) com ele: Subitem A; Subitem B");
  });

  it("remove um Item convertido sem efeito sobre a Subtarefa (B48)", () => {
    const conversao = convertChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_2");
    if (!conversao.ok) throw new Error(conversao.error);
    const subtarefaId = conversao.value.id;

    const result = removeChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_2");

    expect(result.ok).toBe(true);
    expect(checklist()?.items.some((i) => i.id === "cki_2")).toBe(false);
    const subtarefa = state.tasks.find((t) => t.id === subtarefaId);
    expect(subtarefa?.lifecycle).toBe("ativo");
    expect(subtarefa?.parentTaskId).toBe(TAREFA);
  });

  it("recusa Checklist ou Item inexistente, e Tarefa fora do ativo", () => {
    expect(removeChecklistItem(state, THIAGO, TAREFA, "chk_nada", "cki_1").ok).toBe(false);
    const semItem = removeChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_nada");
    expect(semItem.ok ? "" : semItem.error).toBe("Item não encontrado.");
    tarefa().lifecycle = "arquivado";
    expect(removeChecklistItem(state, THIAGO, TAREFA, CHECKLIST, "cki_1").ok).toBe(false);
    expect(checklist()?.items).toHaveLength(3);
  });
});

describe("removeChecklist", () => {
  it("tira o Checklist inteiro com os Itens, e guarda nome e Itens no Registro de Atividade", () => {
    const result = removeChecklist(state, THIAGO, TAREFA, CHECKLIST);

    expect(result.ok).toBe(true);
    expect(tarefa().checklists.some((c) => c.id === CHECKLIST)).toBe(false);
    expect(checklistProgress(tarefa())).toBeNull();
    const registro = state.activity.find((a) => a.action === "Checklist removido");
    expect(registro?.objectId).toBe(TAREFA);
    expect(registro?.before).toBe("Revisão");
    expect(registro?.detail).toContain("3 Item(ns) removido(s) com ele:");
    expect(registro?.detail).toContain("Publicar no Conhecimento");
  });

  it("recusa Checklist inexistente e quem não pode editar a Tarefa", () => {
    expect(removeChecklist(state, THIAGO, TAREFA, "chk_nada").ok).toBe(false);
    const semEscrita = state.members.find(
      (m) => m.state === "ativo" && m.id !== THIAGO && !removeChecklist(buildSeed(), m.id, TAREFA, CHECKLIST).ok,
    );
    if (semEscrita) {
      expect(removeChecklist(state, semEscrita.id, TAREFA, CHECKLIST).ok).toBe(false);
      expect(tarefa().checklists.some((c) => c.id === CHECKLIST)).toBe(true);
    }
  });
});
