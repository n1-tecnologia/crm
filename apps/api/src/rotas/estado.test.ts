/**
 * `GET /estado` — a carga inicial (D-04). Sem banco: só a checagem de que a
 * rota também exige sessão (o hook de autenticação já cobre 401/403 em
 * detalhe em `autenticacao.test.ts`). Com Postgres real: prova que o corpo
 * tem a forma exata que `apps/web/src/dados/transporte.ts` espera.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed, COLECOES, SINGULARES } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";

const MARYANE = usuarioDoSeed("mem_maryane");
const semente = buildSeed();
const membros = semente.members;

function appDeTeste(workspaceId: string) {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
  });
}

describe("GET /estado — sem banco", () => {
  it("sem token responde 401 (roda sempre, sem DATABASE_URL)", async () => {
    const resposta = await appDeTeste("ws_estado_teste").inject({ method: "GET", url: "/estado" });
    expect(resposta.statusCode).toBe(401);
  });
});

describe("GET /anexos/:fileId/url — sem banco", () => {
  it("sem token responde 401 (o hook de autenticação cobre toda rota deste módulo, Plan 02-19)", async () => {
    const resposta = await appDeTeste("ws_estado_teste").inject({ method: "GET", url: "/anexos/wf_qualquer/url" });
    expect(resposta.statusCode).toBe(401);
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_estado_teste";

d("GET /estado — contra o banco real", () => {
  const tarefa = semente.tasks.find((t) => t.listId === CP.listId);

  beforeAll(async () => {
    expect(tarefa, "o seed precisa ter alguma Tarefa de Contas a pagar").toBeDefined();
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

  it("devolve o Espaço inteiro, a revisão, as ordens e a sessão do Membro (D-04)", async () => {
    const resposta = await appDeTeste(WS).inject({
      method: "GET",
      url: "/estado",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();

    expect(corpo.sessao.memberId).toBe("mem_maryane");
    expect(typeof corpo.revisao).toBe("number");

    const chaves = Object.keys(corpo.data);
    for (const colecao of [...COLECOES, ...SINGULARES]) {
      expect(chaves).toContain(colecao);
    }

    expect(typeof corpo.ordens.tasks[tarefa!.id]).toBe("number");
    expect(corpo.data.tasks.length).toBe(semente.tasks.length);
  });

  it("GET /anexos/:fileId/url — Arquivo inexistente no Espaço responde 404 (Plan 02-19)", async () => {
    const resposta = await appDeTeste(WS).inject({
      method: "GET",
      url: "/anexos/wf_nao_existe/url",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(404);
  });
});
