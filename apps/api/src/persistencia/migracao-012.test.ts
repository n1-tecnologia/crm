/**
 * A `012` (15-04, D-15-09): `plataforma.crm_atividades`, o Registro de Atividade
 * do CRM novo — espelho de `ActivityRecord`, sem chave estrangeira para o objeto
 * (a Atividade sobrevive à eliminação dele, INV-ET-12) e só inserção por contrato
 * do repositório.
 *
 * Provas contra o Postgres LOCAL (`testes/banco-crm.ts`, nunca o do Supabase),
 * cada caso num banco descartável `m012_<8>` com as migrações 001 a 011
 * aplicadas e registradas — a 012 é executada pelo TEXTO do arquivo, como
 * `migrar()` faz:
 *
 *  (a) as quatro restrições com nome recusam ator, delegante, resultado e ação inválidos;
 *  (b) rodar o texto duas vezes não falha nem muda dado (idempotência);
 *  (c) pelo `migrar()` de verdade: uma 012 interrompida no meio não deixa linha em
 *      `plataforma.migracoes` nem a tabela, e a mesma 012 aplica depois;
 *  (d) a tabela nasce sem RLS, e o bloco da 012 a desliga se o projeto a ligar;
 *  (e) o SQL, sem os comentários, não concede privilégio;
 *  (f) apagar o Contato não apaga a Atividade dele, e a tabela não tem chave estrangeira;
 *  (g) D-03: nenhuma linha de `plataforma.registros` muda, e a tabela nasce vazia.
 */

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { describeComBanco, poolDoDono } from "../testes/banco-crm";
import { encerrar } from "./conexao";
import { migrar } from "./migrar";

const PASTA_DE_MIGRACOES = fileURLToPath(new URL("../../migracoes", import.meta.url));
const ARQUIVO_012 = "012-atividade-do-crm.sql";
const TEXTO_012 = readFileSync(join(PASTA_DE_MIGRACOES, ARQUIVO_012), "utf8");

/** O SQL sem as linhas de comentário: o cabeçalho cita `grant` e "chave estrangeira" justamente para dizer que não entram. */
const SQL_012 = TEXTO_012.split("\n").filter((linha) => !linha.trimStart().startsWith("--")).join("\n");

/** Os arquivos `.sql` anteriores à 012, na ordem em que `migrar()` os aplica. */
const ate011 = () =>
  readdirSync(PASTA_DE_MIGRACOES)
    .filter((f) => f.endsWith(".sql") && f < ARQUIVO_012)
    .sort();

/** A URL do DONO do banco local (a de migração, se local; senão a do app), apontando para outro banco. */
function urlDoBanco(nome: string): string {
  const migracao = process.env.DATABASE_URL_MIGRACAO?.trim();
  const local = migracao && ["localhost", "127.0.0.1"].includes(new URL(migracao).hostname);
  const url = new URL(local ? migracao : process.env.DATABASE_URL!);
  url.pathname = `/${nome}`;
  return url.toString();
}

interface BancoDescartavel {
  readonly pool: Pool;
  readonly encerrar: () => Promise<void>;
}

/**
 * Um banco novo no estado de produção antes da 012: 001 a 011 aplicadas e
 * registradas em `plataforma.migracoes`. A tabela de controle nasce antes,
 * como em `migrar()`, porque a 009 a referencia. A 012 fica por conta do teste.
 */
async function bancoAte011(): Promise<BancoDescartavel> {
  const nome = `m012_${randomUUID().slice(0, 8)}`;
  await poolDoDono().query(`create database ${nome}`);
  const pool = new Pool({ connectionString: urlDoBanco(nome), max: 2 });
  await pool.query("create schema if not exists plataforma");
  await pool.query("create table plataforma.migracoes (nome text primary key, aplicada_em timestamptz not null default now())");
  for (const arquivo of ate011()) {
    await pool.query(readFileSync(join(PASTA_DE_MIGRACOES, arquivo), "utf8"));
    await pool.query("insert into plataforma.migracoes (nome) values ($1)", [arquivo]);
  }
  return {
    pool,
    encerrar: async () => {
      await pool.end();
      await poolDoDono().query(`drop database if exists ${nome} with (force)`);
    },
  };
}

const WS = "ws_m012";

/** O erro do `pg` de uma consulta que deve falhar: `code` e `constraint`. */
async function recusa(consulta: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
  try {
    await consulta;
  } catch (erro) {
    return erro as { code?: string; constraint?: string };
  }
  throw new Error("esperava a recusa do banco, mas a consulta passou");
}

