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
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import type { PoolClient } from "pg";
import { carregarCrmDemo, exigirBancoLocal, hostEhLocal, RecusaDoDemo, validarEspacoDoDemo } from "./crm-demo";
import { lerArgumentos, principal } from "./crm-demo.cli";

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

// --- 15-29 Task 2: as recusas e a CLI ---

const URL_REMOTA = "postgres://usuario:segredo@db.exemplo.com:5432/postgres";

/** Um cliente que EXPLODE se alguém o usar: prova que a recusa veio antes de qualquer consulta. */
function clienteQueNaoPodeSerUsado(): { cliente: PoolClient; consultas: string[] } {
  const consultas: string[] = [];
  const cliente = {
    query: async (sql: string) => {
      consultas.push(sql);
      throw new Error("o cliente não podia ser usado");
    },
  } as unknown as PoolClient;
  return { cliente, consultas };
}

describe("o host do banco: só local", () => {
  it("localhost e 127.0.0.1 são locais, com qualquer porta e usuário", () => {
    expect(hostEhLocal("postgres://postgres:x@localhost:5432/postgres")).toBe(true);
    expect(hostEhLocal("postgres://u:p@127.0.0.1:6543/x")).toBe(true);
  });

  it("host remoto, parecido com local, URL vazia ou ilegível NÃO são locais", () => {
    expect(hostEhLocal(URL_REMOTA)).toBe(false);
    expect(hostEhLocal("postgres://u:p@localhost.exemplo.com/x")).toBe(false);
    expect(hostEhLocal("postgres://u:p@exemplo.com/localhost")).toBe(false);
    expect(hostEhLocal("")).toBe(false);
    expect(hostEhLocal(undefined)).toBe(false);
    expect(hostEhLocal("isto não é uma url")).toBe(false);
  });

  it("exigirBancoLocal recusa banco remoto com a mensagem de que só roda em banco local", () => {
    expect(() => exigirBancoLocal(URL_REMOTA)).toThrow(RecusaDoDemo);
    expect(() => exigirBancoLocal(URL_REMOTA)).toThrow(/só roda em banco local/);
    expect(() => exigirBancoLocal(undefined)).toThrow(/só roda em banco local/);
    expect(() => exigirBancoLocal("postgres://postgres:x@localhost:5432/postgres")).not.toThrow();
  });

  it("carregarCrmDemo recusa banco remoto antes de qualquer consulta (nem o begin)", async () => {
    const { cliente, consultas } = clienteQueNaoPodeSerUsado();
    await expect(carregarCrmDemo(cliente, { workspaceId: "ws_dev", urlDoBanco: URL_REMOTA })).rejects.toThrow(/só roda em banco local/);
    expect(consultas).toEqual([]);
  });

  it("sem urlDoBanco, carregarCrmDemo usa DATABASE_URL: remoto recusa antes de consultar", async () => {
    vi.stubEnv("DATABASE_URL", URL_REMOTA);
    try {
      const { cliente, consultas } = clienteQueNaoPodeSerUsado();
      await expect(carregarCrmDemo(cliente, { workspaceId: "ws_dev" })).rejects.toThrow(/só roda em banco local/);
      expect(consultas).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("o id do Espaço fora de ^ws_[a-z0-9_]+$ é recusado antes de consultar", async () => {
    for (const ruim of ["", "n1", "WS_N1", "ws-n1", "ws_n1; drop table x", "ws_n1 ", "ws_"]) {
      expect(() => validarEspacoDoDemo(ruim), JSON.stringify(ruim)).toThrow(RecusaDoDemo);
    }
    expect(() => validarEspacoDoDemo("ws_dev_1")).not.toThrow();
    const { cliente, consultas } = clienteQueNaoPodeSerUsado();
    await expect(carregarCrmDemo(cliente, { workspaceId: "WS_N1", urlDoBanco: "postgres://postgres:x@localhost/x" })).rejects.toThrow(/Espaço inválido/);
    expect(consultas).toEqual([]);
  });
});

describe("lerArgumentos do bootstrap:crm-demo", () => {
  it("--espaco <id> e --espaco=<id>", () => {
    expect(lerArgumentos(["--espaco", "ws_dev"])).toEqual({ espaco: "ws_dev" });
    expect(lerArgumentos(["--espaco=ws_dev_2"])).toEqual({ espaco: "ws_dev_2" });
  });

  it("sem --espaco, sem valor, repetido, desconhecido ou mal formado: recusa", () => {
    expect(() => lerArgumentos([])).toThrow(RecusaDoDemo);
    expect(() => lerArgumentos([])).toThrow(/--espaco/);
    expect(() => lerArgumentos(["--espaco"])).toThrow(/Falta o valor/);
    expect(() => lerArgumentos(["--espaco", "ws_a", "--espaco", "ws_b"])).toThrow(/uma vez/);
    expect(() => lerArgumentos(["--espaco", "ws_a", "--todos"])).toThrow(/Argumento desconhecido/);
    expect(() => lerArgumentos(["--espaco", "WS_N1"])).toThrow(/Espaço inválido/);
  });
});

describe("principal: a CLI devolve o código de saída", () => {
  it("erro de uso (sem --espaco) sai com 2 e mostra a ajuda", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(await principal([])).toBe(2);
      expect(erro.mock.calls.flat().join("\n")).toMatch(/Uso: npm run bootstrap:crm-demo/);
    } finally {
      erro.mockRestore();
    }
  });

  it("banco remoto: sai com 2 dizendo que só roda em banco local, sem tentar conectar", async () => {
    vi.stubEnv("DATABASE_URL", URL_REMOTA);
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      // Se tentasse conectar em db.exemplo.com, o resultado seria 1 ("Falhou: ..."), não 2.
      expect(await principal(["--espaco", "ws_dev"])).toBe(2);
      const saida = erro.mock.calls.flat().join("\n");
      expect(saida).toMatch(/só roda em banco local/);
      expect(saida).not.toMatch(/Falhou/);
      // Nem usuário nem senha vão para o log.
      expect([...log.mock.calls.flat(), saida].join("\n")).not.toMatch(/segredo|usuario/);
    } finally {
      erro.mockRestore();
      log.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describeComBanco("as recusas contra o Postgres local (15-29 Task 2)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("Espaço que não existe no banco local: \"Espaço não encontrado\", nada gravado", async () => {
    const ws = novoEspacoDeTeste("naoexiste");
    await expect(carregar(ws)).rejects.toThrow(/Espaço não encontrado/);
    const r = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.contatos where workspace_id = $1", [ws]);
    expect(r.rows[0]!.n).toBe("0");
  });

  it("principal --espaco de um Espaço inexistente no banco local sai com 2", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(await principal(["--espaco", novoEspacoDeTeste("cli")])).toBe(2);
      expect(erro.mock.calls.flat().join("\n")).toMatch(/Espaço não encontrado/);
    } finally {
      erro.mockRestore();
      log.mockRestore();
    }
  });

  it("principal carrega o demo num Espaço semeado e a segunda execução sai com 2 sem duplicar", async () => {
    const ws = await espacoSemeado("clicarga");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(await principal(["--espaco", ws])).toBe(0);
      const aposPrimeira = await contagens(ws);
      expect(aposPrimeira.conversas).toBeGreaterThan(0);
      expect(log.mock.calls.flat().join("\n")).not.toMatch(/postgres:\/\/|:x@/); // sem usuário nem senha
      expect(await principal(["--espaco", ws])).toBe(2);
      expect(erro.mock.calls.flat().join("\n")).toMatch(/já tem Contatos/);
      expect(await contagens(ws)).toEqual(aposPrimeira);
    } finally {
      erro.mockRestore();
      log.mockRestore();
    }
  });
});
