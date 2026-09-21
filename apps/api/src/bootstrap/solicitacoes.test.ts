/**
 * `configurarSolicitacoes()` contra o Postgres real: `--dry-run` não grava
 * nada, `--apply` cria a Lista e a segunda execução é no-op, o limite sobe e
 * nenhuma Tarefa (nem seus Comentários embutidos) é tocada — a prova de
 * V02-01A/V02-01B contra o banco de verdade.
 *
 * Precisa de `DATABASE_URL` (`apps/api/.env` ou variável de ambiente); sem
 * ele, pula em vez de falhar (D-DEC-09, mesmo padrão de `gestao.test.ts`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CP } from "@n1/dominio/operations/financeiro";
import { createTask } from "@n1/dominio/operations/tasks";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";
import { bootstrapGestao } from "./gestao";
import { configurarSolicitacoes } from "./solicitacoes";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = "ws_solicitacoes_teste";
const AGORA = "2026-09-21T12:00:00.000Z";

async function contarLinhas(colecao?: string): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = colecao
      ? await cliente.query<{ n: string }>(
          "select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = $2",
          [WS, colecao],
        )
      : await cliente.query<{ n: string }>("select count(*)::text as n from plataforma.registros where workspace_id = $1", [WS]);
    return Number(r.rows[0]!.n);
  } finally {
    cliente.release();
  }
}

async function revisaoAtual(): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ revisao: string }>(
      "select revisao::text as revisao from plataforma.workspaces where workspace_id = $1",
      [WS],
    );
    return Number(r.rows[0]!.revisao);
  } finally {
    cliente.release();
  }
}

async function linhasDeTarefas(): Promise<unknown[]> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ dados: unknown }>(
      "select dados from plataforma.registros where workspace_id = $1 and colecao = 'tasks' order by id",
      [WS],
    );
    return r.rows.map((linha) => linha.dados);
  } finally {
    cliente.release();
  }
}

d("configurarSolicitacoes — o evolver de 'Solicitações de pagamento' contra o Postgres real", () => {
  beforeAll(async () => {
    const limpeza = await pool().connect();
    try {
      await limpeza.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await limpeza.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      limpeza.release();
    }

    // O evolver exige o bootstrap da Fase 1 já aplicado (Espaço "Gestão" ›
    // Pasta "Financeiro") — não é este arquivo que recria essa base.
    const bootstrap = await pool().connect();
    try {
      const resultado = await bootstrapGestao(bootstrap, { workspaceId: WS, agora: AGORA });
      expect(resultado.criado).toBe(true);
    } finally {
      bootstrap.release();
    }
  });

  afterAll(async () => {
    const limpeza = await pool().connect();
    try {
      await limpeza.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await limpeza.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      limpeza.release();
    }
    await encerrar();
  });

  it("(i) --dry-run não grava nada — revisão e contagem de linhas idênticas antes e depois", async () => {
    const linhasAntes = await contarLinhas();
    const revisaoAntes = await revisaoAtual();

    const resultado = await configurarSolicitacoes({ workspaceId: WS, actingMemberId: "mem_maryane", dryRun: true });
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);
    if (!resultado.ok) throw new Error("unreachable");
    expect(resultado.dryRun).toBe(true);
    expect(resultado.diff.criados.length).toBeGreaterThan(0);

    expect(await contarLinhas()).toBe(linhasAntes);
    expect(await revisaoAtual()).toBe(revisaoAntes);
  });

  it("(ii) --apply cria a Lista; a segunda execução é no-op com diff vazio", async () => {
    const primeiro = await configurarSolicitacoes({ workspaceId: WS, actingMemberId: "mem_maryane", dryRun: false });
    expect(primeiro.ok, primeiro.ok ? "" : primeiro.error).toBe(true);
    if (!primeiro.ok) throw new Error("unreachable");
    expect(primeiro.dryRun).toBe(false);
    expect(primeiro.diff.criados.length).toBeGreaterThan(0);

    const segundo = await configurarSolicitacoes({ workspaceId: WS, actingMemberId: "mem_maryane", dryRun: false });
    expect(segundo.ok, segundo.ok ? "" : segundo.error).toBe(true);
    if (!segundo.ok) throw new Error("unreachable");
    expect(segundo.diff.criados).toEqual([]);
    expect(segundo.diff.divergentes).toEqual([]);
  });

  it("(iii) depois do apply, hidratar() devolve workspace.limits.tasksPerList >= 5000", async () => {
    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      expect(state.workspace.limits.tasksPerList).toBeGreaterThanOrEqual(5000);
    } finally {
      cliente.release();
    }
  });

  it("(iv) o apply não altera nenhuma linha de 'tasks' (Tarefa e Comentários embutidos)", async () => {
    // `tasks` é a única coleção do domínio que carrega Comentário — embutido
    // em `Task.comments`, sem linha própria em `plataforma.registros` — então
    // conferir `colecao = 'tasks'` intacta prova as duas coisas de uma vez.
    const criacao = await executar(WS, (state) =>
      createTask(state, "mem_maryane", { listId: CP.listId, title: "Conta de teste — não tocar" }),
    );
    expect(criacao.ok, "ok" in criacao ? String((criacao as { error?: string }).error ?? "") : "conflito").toBe(true);

    const antes = await linhasDeTarefas();
    expect(antes.length).toBeGreaterThan(0);

    const resultado = await configurarSolicitacoes({ workspaceId: WS, actingMemberId: "mem_maryane", dryRun: false });
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);

    const depois = await linhasDeTarefas();
    expect(depois).toEqual(antes);
  });
});
