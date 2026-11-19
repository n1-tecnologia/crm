/**
 * A `017` (17-04, D-17-05): `plataforma.email_contas`, `plataforma.cursores_de_canal` e `plataforma.mensagens.corpo_html`.
 *
 * Provas contra o Postgres LOCAL (`testes/banco-crm.ts`, nunca o do Supabase), cada caso num banco descartável
 * `m017_<8>` com as migrações 001 a 016 aplicadas e registradas — a 017 é executada pelo TEXTO do arquivo, como
 * `migrar()` faz:
 *
 *  (a) a conta recusa porta fora de 1 a 65535, tipo de login desconhecido, endereço vazio, queda pela metade e Canal que
 *      não existe, e some com o Canal (cascata); o cursor tem a chave (Espaço, Canal, pasta), recusa `proximo_uid` menor
 *      que 1 e `uidvalidity` que não é número, e some com a conta;
 *  (b) `mensagens.corpo_html` aceita nulo e `{ objectKey, tamanhoBytes }`, e recusa o que não tem `objectKey`;
 *  (c) rodar o texto duas vezes não falha nem muda dado (idempotência);
 *  (d) pelo `migrar()`: antes dela a 017 está pendente, depois aplicada e nada pendente (o que `migrar --seco` lista);
 *  (e) as tabelas nascem sem RLS, e o bloco da 017 as desliga se o projeto as ligar;
 *  (f) nenhuma coluna das tabelas novas guarda segredo, e o SQL, sem os comentários, não concede privilégio.
 */

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { describeComBanco, poolDoDono } from "../testes/banco-crm";
import { encerrar } from "./conexao";
import { migracoesPendentes, migrar } from "./migrar";

const PASTA_DE_MIGRACOES = fileURLToPath(new URL("../../migracoes", import.meta.url));
const ARQUIVO_017 = "017-email.sql";
const TEXTO_017 = readFileSync(join(PASTA_DE_MIGRACOES, ARQUIVO_017), "utf8");

/** O SQL sem as linhas de comentário: o cabeçalho cita `grant` justamente para dizer que não entra. */
const SQL_017 = TEXTO_017.split("\n").filter((linha) => !linha.trimStart().startsWith("--")).join("\n");

/** Os arquivos `.sql` anteriores à 017, na ordem em que `migrar()` os aplica. */
const ate016 = () =>
  readdirSync(PASTA_DE_MIGRACOES)
    .filter((f) => f.endsWith(".sql") && f < ARQUIVO_017)
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
 * Um banco novo no estado de produção antes da 017: 001 a 016 aplicadas e registradas em `plataforma.migracoes`.
 * A tabela de controle nasce antes, como em `migrar()`, porque a 009 a referencia.
 */
