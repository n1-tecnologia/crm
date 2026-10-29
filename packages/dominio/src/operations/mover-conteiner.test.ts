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
import { effectiveContainerConfig, effectiveListConfig, irmaosOrdenados, memberReachesContainer } from "../derive";
import { visibilidadePara } from "../derive-visibilidade";
import { MEUS_NEGOCIOS_ID } from "../seed-comercial";
import { buildSeed } from "../seed";
import { LISTA_ID as LISTA_SOLICITACOES_ID } from "../solicitacao-de-pagamento-evolver";
import type { DataState } from "../state";
import { createFieldDefinition, createTaskType, overrideStatusSet, setContainerBlock, setContainerDefaultViews, setContainerFeature } from "./configuration";
import { createForm, shareTaskPublicly } from "./scale";
import { CP, CR } from "./financeiro";
import { archiveContainer, consequenciasDeMover, createFolder, createList, createSpace, moveContainer, recusaDeMover, recusaDeReordenar, reorderContainers } from "./structure";
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

const BEATRIZ = "mem_beatriz"; // Convidado

describe("reorderContainers — as bordas da ordem (EST-11)", () => {
  let F: string;
  let L0: string;
  let L1: string;
  let L2: string;
  const pai = () => ({ type: "folder", id: F }) as const;
  beforeEach(() => {
    F = pasta("Pasta de ordem");
    L0 = lista("L0", F);
    L1 = lista("L1", F);
    L2 = lista("L2", F);
  });
  const ids = (): string[] => irmaosOrdenados(state, "list", pai()).map((l) => l.id);

  it("irmãos com o mesmo `order` saem na ordem do array e, depois de reordenar, o grupo fica 0..n-1 sem repetição", () => {
    listaPorId(L0).order = 1;
    listaPorId(L1).order = 1;
    listaPorId(L2).order = 1;
    expect(ids()).toEqual([L0, L1, L2]);

    expect(reorderContainers(state, THIAGO, "list", pai(), [L2, L1, L0]).ok).toBe(true);

    expect(ids()).toEqual([L2, L1, L0]);
    expect([L2, L1, L0].map((id) => listaPorId(id).order)).toEqual([0, 1, 2]);
  });

  it("a ordenação não muda o array do estado", () => {
    listaPorId(L0).order = 5;
    const antes = state.lists.map((l) => l.id);
    irmaosOrdenados(state, "list", pai());
    expect(state.lists.map((l) => l.id)).toEqual(antes);
  });

  it("um só id já no lugar é aceito e não grava Atividade", () => {
    const atividades = state.activity.length;
    const r = reorderContainers(state, THIAGO, "list", pai(), [L1]);
    expect(r.ok).toBe(true);
    expect(state.activity.length).toBe(atividades);
    expect(ids()).toEqual([L0, L1, L2]);
  });

  it("ids vazio é recusado", () => {
    const r = reorderContainers(state, THIAGO, "list", pai(), []);
    expect(r).toEqual({ ok: false, error: "Nada a reordenar." });
  });

  it("id repetido é recusado e a ordem não muda", () => {
    const r = reorderContainers(state, THIAGO, "list", pai(), [L0, L0]);
    expect(r.ok).toBe(false);
    expect(ids()).toEqual([L0, L1, L2]);
  });

  it("id de Pasta num grupo de Listas é recusado (T-10-11)", () => {
    const r = reorderContainers(state, THIAGO, "list", pai(), [L0, F]);
    expect(r.ok).toBe(false);
    expect(ids()).toEqual([L0, L1, L2]);
  });

  it("id de Lista de outra Pasta é recusado como 'não pertence a este grupo' e nada muda (T-10-11)", () => {
    const outra = pasta("Outra Pasta");
    const estrangeira = lista("Estrangeira", outra);
    const r = reorderContainers(state, THIAGO, "list", pai(), [L0, estrangeira]);
    expect(r).toEqual({ ok: false, error: "Estrangeira não pertence a este grupo." });
    expect(ids()).toEqual([L0, L1, L2]);
    expect(listaPorId(estrangeira).parentId).toBe(outra);
  });

  it("id que não existe é 'não encontrado'", () => {
    const r = reorderContainers(state, THIAGO, "list", pai(), [L0, "lst_que_nao_existe"]);
    expect(r).toEqual({ ok: false, error: "Lista não encontrada." });
  });

  it("Pastas e Listas são grupos separados: reordenar Pastas não mexe nas Listas do mesmo pai", () => {
    const P1 = pasta("Pasta 1");
    const P2 = pasta("Pasta 2");
    const ordemDasListas = ids();
    const r = reorderContainers(state, THIAGO, "folder", { type: "space", id: "spc_com" }, [P2, P1]);
    expect(r.ok).toBe(true);
    const pastas = irmaosOrdenados(state, "folder", { type: "space", id: "spc_com" }).map((f) => f.id);
    expect(pastas.indexOf(P2)).toBeLessThan(pastas.indexOf(P1));
    expect(ids()).toEqual(ordemDasListas);
  });
});

