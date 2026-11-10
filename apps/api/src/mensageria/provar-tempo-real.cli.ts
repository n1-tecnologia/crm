/**
 * `npm run tempo-real:provar -w @n1/api` — a casca fina de `provar-tempo-real.ts` (D-16-01, A9): devolve o código de
 * saída. Não abre o pool: a prova usa dois clientes próprios e não escreve em tabela nenhuma.
 */

import { principal } from "./provar-tempo-real";

process.exitCode = await principal(process.argv.slice(2));
