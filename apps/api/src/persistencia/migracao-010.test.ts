/**
 * A `010` (10-17, D-18): migração SÓ de dados. As Visualizações gravadas com
 * `kind` carga viram `lista`, as Listas perdem a chave `blocks`, e a `revisao`
 * dos Espaços de Trabalho alterados sobe 1.
 *
 * Provas contra o Postgres LOCAL (`testes/banco-crm.ts`, nunca o do Supabase),
 * cada caso num banco descartável `m010_<8>` com as migrações 001 a 009
 * aplicadas e registradas — a 010 é executada pelo TEXTO do arquivo, como `migrar()` faz:
 *
 *  (a) o dado antigo é convertido e NADA além dele muda (outras coleções, outros
 *      `kind`, `blocks` de Espaço e Pasta, Espaços sem linha alterada);
 *  (b) rodar o texto de novo não acha linha e não muda nada (idempotência);
 *  (c) num banco sem Visualização nem Lista a 010 aplica sem erro;
 *  (d) a pós-condição, executada sozinha, só dispara com uma ou mais linhas
 *      remanescentes — com zero linhas passa;
 *  (e) pelo `migrar()` de verdade: uma 010 interrompida no meio não deixa dado
 *      alterado nem linha em `plataforma.migracoes`, e a mesma 010 rodada depois
 *      aplica (T-10-43).
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
const ARQUIVO_010 = "010-carga-e-bloqueio-da-lista.sql";
const TEXTO_010 = readFileSync(join(PASTA_DE_MIGRACOES, ARQUIVO_010), "utf8");
const POS_CONDICAO = TEXTO_010.slice(TEXTO_010.indexOf("-- POS-CONDICAO"));

/** Os arquivos `.sql` anteriores à 010, na ordem em que `migrar()` os aplica. */
const ate009 = () =>
  readdirSync(PASTA_DE_MIGRACOES)
    .filter((f) => f.endsWith(".sql") && f < ARQUIVO_010)
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
 * Um banco novo no estado de produção antes da 010: 001 a 009 aplicadas e
 * registradas em `plataforma.migracoes`. A tabela de controle nasce antes,
 * como em `migrar()`, porque a 009 a referencia. A 010 fica por conta do teste.
 */
async function bancoAte009(): Promise<BancoDescartavel> {
  const nome = `m010_${randomUUID().slice(0, 8)}`;
  await poolDoDono().query(`create database ${nome}`);
  const pool = new Pool({ connectionString: urlDoBanco(nome), max: 2 });
  await pool.query("create schema if not exists plataforma");
  await pool.query(
    "create table plataforma.migracoes (nome text primary key, aplicada_em timestamptz not null default now())",
  );
  for (const arquivo of ate009()) {
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

async function espaco(pool: Pool, id: string): Promise<void> {
  await pool.query("insert into plataforma.workspaces (workspace_id) values ($1)", [id]);
}

async function registro(pool: Pool, workspaceId: string, colecao: string, id: string, dados: object): Promise<void> {
  await pool.query(
    "insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, $2, $3, $4::jsonb)",
    [workspaceId, colecao, id, JSON.stringify(dados)],
  );
}

async function dadosDe(pool: Pool): Promise<Record<string, unknown>> {
  const { rows } = await pool.query<{ chave: string; dados: unknown }>(
    "select workspace_id || '/' || colecao || '/' || id as chave, dados from plataforma.registros order by 1",
  );
  return Object.fromEntries(rows.map((r) => [r.chave, r.dados]));
}

async function revisoes(pool: Pool): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ workspace_id: string; revisao: string }>(
    "select workspace_id, revisao from plataforma.workspaces order by 1",
  );
  return Object.fromEntries(rows.map((r) => [r.workspace_id, Number(r.revisao)]));
}

/** As três contagens que o dono roda em produção (10-PROVAS.md). */
async function contagens(pool: Pool): Promise<[number, number, number]> {
  const q = async (sql: string) => Number((await pool.query<{ n: string }>(sql)).rows[0]!.n);
  return [
    await q("select count(*) as n from plataforma.registros where colecao = 'views' and dados->>'kind' = 'carga'"),
    await q("select count(*) as n from plataforma.registros where colecao = 'lists' and dados ? 'blocks'"),
    await q("select count(*) as n from plataforma.registros where colecao = 'lists' and dados->'blocks' <> '{}'::jsonb"),
  ];
}

