/**
 * Entrada hostil em `POST /operacoes/:nome` (Fase 9, D-14 camada 1; T-09-81): corpo
 * grande, tipo de conteúdo errado, aninhamento além do que o reviver suporta e
 * `__proto__` nos argumentos. Todos voltam como 4xx, NUNCA 500, e nenhum chega ao
 * banco nem ao Sentry (o 500 é o único ramo que vai ao Sentry).
 *
 * Sem banco e sem `.env`: Membro ativo e token são stubs, `pool()` é trocado por uma
 * função que lança (se algum caso tocar o banco, o espião acusa), e a requisição é
 * `inject` contra o app deste processo.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Member } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";

const { poolEspiao } = vi.hoisted(() => ({
  poolEspiao: vi.fn(() => {
    throw new Error("a entrada hostil chegou ao banco");
  }),
}));

vi.mock("../persistencia/conexao", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("../persistencia/conexao")>()),
  pool: poolEspiao,
}));

const TOKEN = "token-ativo";

describe("POST /operacoes/trashContact com entrada hostil — 4xx, nunca 500, nunca o banco", () => {
  let app: FastifyInstance;
  const capturarErro = vi.fn();

  beforeAll(async () => {
    const base = buildSeed().members.find((m) => m.state === "ativo" && m.userId !== undefined);
    if (!base) throw new Error("o seed precisa de um Membro ativo com usuário");
    const membro: Member = { ...base, userId: "usuario-ativo", state: "ativo" };
    app = buildApp({
      logger: false,
      workspaceId: "ws_entrada_hostil",
      trustProxy: "",
      verificarToken: async (token) => (token === TOKEN ? { sub: "usuario-ativo" } : null),
      resolverMembro: async () => membro,
      capturarErro,
    });
    await app.ready();
  });

  afterEach(() => {
    expect(poolEspiao, "algum caso hostil chegou ao banco").not.toHaveBeenCalled();
    expect(capturarErro, "algum caso hostil virou erro 500 (e foi ao Sentry)").not.toHaveBeenCalled();
  });

  const postar = (payload: string, contentType = "application/json") =>
    app.inject({
      method: "POST",
      url: "/operacoes/trashContact",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": contentType },
      payload,
    });

  it("corpo JSON de 2 MiB: 413", async () => {
    const corpo = `{"args":["${"a".repeat(2 * 1024 * 1024)}"]}`;
    expect(corpo.length).toBeGreaterThan(2 * 1024 * 1024);
    const resposta = await postar(corpo);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(413);
    expect(resposta.json()).toMatchObject({ ok: false });
  });

  it("content-type text/plain: 415", async () => {
    const resposta = await postar('{"args":["ctt_1"]}', "text/plain");
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(415);
    expect(resposta.json()).toMatchObject({ ok: false });
  });

  it("content-type sem parser nenhum (x-www-form-urlencoded, xml): 415", async () => {
    for (const tipo of ["application/x-www-form-urlencoded", "application/xml"]) {
      const resposta = await postar("args=ctt_1", tipo);
      expect(resposta.statusCode, `${tipo}: ${resposta.body.slice(0, 200)}`).toBe(415);
    }
  });

  it("args aninhados 5.000 níveis (além do que o reviver suporta): 400", async () => {
    const profundidade = 5_000;
    const resposta = await postar(`{"args":[${"[".repeat(profundidade)}${"]".repeat(profundidade)}]}`);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(400);
    expect(resposta.json()).toMatchObject({ ok: false });
    // A mensagem é a única de "entrada inválida": nem stack, nem `RangeError`, nem a mensagem do motor.
    expect(resposta.body).not.toMatch(/RangeError|Maximum call stack|at \w+/);
  });

  it("__proto__ nos argumentos: 400, e o protótipo de Object não é poluído", async () => {
    const resposta = await postar('{"args":[{"__proto__":{"x":1}}]}');
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(400);
    expect(({} as Record<string, unknown>)["x"]).toBeUndefined();
  });

  it("constructor.prototype nos argumentos: 400 (a outra porta da poluição de protótipo)", async () => {
    const resposta = await postar('{"args":[{"constructor":{"prototype":{"y":1}}}]}');
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(400);
    expect(({} as Record<string, unknown>)["y"]).toBeUndefined();
  });

  it("JSON malformado: 400", async () => {
    const resposta = await postar('{"args":[');
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(400);
  });

  it("args que não é lista: 400 (a forma do corpo é validada antes de qualquer operação)", async () => {
    const resposta = await postar('{"args":"ctt_1"}');
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(400);
  });
});
