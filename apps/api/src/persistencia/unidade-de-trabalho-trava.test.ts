/**
 * 06-13 (Task 1, F6) — os prazos do lado do servidor e a trava esgotada.
 *
 * O `query_timeout` do pool (30 s) é um temporizador DO CLIENTE: ao estourar,
 * o `pg` devolve o erro e não cancela a instrução no servidor. Atrás do pooler,
 * um `update plataforma.workspaces … revisao` que esperava a trava pode seguir
 * vivo e pegar a revisão do Espaço depois que o cliente já desistiu (06-PROVAS,
 * H4). Por isso a transação abre com `statement_timeout` e `lock_timeout`
 * ABAIXO do `query_timeout`: o servidor desiste antes do cliente. E a trava
 * esgotada (SQLSTATE 55P03) na revisão é conflito, não exceção: a conexão está
 * sã, e quem chamou tenta de novo sobre o estado novo.
 *
 * Arquivo novo (CON-05), no molde de `unidade-de-trabalho.test.ts`: pool,
 * repositório e outbox são falsos. Sem banco.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@n1/dominio/state";
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

/** Um erro do `pg` com SQLSTATE, como o driver entrega (`erro.code`). */
function erroDoBanco(code: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { code });
}

describe("(k) o begin leva os três prazos do servidor, abaixo do query_timeout", () => {
  it("padrão (30 s): statement_timeout = 80 %, lock_timeout = 1/3", () => {
    expect(inicioDaTransacao({})).toBe(
      "begin; set local idle_in_transaction_session_timeout = 30000; set local statement_timeout = 24000; set local lock_timeout = 10000",
    );
  });

  it("DATABASE_QUERY_TIMEOUT_MS=5000: os prazos acompanham", () => {
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "5000" })).toBe(
      "begin; set local idle_in_transaction_session_timeout = 5000; set local statement_timeout = 4000; set local lock_timeout = 1666",
    );
  });

  it("com o query_timeout desligado (0), o begin puro", () => {
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "0" })).toBe("begin");
  });

  it("nunca 0 com a consulta ligada: o mínimo é 1 (0 no Postgres DESLIGA o prazo)", () => {
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "1" })).toBe(
      "begin; set local idle_in_transaction_session_timeout = 1; set local statement_timeout = 1; set local lock_timeout = 1",
    );
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "2" })).toBe(
      "begin; set local idle_in_transaction_session_timeout = 2; set local statement_timeout = 1; set local lock_timeout = 1",
    );
  });

  it("os dois prazos ficam SEMPRE abaixo (ou no mínimo) do query_timeout", () => {
    for (const q of [3, 10, 999, 30_000, 120_000]) {
      const sql = inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: String(q) });
      const statement = Number(/statement_timeout = (\d+)/.exec(sql)?.[1]);
      const trava = Number(/lock_timeout = (\d+)/.exec(sql)?.[1]);
      expect(statement).toBeGreaterThanOrEqual(1);
      expect(trava).toBeGreaterThanOrEqual(1);
      expect(statement).toBeLessThan(q);
      expect(trava).toBeLessThan(q);
    }
  });
});

describe("(l) a trava esgotada na revisão do Espaço é conflito", () => {
  const naRevisao = (sql: string) => sql.startsWith("update plataforma.workspaces");

  it("55P03 no update da revisão: conflito depois das 3 tentativas, um rollback por tentativa, e a conexão volta ao pool", async () => {
    falso.erroEm = (sql) => (naRevisao(sql) ? erroDoBanco("55P03", "canceling statement due to lock timeout") : undefined);
    const r = await executar("ws_x", () => ok("feito"));
    expect(r).toMatchObject({ ok: false, conflito: true });
    expect(falso.consultas.filter((sql) => sql === "rollback")).toHaveLength(3);
    expect(falso.consultas).not.toContain("commit");
    expect(falso.release).toEqual([false, false, false]);
  });

  it("55P03 uma vez e depois a trava sai: a segunda tentativa confirma", async () => {
    let vezes = 0;
    falso.erroEm = (sql) => (naRevisao(sql) && (vezes += 1) === 1 ? erroDoBanco("55P03", "canceling statement due to lock timeout") : undefined);
    const r = await executar("ws_x", () => ok("feito"));
    expect(r.ok).toBe(true);
    expect(falso.consultas.at(-1)).toBe("commit");
    expect(falso.release).toEqual([false, false]);
  });

  it("57014 (instrução cancelada pelo statement_timeout): a exceção sobe e a conexão sai do pool", async () => {
    falso.erroEm = (sql) => (naRevisao(sql) ? erroDoBanco("57014", "canceling statement due to statement timeout") : undefined);
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow("statement timeout");
    expect(falso.release).toEqual([true]);
  });

  it("55P03 FORA da revisão (no insert dos registros) não vira conflito: sobe como antes", async () => {
    falso.erroEm = (sql) => (sql.startsWith("begin") || naRevisao(sql) ? undefined : sql === "commit" ? erroDoBanco("55P03", "lock timeout") : undefined);
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow("lock timeout");
    expect(falso.release).toEqual([true]);
  });
});
