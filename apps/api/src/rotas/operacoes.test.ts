/**
 * `POST /operacoes/:nome` — a rota genérica sobre `executar()`.
 *
 * A parte sem banco roda sempre (D-DEC-09), injetando `verificarToken`/
 * `resolverMembro` como `autenticacao.test.ts` já faz: prova o despacho por
 * `OPERACOES` (404 fora do registro, `__proto__` nunca resolve), 401/400,
 * sem depender de `DATABASE_URL`. A parte com Postgres real prova o caminho
 * inteiro — sucesso com diff, recusa do domínio em 200, Membro removido em
 * 403 — contra `apps/api/src/persistencia/unidade-de-trabalho.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";

const MARYANE = usuarioDoSeed("mem_maryane"); // ativo, no seed do Financeiro
const TIAGO = usuarioDoSeed("mem_tiago"); // removido, no seed do CRM

const semente = buildSeed();
const membros = semente.members;

function appDeTeste(workspaceId = "ws_rotas_teste") {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) =>
      token === "token-maryane"
        ? { sub: MARYANE }
        : token === "token-tiago"
          ? { sub: TIAGO }
          : null,
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
  });
}

describe("POST /operacoes/:nome — sem banco", () => {
  it("(a) nome fora do registro responde 404", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/naoExiste",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().ok).toBe(false);
  });

  it("(b) um helper que não é caso de uso (nextId) responde 404 — não está em OPERACOES", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/nextId",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(404);
  });

  it("(c) __proto__ nunca resolve por herança de protótipo — 404 ou 400, nunca 200/500", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/__proto__",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect([400, 404]).toContain(resposta.statusCode);
    expect(resposta.json().ok).toBe(false);
  });

  it("(d) sem token responde 401", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(401);
  });

  it("(e) corpo sem args responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: {},
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(f) args que não é array responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: "x" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_rotas_teste";

d("POST /operacoes/:nome — contra o banco real", () => {
  const tarefaDeContasAPagar = semente.tasks.find(
    (t) => t.listId === CP.listId && t.statusId === CP.status.paraPagar,
  );

  beforeAll(async () => {
    expect(tarefaDeContasAPagar, "o seed precisa ter uma conta em 'para pagar'").toBeDefined();
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

  it("(g) addTaskComment com o Membro da sessão grava e devolve o diff (D-03)", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/addTaskComment",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { content: "Comentário pela rota." }] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.diferenca.gravados.length).toBeLessThanOrEqual(4);
    expect(corpo.diferenca.gravados.some((g: { colecao: string }) => g.colecao === "tasks")).toBe(true);
    expect(corpo.revisao).toBe(corpo.revisaoAnterior + 1);
    expect(corpo.value.content).toBe("Comentário pela rota.");
  });

  it("(h) recusa do domínio (RN-CP-04) responde 200 com ok:false e diff vazio", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/changeTaskStatus",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, CP.status.pago] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(typeof corpo.error).toBe("string");
    expect(corpo.error.length).toBeGreaterThan(0);
    expect(corpo.diferenca.gravados.length).toBe(0);
  });

  it("(i) runScheduledAutomations revive o marcador de Date — nunca 400/500", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/runScheduledAutomations",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [CP.listId, { $tipo: "Date", iso: new Date().toISOString() }] },
    });
    expect(resposta.statusCode).toBe(200);
    expect(typeof resposta.json().ok).toBe("boolean");
  });

  it("(j) Membro removido (Tiago) responde 403 antes de qualquer execução", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/addTaskComment",
      headers: { authorization: "Bearer token-tiago" },
      payload: { args: [tarefaDeContasAPagar!.id, { content: "Não deveria gravar." }] },
    });
    expect(resposta.statusCode).toBe(403);
  });
});
