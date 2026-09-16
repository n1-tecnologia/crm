/**
 * Prova que as colunas geradas e os índices de `002-registros-colunas-
 * geradas.sql` fazem o que prometem: a coluna reflete o mesmo valor que está
 * em `dados` (comparado contra o mesmo filtro feito em JS sobre `buildSeed()`),
 * os seis índices existem, e o planejador os escolhe quando não pode varrer a
 * tabela sequencialmente.
 *
 * Precisa de um Postgres em `DATABASE_URL` **com a migração `002` aplicada**
 * (`npm run migrar -w @n1/api`) — sem `DATABASE_URL`, pula (D-DEC-09), como
 * `persistencia.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import { USUARIOS_DO_SEED, type DataState, type Task } from "@n1/dominio";
import { carregarEnv, encerrar, pool } from "./conexao";
import { semear } from "./repositorio";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = "ws_colunas_teste";

const INDICES_DE_002 = [
  "registros_tasks_list_status_idx",
  "registros_tasks_list_due_date_idx",
  "registros_tasks_tag_ids_idx",
  "registros_tasks_assignees_idx",
  "registros_tasks_field_values_idx",
  "registros_members_user_id_idx",
] as const;

async function limpar(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
  } finally {
    cliente.release();
  }
}

d("colunas geradas e índices de 002", () => {
  let semente: DataState;
  let tasks: readonly Task[];
  let tagContaTriaId: string;
  let pessoaValor: unknown;

  beforeAll(async () => {
    await limpar();
    semente = buildSeed();
    tasks = semente.tasks;

    const tagContaTria = semente.tags.find((t) => t.name === "conta tria");
    if (!tagContaTria) throw new Error("o seed precisa ter a Tag 'conta tria'.");
    tagContaTriaId = tagContaTria.id;

    const comPessoa = tasks.find((t) => t.fieldValues.some((f) => f.definitionId === CP.fields.pessoa));
    if (!comPessoa) throw new Error("o seed precisa ter uma Conta com o campo Pessoa preenchido.");
    pessoaValor = comPessoa.fieldValues.find((f) => f.definitionId === CP.fields.pessoa)!.value;

    const cliente = await pool().connect();
    try {
      await semear(cliente, WS, semente);
      // Sem isto, o planejador decide com estatísticas obsoletas (a tabela
      // acabou de ser semeada) e pode escolher qualquer índice "barato o
      // bastante" em vez do mais seletivo para cada predicado — o teste do
      // planejador, abaixo, ficaria instável.
      await cliente.query("analyze plataforma.registros");
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    await limpar();
    await encerrar();
  });

  it("status_id + list_id: coluna gerada bate com o filtro em JS", async () => {
    const esperado = tasks.filter((t) => t.listId === CP.listId && t.statusId === CP.status.paraPagar).length;
    expect(esperado).toBeGreaterThan(0);

    const cliente = await pool().connect();
    try {
      const r = await cliente.query<{ n: number }>(
        `select count(*)::int as n from plataforma.registros
          where workspace_id = $1 and colecao = 'tasks' and list_id = $2 and status_id = $3`,
        [WS, CP.listId, CP.status.paraPagar],
      );
      expect(r.rows[0]!.n).toBe(esperado);
    } finally {
      cliente.release();
    }
  });

  it("due_date: coluna gerada ordena como dueDate.value e reflete o valor", async () => {
    const comVencimento = tasks
      .filter((t) => t.listId === CP.listId && t.dueDate !== undefined)
      .slice()
      .sort((a, b) => a.dueDate!.value.localeCompare(b.dueDate!.value));
    expect(comVencimento.length).toBeGreaterThan(0);

    const cliente = await pool().connect();
    try {
      const r = await cliente.query<{ id: string; due_date: string }>(
        `select id, due_date from plataforma.registros
          where workspace_id = $1 and colecao = 'tasks' and list_id = $2 and due_date is not null
          order by due_date`,
        [WS, CP.listId],
      );
      // Mesma ordem que ordenar em JS por `dueDate.value` — prova que a coluna
      // (texto ISO) ordena como o domínio espera (Assumption A2).
      expect(r.rows.map((linha) => linha.id)).toEqual(comVencimento.map((t) => t.id));

      const alvo = comVencimento[0]!;
      const linha = r.rows.find((l) => l.id === alvo.id);
      expect(linha?.due_date).toBe(alvo.dueDate!.value);
    } finally {
      cliente.release();
    }
  });

  it("Tag `conta *`: índice GIN de tagIds bate com o filtro em JS", async () => {
    const esperado = tasks.filter((t) => t.listId === CP.listId && t.tagIds.includes(tagContaTriaId)).length;
    expect(esperado).toBeGreaterThan(0);

    const cliente = await pool().connect();
    try {
      const r = await cliente.query<{ n: number }>(
        `select count(*)::int as n from plataforma.registros
          where workspace_id = $1 and colecao = 'tasks' and dados->'tagIds' @> $2::jsonb`,
        [WS, JSON.stringify([tagContaTriaId])],
      );
      expect(r.rows[0]!.n).toBe(esperado);
    } finally {
      cliente.release();
    }
  });

  it("Responsável: índice GIN de assignees bate com o filtro em JS", async () => {
    const esperado = tasks.filter((t) => t.assignees.some((a) => a.id === CP.financeiroId)).length;
    expect(esperado).toBeGreaterThan(0);

    const cliente = await pool().connect();
    try {
      const r = await cliente.query<{ n: number }>(
        `select count(*)::int as n from plataforma.registros
          where workspace_id = $1 and colecao = 'tasks' and dados->'assignees' @> $2::jsonb`,
        [WS, JSON.stringify([{ id: CP.financeiroId }])],
      );
      expect(r.rows[0]!.n).toBe(esperado);
    } finally {
      cliente.release();
    }
  });

  it("Pessoa: índice GIN de fieldValues bate com o filtro em JS", async () => {
    const esperado = tasks.filter((t) =>
      t.fieldValues.some((f) => f.definitionId === CP.fields.pessoa && f.value === pessoaValor),
    ).length;
    expect(esperado).toBeGreaterThan(0);

    const cliente = await pool().connect();
    try {
      const r = await cliente.query<{ n: number }>(
        `select count(*)::int as n from plataforma.registros
          where workspace_id = $1 and colecao = 'tasks' and dados->'fieldValues' @> $2::jsonb`,
        [WS, JSON.stringify([{ definitionId: CP.fields.pessoa, value: pessoaValor }])],
      );
      expect(r.rows[0]!.n).toBe(esperado);
    } finally {
      cliente.release();
    }
  });

  it("userId: índice de expressão resolve o Membro pela sessão (hook de autenticação)", async () => {
    const cliente = await pool().connect();
    try {
      const r = await cliente.query<{ id: string }>(
        `select dados->>'id' as id from plataforma.registros
          where workspace_id = $1 and colecao = 'members' and dados->>'userId' = $2`,
        [WS, USUARIOS_DO_SEED.mem_maryane],
      );
      expect(r.rows[0]?.id).toBe("mem_maryane");
    } finally {
      cliente.release();
    }
  });

  it("os 6 índices de 002 existem", async () => {
    const cliente = await pool().connect();
    try {
      const r = await cliente.query<{ indexname: string }>(
        `select indexname from pg_indexes where schemaname = 'plataforma' and tablename = 'registros'`,
      );
      const nomes = r.rows.map((linha) => linha.indexname);
      for (const esperado of INDICES_DE_002) {
        expect(nomes, `índice "${esperado}" não existe — rode npm run migrar -w @n1/api`).toContain(esperado);
      }
    } finally {
      cliente.release();
    }
  });

  it("o planejador escolhe o índice quando não pode varrer sequencialmente", async () => {
    const cliente = await pool().connect();
    try {
      // Com ~900 linhas o planejador prefere varredura sequencial por custo —
      // desligar aqui força a escolha do índice, provando que ele é usável
      // (não que ele é sempre escolhido em produção).
      await cliente.query("set enable_seqscan = off");
      try {
        const planoStatus = await cliente.query<{ "QUERY PLAN": unknown }>(
          `explain (format json) select 1 from plataforma.registros
            where workspace_id = $1 and colecao = 'tasks' and list_id = $2 and status_id = $3`,
          [WS, CP.listId, CP.status.paraPagar],
        );
        const textoStatus = JSON.stringify(planoStatus.rows[0]!["QUERY PLAN"]);
        // `registros_tasks_list_status_idx` e `registros_tasks_list_due_date_idx`
        // têm o mesmo prefixo `(workspace_id, list_id)`: com uma linha só
        // batendo, o planejador pode escolher qualquer um dos dois — o que
        // importa provar é que ele varre por índice, não a tabela inteira.
        expect(textoStatus).not.toContain("Seq Scan");
        expect(textoStatus).toMatch(/registros_tasks_list_(status|due_date)_idx/);

        const planoDueDate = await cliente.query<{ "QUERY PLAN": unknown }>(
          `explain (format json) select 1 from plataforma.registros
            where workspace_id = $1 and colecao = 'tasks' and list_id = $2
              and due_date between $3 and $4`,
          [WS, CP.listId, "0000-00-00", "9999-99-99"],
        );
        expect(JSON.stringify(planoDueDate.rows[0]!["QUERY PLAN"])).toContain("registros_tasks_list_due_date_idx");

        const planoTag = await cliente.query<{ "QUERY PLAN": unknown }>(
          `explain (format json) select 1 from plataforma.registros
            where workspace_id = $1 and colecao = 'tasks' and dados->'tagIds' @> $2::jsonb`,
          [WS, JSON.stringify([tagContaTriaId])],
        );
        expect(JSON.stringify(planoTag.rows[0]!["QUERY PLAN"])).toContain("registros_tasks_tag_ids_idx");
      } finally {
        await cliente.query("set enable_seqscan = on");
      }
    } finally {
      cliente.release();
    }
  });
});
