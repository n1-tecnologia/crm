/**
 * V02-07A (02-VALIDATION.md) — a Fault-Injection Matrix da gravação
 * transacional do outbox (Plan 02-10, Task 1): D-18 (evento e Tarefa no
 * mesmo commit), o índice único parcial de `003-integracao-e-importacao.sql`
 * como invariante do banco, e a garantia de que o payload nunca carrega mais
 * do que o catálogo `EVENTOS` declara.
 *
 * Precisa de um Postgres em `DATABASE_URL` com a migração `003` aplicada;
 * sem ela, pula (D-DEC-09), como `persistencia.test.ts`/`integracao.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState, StatusSet } from "@n1/dominio";
import { createList, createSpace, createTask, createTaskType } from "@n1/dominio/operations";
import { carregarEnv, encerrar, pool } from "./conexao";
import { semear } from "./repositorio";
import { executar } from "./unidade-de-trabalho";
import { EVENTOS, type EventoDeSaida } from "./outbox";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const THIAGO = "mem_thiago"; // proprietário do seed (mesmo id usado em aprovacao-de-processo.test.ts)
const RUN = `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WS = `ws_${RUN}`;

const STATUS_SET: StatusSet = {
  id: "sts_outbox_teste",
  definitions: [
    { id: "st_ob_para_fazer", name: "para fazer", color: "#94a3b8", category: "naoIniciado", order: 0 },
    { id: "st_ob_fechado", name: "fechado", color: "#22c55e", category: "fechado", order: 1 },
  ],
};

let listId: string;

// Cada `WS` já nasce único por execução (RUN carrega timestamp + random), mas
// isso só evita COLISÃO entre execuções — não evita LEAK: sem limpar as
// linhas que esta suíte insere, elas se acumulam para sempre em
// `integration_outbox`/`registros`/`workspaces`, que são tabelas
// compartilhadas com o banco real (mesmo padrão de `integracao.test.ts` e
// `outbox-worker.test.ts`, commit d65c12a). `limparWorkspace()` roda no
// `beforeAll` (defensivo, caso uma execução anterior tenha abortado antes do
// seu próprio `afterAll`) E no `afterAll` (a limpeza que de fato importa).
async function limparWorkspace(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WS]);
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
  } finally {
    cliente.release();
  }
}

async function limparOutboxDoAgregado(aggregateId: string): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2", [WS, aggregateId]);
  } finally {
    cliente.release();
  }
}

async function contarOutbox(aggregateId: string): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ n: string }>(
      "select count(*)::text as n from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
      [WS, aggregateId],
    );
    return Number(r.rows[0]!.n);
  } finally {
    cliente.release();
  }
}

async function contarTarefas(): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ n: string }>(
      "select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'tasks'",
      [WS],
    );
    return Number(r.rows[0]!.n);
  } finally {
    cliente.release();
  }
}

function eventoCriada(taskId: string, aggregateId = taskId): EventoDeSaida {
  return {
    type: "solicitacao.criada.v1",
    aggregateType: "task",
    aggregateId,
    payload: { taskId, readableId: taskId, listId, origin: "plataforma" },
  };
}

d("gravação transacional do outbox (V02-07A)", () => {
  beforeAll(async () => {
    const state: DataState = buildSeed();
    const espaco = createSpace(state, THIAGO, { name: "Financeiro (teste outbox)", statusSet: STATUS_SET });
    if (!espaco.ok) throw new Error(`seed de teste: ${espaco.error}`);
    const tipo = createTaskType(state, THIAGO, {
      name: "Solicitação (teste outbox)",
      icon: "circle",
      definedAtType: "space",
      definedAtId: espaco.value.id,
    });
    if (!tipo.ok) throw new Error(`seed de teste: ${tipo.error}`);
    const lista = createList(state, THIAGO, {
      name: "Solicitações (teste outbox)",
      parentType: "space",
      parentId: espaco.value.id,
    });
    if (!lista.ok) throw new Error(`seed de teste: ${lista.error}`);
    listId = lista.value.id;

    await limparWorkspace();
    const cliente = await pool().connect();
    try {
      await semear(cliente, WS, state);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    // A limpeza que de fato impede o leak: sem ela, as linhas desta execução
    // (outbox, registros e o próprio workspace) sobrevivem indefinidamente,
    // porque `WS` é novo a cada execução e o `beforeAll` da PRÓXIMA execução
    // só limpa o SEU PRÓPRIO `WS`, nunca o desta.
    await limparWorkspace();
    await encerrar();
  });

  it("(a) executar() com eventos grava Tarefa e evento no mesmo commit", async () => {
    const r = await executar(WS, (state) => createTask(state, THIAGO, { listId, title: "Solicitação (a)" }), {
      eventos: (valor) => [eventoCriada(valor.id)],
    });
    expect(r.ok, "ok" in r ? String((r as { error?: string }).error) : "").toBe(true);
    if (!r.ok) return;

    expect(await contarOutbox(r.value.id)).toBe(1);

    const cliente = await pool().connect();
    try {
      const tarefa = await cliente.query("select 1 from plataforma.registros where workspace_id = $1 and colecao = 'tasks' and id = $2", [WS, r.value.id]);
      expect(tarefa.rowCount).toBe(1);
    } finally {
      cliente.release();
    }
  });

  it("(b) operação que devolve fail não grava Tarefa nem evento", async () => {
    const antesDeTarefas = await contarTarefas();
    const aggregateId = `agg_fail_${RUN}`;

    const r = await executar(
      WS,
      // Lista inexistente: `createTask` recusa antes de qualquer gravação (RN de domínio).
      (state) => createTask(state, THIAGO, { listId: "lst_inexistente_9999", title: "Nunca grava" }),
      { eventos: () => [eventoCriada("nao_deveria_existir", aggregateId)] },
    );
    expect(r.ok).toBe(false);
    expect(await contarTarefas()).toBe(antesDeTarefas);
    expect(await contarOutbox(aggregateId)).toBe(0);
  });

  it("(c) payload inválido faz gravarEventos lançar — rollback total, executar propaga", async () => {
    const antesDeTarefas = await contarTarefas();
    const aggregateId = `agg_invalido_${RUN}`;

    await expect(
      executar(WS, (state) => createTask(state, THIAGO, { listId, title: "Payload inválido (c)" }), {
        eventos: () => [
          {
            type: "solicitacao.criada.v1",
            aggregateType: "task",
            aggregateId,
            // `origin` errado + campo a mais: o schema `.strict()` recusa os dois motivos.
            payload: { taskId: aggregateId, readableId: aggregateId, listId, origin: "clickup", extra: "não deveria existir" } as never,
          },
        ],
      }),
    ).rejects.toThrow();

    expect(await contarTarefas()).toBe(antesDeTarefas);
    expect(await contarOutbox(aggregateId)).toBe(0);
  });

  it("(d) exceção entre o insert de um evento e o commit não deixa nem esse evento nem a Tarefa", async () => {
    const antesDeTarefas = await contarTarefas();
    const aggregateValido = `agg_d_valido_${RUN}`;
    const aggregateInvalido = `agg_d_invalido_${RUN}`;

    // Dois eventos na mesma chamada: o primeiro grava (insert real, dentro da
    // transação ainda aberta); o segundo tem payload inválido e lança DEPOIS
    // do primeiro insert já ter acontecido — é o "crash entre insert e
    // commit" da Fault-Injection Matrix, só que a causa é um payload ruim em
    // vez de um `cliente.query` interceptado: o efeito observável (rollback
    // desfaz o que já tinha sido inserido na mesma transação) é o mesmo.
    await expect(
      executar(WS, (state) => createTask(state, THIAGO, { listId, title: "Payload inválido (d)" }), {
        eventos: (valor) => [
          eventoCriada(valor.id, aggregateValido),
          {
            type: "solicitacao.criada.v1",
            aggregateType: "task",
            aggregateId: aggregateInvalido,
            payload: { taskId: aggregateInvalido, readableId: aggregateInvalido } as never, // faltam listId/origin
          },
        ],
      }),
    ).rejects.toThrow();

    expect(await contarTarefas()).toBe(antesDeTarefas);
    expect(await contarOutbox(aggregateValido)).toBe(0);
    expect(await contarOutbox(aggregateInvalido)).toBe(0);
  });

  it("(e) dois eventos 'solicitacao.criada.v1' para o mesmo agregado: o segundo commit falha, o primeiro permanece", async () => {
    const aggregateId = `agg_dup_${RUN}`;
    await limparOutboxDoAgregado(aggregateId);

    const primeira = await executar(WS, (state) => createTask(state, THIAGO, { listId, title: "Duplicata (e) — 1ª" }), {
      eventos: (valor) => [eventoCriada(valor.id, aggregateId)],
    });
    expect(primeira.ok).toBe(true);
    expect(await contarOutbox(aggregateId)).toBe(1);

    const antesDeTarefas = await contarTarefas();
    await expect(
      executar(WS, (state) => createTask(state, THIAGO, { listId, title: "Duplicata (e) — 2ª" }), {
        eventos: (valor) => [eventoCriada(valor.id, aggregateId)],
      }),
    ).rejects.toThrow(/duplicate key|unique constraint/i);

    // O segundo rollback desfaz a SEGUNDA Tarefa (mesma transação do evento
    // que colidiu); a primeira gravação de (e) permanece intacta.
    expect(await contarTarefas()).toBe(antesDeTarefas);
    expect(await contarOutbox(aggregateId)).toBe(1);
  });

  it("(f) o payload gravado não tem nenhuma chave fora do catálogo EVENTOS", async () => {
    const r = await executar(WS, (state) => createTask(state, THIAGO, { listId, title: "Chaves do payload (f)" }), {
      eventos: (valor) => [eventoCriada(valor.id)],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const cliente = await pool().connect();
    try {
      const linha = await cliente.query<{ payload: Record<string, unknown> }>(
        "select payload from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
        [WS, r.value.id],
      );
      const chavesGravadas = Object.keys(linha.rows[0]!.payload);
      const chavesDeclaradas = Object.keys(EVENTOS["solicitacao.criada.v1"].shape);
      for (const chave of chavesGravadas) {
        expect(chavesDeclaradas).toContain(chave);
      }
      // Em particular: nenhum campo financeiro (valor, fornecedor, chave Pix...) vazou.
      expect(chavesGravadas).not.toContain("amountCents");
      expect(chavesGravadas).not.toContain("pixKey");
    } finally {
      cliente.release();
    }
  });

});
