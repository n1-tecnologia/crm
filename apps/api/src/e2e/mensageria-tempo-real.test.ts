/**
 * O tempo real da mensageria, ponta a ponta (16-07, D-16-01, MSG-03), contra o Postgres LOCAL (Docker, porta 55722):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55722/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55722/postgres npx vitest run src/e2e/mensageria-tempo-real.test.ts
 *
 * Os serviços avisam por `pg_notify` no mesmo cliente da transação; uma conexão `LISTEN` por processo alimenta o hub
 * em memória, que entrega por SSE (`GET /eventos`) só ao Espaço do evento. Aqui o app escuta numa porta de verdade
 * (`inject` não serve a fluxo) e cada "aba" é um `fetch` que lê o corpo em fluxo, como a tela faz.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { avisarCrm } from "../mensageria/avisar";
import { criarHubDeEventos } from "../mensageria/hub-de-eventos";
import { criarOuvinteDoCrm } from "../mensageria/ouvinte-pg";
import { encerrar, pool } from "../persistencia/conexao";
import { criarAcessoAoCrmPg, exigir } from "../servicos/crm/acesso";
import type { ChavesDoCofre } from "../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../testes/banco-crm";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const ORIGEM = "http://localhost:3001";
const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;

/** Uma aba aberta: o status da resposta, os cabeçalhos e os quadros SSE lidos até agora (separados por linha em branco). */
interface Aba {
  readonly status: number;
  readonly cabecalhos: Headers;
  readonly quadros: string[];
  fechar(): void;
}

const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

/** O quadro que casa com o predicado, ou `undefined` se não chegou até o prazo. */
async function esperarQuadro(aba: Aba, casa: (quadro: string) => boolean, prazoMs: number): Promise<string | undefined> {
  const limite = Date.now() + prazoMs;
  for (;;) {
    const achado = aba.quadros.find(casa);
    if (achado !== undefined) return achado;
    if (Date.now() >= limite) return undefined;
    await dormir(5);
  }
}

describeComBanco("Fase 16 ponta a ponta: o aviso confirmado no banco chega à aba aberta em GET /eventos", () => {
  const ws = novoEspacoDeTeste("msgtr");
  const url = process.env.DATABASE_URL!;
  const hub = criarHubDeEventos({
    podeLer: async (membro) => (await exigir(criarAcessoAoCrmPg(pool), membro, "ler", "conversa")) === undefined,
  });
  const ouvinte = criarOuvinteDoCrm({
    url,
    aoEvento: (evento) => hub.publicar(evento),
    aoConectar: () => hub.definirDisponivel(true),
    aoCair: () => hub.definirDisponivel(false),
  });

  let app: FastifyInstance;
  let porta: number;
  const abertas: Aba[] = [];

  const montar = (workspaceId: string, token: string, userId: string, membroId: string) =>
    buildApp({
      logger: false,
      workspaceId,
      webOrigin: ORIGEM,
      verificarToken: async (t) => (t === token ? { sub: userId } : null),
      resolverMembro: async (_workspaceId, sub) =>
        sub === userId ? { ...membroBase, id: membroId, userId: sub, state: "ativo" as const } : undefined,
      eventos: { hub },
    });

  async function abrirAba(token: string | null): Promise<Aba> {
    const controle = new AbortController();
    const resposta = await fetch(`http://127.0.0.1:${porta}/eventos`, {
      headers: { origin: ORIGEM, ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
      signal: controle.signal,
    });
    const quadros: string[] = [];
    if (resposta.status === 200 && resposta.body) {
      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      void (async () => {
        let resto = "";
        try {
          for (;;) {
            const { value, done } = await leitor.read();
            if (done) break;
            resto += decodificador.decode(value, { stream: true });
            for (let i = resto.indexOf("\n\n"); i >= 0; i = resto.indexOf("\n\n")) {
              quadros.push(resto.slice(0, i));
              resto = resto.slice(i + 2);
            }
          }
        } catch {
          // a aba foi fechada pelo teste (abort) ou o servidor encerrou o fluxo
        }
      })();
    } else {
      await resposta.body?.cancel();
    }
    const aba: Aba = { status: resposta.status, cabecalhos: resposta.headers, quadros, fechar: () => controle.abort() };
    abertas.push(aba);
    return aba;
  }

  /** O `avisarCrm` numa transação que confirma (ou desfaz). */
  async function avisarNumaTransacao(evento: Parameters<typeof avisarCrm>[1], desfecho: "commit" | "rollback" = "commit"): Promise<void> {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      await avisarCrm(cliente, evento);
      await cliente.query(desfecho);
    } finally {
      cliente.release();
    }
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    app = montar(ws, "token-ana", "usuario-ana", "mem_ana");
    await app.listen({ port: 0, host: "127.0.0.1" });
    porta = (app.server.address() as { port: number }).port;
    ouvinte.iniciar();
  });

  afterAll(async () => {
    for (const aba of abertas) aba.fechar();
    hub.encerrarTodos();
    await ouvinte.parar();
    await app.close();
    await limparEspaco(ws);
    await encerrar();
  });

  it("o ouvinte LISTEN fica de pé e o hub passa a estar disponível", async () => {
    const limite = Date.now() + 5_000;
    while (!ouvinte.ouvindo && Date.now() < limite) await dormir(20);
    expect(ouvinte.ouvindo).toBe(true);
    expect(hub.disponivel).toBe(true);
  });

  it("sem Authorization: 401", async () => {
    const aba = await abrirAba(null);
    expect(aba.status).toBe(401);
  });

  it("a aba autenticada recebe os cabeçalhos do SSE (com o CORS da origem permitida) e o quadro de abertura", async () => {
    const aba = await abrirAba("token-ana");
    expect(aba.status).toBe(200);
    expect(aba.cabecalhos.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(aba.cabecalhos.get("cache-control")).toBe("no-cache, no-transform");
    expect(aba.cabecalhos.get("x-accel-buffering")).toBe("no");
    expect(aba.cabecalhos.get("access-control-allow-origin")).toBe(ORIGEM);
    expect(await esperarQuadro(aba, (q) => q === ": aberto", 2_000)).toBe(": aberto");
  });

  it("um avisarCrm confirmado chega à aba como data: só com o tipo e os ids, sem o workspaceId", async () => {
    const aba = await abrirAba("token-ana");
    expect(await esperarQuadro(aba, (q) => q === ": aberto", 2_000)).toBeDefined();

    await avisarNumaTransacao({ workspaceId: ws, tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" });

    const quadro = await esperarQuadro(aba, (q) => q.startsWith("data: "), 2_000);
    expect(quadro).toBe('data: {"tipo":"mensagem.nova","conversaId":"c1","mensagemId":"m1"}');
  });
});
