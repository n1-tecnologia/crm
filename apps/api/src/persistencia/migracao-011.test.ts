/**
 * A `011` (14-01, D-04/D-05): o que o modelo novo do CRM ganha para absorver o
 * antigo — o estado `mesclado` do Contato, consentimentos, notas, marcações da
 * Conversa, a data da lixeira da Conversa e as duas tabelas do script da Fase 15.
 *
 * Provas contra o Postgres LOCAL (`testes/banco-crm.ts`, nunca o do Supabase),
 * cada caso num banco descartável `m011_<8>` com as migrações 001 a 010
 * aplicadas e registradas — a 011 é executada pelo TEXTO do arquivo, como
 * `migrar()` faz:
 *
 *  (a) `mesclado` com alvo é aceito; sem alvo, com alvo inexistente ou apontando
 *      para si mesmo, é recusado pela constraint com nome;
 *  (b) o consentimento recusa decisão, tipo de canal e origem fora da lista;
 *  (c) a nota recusa conteúdo em branco;
 *  (d) a Conversa que já estava na lixeira ganha `na_lixeira_em` pelo backfill, e
 *      depois da 011 a lixeira sem data é recusada;
 *  (e) rodar o texto duas vezes não falha nem muda dado (idempotência);
 *  (f) pelo `migrar()` de verdade: uma 011 interrompida no meio não deixa linha em
 *      `plataforma.migracoes` nem a tabela `contato_notas`, e a mesma 011 aplica depois;
 *  (g) as cinco tabelas novas ficam sem RLS, e o bloco da 011 a desliga de novo;
 *  (h) D-05: nenhuma coluna de Grupo na Conversa nem de Flow na Mensagem;
 *  (i) D-03: nenhuma linha de `plataforma.registros` muda, e as tabelas de cópia nascem vazias.
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
const ARQUIVO_011 = "011-crm-o-que-faltava.sql";
const TEXTO_011 = readFileSync(join(PASTA_DE_MIGRACOES, ARQUIVO_011), "utf8");

/** O SQL sem as linhas de comentário: o cabeçalho cita `grant`, Grupo e Flow justamente para dizer que não entram. */
const SQL_011 = TEXTO_011.split("\n").filter((linha) => !linha.trimStart().startsWith("--")).join("\n");

/** As tabelas que a 011 cria. */
const TABELAS_NOVAS = ["contato_consentimentos", "contato_notas", "conversa_marcacoes", "crm_de_para", "registros_crm_antigo"] as const;

/** Os arquivos `.sql` anteriores à 011, na ordem em que `migrar()` os aplica. */
const ate010 = () =>
  readdirSync(PASTA_DE_MIGRACOES)
    .filter((f) => f.endsWith(".sql") && f < ARQUIVO_011)
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
 * Um banco novo no estado de produção antes da 011: 001 a 010 aplicadas e
 * registradas em `plataforma.migracoes`. A tabela de controle nasce antes,
 * como em `migrar()`, porque a 009 a referencia. A 011 fica por conta do teste.
 */
