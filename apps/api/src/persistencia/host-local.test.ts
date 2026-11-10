/**
 * 15-44 Task 3 (M-01) — a trava "só banco local" olha o host que o `pg` USA, não só o da URL.
 *
 * Puro: não conecta, não lê o ambiente, não depende de Docker. `?host=` e `?hostaddr=` na query valem para o
 * `pg` (`pg-connection-string` copia cada parâmetro da query para a configuração e o `host` da query vence o da
 * URL), então uma URL com `localhost` no corpo podia apontar para o banco de produção.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hostDaConexao, hostEhLocal } from "./host-local";

describe("hostEhLocal (15-44, M-01)", () => {
  it("localhost, 127.0.0.1 e [::1] simples são locais, com qualquer porta, usuário e banco", () => {
    expect(hostEhLocal("postgres://postgres:x@localhost:5432/postgres")).toBe(true);
    expect(hostEhLocal("postgres://u:p@127.0.0.1:6543/x")).toBe(true);
    expect(hostEhLocal("postgres://u:p@[::1]:5432/x")).toBe(true);
    expect(hostEhLocal("postgresql://u@localhost/x")).toBe(true);
  });

  it("?host= e ?hostaddr= na query são recusados ANTES de qualquer conexão, mesmo com localhost no corpo", () => {
    expect(hostEhLocal("postgres://u:p@localhost:5432/postgres?host=aws-0-us-west-2.pooler.supabase.com&port=6543")).toBe(false);
    expect(hostEhLocal("postgres://u:p@localhost:5432/postgres?hostaddr=10.0.0.9")).toBe(false);
    expect(hostEhLocal("postgres://u:p@127.0.0.1/postgres?host=db.exemplo.com")).toBe(false);
    expect(hostEhLocal("postgres://u:p@localhost/postgres?host=localhost&host=db.exemplo.com")).toBe(false);
    expect(hostEhLocal("postgres:///postgres?host=db.exemplo.com")).toBe(false);
  });

  it("qualquer query é recusada (a regra não tenta adivinhar quais parâmetros trocam o destino)", () => {
    expect(hostEhLocal("postgres://u:p@localhost/postgres?sslmode=disable")).toBe(false);
    expect(hostEhLocal("postgres://u:p@localhost/postgres?")).toBe(false);
    expect(hostEhLocal("postgres://u:p@exemplo.com/postgres?x=localhost")).toBe(false);
  });

  it("os casos que já eram recusados continuam recusados", () => {
    for (const url of [
      "postgres://u:p@localhost.evil.com/x",
      "postgres://localhost@evil.com/x",
      "postgres://u:p@LOCALHOST/x",
      "postgres://u:p@localhost./x",
      "postgres://u:p@local%68ost/x",
      "postgres://u:p@exemplo.com/localhost",
      "postgres:///x",
      "/var/run/postgresql",
      "isto não é uma url",
      "",
    ]) {
      expect(hostEhLocal(url), url).toBe(false);
    }
    expect(hostEhLocal(undefined)).toBe(false);
  });
});

describe("hostDaConexao (15-44, M-01, L-02)", () => {
  it("devolve host:porta, sem usuário nem senha", () => {
    const texto = hostDaConexao("postgres://usuario:segredo@localhost:55744/postgres");
    expect(texto).toBe("localhost:55744");
    expect(texto).not.toContain("segredo");
    expect(texto).not.toContain("usuario");
  });

  it("mostra o host que o pg usa, e não o do corpo da URL, quando a query o troca", () => {
    expect(hostDaConexao("postgres://u:p@localhost:5432/postgres?host=db.exemplo.com&port=6543")).toBe("db.exemplo.com:6543");
  });

  it("URL ilegível ou ausente vira (host indefinido), sem lançar nem imprimir a URL", () => {
    expect(hostDaConexao(undefined)).toBe("(host indefinido)");
    expect(hostDaConexao("")).toBe("(host indefinido)");
    expect(hostDaConexao("isto não é uma url com segredo")).not.toContain("segredo");
  });
});

describe("os lugares que usam a regra (15-44, M-01)", () => {
  const LUGARES = ["../bootstrap/crm-demo.ts", "../bootstrap/crm-demo.cli.ts", "../testes/banco-crm.ts", "../migracao-crm/migrar.cli.ts"];
  for (const arquivo of LUGARES) {
    it(`${arquivo.split("/").pop()} usa o helper e não tem regra de host própria`, () => {
      const codigo = readFileSync(new URL(arquivo, import.meta.url), "utf8");
      expect(codigo).toMatch(/host-local/);
      expect(codigo).not.toMatch(/\.hostname/);
    });
  }
});
