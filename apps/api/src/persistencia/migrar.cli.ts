/** `npm run migrar -w @n1/api` */

import { encerrar } from "./conexao";
import { migrar } from "./migrar";

const aplicadas = await migrar();
if (aplicadas.length === 0) {
  console.log("Nada a aplicar: o banco já está em dia.");
} else {
  for (const { nome, ms } of aplicadas) console.log(`aplicada  ${nome}  (${ms} ms)`);
}
await encerrar();
