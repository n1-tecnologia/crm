/**
 * Processo de prova do encerramento (Fase 16, 16-18, T-16-28 / WR-03).
 *
 * Sobe um Fastify com um fluxo longo (`GET /fluxo`, um `PassThrough` que começa com `: aberto`, igual ao de
 * `rotas/eventos.ts`) e instala o tratador de sinal que o `index.ts` instala. `encerramento.test.ts` o roda como
 * filho, com o mesmo executor da produção (`vite-node`), manda SIGTERM de verdade e mede se ele sai.
 *
 * Não é o `index.ts` de propósito: a subida do `index.ts` carrega o arquivo de ambiente da api, que aponta para
 * produção. Este processo não importa o módulo de conexão com o banco, não carrega ambiente nenhum e só lê as
 * variáveis do modo abaixo, que o teste passa.
 *
 * Modos (variáveis de ambiente):
 * - sem nada: o tratador novo (`criarEncerramento(...).instalar(process)`);
 * - `MODO=antigo`: o comportamento de antes — um ouvinte de SIGTERM que só chama a parada do worker. Com ele
 *   instalado o Node não sai sozinho, e nada fecha o servidor nem sai do processo (a causa do SIGKILL aos 20 s);
 * - `TRAVAR_PARADA=1`: a parada do worker nunca resolve (o teto do encerramento tem de cortar);
 * - `TETO_MS`: o teto do encerramento, no lugar dos 15 s.
 *
 * Imprime `PRONTO <porta>` quando está escutando (porta 0: o sistema escolhe).
 */

import { PassThrough } from "node:stream";
import Fastify from "fastify";

const fluxos = new Set<PassThrough>();

const app = Fastify({ logger: false });

app.get("/fluxo", (_request, reply) => {
  const fluxo = new PassThrough();
  fluxos.add(fluxo);
  fluxo.once("close", () => fluxos.delete(fluxo));
  reply.header("content-type", "text/event-stream; charset=utf-8").header("cache-control", "no-cache, no-transform");
  fluxo.write(": aberto\n\n");
  return reply.send(fluxo);
});

function fecharFluxos(): void {
  for (const fluxo of [...fluxos]) fluxo.end();
}

/** A parada de um worker: termina a volta em voo em 200 ms (ou nunca, com `TRAVAR_PARADA=1`). */
function pararWorker(): Promise<void> {
  if (process.env.TRAVAR_PARADA === "1") return new Promise<void>(() => {});
  return new Promise<void>((resolver) => setTimeout(resolver, 200));
}

function registrar(nivel: string, mensagem: string, dados?: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ nivel, mensagem, ...(dados ?? {}) })}\n`);
}

if (process.env.MODO === "antigo") {
  process.on("SIGTERM", () => {
    void pararWorker();
  });
} else {
  const { criarEncerramento } = await import("../encerramento");
  const tetoMs = process.env.TETO_MS ? Number(process.env.TETO_MS) : undefined;
  const encerramento = criarEncerramento({
    fecharFluxos,
    fecharServidor: () => app.close(),
    encerrarPool: async () => {},
    registrar,
    ...(tetoMs !== undefined ? { tetoMs } : {}),
  });
  encerramento.aoEncerrar(pararWorker);
  encerramento.instalar(process);
}

await app.listen({ port: 0, host: "127.0.0.1" });
const endereco = app.server.address();
process.stdout.write(`PRONTO ${typeof endereco === "object" && endereco ? endereco.port : 0}\n`);
