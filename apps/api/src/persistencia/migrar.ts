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
import type { Pool } from "pg";
import { poolDeMigracao } from "./conexao";

const PASTA = fileURLToPath(new URL("../../migracoes", import.meta.url));

export interface Aplicada {
  readonly nome: string;
  readonly ms: number;
}

/** O que `migracoesPendentes` devolve: os nomes dos arquivos, separados por situação, cada lista em ordem. */
export interface EstadoDasMigracoes {
  readonly aplicadas: readonly string[];
  readonly pendentes: readonly string[];
}

/** Os arquivos `.sql` da pasta, na ordem em que `migrar()` os aplica. */
function arquivosDeMigracao(): string[] {
  return readdirSync(PASTA).filter((f) => f.endsWith(".sql")).sort();
}

/**
 * A conferência de D-12: ver o que `migrar()` aplicaria antes de aplicar, sem
 * escrever no banco. Só `select`: `to_regclass` diz se a tabela de controle
 * existe e, só então, `plataforma.migracoes` é lida. Num banco onde nem o
 * schema `plataforma` existe, nada nasce — todos os arquivos saem como
 * pendentes (T-07-36). O parâmetro existe para o teste apontar a um banco
 * vazio; o CLI (`--seco`) usa o `poolDeMigracao()` do processo.
 */
export async function migracoesPendentes(cliente: Pick<Pool, "query"> = poolDeMigracao()): Promise<EstadoDasMigracoes> {
  const arquivos = arquivosDeMigracao();
  const controle = await cliente.query<{ existe: string | null }>("select to_regclass('plataforma.migracoes') as existe");
  const registradas = new Set<string>();
  if (controle.rows[0]?.existe) {
    for (const { nome } of (await cliente.query<{ nome: string }>("select nome from plataforma.migracoes")).rows) {
      registradas.add(nome);
    }
  }
  return {
    aplicadas: arquivos.filter((nome) => registradas.has(nome)),
    pendentes: arquivos.filter((nome) => !registradas.has(nome)),
  };
}

/**
 * Aplica o que falta. Roda no dono do banco (`DATABASE_URL_MIGRACAO`, D-07) —
 * `n1_api` não faz DDL. O parâmetro existe para os testes apontarem um banco
 * descartável; fora deles, é sempre `poolDeMigracao()`.
 */
export async function migrar(origem: Pick<Pool, "connect"> = poolDeMigracao()): Promise<Aplicada[]> {
  const cliente = await origem.connect();
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
    const arquivos = arquivosDeMigracao();

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
