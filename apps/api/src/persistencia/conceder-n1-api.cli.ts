/**
 * `npm run banco:conceder -w @n1/api` concede a `n1_api` o que a `009` concede,
 * para o caso de o papel ter sido criado depois dela. Idempotente: roda a cada
 * deploy, depois do `migrar`. Usa `DATABASE_URL_MIGRACAO` (o dono do banco)
 * quando existe e `DATABASE_URL` quando não. Nenhuma URL, host ou senha é
 * impressa.
 */

import { encerrar, poolDeMigracao } from "./conexao";
import { concederN1Api } from "./conceder-n1-api";

try {
  const { papelExiste } = await concederN1Api(poolDeMigracao());
  console.log(
    papelExiste ? "n1_api: concessões aplicadas" : "n1_api: o papel não existe neste banco — nada concedido",
  );
} finally {
  await encerrar();
}
