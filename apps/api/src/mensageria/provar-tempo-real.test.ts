/**
 * `tempo-real:provar` (16-15, D-16-01, A9): uma volta de `LISTEN`/`NOTIFY` pela `DATABASE_URL`, contra o Postgres 16 de
 * Docker. Nunca o banco do `.env`: o teste só lê `DATABASE_URL` do ambiente de quem roda e se recusa a seguir se ela
 * não for local.
 */

import { describe, expect, it } from "vitest";
import { principal, provarTempoReal } from "./provar-tempo-real";

function urlLocal(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida: rode contra o Postgres 16 de Docker");
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("este teste só roda contra um Postgres local");
  return url;
}

function capturar() {
  const saida: string[] = [];
  const erros: string[] = [];
  return { saida, erros, io: { out: (texto: string) => saida.push(texto), err: (texto: string) => erros.push(texto) } };
}

describe("provarTempoReal", () => {
  it("mede uma volta de LISTEN/NOTIFY pelo Postgres local e diz o papel e a porta", async () => {
    const resultado = await provarTempoReal({ url: urlLocal() });
    expect(resultado.papel).toBe("postgres");
    expect(resultado.porta).toBe(5432);
    expect(resultado.recebidoEmMs).toBeGreaterThanOrEqual(0);
    expect(resultado.recebidoEmMs).toBeLessThan(1000);
  });

  it("sem a notificação dentro de esperaMs, falha com a frase em segundos", async () => {
    await expect(provarTempoReal({ url: urlLocal(), esperaMs: 300, notificar: false })).rejects.toThrow(
      "A notificação não chegou em 0,3 s.",
    );
  });
});

describe("principal", () => {
  it("imprime só a linha papel/porta/ms e devolve 0", async () => {
    const { saida, erros, io } = capturar();
    const codigo = await principal([], { url: urlLocal(), saida: io });
    expect(codigo).toBe(0);
    expect(erros).toEqual([]);
    expect(saida).toHaveLength(1);
    expect(saida[0]).toMatch(/^papel=postgres porta=5432 recebido_em_ms=\d+$/);
  });

  it("com a porta sem banco devolve 1 e a saída não traz a URL", async () => {
    const { saida, erros, io } = capturar();
    const url = "postgres://usuario_secreto:senha_secreta@localhost:1/postgres";
    const codigo = await principal([], { url, saida: io });
    expect(codigo).toBe(1);
    const tudo = [...saida, ...erros].join("\n");
    expect(tudo).not.toContain(url);
    expect(tudo).not.toContain("senha_secreta");
    expect(tudo).not.toContain("usuario_secreto");
    expect(tudo).not.toContain("localhost:1");
    expect(tudo.length).toBeGreaterThan(0);
  });

  it("sem a notificação em esperaMs devolve 1 com a frase em segundos", async () => {
    const { erros, io } = capturar();
    const codigo = await principal([], { url: urlLocal(), esperaMs: 300, notificar: false, saida: io });
    expect(codigo).toBe(1);
    expect(erros.join("\n")).toContain("A notificação não chegou em 0,3 s.");
  });

  it("sem DATABASE_URL devolve 2", async () => {
    const { erros, io } = capturar();
    const codigo = await principal([], { url: "", saida: io });
    expect(codigo).toBe(2);
    expect(erros.join("\n")).toContain("DATABASE_URL");
  });
});
