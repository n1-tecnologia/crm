/**
 * Fase 10, 2.3.1 (D-11, EST-05) — mover uma Lista ou uma Pasta para outro
 * lugar da Estrutura. O núcleo deste arquivo: a operação registrada, as
 * recusas básicas e a regra por Tarefa que `moveTask` também aplica (Conjunto
 * de Status que muda, B37, Tipo de Tarefa, link público). Cada teste afirma o
 * RESULTADO da operação e o estado que ela deixou; as recusas de profundidade,
 * bloqueio, colisão de nome entre níveis, Formulário e estrutura fixa entram
 * em 10-18.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { archiveContainer, createFolder, createList, moveContainer } from "./structure";
import { createTask } from "./tasks";

const THIAGO = "mem_thiago"; // Proprietário
const RAFAEL = "mem_rafael"; // Administrador
const JULIA = "mem_julia"; // Papel de vendas: não administra

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const pasta = (nome: string, parentId = "spc_com", parentType: "space" | "folder" = "space", por = THIAGO, extra: { isPrivate?: boolean } = {}): string => {
  const r = createFolder(state, por, { name: nome, parentType, parentId, ...extra });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

const lista = (nome: string, parentId: string, parentType: "space" | "folder" = "folder"): string => {
  const r = createList(state, THIAGO, { name: nome, parentType, parentId });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

const tarefa = (listId: string, title: string): string => {
  const r = createTask(state, THIAGO, { listId, title });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

const listaPorId = (id: string) => {
  const l = state.lists.find((x) => x.id === id);
  if (!l) throw new Error(`Lista ${id} não existe`);
  return l;
};

describe("moveContainer — a Lista vai para outra Pasta com o mesmo Conjunto (EST-05)", () => {
  let A: string;
  let B: string;
  let PROPOSTAS: string;
  beforeEach(() => {
    A = pasta("Origem A");
    B = pasta("Destino B");
    lista("Primeira", A);
    PROPOSTAS = lista("Propostas", A);
    lista("Última", A);
    lista("Já lá", B);
    lista("Outra", B);
  });

  it("move a Lista, mantém as Tarefas como estavam e grava a Atividade com o caminho antigo e o novo", () => {
    const t = tarefa(PROPOSTAS, "Proposta Alfa");
    const antes = state.tasks.find((x) => x.id === t);
    const statusAntes = antes?.statusId;

    const r = moveContainer(state, THIAGO, "list", PROPOSTAS, { parentType: "folder", parentId: B });

    expect(r.ok).toBe(true);
    expect(listaPorId(PROPOSTAS).parentType).toBe("folder");
    expect(listaPorId(PROPOSTAS).parentId).toBe(B);
    const depois = state.tasks.find((x) => x.id === t);
    expect(depois?.listId).toBe(PROPOSTAS);
    expect(depois?.statusId).toBe(statusAntes);

    const atividade = state.activity[0];
    expect(atividade?.action).toBe("Lista movida");
    expect(atividade?.objectType).toBe("list");
    expect(atividade?.objectId).toBe(PROPOSTAS);
    expect(atividade?.before).toBe("Comercial › Origem A › Propostas");
    expect(atividade?.after).toBe("Comercial › Destino B › Propostas");
  });

  it("entra no fim do grupo de Listas do destino e renumera o grupo de origem de 0 a n-1", () => {
    const r = moveContainer(state, THIAGO, "list", PROPOSTAS, { parentType: "folder", parentId: B });
    expect(r.ok).toBe(true);

    expect(listaPorId(PROPOSTAS).order).toBe(2);
    const origem = state.lists.filter((l) => l.parentId === A).sort((x, y) => x.order - y.order);
    expect(origem.map((l) => [l.name, l.order])).toEqual([
      ["Primeira", 0],
      ["Última", 1],
    ]);
    const destino = state.lists.filter((l) => l.parentId === B).sort((x, y) => x.order - y.order);
    expect(destino.map((l) => l.name)).toEqual(["Já lá", "Outra", "Propostas"]);
  });

  it("entra com order 0 quando o destino não tem nenhuma Lista", () => {
    const vazia = pasta("Vazia");
    const r = moveContainer(state, THIAGO, "list", PROPOSTAS, { parentType: "folder", parentId: vazia });
    expect(r.ok).toBe(true);
    expect(listaPorId(PROPOSTAS).order).toBe(0);
  });

  it("recusa quem não administra o movido, sem mudar nada", () => {
    const r = moveContainer(state, JULIA, "list", PROPOSTAS, { parentType: "folder", parentId: B });
    expect(r.ok).toBe(false);
    expect(listaPorId(PROPOSTAS).parentId).toBe(A);
    expect(state.activity[0]?.action).not.toBe("Lista movida");
  });

  it("devolve 'não encontrado' sem citar o nome quando o destino é privado e o ator não o alcança (RN-ESP-15, B38a)", () => {
    const secreta = pasta("Diretoria reservada", "spc_com", "space", THIAGO, { isPrivate: true });

    const r = moveContainer(state, RAFAEL, "list", PROPOSTAS, { parentType: "folder", parentId: secreta });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Pasta não encontrada.");
    expect(r.error).not.toContain("Diretoria");
    expect(listaPorId(PROPOSTAS).parentId).toBe(A);
  });

  it("recusa destino arquivado", () => {
    expect(archiveContainer(state, THIAGO, "folder", B).ok).toBe(true);
    const r = moveContainer(state, THIAGO, "list", PROPOSTAS, { parentType: "folder", parentId: B });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Esta Pasta não está ativa.");
    expect(listaPorId(PROPOSTAS).parentId).toBe(A);
  });

  it("recusa nome já existente entre os irmãos do destino", () => {
    lista("Propostas", B);
    const r = moveContainer(state, THIAGO, "list", PROPOSTAS, { parentType: "folder", parentId: B });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("nome");
    expect(r.error).toContain("Propostas");
    expect(listaPorId(PROPOSTAS).parentId).toBe(A);
  });

  it("recusa destino igual ao pai atual", () => {
    const r = moveContainer(state, THIAGO, "list", PROPOSTAS, { parentType: "folder", parentId: A });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Já está aqui.");
  });

  it("recusa mover a Pasta para dentro de si mesma", () => {
    const r = moveContainer(state, THIAGO, "folder", A, { parentType: "folder", parentId: A });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Um contêiner não vai para dentro de si mesmo.");
  });

  it("recusa mover a Pasta para dentro de uma descendente dela", () => {
    const filha = pasta("Filha de A", A, "folder");
    const r = moveContainer(state, THIAGO, "folder", A, { parentType: "folder", parentId: filha });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Um contêiner não vai para dentro de si mesmo.");
    expect(state.folders.find((f) => f.id === A)?.parentType).toBe("space");
  });
});
