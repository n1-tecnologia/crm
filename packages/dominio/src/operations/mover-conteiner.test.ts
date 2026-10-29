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
import { effectiveListConfig, irmaosOrdenados } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { createFieldDefinition, createTaskType, overrideStatusSet, setContainerFeature } from "./configuration";
import { shareTaskPublicly } from "./scale";
import { archiveContainer, createFolder, createList, moveContainer, reorderContainers } from "./structure";
import { createTask, setTaskFieldValue, updateTask } from "./tasks";

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

describe("moveContainer — Conjunto de Status, B37, Tipo de Tarefa e link público (EST-05)", () => {
  const OPS = { parentType: "space", parentId: "spc_ops" } as const; // Conjunto sts_ops, outro que o de Comercial
  let A: string;
  let ALFA: string;
  beforeEach(() => {
    A = pasta("Origem A");
    ALFA = lista("Alfa", A);
  });

  const tarefaDe = (id: string) => {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) throw new Error(`Tarefa ${id} não existe`);
    return t;
  };

  it("pede o mapeamento quando o Conjunto muda e não muda nada ao recusar (nem parentId)", () => {
    const t = tarefa(ALFA, "Proposta");
    const statusAntes = tarefaDe(t).statusId;
    const atividadesAntes = state.activity.length;

    const r = moveContainer(state, THIAGO, "list", ALFA, OPS);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("mapeamento");
    expect(r.error).toMatch(/^Mapeie /);
    expect(r.error).toContain("Novo");
    expect(listaPorId(ALFA).parentType).toBe("folder");
    expect(listaPorId(ALFA).parentId).toBe(A);
    expect(tarefaDe(t).statusId).toBe(statusAntes);
    expect(state.activity.length).toBe(atividadesAntes);
  });

  it("move com o mapeamento completo e troca o Status das Tarefas e das Subtarefas, com Atividade em cada uma", () => {
    const raiz = tarefa(ALFA, "Proposta");
    const sub = createTask(state, THIAGO, { listId: ALFA, title: "Subtarefa", parentTaskId: raiz });
    if (!sub.ok) throw new Error(sub.error);

    const r = moveContainer(state, THIAGO, "list", ALFA, OPS, [{ fromStatusId: "st_com_novo", toStatusId: "st_ops_fazer" }]);

    expect(r.ok).toBe(true);
    expect(listaPorId(ALFA).parentId).toBe("spc_ops");
    expect(tarefaDe(raiz).statusId).toBe("st_ops_fazer");
    expect(tarefaDe(sub.value.id).statusId).toBe("st_ops_fazer");
    const remapeadas = state.activity.filter((a) => a.action === "Status alterado por remapeamento");
    expect(remapeadas.map((a) => a.objectId).sort()).toEqual([raiz, sub.value.id].sort());
    expect(state.activity.some((a) => a.action === "Lista movida")).toBe(true);
  });

  it("conta as Tarefas arquivadas no mapeamento (todos os ciclos de vida)", () => {
    const t = tarefa(ALFA, "Velha");
    const tarefaAntiga = tarefaDe(t);
    tarefaAntiga.lifecycle = "arquivado";

    const r = moveContainer(state, THIAGO, "list", ALFA, OPS);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("Novo");
    expect(listaPorId(ALFA).parentId).toBe(A);
  });

  it("recusa o mapeamento que aponta para um status que o destino não tem", () => {
    tarefa(ALFA, "Proposta");
    const r = moveContainer(state, THIAGO, "list", ALFA, OPS, [{ fromStatusId: "st_com_novo", toStatusId: "st_nao_existe" }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("mapeamento");
    expect(listaPorId(ALFA).parentId).toBe(A);
  });

  it("numa Pasta com uma Lista que herda e outra com Conjunto próprio, só a que herda entra no mapeamento", () => {
    const F = pasta("Mista");
    const herda = lista("Herda", F);
    const propria = lista("Própria", F);
    expect(overrideStatusSet(state, THIAGO, "list", propria).ok).toBe(true);
    const tHerda = tarefa(herda, "Da que herda");
    const tPropria = createTask(state, THIAGO, { listId: propria, title: "Da própria", statusId: "st_com_exec" });
    if (!tPropria.ok) throw new Error(tPropria.error);

    const semMapa = moveContainer(state, THIAGO, "folder", F, OPS);
    expect(semMapa.ok).toBe(false);
    if (semMapa.ok) return;
    expect(semMapa.error).toContain("Novo");
    expect(semMapa.error).not.toContain("Em execução");
    expect(state.folders.find((f) => f.id === F)?.parentType).toBe("space");
    expect(state.folders.find((f) => f.id === F)?.parentId).toBe("spc_com");

    const comMapa = moveContainer(state, THIAGO, "folder", F, OPS, [{ fromStatusId: "st_com_novo", toStatusId: "st_ops_fazer" }]);
    expect(comMapa.ok).toBe(true);
    expect(state.folders.find((f) => f.id === F)?.parentId).toBe("spc_ops");
    expect(tarefaDe(tHerda).statusId).toBe("st_ops_fazer");
    // A Lista de Conjunto próprio não mudou de Conjunto: sua Tarefa segue onde estava.
    expect(tarefaDe(tPropria.value.id).statusId).toBe("st_com_exec");
  });

  it("arquiva o Valor de Campo que deixa de valer e o devolve a ativo quando a configuração volta (B37)", () => {
    const B = pasta("Destino B");
    const campo = createFieldDefinition(state, THIAGO, { name: "Turma da origem", type: "text", definedAtType: "folder", definedAtId: A });
    if (!campo.ok) throw new Error(campo.error);
    const t = tarefa(ALFA, "Com Campo");
    expect(setTaskFieldValue(state, THIAGO, t, campo.value.id, "Turma de outubro").ok).toBe(true);
    expect(tarefaDe(t).fieldValues.find((v) => v.definitionId === campo.value.id)?.state).toBe("ativo");

    expect(moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: B }).ok).toBe(true);
    const arquivado = tarefaDe(t).fieldValues.find((v) => v.definitionId === campo.value.id);
    expect(arquivado?.state).toBe("arquivado");
    expect(arquivado?.value).toBe("Turma de outubro");

    expect(moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: A }).ok).toBe(true);
    const devolvido = tarefaDe(t).fieldValues.find((v) => v.definitionId === campo.value.id);
    expect(devolvido?.state).toBe("ativo");
    expect(devolvido?.value).toBe("Turma de outubro");
  });

  it("o Tipo de Tarefa sem efeito no destino cai no primeiro Tipo do destino", () => {
    const B = pasta("Destino B");
    const tipo = createTaskType(state, THIAGO, { name: "Visita", icon: "map-pin", definedAtType: "folder", definedAtId: A });
    if (!tipo.ok) throw new Error(tipo.error);
    const t = tarefa(ALFA, "Visita ao cliente");
    expect(updateTask(state, THIAGO, t, { taskTypeId: tipo.value.id }).ok).toBe(true);
    expect(tarefaDe(t).taskTypeId).toBe(tipo.value.id);

    expect(moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: B }).ok).toBe(true);

    const primeiro = effectiveListConfig(state, ALFA)?.taskTypeIds[0];
    expect(primeiro).toBeDefined();
    expect(tarefaDe(t).taskTypeId).toBe(primeiro);
    expect(tarefaDe(t).taskTypeId).not.toBe(tipo.value.id);
  });

  it("revoga o link público ativo quando o destino não habilita o compartilhamento público", () => {
    const B = pasta("Destino B");
    expect(setContainerFeature(state, THIAGO, "folder", B, "compartilhamentoPublico", false).ok).toBe(true);
    const t = tarefa(ALFA, "Para fora");
    expect(shareTaskPublicly(state, THIAGO, t, { showsComments: false, showsAttachments: false }).ok).toBe(true);
    expect(tarefaDe(t).publicShare?.active).toBe(true);

    expect(moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: B }).ok).toBe(true);

    expect(tarefaDe(t).publicShare?.active).toBe(false);
    expect(state.activity.some((a) => a.action === "Link público revogado" && a.objectId === t)).toBe(true);
  });
});

