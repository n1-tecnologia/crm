/**
 * 12.3.3 — o aceite do convite, de ponta a ponta contra o Postgres local. O
 * "Pronto quando" do plano: com o token de um Membro pendente, `GET /estado` dá
 * 403, `POST /convites/aceitar` dá 200, e o `GET /estado` seguinte dá 200 com o
 * Membro `ativo`.
 *
 * O Membro é resolvido pelo banco (`membroPorUsuario`), como em produção, e não
 * pela cópia em memória da fábrica de testes: é o que prova que o aceite ficou
 * gravado. Só Postgres local (`describeComBanco`).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { Member } from "@n1/dominio";
import { inviteMember } from "@n1/dominio/operations/members";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { encerrar, pool } from "../persistencia/conexao";
import { membroPorUsuario } from "../persistencia/membros";
import { semear } from "../persistencia/repositorio";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";

const TOKEN_DO_CONVIDADO = "token-convidado-12-3-3";

describeComBanco("POST /convites/aceitar — o pendente aceita e passa a ativo (12.3.3)", () => {
  let workspaceId: string;
  let app: FastifyInstance;
  let convidado: Member;

  beforeAll(async () => {
    await prepararBancoCrm();
    workspaceId = novoEspacoDeTeste("convites");
    const estado = buildSeed();
    const usuario = `usuario-convidado-${randomUUID()}`;
    const convite = inviteMember(estado, estado.workspace.ownerMemberId, { email: "convidada@tria.com.br", roleId: "role_mem", userId: usuario });
    if (!convite.ok) throw new Error(convite.error);
    convidado = convite.value;
    const cliente = await pool().connect();
    try {
      await semear(cliente, workspaceId, estado);
    } finally {
      cliente.release();
    }
    app = buildApp({
      logger: false,
      workspaceId,
      verificarToken: async (token) => (token === TOKEN_DO_CONVIDADO ? { sub: usuario } : null),
      resolverMembro: membroPorUsuario,
    });
  });

  afterAll(async () => {
    await app?.close();
    if (workspaceId) await limparEspaco(workspaceId);
    await encerrar();
  });

  const comToken = { authorization: `Bearer ${TOKEN_DO_CONVIDADO}` };

  it("antes do aceite, GET /estado dá 403 CONVITE_PENDENTE", async () => {
    const resposta = await app.inject({ method: "GET", url: "/estado", headers: comToken });
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(403);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "CONVITE_PENDENTE" });
  });

  it("POST /convites/aceitar dá 200, e o GET /estado seguinte dá 200 com o Membro ativo e o nome informado", async () => {
    const aceite = await app.inject({ method: "POST", url: "/convites/aceitar", headers: comToken, payload: { nome: "Convidada Nova" } });
    expect(aceite.statusCode, aceite.body.slice(0, 200)).toBe(200);
    expect(aceite.json()).toEqual({ ok: true });

    const estado = await app.inject({ method: "GET", url: "/estado", headers: comToken });
    expect(estado.statusCode, estado.body.slice(0, 200)).toBe(200);
    const membro = (estado.json() as { data: { members: Member[] } }).data.members.find((m) => m.id === convidado.id);
    expect(membro).toMatchObject({ state: "ativo", displayName: "Convidada Nova" });
    expect(membro?.invitedIdentity).toBeUndefined();
    expect(membro?.joinedAt).toBeTruthy();
  });

  it("aceitar de novo é recusado pelo domínio (400), e o corpo não escolhe quem aceita", async () => {
    const deNovo = await app.inject({ method: "POST", url: "/convites/aceitar", headers: comToken, payload: { nome: "Outra" } });
    expect(deNovo.statusCode).toBe(400);
    expect(deNovo.json().ok).toBe(false);
    const forjado = await app.inject({ method: "POST", url: "/convites/aceitar", headers: comToken, payload: { nome: "X", memberId: "mem_thiago" } });
    expect(forjado.statusCode).toBe(400);
  });
});
