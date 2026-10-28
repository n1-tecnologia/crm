/**
 * O banco fechado da Fase 9 (SEG-04, D-04 a D-06): a `009-seguranca-e-cofre.sql`
 * provada em banco novo, SÓ no Postgres local descartável.
 *
 *   docker run -d --rm --name crm-n1-pg-0904 -e POSTGRES_PASSWORD=x -p 55604:5432 postgres:16
 *   DATABASE_URL=postgres://postgres:x@localhost:55604/postgres npx vitest run src/seguranca/banco-n1-api.test.ts
 *
 * Cada caso cria o seu banco (`n1_banco_<caso>_<8 caracteres>`) e o apaga no
 * `finally`. Papéis são do CLUSTER, não do banco: (c) começa sem `anon` e
 * `authenticated`, (a) os cria e os apaga no fim; `n1_api` fica (o CI o cria
 * antes). Se um caso falhar, o conserto é na `009`, não no teste.
 *
 * O administrador dos casos é `poolDoDono()` (`testes/banco-crm.ts`): `DATABASE_URL`
 * (que `describeComBanco` já exige local) quando o app roda como o dono, e
 * `DATABASE_URL_MIGRACAO` quando o app roda como `n1_api` (o job `seguranca` do CI,
 * 09-12) — e só se ela também for local: um `DATABASE_URL_MIGRACAO` remoto no `.env`
 * não pode levar `create database` para fora do Postgres local.
 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { describeComBanco, poolDoDono } from "../testes/banco-crm";
import { encerrar } from "../persistencia/conexao";
import { concederN1Api } from "../persistencia/conceder-n1-api";
import { migrar, type Aplicada } from "../persistencia/migrar";

const SENHA_DE_TESTE = "x";

/**
 * O mesmo servidor do dono (`DATABASE_URL_MIGRACAO` local, ou `DATABASE_URL`), apontando para outro banco —
 * e, se pedido, outro usuário. O dono do banco descartável é quem o cria, não o `n1_api` do app.
 */
function urlDoBanco(nome: string, usuario?: { readonly nome: string; readonly senha: string }): string {
  const migracao = process.env.DATABASE_URL_MIGRACAO?.trim();
  const url = new URL(migracao && /localhost|127\.0\.0\.1/.test(migracao) ? migracao : process.env.DATABASE_URL!);
  url.pathname = `/${nome}`;
  if (usuario) {
    url.username = usuario.nome;
    url.password = usuario.senha;
  }
  return url.toString();
}

interface BancoDescartavel {
  readonly nome: string;
  /** Conectado como o usuário de `DATABASE_URL` (superusuário do container). */
  readonly dono: Pool;
}

/**
 * Como `new Pool`, mas com o `error` ouvido: sem isso, um `drop database ... with (force)`
 * que esbarra num `pool.end()` ainda fechando o socket chega como erro sem ouvinte e vira
 * exceção não tratada do processo (mesma proteção que `conexao.ts` já tem nos pools do app).
 */
function novoPool(connectionString: string): Pool {
  const p = new Pool({ connectionString, max: 2 });
  p.on("error", () => {});
  return p;
}

/** Cria o banco, entrega o pool do dono e SEMPRE apaga o banco depois de `corpo`. */
async function comBancoDescartavel(caso: string, corpo: (banco: BancoDescartavel) => Promise<void>): Promise<void> {
  const nome = `n1_banco_${caso}_${randomUUID().slice(0, 8)}`;
  await poolDoDono().query(`create database ${nome}`);
  const dono = novoPool(urlDoBanco(nome));
  try {
    await corpo({ nome, dono });
  } finally {
    await dono.end();
    await poolDoDono().query(`drop database if exists ${nome} with (force)`);
  }
}

/** `migrar()` num banco descartável, com um pool próprio que é fechado em seguida. */
async function migrarNo(nome: string): Promise<Aplicada[]> {
  const origem = novoPool(urlDoBanco(nome));
  try {
    return await migrar(origem);
  } finally {
    await origem.end();
  }
}

