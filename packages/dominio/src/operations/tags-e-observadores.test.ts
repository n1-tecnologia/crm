/**
 * AVIS-02 — Tags criadas e editadas por operação (antes só o seed as
 * escrevia) e o observador avisado: Comentário numa Tarefa que acompanho
 * entra nas Notificações.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { comentariosObservados, notificacoesDoMembro } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { archiveTag, createTag, restoreTag, updateTag } from "./configuration";
import { administraOEspaco } from "./ia/permissoes-ia";
import { addTaskComment, resolveTaskComment, watchTask } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});
const admin = () => {
  const m = state.members.find((x) => x.state === "ativo" && administraOEspaco(state, x.id));
  if (!m) throw new Error("seed sem Administrador");
  return m.id;
};
const comum = () => {
  const m = state.members.find((x) => x.state === "ativo" && !administraOEspaco(state, x.id) && state.roles.find((r) => r.id === x.roleId)?.base === "membro");
  if (!m) throw new Error("seed sem Membro comum");
  return m.id;
};

describe("Tags — criar, editar, arquivar, restaurar", () => {
  it("cria com nome único, cor e famílias; edita; arquiva e volta", () => {
    const r = createTag(state, admin(), { name: "  Tag de teste  ", color: "#be123c", appliesTo: ["task", "task", "deal"] });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("Tag de teste");
    expect(r.value.appliesTo).toEqual(["task", "deal"]);
    expect(createTag(state, admin(), { name: "tag de teste" }).ok).toBe(false);
    expect(createTag(state, admin(), { name: "", color: "#000000" }).ok).toBe(false);
    expect(createTag(state, admin(), { name: "Cor ruim", color: "vermelho" }).ok).toBe(false);

    const u = updateTag(state, admin(), r.value.id, { name: "Tag renomeada", appliesTo: [] });
    expect(u.ok, u.ok ? "" : u.error).toBe(true);
    const gravada = state.tags.find((t) => t.id === r.value.id);
    expect(gravada?.name).toBe("Tag renomeada");
    expect(gravada?.appliesTo).toBeUndefined();
    expect(state.activity[0]?.detail).toContain("Tag de teste → Tag renomeada");

    expect(archiveTag(state, admin(), r.value.id).ok).toBe(true);
    expect(state.tags.find((t) => t.id === r.value.id)?.lifecycle).toBe("arquivado");
    // Arquivada, o nome continua reservado (ela segue legível onde está): nem uma nova com o mesmo nome.
    expect(createTag(state, admin(), { name: "Tag renomeada" }).ok).toBe(false);
    expect(restoreTag(state, admin(), r.value.id).ok).toBe(true);
    expect(state.tags.find((t) => t.id === r.value.id)?.lifecycle).toBe("ativo");
  });

  it("exige administrar o Espaço de Trabalho", () => {
    expect(createTag(state, comum(), { name: "X" }).ok).toBe(false);
    const existente = state.tags.find((t) => t.lifecycle === "ativo");
    if (!existente) throw new Error("seed sem Tag");
    expect(updateTag(state, comum(), existente.id, { name: "Y" }).ok).toBe(false);
    expect(archiveTag(state, comum(), existente.id).ok).toBe(false);
  });
});

describe("Notificações — quem acompanha é avisado", () => {
  it("um Comentário de outro autor numa Tarefa que acompanho entra em `observadas`; resolver tira; o meu próprio não conta", () => {
    const eu = comum();
    const outro = admin();
    const tarefa = state.tasks.find((t) => t.lifecycle === "ativo" && !t.observerMemberIds.includes(eu) && t.comments.length === 0 && state.lists.find((l) => l.id === t.listId)?.isPrivate !== true);
    if (!tarefa) throw new Error("seed sem Tarefa para observar");
    expect(watchTask(state, eu, tarefa.id, eu, true).ok).toBe(true);
    const antes = notificacoesDoMembro(state, eu, new Date());
    expect(antes.observadas.some((o) => o.task.id === tarefa.id)).toBe(false);

    const c = addTaskComment(state, outro, tarefa.id, { content: "Atualizei o orçamento." });
    expect(c.ok, c.ok ? "" : c.error).toBe(true);
    if (!c.ok) return;
    const depois = notificacoesDoMembro(state, eu, new Date());
    expect(depois.observadas.map((o) => o.comment.id)).toContain(c.value.id);
    expect(depois.total).toBe(antes.total + 1);
    // Quem comentou não é avisado do próprio Comentário.
    expect(comentariosObservados(state, outro).some((o) => o.comment.id === c.value.id)).toBe(false);

    expect(resolveTaskComment(state, outro, tarefa.id, c.value.id, true).ok).toBe(true);
    expect(notificacoesDoMembro(state, eu, new Date()).observadas.some((o) => o.comment.id === c.value.id)).toBe(false);
  });
});
