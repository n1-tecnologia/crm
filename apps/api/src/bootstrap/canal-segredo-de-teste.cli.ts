/**
 * `npm run canal:segredo-de-teste -w @n1/api -- --canal <id>` — a casca fina de
 * `canal-segredo-de-teste.ts` (D-16-03): lê o ambiente, liga o pool e o cofre e devolve o código de saída.
 * A regra, a saída e os testes estão no outro arquivo.
 */

import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { lerChavesDoCofre } from "../servicos/cofre";
import { principal } from "./canal-segredo-de-teste";

carregarEnv();
try {
  process.exitCode = await principal(process.argv.slice(2), {
    pool,
    chaves: () => lerChavesDoCofre(process.env),
    saida: { out: (texto) => console.log(texto), err: (texto) => console.error(texto) },
  });
} finally {
  await encerrar();
}