/** O Espaço A tem tudo; o B nada a converter; o C só Lista com `blocks` vazio. */
async function semear(pool: Pool): Promise<void> {
  for (const id of ["ws_a", "ws_b", "ws_c"]) await espaco(pool, id);
  await registro(pool, "ws_a", "views", "v_carga", { id: "v_carga", name: "Carga", kind: "carga", listId: "l1" });
  await registro(pool, "ws_a", "views", "v_quadro", { id: "v_quadro", name: "Quadro", kind: "quadro", listId: "l1" });
  await registro(pool, "ws_a", "lists", "l1", { id: "l1", name: "Lista 1", blocks: {} });
  await registro(pool, "ws_a", "lists", "l2", { id: "l2", name: "Lista 2", blocks: { statusSet: true } });
  await registro(pool, "ws_a", "lists", "l3", { id: "l3", name: "Lista 3" });
  await registro(pool, "ws_a", "folders", "f1", { id: "f1", name: "Pasta", blocks: { statusSet: true } });
  await registro(pool, "ws_a", "spaces", "s1", { id: "s1", name: "Espaço", blocks: {} });
  await registro(pool, "ws_a", "automations", "x1", { id: "x1", kind: "carga", blocks: {} });
  await registro(pool, "ws_b", "views", "v_q2", { id: "v_q2", name: "Quadro", kind: "quadro" });
  await registro(pool, "ws_b", "lists", "l9", { id: "l9", name: "Lista 9" });
  await registro(pool, "ws_b", "folders", "f9", { id: "f9", name: "Pasta 9", blocks: {} });
  await registro(pool, "ws_c", "lists", "l8", { id: "l8", name: "Lista 8", blocks: {} });
}

