/**
 * 12.3.7 — suspender e reativar pela api, contra o Postgres local. O "Pronto
 * quando" do plano: o Membro suspenso recebe a resposta que a 12.1 decidiu
 * (12.1.5 B: sem acesso) em `GET /estado` e 403 em `POST /operacoes`;
 * reativado, volta a gravar.
 *
 * O Membro é resolvido pelo banco (`membroPorUsuario`), como em produção: a
 * suspensão gravada por uma chamada é o que barra a chamada seguinte.
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { encerrar, pool } from "../persistencia/conexao";
import { membroPorUsuario } from "../persistencia/membros";
import { semear } from "../persistencia/repositorio";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";

describeComBanco("suspender e reativar um Membro pela api (12.3.7, 12.1.5 B)", () => {
  let workspaceId: string;
  let app: FastifyInstance;
  let alvoId: string;
  const TOKEN_DONO = "token-dono-12-3-7";
  const TOKEN_ALVO = "token-alvo-12-3-7";

  beforeAll(async () => {
    await prepararBancoCrm();
    workspaceId = novoEspacoDeTeste("suspensao");
    const estado = buildSeed();
    const dono = estado.members.find((m) => m.id === estado.workspace.ownerMemberId)!;
    const alvo = estado.members.find((m) => m.id === "mem_julia")!;
    alvoId = alvo.id;
    const usuarios: Record<string, string | undefined> = { [TOKEN_DONO]: dono.userId, [TOKEN_ALVO]: alvo.userId };
    const cliente = await pool().connect();
    try {
      await semear(cliente, workspaceId, estado);
    } finally {
      cliente.release();
    }
    app = buildApp({
      logger: false,
      workspaceId,
      verificarToken: async (token) => (usuarios[token] ? { sub: usuarios[token]! } : null),
      resolverMembro: membroPorUsuario,
    });
  });

  afterAll(async () => {
    await app?.close();
    if (workspaceId) await limparEspaco(workspaceId);
    await encerrar();
  });

  const operacao = (token: string, nome: string, args: unknown[]) =>
    app.inject({ method: "POST", url: `/operacoes/${nome}`, headers: { authorization: `Bearer ${token}` }, payload: { args } });
  const estado = (token: string) => app.inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${token}` } });

  it("ativo, o Membro lê e grava", async () => {
    expect((await estado(TOKEN_ALVO)).statusCode).toBe(200);
    const gravou = await operacao(TOKEN_ALVO, "createChatFolder", [{ name: "Antes da suspensão" }]);
    expect(gravou.statusCode, gravou.body.slice(0, 200)).toBe(200);
    expect(gravou.json().ok).toBe(true);
  });

  it("suspenso pelo Proprietário: 403 SUSPENSO em GET /estado e em POST /operacoes", async () => {
    const suspensao = await operacao(TOKEN_DONO, "suspenderMembro", [alvoId]);
    expect(suspensao.statusCode, suspensao.body.slice(0, 200)).toBe(200);
    expect(suspensao.json().ok).toBe(true);

    const leitura = await estado(TOKEN_ALVO);
    expect(leitura.statusCode).toBe(403);
    expect(leitura.json()).toEqual({ ok: false, error: "Seu acesso foi suspenso.", codigo: "SUSPENSO" });

    const escrita = await operacao(TOKEN_ALVO, "createChatFolder", [{ name: "Durante a suspensão" }]);
    expect(escrita.statusCode).toBe(403);
    expect(escrita.json().codigo).toBe("SUSPENSO");
  });

  it("reativado, volta a ler e a gravar", async () => {
    const reativacao = await operacao(TOKEN_DONO, "reativarMembro", [alvoId]);
    expect(reativacao.statusCode, reativacao.body.slice(0, 200)).toBe(200);
    expect(reativacao.json().ok).toBe(true);

    expect((await estado(TOKEN_ALVO)).statusCode).toBe(200);
    const gravou = await operacao(TOKEN_ALVO, "createChatFolder", [{ name: "Depois da reativação" }]);
    expect(gravou.statusCode, gravou.body.slice(0, 200)).toBe(200);
    expect(gravou.json().ok).toBe(true);
  });
});
