/**
 * Fase 10, 2.6.5 (D-16, RN-ESP-09) — bloquear um aspecto: o Espaço ou a Pasta
 * impede os níveis abaixo de definir o próprio. Os aspectos que SUBSTITUEM
 * (Conjunto de Status, Funcionalidades, Visualizações padrão) só bloqueiam
 * quando ninguém abaixo já sobrescreve; os que ACUMULAM (Campos, Tipos de
 * Tarefa, Automações) bloqueiam só o que for criado depois. Cada teste afirma o
 * RESULTADO da operação e o estado que ela deixou.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { bloqueioAcima, contagemAcumulada, effectiveListConfig, origemDoAspecto, sobrescritasAbaixo } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { blockedAbove, createFieldDefinition, overrideStatusSet, setContainerBlock, setContainerFeature } from "./configuration";
import { criarAutomacao } from "./ia/automacoes-editor";
import { createFolder, createList, createSpace } from "./structure";

const THIAGO = "mem_thiago"; // Proprietário
const RAFAEL = "mem_rafael"; // Administrador
const JULIA = "mem_julia"; // Papel de vendas: não administra

// Um Espaço novo, sem nenhuma sobrescrita abaixo: o `spc_com` do seed já tem Listas e
// uma Subpasta com Conjunto próprio, e o teste precisa partir de um Espaço limpo.
let state: DataState;
let ESPACO: string;
let LISTA_NO_ESPACO: string;
beforeEach(() => {
  state = buildSeed();
  const espacoNovo = createSpace(state, THIAGO, { name: "Operações novas" });
  if (!espacoNovo.ok) throw new Error(espacoNovo.error);
  ESPACO = espacoNovo.value.id;
  const lista = createList(state, THIAGO, { name: "Fila", parentType: "space", parentId: ESPACO });
  if (!lista.ok) throw new Error(lista.error);
  LISTA_NO_ESPACO = lista.value.id;
});

const espaco = () => {
  const s = state.spaces.find((x) => x.id === ESPACO);
  if (!s) throw new Error("o seed precisa do Espaço spc_com");
  return s;
};

const novaPasta = (nome: string, extra: { isPrivate?: boolean } = {}): string => {
  const r = createFolder(state, THIAGO, { name: nome, parentType: "space", parentId: ESPACO, ...extra });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

describe("setContainerBlock — Conjunto de Status (EST-10)", () => {
  it("bloqueia o Conjunto de Status num Espaço sem sobrescrita abaixo e a Lista deixa de poder sobrescrever", () => {
    const r = setContainerBlock(state, THIAGO, "space", ESPACO, "statusSet", true);
    expect(r.ok).toBe(true);
    expect(espaco().blocks.statusSet).toBe(true);
    const atividade = state.activity[0];
    expect(atividade?.action).toBe("Aspecto bloqueado");
    expect(atividade?.detail).toBe("Conjunto de Status");
    expect(atividade?.objectId).toBe(ESPACO);

    const sobrescrita = overrideStatusSet(state, THIAGO, "list", LISTA_NO_ESPACO);
    expect(sobrescrita.ok).toBe(false);
    if (!sobrescrita.ok) expect(sobrescrita.error).toBe(blockedAbove(state, "list", LISTA_NO_ESPACO, "statusSet"));
    expect(state.lists.find((l) => l.id === LISTA_NO_ESPACO)?.statusSet).toBeUndefined();
  });

  it("recusa bloquear enquanto uma Pasta abaixo sobrescreve, e a frase nomeia a Pasta", () => {
    const pasta = novaPasta("Clientes VIP");
    expect(overrideStatusSet(state, THIAGO, "folder", pasta).ok).toBe(true);

    const r = setContainerBlock(state, THIAGO, "space", ESPACO, "statusSet", true);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Pasta Clientes VIP");
      expect(r.error).toContain("Conjunto de Status");
    }
    expect(espaco().blocks.statusSet).toBeUndefined();
  });

  it("desbloquear grava a Atividade e repetir o estado atual não grava outra", () => {
    expect(setContainerBlock(state, THIAGO, "space", ESPACO, "statusSet", true).ok).toBe(true);

    const desbloqueio = setContainerBlock(state, THIAGO, "space", ESPACO, "statusSet", false);
    expect(desbloqueio.ok).toBe(true);
    expect(espaco().blocks.statusSet).toBeUndefined();
    expect(state.activity[0]?.action).toBe("Aspecto desbloqueado");
    expect(state.activity[0]?.detail).toBe("Conjunto de Status");

    const total = state.activity.length;
    expect(setContainerBlock(state, THIAGO, "space", ESPACO, "statusSet", false).ok).toBe(true);
    expect(state.activity.length).toBe(total);
  });

  it("repetir o bloqueio já gravado não grava Atividade", () => {
    expect(setContainerBlock(state, THIAGO, "space", ESPACO, "statusSet", true).ok).toBe(true);
    const total = state.activity.length;
    expect(setContainerBlock(state, THIAGO, "space", ESPACO, "statusSet", true).ok).toBe(true);
    expect(state.activity.length).toBe(total);
  });
});

describe("setContainerBlock — recusas básicas", () => {
  it("o aspecto que acumula não consulta quem está abaixo: bloquear Campos vale só para o que vem depois", () => {
    const pasta = novaPasta("Contratos");
    const existente = createFieldDefinition(state, THIAGO, { name: "Valor do contrato", type: "text", definedAtType: "folder", definedAtId: pasta });
    expect(existente.ok).toBe(true);

    expect(setContainerBlock(state, THIAGO, "space", ESPACO, "fieldDefinitions", true).ok).toBe(true);

    const novo = createFieldDefinition(state, THIAGO, { name: "Vigência", type: "text", definedAtType: "folder", definedAtId: pasta });
    expect(novo.ok).toBe(false);
  });
});

describe("setContainerBlock — aspectos que acumulam", () => {
  it("o Campo existente continua na Lista abaixo e um Campo novo na Pasta é recusado", () => {
    const pasta = novaPasta("Contratos");
    const lista = createList(state, THIAGO, { name: "Vigentes", parentType: "folder", parentId: pasta });
    if (!lista.ok) throw new Error(lista.error);
    const campo = createFieldDefinition(state, THIAGO, { name: "Valor", type: "text", definedAtType: "folder", definedAtId: pasta });
    if (!campo.ok) throw new Error(campo.error);

    expect(setContainerBlock(state, THIAGO, "space", ESPACO, "fieldDefinitions", true).ok).toBe(true);

    expect(effectiveListConfig(state, lista.value.id)?.fieldDefinitionIds).toContain(campo.value.id);
    const novo = createFieldDefinition(state, THIAGO, { name: "Prazo", type: "text", definedAtType: "folder", definedAtId: pasta });
    expect(novo.ok).toBe(false);
    if (!novo.ok) expect(novo.error).toBe(blockedAbove(state, "folder", pasta, "fieldDefinitions"));
  });
});

describe("setContainerBlock — Automações (T-10-06)", () => {
  it("bloquear Automações numa Pasta recusa criarAutomacao numa Lista dentro dela e libera o Espaço acima", () => {
    const pasta = novaPasta("Marketing");
    const lista = createList(state, THIAGO, { name: "Campanhas", parentType: "folder", parentId: pasta });
    if (!lista.ok) throw new Error(lista.error);
    expect(setContainerBlock(state, THIAGO, "folder", pasta, "automations", true).ok).toBe(true);

    const abaixo = criarAutomacao(state, THIAGO, { name: "Avisar", scopeType: "list", scopeId: lista.value.id });
    expect(abaixo.ok).toBe(false);
    if (!abaixo.ok) {
      expect(abaixo.error).toBe(blockedAbove(state, "list", lista.value.id, "automations"));
      expect(abaixo.error).toContain("Pasta Marketing");
    }
    expect(state.automations.some((a) => a.scopeId === lista.value.id)).toBe(false);

    const acima = criarAutomacao(state, THIAGO, { name: "Avisar o Espaço", scopeType: "space", scopeId: ESPACO });
    expect(acima.ok).toBe(true);
  });
});

describe("setContainerBlock — privacidade da recusa (B38a, T-10-05)", () => {
  it("a Pasta privada que o ator não alcança entra só como contagem, nunca pelo nome", () => {
    const publica = novaPasta("Clientes");
    const privada = novaPasta("Diretoria secreta", { isPrivate: true });
    expect(overrideStatusSet(state, THIAGO, "folder", publica).ok).toBe(true);
    expect(overrideStatusSet(state, THIAGO, "folder", privada).ok).toBe(true);

    const r = setContainerBlock(state, RAFAEL, "space", ESPACO, "statusSet", true);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Pasta Clientes");
      expect(r.error).not.toContain("Diretoria secreta");
      expect(r.error).toContain("e mais 1 que você não alcança");
    }
  });

  it("se só houver a privada, a frase fala só na contagem", () => {
    const privada = novaPasta("Diretoria secreta", { isPrivate: true });
    expect(overrideStatusSet(state, THIAGO, "folder", privada).ok).toBe(true);

    const r = setContainerBlock(state, RAFAEL, "space", ESPACO, "statusSet", true);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain("Diretoria secreta");
      expect(r.error).toContain("1 contêiner que você não alcança define");
    }
  });

  it("sobrescritasAbaixo com o Membro devolve só os que ele alcança; sem ele, todos", () => {
    const privada = novaPasta("Diretoria secreta", { isPrivate: true });
    expect(overrideStatusSet(state, THIAGO, "folder", privada).ok).toBe(true);
    expect(sobrescritasAbaixo(state, "space", ESPACO, "statusSet").map((x) => x.id)).toEqual([privada]);
    expect(sobrescritasAbaixo(state, "space", ESPACO, "statusSet", RAFAEL)).toEqual([]);
    expect(sobrescritasAbaixo(state, "space", ESPACO, "statusSet", THIAGO).map((x) => x.id)).toEqual([privada]);
  });
});

describe("setContainerBlock — quem pode e ciclo de vida", () => {
  it("Membro sem administrar é recusado e nada muda", () => {
    const r = setContainerBlock(state, JULIA, "space", ESPACO, "statusSet", true);
    expect(r.ok).toBe(false);
    expect(espaco().blocks.statusSet).toBeUndefined();
  });

  it("contêiner arquivado não muda de bloqueio", () => {
    const pasta = novaPasta("Antiga");
    const alvo = state.folders.find((f) => f.id === pasta);
    if (!alvo) throw new Error("Pasta não criada");
    alvo.lifecycle = "arquivado";
    expect(setContainerBlock(state, THIAGO, "folder", pasta, "statusSet", true).ok).toBe(false);
  });
});

describe("leituras para a tela (L5, origem, contagem)", () => {
  it("bloqueioAcima devolve quem bloqueia e blockedAbove monta a mesma frase a partir dele", () => {
    const pasta = novaPasta("Contratos");
    expect(bloqueioAcima(state, "folder", pasta, "features")).toBeUndefined();
    expect(setContainerBlock(state, THIAGO, "space", ESPACO, "features", true).ok).toBe(true);

    const acima = bloqueioAcima(state, "folder", pasta, "features");
    expect(acima).toEqual({ tipo: "space", id: ESPACO, nome: "Operações novas" });
    expect(blockedAbove(state, "folder", pasta, "features")).toBe("Espaço Operações novas bloqueia as Funcionalidades abaixo dele.");
    // o próprio nó que bloqueia não se bloqueia
    expect(bloqueioAcima(state, "space", ESPACO, "features")).toBeUndefined();
  });

  it("origemDoAspecto: herdado, aqui e plataforma", () => {
    const pasta = novaPasta("Contratos");
    const lista = createList(state, THIAGO, { name: "Vigentes", parentType: "folder", parentId: pasta });
    if (!lista.ok) throw new Error(lista.error);

    expect(origemDoAspecto(state, "list", lista.value.id, "statusSet")).toEqual({
      origem: "herdado",
      de: { tipo: "space", id: ESPACO, nome: "Operações novas" },
    });
    expect(overrideStatusSet(state, THIAGO, "list", lista.value.id).ok).toBe(true);
    expect(origemDoAspecto(state, "list", lista.value.id, "statusSet")).toEqual({ origem: "aqui" });

    expect(origemDoAspecto(state, "list", lista.value.id, "defaultViews")).toEqual({ origem: "plataforma" });
    expect(setContainerFeature(state, THIAGO, "folder", pasta, "prioridade", false).ok).toBe(true);
    expect(origemDoAspecto(state, "list", lista.value.id, "features")).toEqual({
      origem: "herdado",
      de: { tipo: "folder", id: pasta, nome: "Contratos" },
    });
  });

  it("contagemAcumulada: um Campo próprio na Pasta sob dois do Espaço", () => {
    const pasta = novaPasta("Contratos");
    for (const nome of ["Valor", "Prazo"]) {
      const r = createFieldDefinition(state, THIAGO, { name: nome, type: "text", definedAtType: "space", definedAtId: ESPACO });
      if (!r.ok) throw new Error(r.error);
    }
    const proprio = createFieldDefinition(state, THIAGO, { name: "Cláusula", type: "text", definedAtType: "folder", definedAtId: pasta });
    if (!proprio.ok) throw new Error(proprio.error);
    expect(contagemAcumulada(state, "folder", pasta, "fieldDefinitions")).toEqual({ aqui: 1, herdados: 2 });
    expect(contagemAcumulada(state, "space", ESPACO, "fieldDefinitions")).toEqual({ aqui: 2, herdados: 0 });
  });
});
