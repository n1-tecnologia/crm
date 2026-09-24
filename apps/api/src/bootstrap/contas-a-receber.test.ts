/**
 * `configurarContasAReceber()` contra o Postgres real: `--dry-run` não grava
 * nada, `--apply` cria/confere o que falta (nesta suíte a Lista já vem do
 * bootstrap da Fase 1, então a primeira volta é no-op) e a segunda execução
 * é no-op — a prova de 05-10/Task 1 contra o banco de verdade.
 *
 * Precisa de `DATABASE_URL` (`apps/api/.env` ou variável de ambiente); sem
 * ele, pula em vez de falhar (D-DEC-09, mesmo padrão de `solicitacoes.test.ts`).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CP, CR } from "@n1/dominio/operations/financeiro";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { bootstrapGestao } from "./gestao";
import { configurarContasAReceber } from "./contas-a-receber";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const RUN = `cr_configurar_${Date.now()}_${randomUUID().slice(0, 8)}`;
const WS = `ws_${RUN}`;
const AGORA = "2026-09-24T12:00:00.000Z";

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

d("configurarContasAReceber — o evolver de 'Contas a receber' contra o Postgres real", () => {
  beforeAll(async () => {
    const limpeza = await pool().connect();
    try {
      await limpeza.query("delete from plataforma.automacao_agenda where workspace_id = $1", [WS]);
      await limpeza.query("delete from plataforma.integration_outbox where workspace_id = $1", [WS]);
      await limpeza.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await limpeza.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      limpeza.release();
    }

    // O evolver exige o bootstrap da Fase 1 já aplicado — e esse bootstrap já
    // chama `applyContasAReceber(..., { fixtures: false })`, então a Lista
    // "Contas a receber" já nasce configurada (D5-02b): a primeira volta
    // deste evolver sobre um Espaço recém-bootstrapado é no-op por desenho,
    // exatamente o que `05-CONFERENCIA-WS-N1.md` mediu contra `ws_n1`.
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
      await limpeza.query("delete from plataforma.automacao_agenda where workspace_id = $1", [WS]);
      await limpeza.query("delete from plataforma.integration_outbox where workspace_id = $1", [WS]);
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

    const resultado = await configurarContasAReceber({ workspaceId: WS, actingMemberId: CP.financeiroId, dryRun: true });
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);
    if (!resultado.ok) throw new Error("unreachable");
    expect(resultado.dryRun).toBe(true);
    // O bootstrap da Fase 1 já aplicou o catálogo — nada a criar, mas o
    // dry-run PRECISA calcular o diff mesmo assim (é a prova de que a
    // conferência acontece, não só uma checagem de existência).
    expect(resultado.diff.criados).toEqual([]);
    expect(resultado.diff.divergentes).toEqual([]);
    expect(resultado.diff.conferidos.length).toBeGreaterThan(0);

    expect(await contarLinhas()).toBe(linhasAntes);
    expect(await revisaoAtual()).toBe(revisaoAntes);
  });

  it("(ii) --apply sobre a Lista já bootstrapada é no-op; a segunda execução continua com diff vazio", async () => {
    const primeiro = await configurarContasAReceber({ workspaceId: WS, actingMemberId: CP.financeiroId, dryRun: false });
    expect(primeiro.ok, primeiro.ok ? "" : primeiro.error).toBe(true);
    if (!primeiro.ok) throw new Error("unreachable");
    expect(primeiro.diff.criados).toEqual([]);
    expect(primeiro.diff.divergentes).toEqual([]);

    const segundo = await configurarContasAReceber({ workspaceId: WS, actingMemberId: CP.financeiroId, dryRun: false });
    expect(segundo.ok, segundo.ok ? "" : segundo.error).toBe(true);
    if (!segundo.ok) throw new Error("unreachable");
    expect(segundo.diff.criados).toEqual([]);
    expect(segundo.diff.divergentes).toEqual([]);
  });

  it("(iii) uma divergência real (Status adulterado no banco) é recusada e não sobrescrita", async () => {
    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const lista = state.lists.find((l) => l.id === CR.listId);
      expect(lista).toBeDefined();
      const estornado = lista!.statusSet!.definitions.find((s) => s.id === CR.status.estornado);
      expect(estornado).toBeDefined();
      await cliente.query(
        `update plataforma.registros
            set dados = jsonb_set(dados, '{statusSet,definitions}',
              (select jsonb_agg(case when elem->>'id' = $3 then jsonb_set(elem, '{entryFromStatusIds}', $4::jsonb) else elem end)
                 from jsonb_array_elements(dados->'statusSet'->'definitions') elem))
          where workspace_id = $1 and colecao = 'lists' and id = $2`,
        [WS, CR.listId, CR.status.estornado, JSON.stringify([CR.status.paraReceber])],
      );
    } finally {
      cliente.release();
    }

    const resultado = await configurarContasAReceber({ workspaceId: WS, actingMemberId: CP.financeiroId, dryRun: false });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error("devia recusar por divergência");
    expect(resultado.error).toContain(CR.status.estornado);

    // Nada foi sobrescrito — a adulteração continua no banco.
    const { state: depois } = await (async () => {
      const cliente = await pool().connect();
      try {
        return await hidratar(cliente, WS);
      } finally {
        cliente.release();
      }
    })();
    const listaDepois = depois.lists.find((l) => l.id === CR.listId);
    const estornadoDepois = listaDepois!.statusSet!.definitions.find((s) => s.id === CR.status.estornado);
    expect(estornadoDepois!.entryFromStatusIds).toEqual([CR.status.paraReceber]);

    // Desfaz a adulteração para não vazar para os próximos testes deste arquivo.
    const limpeza = await pool().connect();
    try {
      await limpeza.query(
        `update plataforma.registros
            set dados = jsonb_set(dados, '{statusSet,definitions}',
              (select jsonb_agg(case when elem->>'id' = $3 then jsonb_set(elem, '{entryFromStatusIds}', $4::jsonb) else elem end)
                 from jsonb_array_elements(dados->'statusSet'->'definitions') elem))
          where workspace_id = $1 and colecao = 'lists' and id = $2`,
        [WS, CR.listId, CR.status.estornado, JSON.stringify([CR.status.recebido])],
      );
    } finally {
      limpeza.release();
    }
  });
});
