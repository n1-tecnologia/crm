/**
 * Prova contra Postgres real das constraints das seis tabelas de transporte
 * de `003-integracao-e-importacao.sql` — outbox, idempotência HTTP,
 * credenciais de serviço, sessões de upload e ledger de importação.
 *
 * Estas tabelas não são entidades da ontologia: nenhum caso aqui toca a
 * tabela canônica de registros. O que se prova é que os invariantes que os Planos
 * 02-10, 02-13, 02-11 e 02-25 vão assumir (evento único, lease exclusiva,
 * idempotência, objeto não reusável, ledger idempotente) são do banco, não
 * de uma checagem em código que uma corrida poderia furar.
 *
 * Precisa de um Postgres em `DATABASE_URL` **com a migração `003` aplicada**
 * (`npm run migrar -w @n1/api`) — sem `DATABASE_URL`, pula (D-DEC-09), como
 * `persistencia.test.ts` e `colunas-geradas.test.ts`.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { carregarEnv, encerrar, pool } from "./conexao";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

// Prefixo próprio por execução: cada caso limpa só as linhas que criou, e o
// `afterAll` varre por este prefixo para não depender de listar cada id.
const RUN = `teste_integracao_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;

async function limparTudo(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.http_idempotency where service_id = $1", [RUN]);
    await cliente.query("delete from plataforma.upload_objects where session_id in (select id from plataforma.upload_sessions where workspace_id = $1)", [WORKSPACE]);
    await cliente.query("delete from plataforma.upload_sessions where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.importacao_ledger where origem = $1", [RUN]);
    await cliente.query("delete from plataforma.service_credentials where workspace_id = $1", [WORKSPACE]);
  } finally {
    cliente.release();
  }
}

d("constraints das tabelas de transporte (003)", () => {
  beforeAll(async () => {
    await limparTudo();
  });

  afterAll(async () => {
    await limparTudo();
    await encerrar();
  });

  it("(a) integration_outbox: 'solicitacao.criada.v1' é único por agregado; outro event_type é aceito", async () => {
    const cliente = await pool().connect();
    try {
      const aggregateId = `agg_${randomUUID()}`;
      await cliente.query(
        `insert into plataforma.integration_outbox
           (workspace_id, aggregate_type, aggregate_id, event_type, payload)
         values ($1, 'task', $2, 'solicitacao.criada.v1', $3::jsonb)`,
        [WORKSPACE, aggregateId, JSON.stringify({ taskId: aggregateId })],
      );

      await expect(
        cliente.query(
          `insert into plataforma.integration_outbox
             (workspace_id, aggregate_type, aggregate_id, event_type, payload)
           values ($1, 'task', $2, 'solicitacao.criada.v1', $3::jsonb)`,
          [WORKSPACE, aggregateId, JSON.stringify({ taskId: aggregateId })],
        ),
      ).rejects.toThrow(/duplicate key|unique constraint/i);

      // Mesmo agregado, event_type diferente: aceito.
      await cliente.query(
        `insert into plataforma.integration_outbox
           (workspace_id, aggregate_type, aggregate_id, event_type, payload)
         values ($1, 'task', $2, 'solicitacao.atualizada.v1', $3::jsonb)`,
        [WORKSPACE, aggregateId, JSON.stringify({ taskId: aggregateId })],
      );

      const r = await cliente.query<{ n: string }>(
        `select count(*)::text as n from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2`,
        [WORKSPACE, aggregateId],
      );
      expect(r.rows[0]!.n).toBe("2");
    } finally {
      cliente.release();
    }
  });

  it("(b) lease do outbox: duas conexões simultâneas para a mesma linha pendente, uma só reivindica", async () => {
    const cliente = await pool().connect();
    let eventId: string;
    try {
      const inserted = await cliente.query<{ id: string }>(
        `insert into plataforma.integration_outbox
           (workspace_id, aggregate_type, aggregate_id, event_type, payload, status)
         values ($1, 'task', $2, 'solicitacao.criada.v1', $3::jsonb, 'pending')
         returning id`,
        [WORKSPACE, `agg_lease_${randomUUID()}`, JSON.stringify({})],
      );
      eventId = inserted.rows[0]!.id;
    } finally {
      cliente.release();
    }

    const reivindicar = async (workerId: string) => {
      const conexao = await pool().connect();
      try {
        const r = await conexao.query<{ id: string }>(
          `update plataforma.integration_outbox
              set status = 'delivering', locked_by = $1, locked_at = now()
            where id = (
              select id from plataforma.integration_outbox
               where status = 'pending' and available_at <= now() and id = $2
               order by available_at, id
               limit 1
                 for update skip locked
            )
            returning id`,
          [workerId, eventId],
        );
        return r.rows;
      } finally {
        conexao.release();
      }
    };

    const [linhasA, linhasB] = await Promise.all([reivindicar("worker_a"), reivindicar("worker_b")]);
    const total = linhasA.length + linhasB.length;
    expect(total).toBe(1);
  });

  it("(c) http_idempotency: recusa a segunda linha com a mesma primary key composta", async () => {
    const cliente = await pool().connect();
    try {
      const chave = `chave_${randomUUID()}`;
      await cliente.query(
        `insert into plataforma.http_idempotency
           (service_id, route_template, idempotency_key, request_hash, status)
         values ($1, '/tarefas/:id', $2, 'hash1', 'in_progress')`,
        [RUN, chave],
      );

      await expect(
        cliente.query(
          `insert into plataforma.http_idempotency
             (service_id, route_template, idempotency_key, request_hash, status)
           values ($1, '/tarefas/:id', $2, 'hash2', 'in_progress')`,
          [RUN, chave],
        ),
      ).rejects.toThrow(/duplicate key|unique constraint/i);
    } finally {
      cliente.release();
    }
  });

  it("(d) upload_objects: object_key é único entre sessões distintas", async () => {
    const cliente = await pool().connect();
    try {
      const sessaoA = await cliente.query<{ id: string }>(
        `insert into plataforma.upload_sessions (workspace_id, form_id, expires_at)
         values ($1, 'form_teste', now() + interval '1 hour') returning id`,
        [WORKSPACE],
      );
      const sessaoB = await cliente.query<{ id: string }>(
        `insert into plataforma.upload_sessions (workspace_id, form_id, expires_at)
         values ($1, 'form_teste', now() + interval '1 hour') returning id`,
        [WORKSPACE],
      );

      const objectKey = `objeto_${randomUUID()}`;
      await cliente.query(
        `insert into plataforma.upload_objects
           (session_id, object_key, display_name, media_type)
         values ($1, $2, 'comprovante.pdf', 'application/pdf')`,
        [sessaoA.rows[0]!.id, objectKey],
      );

      await expect(
        cliente.query(
          `insert into plataforma.upload_objects
             (session_id, object_key, display_name, media_type)
           values ($1, $2, 'comprovante.pdf', 'application/pdf')`,
          [sessaoB.rows[0]!.id, objectKey],
        ),
      ).rejects.toThrow(/duplicate key|unique constraint/i);
    } finally {
      cliente.release();
    }
  });

  it("(e) importacao_ledger: recusa mesma (origem, legacy_task_id); aceita mesmo legacy_task_id em origem diferente", async () => {
    const cliente = await pool().connect();
    try {
      const legacyTaskId = `legacy_${randomUUID()}`;
      const runId = randomUUID();
      await cliente.query(
        `insert into plataforma.importacao_ledger
           (origem, legacy_task_id, run_id, resultado, source_hash)
         values ($1, $2, $3, 'importada', 'hash_origem')`,
        [RUN, legacyTaskId, runId],
      );

      await expect(
        cliente.query(
          `insert into plataforma.importacao_ledger
             (origem, legacy_task_id, run_id, resultado, source_hash)
           values ($1, $2, $3, 'importada', 'hash_origem_2')`,
          [RUN, legacyTaskId, randomUUID()],
        ),
      ).rejects.toThrow(/duplicate key|unique constraint/i);

      // Mesmo legacy_task_id, origem diferente: aceito.
      const outraOrigem = `${RUN}_outra`;
      await cliente.query(
        `insert into plataforma.importacao_ledger
           (origem, legacy_task_id, run_id, resultado, source_hash)
         values ($1, $2, $3, 'importada', 'hash_origem')`,
        [outraOrigem, legacyTaskId, runId],
      );
      await cliente.query("delete from plataforma.importacao_ledger where origem = $1", [outraOrigem]);
    } finally {
      cliente.release();
    }
  });

  it("(f) service_credentials: aceita 'ativa' e 'rotacionando' simultâneas; recusa state fora do check", async () => {
    const cliente = await pool().connect();
    try {
      const memberId = `mem_${RUN}`;
      await cliente.query(
        `insert into plataforma.service_credentials
           (id, workspace_id, nome, secret_hash, scopes, member_id, state)
         values ($1, $2, 'credencial a', 'hash_a', $3, $4, 'ativa')`,
        [`cred_a_${RUN}`, WORKSPACE, ["escrita:tarefas"], memberId],
      );
      await cliente.query(
        `insert into plataforma.service_credentials
           (id, workspace_id, nome, secret_hash, scopes, member_id, state)
         values ($1, $2, 'credencial b', 'hash_b', $3, $4, 'rotacionando')`,
        [`cred_b_${RUN}`, WORKSPACE, ["escrita:tarefas"], memberId],
      );

      const r = await cliente.query<{ n: string }>(
        `select count(*)::text as n from plataforma.service_credentials where workspace_id = $1 and state <> 'revogada'`,
        [WORKSPACE],
      );
      expect(r.rows[0]!.n).toBe("2");

      await expect(
        cliente.query(
          `insert into plataforma.service_credentials
             (id, workspace_id, nome, secret_hash, scopes, member_id, state)
           values ($1, $2, 'credencial c', 'hash_c', $3, $4, 'invalida')`,
          [`cred_c_${RUN}`, WORKSPACE, ["escrita:tarefas"], memberId],
        ),
      ).rejects.toThrow(/check constraint|violates/i);
    } finally {
      cliente.release();
    }
  });
});
