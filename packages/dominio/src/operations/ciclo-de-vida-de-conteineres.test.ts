/**
 * POSC-09 — renomear, arquivar, desarquivar, enviar à lixeira e restaurar
 * Espaço, Pasta e Lista. Cada teste afirma o RESULTADO da operação e o estado
 * que ela deixou, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { containerPath, effectiveLifecycleOfContainer, effectiveLifecycleOfTask } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { administraOEspaco } from "./ia/permissoes-ia";
import { closeSprint, createNextSprint, enableSprints } from "./planning";
import { archiveContainer, createFolder, createList, restoreContainer, trashContainer, unarchiveContainer, updateContainer } from "./structure";
import { trashTask } from "./tasks";

const THIAGO = "mem_thiago";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const semAdmin = (): string => {
  const m = state.members.find((x) => x.state === "ativo" && !administraOEspaco(state, x.id));
  if (!m) throw new Error("o seed precisa de um Membro ativo que não administre o Espaço");
  return m.id;
};

/** A Lista de referência do seed, a Pasta que a contém e o Espaço no topo — sem decorar ids além do dela. */
function caminho() {
  const lista = state.lists.find((l) => l.id === "lst_renovacao");
  if (!lista || lista.parentType !== "folder") throw new Error("o seed precisa de lst_renovacao dentro de uma Pasta");
  const pasta = state.folders.find((f) => f.id === lista.parentId);
  if (!pasta) throw new Error("sem Pasta");
  const topo = containerPath(state, "list", lista.id)[0];
  const espaco = topo?.type === "space" ? state.spaces.find((s) => s.id === topo.id) : undefined;
  if (!espaco) throw new Error("sem Espaço");
  return { lista, pasta, espaco };
}

