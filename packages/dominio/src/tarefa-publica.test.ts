/** PARA-05 — a projeção pública só sai com o link ativo e nunca carrega ids. */
import { beforeEach, describe, expect, it } from "vitest";
import { addTaskComment } from "./operations/tasks";
import { revokePublicShare, shareTaskPublicly } from "./operations/scale";
import { buildSeed } from "./seed";
import type { DataState } from "./state";
import { projecaoPublicaDaTarefa } from "./tarefa-publica";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

describe("projecaoPublicaDaTarefa", () => {
  it("abre com o link ativo, mostra comentários só se o compartilhamento mostra, e fecha ao revogar", () => {
    const t = state.tasks.find((x) => x.listId === "lst_propostas" && x.lifecycle === "ativo" && !x.parentTaskId && x.assignees.length > 0);
    if (!t) throw new Error("sem tarefa");
    expect(addTaskComment(state, "mem_thiago", t.id, { content: "Visível?" }).ok).toBe(true);
    const semComentarios = shareTaskPublicly(state, "mem_thiago", t.id, { showsComments: false, showsAttachments: true });
    if (!semComentarios.ok) throw new Error(semComentarios.error);

    const dto = projecaoPublicaDaTarefa(state, semComentarios.value.secret);
    expect(dto?.title).toBe(t.title);
    expect(dto?.comments).toBeUndefined();
    expect(dto?.attachments).toBeDefined();
    expect(dto?.assignees.every((nome) => !nome.startsWith("mem_"))).toBe(true);
    expect(JSON.stringify(dto)).not.toContain(semComentarios.value.secret);
    expect(JSON.stringify(dto)).not.toContain("mem_");

    expect(revokePublicShare(state, "mem_thiago", t.id).ok).toBe(true);
    expect(projecaoPublicaDaTarefa(state, semComentarios.value.secret)).toBeUndefined();

    const comComentarios = shareTaskPublicly(state, "mem_thiago", t.id, { showsComments: true, showsAttachments: false });
    if (!comComentarios.ok) throw new Error(comComentarios.error);
    const aberto = projecaoPublicaDaTarefa(state, comComentarios.value.secret);
    expect(aberto?.comments?.some((c) => c.content === "Visível?")).toBe(true);
    expect(aberto?.attachments).toBeUndefined();
  });

  it("segredo desconhecido não abre", () => {
    expect(projecaoPublicaDaTarefa(state, "0".repeat(24))).toBeUndefined();
  });
});