async function bancoAte016(): Promise<BancoDescartavel> {
  const nome = `m017_${randomUUID().slice(0, 8)}`;
  await poolDoDono().query(`create database ${nome}`);
  const pool = new Pool({ connectionString: urlDoBanco(nome), max: 2 });
  await pool.query("create schema if not exists plataforma");
  await pool.query("create table plataforma.migracoes (nome text primary key, aplicada_em timestamptz not null default now())");
  for (const arquivo of ate016()) {
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

const WS = "ws_m017";

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
     values ($1, 'Vendas', 'email', 'email-imap-smtp', 'vendas@caixa.teste', 'mem_a', 'mem_a')
     returning id`,
    [workspaceId],
  );
  return r.rows[0]!.id;
}

interface CamposDaConta {
  workspaceId?: string;
  endereco?: string;
  tipoDeLogin?: string;
  imapPorta?: number;
  smtpPorta?: number;
  appendEnviados?: string;
  motivoDaQueda?: string | null;
  caiuEm?: string | null;
}

function inserirConta(pool: Pool, canalId: string, c: CamposDaConta = {}) {
  return pool.query(
    `insert into plataforma.email_contas
       (workspace_id, canal_id, endereco, tipo_de_login, imap_host, imap_porta, smtp_host, smtp_porta, append_enviados,
        motivo_da_queda, caiu_em, conectada_por)
     values ($1, $2, $3, $4, 'imap.caixa.teste', $5, 'smtp.caixa.teste', $6, $7, $8, $9, 'mem_a')`,
    [
      c.workspaceId ?? WS,
      canalId,
      c.endereco ?? "vendas@caixa.teste",
      c.tipoDeLogin ?? "senha",
      c.imapPorta ?? 993,
      c.smtpPorta ?? 465,
      c.appendEnviados ?? "auto",
      c.motivoDaQueda ?? null,
      c.caiuEm ?? null,
    ],
  );
}

function inserirCursor(pool: Pool, canalId: string, c: { pasta?: string; uidvalidity?: string; proximoUid?: number } = {}) {
  return pool.query(
    `insert into plataforma.cursores_de_canal (workspace_id, canal_id, pasta, uidvalidity, proximo_uid)
     values ($1, $2, $3, $4, $5)`,
    [WS, canalId, c.pasta ?? "INBOX", c.uidvalidity ?? "4294967296", c.proximoUid ?? 1],
  );
}

/** Uma Mensagem interna mínima (precisa de Contato e Conversa), devolve o id. */
async function semearMensagem(pool: Pool, canalId: string, corpoHtml: unknown): Promise<string> {
  await pool.query("insert into plataforma.contatos (workspace_id, id, proprietario_id, criado_por) values ($1, 'cnt_1', 'mem_a', 'mem_a') on conflict do nothing", [WS]);
  const conversa = await pool.query<{ id: string }>(
    `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, criado_por_tipo, criado_por_id)
     values ($1, $2, 'cnt_1', 'Assunto', 'membro', 'mem_a')
     on conflict do nothing returning id`,
    [WS, canalId],
  );
  const conversaId = conversa.rows[0]?.id ?? (await pool.query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1", [WS])).rows[0]!.id;
  const m = await pool.query<{ id: string }>(
    `insert into plataforma.mensagens (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo, corpo_html)
     values ($1, $2, $3, 'interna', 'member', 'mem_a', 'texto', $4::jsonb) returning id`,
    [WS, conversaId, canalId, corpoHtml === null ? null : JSON.stringify(corpoHtml)],
  );
  return m.rows[0]!.id;
}

describeComBanco("017 — a conta de e-mail, o cursor e o corpo_html — Postgres local", () => {
  afterAll(async () => {
    await encerrar();
  });

  it("(a) a conta e o cursor recusam o inválido pela restrição com nome e somem em cascata", async () => {
    const banco = await bancoAte016();
    try {
      await banco.pool.query(TEXTO_017);
      const canalId = await semearCanal(banco.pool);

      // Portas: 0 e 70000 fora, 1 e 65535 dentro (as PERMITIDAS são regra da guarda de rede, não do banco).
      expect(await recusa(inserirConta(banco.pool, canalId, { imapPorta: 0 }))).toMatchObject({ code: "23514", constraint: "email_contas_imap_porta_ck" });
      expect(await recusa(inserirConta(banco.pool, canalId, { imapPorta: 70000 }))).toMatchObject({ code: "23514", constraint: "email_contas_imap_porta_ck" });
      expect(await recusa(inserirConta(banco.pool, canalId, { smtpPorta: 0 }))).toMatchObject({ code: "23514", constraint: "email_contas_smtp_porta_ck" });
      expect(await recusa(inserirConta(banco.pool, canalId, { smtpPorta: 65536 }))).toMatchObject({ code: "23514", constraint: "email_contas_smtp_porta_ck" });
      expect(await recusa(inserirConta(banco.pool, canalId, { tipoDeLogin: "outro" }))).toMatchObject({ code: "23514", constraint: "email_contas_tipo_de_login_ck" });
      expect(await recusa(inserirConta(banco.pool, canalId, { endereco: "   " }))).toMatchObject({ code: "23514", constraint: "email_contas_endereco_ck" });
      expect(await recusa(inserirConta(banco.pool, canalId, { appendEnviados: "talvez" }))).toMatchObject({ code: "23514", constraint: "email_contas_append_enviados_ck" });
      // O motivo e o instante da queda andam juntos.
      expect(await recusa(inserirConta(banco.pool, canalId, { motivoDaQueda: "recusou o login" }))).toMatchObject({ code: "23514", constraint: "email_contas_queda_ck" });
      // A conta pertence a um Canal que existe, no mesmo Espaço.
      expect(await recusa(inserirConta(banco.pool, "canal_que_nao_existe"))).toMatchObject({ code: "23503" });
      expect(await recusa(inserirConta(banco.pool, canalId, { workspaceId: "ws_de_outro" }))).toMatchObject({ code: "23503" });

      for (const [tipoDeLogin, imapPorta, smtpPorta] of [["senha", 1, 65535], ["google", 993, 465], ["microsoft", 993, 587]] as const) {
        const outro = await semearCanalDeNome(banco.pool, `Vendas ${tipoDeLogin}`, `${tipoDeLogin}@caixa.teste`);
        await expect(inserirConta(banco.pool, outro, { tipoDeLogin, imapPorta, smtpPorta })).resolves.toBeDefined();
      }
      // Uma conta por Canal.
      await inserirConta(banco.pool, canalId);
      expect(await recusa(inserirConta(banco.pool, canalId))).toMatchObject({ code: "23505", constraint: "email_contas_pkey" });

      // Cursor: chave (Espaço, Canal, pasta); `uidvalidity` em texto, inclusive acima de 2^32.
      await inserirCursor(banco.pool, canalId, { uidvalidity: "9007199254740993", proximoUid: 7 });
      const lido = await banco.pool.query<{ uidvalidity: string }>("select uidvalidity from plataforma.cursores_de_canal where canal_id = $1", [canalId]);
      expect(lido.rows[0]!.uidvalidity).toBe("9007199254740993");
      expect(await recusa(inserirCursor(banco.pool, canalId))).toMatchObject({ code: "23505", constraint: "cursores_de_canal_pkey" });
      await expect(inserirCursor(banco.pool, canalId, { pasta: "Arquivo" })).resolves.toBeDefined();
      expect(await recusa(inserirCursor(banco.pool, canalId, { pasta: "Outra", proximoUid: 0 }))).toMatchObject({ code: "23514", constraint: "cursores_de_canal_proximo_uid_ck" });
      expect(await recusa(inserirCursor(banco.pool, canalId, { pasta: "Outra", uidvalidity: "abc" }))).toMatchObject({ code: "23514", constraint: "cursores_de_canal_uidvalidity_ck" });
      // O cursor pertence a uma conta que existe.
      const semConta = await semearCanalDeNome(banco.pool, "Sem conta", "sem@caixa.teste");
      expect(await recusa(inserirCursor(banco.pool, semConta))).toMatchObject({ code: "23503" });

      // Apagar a conta apaga o cursor; apagar o Canal apaga a conta e (por ela) o cursor.
      await banco.pool.query("delete from plataforma.email_contas where workspace_id = $1 and canal_id = $2", [WS, canalId]);
      expect((await banco.pool.query("select 1 from plataforma.cursores_de_canal where canal_id = $1", [canalId])).rowCount).toBe(0);
      await inserirConta(banco.pool, canalId);
      await inserirCursor(banco.pool, canalId);
      await banco.pool.query("delete from plataforma.canais where workspace_id = $1 and id = $2", [WS, canalId]);
      expect((await banco.pool.query("select 1 from plataforma.email_contas where canal_id = $1", [canalId])).rowCount).toBe(0);
      expect((await banco.pool.query("select 1 from plataforma.cursores_de_canal where canal_id = $1", [canalId])).rowCount).toBe(0);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(b) mensagens.corpo_html aceita nulo e { objectKey, tamanhoBytes } e recusa o que não tem objectKey", async () => {
    const banco = await bancoAte016();
    try {
      await banco.pool.query(TEXTO_017);
      const canalId = await semearCanal(banco.pool);
      await expect(semearMensagem(banco.pool, canalId, null)).resolves.toBeDefined();
      const id = await semearMensagem(banco.pool, canalId, { objectKey: `workspace/${WS}/entrada/${canalId}/corpo.html`, tamanhoBytes: 10 });
      const lida = await banco.pool.query<{ corpo_html: { objectKey: string; tamanhoBytes: number } }>("select corpo_html from plataforma.mensagens where id = $1", [id]);
      expect(lida.rows[0]!.corpo_html.tamanhoBytes).toBe(10);

      for (const invalido of [{ tamanhoBytes: 10 }, [], "texto", 5]) {
        expect(await recusa(semearMensagem(banco.pool, canalId, invalido))).toMatchObject({ code: "23514", constraint: "mensagens_corpo_html_ck" });
      }
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(c) rodar o texto duas vezes seguidas não falha e não muda o dado", async () => {
    const banco = await bancoAte016();
    try {
      await banco.pool.query(TEXTO_017);
      const canalId = await semearCanal(banco.pool);
      await inserirConta(banco.pool, canalId);
      await inserirCursor(banco.pool, canalId);
      await semearMensagem(banco.pool, canalId, { objectKey: "k", tamanhoBytes: 1 });
      const retrato = async () =>
        JSON.stringify([
          (await banco.pool.query("select workspace_id, canal_id, endereco, imap_porta from plataforma.email_contas order by canal_id")).rows,
          (await banco.pool.query("select * from plataforma.cursores_de_canal order by canal_id, pasta")).rows,
          (await banco.pool.query("select id, corpo_html from plataforma.mensagens order by id")).rows,
        ]);
      const antes = await retrato();

      await expect(banco.pool.query(TEXTO_017)).resolves.toBeDefined();
      await expect(banco.pool.query(TEXTO_017)).resolves.toBeDefined();

      expect(await retrato()).toBe(antes);
      const restricoes = await banco.pool.query<{ conname: string }>(
        "select conname from pg_constraint where conrelid = 'plataforma.mensagens'::regclass and conname = 'mensagens_corpo_html_ck'",
      );
      expect(restricoes.rows).toHaveLength(1);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(d) pelo migrar(): a 017 está pendente antes, aplicada depois, e depois dela nada pendente (o que migrar --seco lista)", async () => {
    const banco = await bancoAte016();
    try {
      const antes = await migracoesPendentes(banco.pool);
      expect(antes.pendentes).toContain(ARQUIVO_017);
      expect(antes.pendentes[0]).toBe(ARQUIVO_017);
      expect((await banco.pool.query("select to_regclass('plataforma.email_contas') as t")).rows[0]?.t).toBeNull();

      const aplicadas = await migrar(banco.pool);
      expect(aplicadas.map((a) => a.nome)[0]).toBe(ARQUIVO_017);

      const depois = await migracoesPendentes(banco.pool);
      expect(depois.pendentes).toEqual([]);
      expect(depois.aplicadas).toContain(ARQUIVO_017);
      expect((await banco.pool.query("select to_regclass('plataforma.email_contas') as t")).rows[0]?.t).toBe("plataforma.email_contas");
      expect((await banco.pool.query("select to_regclass('plataforma.cursores_de_canal') as t")).rows[0]?.t).toBe("plataforma.cursores_de_canal");
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(e) as tabelas nascem sem RLS, e o bloco da 017 as desliga se o projeto as ligar", async () => {
    const banco = await bancoAte016();
    try {
      await banco.pool.query(TEXTO_017);
      const rls = async (tabela: string) =>
        (await banco.pool.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid = $1::regclass", [tabela])).rows[0]!.relrowsecurity;
      for (const tabela of ["plataforma.email_contas", "plataforma.cursores_de_canal"]) expect(await rls(tabela)).toBe(false);

      // O que o event trigger `ensure_rls` do Supabase faria numa tabela nova: ligar a RLS sem policy.
      await banco.pool.query("alter table plataforma.email_contas enable row level security");
      await banco.pool.query("alter table plataforma.cursores_de_canal enable row level security");
      expect(await rls("plataforma.email_contas")).toBe(true);

      await banco.pool.query(TEXTO_017);
      for (const tabela of ["plataforma.email_contas", "plataforma.cursores_de_canal"]) expect(await rls(tabela)).toBe(false);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(f) nenhuma coluna das tabelas novas guarda segredo (a credencial é só do cofre)", async () => {
    const banco = await bancoAte016();
    try {
      await banco.pool.query(TEXTO_017);
      const { rows } = await banco.pool.query<{ table_name: string; column_name: string }>(
        `select table_name, column_name from information_schema.columns
          where table_schema = 'plataforma'
            and (table_name in ('email_contas', 'cursores_de_canal') or (table_name = 'mensagens' and column_name = 'corpo_html'))`,
      );
      expect(rows.length).toBeGreaterThan(10);
      expect(rows.filter((c) => /senha|token|segredo|secret|password|refresh|credencial/i.test(c.column_name))).toEqual([]);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);
});

async function semearCanalDeNome(pool: Pool, nome: string, identificador: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `insert into plataforma.canais (workspace_id, nome, tipo, provedor, identificador_externo, configurado_por, criado_por)
     values ($1, $2, 'email', 'email-imap-smtp', $3, 'mem_a', 'mem_a') returning id`,
    [WS, nome, identificador],
  );
  return r.rows[0]!.id;
}

// O bloco acima pula sem Postgres local; este não, para o arquivo nunca ficar "sem teste".
describe("017 — o arquivo", () => {
  it("é idempotente por escrito, desliga a RLS, não concede privilégio e não escreve em registros", () => {
    expect(SQL_017).toContain("disable row level security");
    expect(SQL_017).not.toMatch(/\bgrant\b/i);
    expect(SQL_017).not.toMatch(/plataforma\.registros\b/);
    // Toda criação de tabela é `if not exists`, e a coluna nova também.
    const criacoes = SQL_017.match(/create table [^\n]*/g) ?? [];
    expect(criacoes.length).toBe(2);
    expect(criacoes.every((c) => c.includes("if not exists"))).toBe(true);
    expect(SQL_017).toContain("add column if not exists corpo_html");
    // A restrição por `alter table` é precedida do `drop constraint if exists` do mesmo nome.
    expect(SQL_017).toContain("drop constraint if exists mensagens_corpo_html_ck");
    expect(SQL_017).toContain("add constraint mensagens_corpo_html_ck");
    // As duas tabelas apagam em cascata com o Canal (a conta) e com a conta (o cursor).
    expect((SQL_017.match(/on delete cascade/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
