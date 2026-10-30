/**
 * `medirGravacao` e o comando `gravacao:medir` contra Postgres local (Fase 12,
 * 12-02) — SÓ Postgres descartável, nunca o banco do `.env`:
 *
 *   docker run -d --rm --name crm-n1-pg-1202 -e POSTGRES_PASSWORD=x -p 55622:5432 postgres:16
 *   cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55622/postgres \
 *     DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55622/postgres \
 *     npx vitest run src/observabilidade/medir-gravacao.test.ts
 *   docker rm -f crm-n1-pg-1202
 *
 * Sem `DATABASE_URL` local o `describeComBanco` pula. O Fastify sobe em
 * loopback com um `verificarToken` de teste e o logger capturado num array: é a
 * mesma montagem que o comando `gravacao:medir` faz sozinho (D-17). O comando de
 * verdade roda por `spawnSync` (ninguém o importa).
 */

import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SINGULARES } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import { formatarRelatorio, type RelatorioDaMedicao } from "./medicao-da-gravacao";
import { opcoesDoLogger } from "./log";
import { medirGravacao, PREFIXO_DE_TESTE } from "./medir-gravacao";

const PASTA_DA_API = fileURLToPath(new URL("../..", import.meta.url));
const COMANDO = ["vite-node", "src/observabilidade/medir-gravacao.cli.ts"];

async function impressaoDigital(workspaceId: string): Promise<Map<string, string>> {
  const resultado = await pool().query<{ chave: string; md5: string }>(
    `select colecao || '/' || id as chave, md5(dados::text) as md5
       from plataforma.registros
      where workspace_id = $1 and colecao <> all($2::text[])`,
    [workspaceId, [...SINGULARES]],
  );
  return new Map(resultado.rows.map((r) => [r.chave, r.md5]));
}

