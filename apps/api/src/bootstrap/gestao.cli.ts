/**
 * `npm run bootstrap:gestao -w @n1/api`
 *
 * Roda uma vez, depois de `npm run migrar` e de `npm run usuarios:seed`
 * (apps/api/CONTEXT.md) — cria o Espaço "Gestão" › Pasta "Financeiro" de
 * produção, com a Maryane como única Membro, Proprietária.
 */

import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { bootstrapGestao } from "./gestao";

carregarEnv();
const workspaceId = process.env.WORKSPACE_ID ?? "ws_n1";

const cliente = await pool().connect();
let resultado;
try {
  resultado = await bootstrapGestao(cliente, { workspaceId });
} finally {
  cliente.release();
}

if (resultado.criado) {
  console.log(`criado   Espaço "${workspaceId}" · ${resultado.gravados} registros gravados`);
} else {
  console.log(`pulado   ${resultado.motivo}`);
}
console.log(
  '\nA Maryane entra com maryane@n1.teste — se a conta não existir no Auth, rode `npm run usuarios:seed -w @n1/api`.',
);

await encerrar();
