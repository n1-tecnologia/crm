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
import { runScheduledAutomations } from "@n1/dominio/operations/automations";
import { createTask } from "@n1/dominio/operations/tasks";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { bootstrapGestao } from "./gestao";
import { ajustarPrazosDeCobranca, configurarContasAReceber } from "./contas-a-receber";

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

const civil = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

d("ajustarPrazosDeCobranca — o prazo de R4/R5 vira parâmetro (D5-15) contra o Postgres real", () => {
  const WS2 = `${WS}_prazo`;

  beforeAll(async () => {
    const limpeza = await pool().connect();
    try {
      await limpeza.query("delete from plataforma.registros where workspace_id = $1", [WS2]);
      await limpeza.query("delete from plataforma.workspaces where workspace_id = $1", [WS2]);
    } finally {
      limpeza.release();
    }
    const bootstrap = await pool().connect();
    try {
      const resultado = await bootstrapGestao(bootstrap, { workspaceId: WS2, agora: AGORA });
      expect(resultado.criado).toBe(true);
    } finally {
      bootstrap.release();
    }
  });

  afterAll(async () => {
    const limpeza = await pool().connect();
    try {
      await limpeza.query("delete from plataforma.registros where workspace_id = $1", [WS2]);
      await limpeza.query("delete from plataforma.workspaces where workspace_id = $1", [WS2]);
    } finally {
      limpeza.release();
    }
    await encerrar();
  });

  async function temporalPredicateGravado(automationId: string): Promise<string | undefined> {
    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS2);
      const automacao = state.automations.find((a) => a.id === automationId);
      return automacao?.versions[0]?.trigger?.temporalPredicate;
    } finally {
      cliente.release();
    }
  }

  it("(iv) --dry-run não grava — o temporalPredicate no banco continua 30/60", async () => {
    const resultado = await ajustarPrazosDeCobranca({ workspaceId: WS2, actingMemberId: CP.financeiroId, dryRun: true, prazoR4: 45, prazoR5: 90 });
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);
    if (!resultado.ok) throw new Error("unreachable");
    expect(resultado.diff.r4).toEqual({ antes: 30, depois: 45 });
    expect(resultado.diff.r5).toEqual({ antes: 60, depois: 90 });

    expect(await temporalPredicateGravado("aut_cr_r4")).toBe(JSON.stringify({ dueDateOffsetDays: 30 }));
    expect(await temporalPredicateGravado("aut_cr_r5")).toBe(JSON.stringify({ dueDateOffsetDays: 60 }));
  });

  it("(v) prazoR5 <= prazoR4 recusa e não grava — nenhum temporalPredicate muda", async () => {
    const resultado = await ajustarPrazosDeCobranca({ workspaceId: WS2, actingMemberId: CP.financeiroId, dryRun: false, prazoR4: 60, prazoR5: 60 });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error("devia recusar");
    expect(resultado.error).toContain("escalonar");

    expect(await temporalPredicateGravado("aut_cr_r4")).toBe(JSON.stringify({ dueDateOffsetDays: 30 }));
    expect(await temporalPredicateGravado("aut_cr_r5")).toBe(JSON.stringify({ dueDateOffsetDays: 60 }));
  });

  it("(vi) --apply muda o temporalPredicate das duas Automações e grava Registro de Atividade com antes/depois", async () => {
    const resultado = await ajustarPrazosDeCobranca({ workspaceId: WS2, actingMemberId: CP.financeiroId, dryRun: false, prazoR4: 45, prazoR5: 90 });
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);
    if (!resultado.ok) throw new Error("unreachable");
    expect(resultado.diff.r4).toEqual({ antes: 30, depois: 45 });
    expect(resultado.diff.r5).toEqual({ antes: 60, depois: 90 });

    expect(await temporalPredicateGravado("aut_cr_r4")).toBe(JSON.stringify({ dueDateOffsetDays: 45 }));
    expect(await temporalPredicateGravado("aut_cr_r5")).toBe(JSON.stringify({ dueDateOffsetDays: 90 }));

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS2);
      const registro = [...state.activity].reverse().find((a) => a.objectId === "aut_cr_r4" && a.action === "Prazo de cobrança ajustado");
      expect(registro).toBeDefined();
      expect(registro!.before).toBe("30");
      expect(registro!.after).toBe("45");
    } finally {
      cliente.release();
    }
  });

  it("(vii) com o novo prazo aplicado, runScheduledAutomations dispara R4 no dia certo (teste de domínio puro, sem nova escrita)", async () => {
    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS2);
      // Depois de (vi), R4 = 45 dias. Uma Tarefa "pendente" vencida há
      // exatamente 45 dias dispara R4 hoje — a prova de que o prazo novo (não
      // o 30 do seed) é quem decide o dia do disparo.
      const hoje = new Date();
      const vencidaHa45 = new Date(hoje);
      vencidaHa45.setDate(vencidaHa45.getDate() - 45);
      const criacao = createTask(state, CP.financeiroId, {
        listId: CR.listId,
        title: "Conta de teste — R4 com novo prazo (05-10, Task 2)",
        statusId: CR.status.pendente,
        dueDate: { form: "civilDay", value: civil(vencidaHa45) },
      });
      expect(criacao.ok, criacao.ok ? "" : criacao.error).toBe(true);

      const execucao = runScheduledAutomations(state, CP.financeiroId, CR.listId, hoje);
      expect(execucao.ok, execucao.ok ? "" : execucao.error).toBe(true);
      if (!execucao.ok) throw new Error("unreachable");
      expect(execucao.value.executed).toBeGreaterThanOrEqual(1);
    } finally {
      cliente.release();
    }
  });
});