describe("updateContainer — nome, descrição, cor e privacidade", () => {
  it("renomeia os três níveis e registra antes/depois", () => {
    const { lista, pasta, espaco } = caminho();
    const nomeAntes = lista.name;
    expect(updateContainer(state, THIAGO, "list", lista.id, { name: "  Renovação 2027 " }).ok).toBe(true);
    expect(lista.name).toBe("Renovação 2027");
    expect(updateContainer(state, THIAGO, "folder", pasta.id, { description: "Nova descrição" }).ok).toBe(true);
    expect(pasta.description).toBe("Nova descrição");
    expect(updateContainer(state, THIAGO, "space", espaco.id, { color: "#0369a1", isPrivate: espaco.isPrivate }).ok).toBe(true);
    expect(espaco.color).toBe("#0369a1");
    const registro = state.activity.find((a) => a.objectId === lista.id && a.action === "Lista renomeada");
    expect(registro?.before).toBe(nomeAntes);
    expect(registro?.after).toBe("Renovação 2027");
  });

  it("descrição vazia apaga; nome vazio e nome de irmão são recusados", () => {
    const { lista, pasta } = caminho();
    expect(updateContainer(state, THIAGO, "list", lista.id, { description: "   " }).ok).toBe(true);
    expect(lista.description).toBeUndefined();
    const vazio = updateContainer(state, THIAGO, "list", lista.id, { name: " " });
    expect(vazio.ok).toBe(false);
    if (!vazio.ok) expect(vazio.field).toBe("nome");
    const irma = createList(state, THIAGO, { name: "Irmã", parentType: "folder", parentId: pasta.id });
    if (!irma.ok) throw new Error(irma.error);
    const colisao = updateContainer(state, THIAGO, "list", irma.value.id, { name: lista.name.toUpperCase() });
    expect(colisao.ok).toBe(false);
    if (!colisao.ok) expect(colisao.error).toContain("Já existe");
  });

  it("exige administrar e exige o contêiner efetivamente ativo (RN-ESP-11)", () => {
    const { lista, pasta } = caminho();
    expect(updateContainer(state, semAdmin(), "list", lista.id, { name: "X" }).ok).toBe(false);
    expect(archiveContainer(state, THIAGO, "folder", pasta.id).ok).toBe(true);
    // A Lista continua `ativo` no próprio registro, mas efetivamente arquivada: não edita.
    expect(lista.lifecycle).toBe("ativo");
    const r = updateContainer(state, THIAGO, "list", lista.id, { name: "X" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("arquivada");
  });
});

describe("archiveContainer / unarchiveContainer", () => {
  it("arquiva e desarquiva uma Lista; o que está abaixo acompanha pelo efetivo", () => {
    const { lista } = caminho();
    const tarefa = state.tasks.find((t) => t.listId === lista.id && t.lifecycle === "ativo");
    if (!tarefa) throw new Error("precisa de Tarefa ativa");
    expect(archiveContainer(state, THIAGO, "list", lista.id).ok).toBe(true);
    expect(lista.lifecycle).toBe("arquivado");
    expect(lista.archivedAt).toBeDefined();
    expect(tarefa.lifecycle).toBe("ativo");
    expect(effectiveLifecycleOfTask(state, tarefa.id)).toBe("arquivado");
    // Idempotente.
    expect(archiveContainer(state, THIAGO, "list", lista.id).ok).toBe(true);
    expect(unarchiveContainer(state, THIAGO, "list", lista.id).ok).toBe(true);
    expect(lista.lifecycle).toBe("ativo");
    expect(lista.archivedAt).toBeUndefined();
    expect(effectiveLifecycleOfTask(state, tarefa.id)).toBe("ativo");
  });

  it("a Sprint fechada por closeSprint é desarquivável — a exceção do bug", () => {
    const pastaId = "fld_renovacao";
    expect(enableSprints(state, THIAGO, pastaId, 14).ok).toBe(true);
    const s1 = createNextSprint(state, THIAGO, pastaId);
    if (!s1.ok) throw new Error(s1.error);
    const fechada = closeSprint(state, THIAGO, s1.value.id);
    expect(fechada.ok, fechada.ok ? "" : fechada.error).toBe(true);
    expect(s1.value.lifecycle).toBe("arquivado");
    expect(unarchiveContainer(state, THIAGO, "list", s1.value.id).ok).toBe(true);
    expect(s1.value.lifecycle).toBe("ativo");
  });

  it("desarquivar sob ancestral arquivado é permitido; o efetivo continua arquivado até o ancestral voltar", () => {
    const { lista, pasta } = caminho();
    expect(archiveContainer(state, THIAGO, "list", lista.id).ok).toBe(true);
    expect(archiveContainer(state, THIAGO, "folder", pasta.id).ok).toBe(true);
    expect(unarchiveContainer(state, THIAGO, "list", lista.id).ok).toBe(true);
    expect(lista.lifecycle).toBe("ativo");
    expect(effectiveLifecycleOfContainer(state, "list", lista.id)).toBe("arquivado");
    expect(unarchiveContainer(state, THIAGO, "folder", pasta.id).ok).toBe(true);
    expect(effectiveLifecycleOfContainer(state, "list", lista.id)).toBe("ativo");
  });

  it("não arquiva o que está na lixeira, e exige administrar", () => {
    const { lista } = caminho();
    expect(archiveContainer(state, semAdmin(), "list", lista.id).ok).toBe(false);
    expect(trashContainer(state, THIAGO, "list", lista.id).ok).toBe(true);
    expect(archiveContainer(state, THIAGO, "list", lista.id).ok).toBe(false);
    expect(unarchiveContainer(state, THIAGO, "list", lista.id).ok).toBe(false);
  });
});

describe("trashContainer / restoreContainer — B43", () => {
  it("a Pasta leva Listas e Tarefas com o mesmo trashedAt e a restauração devolve só o que foi junto", () => {
    const { lista, pasta } = caminho();
    const tarefas = state.tasks.filter((t) => t.listId === lista.id && t.lifecycle === "ativo");
    const [antes, ...resto] = tarefas;
    if (!antes || resto.length === 0) throw new Error("precisa de 2+ Tarefas ativas");
    // Uma Tarefa já estava na lixeira antes: ela não volta com a Pasta.
    expect(trashTask(state, THIAGO, antes.id).ok).toBe(true);
    // O marcador da cascata é o instante: num teste os dois atos cabem no
    // mesmo milissegundo, então a ida anterior é datada de antes à mão.
    antes.trashedAt = "2026-01-01T00:00:00.000Z";
    const marcaAntiga = antes.trashedAt;
    // Uma Lista arquivada volta arquivada (nunca força ativo).
    const arquivada = createList(state, THIAGO, { name: "Arquivada", parentType: "folder", parentId: pasta.id });
    if (!arquivada.ok) throw new Error(arquivada.error);
    expect(archiveContainer(state, THIAGO, "list", arquivada.value.id).ok).toBe(true);

    const r = trashContainer(state, THIAGO, "folder", pasta.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(pasta.lifecycle).toBe("naLixeira");
    expect(pasta.lifecycleBeforeTrash).toBe("ativo");
    expect(lista.lifecycle).toBe("naLixeira");
    expect(lista.trashedAt).toBe(pasta.trashedAt);
    expect(arquivada.value.lifecycle).toBe("naLixeira");
    expect(arquivada.value.lifecycleBeforeTrash).toBe("arquivado");
    for (const t of resto) {
      expect(t.lifecycle).toBe("naLixeira");
      expect(t.trashedAt).toBe(pasta.trashedAt);
    }
    expect(antes.trashedAt).toBe(marcaAntiga);
    const registro = state.activity.find((a) => a.objectId === pasta.id && a.action === "Pasta enviada à lixeira");
    expect(registro?.detail).toContain("Lista(s)");

    // Restaurar a Lista enquanto a Pasta está na lixeira é recusado.
    const cedo = restoreContainer(state, THIAGO, "list", lista.id);
    expect(cedo.ok).toBe(false);
    if (!cedo.ok) expect(cedo.error).toContain("Restaure o contêiner antes");

    expect(restoreContainer(state, THIAGO, "folder", pasta.id).ok).toBe(true);
    expect(pasta.lifecycle).toBe("ativo");
    expect(pasta.trashedAt).toBeUndefined();
    expect(lista.lifecycle).toBe("ativo");
    expect(arquivada.value.lifecycle).toBe("arquivado");
    for (const t of resto) expect(t.lifecycle).toBe("ativo");
    expect(antes.lifecycle).toBe("naLixeira");
  });

  it("o Espaço leva a subárvore inteira — Pastas, Subpastas, Listas, Tarefas — e volta inteiro", () => {
    const { espaco } = caminho();
    const topo = createFolder(state, THIAGO, { name: "Topo", parentType: "space", parentId: espaco.id });
    if (!topo.ok) throw new Error(topo.error);
    const sub = createFolder(state, THIAGO, { name: "Sub", parentType: "folder", parentId: topo.value.id });
    if (!sub.ok) throw new Error(sub.error);
    const folha = createList(state, THIAGO, { name: "Folha", parentType: "folder", parentId: sub.value.id });
    if (!folha.ok) throw new Error(folha.error);
    expect(trashContainer(state, THIAGO, "space", espaco.id).ok).toBe(true);
    expect(sub.value.lifecycle).toBe("naLixeira");
    expect(folha.value.lifecycle).toBe("naLixeira");
    expect(state.tasks.filter((t) => t.listId === "lst_renovacao").every((t) => t.lifecycle === "naLixeira")).toBe(true);
    expect(restoreContainer(state, THIAGO, "space", espaco.id).ok).toBe(true);
    expect(espaco.lifecycle).toBe("ativo");
    expect(topo.value.lifecycle).toBe("ativo");
    expect(sub.value.lifecycle).toBe("ativo");
    expect(folha.value.lifecycle).toBe("ativo");
  });

  it("restaurar com colisão de nome é recusado (RN-ESP-23) e exige excluir", () => {
    const { lista, pasta } = caminho();
    expect(trashContainer(state, semAdmin(), "list", lista.id).ok).toBe(false);
    expect(trashContainer(state, THIAGO, "list", lista.id).ok).toBe(true);
    const nova = createList(state, THIAGO, { name: lista.name, parentType: "folder", parentId: pasta.id });
    expect(nova.ok).toBe(true);
    const r = restoreContainer(state, THIAGO, "list", lista.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Já existe");
  });

  it("um apontamento em andamento fecha ao ir à lixeira", () => {
    const { lista } = caminho();
    const tarefa = state.tasks.find((t) => t.listId === lista.id && t.lifecycle === "ativo");
    if (!tarefa) throw new Error("precisa de Tarefa ativa");
    tarefa.timeEntries.push({ id: "te_teste", memberId: THIAGO, start: new Date(Date.now() - 120_000).toISOString(), createdBy: { kind: "member", id: THIAGO } });
    expect(trashContainer(state, THIAGO, "list", lista.id).ok).toBe(true);
    const entrada = tarefa.timeEntries.find((e) => e.id === "te_teste");
    expect(entrada?.end).toBeDefined();
    expect(entrada?.durationMinutes).toBeGreaterThanOrEqual(1);
  });
});
