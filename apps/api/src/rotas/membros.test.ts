/**
 * 12.3.2 — `POST /membros/:id/convite`, o reenvio do convite, contra o Postgres
 * local e com o Auth FALSO (nenhum e-mail sai, nenhum Usuário nasce no
 * Supabase). Prova: só quem governa reenvia, e sem falar com o Auth; o convite
 * da Sessão 12 é reenviado; o convite antigo, sem Usuário, ganha a conta criada
 * pelo reenvio; quem já criou a senha ou já tem conta não recebe e-mail.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { ActivityRecord, Member } from "@n1/dominio";
import { inviteMember } from "@n1/dominio/operations/members";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { ContaJaConfirmada, type AuthDeConvite } from "../autenticacao/auth-de-convite";
import { encerrar, pool } from "../persistencia/conexao";
import { membroPorUsuario } from "../persistencia/membros";
import { semear } from "../persistencia/repositorio";
import { AVISO_JA_CRIOU_SENHA, AVISO_JA_TEM_CONTA } from "../servicos/reenviar-convite";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";

const TOKEN_DONO = "token-dono-12-3-2";
const TOKEN_COMUM = "token-comum-12-3-2";

describeComBanco("POST /membros/:id/convite — reenviar o convite (12.3.2)", () => {
  let workspaceId: string;
  let app: FastifyInstance;
  const chamadas = { convidar: [] as string[], reenviar: [] as string[], apagar: [] as string[] };
  let confirmados = new Set<string>();
  const ids = { antigo: "", daSessao12: "", jaConfirmado: "", reconvidado: "" };
  const contaCriada = randomUUID();

  const auth: AuthDeConvite = {
    async convidar(email) {
      chamadas.convidar.push(email);
      return contaCriada;
    },
    async reenviar(email) {
      chamadas.reenviar.push(email);
      if (confirmados.has(email)) throw new ContaJaConfirmada("confirmada");
      return randomUUID();
    },
    async apagar(userId) {
      chamadas.apagar.push(userId);
    },
  };

  beforeAll(async () => {
    await prepararBancoCrm();
    workspaceId = novoEspacoDeTeste("reenvio");
    const estado = buildSeed();
    const dono = estado.members.find((m) => m.id === estado.workspace.ownerMemberId)!;
    const comum = estado.members.find((m) => m.id === "mem_julia")!;
    const convidar = (email: string, userId?: string): Member => {
      const r = inviteMember(estado, dono.id, { email, roleId: "role_mem", ...(userId ? { userId } : {}) });
      if (!r.ok) throw new Error(r.error);
      return r.value;
    };
    ids.antigo = convidar("antigo@empresa.com.br").id;
    ids.daSessao12 = convidar("novo@empresa.com.br", randomUUID()).id;
    ids.jaConfirmado = convidar("confirmou@empresa.com.br", randomUUID()).id;
    confirmados = new Set(["confirmou@empresa.com.br"]);
    // O removido reconvidado volta pendente com a conta dele e sem e-mail guardado (B27).
    const removido = estado.members.find((m) => m.state === "removido" && m.userId)!;
    const reconvite = inviteMember(estado, dono.id, { email: "voltou@empresa.com.br", roleId: "role_mem", userId: removido.userId! });
    if (!reconvite.ok) throw new Error(reconvite.error);
    ids.reconvidado = reconvite.value.id;

    const cliente = await pool().connect();
    try {
      await semear(cliente, workspaceId, estado);
    } finally {
      cliente.release();
    }
    const usuarios: Record<string, string | undefined> = { [TOKEN_DONO]: dono.userId, [TOKEN_COMUM]: comum.userId };
    app = buildApp({
      logger: false,
      workspaceId,
      verificarToken: async (token) => (usuarios[token] ? { sub: usuarios[token]! } : null),
      resolverMembro: membroPorUsuario,
      membros: { auth, resolverUsuario: async () => undefined },
    });
  });

  afterAll(async () => {
    await app?.close();
    if (workspaceId) await limparEspaco(workspaceId);
    await encerrar();
  });

  const reenviar = (token: string, memberId: string) =>
    app.inject({ method: "POST", url: `/membros/${memberId}/convite`, headers: { authorization: `Bearer ${token}` } });
  const estado = async () => {
    const r = await app.inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${TOKEN_DONO}` } });
    return (r.json() as { data: { members: Member[]; activity: ActivityRecord[] } }).data;
  };

  it("um Membro comum não reenvia, e o Auth nem é chamado", async () => {
    const resposta = await reenviar(TOKEN_COMUM, ids.daSessao12);
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toMatchObject({ convidar: [], reenviar: [] });
  });

  it("o convite da Sessão 12 (com Usuário) é reenviado pelo Auth, e o ato vai à Atividade", async () => {
    const resposta = await reenviar(TOKEN_DONO, ids.daSessao12);
    expect(resposta.statusCode, resposta.body).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, enviado: true });
    expect(chamadas.reenviar).toEqual(["novo@empresa.com.br"]);
    const dados = await estado();
    expect(dados.activity.some((a) => a.action === "Convite reenviado" && a.objectId === ids.daSessao12)).toBe(true);
  });

  it("o convite antigo, sem Usuário, ganha a conta criada pelo reenvio", async () => {
    const resposta = await reenviar(TOKEN_DONO, ids.antigo);
    expect(resposta.statusCode, resposta.body).toBe(200);
    expect(chamadas.convidar).toEqual(["antigo@empresa.com.br"]);
    const dados = await estado();
    expect(dados.members.find((m) => m.id === ids.antigo)).toMatchObject({ state: "pendente", userId: contaCriada });
    expect(chamadas.apagar).toEqual([]);
  });

  it("quem já criou a senha não recebe e-mail: 409 com a orientação", async () => {
    const resposta = await reenviar(TOKEN_DONO, ids.jaConfirmado);
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({ ok: false, error: AVISO_JA_CRIOU_SENHA });
  });

  it("o removido reconvidado (sem e-mail guardado) não recebe e-mail: 409 com a orientação", async () => {
    const antes = chamadas.reenviar.length + chamadas.convidar.length;
    const resposta = await reenviar(TOKEN_DONO, ids.reconvidado);
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({ ok: false, error: AVISO_JA_TEM_CONTA });
    expect(chamadas.reenviar.length + chamadas.convidar.length).toBe(antes);
  });

  it("um Membro ativo não tem convite a reenviar", async () => {
    const resposta = await reenviar(TOKEN_DONO, "mem_julia");
    expect(resposta.statusCode).toBe(400);
  });
});
