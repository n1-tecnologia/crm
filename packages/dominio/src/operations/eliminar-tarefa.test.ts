/**
 * PARD-10 — eliminação permanente (tarefa.md, 12.3/12.6): só da lixeira; leva
 * as Subtarefas; desfaz Vínculos e Dependências dos dois lados; os Arquivos e
 * os Registros de Atividade ficam. O expurgo pela Política de lixeira faz o
 * mesmo, sozinho, com o que passou do prazo.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { containerAdminRefusal } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { addDependency, attachFile } from "./collaboration";
import { createTask, purgeExpiredTasks, purgeTask, trashTask } from "./tasks";

const THIAGO = "mem_thiago";
const LISTA = "lst_propostas";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const raizes = () => state.tasks.filter((t) => t.listId === LISTA && t.lifecycle === "ativo" && !t.parentTaskId);
const existe = (id: string) => state.tasks.some((t) => t.id === id);
const subtarefa = (pai: Task): Task => {
  const r = createTask(state, THIAGO, { listId: LISTA, title: `Parte de ${pai.title}`, parentTaskId: pai.id });
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("purgeTask", () => {
  it("recusa Tarefa fora da lixeira", () => {
    const [a] = raizes();
    const r = purgeTask(state, THIAGO, a!.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("lixeira");
    expect(existe(a!.id)).toBe(true);
  });

  it("elimina a árvore, desfaz Dependências e Vínculos dos dois lados, e deixa Arquivo e Atividade", () => {
    const [a, b] = raizes();
    if (!a || !b) throw new Error("precisa de 2 Tarefas");
    const filha = subtarefa(a);
    expect(addDependency(state, THIAGO, b.id, "bloqueia", a.id).ok).toBe(true);
    const anexo = attachFile(state, THIAGO, a.id, { name: "memo.pdf", mediaType: "document", sizeBytes: 5 });
    if (!anexo.ok) throw new Error(anexo.error);
    state.links.push({ id: "lnk_teste", fromType: "task", fromId: a.id, toType: "task", toId: b.id, createdBy: { kind: "member", id: THIAGO }, createdAt: new Date().toISOString() });
    expect(trashTask(state, THIAGO, a.id).ok).toBe(true);
    const antes = state.tasks.length;

    const r = purgeTask(state, THIAGO, a.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.value.eliminadas).toBe(2);
    expect(existe(a.id)).toBe(false);
    expect(existe(filha.id)).toBe(false);
    expect(state.tasks.length).toBe(antes - 2);
    expect(b.dependencies.some((d) => d.taskId === a.id)).toBe(false);
    expect(state.links.some((l) => l.id === "lnk_teste")).toBe(false);
    expect(state.files.some((f) => f.id === anexo.value.fileId)).toBe(true);
    const registro = state.activity.find((x) => x.action === "Tarefa eliminada");
    expect(registro?.objectId).toBe(a.id);
    expect(registro?.objectName).toBe(a.title);
    expect(registro?.detail).toContain("1 Subtarefa(s)");
    expect(state.activity.some((x) => x.action === "Tarefa enviada à lixeira" && x.objectId === a.id)).toBe(true);
  });
});

describe("purgeExpiredTasks", () => {
  it("elimina só o que passou da retenção; a Subtarefa vencida cai com a mãe, não em dobro", () => {
    const [a, b, c] = raizes();
    if (!a || !b || !c) throw new Error("precisa de 3 Tarefas");
    const filha = subtarefa(a);
    const retencao = state.workspace.trashPolicy.retentionDays;
    for (const t of [a, filha, b]) expect(trashTask(state, THIAGO, t.id).ok).toBe(true);
    a.trashedAt = diasAtras(retencao + 5);
    filha.trashedAt = diasAtras(retencao + 5);
    b.trashedAt = diasAtras(retencao - 1);

    const r = purgeExpiredTasks(state, THIAGO, LISTA, new Date());
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ eliminadas: 2, failed: 0 });
    expect(existe(a.id)).toBe(false);
    expect(existe(filha.id)).toBe(false);
    expect(existe(b.id)).toBe(true);
    expect(existe(c.id)).toBe(true);
    expect(state.activity.filter((x) => x.action === "Tarefa eliminada")).toHaveLength(1);
  });

  it("quem não administra a Lista não roda o expurgo", () => {
    const comum = state.members.find((m) => m.state === "ativo" && containerAdminRefusal(state, m.id, "list", LISTA) !== undefined);
    if (!comum) return;
    expect(purgeExpiredTasks(state, comum.id, LISTA, new Date()).ok).toBe(false);
  });
});
