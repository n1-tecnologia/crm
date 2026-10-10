/**
 * O banco dos testes do CRM — SÓ Postgres local descartável.
 *
 * `prepararBancoCrm` roda `migrar()`, e rodar `migrar()` contra o pooler do
 * Supabase do `.env` aplicaria a `007-crm.sql` em produção antes de alguém
 * conferi-la (D-12, Pitfall 11). Por isso `temBancoCrm` só é verdadeiro quando
 * `DATABASE_URL` aponta para `localhost` ou `127.0.0.1`; contra qualquer outro
 * host os blocos `describeComBanco` pulam e `prepararBancoCrm` lança.
 *
 * Cada plano da fase sobe o seu container (`crm-n1-pg-07NN`, porta 554NN):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55471/postgres npx vitest run src/rotas/crm
 */

import { randomUUID } from "node:crypto";
import { describe } from "vitest";
import { carregarEnv, pool } from "../persistencia/conexao";
import { migrar } from "../persistencia/migrar";

carregarEnv();

function hostEhLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Verdadeiro só com `DATABASE_URL` apontando para o Postgres local. */
export const temBancoCrm = hostEhLocal(process.env.DATABASE_URL);

/** `describe` que pula quando não há Postgres local — nunca roda contra banco remoto. */
export const describeComBanco = temBancoCrm ? describe : describe.skip;

/** Aplica as migrações no Postgres local. Lança fora dele (T-07-08). */
export async function prepararBancoCrm(): Promise<void> {
  if (!temBancoCrm) {
    throw new Error("Os testes do CRM só rodam contra Postgres local (localhost/127.0.0.1); recusado.");
  }
  await migrar();
}

/** Um Espaço de Trabalho por teste: `ws_crm_teste_<rótulo>_<8 caracteres>`. */
export function novoEspacoDeTeste(rotulo: string): string {
  return `ws_crm_teste_${rotulo}_${randomUUID().slice(0, 8)}`;
}

/**
 * Apaga tudo que o Espaço criou, numa transação só: o constraint trigger de
 * admin da Empresa é deferido, e a Empresa some antes do commit.
 */
export async function limparEspaco(workspaceId: string): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    for (const tabela of [
      "negocios",
      "contato_empresa",
      "empresa_identificadores",
      "empresas",
      "contato_identificadores",
      "contatos",
      "funis",
    ]) {
      await cliente.query(`delete from plataforma.${tabela} where workspace_id = $1`, [workspaceId]);
    }
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [workspaceId]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [workspaceId]);
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  } finally {
    cliente.release();
  }
}
