/**
 * WR-11 (05-13 Task 3) — a barreira estrutural que impede um gatilho
 * temporal (R2/R4/R5) de alcançar o passado de uma Tarefa importada por
 * `importarContaAReceberHistorica`. Usa as Automações REAIS do catálogo
 * (`buildGestaoBootstrap`, que monta `applyContasAReceber(state, clock,
 * { fixtures: false })` — mesmo bootstrap de `importacao-contas-a-receber.test.ts`),
 * nunca uma Automação de brinquedo: a prova precisa ser sobre R2/R4/R5 de
 * verdade, não sobre uma condição temporal inventada só para o teste.
 *
 * `importarContaAReceberHistorica` grava `provenance.at` com o instante REAL
 * da chamada (`new Date().toISOString()`, não injetável) — por isso cada
 * teste importa a conta e, depois, substitui a Tarefa em `state.tasks` com
 * `provenance.at` fixo, para o resultado não depender do dia em que a suíte
 * roda.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import type { DataState } from "../state";
import type { Id, Instant, Task } from "../types";
import { runScheduledAutomations } from "./automations";
import { CP, CR } from "./financeiro";
import { createTask } from "./tasks";
import { importarContaAReceberHistorica, type EntradaDeContaAReceberHistorica } from "./importacao-contas-a-receber";

const AGORA = "2026-09-24T12:00:00.000Z";
const OPERADOR: Id = "mem_maryane";

/** O instante fixo da "importação" nestes testes — dia civil 2026-09-24, o mesmo do MARCO_ZERO real (05-11). */
const IMPORTADO_EM: Instant = "2026-09-24T15:27:44.000Z";

function entradaBase(overrides: Partial<EntradaDeContaAReceberHistorica> = {}): EntradaDeContaAReceberHistorica {
  const criadaEm = overrides.criadaEm ?? "2025-01-05T10:00:00.000Z";
  return {
    legacyTaskId: "hist_wr11_default",
    titulo: "Parcela importada (WR-11)",
    statusFinalId: CR.status.paraReceber,
    criadaEm,
    transicoes: [{ em: criadaEm, statusId: CR.status.paraReceber, nomeLegado: "para receber" }],
    campos: {
      [CP.fields.centroDeCusto]: "Marcos Paulo",
      [CR.fields.tipo]: CR.tipos.parcela,
      [CR.fields.numeroParcela]: 1,
      [CP.fields.valor]: 15000,
    },
    lacunas: [],
    ...overrides,
  };
}

/** Substitui `provenance.at` da Tarefa (que nasceu com o relógio real) por um instante fixo. */
function fixarProvenanceAt(state: DataState, taskId: Id, at: Instant): void {
  const indice = state.tasks.findIndex((t) => t.id === taskId);
  if (indice === -1) throw new Error(`fixture: Tarefa ${taskId} não encontrada`);
  const task = state.tasks[indice]!;
  if (!task.provenance) throw new Error(`fixture: Tarefa ${taskId} não tem provenance`);
  state.tasks[indice] = { ...task, provenance: { ...task.provenance, at } };
}

function tarefa(state: DataState, taskId: Id): Task {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t) throw new Error(`sem ${taskId}`);
  return t;
}

let state: DataState;
beforeEach(() => {
  state = buildGestaoBootstrap({ agora: AGORA });
});

