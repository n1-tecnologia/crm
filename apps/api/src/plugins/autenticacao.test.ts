/**
 * O hook de autenticação aplicado de verdade: sem token, 401; token de
 * alguém que não é Membro do Espaço, 403; Membro `removido`/`pendente`,
 * 403; Membro `ativo`, passa e chega em `request.membro` com o
 * `workspaceId` da configuração (T-1-02 — nunca o que o cliente mandaria).
 *
 * A parte sem banco roda sempre, injetando `verificarToken`/`resolverMembro`
 * (D-DEC-09) — nenhum destes casos precisa de `SUPABASE_*` nem de
 * `DATABASE_URL`. A parte com Postgres real prova `membroPorUsuario` contra
 * o banco e pula sem `DATABASE_URL`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { membroPorUsuario } from "../persistencia/membros";
import { semear } from "../persistencia/repositorio";

const MARYANE = usuarioDoSeed("mem_maryane"); // ativo, no seed do Financeiro
const TIAGO = usuarioDoSeed("mem_tiago"); // removido, no seed do CRM

const semente = buildSeed();
const membros = semente.members;

function appDeTeste() {
  const app = buildApp({
    logger: false,
    workspaceId: "ws_teste",
    verificarToken: async (token) =>
      token === "token-maryane"
        ? { sub: MARYANE }
        : token === "token-tiago"
          ? { sub: TIAGO }
          : token === "token-desconhecido"
            ? { sub: "00000000-0000-0000-0000-000000000000" }
            : null,
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
  });
  // Só existe neste teste: uma rota qualquer para ler o que o hook decorou.
  app.get("/quem-sou", async (request) => request.membro);
  return app;
}

describe("registrarAutenticacao — hook onRequest", () => {
  it("sem Authorization responde 401", async () => {
    const resposta = await appDeTeste().inject({ method: "GET", url: "/quem-sou" });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({ ok: false, error: "Sem sessão." });
  });

  it("Bearer lixo (token que não verifica) responde 401", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/quem-sou",
      headers: { authorization: "Bearer lixo" },
    });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({ ok: false, error: "Sessão inválida ou expirada." });
  });

  it("token válido cujo sub não é Membro do Espaço responde 403", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/quem-sou",
      headers: { authorization: "Bearer token-desconhecido" },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({
      ok: false,
      error: "Sua conta existe, mas não é Membro deste Espaço de Trabalho.",
    });
  });

  it("Membro removido responde 403 com a frase de encerrada", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/quem-sou",
      headers: { authorization: "Bearer token-tiago" },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({
      ok: false,
      error: "Sua participação neste Espaço de Trabalho foi encerrada.",
    });
  });

  it("Membro ativo passa: request.membro usa o workspaceId da configuração, não o do registro", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/quem-sou",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ id: "mem_maryane", workspaceId: "ws_teste", state: "ativo" });
  });

  it("GET /saude continua público mesmo com o hook registrado", async () => {
    const resposta = await appDeTeste().inject({ method: "GET", url: "/saude" });
    expect(resposta.statusCode).toBe(200);
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_membros_teste";

d("membroPorUsuario — contra o banco real", () => {
  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
      await semear(cliente, WS, semente);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it("acha o Membro pelo userId, numa consulta só", async () => {
    const membro = await membroPorUsuario(WS, MARYANE);
    expect(membro?.id).toBe("mem_maryane");
  });

  it("userId inexistente devolve undefined", async () => {
    const membro = await membroPorUsuario(WS, "00000000-0000-0000-0000-000000000000");
    expect(membro).toBeUndefined();
  });
});
