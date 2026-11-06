/**
 * A CLI do `migrar:crm-antigo` (15-27, Task 3): `lerArgumentos` é pura e `principal` devolve o código de
 * saída, então nada aqui precisa de processo. O que toca o banco só roda no Postgres de Docker.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ErroDeUso } from "./colecoes";
import { lerArgumentos, principal } from "./migrar.cli";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";

describe("lerArgumentos", () => {
  it("--espaco ws_n1 --migrar --funil=guardar", () => {
    expect(lerArgumentos(["--espaco", "ws_n1", "--migrar", "--funil=guardar"])).toEqual({ espaco: "ws_n1", modo: "migrar", funil: "guardar" });
  });

  it("aceita --espaco=ws_n1 e --funil migrar com valor separado", () => {
    expect(lerArgumentos(["--espaco=ws_n1", "--migrar", "--funil", "migrar"])).toEqual({ espaco: "ws_n1", modo: "migrar", funil: "migrar" });
  });

  it.each(["seco", "guardar", "verificar"] as const)("o modo --%s sozinho", (modo) => {
    expect(lerArgumentos(["--espaco", "ws_n1", `--${modo}`])).toEqual({ espaco: "ws_n1", modo });
  });

  it("sem --espaco: erro de uso com a ajuda", () => {
    expect(() => lerArgumentos(["--seco"])).toThrow(ErroDeUso);
    expect(() => lerArgumentos(["--seco"])).toThrow(/--espaco/);
  });

  it("--espaco com o formato errado é recusado antes de qualquer banco", () => {
    expect(() => lerArgumentos(["--espaco", "ws_x; drop", "--seco"])).toThrow(ErroDeUso);
    expect(() => lerArgumentos(["--espaco", "WS_N1", "--seco"])).toThrow(/Espaço inválido/);
    expect(() => lerArgumentos(["--espaco", "n1", "--seco"])).toThrow(/Espaço inválido/);
  });

  it("nenhum modo: não existe modo padrão", () => {
    expect(() => lerArgumentos(["--espaco", "ws_n1"])).toThrow(/modo/i);
  });

  it("dois modos juntos são recusados", () => {
    expect(() => lerArgumentos(["--espaco", "ws_n1", "--seco", "--guardar"])).toThrow(/só um modo/i);
  });

  it("--funil só vale com --migrar", () => {
    expect(() => lerArgumentos(["--espaco", "ws_n1", "--guardar", "--funil=guardar"])).toThrow(/--funil só vale com --migrar/);
  });

  it("--funil com valor desconhecido, argumento desconhecido e --espaco repetido são recusados", () => {
    expect(() => lerArgumentos(["--espaco", "ws_n1", "--migrar", "--funil=talvez"])).toThrow(/migrar ou guardar/);
    expect(() => lerArgumentos(["--espaco", "ws_n1", "--seco", "--todos"])).toThrow(/Argumento desconhecido/);
    expect(() => lerArgumentos(["--espaco", "ws_n1", "--espaco", "ws_n2", "--seco"])).toThrow(/uma vez/);
    expect(() => lerArgumentos(["--espaco"])).toThrow(ErroDeUso);
  });
});

describe("principal: erro de uso sai com 2 sem tocar no banco", () => {
  it("sem argumentos", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(await principal([])).toBe(2);
      expect(erro.mock.calls.flat().join("\n")).toMatch(/--espaco/);
    } finally {
      erro.mockRestore();
    }
  });
});

describeComBanco("principal contra Postgres de Docker", () => {
  const criados: string[] = [];
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("--espaco ws_nao_existe --seco: 'Espaço não encontrado' e saída 2", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(await principal(["--espaco", "ws_nao_existe_1527", "--seco"])).toBe(2);
      expect(erro.mock.calls.flat().join("\n")).toMatch(/Espaço não encontrado/);
    } finally {
      erro.mockRestore();
      log.mockRestore();
    }
  });

  it("imprime o host do banco (sem senha) e o Espaço ANTES do resultado, e sai 0", async () => {
    const ws = novoEspacoDeTeste("cli");
    criados.push(ws);
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(await principal(["--espaco", ws, "--guardar"])).toBe(0);
      const saida = log.mock.calls.map((c) => c.join(" "));
      expect(saida[0]).toContain(new URL(process.env.DATABASE_URL ?? "").host);
      expect(saida[0]).toContain(ws);
      expect(saida.join("\n")).not.toContain("postgres://");
      expect(saida.join("\n")).toMatch(/nada a fazer/i);
    } finally {
      log.mockRestore();
    }
  });

  it("--verificar num Espaço com CRM antigo ainda em registros: saída 1", async () => {
    const ws = novoEspacoDeTeste("cliverif");
    criados.push(ws);
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
    await pool().query("insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'contacts', 'cnt_x', '{\"id\":\"cnt_x\"}')", [ws]);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(await principal(["--espaco", ws, "--verificar"])).toBe(1);
      expect(log.mock.calls.flat().join("\n")).toMatch(/contacts/);
    } finally {
      log.mockRestore();
    }
  });
});
