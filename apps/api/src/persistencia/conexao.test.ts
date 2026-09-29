/**
 * Os limites de tempo do pool (`limitesDoPool`) e o encerramento da conexão
 * cuja consulta estoura o tempo (`encerrarAoEstourarOTempo`) — puros, sem
 * banco e sem `.env`. Origem: em 2026-09-29 duas escritas no `ws_n1` ficaram
 * 16 e 10 minutos paradas quando o pooler derrubou a conexão no meio.
 */
import { describe, expect, it, vi } from "vitest";
import { TEMPO_DE_CONSULTA_PADRAO_MS, encerrarAoEstourarOTempo, limitesDoPool } from "./conexao";

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
