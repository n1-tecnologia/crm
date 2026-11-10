/**
 * A `013` (16-03, 3.6.4 e 3.7.1): `plataforma.webhooks_recebidos`, a fila de entrada da mensageria, e o índice
 * único parcial do `mensagem.enviar.v1` no outbox.
 *
 * Provas contra o Postgres LOCAL (`testes/banco-crm.ts`, nunca o do Supabase), cada caso num banco descartável
 * `m013_<8>` com as migrações 001 a 012 aplicadas e registradas — a 013 é executada pelo TEXTO do arquivo, como
 * `migrar()` faz:
 *
 *  (a) o estado fora da lista, as tentativas negativas, o Canal que não existe e a chave repetida são recusados
 *      pela restrição com nome; dois `mensagem.enviar.v1` do mesmo agregado dão 23505 no índice único;
 *  (b) rodar o texto duas vezes não falha nem muda dado (idempotência);
 *  (c) pelo `migrar()` de verdade: uma 013 que falha no FIM (no último índice) não deixa linha em
 *      `plataforma.migracoes` nem a tabela, e a mesma 013 aplica depois;
 *  (d) a tabela nasce sem RLS, e o bloco da 013 a desliga se o projeto a ligar;
 *  (e) o SQL, sem os comentários, não concede privilégio;
 *  (f) nenhuma linha de `plataforma.registros` muda, e a tabela nasce vazia.
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
const ARQUIVO_013 = "013-mensageria.sql";
const TEXTO_013 = readFileSync(join(PASTA_DE_MIGRACOES, ARQUIVO_013), "utf8");

/** O SQL sem as linhas de comentário: o cabeçalho cita `grant` justamente para dizer que não entra. */
const SQL_013 = TEXTO_013.split("\n").filter((linha) => !linha.trimStart().startsWith("--")).join("\n");

/** Os arquivos `.sql` anteriores à 013, na ordem em que `migrar()` os aplica. */
const ate012 = () =>
  readdirSync(PASTA_DE_MIGRACOES)
    .filter((f) => f.endsWith(".sql") && f < ARQUIVO_013)
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
 * Um banco novo no estado de produção antes da 013: 001 a 012 aplicadas e registradas em
 * `plataforma.migracoes`. A tabela de controle nasce antes, como em `migrar()`, porque a 009 a referencia.
 */
async function bancoAte012(): Promise<BancoDescartavel> {
  const nome = `m013_${randomUUID().slice(0, 8)}`;
  await poolDoDono().query(`create database ${nome}`);
  const pool = new Pool({ connectionString: urlDoBanco(nome), max: 2 });
  await pool.query("create schema if not exists plataforma");
  await pool.query("create table plataforma.migracoes (nome text primary key, aplicada_em timestamptz not null default now())");
  for (const arquivo of ate012()) {
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

const WS = "ws_m013";

/** O erro do `pg` de uma consulta que deve falhar: `code` e `constraint`. */
async function recusa(consulta: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
  try {
    await consulta;
  } catch (erro) {
    return erro as { code?: string; constraint?: string };
  }
  throw new Error("esperava a recusa do banco, mas a consulta passou");
}

async function semearCanal(pool: Pool, workspaceId = WS): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `insert into plataforma.canais (workspace_id, nome, tipo, provedor, identificador_externo, configurado_por, criado_por)
     values ($1, 'Comercial', 'whatsapp', 'whatsapp-nao-oficial', '+5511977770001', 'mem_a', 'mem_a')
     returning id`,
    [workspaceId],
  );
  return r.rows[0]!.id;
}

function inserirChamada(pool: Pool, canalId: string, campos: { estado?: string; tentativas?: number; chave?: string | null; workspaceId?: string } = {}) {
  return pool.query(
    `insert into plataforma.webhooks_recebidos (workspace_id, canal_id, provedor, chave, corpo, estado, tentativas)
     values ($1, $2, 'teste', $3, '{"eventos":[]}'::jsonb, $4, $5)`,
    [campos.workspaceId ?? WS, canalId, campos.chave === undefined ? null : campos.chave, campos.estado ?? "pendente", campos.tentativas ?? 0],
  );
}

function inserirEnvio(pool: Pool, agregado: string, evento = "mensagem.enviar.v1", workspaceId = WS) {
  return pool.query(
    `insert into plataforma.integration_outbox (workspace_id, aggregate_type, aggregate_id, event_type, payload)
     values ($1, 'mensagem', $2, $3, '{}'::jsonb)`,
    [workspaceId, agregado, evento],
  );
}

