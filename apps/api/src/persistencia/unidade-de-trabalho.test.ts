/**
 * A Unidade de Trabalho diante de uma conexão que o pooler derruba no meio
 * (2026-09-29: escritas no `ws_n1` paradas por 16 e 10 minutos): o `begin`
 * leva o prazo do lado do servidor, e a conexão que falhou sai do pool em vez
 * de servir à próxima requisição. Sem banco: pool, repositório e outbox são
 * falsos — o que se prova é o protocolo com a conexão, não o SQL de negócio.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail, ok } from "@n1/dominio/state";
import { executar, inicioDaTransacao } from "./unidade-de-trabalho";

const falso = vi.hoisted(() => ({
  consultas: [] as string[],
  erroEm: (_sql: string): Error | undefined => undefined,
  release: [] as unknown[],
}));

vi.mock("./conexao", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./conexao")>()),
  pool: () => ({
    connect: async () => ({
      query: async (sql: string) => {
        falso.consultas.push(sql);
        const erro = falso.erroEm(sql);
        if (erro) throw erro;
        if (sql.startsWith("update plataforma.workspaces")) return { rowCount: 1, rows: [{ revisao: "8" }] };
        return { rowCount: 0, rows: [] };
      },
      release: (descartar?: unknown) => falso.release.push(descartar),
    }),
  }),
}));
vi.mock("./repositorio", () => ({
  hidratar: async () => ({ state: { automationExecutions: [] }, revisao: 7 }),
  gravar: async () => ({}),
}));
vi.mock("./outbox", () => ({ gravarEventos: async () => undefined }));
vi.mock("./eventos-de-canal", () => ({ execucoesNovas: () => [], eventosDeNotificacaoPorCanal: () => [] }));

beforeEach(() => {
  falso.consultas.length = 0;
  falso.release.length = 0;
  falso.erroEm = () => undefined;
});

describe("Unidade de Trabalho — conexão que cai no meio", () => {
  it("o begin leva o prazo do servidor igual ao query_timeout do pool (e some quando ele é desligado)", () => {
    expect(inicioDaTransacao({})).toBe("begin; set local idle_in_transaction_session_timeout = 30000");
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "5000" })).toBe("begin; set local idle_in_transaction_session_timeout = 5000");
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "0" })).toBe("begin");
  });

  it("sucesso: abre com o prazo, confirma, e a conexão volta ao pool", async () => {
    const r = await executar("ws_x", () => ok("feito"));
    expect(r.ok).toBe(true);
    expect(falso.consultas[0]).toBe(inicioDaTransacao());
    expect(falso.consultas.at(-1)).toBe("commit");
    expect(falso.release).toEqual([false]);
  });

  it("recusa do domínio: desfaz, e a conexão volta ao pool (ela está sã)", async () => {
    const r = await executar("ws_x", () => fail("recusado"));
    expect(r.ok).toBe(false);
    expect(falso.consultas).toContain("rollback");
    expect(falso.release).toEqual([false]);
  });

  it("consulta que estoura o tempo no meio da transação: o erro sobe e a conexão sai do pool", async () => {
    falso.erroEm = (sql) => (sql.startsWith("update plataforma.workspaces") ? new Error("Query read timeout") : undefined);
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow("Query read timeout");
    expect(falso.release).toEqual([true]);
  });

  it("conexão que cai já no begin: o erro sobe e a conexão sai do pool", async () => {
    falso.erroEm = (sql) => (sql.startsWith("begin") ? new Error("Connection terminated unexpectedly") : undefined);
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow("Connection terminated unexpectedly");
    expect(falso.release).toEqual([true]);
  });
});