describe("WR-11 — runScheduledAutomations não alcança o passado de uma Tarefa importada", () => {
  it("(a) “para receber” vencida em 2025, importada em 2026-09-24: R2 NÃO executa na agenda de 2026-09-25, Status inalterado", () => {
    // As Automações precisam estar de verdade lá — senão "zero Execuções" não prova nada.
    expect(state.automations.filter((a) => a.scopeId === CR.listId && a.lifecycle === "ativo").length).toBeGreaterThanOrEqual(6);

    const importacao = importarContaAReceberHistorica(
      state,
      OPERADOR,
      entradaBase({ legacyTaskId: "hist_wr11_a", vencimento: { form: "civilDay", value: "2025-03-01" } }),
    );
    expect(importacao.ok, importacao.ok ? "" : importacao.error).toBe(true);
    if (!importacao.ok) throw new Error("unreachable");
    fixarProvenanceAt(state, importacao.value.id, IMPORTADO_EM);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    const r = runScheduledAutomations(state, OPERADOR, CR.listId, new Date(2026, 8, 25));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.executed).toBe(0);
    expect(r.value.skipped).toBeGreaterThanOrEqual(1);

    const novas = state.automationExecutions.filter((e) => !idsAntes.has(e.id));
    expect(novas).toHaveLength(0);
    expect(tarefa(state, importacao.value.id).statusId).toBe(CR.status.paraReceber);
  });

  it("(b) “pendente” vencida em 2025-01-10, importada em 2026-09-24: R4 e R5 NÃO executam, zero Comentários novos", () => {
    const importacao = importarContaAReceberHistorica(
      state,
      OPERADOR,
      entradaBase({
        legacyTaskId: "hist_wr11_b",
        statusFinalId: CR.status.pendente,
        vencimento: { form: "civilDay", value: "2025-01-10" },
        transicoes: [
          { em: "2025-01-05T10:00:00.000Z", statusId: CR.status.paraReceber, nomeLegado: "para receber" },
          { em: "2025-02-15T10:00:00.000Z", statusId: CR.status.pendente, nomeLegado: "pendente" },
        ],
      }),
    );
    expect(importacao.ok, importacao.ok ? "" : importacao.error).toBe(true);
    if (!importacao.ok) throw new Error("unreachable");
    fixarProvenanceAt(state, importacao.value.id, IMPORTADO_EM);

    const comentariosAntes = tarefa(state, importacao.value.id).comments.length;
    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    const r = runScheduledAutomations(state, OPERADOR, CR.listId, new Date(2026, 8, 25));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.executed).toBe(0);

    const novas = state.automationExecutions.filter((e) => !idsAntes.has(e.id) && (e.automationId === "aut_cr_r4" || e.automationId === "aut_cr_r5"));
    expect(novas).toHaveLength(0);
    expect(tarefa(state, importacao.value.id).comments.length).toBe(comentariosAntes);
  });

  it("(c) controle — a MESMA conta, nascida SEM proveniência de importação (createTask): R2 executa normalmente", () => {
    // Vencimento perto de "hoje" (5 dias antes) de propósito: só o disparo de
    // R2 (offset +1) já passou — R4 (+30) e R5 (+60) ainda não, então o R2
    // mudar o Status para "pendente" (mutação em `task.statusId`, verificada
    // por leitura de `changeTaskStatus`) não faz a MESMA rodada cascatear
    // para R4/R5 só porque a condição de Status passou a bater — o que
    // provaria menos sobre WR-11 e mais sobre esse efeito preexistente.
    const criada = createTask(
      state,
      OPERADOR,
      {
        listId: CR.listId,
        title: "Parcela sem importação (controle WR-11)",
        taskTypeId: CP.taskTypeId,
        dueDate: { form: "civilDay", value: "2026-09-20" },
      },
      { runAutomations: false },
    );
    expect(criada.ok, criada.ok ? "" : criada.error).toBe(true);
    if (!criada.ok) throw new Error("unreachable");
    expect(tarefa(state, criada.value.id).provenance).toBeUndefined();

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    const r = runScheduledAutomations(state, OPERADOR, CR.listId, new Date(2026, 8, 25));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.executed).toBe(1);

    const novas = state.automationExecutions.filter((e) => !idsAntes.has(e.id) && e.objectId === criada.value.id);
    expect(novas.filter((e) => e.automationId === "aut_cr_r2")).toHaveLength(1);
  });

  it("(d) vencimento DEPOIS do dia da importação: a barreira não congela o futuro — R2 executa", () => {
    const importacao = importarContaAReceberHistorica(
      state,
      OPERADOR,
      entradaBase({ legacyTaskId: "hist_wr11_d", vencimento: { form: "civilDay", value: "2026-10-10" } }),
    );
    expect(importacao.ok, importacao.ok ? "" : importacao.error).toBe(true);
    if (!importacao.ok) throw new Error("unreachable");
    fixarProvenanceAt(state, importacao.value.id, IMPORTADO_EM);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    // R2 é vencimento + 1 dia: disparo em 2026-10-11, muito depois do dia da importação (2026-09-24).
    const r = runScheduledAutomations(state, OPERADOR, CR.listId, new Date(2026, 9, 11));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.executed).toBe(1);

    const novas = state.automationExecutions.filter((e) => !idsAntes.has(e.id) && e.objectId === importacao.value.id);
    expect(novas.filter((e) => e.automationId === "aut_cr_r2")).toHaveLength(1);
  });

  it("(e) disparo EXATAMENTE no dia civil da importação: a regra é “anterior ao dia”, estrita — R2 executa", () => {
    const importacao = importarContaAReceberHistorica(
      state,
      OPERADOR,
      // Vencimento 2026-09-23 + offset de R2 (1 dia) = disparo em 2026-09-24, o MESMO dia civil de IMPORTADO_EM.
      entradaBase({ legacyTaskId: "hist_wr11_e", vencimento: { form: "civilDay", value: "2026-09-23" } }),
    );
    expect(importacao.ok, importacao.ok ? "" : importacao.error).toBe(true);
    if (!importacao.ok) throw new Error("unreachable");
    fixarProvenanceAt(state, importacao.value.id, IMPORTADO_EM);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    const r = runScheduledAutomations(state, OPERADOR, CR.listId, new Date(2026, 8, 25));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.executed).toBe(1);

    const novas = state.automationExecutions.filter((e) => !idsAntes.has(e.id) && e.objectId === importacao.value.id);
    expect(novas.filter((e) => e.automationId === "aut_cr_r2")).toHaveLength(1);
  });
});
