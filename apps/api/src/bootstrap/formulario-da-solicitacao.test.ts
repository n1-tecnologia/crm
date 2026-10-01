/**
 * Checklist 1.8 — `criarFormularioDaSolicitacao()` contra o Postgres real:
 * recusa sem o configurador (o "Centro de Custo" de Contas a pagar ainda na
 * Lista); `--dry-run` não grava; `--apply` cria uma vez e a segunda execução
 * não muda nada. Precisa de `DATABASE_URL`; sem ele, pula (D-DEC-09).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { criarFormularioDaSolicitacao } from "./formulario-da-solicitacao";
import { bootstrapGestao } from "./gestao";
import { configurarSolicitacoes } from "./solicitacoes";

carregarEnv();
const d = process.env.DATABASE_URL ? describe : describe.skip;

const WS = `ws_formulario_teste_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MARYANE = "mem_maryane";

async function limpar(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
  } finally {
    cliente.release();
  }
}

async function formularios(): Promise<number> {
  const cliente = await pool().connect();
  try {
    return (await hidratar(cliente, WS)).state.forms.length;
  } finally {
    cliente.release();
  }
}

d("criarFormularioDaSolicitacao — contra o Postgres real", () => {
  beforeAll(async () => {
    await limpar();
    const cliente = await pool().connect();
    try {
      await bootstrapGestao(cliente, { workspaceId: WS, agora: "2026-10-01T12:00:00.000Z" });
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    await limpar();
    await encerrar();
  });

  it("sem a Lista configurada, recusa e não grava", async () => {
    const r = await criarFormularioDaSolicitacao({ workspaceId: WS, actingMemberId: MARYANE, dryRun: false });
    expect(r.ok).toBe(false);
    expect(await formularios()).toBe(0);
  });

  it("--dry-run mostra o que criaria e não grava; --apply cria uma vez; de novo, nada muda", async () => {
    const configurado = await configurarSolicitacoes({ workspaceId: WS, actingMemberId: MARYANE, dryRun: false });
    expect(configurado.ok, configurado.ok ? "" : configurado.error).toBe(true);

    const ensaio = await criarFormularioDaSolicitacao({ workspaceId: WS, actingMemberId: MARYANE, dryRun: true });
    expect(ensaio).toMatchObject({ ok: true, dryRun: true, criado: true });
    expect(await formularios()).toBe(0);

    const criado = await criarFormularioDaSolicitacao({ workspaceId: WS, actingMemberId: MARYANE, dryRun: false });
    expect(criado).toMatchObject({ ok: true, dryRun: false, criado: true });
    expect(await formularios()).toBe(1);

    const de_novo = await criarFormularioDaSolicitacao({ workspaceId: WS, actingMemberId: MARYANE, dryRun: false });
    expect(de_novo).toMatchObject({ ok: true, criado: false, formId: criado.ok ? criado.formId : "" });
    expect(await formularios()).toBe(1);
  });
});