describe("reorderContainers — Espaços (D-09) e quem pode (A4, L3)", () => {
  /** Os Espaços que o Membro alcança (os privados sem concessão ficam de fora) na ordem atual. */
  const alcancados = (quem: string): string[] =>
    irmaosOrdenados(state, "space", null)
      .filter((s) => memberReachesContainer(state, quem, "space", s.id))
      .map((s) => s.id);

  it("o Administrador reordena os Espaços que alcança, os privados ficam na vaga e a Atividade fica no Espaço de Trabalho", () => {
    const todos = irmaosOrdenados(state, "space", null).map((s) => s.id);
    const meus = alcancados(RAFAEL);
    expect(meus.length).toBeGreaterThan(1);
    expect(meus.length).toBeLessThan(todos.length);
    const invertida = [...meus].reverse();
    const r = reorderContainers(state, RAFAEL, "space", null, invertida);
    expect(r.ok).toBe(true);
    const depois = irmaosOrdenados(state, "space", null);
    expect(depois.map((s) => s.id).filter((id) => meus.includes(id))).toEqual(invertida);
    expect(depois.map((s) => s.order)).toEqual(depois.map((_, i) => i));
    for (const id of todos.filter((id) => !meus.includes(id))) expect(depois.findIndex((s) => s.id === id)).toBe(todos.indexOf(id));
    const atividade = state.activity[0];
    expect(atividade?.action).toBe("Ordem alterada");
    expect(atividade?.objectType).toBe("workspace");
    expect(atividade?.objectId).toBe(state.workspace.id);
    expect(atividade?.objectName).toBe(state.workspace.name);
  });

  it("um Espaço privado que o Administrador não alcança é 'não encontrado' e nada muda", () => {
    const todos = irmaosOrdenados(state, "space", null).map((s) => s.id);
    const r = reorderContainers(state, RAFAEL, "space", null, [...todos].reverse());
    expect(r).toEqual({ ok: false, error: "Espaço não encontrado." });
    expect(irmaosOrdenados(state, "space", null).map((s) => s.id)).toEqual(todos);
  });

  it("Membro de Papel base `membro` e Convidado não reordenam Espaços", () => {
    const antes = irmaosOrdenados(state, "space", null).map((s) => s.id);
    for (const quem of [JULIA, BEATRIZ]) {
      const r = reorderContainers(state, quem, "space", null, [...antes].reverse());
      expect(r.ok, quem).toBe(false);
    }
    expect(irmaosOrdenados(state, "space", null).map((s) => s.id)).toEqual(antes);
  });

  it("um pai informado para Espaços é recusado", () => {
    const r = reorderContainers(state, THIAGO, "space", { type: "space", id: "spc_com" }, ["spc_com"]);
    expect(r.ok).toBe(false);
  });

  it("recusaDeReordenar: pai arquivado devolve a frase; pai ativo que o Membro alcança devolve undefined", () => {
    const F = pasta("Pai que muda");
    expect(recusaDeReordenar(state, THIAGO, "list", { type: "folder", id: F })).toBeUndefined();
    expect(archiveContainer(state, THIAGO, "folder", F).ok).toBe(true);
    expect(recusaDeReordenar(state, THIAGO, "list", { type: "folder", id: F })).toBe("Esta Pasta não está ativa.");
    const r = reorderContainers(state, THIAGO, "list", { type: "folder", id: F }, ["lst_x"]);
    expect(r).toEqual({ ok: false, error: "Esta Pasta não está ativa." });
  });

  it("recusaDeReordenar: Convidado que não alcança o pai recebe 'não encontrado'; sem pai para Listas é recusado", () => {
    const F = pasta("Privada", "spc_com", "space", THIAGO, { isPrivate: true });
    expect(recusaDeReordenar(state, BEATRIZ, "list", { type: "folder", id: F })).toBe("Pasta não encontrada.");
    expect(recusaDeReordenar(state, THIAGO, "list", null)).toBeDefined();
  });
});

describe("reorderContainers — paridade entre o recorte do Membro e o Espaço inteiro (A3, Pitfall 6)", () => {
  it("Listas: rodar na cópia filtrada e no estado inteiro dá a mesma ordem para as visíveis, e a escondida fica na vaga", () => {
    const F = pasta("Pasta mista");
    const L0 = lista("V0", F);
    const ESCONDIDA = lista("Escondida", F);
    const L1 = lista("V1", F);
    const L2 = lista("V2", F);
    // Privada: nada foi concedido ao Rafael, então ela some do recorte dele.
    expect(createList(state, THIAGO, { name: "x", parentType: "folder", parentId: F }).ok).toBe(true);
    listaPorId(ESCONDIDA).isPrivate = true;
    const pai = { type: "folder", id: F } as const;
    const recorte = visibilidadePara(state, RAFAEL).estado;
    expect(recorte.lists.some((l) => l.id === ESCONDIDA)).toBe(false);

    const pedido = [L2, L0, L1];
    const copia = structuredClone(recorte);
    expect(reorderContainers(copia, RAFAEL, "list", pai, pedido).ok).toBe(true);
    const inteiro = structuredClone(state);
    expect(reorderContainers(inteiro, RAFAEL, "list", pai, pedido).ok).toBe(true);

    const visiveis = new Set(pedido);
    const naCopia = irmaosOrdenados(copia, "list", pai).filter((l) => visiveis.has(l.id)).map((l) => l.id);
    const noInteiro = irmaosOrdenados(inteiro, "list", pai).filter((l) => visiveis.has(l.id)).map((l) => l.id);
    expect(naCopia).toEqual(pedido);
    expect(noInteiro).toEqual(pedido);
    // A escondida manteve a vaga (posição 1 do grupo original: L0, ESCONDIDA, L1, L2, x).
    expect(irmaosOrdenados(inteiro, "list", pai).findIndex((l) => l.id === ESCONDIDA)).toBe(1);
    const ordens = irmaosOrdenados(inteiro, "list", pai).map((l) => l.order);
    expect(ordens).toEqual(ordens.map((_, i) => i));
  });

  it("Espaços: o Administrador reordena os que alcança na cópia e no estado inteiro, e os privados ficam na vaga", () => {
    const todos = irmaosOrdenados(state, "space", null).map((s) => s.id);
    const recorte = visibilidadePara(state, RAFAEL).estado;
    const alcancados = irmaosOrdenados(recorte, "space", null)
      .map((s) => s.id)
      .filter((id) => memberReachesContainer(recorte, RAFAEL, "space", id));
    const escondidos = todos.filter((id) => !alcancados.includes(id));
    expect(alcancados.length).toBeGreaterThan(1);
    expect(escondidos.length).toBeGreaterThan(0);
    const pedido = [...alcancados].reverse();

    const copia = structuredClone(recorte);
    expect(reorderContainers(copia, RAFAEL, "space", null, pedido).ok).toBe(true);
    const inteiro = structuredClone(state);
    expect(reorderContainers(inteiro, RAFAEL, "space", null, pedido).ok).toBe(true);

    const soAlcancados = (e: DataState) =>
      irmaosOrdenados(e, "space", null)
        .map((s) => s.id)
        .filter((id) => alcancados.includes(id));
    expect(soAlcancados(copia)).toEqual(pedido);
    expect(soAlcancados(inteiro)).toEqual(pedido);
    for (const id of escondidos) {
      expect(irmaosOrdenados(inteiro, "space", null).findIndex((s) => s.id === id)).toBe(todos.indexOf(id));
    }
  });
});