/**
 * Fase 10, 2.3.2 (D-08, D-09, EST-05/EST-06) — reordenar os irmãos de um grupo
 * (Pastas, Listas ou Espaços). A operação recebe os ids que o Membro VÊ, reocupa
 * as vagas deles na sequência pedida e deixa os irmãos não citados no lugar
 * (A3, RESEARCH Pitfall 6).
 */
describe("reorderContainers — o traçador (EST-05)", () => {
  let F: string;
  let L0: string;
  let L1: string;
  let L2: string;
  beforeEach(() => {
    F = pasta("Pasta de ordem");
    L0 = lista("L0", F);
    L1 = lista("L1", F);
    L2 = lista("L2", F);
  });

  const ordens = (ids: readonly string[]): number[] => ids.map((id) => listaPorId(id).order);

  it("reordena três Listas de uma Pasta, grava 0, 1, 2 na ordem pedida e registra 'Ordem alterada' na Pasta", () => {
    expect(ordens([L0, L1, L2])).toEqual([0, 1, 2]);

    const r = reorderContainers(state, THIAGO, "list", { type: "folder", id: F }, [L2, L0, L1]);

    expect(r.ok).toBe(true);
    expect(ordens([L2, L0, L1])).toEqual([0, 1, 2]);
    expect(irmaosOrdenados(state, "list", { type: "folder", id: F }).map((l) => l.id)).toEqual([L2, L0, L1]);
    const atividade = state.activity[0];
    expect(atividade?.action).toBe("Ordem alterada");
    expect(atividade?.objectType).toBe("folder");
    expect(atividade?.objectId).toBe(F);
  });

  it("um irmão arquivado fora da lista de ids fica na mesma vaga; o grupo inteiro fica 0..3 sem repetição", () => {
    const L3 = lista("L3", F);
    expect(archiveContainer(state, THIAGO, "list", L3).ok).toBe(true);
    // L0=0, L3=1 (arquivada), L1=2, L2=3
    listaPorId(L0).order = 0;
    listaPorId(L3).order = 1;
    listaPorId(L1).order = 2;
    listaPorId(L2).order = 3;

    const r = reorderContainers(state, THIAGO, "list", { type: "folder", id: F }, [L2, L0, L1]);

    expect(r.ok).toBe(true);
    expect(irmaosOrdenados(state, "list", { type: "folder", id: F }).map((l) => l.id)).toEqual([L2, L3, L0, L1]);
    expect(ordens([L2, L3, L0, L1])).toEqual([0, 1, 2, 3]);
  });
});
