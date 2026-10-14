/** PARA-05 — a superfície pública da Tarefa, sem banco: estado injetado. */
import { describe, expect, it } from "vitest";
import { shareTaskPublicly, revokePublicShare } from "@n1/dominio/operations/scale";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import { buildApp } from "../app";
import { criarLimiteDeTaxa } from "../servicos/limite-de-taxa";

function cenario() {
  const state = buildSeed();
  const t = state.tasks.find((x) => x.listId === "lst_propostas" && x.lifecycle === "ativo" && !x.parentTaskId);
  if (!t) throw new Error("seed sem Tarefa");
  const share = shareTaskPublicly(state, "mem_thiago", t.id, { showsComments: false, showsAttachments: false });
  if (!share.ok) throw new Error(share.error);
  return { state, task: t, secret: share.value.secret };
}

function appCom(estado: DataState, maximo = 1000) {
  return buildApp({ logger: false, tarefasPublicas: { lerEstado: async () => estado, limitePorIp: criarLimiteDeTaxa({ janelaMs: 60_000, maximo }) } });
}

describe("GET /v1/public/tasks/:secret", () => {
  it("abre sem Authorization com o link ativo e devolve só a projeção", async () => {
    const { state, task, secret } = cenario();
    const resposta = await appCom(state).inject({ method: "GET", url: `/v1/public/tasks/${secret}` });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json() as { title: string; comments?: unknown; attachments?: unknown };
    expect(corpo.title).toBe(task.title);
    expect(corpo.comments).toBeUndefined();
    expect(corpo.attachments).toBeUndefined();
    expect(resposta.body).not.toContain(secret);
    expect(resposta.body).not.toContain(task.id);
  });

  it("segredo inexistente, mal formado e link revogado respondem o mesmo 404", async () => {
    const { state, task, secret } = cenario();
    const app = appCom(state);
    const inexistente = await app.inject({ method: "GET", url: `/v1/public/tasks/${"0".repeat(24)}` });
    expect(inexistente.statusCode).toBe(404);
    const malFormado = await app.inject({ method: "GET", url: "/v1/public/tasks/a%20b" });
    expect(malFormado.statusCode).toBe(404);
    expect(revokePublicShare(state, "mem_thiago", task.id).ok).toBe(true);
    const revogado = await app.inject({ method: "GET", url: `/v1/public/tasks/${secret}` });
    expect(revogado.statusCode).toBe(404);
    expect(revogado.json()).toEqual(inexistente.json());
  });

  it("limite de taxa por IP responde 429 com Retry-After", async () => {
    const { state, secret } = cenario();
    const app = appCom(state, 1);
    expect((await app.inject({ method: "GET", url: `/v1/public/tasks/${secret}` })).statusCode).toBe(200);
    const excedido = await app.inject({ method: "GET", url: `/v1/public/tasks/${secret}` });
    expect(excedido.statusCode).toBe(429);
    expect(excedido.headers["retry-after"]).toBeDefined();
  });
});
