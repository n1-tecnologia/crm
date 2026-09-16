/**
 * `syncIdSequence` fecha o risco que a persistência traria sozinha: sem ela,
 * um processo novo do `apps/api` começaria `nextId` em 0 e o próximo `upsert`
 * sobrescreveria um registro real já gravado por outro processo com o mesmo
 * id.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { addTaskComment } from "./tasks";
import { nextId, resetIdSequence, syncIdSequence } from "./activity";

/** Coleta recursivamente todo `id` de string presente no grafo — o mesmo percurso que `syncIdSequence` faz. */
function todosOsIds(valor: unknown, coletados: Set<string> = new Set()): Set<string> {
  if (Array.isArray(valor)) {
    for (const item of valor) todosOsIds(item, coletados);
    return coletados;
  }
  if (valor === null || typeof valor !== "object") return coletados;
  const registro = valor as Record<string, unknown>;
  if (typeof registro.id === "string") coletados.add(registro.id);
  for (const chave of Object.keys(registro)) todosOsIds(registro[chave], coletados);
  return coletados;
}

beforeEach(() => {
  resetIdSequence();
});

describe("syncIdSequence", () => {
  it("depois de syncIdSequence, nextId nunca devolve um id já presente no estado", () => {
    const state = buildSeed();
    resetIdSequence(0);
    syncIdSequence(state);
    const id = nextId("act");
    expect(todosOsIds(state).has(id)).toBe(false);
  });

  it("é determinístico: dois seeds independentes convergem para o mesmo próximo id", () => {
    const primeiro = buildSeed();
    resetIdSequence(0);
    syncIdSequence(primeiro);
    const idPrimeiro = nextId("tsk");

    const segundo = buildSeed();
    resetIdSequence(0);
    syncIdSequence(segundo);
    const idSegundo = nextId("tsk");

    expect(idPrimeiro).toBe(idSegundo);
  });

  it("depois de sincronizar, uma operação nova gera ids que não colidem com nenhum anterior", () => {
    const state = buildSeed();
    const idsAntes = todosOsIds(state);
    resetIdSequence(0);
    syncIdSequence(state);

    const resultado = addTaskComment(state, "mem_maryane", "tsk_seed_1", { content: "x" });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(idsAntes.has(resultado.value.id)).toBe(false);
    const registroDeAtividade = state.activity[0];
    expect(registroDeAtividade).toBeDefined();
    expect(idsAntes.has(registroDeAtividade!.id)).toBe(false);
  });

  it("estado sem nenhum id gerado não lança e nextId reinicia do começo", () => {
    const minimo: DataState = {
      models: [],
      tools: [],
      workspace: { id: "ws_x" } as DataState["workspace"],
      members: [],
      teams: [],
      roles: [],
      integrations: [],
      grants: [],
      templates: [],
      catalog: [],
      tags: [],
      files: [],
      fieldDefinitions: [],
      taskTypes: [],
      views: [],
      goals: [],
      forms: [],
      spaces: [],
      folders: [],
      lists: [],
      tasks: [],
      contacts: [],
      companies: [],
      deals: [],
      funnels: [],
      contactCompanyLinks: [],
      companyCompanyLinks: [],
      distinctFromLinks: [],
      inbox: {} as DataState["inbox"],
      channels: [],
      queues: [],
      conversations: [],
      chatFolders: [],
      chatSessions: [],
      agents: [],
      agentExecutions: [],
      skills: [],
      skillGrants: [],
      automations: [],
      automationExecutions: [],
      approvals: [],
      collections: [],
      collectionGrants: [],
      documents: [],
      panels: [],
      links: [],
      activity: [],
    };

    expect(() => syncIdSequence(minimo)).not.toThrow();
    expect(nextId("x")).toBe("x_000001");
  });
});
