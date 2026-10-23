/**
 * A conferência seca de D-12 (07-12): `migracoesPendentes()` e `migrar --seco`
 * dizem o que `migrar()` faria — e não fazem nada.
 *
 * Três provas, contra o Postgres LOCAL (`testes/banco-crm.ts`, nunca o pooler
 * do Supabase): (a) num banco VAZIO, criado só para este caso, todos os
 * arquivos saem como pendentes e o schema `plataforma` continua inexistente —
 * nem o schema nem a tabela de controle nascem numa leitura seca; (b) depois
 * de `migrar()`, tudo aplicado e nada pendente; (c) o CLI com `--seco` imprime
 * uma linha por arquivo, na ordem, e a contagem de `plataforma.migracoes` é a
 * mesma antes e depois (T-07-36).
 *
 * O caso (a) usa um banco próprio porque o banco padrão do container já pode
 * ter sido migrado por outro arquivo de teste da mesma execução.
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeComBanco, prepararBancoCrm } from "../testes/banco-crm";
import { encerrar, pool } from "./conexao";
import { migracoesPendentes } from "./migrar";

const PASTA_DE_MIGRACOES = fileURLToPath(new URL("../../migracoes", import.meta.url));
const RAIZ_DA_API = fileURLToPath(new URL("../..", import.meta.url));

/** Os arquivos `.sql` na ordem em que `migrar()` os aplica. */
const arquivos = () => readdirSync(PASTA_DE_MIGRACOES).filter((f) => f.endsWith(".sql")).sort();

/** A mesma `DATABASE_URL`, apontando para outro banco do mesmo servidor. */
function urlDoBanco(nome: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${nome}`;
  return url.toString();
}

describeComBanco("migracoesPendentes e migrar --seco (D-12) — Postgres local", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    await encerrar();
  });

  it("(a) num banco vazio, todos os arquivos saem como pendentes e o schema plataforma NÃO é criado", async () => {
    const nome = `seco_${randomUUID().slice(0, 8)}`;
    await pool().query(`create database ${nome}`);
    const vazio = new Pool({ connectionString: urlDoBanco(nome), max: 2 });
    try {
      const resultado = await migracoesPendentes(vazio);
      expect(resultado.pendentes).toEqual(arquivos());
      expect(resultado.aplicadas).toEqual([]);

      const schema = await vazio.query("select 1 from pg_namespace where nspname = 'plataforma'");
      expect(schema.rowCount).toBe(0);
      const tabela = await vazio.query<{ existe: string | null }>("select to_regclass('plataforma.migracoes') as existe");
      expect(tabela.rows[0]?.existe).toBeNull();
    } finally {
      await vazio.end();
      await pool().query(`drop database ${nome}`);
    }
  });

  it("(b) depois de migrar(), todos os arquivos saem como aplicados e nenhum pendente", async () => {
    const resultado = await migracoesPendentes(pool());
    expect(resultado.aplicadas).toEqual(arquivos());
    expect(resultado.pendentes).toEqual([]);
  });

  it("(c) migrar.cli.ts --seco imprime uma linha por arquivo, na ordem, e não aplica nada", async () => {
    const antes = await pool().query<{ total: number }>("select count(*)::int as total from plataforma.migracoes");

    const saida = execFileSync("npx", ["vite-node", "src/persistencia/migrar.cli.ts", "--seco"], {
      cwd: RAIZ_DA_API,
      // DATABASE_URL_MIGRACAO vazia: o CLI fica no Postgres local de DATABASE_URL, mesmo com um .env remoto.
      env: { ...process.env, DATABASE_URL_MIGRACAO: "" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const linhas = saida.trim().split("\n");
    expect(linhas.at(-1)).toBe("0 pendente(s); nada foi aplicado (--seco).");
    const esperadas = arquivos().map((nome) => `aplicada  ${nome}`);
    expect(linhas.slice(0, esperadas.length)).toEqual(esperadas);
    expect(saida).not.toMatch(/\(\d+ ms\)/);

    const depois = await pool().query<{ total: number }>("select count(*)::int as total from plataforma.migracoes");
    expect(depois.rows[0]?.total).toBe(antes.rows[0]?.total);
  }, 90_000);
});