/** Cria o papel do cluster só se ele ainda não existir. */
async function garantirPapel(papel: "anon" | "authenticated" | "n1_api"): Promise<void> {
  const login = papel === "n1_api" ? `login password '${SENHA_DE_TESTE}'` : "nologin";
  await poolDoDono().query(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = '${papel}') then
        create role ${papel} ${login};
      end if;
    end $$`);
}

/** Apaga `anon`/`authenticated` do cluster; `2BP01` é papel ainda usado por outro banco. */
async function apagarPapeisDoSupabase(): Promise<void> {
  try {
    await poolDoDono().query("drop role if exists anon, authenticated");
  } catch (erro) {
    if ((erro as { code?: string }).code === "2BP01") {
      throw new Error("recrie o container crm-n1-pg-0904: anon/authenticated ainda têm privilégios em outro banco");
    }
    throw erro;
  }
}

async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
  return undefined;
}

/** O que `n1_api` pode no schema: USAGE nele, os quatro DML + TRUNCATE por tabela e USAGE por sequência. */
interface MatrizDePrivilegios {
  readonly schema: boolean;
  readonly tabelas: Readonly<Record<string, string>>;
  readonly sequencias: Readonly<Record<string, boolean>>;
}

async function matrizDe(dono: Pool, papel: string): Promise<MatrizDePrivilegios> {
  const schema = await dono.query<{ ok: boolean }>(
    "select has_schema_privilege($1, 'plataforma', 'USAGE') as ok",
    [papel],
  );
  const tabelas = await dono.query<{ nome: string; privilegios: string }>(
    `select c.relname as nome,
            concat_ws(',',
              case when has_table_privilege($1, c.oid, 'SELECT')   then 'S' end,
              case when has_table_privilege($1, c.oid, 'INSERT')   then 'I' end,
              case when has_table_privilege($1, c.oid, 'UPDATE')   then 'U' end,
              case when has_table_privilege($1, c.oid, 'DELETE')   then 'D' end,
              case when has_table_privilege($1, c.oid, 'TRUNCATE') then 'T' end) as privilegios
       from pg_class c
      where c.relnamespace = 'plataforma'::regnamespace and c.relkind in ('r', 'p')
      order by c.relname`,
    [papel],
  );
  const sequencias = await dono.query<{ nome: string; ok: boolean }>(
    `select c.relname as nome, has_sequence_privilege($1, c.oid, 'USAGE') as ok
       from pg_class c
      where c.relnamespace = 'plataforma'::regnamespace and c.relkind = 'S'
      order by c.relname`,
    [papel],
  );
  return {
    schema: schema.rows[0]!.ok,
    tabelas: Object.fromEntries(tabelas.rows.map((l) => [l.nome, l.privilegios])),
    sequencias: Object.fromEntries(sequencias.rows.map((l) => [l.nome, l.ok])),
  };
}

const COLUNAS_DO_COFRE = [
  "id",
  "workspace_id",
  "dono_tipo",
  "dono_id",
  "tipo",
  "segredo_cifrado",
  "iv",
  "etiqueta",
  "versao_da_chave",
  "criado_em",
  "atualizado_em",
  "revogado_em",
];

describeComBanco("banco fechado da Fase 9 (009) — Postgres local", () => {
  afterAll(async () => {
    await encerrar();
  });

  it("(c) sem os papéis anon/authenticated (Postgres puro) a 009 aplica sem erro", async () => {
    await apagarPapeisDoSupabase();
    await comBancoDescartavel("c", async ({ nome, dono }) => {
      const aplicadas = await migrarNo(nome);
      expect(aplicadas.map((a) => a.nome)).toContain("009-seguranca-e-cofre.sql");
      const registradas = await dono.query<{ nome: string }>("select nome from plataforma.migracoes order by nome");
      expect(registradas.rows.map((r) => r.nome).at(-1)).toBe("009-seguranca-e-cofre.sql");
    });
  }, 60_000);

  it("(a) fecha anon/authenticated/public, desliga a RLS, fixa o search_path, cria o cofre e concede só DML a n1_api", async () => {
    await garantirPapel("anon");
    await garantirPapel("authenticated");
    await garantirPapel("n1_api");
    try {
      await comBancoDescartavel("a", async ({ nome, dono }) => {
        // O estado de um projeto Supabase de antes da 009: privilégios abertos, RLS ligada por event trigger,
        // e a função rls_auto_enable() executável por anon.
        await dono.query(`
          create schema plataforma;
          grant usage on schema plataforma to anon, authenticated;
          alter default privileges in schema plataforma grant select on tables to anon, authenticated;
          alter default privileges in schema plataforma grant usage, select on sequences to anon, authenticated;

          create function public.rls_auto_enable() returns event_trigger language plpgsql as $f$ begin null; end $f$;
          grant execute on function public.rls_auto_enable() to anon, authenticated;

          create function public.rls_ligada_de_teste() returns event_trigger language plpgsql as $f$
          declare cmd record;
          begin
            for cmd in select * from pg_event_trigger_ddl_commands() where object_type = 'table' loop
              execute format('alter table %s enable row level security', cmd.object_identity);
            end loop;
          end $f$;
          create event trigger rls_ligada_de_teste on ddl_command_end
            when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
            execute function public.rls_ligada_de_teste();
        `);
        // Sonda do próprio teste: sem a 009, o event trigger de fato liga a RLS.
        await dono.query("create table public.sonda_rls (a int)");
        const sonda = await dono.query<{ rls: boolean }>(
          "select relrowsecurity as rls from pg_class where oid = 'public.sonda_rls'::regclass",
        );
        expect(sonda.rows[0]!.rls).toBe(true);
        expect((await dono.query("select has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') as ok")).rows[0]!.ok).toBe(true);

        await migrarNo(nome);

        // D-04: anon/authenticated fora.
        for (const papel of ["anon", "authenticated"]) {
          const schema = await dono.query<{ ok: boolean }>(
            "select has_schema_privilege($1, 'plataforma', 'USAGE') as ok", [papel]);
          expect(schema.rows[0]!.ok, `${papel} USAGE`).toBe(false);
          const leitura = await dono.query<{ nome: string }>(
            `select c.relname as nome from pg_class c
              where c.relnamespace = 'plataforma'::regnamespace and c.relkind in ('r', 'p')
                and has_table_privilege($1, c.oid, 'SELECT')`, [papel]);
          expect(leitura.rows, `${papel} SELECT`).toEqual([]);
          const funcao = await dono.query<{ ok: boolean }>(
            "select has_function_privilege($1, 'public.rls_auto_enable()', 'EXECUTE') as ok", [papel]);
          expect(funcao.rows[0]!.ok, `${papel} rls_auto_enable`).toBe(false);
        }
        const padroes = await dono.query<{ acl: string }>(
          "select defaclacl::text as acl from pg_default_acl where defaclnamespace = 'plataforma'::regnamespace");
        for (const { acl } of padroes.rows) {
          expect(acl).not.toMatch(/anon=/);
          expect(acl).not.toMatch(/authenticated=/);
        }

        // D-05: RLS desligada em TODA tabela de plataforma, inclusive o cofre.
        const tabelas = await dono.query<{ nome: string; rls: boolean }>(
          `select relname as nome, relrowsecurity as rls from pg_class
            where relnamespace = 'plataforma'::regnamespace and relkind = 'r' order by relname`);
        expect(tabelas.rows.map((t) => t.nome)).toContain("credenciais");
        expect(tabelas.rows.filter((t) => t.rls).map((t) => t.nome)).toEqual([]);

        // (d) do D-06: search_path fixo nas três funções da 007.
        const funcoes = await dono.query<{ nome: string; config: string[] | null }>(
          `select proname as nome, proconfig as config from pg_proc
            where pronamespace = 'plataforma'::regnamespace
              and proname in ('crm_toque_atualizado_em', 'crm_exige_admin_na_empresa', 'crm_confere_admin')
            order by proname`);
        expect(funcoes.rows).toHaveLength(3);
        for (const f of funcoes.rows) expect(f.config, f.nome).toContain("search_path=pg_catalog, plataforma");

        // D-17: o cofre.
        const colunas = await dono.query<{ nome: string; tipo: string }>(
          `select column_name as nome, data_type as tipo from information_schema.columns
            where table_schema = 'plataforma' and table_name = 'credenciais' order by ordinal_position`);
        expect(colunas.rows.map((c) => c.nome).sort()).toEqual([...COLUNAS_DO_COFRE].sort());
        for (const bytea of ["segredo_cifrado", "iv", "etiqueta"]) {
          expect(colunas.rows.find((c) => c.nome === bytea)?.tipo, bytea).toBe("bytea");
        }
        const indice = await dono.query<{ def: string }>(
          "select indexdef as def from pg_indexes where schemaname = 'plataforma' and indexname = 'credenciais_ativa_unica'");
        expect(indice.rows[0]?.def).toMatch(/CREATE UNIQUE INDEX/);
        expect(indice.rows[0]?.def).toMatch(/\(workspace_id, dono_tipo, dono_id, tipo\)/);
        expect(indice.rows[0]?.def).toMatch(/WHERE \(revogado_em IS NULL\)/);

        // n1_api: só DML, e nada em plataforma.migracoes além de ler.
        const matriz = await matrizDe(dono, "n1_api");
        expect(matriz.schema).toBe(true);
        expect(Object.keys(matriz.tabelas).length).toBeGreaterThan(20);
        for (const [tabela, privilegios] of Object.entries(matriz.tabelas)) {
          expect(privilegios, tabela).toBe(tabela === "migracoes" ? "S" : "S,I,U,D");
        }
        expect(Object.keys(matriz.sequencias).length).toBeGreaterThan(0);
        expect(Object.values(matriz.sequencias).every(Boolean)).toBe(true);

        // Conectado como n1_api de verdade.
        const comoApi = novoPool(urlDoBanco(nome, { nome: "n1_api", senha: SENHA_DE_TESTE }));
        try {
          expect((await comoApi.query<{ u: string }>("select current_user as u")).rows[0]!.u).toBe("n1_api");
          await comoApi.query(
            "insert into plataforma.registros (workspace_id, colecao, id, dados) values ('ws_t', 'c', 'r1', '{}')");
          const lida = await comoApi.query("select 1 from plataforma.registros where workspace_id = 'ws_t'");
          expect(lida.rowCount).toBe(1);
          const alterada = await comoApi.query(
            `update plataforma.registros set dados = '{"a":1}' where workspace_id = 'ws_t' and id = 'r1'`);
          expect(alterada.rowCount).toBe(1);
          const apagada = await comoApi.query("delete from plataforma.registros where workspace_id = 'ws_t'");
          expect(apagada.rowCount).toBe(1);

          expect(await codigoDoErro(comoApi.query("drop table plataforma.migracoes"))).toBe("42501");
          expect(await codigoDoErro(comoApi.query("insert into plataforma.migracoes (nome) values ('x')"))).toBe("42501");
          expect(await codigoDoErro(comoApi.query("update plataforma.migracoes set nome = nome"))).toBe("42501");
          expect(await codigoDoErro(comoApi.query("delete from plataforma.migracoes"))).toBe("42501");
          expect(await codigoDoErro(comoApi.query("create table plataforma.x()"))).toBe("42501");
        } finally {
          await comoApi.end();
        }
      });
    } finally {
      await apagarPapeisDoSupabase();
    }
  }, 90_000);

  it("(d) uma 009 que falha no meio não deixa metade aplicada: nem a linha em migracoes, nem a tabela do cofre", async () => {
    await comBancoDescartavel("d", async ({ nome, dono }) => {
      // Uma VIEW com o nome do cofre: `create table if not exists` a ignora, e o índice único parcial estoura.
      await dono.query(`
        create schema plataforma;
        create view plataforma.credenciais as select 1 as x;
      `);
      await expect(migrarNo(nome)).rejects.toThrow(/009-seguranca-e-cofre/);

      const registradas = await dono.query<{ nome: string }>("select nome from plataforma.migracoes order by nome");
      const nomes = registradas.rows.map((r) => r.nome);
      expect(nomes).not.toContain("009-seguranca-e-cofre.sql");
      expect(nomes).toHaveLength(8);
      expect(nomes.at(-1)).toBe("008-canais-conversas-mensagens.sql");

      const cofre = await dono.query<{ tipo: string }>(
        "select relkind as tipo from pg_class where oid = 'plataforma.credenciais'::regclass");
      expect(cofre.rows[0]!.tipo).toBe("v");
      const indice = await dono.query("select 1 from pg_indexes where indexname = 'credenciais_ativa_unica'");
      expect(indice.rowCount).toBe(0);
    });
  }, 60_000);

  it("(b) n1_api criado DEPOIS da 009: banco:conceder devolve a mesma matriz de privilégios, e de novo, e os padrões valem para tabela futura", async () => {
    await garantirPapel("n1_api");
    const padroesDe = async (dono: Pool) =>
      (
        await dono.query<{ tipo: string; acl: string }>(
          `select defaclobjtype::text as tipo, defaclacl::text as acl from pg_default_acl
            where defaclnamespace = 'plataforma'::regnamespace order by 1, 2`,
        )
      ).rows;

    // Referência: a 009 aplicada com o papel presente.
    let referencia: MatrizDePrivilegios | undefined;
    let padroesDaReferencia: Awaited<ReturnType<typeof padroesDe>> = [];
    await comBancoDescartavel("bref", async ({ nome, dono }) => {
      await migrarNo(nome);
      referencia = await matrizDe(dono, "n1_api");
      padroesDaReferencia = await padroesDe(dono);
    });
    expect(referencia?.schema).toBe(true);

    await comBancoDescartavel("b", async ({ nome, dono }) => {
      await migrarNo(nome);
      // O estado de "papel criado depois da 009": nenhuma concessão, nem padrão.
      await dono.query(`
        revoke all on all tables in schema plataforma from n1_api;
        revoke all on all sequences in schema plataforma from n1_api;
        revoke all on all functions in schema plataforma from n1_api;
        revoke all on schema plataforma from n1_api;
        alter default privileges in schema plataforma revoke all on tables from n1_api;
        alter default privileges in schema plataforma revoke all on sequences from n1_api;
        alter default privileges in schema plataforma revoke all on functions from n1_api;
      `);
      const sem = await matrizDe(dono, "n1_api");
      expect(sem.schema).toBe(false);
      expect(Object.values(sem.tabelas).every((p) => p === "")).toBe(true);
      expect(Object.values(sem.sequencias).some(Boolean)).toBe(false);

      expect(await concederN1Api(dono)).toEqual({ papelExiste: true });
      expect(await matrizDe(dono, "n1_api")).toEqual(referencia);
      expect(await padroesDe(dono)).toEqual(padroesDaReferencia);

      // Idempotente: de novo, a mesma matriz.
      expect(await concederN1Api(dono)).toEqual({ papelExiste: true });
      expect(await matrizDe(dono, "n1_api")).toEqual(referencia);
      expect(await padroesDe(dono)).toEqual(padroesDaReferencia);

      // Os privilégios padrão valem para a tabela que nascer depois.
      await dono.query("create table plataforma.sonda_futura (a int)");
      const futura = await dono.query<{ ok: boolean }>(
        "select has_table_privilege('n1_api', 'plataforma.sonda_futura', 'INSERT') as ok",
      );
      expect(futura.rows[0]!.ok).toBe(true);
    });
  }, 90_000);
});

describe("concederN1Api sem o papel (sem banco)", () => {
  it("um cliente cuja consulta a pg_roles não devolve linha: { papelExiste: false } com uma consulta só", async () => {
    const consultas: string[] = [];
    const cliente = {
      query: async (sql: string) => {
        consultas.push(sql);
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Parameters<typeof concederN1Api>[0];

    expect(await concederN1Api(cliente)).toEqual({ papelExiste: false });
    expect(consultas).toHaveLength(1);
    expect(consultas[0]).toMatch(/pg_roles/);
  });
});
