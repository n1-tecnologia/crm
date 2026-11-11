/**
 * `npm run canal:atualizar-webhook-evolution -w @n1/api -- --canal <id> | --todos` — a casca fina de
 * `canal-atualizar-webhook-evolution.ts` (4.4.5): carrega o ambiente, liga o pool e o cofre e devolve o código de saída.
 * A regra, a saída e os testes estão no outro arquivo.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { principal } from "./canal-atualizar-webhook-evolution";

carregarEnv();
try {
  process.exitCode = await principal(process.argv.slice(2));
} finally {
  await encerrar();
}
