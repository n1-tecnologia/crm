/**
 * Aplica as migrações de `apps/api/migracoes` em ordem, uma vez cada.
 *
 * Cada arquivo roda dentro de uma transação e é registrado em
 * `plataforma.migracoes`. Aplicar duas vezes não faz nada; um arquivo que
 * falha no meio não deixa metade aplicada.
 *
 * O nome do arquivo é o identificador (`001-plataforma.sql`), então renomear
 * um arquivo já aplicado o faz rodar de novo — por isso os arquivos são
 * imutáveis depois de aplicados: mudança de schema é migração nova.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { pool } from "./conexao";

const PASTA = fileURLToPath(new URL("../../migracoes", import.meta.url));

export interface Aplicada {
  readonly nome: string;
  readonly ms: number;
}

export async function migrar(): Promise<Aplicada[]> {
  const cliente = await pool().connect();
  const aplicadas: Aplicada[] = [];
  try {
    // A tabela de controle mora no mesmo schema que ela cria; por isso o
    // schema nasce aqui, fora de qualquer migração.
    await cliente.query("create schema if not exists plataforma");
    await cliente.query(`
      create table if not exists plataforma.migracoes (
        nome        text primary key,
        aplicada_em timestamptz not null default now()
      )`);

    const jaAplicadas = new Set(
      (await cliente.query<{ nome: string }>("select nome from plataforma.migracoes")).rows.map((r) => r.nome),
    );
    const arquivos = readdirSync(PASTA).filter((f) => f.endsWith(".sql")).sort();

    for (const nome of arquivos) {
      if (jaAplicadas.has(nome)) continue;
      const sql = readFileSync(join(PASTA, nome), "utf8");
      const t0 = Date.now();
      await cliente.query("begin");
      try {
        await cliente.query(sql);
        await cliente.query("insert into plataforma.migracoes (nome) values ($1)", [nome]);
        await cliente.query("commit");
      } catch (erro) {
        await cliente.query("rollback");
        throw new Error(`Migração "${nome}" falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
      }
      aplicadas.push({ nome, ms: Date.now() - t0 });
    }
    return aplicadas;
  } finally {
    cliente.release();
  }
}
