/**
 * FUND-10 / RN-TAR-13 — editar e excluir Comentário: pelo autor ou por quem
 * administra; a exclusão deixa o marcador e preserva o encadeamento.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { containerAdminRefusal } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { administraOEspaco } from "./ia/permissoes-ia";
import { addTaskComment, deleteTaskComment, editTaskComment } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

function cenario() {
  const comum = (lista: string, exceto?: string) =>
    state.members.find(
      (m) =>
        m.state === "ativo" &&
        m.id !== exceto &&
        !administraOEspaco(state, m.id) &&
        state.roles.find((r) => r.id === m.roleId)?.base === "membro" &&
        containerAdminRefusal(state, m.id, "list", lista) !== undefined,
    );
  const tarefa = state.tasks.find((t) => {
    if (t.lifecycle !== "ativo" || t.comments.length > 0) return false;
    const lista = state.lists.find((l) => l.id === t.listId);
    if (!lista || lista.isPrivate) return false;
    const a = comum(t.listId);
    return a !== undefined && comum(t.listId, a.id) !== undefined && addTaskComment(buildSeed(), a.id, t.id, { content: "sonda" }).ok;
  });
  if (!tarefa) throw new Error("seed sem Tarefa em que dois Membros comuns comentem");
  const autor = comum(tarefa.listId);
  const outro = comum(tarefa.listId, autor?.id);
  const admin = state.members.find((m) => m.state === "ativo" && administraOEspaco(state, m.id));
  if (!autor || !outro || !admin) throw new Error("seed sem os três Membros");
  const raiz = addTaskComment(state, autor.id, tarefa.id, { content: "Primeiro rascunho" });
  if (!raiz.ok) throw new Error(raiz.error);
  return { tarefa, autor: autor.id, outro: outro.id, admin: admin.id, raiz: raiz.value };
}

describe("editTaskComment", () => {
  it("o autor edita: o conteúdo muda, editedAt marca, o autor e a criação ficam; vazio é recusado", () => {
    const { tarefa, autor, raiz } = cenario();
    const antes = raiz.createdAt;
    const r = editTaskComment(state, autor, tarefa.id, raiz.id, "  Rascunho corrigido  ");
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(raiz.content).toBe("Rascunho corrigido");
    expect(raiz.editedAt).toBeDefined();
    expect(raiz.createdAt).toBe(antes);
    expect(raiz.author).toEqual({ kind: "member", id: autor });
    expect(state.activity[0]?.action).toBe("Comentário editado");
    expect(state.activity[0]?.before).toBe("Primeiro rascunho");
    expect(editTaskComment(state, autor, tarefa.id, raiz.id, "   ").ok).toBe(false);
  });

  it("outro Membro comum não edita; quem administra edita", () => {
    const { tarefa, outro, admin, raiz } = cenario();
    const negado = editTaskComment(state, outro, tarefa.id, raiz.id, "x");
    expect(negado.ok).toBe(false);
    if (!negado.ok) expect(negado.error).toContain("Só quem escreveu");
    expect(editTaskComment(state, admin, tarefa.id, raiz.id, "ajustado pelo admin").ok).toBe(true);
    expect(raiz.content).toBe("ajustado pelo admin");
  });
});

describe("deleteTaskComment", () => {
  it("exclui deixando o marcador: fica sem conteúdo, com deletedAt, e a resposta continua pendurada", () => {
    const { tarefa, autor, outro, raiz } = cenario();
    const resposta = addTaskComment(state, outro, tarefa.id, { content: "Resposta", parentCommentId: raiz.id });
    if (!resposta.ok) throw new Error(resposta.error);
    expect(deleteTaskComment(state, outro, tarefa.id, raiz.id).ok).toBe(false);
    expect(deleteTaskComment(state, autor, tarefa.id, raiz.id).ok).toBe(true);
    expect(raiz.deletedAt).toBeDefined();
    expect(raiz.content).toBe("");
    expect(tarefa.comments.some((c) => c.id === raiz.id)).toBe(true);
    expect(resposta.value.parentCommentId).toBe(raiz.id);
    expect(resposta.value.deletedAt).toBeUndefined();
    expect(state.activity[0]?.action).toBe("Comentário excluído");
    expect(state.activity[0]?.before).toBe("Primeiro rascunho");
    // Excluído não se edita, nem recebe resposta nova; excluir de novo é no-op.
    expect(editTaskComment(state, autor, tarefa.id, raiz.id, "volta").ok).toBe(false);
    expect(addTaskComment(state, outro, tarefa.id, { content: "mais", parentCommentId: raiz.id }).ok).toBe(false);
    expect(deleteTaskComment(state, autor, tarefa.id, raiz.id).ok).toBe(true);
  });
});
