/**
 * Fase 10, 2.6.5 (D-16, RN-ESP-09) — bloquear um aspecto: o Espaço ou a Pasta
 * impede os níveis abaixo de definir o próprio. Os aspectos que SUBSTITUEM
 * (Conjunto de Status, Funcionalidades, Visualizações padrão) só bloqueiam
 * quando ninguém abaixo já sobrescreve; os que ACUMULAM (Campos, Tipos de
 * Tarefa, Automações) bloqueiam só o que for criado depois. Cada teste afirma o
 * RESULTADO da operação e o estado que ela deixou.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { blockedAbove, createFieldDefinition, overrideStatusSet, setContainerBlock } from "./configuration";
import { createFolder, createList, createSpace } from "./structure";

const THIAGO = "mem_thiago"; // Proprietário

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