describe("moveContainer — profundidade, promoção e rebaixamento de Pasta (D-11, RN-SUB-02, RN-SUB-11, RN-PAS-15)", () => {
  let P1: string; // Pasta de nível 1 com uma Subpasta
  let SUB: string; // Subpasta de P1
  let P2: string; // Pasta de nível 1 sem Subpastas
  let P3: string; // outra Pasta de nível 1 sem Subpastas
  beforeEach(() => {
    P1 = pasta("Pai com sub");
    SUB = pasta("Sub de P1", P1, "folder");
    P2 = pasta("Pai sem sub");
    P3 = pasta("Outra sem sub");
  });

  const pastaPorId = (id: string) => {
    const f = state.folders.find((x) => x.id === id);
    if (!f) throw new Error(`Pasta ${id} não existe`);
    return f;
  };

  it("recusa a Pasta com Subpastas para dentro de outra Pasta, com a frase da RN-SUB-11, e o pai não muda", () => {
    const r = moveContainer(state, THIAGO, "folder", P1, { parentType: "folder", parentId: P2 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Uma Pasta com Subpastas não vai para dentro de outra Pasta.");
    expect(pastaPorId(P1).parentType).toBe("space");
    expect(pastaPorId(P1).parentId).toBe("spc_com");
    expect(pastaPorId(SUB).parentId).toBe(P1);
  });

  it("recusa qualquer Pasta para dentro de uma Subpasta (RN-SUB-02) e o pai não muda", () => {
    const r = moveContainer(state, THIAGO, "folder", P2, { parentType: "folder", parentId: SUB });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Uma Subpasta não contém outra Pasta: a estrutura para aqui.");
    expect(pastaPorId(P2).parentType).toBe("space");
    expect(pastaPorId(P2).parentId).toBe("spc_com");
  });

  it("a Pasta com Subpastas para dentro de uma Subpasta cai na primeira recusa da lista (a de Subpastas)", () => {
    const outra = pasta("Outro pai", "spc_com");
    const subOutra = pasta("Sub do outro pai", outra, "folder");
    const r = moveContainer(state, THIAGO, "folder", P1, { parentType: "folder", parentId: subOutra });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Uma Pasta com Subpastas não vai para dentro de outra Pasta.");
  });

  it("a Subpasta vai para um Espaço e vira Pasta de nível 1, com a Atividade 'Subpasta promovida a Pasta' e os caminhos", () => {
    const r = moveContainer(state, THIAGO, "folder", SUB, { parentType: "space", parentId: "spc_com" });
    expect(r.ok).toBe(true);
    expect(pastaPorId(SUB).parentType).toBe("space");
    expect(pastaPorId(SUB).parentId).toBe("spc_com");

    const atividade = state.activity[0];
    expect(atividade?.action).toBe("Subpasta promovida a Pasta");
    expect(atividade?.objectType).toBe("folder");
    expect(atividade?.objectId).toBe(SUB);
    expect(atividade?.before).toBe("Comercial › Pai com sub › Sub de P1");
    expect(atividade?.after).toBe("Comercial › Sub de P1");
  });

  it("a Pasta sem Subpastas vai para outra Pasta e vira Subpasta, com a Atividade 'Pasta rebaixada a Subpasta'", () => {
    const r = moveContainer(state, THIAGO, "folder", P2, { parentType: "folder", parentId: P1 });
    expect(r.ok).toBe(true);
    expect(pastaPorId(P2).parentType).toBe("folder");
    expect(pastaPorId(P2).parentId).toBe(P1);

    const atividade = state.activity[0];
    expect(atividade?.action).toBe("Pasta rebaixada a Subpasta");
    expect(atividade?.before).toBe("Comercial › Pai sem sub");
    expect(atividade?.after).toBe("Comercial › Pai com sub › Pai sem sub");
  });

  it("a Pasta de nível 1 vai de um Espaço para outro e grava 'Pasta movida'", () => {
    const r = moveContainer(state, THIAGO, "folder", P3, { parentType: "space", parentId: "spc_ops" });
    expect(r.ok).toBe(true);
    expect(pastaPorId(P3).parentId).toBe("spc_ops");
    const atividade = state.activity[0];
    expect(atividade?.action).toBe("Pasta movida");
    expect(atividade?.before).toBe("Comercial › Outra sem sub");
    expect(atividade?.after).toBe("Entrega › Outra sem sub");
  });

  it("a Subpasta que vai para outra Pasta continua Subpasta e grava 'Pasta movida'", () => {
    const r = moveContainer(state, THIAGO, "folder", SUB, { parentType: "folder", parentId: P2 });
    expect(r.ok).toBe(true);
    expect(pastaPorId(SUB).parentType).toBe("folder");
    expect(pastaPorId(SUB).parentId).toBe(P2);
    expect(state.activity[0]?.action).toBe("Pasta movida");
  });

  it("recusaDeMover devolve as mesmas frases de profundidade (L1)", () => {
    expect(recusaDeMover(state, THIAGO, "folder", P1, { parentType: "folder", parentId: P2 })).toBe("Uma Pasta com Subpastas não vai para dentro de outra Pasta.");
    expect(recusaDeMover(state, THIAGO, "folder", P2, { parentType: "folder", parentId: SUB })).toBe("Uma Subpasta não contém outra Pasta: a estrutura para aqui.");
    expect(recusaDeMover(state, THIAGO, "folder", SUB, { parentType: "space", parentId: "spc_com" })).toBeUndefined();
  });

  it("uma Lista pode ir para dentro de uma Subpasta (a profundidade só recusa Pastas)", () => {
    const l = lista("Solta", P2);
    const r = moveContainer(state, THIAGO, "list", l, { parentType: "folder", parentId: SUB });
    expect(r.ok).toBe(true);
  });
});

describe("moveContainer — bloqueio, colisão de nome, Formulário e estrutura fixa (D-11, RN-ESP-09, RN-PAS-14)", () => {
  let ORIGEM: string;
  let ALFA: string;
  let DEST: string;
  beforeEach(() => {
    ORIGEM = pasta("Origem A");
    ALFA = lista("Alfa", ORIGEM);
    DEST = pasta("Destino B");
  });

  const campoEm = (tipo: "space" | "folder" | "list", id: string, nome: string): string => {
    const r = createFieldDefinition(state, THIAGO, { name: nome, type: "text", definedAtType: tipo, definedAtId: id });
    if (!r.ok) throw new Error(r.error);
    return r.value.id;
  };

  describe("bloqueio do destino (RN-ESP-09, T-10-48)", () => {
    it("recusa a Lista com Conjunto próprio para uma Pasta que bloqueia o Conjunto, citando a Pasta de destino", () => {
      expect(overrideStatusSet(state, THIAGO, "list", ALFA).ok).toBe(true);
      expect(setContainerBlock(state, THIAGO, "folder", DEST, "statusSet", true).ok).toBe(true);

      const r = moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: DEST });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBe("Pasta Destino B bloqueia a sobrescrita do Conjunto de Status abaixo dele.");
      expect(listaPorId(ALFA).parentId).toBe(ORIGEM);
    });

    it("o `blocks` do PRÓPRIO destino entra, e o de um ancestral dele também", () => {
      expect(setContainerFeature(state, THIAGO, "list", ALFA, "compartilhamentoPublico", false).ok).toBe(true);
      expect(setContainerBlock(state, THIAGO, "space", "spc_ops", "features", true).ok).toBe(true);

      const noEspaco = moveContainer(state, THIAGO, "list", ALFA, { parentType: "space", parentId: "spc_ops" });
      expect(noEspaco.ok).toBe(false);
      if (noEspaco.ok) return;
      expect(noEspaco.error).toBe("Espaço Entrega bloqueia as Funcionalidades abaixo dele.");

      const abaixo = moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: "fld_protocolos" });
      expect(abaixo.ok).toBe(false);
      if (abaixo.ok) return;
      expect(abaixo.error).toBe("Espaço Entrega bloqueia as Funcionalidades abaixo dele.");
    });

    it("a Pasta recusa quando um DESCENDENTE dela define o aspecto bloqueado no destino", () => {
      expect(setContainerDefaultViews(state, THIAGO, "list", ALFA, { disponiveis: ["lista", "quadro"], inicial: "lista" }).ok).toBe(true);
      expect(setContainerBlock(state, THIAGO, "folder", "fld_protocolos", "defaultViews", true).ok).toBe(true);

      const r = moveContainer(state, THIAGO, "folder", ORIGEM, { parentType: "folder", parentId: "fld_protocolos" });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBe("Pasta Playbooks bloqueia as Visualizações padrão abaixo dele.");
      expect(state.folders.find((f) => f.id === ORIGEM)?.parentId).toBe("spc_com");
    });

    it("sem nada definido no movido, o bloqueio do destino não recusa", () => {
      expect(setContainerBlock(state, THIAGO, "folder", DEST, "statusSet", true).ok).toBe(true);
      expect(setContainerBlock(state, THIAGO, "folder", DEST, "features", true).ok).toBe(true);
      expect(moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: DEST }).ok).toBe(true);
    });

    it("A5: aspecto que ACUMULA (Campos, Tipos) não recusa por bloqueio do destino; o que existe fica", () => {
      const campo = campoEm("list", ALFA, "Turma da Alfa");
      const tipo = createTaskType(state, THIAGO, { name: "Visita da Alfa", icon: "map-pin", definedAtType: "list", definedAtId: ALFA });
      if (!tipo.ok) throw new Error(tipo.error);
      expect(setContainerBlock(state, THIAGO, "folder", DEST, "fieldDefinitions", true).ok).toBe(true);
      expect(setContainerBlock(state, THIAGO, "folder", DEST, "taskTypes", true).ok).toBe(true);

      const r = moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: DEST });

      expect(r.ok).toBe(true);
      expect(state.fieldDefinitions.find((d) => d.id === campo)?.lifecycle).toBe("ativo");
      expect(state.taskTypes.some((t) => t.id === tipo.value.id)).toBe(true);
    });

    it("o Espaço Marketing, que já bloqueia Campos no seed, recebe a Lista com Campo próprio (A5)", () => {
      campoEm("list", ALFA, "Turma da Alfa");
      expect(moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: "fld_campanhas" }).ok).toBe(true);
    });
  });

  describe("colisão de nome de Campo e de Tipo no caminho novo (Q5, RN-PAS-14)", () => {
    it("recusa a Lista cujo Campo próprio tem o nome de um Campo efetivo no destino (sem diferenciar maiúsculas)", () => {
      campoEm("list", ALFA, "Responsável técnico");
      campoEm("folder", DEST, "responsável TÉCNICO");

      const r = moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: DEST });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("Responsável técnico");
      expect(r.error).toContain("Campo");
      expect(listaPorId(ALFA).parentId).toBe(ORIGEM);
    });

    it("a Pasta recusa quando o Campo de uma Lista dentro dela colide com o do Espaço de destino", () => {
      campoEm("list", ALFA, "Região");
      campoEm("space", "spc_ops", "Região");

      const r = moveContainer(state, THIAGO, "folder", ORIGEM, { parentType: "space", parentId: "spc_ops" });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("Região");
      expect(state.folders.find((f) => f.id === ORIGEM)?.parentId).toBe("spc_com");
    });

    it("recusa o Tipo de Tarefa próprio com o nome de um Tipo do caminho de destino", () => {
      const tipo = createTaskType(state, THIAGO, { name: "Visita", icon: "map-pin", definedAtType: "list", definedAtId: ALFA });
      if (!tipo.ok) throw new Error(tipo.error);
      expect(createTaskType(state, THIAGO, { name: "visita", icon: "map-pin", definedAtType: "folder", definedAtId: DEST }).ok).toBe(true);

      const r = moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: DEST });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("Tipo de Tarefa");
      expect(r.error).toContain("Visita");
    });

    it("um Campo de outra Lista irmã do destino, fora do caminho dele, não colide", () => {
      campoEm("list", ALFA, "Prazo do cliente");
      const irma = lista("Irmã", DEST);
      campoEm("list", irma, "Prazo do cliente");

      expect(moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: DEST }).ok).toBe(true);
    });
  });

  describe("Formulário que o envio deixaria de aceitar", () => {
    const formularioPerguntando = (listId: string, definitionId: string, como = THIAGO): void => {
      const r = createForm(state, como, listId, {
        name: "Pedido de visita",
        questions: [
          { label: "Título", required: true, target: { kind: "title" } },
          { label: "Turma", required: false, target: { kind: "field", definitionId } },
        ],
      });
      if (!r.ok) throw new Error(r.error);
    };

    it("recusa quando um Formulário ativo da Lista pergunta um Campo herdado que não vale no destino", () => {
      const campo = campoEm("folder", ORIGEM, "Turma");
      formularioPerguntando(ALFA, campo);

      const r = moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: DEST });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("Pedido de visita");
      expect(r.error).toContain("Turma");
      expect(r.error).toContain("o envio quebraria");
      expect(listaPorId(ALFA).parentId).toBe(ORIGEM);
    });

    it("o Formulário arquivado não impede, nem o que pergunta um Campo que continua valendo", () => {
      const campo = campoEm("folder", ORIGEM, "Turma");
      formularioPerguntando(ALFA, campo);
      const form = state.forms.find((f) => f.listId === ALFA);
      if (!form) throw new Error("sem Formulário");
      form.lifecycle = "arquivado";
      expect(moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: DEST }).ok).toBe(true);

      const campoDoEspaco = campoEm("space", "spc_com", "Origem do contato");
      const beta = lista("Beta", ORIGEM);
      formularioPerguntando(beta, campoDoEspaco);
      expect(moveContainer(state, THIAGO, "list", beta, { parentType: "folder", parentId: DEST }).ok).toBe(true);
    });

    it("a frase não cita o Formulário nem a Lista privada que o ator não alcança (B38a)", () => {
      // O Campo vem do Espaço de origem: a Pasta que o leva não o leva junto.
      const campo = campoEm("space", "spc_com", "Turma do Espaço");
      const reservada = createList(state, THIAGO, { name: "Reservada da diretoria", parentType: "folder", parentId: ORIGEM, isPrivate: true });
      if (!reservada.ok) throw new Error(reservada.error);
      formularioPerguntando(reservada.value.id, campo);
      expect(memberReachesContainer(state, RAFAEL, "list", reservada.value.id)).toBe(false);

      const r = moveContainer(state, RAFAEL, "folder", ORIGEM, { parentType: "space", parentId: "spc_ops" });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("o envio quebraria");
      expect(r.error).not.toContain("Pedido de visita");
      expect(r.error).not.toContain("Reservada");
    });
  });

  describe("estruturas fixas (Q2/A7, T-10-09)", () => {
    it("recusa mover Contas a pagar e Contas a receber, com a frase própria", () => {
      for (const [id, nome] of [
        [CP.listId, "Contas a pagar"],
        [CR.listId, "Contas a receber"],
      ] as const) {
        const r = moveContainer(state, THIAGO, "list", id, { parentType: "space", parentId: "spc_ops" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error).toBe(`Lista ${nome} é uma estrutura fixa e não muda de lugar.`);
        expect(listaPorId(id).parentId).toBe("fld_financeiro");
      }
    });

    it("recusa mover a Lista Solicitações de pagamento", () => {
      const nova = createList(state, THIAGO, { name: "Solicitações de pagamento", parentType: "folder", parentId: "fld_financeiro" });
      if (!nova.ok) throw new Error(nova.error);
      (listaPorId(nova.value.id) as { id: string }).id = LISTA_SOLICITACOES_ID;

      const r = moveContainer(state, THIAGO, "list", LISTA_SOLICITACOES_ID, { parentType: "space", parentId: "spc_ops" });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBe("Lista Solicitações de pagamento é uma estrutura fixa e não muda de lugar.");
    });

    it("recusa mover a Pasta Meus negócios", () => {
      const r = moveContainer(state, THIAGO, "folder", MEUS_NEGOCIOS_ID, { parentType: "space", parentId: "spc_ops" });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBe("Pasta Meus negócios é uma estrutura fixa e não muda de lugar.");
      expect(state.folders.find((f) => f.id === MEUS_NEGOCIOS_ID)?.parentId).toBe("spc_com");
    });

    it("recusa qualquer destino dentro de Meus negócios, para Lista e para Pasta", () => {
      const lista1 = moveContainer(state, THIAGO, "list", ALFA, { parentType: "folder", parentId: MEUS_NEGOCIOS_ID });
      expect(lista1.ok).toBe(false);
      if (lista1.ok) return;
      expect(lista1.error).toBe("A Pasta Meus negócios não recebe Pastas nem Listas.");

      const pasta1 = moveContainer(state, THIAGO, "folder", DEST, { parentType: "folder", parentId: MEUS_NEGOCIOS_ID });
      expect(pasta1.ok).toBe(false);
      if (pasta1.ok) return;
      expect(pasta1.error).toBe("A Pasta Meus negócios não recebe Pastas nem Listas.");
      expect(listaPorId(ALFA).parentId).toBe(ORIGEM);
    });
  });
});

