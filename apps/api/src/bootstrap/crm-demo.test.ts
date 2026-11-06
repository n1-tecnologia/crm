/**
 * `carregarCrmDemo()` (15-29, UCR-11, D-15-13) contra o Postgres de Docker: o Espaço de desenvolvimento
 * semeado com `buildSeed()` ganha o CRM de demonstração nas tabelas novas, os Vínculos do seed acham os
 * registros, e rodar duas vezes recusa a segunda sem duplicar nada.
 *
 * SÓ Postgres local descartável (`describeComBanco` pula fora de localhost). Nada aqui conecta a banco
 * remoto; a porta e o host vêm de `DATABASE_URL`, nunca escritos no teste:
 *
 *   docker run -d --rm --name crm-n1-pg-1529 -e POSTGRES_PASSWORD=x -p 55729:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55729/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55729/postgres \
 *     npx vitest run src/bootstrap/crm-demo.test.ts
 */

import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import { carregarCrmDemo } from "./crm-demo";

interface DemoEmJson {
  readonly tabelas: Readonly<Record<string, readonly { readonly id?: string }[]>>;
  readonly naoMigrados: readonly { readonly colecao: string; readonly id: string; readonly categoria: string }[];
}

const DEMO = JSON.parse(readFileSync(new URL("./crm-demo.json", import.meta.url), "utf8")) as DemoEmJson;

const TABELA_DO_TIPO: Readonly<Record<string, { tabela: string; colecao: string }>> = {
  contact: { tabela: "contatos", colecao: "contacts" },
  company: { tabela: "empresas", colecao: "companies" },
  deal: { tabela: "negocios", colecao: "deals" },
  conversation: { tabela: "conversas", colecao: "conversations" },
};

const criados: string[] = [];

/** Cria o Espaço de desenvolvimento como o dev cria: `semear(buildSeed())`, numa transação. */
async function espacoSemeado(rotulo: string): Promise<string> {
  const ws = novoEspacoDeTeste(rotulo);
  criados.push(ws);
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    await semear(cliente, ws, buildSeed());
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  } finally {
    cliente.release();
  }
  return ws;
}

async function carregar(ws: string) {
  const cliente = await pool().connect();
  try {
    return await carregarCrmDemo(cliente, { workspaceId: ws });
  } finally {
    cliente.release();
  }
}

async function contagens(ws: string): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  for (const tabela of Object.keys(DEMO.tabelas)) {
    const linha = await pool().query<{ n: string }>(`select count(*)::text as n from plataforma.${tabela} where workspace_id = $1`, [ws]);
    r[tabela] = Number(linha.rows[0]!.n);
  }
  return r;
}

describeComBanco("carregarCrmDemo — o CRM de demonstração num Espaço de desenvolvimento (15-29 Task 1, traçador)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("o Espaço semeado com buildSeed() ganha as linhas do demo em todas as tabelas, e a Caixa tem Conversas", async () => {
    const ws = await espacoSemeado("demo");
    expect((await contagens(ws)).conversas).toBe(0); // o seed grava o CRM antigo em registros, não nas tabelas

    const resultado = await carregar(ws);

    expect(resultado.carregado).toBe(true);
    const esperado = Object.fromEntries(Object.entries(DEMO.tabelas).map(([tabela, linhas]) => [tabela, linhas.length]));
    expect(await contagens(ws)).toEqual(esperado);
    expect(resultado.linhas).toEqual(esperado);
    expect(esperado.conversas).toBeGreaterThan(0);
    expect(esperado.contatos).toBeGreaterThan(0);
    expect(esperado.negocios).toBeGreaterThan(0);
  });

  it("todo Vínculo do seed para Contato, Empresa, Negócio ou Conversa que o demo carrega acha o registro nas tabelas", async () => {
    const ws = await espacoSemeado("vinculos");
    await carregar(ws);

    const noDemo = Object.fromEntries(Object.entries(DEMO.tabelas).map(([tabela, linhas]) => [tabela, new Set(linhas.map((l) => l.id))]));
    const foraDoDemo = new Set(DEMO.naoMigrados.map((n) => `${n.colecao}:${n.id}`));
    const achados: Record<string, number> = {};

    for (const vinculo of buildSeed().links) {
      for (const ponta of [{ tipo: vinculo.fromType as string, id: vinculo.fromId }, { tipo: vinculo.toType as string, id: vinculo.toId }]) {
        const alvo = TABELA_DO_TIPO[ponta.tipo];
        if (alvo === undefined) continue; // tarefa, grupo, flow...: não são do CRM
        const achou = await pool().query(`select 1 from plataforma.${alvo.tabela} where workspace_id = $1 and id = $2`, [ws, ponta.id]);
        if ((achou.rowCount ?? 0) > 0) {
          achados[ponta.tipo] = (achados[ponta.tipo] ?? 0) + 1;
          continue;
        }
        // Se o demo traz o registro, ele TEM de estar no banco; se não traz, tem de estar entre os não migrados.
        expect(noDemo[alvo.tabela]!.has(ponta.id), `${ponta.tipo} ${ponta.id} está no demo mas não no banco`).toBe(false);
        expect(foraDoDemo.has(`${alvo.colecao}:${ponta.id}`) || ponta.tipo === "conversation", `${ponta.tipo} ${ponta.id} sumiu sem estar nos não migrados`).toBe(true);
      }
    }

    expect(Object.keys(achados).sort()).toEqual(["contact", "conversation", "deal"]);
  });

  it("a segunda carga no mesmo Espaço recusa (\"o Espaço já tem Contatos\") e não duplica nada", async () => {
    const ws = await espacoSemeado("repetido");
    await carregar(ws);
    const antes = await contagens(ws);

    await expect(carregar(ws)).rejects.toThrow(/o Espaço já tem Contatos/);

    expect(await contagens(ws)).toEqual(antes);
  });
});
