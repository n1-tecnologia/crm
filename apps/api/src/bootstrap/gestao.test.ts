/**
 * `bootstrapGestao()` contra o Postgres real: hidratado ≡ `buildGestaoBootstrap()`,
 * a Maryane cria uma Conta a pagar de verdade, e rodar duas vezes não duplica
 * nem apaga nada — a guarda de "Espaço vazio" é a prova de PERS-06.
 *
 * Precisa de `DATABASE_URL` (`apps/api/.env` ou variável de ambiente); sem
 * ele, pula em vez de falhar (D-DEC-09).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";
import { CP } from "@n1/dominio/operations/financeiro";
import { createTask } from "@n1/dominio/operations/tasks";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";
import { bootstrapGestao } from "./gestao";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = "ws_bootstrap_teste";
const AGORA = "2026-09-16T12:00:00.000Z";

async function contarLinhas(): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ n: string }>(
      "select count(*)::text as n from plataforma.registros where workspace_id = $1",
      [WS],
    );
    return Number(r.rows[0]!.n);
  } finally {
    cliente.release();
  }
}

d("bootstrapGestao — o Espaço 'Gestão' de produção", () => {
  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
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

  it("primeira execução cria; hidratado ≡ buildGestaoBootstrap()", async () => {
    const cliente = await pool().connect();
    let resultado;
    try {
      resultado = await bootstrapGestao(cliente, { workspaceId: WS, agora: AGORA });
    } finally {
      cliente.release();
    }
    expect(resultado.criado).toBe(true);
    expect(resultado.gravados).toBeGreaterThan(0);

    const cliente2 = await pool().connect();
    try {
      const { state, revisao } = await hidratar(cliente2, WS);
      expect(state.tasks.length).toBe(0);
      expect(state.contacts.length).toBe(0);
      expect(state.activity.length).toBe(0);
      expect(state.members.length).toBe(1);
      expect(state.members[0]!.id).toBe("mem_maryane");
      expect(state.members[0]!.roleId).toBe("role_prop");
      expect(state.lists.some((l) => l.id === CP.listId)).toBe(true);
      expect(revisao).toBe(1);

      // A prova hidratado ≡ bootstrap, no espírito de persistencia.test.ts.
      const esperado = buildGestaoBootstrap({ workspaceId: WS, agora: AGORA });
      expect(state).toStrictEqual(esperado);
    } finally {
      cliente2.release();
    }
  });

  it("segunda execução não grava — Espaço não está mais vazio", async () => {
    const antes = await contarLinhas();
    const cliente = await pool().connect();
    let resultado;
    try {
      resultado = await bootstrapGestao(cliente, { workspaceId: WS, agora: AGORA });
    } finally {
      cliente.release();
    }
    expect(resultado.criado).toBe(false);
    expect(resultado.motivo).toBeDefined();
    expect(await contarLinhas()).toBe(antes);
  });

  it("a Maryane cria uma Conta a pagar contra o banco de verdade", async () => {
    const r = await executar(WS, (s) => createTask(s, "mem_maryane", { listId: CP.listId, title: "Conta criada no teste" }));
    expect(r.ok, "ok" in r ? String((r as { error?: string }).error) : "").toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      expect(state.tasks.length).toBe(1);
      expect(state.tasks[0]!.title).toBe("Conta criada no teste");
    } finally {
      cliente.release();
    }
  });
});
