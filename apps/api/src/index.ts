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
 */

import { buildApp } from "./app";
import { carregarEnv } from "./persistencia/conexao";

carregarEnv();

const porta = Number(process.env.PORT ?? 3002);
const host = process.env.HOST ?? "127.0.0.1";

const app = buildApp({ logger: true });

await app.listen({ port: porta, host });
app.log.info(`apps/api ouvindo em http://${host}:${porta}`);