async function bancoAte010(): Promise<BancoDescartavel> {
  const nome = `m011_${randomUUID().slice(0, 8)}`;
  await poolDoDono().query(`create database ${nome}`);
  const pool = new Pool({ connectionString: urlDoBanco(nome), max: 2 });
  await pool.query("create schema if not exists plataforma");
  await pool.query("create table plataforma.migracoes (nome text primary key, aplicada_em timestamptz not null default now())");
  for (const arquivo of ate010()) {
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

const WS = "ws_m011";

async function contato(pool: Pool, id: string): Promise<void> {
  await pool.query("insert into plataforma.contatos (workspace_id, id, nome, proprietario_id, criado_por) values ($1, $2, $2, 'mem_a', 'mem_a')", [WS, id]);
}

/** Um Canal e uma Conversa na lixeira (a 008 exige `resolvida` para `na_lixeira`), gravados ANTES da 011. */
async function conversaNaLixeira(pool: Pool): Promise<string> {
  await contato(pool, "c_lixeira");
  await pool.query(
    `insert into plataforma.canais (workspace_id, id, nome, tipo, provedor, identificador_externo, configurado_por, criado_por)
     values ($1, 'canal1', 'Canal 1', 'whatsapp', 'whatsapp-cloud', '5511999990000', 'mem_a', 'mem_a')`,
    [WS],
  );
  await pool.query(
    `insert into plataforma.conversas (workspace_id, id, canal_id, contato_id, titulo, situacao, estado, criado_por_tipo, criado_por_id)
     values ($1, 'conv_lixeira', 'canal1', 'c_lixeira', 'Na lixeira', 'resolvida', 'na_lixeira', 'membro', 'mem_a')`,
    [WS],
  );
  return "conv_lixeira";
}

/** O erro do `pg` de uma consulta que deve falhar: `code` e `constraint`. */
async function recusa(consulta: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
  try {
    await consulta;
  } catch (erro) {
    return erro as { code?: string; constraint?: string };
  }
  throw new Error("esperava a recusa do banco, mas a consulta passou");
}

async function colunas(pool: Pool, tabela: string): Promise<string[]> {
  const { rows } = await pool.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = 'plataforma' and table_name = $1",
    [tabela],
  );
  return rows.map((r) => r.column_name);
}

describeComBanco("011 — o que o CRM novo ganha (D-04, D-05) — Postgres local", () => {
  afterAll(async () => {
    await encerrar();
  });

  it("(a) mesclado exige alvo existente e diferente do próprio id", async () => {
    const banco = await bancoAte010();
    try {
      await banco.pool.query(TEXTO_011);
      await contato(banco.pool, "a");
      await contato(banco.pool, "b");

      await banco.pool.query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = 'b', mesclado_em = now() where workspace_id = $1 and id = 'a'",
        [WS],
      );
      const { rows } = await banco.pool.query("select estado, mesclado_em_id from plataforma.contatos where workspace_id = $1 and id = 'a'", [WS]);
      expect(rows[0]).toEqual({ estado: "mesclado", mesclado_em_id: "b" });

      // Sem alvo: o estado mesclado sozinho não vale.
      await contato(banco.pool, "c");
      const semAlvo = await recusa(banco.pool.query("update plataforma.contatos set estado = 'mesclado' where workspace_id = $1 and id = 'c'", [WS]));
      expect(semAlvo).toMatchObject({ code: "23514", constraint: "contatos_mesclado_ck" });

      // Alvo sem estado mesclado: também recusado (o alvo e o estado andam juntos).
      const soAlvo = await recusa(
        banco.pool.query("update plataforma.contatos set mesclado_em_id = 'b', mesclado_em = now() where workspace_id = $1 and id = 'c'", [WS]),
      );
      expect(soAlvo).toMatchObject({ code: "23514", constraint: "contatos_mesclado_ck" });

      // Alvo que não existe: a FK composta recusa.
      const inexistente = await recusa(
        banco.pool.query(
          "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = 'fantasma', mesclado_em = now() where workspace_id = $1 and id = 'c'",
          [WS],
        ),
      );
      expect(inexistente).toMatchObject({ code: "23503", constraint: "contatos_mesclado_em_fk" });

      // Alvo em outro Espaço: a FK é composta por (workspace_id, id), então não alcança.
      await banco.pool.query("insert into plataforma.contatos (workspace_id, id, nome, proprietario_id, criado_por) values ('outro_ws', 'z', 'Z', 'mem_a', 'mem_a')");
      const deOutroEspaco = await recusa(
        banco.pool.query("update plataforma.contatos set estado = 'mesclado', mesclado_em_id = 'z', mesclado_em = now() where workspace_id = $1 and id = 'c'", [WS]),
      );
      expect(deOutroEspaco).toMatchObject({ code: "23503", constraint: "contatos_mesclado_em_fk" });

      // Ninguém se mescla em si mesmo.
      const emSiMesmo = await recusa(
        banco.pool.query("update plataforma.contatos set estado = 'mesclado', mesclado_em_id = 'c', mesclado_em = now() where workspace_id = $1 and id = 'c'", [WS]),
      );
      expect(emSiMesmo).toMatchObject({ code: "23514", constraint: "contatos_mesclado_ck" });

      // Os três estados de antes continuam valendo; um quarto qualquer não.
      const invalido = await recusa(banco.pool.query("update plataforma.contatos set estado = 'sumido' where workspace_id = $1 and id = 'c'", [WS]));
      expect(invalido).toMatchObject({ code: "23514", constraint: "contatos_estado_ck" });
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(b) o consentimento recusa decisão, tipo de canal e origem fora da lista", async () => {
    const banco = await bancoAte010();
    try {
      await banco.pool.query(TEXTO_011);
      await contato(banco.pool, "a");
      const inserir = (decisao: string, canal: string, origem: string) =>
        banco.pool.query(
          `insert into plataforma.contato_consentimentos
             (workspace_id, contato_id, finalidade_id, tipo_de_canal, decisao, em, origem, registrado_por)
           values ($1, 'a', 'cat_fin_atend', $2, $3, now(), $4, 'mem_a')`,
          [WS, canal, decisao, origem],
        );

      await expect(inserir("concedido", "todos", "verbal")).resolves.toBeDefined();
      expect(await recusa(inserir("talvez", "whatsapp", "verbal"))).toMatchObject({ code: "23514", constraint: "contato_consentimentos_decisao_ck" });
      expect(await recusa(inserir("concedido", "linkedin", "verbal"))).toMatchObject({ code: "23514", constraint: "contato_consentimentos_canal_ck" });
      expect(await recusa(inserir("concedido", "email", "telefone"))).toMatchObject({ code: "23514", constraint: "contato_consentimentos_origem_ck" });
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(c) a nota recusa conteúdo em branco", async () => {
    const banco = await bancoAte010();
    try {
      await banco.pool.query(TEXTO_011);
      await contato(banco.pool, "a");
      const inserir = (conteudo: string) =>
        banco.pool.query("insert into plataforma.contato_notas (workspace_id, contato_id, conteudo, autor_id) values ($1, 'a', $2, 'mem_a')", [WS, conteudo]);

      await expect(inserir("Ligou pedindo retorno.")).resolves.toBeDefined();
      expect(await recusa(inserir("   "))).toMatchObject({ code: "23514", constraint: "contato_notas_conteudo_ck" });
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(d) a Conversa que já estava na lixeira ganha a data pelo backfill; depois, lixeira sem data é recusada", async () => {
    const banco = await bancoAte010();
    try {
      const id = await conversaNaLixeira(banco.pool);
      const antes = await banco.pool.query<{ atualizado_em: Date }>("select atualizado_em from plataforma.conversas where workspace_id = $1 and id = $2", [WS, id]);

      await banco.pool.query(TEXTO_011);

      const { rows } = await banco.pool.query<{ na_lixeira_em: Date | null }>(
        "select na_lixeira_em from plataforma.conversas where workspace_id = $1 and id = $2",
        [WS, id],
      );
      expect(rows[0]?.na_lixeira_em).toEqual(antes.rows[0]!.atualizado_em);

      // Uma Conversa ativa não tem data; a ida à lixeira sem data é recusada, e com data passa.
      await banco.pool.query(
        `insert into plataforma.conversas (workspace_id, id, canal_id, contato_id, titulo, situacao, criado_por_tipo, criado_por_id)
         values ($1, 'conv_ativa', 'canal1', 'c_lixeira', 'Ativa', 'resolvida', 'membro', 'mem_a')`,
        [WS],
      );
      const semData = await recusa(banco.pool.query("update plataforma.conversas set estado = 'na_lixeira' where workspace_id = $1 and id = 'conv_ativa'", [WS]));
      expect(semData).toMatchObject({ code: "23514", constraint: "conversas_na_lixeira_em_ck" });
      const comDataEmAtiva = await recusa(banco.pool.query("update plataforma.conversas set na_lixeira_em = now() where workspace_id = $1 and id = 'conv_ativa'", [WS]));
      expect(comDataEmAtiva).toMatchObject({ code: "23514", constraint: "conversas_na_lixeira_em_ck" });
      await expect(
        banco.pool.query("update plataforma.conversas set estado = 'na_lixeira', na_lixeira_em = now() where workspace_id = $1 and id = 'conv_ativa'", [WS]),
      ).resolves.toBeDefined();
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(e) rodar o texto duas vezes seguidas não falha e não muda o dado", async () => {
    const banco = await bancoAte010();
    try {
      await conversaNaLixeira(banco.pool);
      await banco.pool.query(TEXTO_011);
      await contato(banco.pool, "a");
      await contato(banco.pool, "b");
      await banco.pool.query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = 'b', mesclado_em = now() where workspace_id = $1 and id = 'a'",
        [WS],
      );
      const retrato = async () =>
        JSON.stringify([
          (await banco.pool.query("select * from plataforma.contatos order by id")).rows,
          (await banco.pool.query("select * from plataforma.conversas order by id")).rows,
        ]);
      const antes = await retrato();

      await expect(banco.pool.query(TEXTO_011)).resolves.toBeDefined();
      await expect(banco.pool.query(TEXTO_011)).resolves.toBeDefined();

      expect(await retrato()).toBe(antes);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(f) pelo migrar(): uma 011 interrompida no meio não deixa registro nem tabela; depois aplica", async () => {
    const banco = await bancoAte010();
    try {
      await conversaNaLixeira(banco.pool);

      // Interrompe a 011 no backfill (depois de ela já ter criado `contato_notas`): um gatilho de teste recusa o `update` da Conversa.
      await banco.pool.query(`
        create function plataforma.m011_recusa() returns trigger language plpgsql as $$
        begin raise exception 'interrompida'; end $$;
        create trigger m011_recusa before update on plataforma.conversas
          for each row execute function plataforma.m011_recusa();
      `);

      await expect(migrar(banco.pool)).rejects.toThrow(/011-crm-o-que-faltava\.sql.*falhou/);

      const registrada = await banco.pool.query("select 1 from plataforma.migracoes where nome = $1", [ARQUIVO_011]);
      expect(registrada.rowCount).toBe(0);
      const sobrou = await banco.pool.query("select to_regclass('plataforma.contato_notas') as notas, to_regclass('plataforma.crm_de_para') as de_para");
      expect(sobrou.rows[0]).toEqual({ notas: null, de_para: null });
      expect(await colunas(banco.pool, "contatos")).not.toContain("mesclado_em_id");

      // Sem o gatilho, a mesma 011 aplica e registra.
      await banco.pool.query("drop trigger m011_recusa on plataforma.conversas");
      const aplicadas = await migrar(banco.pool);
      expect(aplicadas.map((a) => a.nome)).toEqual([ARQUIVO_011]);
      const agora = await banco.pool.query("select 1 from plataforma.migracoes where nome = $1", [ARQUIVO_011]);
      expect(agora.rowCount).toBe(1);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(g) as cinco tabelas novas ficam sem RLS, e o bloco da 011 a desliga se o projeto a ligar", async () => {
    const banco = await bancoAte010();
    try {
      await banco.pool.query(TEXTO_011);
      const rls = async () =>
        (
          await banco.pool.query<{ relname: string; relrowsecurity: boolean }>(
            "select relname, relrowsecurity from pg_class where relnamespace = 'plataforma'::regnamespace and relname = any($1::text[]) order by relname",
            [[...TABELAS_NOVAS]],
          )
        ).rows;
      const antes = await rls();
      expect(antes.map((r) => r.relname)).toEqual([...TABELAS_NOVAS].sort());
      expect(antes.every((r) => r.relrowsecurity === false)).toBe(true);

      // O que o event trigger `ensure_rls` do Supabase faria numa tabela nova: ligar a RLS sem policy.
      for (const tabela of TABELAS_NOVAS) await banco.pool.query(`alter table plataforma.${tabela} enable row level security`);
      expect((await rls()).every((r) => r.relrowsecurity === true)).toBe(true);

      await banco.pool.query(TEXTO_011);
      expect((await rls()).every((r) => r.relrowsecurity === false)).toBe(true);
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(h) D-05: nenhuma coluna de Grupo na Conversa nem de Flow na Mensagem", async () => {
    const banco = await bancoAte010();
    try {
      await banco.pool.query(TEXTO_011);
      expect(await colunas(banco.pool, "conversas")).not.toContain("identificador_de_grupo");
      expect(await colunas(banco.pool, "mensagens")).not.toContain("flow");
      expect(await colunas(banco.pool, "mensagens")).not.toContain("resposta_de_flow");
      // O texto da própria 011 também não as cria (a conferência acima vale para o banco; esta, para o arquivo).
      expect(SQL_011).not.toMatch(/identificador_de_grupo|resposta_de_flow/);
      // E a coluna que a 011 ACRESCENTA à Conversa existe.
      expect(await colunas(banco.pool, "conversas")).toContain("na_lixeira_em");
    } finally {
      await banco.encerrar();
    }
  }, 60_000);

  it("(i) D-03: não mexe em plataforma.registros, e as tabelas de cópia nascem vazias", async () => {
    const banco = await bancoAte010();
    try {
      await banco.pool.query("insert into plataforma.workspaces (workspace_id) values ($1)", [WS]);
      for (const [colecao, id] of [["contacts", "cnt_1"], ["conversations", "cnv_1"], ["deals", "dl_1"]] as const) {
        await banco.pool.query("insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, $2, $3, $4::jsonb)", [WS, colecao, id, JSON.stringify({ id, nome: "dado real" })]);
      }
      const retrato = async () => JSON.stringify((await banco.pool.query("select * from plataforma.registros order by colecao, id")).rows);
      const antes = await retrato();
      const revisaoAntes = (await banco.pool.query("select revisao from plataforma.workspaces where workspace_id = $1", [WS])).rows[0];

      await banco.pool.query(TEXTO_011);

      expect(await retrato()).toBe(antes);
      expect((await banco.pool.query("select revisao from plataforma.workspaces where workspace_id = $1", [WS])).rows[0]).toEqual(revisaoAntes);
      for (const tabela of ["crm_de_para", "registros_crm_antigo"]) {
        const { rows } = await banco.pool.query<{ n: string }>(`select count(*) as n from plataforma.${tabela}`);
        expect(Number(rows[0]!.n)).toBe(0);
      }
    } finally {
      await banco.encerrar();
    }
  }, 60_000);
});

// O bloco acima pula sem Postgres local; este não, para o arquivo nunca ficar "sem teste".
describe("011 — o arquivo", () => {
  it("é idempotente por escrito, desliga a RLS e não cria Grupo, Flow nem concede privilégio", () => {
    expect(SQL_011.match(/drop constraint if exists/g)?.length).toBeGreaterThanOrEqual(4);
    expect(SQL_011).toContain("disable row level security");
    expect(SQL_011).not.toMatch(/\bgrant\b/i);
    expect(SQL_011).not.toMatch(/identificador_de_grupo|resposta_de_flow/);
    // Toda criação de tabela é `if not exists`.
    const criacoes = SQL_011.match(/create table [^\n]*/g) ?? [];
    expect(criacoes.length).toBe(TABELAS_NOVAS.length);
    expect(criacoes.every((c) => c.includes("if not exists"))).toBe(true);
  });
});
