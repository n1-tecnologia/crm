/**
 * `medirGravacao` contra Postgres local (Fase 12, 12-02) — SÓ Postgres descartável,
 * nunca o banco do `.env`:
 *
 *   docker run -d --rm --name crm-n1-pg-1202 -e POSTGRES_PASSWORD=x -p 55622:5432 postgres:16
 *   cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55622/postgres \
 *     DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55622/postgres \
 *     npx vitest run src/observabilidade/medir-gravacao.test.ts
 *   docker rm -f crm-n1-pg-1202
 *
 * Sem `DATABASE_URL` local o `describeComBanco` pula. O Fastify sobe em
 * loopback com um `verificarToken` de teste e o logger capturado num array: é a
 * mesma montagem que o comando `gravacao:medir` faz sozinho (D-17).
 */

import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import { opcoesDoLogger } from "./log";
import { medirGravacao, PREFIXO_DE_TESTE } from "./medir-gravacao";

describeComBanco("medirGravacao — contra o banco local", () => {
  const ws = novoEspacoDeTeste("medir");
  const semente = buildSeed();
  const proprietario = semente.members.find((m) => m.id === semente.workspace.ownerMemberId);
  const linhas: string[] = [];
  let app: FastifyInstance;
  let baseUrl = "";

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
  });

  afterAll(async () => {
    await app?.close();
    await limparEspaco(ws);
  });

  it("repete createList no Espaço de teste, devolve mediana e pior por etapa e deixa o Espaço na lixeira", async () => {
    const relatorio = await medirGravacao({
      baseUrl,
      token: "tok-teste",
      workspaceId: ws,
      repeticoes: 2,
      linhasDoLog: () => linhas,
      revisaoDoCodigo: "teste",
    });

    const criar = relatorio.gestos[0];
    expect(criar?.operacao).toBe("createList");
    expect(criar?.amostras).toBe(2);
    expect(typeof criar?.etapas.hidratarMs.mediana).toBe("number");
    expect(criar!.etapas.hidratarMs.pior).toBeGreaterThanOrEqual(criar!.etapas.hidratarMs.mediana);
    expect(criar?.desfechos).toEqual({ gravou: 2 });

    const espacos = await pool().query<{ lifecycle: string; nome: string }>(
      `select dados->>'lifecycle' as lifecycle, dados->>'name' as nome
         from plataforma.registros
        where workspace_id = $1 and colecao = 'spaces' and dados->>'name' like $2`,
      [ws, `${PREFIXO_DE_TESTE}-%`],
    );
    expect(espacos.rows.length).toBeGreaterThanOrEqual(1);
    for (const espaco of espacos.rows) expect(espaco.lifecycle).toBe("naLixeira");
  });
});
