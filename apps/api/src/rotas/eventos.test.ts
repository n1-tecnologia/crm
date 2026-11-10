/**
 * `GET /eventos` (16-07, 3.8.3, MSG-03), sem banco: o hub é injetado e a autenticação é a dos stubs. Com `inject`, a
 * resposta só volta quando o fluxo termina, então os casos de fluxo usam `duracaoMaximaMs` curta; o caso do desligamento
 * escuta numa porta de verdade, porque é o `app.close()` com uma conexão aberta que ele mede.
 */

import { afterEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { criarHubDeEventos, type HubDeEventos } from "../mensageria/hub-de-eventos";
import type { OpcoesDeEventos } from "./eventos";

const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;
const AUTORIZACAO = { authorization: "Bearer token-ana" };

const hubDisponivel = (podeLer: () => Promise<boolean> = async () => true): HubDeEventos => {
  const hub = criarHubDeEventos({ podeLer });
  hub.definirDisponivel(true);
  return hub;
};

const abertos: FastifyInstance[] = [];

function montar(eventos: OpcoesDeEventos | undefined, estado: "ativo" | "suspenso" = "ativo") {
  const app = buildApp({
    logger: false,
    workspaceId: "ws_teste",
    verificarToken: async (token) => (token === "token-ana" ? { sub: "usuario-ana" } : null),
    resolverMembro: async (_workspaceId, userId) => (userId === "usuario-ana" ? { ...membroBase, id: "mem_ana", userId, state: estado } : undefined),
    ...(eventos ? { eventos } : {}),
  });
  abertos.push(app);
  return app;
}

afterEach(async () => {
  for (const app of abertos.splice(0)) await app.close();
});

describe("GET /eventos: quem abre e quando", () => {
  it("sem Authorization: 401; com token recusado: 401", async () => {
    const app = montar({ hub: hubDisponivel() });
    expect((await app.inject({ method: "GET", url: "/eventos" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/eventos", headers: { authorization: "Bearer outro" } })).statusCode).toBe(401);
  });

  it("sem hub injetado: 503 TEMPO_REAL_INDISPONIVEL", async () => {
    const resposta = await montar(undefined).inject({ method: "GET", url: "/eventos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({ ok: false, error: "O tempo real está indisponível agora.", codigo: "TEMPO_REAL_INDISPONIVEL" });
  });

  it("hub indisponível (o ouvinte LISTEN caiu): 503 TEMPO_REAL_INDISPONIVEL", async () => {
    const hub = criarHubDeEventos({ podeLer: async () => true });
    const resposta = await montar({ hub }).inject({ method: "GET", url: "/eventos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toMatchObject({ codigo: "TEMPO_REAL_INDISPONIVEL" });
  });

  it("Membro que o Papel não deixa ler Conversas (removido, Convidado): 403 e nenhum fluxo aberto", async () => {
    const hub = hubDisponivel(async () => false);
    const resposta = await montar({ hub }).inject({ method: "GET", url: "/eventos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "PERMISSAO" });
    expect(hub.assinantes).toBe(0);
  });

  it("o Membro suspenso consulta: o fluxo abre (GET é leitura)", async () => {
    const resposta = await montar({ hub: hubDisponivel(), duracaoMaximaMs: 60 }, "suspenso").inject({ method: "GET", url: "/eventos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
  });
});

describe("GET /eventos: o fluxo", () => {
  it("abre com `: aberto`, o evento do hub sai como data: sem o Espaço, e o fluxo fecha na duração máxima", async () => {
    const hub = hubDisponivel();
    const app = montar({ hub, duracaoMaximaMs: 250, batidaMs: 5_000 });
    setTimeout(() => {
      hub.publicar({ workspaceId: "ws_teste", tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" });
      hub.publicar({ workspaceId: "ws_de_outro", tipo: "mensagem.nova", conversaId: "c9", mensagemId: "m9" });
    }, 60);

    const resposta = await app.inject({ method: "GET", url: "/eventos", headers: AUTORIZACAO });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["content-type"]).toBe("text/event-stream; charset=utf-8");
    expect(resposta.headers["cache-control"]).toBe("no-cache, no-transform");
    expect(resposta.headers["x-accel-buffering"]).toBe("no");
    expect(resposta.body).toBe(': aberto\n\ndata: {"tipo":"mensagem.nova","conversaId":"c1","mensagemId":"m1"}\n\n');
    expect(hub.assinantes).toBe(0);
  });

  it("a batida injetada em 50 ms aparece como `: batida`", async () => {
    const app = montar({ hub: hubDisponivel(), batidaMs: 50, duracaoMaximaMs: 280 });
    const resposta = await app.inject({ method: "GET", url: "/eventos", headers: AUTORIZACAO });
    expect(resposta.body).toContain(": batida\n\n");
  });

  it("a duração máxima fecha o fluxo e tira a assinatura do hub", async () => {
    const hub = hubDisponivel();
    const inicio = Date.now();
    const resposta = await montar({ hub, duracaoMaximaMs: 200, batidaMs: 5_000 }).inject({ method: "GET", url: "/eventos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(Date.now() - inicio).toBeLessThan(2_000);
    expect(hub.assinantes).toBe(0);
  });

  it("o hub que encerra o fluxo (a 6ª aba, o Papel perdido) termina a resposta", async () => {
    const hub = hubDisponivel();
    const app = montar({ hub, duracaoMaximaMs: 5_000, batidaMs: 5_000 });
    setTimeout(() => hub.encerrarTodos(), 80);

    const resposta = await app.inject({ method: "GET", url: "/eventos", headers: AUTORIZACAO });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toBe(": aberto\n\n");
    expect(hub.assinantes).toBe(0);
  });
});

describe("GET /eventos: o desligamento (Pitfall 5)", () => {
  it("com um fluxo aberto, hub.encerrarTodos() seguido de app.close() termina em menos de 1 s", async () => {
    const hub = hubDisponivel();
    const app = buildApp({
      logger: false,
      workspaceId: "ws_teste",
      verificarToken: async () => ({ sub: "usuario-ana" }),
      resolverMembro: async (_workspaceId, userId) => ({ ...membroBase, id: "mem_ana", userId, state: "ativo" as const }),
      eventos: { hub },
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const { port } = app.server.address() as { port: number };
    const controle = new AbortController();
    const resposta = await fetch(`http://127.0.0.1:${port}/eventos`, { headers: AUTORIZACAO, signal: controle.signal });
    expect(resposta.status).toBe(200);
    const leitor = resposta.body!.getReader();
    expect(new TextDecoder().decode((await leitor.read()).value)).toBe(": aberto\n\n");
    expect(hub.assinantes).toBe(1);

    const inicio = Date.now();
    hub.encerrarTodos();
    await app.close();

    expect(Date.now() - inicio).toBeLessThan(1_000);
    controle.abort();
  });
});