describeComBanco("013 — a fila de entrada da mensageria — Postgres local", () => {
  afterAll(async () => {
    await encerrar();
  });

  it("(a) recusa estado, tentativas, Canal e chave inválidos pela restrição com nome, e o segundo mensagem.enviar.v1 do agregado", async () => {
    const banco = await bancoAte012();
    try {
      await banco.pool.query(TEXTO_013);
      const canalId = await semearCanal(banco.pool);

      for (const estado of ["pendente", "processando", "processado", "falhou"]) {
        await expect(inserirChamada(banco.pool, canalId, { estado })).resolves.toBeDefined();
      }
      expect(await recusa(inserirChamada(banco.pool, canalId, { estado: "talvez" }))).toMatchObject({ code: "23514", constraint: "webhooks_recebidos_estado_ck" });
      expect(await recusa(inserirChamada(banco.pool, canalId, { tentativas: -1 }))).toMatchObject({ code: "23514", constraint: "webhooks_recebidos_tentativas_ck" });

      // A chamada pertence a um Canal que existe, no mesmo Espaço.
      expect(await recusa(inserirChamada(banco.pool, "canal_que_nao_existe"))).toMatchObject({ code: "23503", constraint: "webhooks_recebidos_canal_fk" });
      expect(await recusa(inserirChamada(banco.pool, canalId, { workspaceId: "ws_de_outro" }))).toMatchObject({ code: "23503", constraint: "webhooks_recebidos_canal_fk" });

      // A chave repetida no mesmo Canal é a mesma chamada; sem chave, nada colide.
      await inserirChamada(banco.pool, canalId, { chave: "e1" });
      expect(await recusa(inserirChamada(banco.pool, canalId, { chave: "e1" }))).toMatchObject({ code: "23505", constraint: "webhooks_recebidos_chave_uq" });
      await expect(inserirChamada(banco.pool, canalId)).resolves.toBeDefined();

      // O `mensagem.enviar.v1`: um por Mensagem; os outros eventos e outras Mensagens não são afetados.
      await inserirEnvio(banco.pool, "msg_1");
      expect(await recusa(inserirEnvio(banco.pool, "msg_1"))).toMatchObject({ code: "23505", constraint: "integration_outbox_mensagem_enviar_uniq" });
      await expect(inserirEnvio(banco.pool, "msg_2")).resolves.toBeDefined();
      await expect(inserirEnvio(banco.pool, "msg_1", "outro.evento.v1")).resolves.toBeDefined();
      await expect(inserirEnvio(banco.pool, "msg_1", "mensagem.enviar.v1", "ws_de_outro")).resolves.toBeDefined();
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(b) rodar o texto duas vezes seguidas não falha e não muda o dado", async () => {
    const banco = await bancoAte012();
    try {
      await banco.pool.query(TEXTO_013);
      const canalId = await semearCanal(banco.pool);
      await inserirChamada(banco.pool, canalId, { chave: "e1" });
      const retrato = async () => JSON.stringify((await banco.pool.query("select * from plataforma.webhooks_recebidos order by id")).rows);
      const antes = await retrato();

      await expect(banco.pool.query(TEXTO_013)).resolves.toBeDefined();
      await expect(banco.pool.query(TEXTO_013)).resolves.toBeDefined();

      expect(await retrato()).toBe(antes);
      const indices = await banco.pool.query<{ indexname: string }>(
        `select indexname from pg_indexes
          where schemaname = 'plataforma'
            and indexname in ('webhooks_recebidos_pendente_idx', 'webhooks_recebidos_processando_idx', 'webhooks_recebidos_chave_uq', 'integration_outbox_mensagem_enviar_uniq')
          order by indexname`,
      );
      expect(indices.rows.map((r) => r.indexname)).toEqual([
        "integration_outbox_mensagem_enviar_uniq",
        "webhooks_recebidos_chave_uq",
        "webhooks_recebidos_pendente_idx",
        "webhooks_recebidos_processando_idx",
      ]);
      const restricoes = await banco.pool.query<{ conname: string }>(
        "select conname from pg_constraint where conrelid = 'plataforma.webhooks_recebidos'::regclass and conname like 'webhooks_recebidos_%' order by conname",
      );
      expect(restricoes.rows.map((r) => r.conname)).toEqual(["webhooks_recebidos_canal_fk", "webhooks_recebidos_estado_ck", "webhooks_recebidos_pkey", "webhooks_recebidos_tentativas_ck"]);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(c) pelo migrar(): uma 013 que falha no fim não deixa registro nem tabela; depois aplica", async () => {
    const banco = await bancoAte012();
    try {
      // Interrompe a 013 no ÚLTIMO índice (o do outbox), depois de a tabela, as restrições e os outros índices
      // já terem sido criados: um gatilho de evento de teste recusa só esse `create index`.
      await banco.pool.query(`
        create function public.m013_recusa() returns event_trigger language plpgsql as $$
        begin
          if exists (select 1 from pg_event_trigger_ddl_commands() where object_identity like '%integration_outbox_mensagem_enviar_uniq%') then
            raise exception 'interrompida no fim';
          end if;
        end $$;
        create event trigger m013_recusa on ddl_command_end when tag in ('CREATE INDEX') execute function public.m013_recusa();
      `);

      await expect(migrar(banco.pool)).rejects.toThrow(/013-mensageria\.sql.*falhou/);

      const registrada = await banco.pool.query("select 1 from plataforma.migracoes where nome = $1", [ARQUIVO_013]);
      expect(registrada.rowCount).toBe(0);
      const sobrou = await banco.pool.query("select to_regclass('plataforma.webhooks_recebidos') as tabela");
      expect(sobrou.rows[0]).toEqual({ tabela: null });

      // Sem o gatilho, a mesma 013 aplica e registra.
      await banco.pool.query("drop event trigger m013_recusa");
      const aplicadas = await migrar(banco.pool);
      // A 013 volta a ser a primeira a aplicar; as migrações que vieram depois dela (014 em diante) aplicam em seguida.
      expect(aplicadas.map((a) => a.nome)[0]).toBe(ARQUIVO_013);
      const agora = await banco.pool.query("select 1 from plataforma.migracoes where nome = $1", [ARQUIVO_013]);
      expect(agora.rowCount).toBe(1);
      expect((await banco.pool.query("select to_regclass('plataforma.webhooks_recebidos') as tabela")).rows[0]?.tabela).toBe("plataforma.webhooks_recebidos");
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(d) a tabela nasce sem RLS, e o bloco da 013 a desliga se o projeto a ligar", async () => {
    const banco = await bancoAte012();
    try {
      await banco.pool.query(TEXTO_013);
      const rls = async () =>
        (await banco.pool.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid = 'plataforma.webhooks_recebidos'::regclass")).rows[0]!
          .relrowsecurity;
      expect(await rls()).toBe(false);

      // O que o event trigger `ensure_rls` do Supabase faria numa tabela nova: ligar a RLS sem policy.
      await banco.pool.query("alter table plataforma.webhooks_recebidos enable row level security");
      expect(await rls()).toBe(true);

      await banco.pool.query(TEXTO_013);
      expect(await rls()).toBe(false);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(f) não mexe em plataforma.registros, e a tabela nasce vazia", async () => {
    const banco = await bancoAte012();
    try {
      await banco.pool.query("insert into plataforma.workspaces (workspace_id) values ($1)", [WS]);
      for (const [colecao, id] of [["contacts", "cnt_1"], ["conversations", "cnv_1"], ["deals", "dl_1"]] as const) {
        await banco.pool.query("insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, $2, $3, $4::jsonb)", [WS, colecao, id, JSON.stringify({ id, nome: "dado real" })]);
      }
      const retrato = async () => JSON.stringify((await banco.pool.query("select * from plataforma.registros order by colecao, id")).rows);
      const antes = await retrato();
      const revisaoAntes = (await banco.pool.query("select revisao from plataforma.workspaces where workspace_id = $1", [WS])).rows[0];

      await banco.pool.query(TEXTO_013);

      expect(await retrato()).toBe(antes);
      expect((await banco.pool.query("select revisao from plataforma.workspaces where workspace_id = $1", [WS])).rows[0]).toEqual(revisaoAntes);
      const { rows } = await banco.pool.query<{ n: string }>("select count(*) as n from plataforma.webhooks_recebidos");
      expect(Number(rows[0]!.n)).toBe(0);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);
});

// O bloco acima pula sem Postgres local; este não, para o arquivo nunca ficar "sem teste".
describe("013 — o arquivo", () => {
  it("(e) é idempotente por escrito, desliga a RLS e não concede privilégio", () => {
    expect(SQL_013).toContain("disable row level security");
    expect(SQL_013).not.toMatch(/\bgrant\b/i);
    // Não escreve em `plataforma.registros` (D-03): só o cabeçalho, em comentário, o cita.
    expect(SQL_013).not.toMatch(/plataforma\.registros\b/);
    // Toda criação de tabela e de índice é `if not exists`.
    const criacoes = SQL_013.match(/create (?:unique )?(?:table|index) [^\n]*/g) ?? [];
    expect(criacoes.length).toBe(5);
    expect(criacoes.every((c) => c.includes("if not exists"))).toBe(true);
    // Toda restrição por `alter table` é precedida do `drop constraint if exists` do mesmo nome.
    for (const nome of ["webhooks_recebidos_estado_ck", "webhooks_recebidos_tentativas_ck", "webhooks_recebidos_canal_fk"]) {
      expect(SQL_013).toContain(`drop constraint if exists ${nome}`);
      expect(SQL_013).toContain(`add constraint ${nome}`);
    }
    for (const nome of ["webhooks_recebidos_pendente_idx", "webhooks_recebidos_processando_idx", "webhooks_recebidos_chave_uq", "integration_outbox_mensagem_enviar_uniq"]) {
      expect(SQL_013).toContain(nome);
    }
  });
});
