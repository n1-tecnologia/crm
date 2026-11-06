/**
 * 15-28 (UCR-09) — o `--migrar` leva o CRM antigo às tabelas novas, contra Postgres de Docker.
 *
 * SÓ Postgres local descartável (`describeComBanco` pula fora de localhost): este arquivo grava e APAGA
 * linhas de `plataforma.registros`, então nunca pode rodar contra o banco do `.env`. A fixture é o seed
 * sintético congelado; nenhum dado de produção.
 *
 *   docker run -d --rm --name crm-n1-pg-1528 -e POSTGRES_PASSWORD=x -p 55728:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55728/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55728/postgres \
 *     npx vitest run src/migracao-crm/
 *   docker rm -f crm-n1-pg-1528
 */

import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import type { RegistroAntigo } from "./formatos-antigos";
import { migrarCrmAntigo } from "./migrar-crm-antigo";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/crm-antigo-do-seed.json", import.meta.url), "utf8")) as {
  readonly linhas: readonly RegistroAntigo[];
};

const doSeed = (...colecoes: string[]): RegistroAntigo[] => FIXTURE.linhas.filter((l) => colecoes.includes(l.colecao));

/** Escritas por este teste, para a limpeza: o Espaço de cada caso. */
const criados: string[] = [];

/** Cria o Espaço e grava as linhas direto no SQL (a fixture é do CRM antigo, que o domínio já não escreve). */
async function semearEspaco(rotulo: string, linhas: readonly RegistroAntigo[]): Promise<string> {
  const ws = novoEspacoDeTeste(rotulo);
  criados.push(ws);
  await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
  for (const l of linhas) {
    await pool().query(
      "insert into plataforma.registros (workspace_id, colecao, id, dados, ordem) values ($1, $2, $3, $4::jsonb, $5)",
      [ws, l.colecao, l.id, JSON.stringify({ ...(l.dados as Record<string, unknown>), workspaceId: ws }), l.ordem],
    );
  }
  return ws;
}

async function idsDe(tabela: string, ws: string): Promise<string[]> {
  const r = await pool().query<{ id: string }>(`select id from plataforma.${tabela} where workspace_id = $1 order by id`, [ws]);
  return r.rows.map((l) => l.id);
}

describeComBanco("migrar os Contatos do CRM antigo (15-28 Task 1, traçador)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("os Contatos da fixture chegam a plataforma.contatos com os ids antigos e o de-para tem uma linha por Contato e por Identificador", async () => {
    const contatos = doSeed("contacts");
    const ws = await semearEspaco("contatos", contatos);

    const resultado = await migrarCrmAntigo(ws);

    expect(resultado.nadaAFazer).toBe(false);
    expect(await idsDe("contatos", ws)).toEqual(contatos.map((c) => c.id).sort());
    const absorvido = await pool().query<{ estado: string; mesclado_em_id: string }>(
      "select estado, mesclado_em_id from plataforma.contatos where workspace_id = $1 and id = 'cnt_32'",
      [ws],
    );
    expect(absorvido.rows[0]).toEqual({ estado: "mesclado", mesclado_em_id: "cnt_2" });

    const identificadores = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.contato_identificadores where workspace_id = $1", [ws]);
    const dePara = await pool().query<{ colecao_antiga: string; n: string }>(
      "select colecao_antiga, count(*)::text as n from plataforma.crm_de_para where workspace_id = $1 group by colecao_antiga order by colecao_antiga",
      [ws],
    );
    expect(Object.fromEntries(dePara.rows.map((l) => [l.colecao_antiga, Number(l.n)]))).toEqual({
      contacts: contatos.length,
      "contacts/identifiers": Number(identificadores.rows[0]!.n),
    });
    // O Contato foi guardado e saiu de registros: o CRM antigo some, o novo fica.
    const restante = await pool().query("select 1 from plataforma.registros where workspace_id = $1 and colecao = 'contacts'", [ws]);
    expect(restante.rowCount).toBe(0);
  });
});