describe("consequenciasDeMover — L2: o que o diálogo mostra antes de agir (Q4)", () => {
  let ORIGEM: string;
  let ALFA: string;
  let DEST: string;
  beforeEach(() => {
    ORIGEM = pasta("Origem A");
    ALFA = lista("Alfa", ORIGEM);
    DEST = pasta("Destino B");
  });

  const tarefaDe = (id: string) => {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) throw new Error(`Tarefa ${id} não existe`);
    return t;
  };
  const noDestino = (id: string) => ({ parentType: "folder", parentId: id }) as const;

  it("mesmo Conjunto e mesmos Campos: nada muda e nada é listado", () => {
    tarefa(ALFA, "Uma");
    expect(consequenciasDeMover(state, "list", ALFA, noDestino(DEST))).toEqual({
      conjuntoMuda: false,
      statusEmUso: [],
      camposQueSaem: [],
      valoresAfetados: 0,
      tiposQueMudam: 0,
      linksPublicosRevogados: 0,
    });
  });

  it("outro Conjunto: lista cada Status em uso uma vez, na ordem do Conjunto de origem, com categoria e Tarefas", () => {
    const config = effectiveListConfig(state, ALFA);
    if (!config) throw new Error("sem configuração");
    const [primeiro, segundo] = [...config.statusSet.definitions].sort((x, y) => x.order - y.order);
    if (!primeiro || !segundo) throw new Error("Conjunto curto demais");
    const a = tarefa(ALFA, "A");
    const b = tarefa(ALFA, "B");
    const c = tarefa(ALFA, "C");
    tarefaDe(a).statusId = segundo.id;
    tarefaDe(b).statusId = segundo.id;
    tarefaDe(c).statusId = primeiro.id;
    // Uma Subtarefa e uma Tarefa arquivada também contam (todos os ciclos de vida).
    const sub = createTask(state, THIAGO, { listId: ALFA, title: "Sub de A", parentTaskId: a });
    if (!sub.ok) throw new Error(sub.error);
    tarefaDe(sub.value.id).statusId = segundo.id;

    const r = consequenciasDeMover(state, "list", ALFA, { parentType: "space", parentId: "spc_ops" });

    expect(r.conjuntoMuda).toBe(true);
    expect(r.statusEmUso.map((s) => s.statusId)).toEqual([primeiro.id, segundo.id]);
    expect(r.statusEmUso[0]).toEqual({ statusId: primeiro.id, nome: primeiro.name, categoria: primeiro.category, tarefas: 1 });
    expect(r.statusEmUso[1]).toEqual({ statusId: segundo.id, nome: segundo.name, categoria: segundo.category, tarefas: 3 });
  });

  it("não deixa o estado mudado, nem o pai do movido", () => {
    tarefa(ALFA, "A");
    const antes = JSON.stringify(state);
    consequenciasDeMover(state, "list", ALFA, { parentType: "space", parentId: "spc_ops" });
    consequenciasDeMover(state, "folder", ORIGEM, { parentType: "space", parentId: "spc_ops" });
    expect(JSON.stringify(state)).toBe(antes);
  });

  it("Campo que sai: nome e Valores `ativo` das Tarefas afetadas; o Valor já arquivado não conta", () => {
    const campo = createFieldDefinition(state, THIAGO, { name: "Turma", type: "text", definedAtType: "folder", definedAtId: ORIGEM });
    if (!campo.ok) throw new Error(campo.error);
    const comValor = tarefa(ALFA, "Com valor");
    const outra = tarefa(ALFA, "Com valor arquivado");
    tarefa(ALFA, "Sem valor");
    expect(setTaskFieldValue(state, THIAGO, comValor, campo.value.id, "Turma 1").ok).toBe(true);
    expect(setTaskFieldValue(state, THIAGO, outra, campo.value.id, "Turma 2").ok).toBe(true);
    const arquivado = tarefaDe(outra).fieldValues.find((v) => v.definitionId === campo.value.id);
    if (!arquivado) throw new Error("sem Valor");
    arquivado.state = "arquivado";

    const r = consequenciasDeMover(state, "list", ALFA, noDestino(DEST));

    expect(r.conjuntoMuda).toBe(false);
    expect(r.camposQueSaem).toEqual([{ id: campo.value.id, nome: "Turma" }]);
    expect(r.valoresAfetados).toBe(1);
  });

  it("Tipo sem efeito no destino e link público: contam as Tarefas", () => {
    const tipo = createTaskType(state, THIAGO, { name: "Visita", icon: "map-pin", definedAtType: "folder", definedAtId: ORIGEM });
    if (!tipo.ok) throw new Error(tipo.error);
    expect(setContainerFeature(state, THIAGO, "folder", DEST, "compartilhamentoPublico", false).ok).toBe(true);
    const a = tarefa(ALFA, "Visita 1");
    const b = tarefa(ALFA, "Visita 2");
    tarefa(ALFA, "Comum");
    expect(updateTask(state, THIAGO, a, { taskTypeId: tipo.value.id }).ok).toBe(true);
    expect(updateTask(state, THIAGO, b, { taskTypeId: tipo.value.id }).ok).toBe(true);
    expect(shareTaskPublicly(state, THIAGO, a, { showsComments: false, showsAttachments: false }).ok).toBe(true);

    const r = consequenciasDeMover(state, "list", ALFA, noDestino(DEST));

    expect(r.tiposQueMudam).toBe(2);
    expect(r.linksPublicosRevogados).toBe(1);
  });

  it("Pasta: soma as Listas da subárvore cujo Conjunto muda", () => {
    const outra = lista("Beta", ORIGEM);
    tarefa(ALFA, "A");
    tarefa(outra, "B");
    const r = consequenciasDeMover(state, "folder", ORIGEM, { parentType: "space", parentId: "spc_ops" });
    expect(r.conjuntoMuda).toBe(true);
    expect(r.statusEmUso.reduce((soma, s) => soma + s.tarefas, 0)).toBe(2);
  });

  it("devolve tudo zerado para um contêiner que não existe", () => {
    expect(consequenciasDeMover(state, "list", "lst_nao_existe", noDestino(DEST)).conjuntoMuda).toBe(false);
  });
});