/** Uma Atividade válida; cada caso muda só o campo que quer recusar. */
function inserirAtividade(pool: Pool, campos: Partial<Record<"ator_tipo" | "delegante_tipo" | "delegante_id" | "resultado" | "acao" | "objeto_id", string>> = {}) {
  const c = { ator_tipo: "member", delegante_tipo: null, delegante_id: null, resultado: "ok", acao: "Nota registrada no Contato", objeto_id: "c1", ...campos };
  return pool.query(
    `insert into plataforma.crm_atividades
       (workspace_id, ator_tipo, ator_id, delegante_tipo, delegante_id, acao, objeto_tipo, objeto_id, objeto_nome, resultado)
     values ($1, $2, 'mem_a', $3, $4, $5, 'contact', $6, 'Fulano', $7)`,
    [WS, c.ator_tipo, c.delegante_tipo, c.delegante_id, c.acao, c.objeto_id, c.resultado],
  );
}

describeComBanco("012 — a Atividade do CRM novo (D-15-09) — Postgres local", () => {
  afterAll(async () => {
    await encerrar();
  });

  it("(a) recusa ator, delegante, resultado e ação inválidos, cada um pela restrição com nome", async () => {
    const banco = await bancoAte011();
    try {
      await banco.pool.query(TEXTO_012);

      // Os cinco ActorKind passam, e o delegante completo também.
      for (const tipo of ["member", "agent", "automation", "integration", "system"]) {
        await expect(inserirAtividade(banco.pool, { ator_tipo: tipo })).resolves.toBeDefined();
      }
      await expect(inserirAtividade(banco.pool, { delegante_tipo: "agent", delegante_id: "agt_1" })).resolves.toBeDefined();
      for (const resultado of ["ok", "denied", "failed"]) {
        await expect(inserirAtividade(banco.pool, { resultado })).resolves.toBeDefined();
      }

      expect(await recusa(inserirAtividade(banco.pool, { ator_tipo: "robo" }))).toMatchObject({ code: "23514", constraint: "crm_atividades_ator_ck" });
      // Delegante só com o tipo, só com o id, ou com tipo fora da lista.
      expect(await recusa(inserirAtividade(banco.pool, { delegante_tipo: "agent" }))).toMatchObject({ code: "23514", constraint: "crm_atividades_delegante_ck" });
      expect(await recusa(inserirAtividade(banco.pool, { delegante_id: "agt_1" }))).toMatchObject({ code: "23514", constraint: "crm_atividades_delegante_ck" });
      expect(await recusa(inserirAtividade(banco.pool, { delegante_tipo: "robo", delegante_id: "r1" }))).toMatchObject({
        code: "23514",
        constraint: "crm_atividades_delegante_ck",
      });
      expect(await recusa(inserirAtividade(banco.pool, { resultado: "talvez" }))).toMatchObject({ code: "23514", constraint: "crm_atividades_resultado_ck" });
      expect(await recusa(inserirAtividade(banco.pool, { acao: "  " }))).toMatchObject({ code: "23514", constraint: "crm_atividades_acao_ck" });

      // A chave primária é (workspace_id, id): dois Espaços podem repetir o id, um Espaço não.
      const pk = await banco.pool.query<{ colunas: string }>(
        `select string_agg(a.attname, ',' order by k.ord) as colunas
           from pg_constraint c
           cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
          where c.conrelid = 'plataforma.crm_atividades'::regclass and c.contype = 'p'`,
      );
      expect(pk.rows[0]?.colunas).toBe("workspace_id,id");
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(b) rodar o texto duas vezes seguidas não falha e não muda o dado", async () => {
    const banco = await bancoAte011();
    try {
      await banco.pool.query(TEXTO_012);
      await inserirAtividade(banco.pool);
      const retrato = async () => JSON.stringify((await banco.pool.query("select * from plataforma.crm_atividades order by id")).rows);
      const antes = await retrato();

      await expect(banco.pool.query(TEXTO_012)).resolves.toBeDefined();
      await expect(banco.pool.query(TEXTO_012)).resolves.toBeDefined();

      expect(await retrato()).toBe(antes);
      // Os dois índices existem uma vez só.
      const indices = await banco.pool.query<{ indexname: string }>(
        "select indexname from pg_indexes where schemaname = 'plataforma' and tablename = 'crm_atividades' and indexname like 'crm_atividades_%_idx' order by indexname",
      );
      expect(indices.rows.map((r) => r.indexname)).toEqual(["crm_atividades_em_idx", "crm_atividades_objeto_idx"]);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(c) pelo migrar(): uma 012 interrompida no meio não deixa registro nem tabela; depois aplica", async () => {
    const banco = await bancoAte011();
    try {
      // Interrompe a 012 DEPOIS de ela criar a tabela: um gatilho de evento de teste recusa o primeiro `create index`.
      await banco.pool.query(`
        create function public.m012_recusa() returns event_trigger language plpgsql as $$
        begin raise exception 'interrompida'; end $$;
        create event trigger m012_recusa on ddl_command_end when tag in ('CREATE INDEX') execute function public.m012_recusa();
      `);

      await expect(migrar(banco.pool)).rejects.toThrow(/012-atividade-do-crm\.sql.*falhou/);

      const registrada = await banco.pool.query("select 1 from plataforma.migracoes where nome = $1", [ARQUIVO_012]);
      expect(registrada.rowCount).toBe(0);
      const sobrou = await banco.pool.query("select to_regclass('plataforma.crm_atividades') as tabela");
      expect(sobrou.rows[0]).toEqual({ tabela: null });

      // Sem o gatilho, a mesma 012 aplica e registra.
      await banco.pool.query("drop event trigger m012_recusa");
      const aplicadas = await migrar(banco.pool);
      expect(aplicadas.map((a) => a.nome)).toEqual([ARQUIVO_012]);
      const agora = await banco.pool.query("select 1 from plataforma.migracoes where nome = $1", [ARQUIVO_012]);
      expect(agora.rowCount).toBe(1);
      expect((await banco.pool.query("select to_regclass('plataforma.crm_atividades') as tabela")).rows[0]?.tabela).toBe("plataforma.crm_atividades");
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(d) a tabela nasce sem RLS, e o bloco da 012 a desliga se o projeto a ligar", async () => {
    const banco = await bancoAte011();
    try {
      await banco.pool.query(TEXTO_012);
      const rls = async () =>
        (await banco.pool.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid = 'plataforma.crm_atividades'::regclass")).rows[0]!
          .relrowsecurity;
      expect(await rls()).toBe(false);

      // O que o event trigger `ensure_rls` do Supabase faria numa tabela nova: ligar a RLS sem policy.
      await banco.pool.query("alter table plataforma.crm_atividades enable row level security");
      expect(await rls()).toBe(true);

      await banco.pool.query(TEXTO_012);
      expect(await rls()).toBe(false);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(f) apagar o Contato não apaga a Atividade dele, e a tabela não tem chave estrangeira (INV-ET-12)", async () => {
    const banco = await bancoAte011();
    try {
      await banco.pool.query(TEXTO_012);
      await banco.pool.query("insert into plataforma.contatos (workspace_id, id, nome, proprietario_id, criado_por) values ($1, 'c1', 'Fulano', 'mem_a', 'mem_a')", [WS]);
      await inserirAtividade(banco.pool);

      await banco.pool.query("delete from plataforma.contatos where workspace_id = $1 and id = 'c1'", [WS]);

      const { rows } = await banco.pool.query<{ objeto_id: string; objeto_nome: string }>(
        "select objeto_id, objeto_nome from plataforma.crm_atividades where workspace_id = $1",
        [WS],
      );
      expect(rows).toEqual([{ objeto_id: "c1", objeto_nome: "Fulano" }]);

      const fks = await banco.pool.query("select 1 from pg_constraint where conrelid = 'plataforma.crm_atividades'::regclass and contype = 'f'");
      expect(fks.rowCount).toBe(0);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(g) D-03: não mexe em plataforma.registros, e a tabela nasce vazia", async () => {
    const banco = await bancoAte011();
    try {
      await banco.pool.query("insert into plataforma.workspaces (workspace_id) values ($1)", [WS]);
      for (const [colecao, id] of [["contacts", "cnt_1"], ["conversations", "cnv_1"], ["deals", "dl_1"]] as const) {
        await banco.pool.query("insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, $2, $3, $4::jsonb)", [WS, colecao, id, JSON.stringify({ id, nome: "dado real" })]);
      }
      const retrato = async () => JSON.stringify((await banco.pool.query("select * from plataforma.registros order by colecao, id")).rows);
      const antes = await retrato();
      const revisaoAntes = (await banco.pool.query("select revisao from plataforma.workspaces where workspace_id = $1", [WS])).rows[0];

      await banco.pool.query(TEXTO_012);

      expect(await retrato()).toBe(antes);
      expect((await banco.pool.query("select revisao from plataforma.workspaces where workspace_id = $1", [WS])).rows[0]).toEqual(revisaoAntes);
      const { rows } = await banco.pool.query<{ n: string }>("select count(*) as n from plataforma.crm_atividades");
      expect(Number(rows[0]!.n)).toBe(0);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);
});

// O bloco acima pula sem Postgres local; este não, para o arquivo nunca ficar "sem teste".
describe("012 — o arquivo", () => {
  it("(e) é idempotente por escrito, desliga a RLS e não concede privilégio nem cria chave estrangeira", () => {
    expect(SQL_012).toContain("disable row level security");
    expect(SQL_012).not.toMatch(/\bgrant\b/i);
    expect(SQL_012).not.toMatch(/foreign key|\breferences\b/i);
    // Não toca `plataforma.registros` (D-03).
    expect(SQL_012).not.toMatch(/plataforma\.registros\b/);
    // Toda criação de tabela e de índice é `if not exists`.
    const criacoes = SQL_012.match(/create (?:table|index) [^\n]*/g) ?? [];
    expect(criacoes.length).toBe(3);
    expect(criacoes.every((c) => c.includes("if not exists"))).toBe(true);
    // As quatro restrições com nome estão no texto.
    for (const nome of ["crm_atividades_ator_ck", "crm_atividades_delegante_ck", "crm_atividades_resultado_ck", "crm_atividades_acao_ck"]) {
      expect(SQL_012).toContain(nome);
    }
  });
});