describeComBanco("010 — carga vira lista, Lista perde blocks (D-18) — Postgres local", () => {
  afterAll(async () => {
    await encerrar();
  });

  it("(a) converte só o previsto: contagens 0/0/0 e nenhuma outra coleção, kind ou Espaço muda", async () => {
    const banco = await bancoAte009();
    try {
      await semear(banco.pool);
      expect(await contagens(banco.pool)).toEqual([1, 3, 1]);
      const antes = await dadosDe(banco.pool);

      await banco.pool.query(TEXTO_010);

      expect(await contagens(banco.pool)).toEqual([0, 0, 0]);
      const depois = await dadosDe(banco.pool);
      expect(depois["ws_a/views/v_carga"]).toEqual({ id: "v_carga", name: "Carga", kind: "lista", listId: "l1" });
      expect(depois["ws_a/lists/l1"]).toEqual({ id: "l1", name: "Lista 1" });
      expect(depois["ws_a/lists/l2"]).toEqual({ id: "l2", name: "Lista 2" });
      expect(depois["ws_c/lists/l8"]).toEqual({ id: "l8", name: "Lista 8" });

      // Tudo o mais, byte a byte igual: outro kind, outras coleções, blocks de Espaço e de Pasta.
      const mudaram = Object.keys(antes).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]));
      expect(mudaram.sort()).toEqual(["ws_a/lists/l1", "ws_a/lists/l2", "ws_a/views/v_carga", "ws_c/lists/l8"]);
      expect(Object.keys(depois).sort()).toEqual(Object.keys(antes).sort());
      expect(depois["ws_a/views/v_quadro"]).toEqual(antes["ws_a/views/v_quadro"]);
      expect(depois["ws_a/folders/f1"]).toEqual({ id: "f1", name: "Pasta", blocks: { statusSet: true } });
      expect(depois["ws_a/spaces/s1"]).toEqual({ id: "s1", name: "Espaço", blocks: {} });
      expect(depois["ws_a/automations/x1"]).toEqual({ id: "x1", kind: "carga", blocks: {} });
      expect(depois["ws_b/folders/f9"]).toEqual({ id: "f9", name: "Pasta 9", blocks: {} });

      // A6: só os Espaços com linha alterada sobem a revisão (o B não teve nada a converter).
      expect(await revisoes(banco.pool)).toEqual({ ws_a: 2, ws_b: 1, ws_c: 2 });
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(b) rodar o texto de novo não acha linha e não muda nada (idempotente)", async () => {
    const banco = await bancoAte009();
    try {
      await semear(banco.pool);
      await banco.pool.query(TEXTO_010);
      const dados = await dadosDe(banco.pool);
      const revisao = await revisoes(banco.pool);

      await banco.pool.query(TEXTO_010);
      await banco.pool.query(TEXTO_010);

      expect(await dadosDe(banco.pool)).toEqual(dados);
      expect(await revisoes(banco.pool)).toEqual(revisao);
      expect(await contagens(banco.pool)).toEqual([0, 0, 0]);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(c) num banco sem nenhuma Visualização nem Lista a 010 aplica sem erro e nada muda", async () => {
    const banco = await bancoAte009();
    try {
      await espaco(banco.pool, "ws_vazio");
      await registro(banco.pool, "ws_vazio", "spaces", "s1", { id: "s1", name: "Espaço", blocks: {} });

      await expect(banco.pool.query(TEXTO_010)).resolves.toBeDefined();

      expect(await revisoes(banco.pool)).toEqual({ ws_vazio: 1 });
      expect((await dadosDe(banco.pool))["ws_vazio/spaces/s1"]).toEqual({ id: "s1", name: "Espaço", blocks: {} });

      // E sem nenhum Espaço de Trabalho: a tabela de revisões vazia também não atrapalha.
      const semNada = await bancoAte009();
      try {
        await expect(semNada.pool.query(TEXTO_010)).resolves.toBeDefined();
      } finally {
        await semNada.encerrar();
      }
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(d) a pós-condição, sozinha, só dispara com uma ou mais linhas remanescentes", async () => {
    expect(POS_CONDICAO.startsWith("-- POS-CONDICAO")).toBe(true);
    const banco = await bancoAte009();
    try {
      await espaco(banco.pool, "ws_a");

      // Zero linhas a converter: passa.
      await expect(banco.pool.query(POS_CONDICAO)).resolves.toBeDefined();

      // Uma Visualização carga remanescente: dispara, com a mensagem que começa por "010:".
      await registro(banco.pool, "ws_a", "views", "v_carga", { id: "v_carga", kind: "carga" });
      await expect(banco.pool.query(POS_CONDICAO)).rejects.toThrow(/^010:/);

      // Convertida, passa de novo; e uma Lista com blocks remanescente também dispara.
      await banco.pool.query("update plataforma.registros set dados = jsonb_set(dados, '{kind}', '\"lista\"')");
      await expect(banco.pool.query(POS_CONDICAO)).resolves.toBeDefined();
      await registro(banco.pool, "ws_a", "lists", "l1", { id: "l1", blocks: {} });
      await expect(banco.pool.query(POS_CONDICAO)).rejects.toThrow(/^010:/);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(e) pelo migrar(): uma 010 interrompida não deixa dado alterado nem registro; depois aplica", async () => {
    const banco = await bancoAte009();
    try {
      await semear(banco.pool);
      const antes = await dadosDe(banco.pool);
      const revisaoAntes = await revisoes(banco.pool);

      // Interrompe a 010 no meio: um gatilho de teste recusa a atualização de Lista.
      await banco.pool.query(`
        create function plataforma.m010_recusa() returns trigger language plpgsql as $$
        begin raise exception 'interrompida'; end $$;
        create trigger m010_recusa before update on plataforma.registros
          for each row when (new.colecao = 'lists') execute function plataforma.m010_recusa();
      `);

      await expect(migrar(banco.pool)).rejects.toThrow(/010-carga-e-bloqueio-da-lista\.sql.*falhou/);

      expect(await dadosDe(banco.pool)).toEqual(antes);
      expect(await revisoes(banco.pool)).toEqual(revisaoAntes);
      const registrada = await banco.pool.query("select 1 from plataforma.migracoes where nome = $1", [ARQUIVO_010]);
      expect(registrada.rowCount).toBe(0);

      // Sem o gatilho, a mesma 010 aplica e registra.
      await banco.pool.query("drop trigger m010_recusa on plataforma.registros");
      const aplicadas = await migrar(banco.pool);
      expect(aplicadas.map((a) => a.nome)).toEqual([ARQUIVO_010]);
      expect(await contagens(banco.pool)).toEqual([0, 0, 0]);
      expect(await revisoes(banco.pool)).toEqual({ ws_a: 2, ws_b: 1, ws_c: 2 });
      const agora = await banco.pool.query("select 1 from plataforma.migracoes where nome = $1", [ARQUIVO_010]);
      expect(agora.rowCount).toBe(1);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);
});

// Os blocos acima pulam sem Postgres local; este não, para o arquivo nunca ficar "sem teste".
describe("010 — o arquivo", () => {
  it("é só de dados: nenhum comando de esquema nem de privilégio, e traz a pós-condição", () => {
    expect(TEXTO_010).not.toMatch(/\b(create|alter|drop|grant|revoke)\b/i);
    expect(TEXTO_010).toContain("-- POS-CONDICAO");
    expect(TEXTO_010).toContain("raise exception '010:");
  });
});
