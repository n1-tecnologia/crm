/**
 * `aplicarConexaoAoCanal` e o aviso `canal.mudou` (Sessão 4), contra o Postgres LOCAL: o WhatsApp que cai ou volta avisa as
 * abas abertas, no mesmo commit, só quando a conexão MUDA.
 *
 * Um `pg.Client` avulso em `LISTEN crm_eventos` faz o papel do ouvinte (como em `avisar.test.ts`).
 */

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import { aplicarConexaoAoCanal } from "./aplicar-conexao";
import { CANAL_DO_NOTIFY } from "./avisar";

const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

describeComBanco("aplicarConexaoAoCanal: a conexão que muda avisa as abas (canal.mudou)", () => {
  const ws = `ws_conexao_${randomUUID().slice(0, 8)}`;
  const recebidos: Array<Record<string, unknown>> = [];
  let ouvinte: Client;

  const aplicar = (canalId: string, conexao: Parameters<typeof aplicarConexaoAoCanal>[2], opcoes?: Parameters<typeof aplicarConexaoAoCanal>[3]) =>
    aplicarConexaoAoCanal(pool, { workspaceId: ws, canalId }, conexao, opcoes);

  /** Espera os avisos pendentes do banco chegarem ao ouvinte (o NOTIFY sai no commit, e a entrega é assíncrona). */
  async function esperar(quantos: number, prazoMs = 1_500): Promise<Array<Record<string, unknown>>> {
    const limite = Date.now() + prazoMs;
    while (recebidos.length < quantos && Date.now() < limite) await dormir(5);
    await dormir(60);
    return [...recebidos];
  }

  async function canalReal(conexao: "conectada" | "desconectada" | "com_erro", simulado = false) {
    return semearCanal(ws, {
      nome: `Canal ${randomUUID().slice(0, 6)}`,
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: `+5511977${Math.floor(Math.random() * 90_000 + 10_000)}`,
      conexao,
      conexaoSimulada: simulado,
    });
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    ouvinte = new Client({ connectionString: process.env.DATABASE_URL });
    await ouvinte.connect();
    ouvinte.on("notification", (mensagem) => {
      if (mensagem.channel !== CANAL_DO_NOTIFY || !mensagem.payload) return;
      const lido = JSON.parse(mensagem.payload) as Record<string, unknown>;
      if (lido.workspaceId === ws) recebidos.push(lido);
    });
    await ouvinte.query(`LISTEN ${CANAL_DO_NOTIFY}`);
  });
  beforeEach(() => {
    recebidos.length = 0;
  });
  afterAll(async () => {
    await ouvinte.end();
    await limparEspaco(ws);
    await encerrar();
  });

  it("o WhatsApp que foi desconectado (aparelho removido) vira desconectada e as abas são avisadas com só o id do Canal", async () => {
    const id = await canalReal("conectada");
    const desfecho = await aplicar(id, "desconectada");
    expect(desfecho).toMatchObject({ mudou: true });
    expect((await pool().query<{ conexao: string }>("select conexao from plataforma.canais where id = $1", [id])).rows[0]!.conexao).toBe("desconectada");
    expect(await esperar(1)).toEqual([{ workspaceId: ws, tipo: "canal.mudou", canalId: id }]);
  });

  it("a queda (com_erro) avisa, e a volta (conectada) avisa de novo", async () => {
    const id = await canalReal("conectada");
    await aplicar(id, "com_erro");
    await aplicar(id, "conectada");
    const avisos = await esperar(2);
    expect(avisos).toHaveLength(2);
    expect(avisos.every((a) => a.tipo === "canal.mudou" && a.canalId === id)).toBe(true);
  });

  it("repetir a conexão que o Canal já tem não avisa (a tela não relê à toa)", async () => {
    const id = await canalReal("desconectada");
    expect(await aplicar(id, "desconectada")).toMatchObject({ mudou: false });
    expect(await esperar(1, 300)).toEqual([]);
  });

  it("o Canal simulado e a queda num Canal já desconectado são ignorados, sem aviso", async () => {
    const simulado = await canalReal("conectada", true);
    expect(await aplicar(simulado, "desconectada")).toMatchObject({ resultado: "ignorado:conexao_simulada", mudou: false });
    const desconectado = await canalReal("desconectada");
    expect(await aplicar(desconectado, "com_erro")).toMatchObject({ resultado: "ignorado:sem_conexao_a_perder", mudou: false });
    expect(await esperar(1, 300)).toEqual([]);
  });
});