describeComBanco("medirGravacao — contra o banco local", () => {
  const ws = novoEspacoDeTeste("medir");
  const semente = buildSeed();
  const proprietario = semente.members.find((m) => m.id === semente.workspace.ownerMemberId);
  const linhas: string[] = [];
  let app: FastifyInstance;
  let baseUrl = "";
  let relatorio: RelatorioDaMedicao;
  let antes: Map<string, string>;
  let depois: Map<string, string>;

  beforeAll(async () => {
    await prepararBancoCrm();
    expect(proprietario?.userId, "o Proprietário do seed precisa de userId").toBeTruthy();
    const cliente = await pool().connect();
    try {
      await semear(cliente, ws, semente);
    } finally {
      cliente.release();
    }
    const destino = { write: (linha: string) => void linhas.push(linha) };
    app = buildApp({
      logger: opcoesDoLogger({ LOG_LEVEL: "info" }, destino),
      workspaceId: ws,
      verificarToken: async (t) => (t === "tok-teste" ? { sub: proprietario!.userId! } : null),
    });
    await app.listen({ host: "127.0.0.1", port: 0 });
    baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;

    antes = await impressaoDigital(ws);
    relatorio = await medirGravacao({
      baseUrl,
      token: "tok-teste",
      workspaceId: ws,
      repeticoes: 2,
      linhasDoLog: () => linhas,
      revisaoDoCodigo: "teste",
    });
    depois = await impressaoDigital(ws);
  });

  afterAll(async () => {
    await app?.close();
    await limparEspaco(ws);
  });

  it("repete createList no Espaço de teste e devolve mediana e pior por etapa", () => {
    const criar = relatorio.gestos[0];
    expect(criar?.operacao).toBe("createList");
    expect(criar?.amostras).toBe(2);
    expect(typeof criar?.etapas.hidratarMs.mediana).toBe("number");
    expect(criar!.etapas.hidratarMs.pior).toBeGreaterThanOrEqual(criar!.etapas.hidratarMs.mediana);
    expect(criar?.desfechos).toEqual({ gravou: 2 });
  });

  it("mede os quatro gestos, cada um com todas as amostras e desfecho gravou", () => {
    expect(relatorio.gestos.map((g) => g.operacao)).toEqual(["createList", "updateContainer", "trashContainer", "changeTaskStatus"]);
    for (const gesto of relatorio.gestos) {
      expect(gesto.amostras, gesto.operacao).toBe(2);
      expect(gesto.desfechos, gesto.operacao).toEqual({ gravou: 2 });
      expect(gesto.etapas.totalMs.mediana, gesto.operacao).toBeGreaterThan(0);
      expect(gesto.pedidoMs.mediana, gesto.operacao).toBeGreaterThan(0);
      expect(gesto.linhasLidas.mediana, gesto.operacao).toBeGreaterThan(0);
    }
  });

  it("mede select 1, hidratar direto e GET /estado, e traz o tamanho de plataforma.registros", () => {
    expect(relatorio.idaEVolta.amostras).toBe(2);
    expect(relatorio.hidratarDireto.amostras).toBe(2);
    expect(relatorio.hidratarDireto.registros).toBeGreaterThan(0);
    expect(relatorio.estado.amostras).toBe(2);
    expect(relatorio.tamanho.recusada).toBeUndefined();
    expect(relatorio.tamanho.total.registros).toBeGreaterThan(0);
    expect(relatorio.tamanho.porColecao.length).toBeGreaterThan(0);
    expect(relatorio.tamanho.porColecao.reduce((soma, c) => soma + c.registros, 0)).toBe(relatorio.tamanho.total.registros);
    expect(relatorio.tamanho.total.texto).toBeGreaterThan(0);
  });

  it("os Espaços de teste ZZ-MEDICAO terminam na lixeira", async () => {
    const espacos = await pool().query<{ lifecycle: string }>(
      `select dados->>'lifecycle' as lifecycle
         from plataforma.registros
        where workspace_id = $1 and colecao = 'spaces' and dados->>'name' like $2`,
      [ws, `${PREFIXO_DE_TESTE}-%`],
    );
    expect(espacos.rows.length).toBeGreaterThanOrEqual(2);
    for (const espaco of espacos.rows) expect(espaco.lifecycle).toBe("naLixeira");
  });

  it("nenhum registro que já existia (fora dos singulares) mudou: o que mudou é só o que o comando criou", () => {
    const mudaram = [...antes].filter(([chave, md5]) => depois.get(chave) !== md5).map(([chave]) => chave);
    expect(mudaram).toEqual([]);
    const criados = [...depois.keys()].filter((chave) => !antes.has(chave));
    expect(criados.length).toBeGreaterThan(0);
  });

  it("a saída não contém título de Tarefa nem e-mail de ninguém", () => {
    const texto = formatarRelatorio(relatorio);
    for (const tarefa of semente.tasks) {
      if (tarefa.title.trim().length >= 6) expect(texto, `título "${tarefa.title}"`).not.toContain(tarefa.title);
    }
    expect(texto).not.toContain("@");
    expect(texto).toContain("plataforma.registros");
  });

  describe("o comando de verdade", () => {
    function rodar(argumentos: readonly string[], env: NodeJS.ProcessEnv = { ...process.env, WORKSPACE_ID: ws }) {
      return spawnSync("npx", [...COMANDO, ...argumentos], { cwd: PASTA_DA_API, env, encoding: "utf8", timeout: 180_000 });
    }

    it("--repeticoes=1 sai com 0 e imprime os quatro nomes de operação e plataforma.registros", () => {
      const saida = rodar(["--repeticoes=1"]);
      expect(saida.status, saida.stderr).toBe(0);
      for (const operacao of ["createList", "updateContainer", "trashContainer", "changeTaskStatus"]) {
        expect(saida.stdout).toContain(operacao);
      }
      expect(saida.stdout).toContain("plataforma.registros");
      expect(saida.stdout).not.toContain("@");
    });

    it("--repeticoes=0 sai com código 2", () => {
      expect(rodar(["--repeticoes=0"]).status).toBe(2);
      expect(rodar(["--repeticoes=51"]).status).toBe(2);
      expect(rodar(["--repeticoes=abc"]).status).toBe(2);
    });

    it("--workspace diferente de WORKSPACE_ID sem --confirmar-espaco sai com código 2", () => {
      const saida = rodar(["--repeticoes=1", "--workspace=ws_outro_espaco"]);
      expect(saida.status, saida.stderr).toBe(2);
    });
  });
});

describe("medirGravacao — sem banco", () => {
  it("lança com o nome da chamada e o status, sem token nem args, quando a API recusa (sem sessão)", async () => {
    const app = buildApp({ logger: false, workspaceId: "ws_sem_banco", verificarToken: async () => null });
    await app.listen({ host: "127.0.0.1", port: 0 });
    try {
      const baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
      await expect(
        medirGravacao({ baseUrl, token: "x", workspaceId: "ws_sem_banco", repeticoes: 1, linhasDoLog: () => [], revisaoDoCodigo: "t" }),
      ).rejects.toThrow(/^GET \/estado: HTTP 401(?!.*Bearer)/);
    } finally {
      await app.close();
    }
  });
});