describe("recusaDeMover × moveContainer — paridade (L1, Pitfall 6)", () => {
  /** O mapeamento mais largo possível: todo Status que existe leva ao primeiro do Conjunto do destino. */
  const mapeamentoCompleto = (alvo: { parentType: "space" | "folder"; parentId: string }) => {
    const destinoSet = effectiveContainerConfig(state, alvo.parentType, alvo.parentId)?.statusSet.definitions.find((d) => d.order === 0) ?? effectiveContainerConfig(state, alvo.parentType, alvo.parentId)?.statusSet.definitions[0];
    if (!destinoSet) throw new Error("destino sem Conjunto");
    const todos = [state.spaces, state.folders, state.lists].flatMap((cs) => cs.flatMap((c) => c.statusSet?.definitions ?? []));
    return todos.map((d) => ({ fromStatusId: d.id, toStatusId: destinoSet.id }));
  };
  const destinosDoSeed = () => [
    ...state.spaces.map((s) => ({ parentType: "space", parentId: s.id }) as const),
    ...state.folders.map((f) => ({ parentType: "folder", parentId: f.id }) as const),
  ];

  const divergencias = (ator: string, tipo: "folder" | "list", id: string) => {
    const achados: string[] = [];
    let aceitos = 0;
    let recusados = 0;
    for (const destino of destinosDoSeed()) {
      const recusa = recusaDeMover(state, ator, tipo, id, destino);
      const copia = structuredClone(state);
      const r = moveContainer(copia, ator, tipo, id, destino, mapeamentoCompleto(destino));
      if (r.ok === (recusa === undefined)) {
        if (r.ok) aceitos += 1;
        else recusados += 1;
      } else {
        achados.push(`${tipo} ${id} → ${destino.parentType} ${destino.parentId}: moveContainer.ok=${r.ok}, recusaDeMover=${String(recusa)}`);
      }
    }
    return { achados, aceitos, recusados };
  };

  it("para uma Lista com Tarefas, em todos os Espaços e Pastas do seed, o Proprietário e o Administrador", () => {
    for (const ator of [THIAGO, RAFAEL]) {
      const r = divergencias(ator, "list", "lst_propostas");
      expect(r.achados).toEqual([]);
      expect(r.aceitos).toBeGreaterThan(0);
      expect(r.recusados).toBeGreaterThan(0);
    }
  });

  it("para uma Pasta com Listas e para uma Pasta com Subpastas, em todos os destinos do seed", () => {
    const comLista = divergencias(THIAGO, "folder", "fld_propostas");
    expect(comLista.achados).toEqual([]);
    expect(comLista.aceitos).toBeGreaterThan(0);
    const comSubpastas = divergencias(THIAGO, "folder", "fld_clientes");
    expect(comSubpastas.achados).toEqual([]);
    expect(comSubpastas.recusados).toBeGreaterThan(0);
  });

  it("para as estruturas fixas e para um Membro que não administra, todo destino é recusado nos dois lados", () => {
    expect(divergencias(THIAGO, "list", CP.listId)).toMatchObject({ achados: [], aceitos: 0 });
    expect(divergencias(THIAGO, "folder", MEUS_NEGOCIOS_ID)).toMatchObject({ achados: [], aceitos: 0 });
    expect(divergencias(JULIA, "list", "lst_propostas")).toMatchObject({ achados: [], aceitos: 0 });
  });

  it("sobre o recorte do Membro (`visibilidadePara`), a recusa é a mesma do estado inteiro para um destino que ele vê (Pitfall 6)", () => {
    const origem = pasta("Origem A");
    const alfa = lista("Alfa", origem);
    const dest = pasta("Destino B");
    lista("Alfa", dest); // nome repetido: recusa por nome
    const livre = pasta("Livre");
    const campo = createFieldDefinition(state, THIAGO, { name: "Turma", type: "text", definedAtType: "folder", definedAtId: origem });
    if (!campo.ok) throw new Error(campo.error);
    const recorte = visibilidadePara(state, RAFAEL).estado;
    expect(recorte.folders.some((f) => f.id === livre)).toBe(true);

    for (const destino of [dest, livre, "spc_ops"].map((id) => (id.startsWith("spc_") ? ({ parentType: "space", parentId: id } as const) : ({ parentType: "folder", parentId: id } as const)))) {
      expect(recusaDeMover(recorte, RAFAEL, "list", alfa, destino)).toBe(recusaDeMover(state, RAFAEL, "list", alfa, destino));
      expect(consequenciasDeMover(recorte, "list", alfa, destino)).toEqual(consequenciasDeMover(state, "list", alfa, destino));
    }
    // Um destino que o Membro não alcança é "não encontrado" nos dois estados.
    const escondido = { parentType: "space", parentId: "spc_gestao" } as const;
    expect(recusaDeMover(recorte, RAFAEL, "list", alfa, escondido)).toBe(recusaDeMover(state, RAFAEL, "list", alfa, escondido));
  });
});

