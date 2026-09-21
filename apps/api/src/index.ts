/**
 * Ponto de composição do backend.
 *
 * `buildApp()` (em `app.ts`) monta o Fastify inteiro — CORS, autenticação,
 * rotas, tratamento de erro. Este arquivo só chama `carregarEnv()` e
 * `.listen()`, para separar "montar" de "escutar": é essa separação que
 * permite os testes usarem `app.inject()` sem abrir socket.
 *
 * A regra que vale desde já: nada aqui reimplementa regra de negócio. As
 * regras moram em `@n1/dominio`, que `apps/web` também consome. O backend
 * acrescenta o que o domínio não tem — persistência, autenticação,
 * transporte — e nada além.
 *
 * O worker de outbox segue a mesma separação: `criarOutboxWorker()` não
 * conhece `buildApp()`/Fastify, e só é ativado aqui quando
 * `OUTBOX_WORKER_ATIVO === "true"` (Plan 02-10). Duas instâncias do
 * processo `apps/api` podem rodar o worker ao mesmo tempo sem duplicar
 * entrega — a exclusão é do banco (`for update skip locked`), não deste
 * arquivo.
 */

import { buildApp } from "./app";
import { carregarEnv } from "./persistencia/conexao";
import { criarOutboxWorker } from "./persistencia/outbox-worker";

carregarEnv();

const porta = Number(process.env.PORT ?? 3002);
const host = process.env.HOST ?? "127.0.0.1";

const app = buildApp({ logger: true });

if (process.env.OUTBOX_WORKER_ATIVO === "true") {
  const destinoUrl = process.env.OUTBOX_DESTINO_URL;
  const token = process.env.OUTBOX_TOKEN;
  if (!destinoUrl || !token) {
    throw new Error(
      "OUTBOX_WORKER_ATIVO=true exige OUTBOX_DESTINO_URL e OUTBOX_TOKEN no ambiente (ver apps/api/.env.example).",
    );
  }
  const worker = criarOutboxWorker({
    destinoUrl,
    token,
    workerId: process.env.OUTBOX_WORKER_ID ?? `apps-api-${process.pid}`,
  });
  worker.iniciar();
  app.log.info("outbox worker ativo");
  process.on("SIGTERM", () => {
    worker.parar();
  });
}

await app.listen({ port: porta, host });
app.log.info(`apps/api ouvindo em http://${host}:${porta}`);
