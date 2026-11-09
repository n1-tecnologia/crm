/**
 * `npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome>` — a casca fina de
 * `canal-ligar-evolution.ts` (D-16-05): carrega o ambiente, liga o pool, o cofre e a Evolution e devolve o código de saída.
 * A regra, a saída e os testes estão no outro arquivo.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { principal } from "./canal-ligar-evolution";

carregarEnv();
try {
  process.exitCode = await principal(process.argv.slice(2));
} finally {
  await encerrar();
}
