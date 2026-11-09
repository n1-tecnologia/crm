/**
 * `avisarCrm` contra o Postgres LOCAL (16-07, 3.8.2, Docker, porta 55722):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55722/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55722/postgres npx vitest run src/mensageria/avisar.test.ts
 *
 * Um `pg.Client` avulso em `LISTEN crm_eventos` faz o papel do ouvinte. O que o teste prova é o contrato do NOTIFY: só
 * chega depois do `commit`, nunca depois do `rollback`, eventos distintos da mesma transação chegam todos, e o
 * payload tem só as chaves do evento (ids e tipo).
 */

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { EventoDoCrm } from "@n1/dominio/crm/eventos";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco } from "../testes/banco-crm";
import { avisarCrm, CANAL_DO_NOTIFY } from "./avisar";

const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

describeComBanco("avisarCrm: o NOTIFY só existe se a transação confirma", () => {
  /** Cada execução usa o seu Espaço: notificações de outro arquivo no mesmo banco não entram na conta. */
  const ws = `ws_avisar_${randomUUID().slice(0, 8)}`;
  const recebidos: Array<Record<string, unknown>> = [];
  let ouvinte: Client;

  async function numaTransacao(eventos: EventoDoCrm[], desfecho: "commit" | "rollback"): Promise<void> {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      for (const evento of eventos) await avisarCrm(cliente, evento);
      await cliente.query(desfecho);
    } finally {
      cliente.release();
    }
  }

  /** O que chegou deste Espaço até o prazo: espera `quantos` ou esgota o prazo. */
  async function esperar(quantos: number, prazoMs = 2_000): Promise<Array<Record<string, unknown>>> {
    const limite = Date.now() + prazoMs;
    while (recebidos.length < quantos && Date.now() < limite) await dormir(5);
    return [...recebidos];
  }

  beforeAll(async () => {
    ouvinte = new Client({ connectionString: process.env.DATABASE_URL });
    await ouvinte.connect();
    ouvinte.on("notification", (mensagem) => {
      if (mensagem.channel !== CANAL_DO_NOTIFY || !mensagem.payload) return;
      const lido = JSON.parse(mensagem.payload) as Record<string, unknown>;
      if (lido.workspaceId === ws) recebidos.push(lido);
    });
    await ouvinte.query(`LISTEN ${CANAL_DO_NOTIFY}`);
  });

  afterAll(async () => {
    await ouvinte.end();
    await encerrar();
  });

  it("o canal é crm_eventos", () => {
    expect(CANAL_DO_NOTIFY).toBe("crm_eventos");
  });

  it("depois do commit o evento chega, com as chaves do evento e nenhuma a mais", async () => {
    recebidos.length = 0;
    await numaTransacao([{ workspaceId: ws, tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" }], "commit");

    const chegou = await esperar(1);
    expect(chegou).toEqual([{ workspaceId: ws, tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" }]);
    expect(Object.keys(chegou[0]!).sort()).toEqual(["conversaId", "mensagemId", "tipo", "workspaceId"]);
  });

  it("um evento sem mensagemId leva só as três chaves do tipo", async () => {
    recebidos.length = 0;
    await numaTransacao([{ workspaceId: ws, tipo: "conversa.mudou", conversaId: "c2" }], "commit");

    const chegou = await esperar(1);
    expect(Object.keys(chegou[0]!).sort()).toEqual(["conversaId", "tipo", "workspaceId"]);
  });

  it("depois do rollback nada chega em 500 ms", async () => {
    recebidos.length = 0;
    await numaTransacao([{ workspaceId: ws, tipo: "mensagem.nova", conversaId: "c3", mensagemId: "m3" }], "rollback");

    await dormir(500);
    expect(recebidos).toEqual([]);
  });

  it("dois eventos distintos na mesma transação chegam os dois", async () => {
    recebidos.length = 0;
    await numaTransacao(
      [
        { workspaceId: ws, tipo: "mensagem.nova", conversaId: "c4", mensagemId: "m4" },
        { workspaceId: ws, tipo: "mensagem.status", conversaId: "c4", mensagemId: "m4" },
      ],
      "commit",
    );

    const chegou = await esperar(2);
    expect(chegou.map((e) => e.tipo).sort()).toEqual(["mensagem.nova", "mensagem.status"]);
  });

  it("um evento que não passa em lerEventoDoCrm lança e nada sai, nem com o commit", async () => {
    recebidos.length = 0;
    const ruins = [
      { workspaceId: ws, tipo: "mensagem.apagada", conversaId: "c5" },
      { workspaceId: ws, tipo: "mensagem.nova", conversaId: "" },
      { workspaceId: ws, tipo: "mensagem.nova", conversaId: "c5", conteudo: "texto não viaja" },
    ] as unknown as EventoDoCrm[];
    for (const ruim of ruins) {
      const cliente = await pool().connect();
      try {
        await cliente.query("begin");
        await expect(avisarCrm(cliente, ruim)).rejects.toThrow(/inválido/);
        await cliente.query("commit");
      } finally {
        cliente.release();
      }
    }

    await dormir(300);
    expect(recebidos).toEqual([]);
  });
});