describe("contador `order` sem duplicata ao criar (Pitfall 3)", () => {
  it("mover e criar em seguida nunca repete `order` no grupo", () => {
    const A = pasta("Origem A");
    const B = pasta("Destino B");
    const a1 = lista("A1", A);
    lista("A2", A);
    lista("B1", B);
    expect(moveContainer(state, THIAGO, "list", a1, { parentType: "folder", parentId: B }).ok).toBe(true);
    lista("Nova em B", B);
    lista("Nova em A", A);
    for (const pai of [A, B]) {
      const ordens = state.lists.filter((l) => l.parentId === pai).map((l) => l.order).sort((x, y) => x - y);
      expect(new Set(ordens).size).toBe(ordens.length);
    }
  });

  it("a Lista criada num grupo com buraco na ordem entra depois do maior `order`, não no `length`", () => {
    const A = pasta("Origem A");
    lista("A1", A);
    const a2 = lista("A2", A);
    listaPorId(a2).order = 2; // dado antigo: 0 e 2, sem o 1
    const nova = lista("A3", A);
    expect(listaPorId(nova).order).toBe(3);
  });

  it("a Pasta criada entra depois do maior `order` dos irmãos, e a primeira de um pai vazio tem 0", () => {
    const vazio = pasta("Vazio");
    expect(state.folders.find((f) => f.id === vazio)?.order).toBe(state.folders.filter((f) => f.parentId === "spc_com" && f.id !== vazio).reduce((m, f) => Math.max(m, f.order), -1) + 1);
    const sub = pasta("Primeira sub", vazio, "folder");
    expect(state.folders.find((f) => f.id === sub)?.order).toBe(0);
    const segunda = pasta("Segunda sub", vazio, "folder");
    (state.folders.find((f) => f.id === sub) as { order: number }).order = 5;
    const terceira = pasta("Terceira sub", vazio, "folder");
    expect(state.folders.find((f) => f.id === terceira)?.order).toBe(6);
    expect(state.folders.find((f) => f.id === segunda)?.order).toBe(1);
  });

  it("o Espaço criado entra depois do maior `order`", () => {
    const maior = Math.max(...state.spaces.map((s) => s.order));
    (state.spaces[0] as { order: number }).order = maior + 10;
    const r = createSpace(state, THIAGO, { name: "Novo Espaço da conferência" });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.order).toBe(maior + 11);
  });
});
