/**
 * Os limites de tempo do pool (`limitesDoPool`) e o encerramento da conexão
 * cuja consulta estoura o tempo (`encerrarAoEstourarOTempo`) — puros, sem
 * banco e sem `.env`. Origem: em 2026-09-29 duas escritas no `ws_n1` ficaram
 * 16 e 10 minutos paradas quando o pooler derrubou a conexão no meio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TEMPO_DE_CONSULTA_PADRAO_MS,
  encerrar,
  encerrarAoEstourarOTempo,
  limitesDoPool,
  pool,
  poolDeMigracao,
} from "./conexao";

describe("limitesDoPool", () => {
  it("padrão: 30 s por consulta, 10 s para abrir conexão, keepAlive ligado", () => {
    expect(TEMPO_DE_CONSULTA_PADRAO_MS).toBe(30_000);
    expect(limitesDoPool({})).toEqual({
      query_timeout: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
  });

  it("DATABASE_QUERY_TIMEOUT_MS muda o prazo; 0 desliga; valor inválido cai no padrão", () => {
    expect(limitesDoPool({ DATABASE_QUERY_TIMEOUT_MS: "5000" }).query_timeout).toBe(5000);
    expect(limitesDoPool({ DATABASE_QUERY_TIMEOUT_MS: "0" })).not.toHaveProperty("query_timeout");
    for (const invalido of ["abc", "-1", "1.5", "  "]) {
      expect(limitesDoPool({ DATABASE_QUERY_TIMEOUT_MS: invalido }).query_timeout, invalido).toBe(30_000);
    }
  });
});

describe("encerrarAoEstourarOTempo", () => {
  function clienteQueResponde(resposta: () => Promise<unknown>) {
    const original = vi.fn((..._args: unknown[]) => resposta());
    const end = vi.fn(() => Promise.resolve());
    const cliente = { query: original as unknown, end };
    encerrarAoEstourarOTempo(cliente);
    return { consultar: cliente.query as (...args: unknown[]) => Promise<unknown>, original, end };
  }

  it("a consulta que estoura o tempo: quem chamou recebe o erro e a conexão é encerrada", async () => {
    const c = clienteQueResponde(() => Promise.reject(new Error("Query read timeout")));
    await expect(c.consultar("select 1")).rejects.toThrow("Query read timeout");
    expect(c.end).toHaveBeenCalledTimes(1);
  });

  it("outro erro (uma recusa do banco) não encerra a conexão", async () => {
    const c = clienteQueResponde(() => Promise.reject(new Error("duplicate key value violates unique constraint")));
    await expect(c.consultar("insert")).rejects.toThrow("duplicate key");
    expect(c.end).not.toHaveBeenCalled();
  });

  it("a consulta que responde passa intacta, com os argumentos de sempre", async () => {
    const c = clienteQueResponde(() => Promise.resolve({ rows: [{ n: 1 }] }));
    await expect(c.consultar("select $1", [7])).resolves.toEqual({ rows: [{ n: 1 }] });
    expect(c.original).toHaveBeenCalledWith("select $1", [7]);
    expect(c.end).not.toHaveBeenCalled();
  });
});

describe("poolDeMigracao (D-07)", () => {
  const URL_DO_APP = "postgres://n1_api:x@localhost:55604/app";
  const URL_DE_MIGRACAO = "postgres://postgres:x@localhost:55604/dono";
  const guardado = { app: process.env.DATABASE_URL, migracao: process.env.DATABASE_URL_MIGRACAO };

  beforeEach(async () => {
    await encerrar();
    process.env.DATABASE_URL = URL_DO_APP;
    // "" e não `delete`: carregarEnv() só preenche chave `undefined`, e o .env do dev não deve vazar para o teste.
    process.env.DATABASE_URL_MIGRACAO = "";
  });

  afterEach(async () => {
    await encerrar();
    if (guardado.app === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = guardado.app;
    if (guardado.migracao === undefined) delete process.env.DATABASE_URL_MIGRACAO;
    else process.env.DATABASE_URL_MIGRACAO = guardado.migracao;
  });

  it("sem DATABASE_URL_MIGRACAO devolve a mesma instância de pool()", () => {
    expect(poolDeMigracao()).toBe(pool());
  });

  it("com DATABASE_URL_MIGRACAO devolve outro Pool, e pool() continua com DATABASE_URL", () => {
    process.env.DATABASE_URL_MIGRACAO = URL_DE_MIGRACAO;
    const deMigracao = poolDeMigracao();
    const doApp = pool();
    expect(deMigracao).not.toBe(doApp);
    expect((deMigracao as unknown as { options: { connectionString: string } }).options.connectionString).toBe(URL_DE_MIGRACAO);
    expect((doApp as unknown as { options: { connectionString: string } }).options.connectionString).toBe(URL_DO_APP);
    expect(poolDeMigracao()).toBe(deMigracao);
  });

  it("encerrar() fecha os dois pools quando são distintos", async () => {
    process.env.DATABASE_URL_MIGRACAO = URL_DE_MIGRACAO;
    const fim = vi.spyOn(Object.getPrototypeOf(pool()), "end").mockResolvedValue(undefined);
    poolDeMigracao();
    await encerrar();
    expect(fim).toHaveBeenCalledTimes(2);
    fim.mockRestore();
  });

  it("encerrar() fecha uma vez só quando o pool de migração é o próprio pool()", async () => {
    const fim = vi.spyOn(Object.getPrototypeOf(pool()), "end").mockResolvedValue(undefined);
    poolDeMigracao();
    await encerrar();
    expect(fim).toHaveBeenCalledTimes(1);
    fim.mockRestore();
  });
});
