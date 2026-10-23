/**
 * `npm run migrar -w @n1/api` aplica o que falta. Roda com
 * `DATABASE_URL_MIGRACAO` (o dono do banco) quando ela existe e com
 * `DATABASE_URL` quando não; nenhuma URL, host ou senha é impressa.
 *
 * `npm run migrar -w @n1/api -- --seco` é a conferência de D-12: lista cada
 * arquivo de `migracoes/` como `aplicada` ou `pendente` segundo
 * `plataforma.migracoes` e NÃO aplica nada — é o que se roda contra o banco
 * da plataforma antes do primeiro `migrar` com uma migração nova.
 */

import { encerrar } from "./conexao";
import { migracoesPendentes, migrar } from "./migrar";

if (process.argv.includes("--seco")) {
  const { aplicadas, pendentes } = await migracoesPendentes();
  const registradas = new Set(aplicadas);
  for (const nome of [...aplicadas, ...pendentes].sort()) {
    console.log(`${registradas.has(nome) ? "aplicada" : "pendente"}  ${nome}`);
  }
  console.log(`${pendentes.length} pendente(s); nada foi aplicado (--seco).`);
} else {
  const aplicadas = await migrar();
  if (aplicadas.length === 0) {
    console.log("Nada a aplicar: o banco já está em dia.");
  } else {
    for (const { nome, ms } of aplicadas) console.log(`aplicada  ${nome}  (${ms} ms)`);
  }
}
await encerrar();
