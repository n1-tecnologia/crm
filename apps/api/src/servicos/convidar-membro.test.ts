/**
 * `convidarMembro` — o serviço que compõe `resolverUsuarioPorEmail` +
 * `inviteMember` dentro da Unidade de Trabalho (PERS-09). Os casos (a)/(b)
 * usam um `deps.resolverUsuario` FALSO para não depender do Auth aqui — a
 * integração real com o Auth é `autenticacao/resolver-usuario.test.ts`. O
 * caso (c) passa pela ROTA, onde o resolvedor é sempre o real (a rota nunca
 * injeta `deps`) — só roda com `SUPABASE_*` E `DATABASE_URL` configurados.
 * O caso (d) é validação pura, sem banco. O caso (e) reproduz o cenário CR-01
 * do `01-REVIEW.md` (convite antes da conta no Auth, conta criada depois,
 * reconvite) pelo serviço, contra o Postgres: prova que o segundo convite
 * recusa em vez de criar um segundo Membro — o serviço não mudou; o domínio
 * (Plan 01-10, Task 1) é que passou a casar `existing` pelos dois critérios.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar, semear } from "../persistencia/repositorio";
import type { ResolverUsuario } from "../autenticacao/resolver-usuario";
import { convidarMembro } from "./convidar-membro";

const TIAGO_USER = usuarioDoSeed("mem_tiago"); // removido no seed do CRM
const THIAGO_USER = usuarioDoSeed("mem_thiago"); // ativo, Proprietário

// Stub sem I/O: só conhece o e-mail do Tiago, como o Auth real conheceria.
const resolverFalso: ResolverUsuario = async (email) =>
  email.trim().toLowerCase() === "tiago@n1.teste" ? TIAGO_USER : undefined;

describe("POST /operacoes/inviteMember — sem banco", () => {
  it("(d) corpo sem email/roleId responde 400, nunca 500", async () => {
    const semente = buildSeed();
    const thiago = semente.members.find((m) => m.id === "mem_thiago")!;
    const app = buildApp({
      logger: false,
      workspaceId: "ws_convite_sem_banco",
      verificarToken: async (token) => (token === "token-thiago" ? { sub: THIAGO_USER } : null),
      resolverMembro: async () => thiago,
    });

    const resposta = await app.inject({
      method: "POST",
      url: "/operacoes/inviteMember",
      headers: { authorization: "Bearer token-thiago" },
      payload: { args: [{}] },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const temAuth = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const d = temBanco ? describe : describe.skip;

const WS = "ws_convite_teste";

d("convidarMembro — contra o banco real, resolvedor falso", () => {
  const semente = buildSeed();

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

  it("(a) e-mail resolvido por userId reativa o MESMO mem_tiago, sem criar um segundo", async () => {
    const resultado = await convidarMembro(
      { workspaceId: WS, actingMemberId: "mem_thiago", email: "tiago@n1.teste", roleId: "role_mem" },
      { resolverUsuario: resolverFalso },
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error("deveria reconvidar");
    expect(resultado.value.id).toBe("mem_tiago");

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      expect(state.members.length).toBe(semente.members.length);
      expect(state.members.find((m) => m.id === "mem_tiago")?.state).toBe("pendente");
    } finally {
      cliente.release();
    }
  });

  it("(b) e-mail sem conta no Auth cria um Membro novo pendente por invitedIdentity", async () => {
    const resultado = await convidarMembro(
      { workspaceId: WS, actingMemberId: "mem_thiago", email: "sememAuth@empresa.com.br", roleId: "role_mem" },
      { resolverUsuario: resolverFalso },
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error("deveria convidar");
    expect(resultado.value.state).toBe("pendente");
    expect(resultado.value.userId).toBeUndefined();
    expect(resultado.value.invitedIdentity?.value).toBe("sememauth@empresa.com.br");
  });

  const ANA_USER = "22222222-2222-2222-2222-222222222222"; // não existe em USUARIOS_DO_SEED
  const resolverSemConta: ResolverUsuario = async () => undefined;
  const resolverComConta: ResolverUsuario = async (email) =>
    email.trim().toLowerCase() === "ana@n1.teste" ? ANA_USER : undefined;

  it("(e) convite sem conta no Auth, conta criada depois: o reconvite com userId resolvido recusa e não cria um segundo Membro", async () => {
    const pedido = {
      workspaceId: WS,
      actingMemberId: "mem_thiago",
      email: "ana@n1.teste",
      roleId: "role_mem",
    };

    const primeiro = await convidarMembro(pedido, { resolverUsuario: resolverSemConta });

    expect(primeiro.ok).toBe(true);
    if (!primeiro.ok) throw new Error("deveria convidar");
    expect(primeiro.value.state).toBe("pendente");
    expect(primeiro.value.userId).toBeUndefined();
    expect(primeiro.value.invitedIdentity?.value).toBe("ana@n1.teste");

    let antes: number;
    const clienteAntes = await pool().connect();
    try {
      const { state } = await hidratar(clienteAntes, WS);
      antes = state.members.length;
    } finally {
      clienteAntes.release();
    }

    // A conta da Ana foi criada no Auth entre os dois convites — o e-mail
    // agora resolve um userId.
    const segundo = await convidarMembro(pedido, { resolverUsuario: resolverComConta });

    expect(segundo.ok).toBe(false);
    if (segundo.ok) throw new Error("deveria recusar");
    expect(segundo.error).toContain("convite pendente");
    expect("conflito" in segundo).toBe(false);

    const clienteDepois = await pool().connect();
    try {
      const { state } = await hidratar(clienteDepois, WS);
      expect(state.members.length).toBe(antes);
      expect(state.members.filter((m) => m.invitedIdentity?.value === "ana@n1.teste").length).toBe(1);
    } finally {
      clienteDepois.release();
    }
  });
});

const WS2 = "ws_convite_rota_teste";

d("POST /operacoes/inviteMember — contra o banco real, resolvedor real do Auth", () => {
  const semente = buildSeed();

  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS2]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS2]);
      await semear(cliente, WS2, semente);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS2]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS2]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  const rodar = temAuth ? it : it.skip;
  const titulo = temAuth
    ? "(c) userId forjado no corpo é ignorado — a rota resolve pelo Auth real e reativa mem_tiago"
    : "(c) pulado: sem SUPABASE_URL/SUPABASE_SECRET_KEY para resolver o e-mail contra o Auth real";

  rodar(
    titulo,
    async () => {
      const app = buildApp({
        logger: false,
        workspaceId: WS2,
        verificarToken: async (token) => (token === "token-thiago" ? { sub: THIAGO_USER } : null),
        resolverMembro: async (_workspaceId, userId) => semente.members.find((m) => m.userId === userId),
      });

      const resposta = await app.inject({
        method: "POST",
        url: "/operacoes/inviteMember",
        headers: { authorization: "Bearer token-thiago" },
        payload: { args: [{ email: "tiago@n1.teste", roleId: "role_mem", userId: "uuid-forjado" }] },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.ok).toBe(true);
      expect(corpo.value.id).toBe("mem_tiago");
      expect(corpo.value.userId).not.toBe("uuid-forjado");
    },
  );
});
