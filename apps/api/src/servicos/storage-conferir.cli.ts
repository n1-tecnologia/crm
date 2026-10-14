/**
 * `npm run storage:conferir -w @n1/api`
 *
 * Confere o bucket de anexos do ambiente onde roda (PIPE-07): variáveis,
 * bucket privado e emissão de ticket. Sai 0 quando tudo confere, 1 quando
 * não. Nunca imprime URL, chave ou ticket.
 */

import { clienteAdmin } from "../autenticacao/verificar-token";
import { carregarEnv } from "../persistencia/conexao";
import { conferirStorage, type ClienteDeStorageParaConferir } from "./storage-conferir";

carregarEnv();
const relatorio = await conferirStorage(process.env, () => clienteAdmin().storage as unknown as ClienteDeStorageParaConferir);
for (const linha of relatorio.linhas) console.log(`${relatorio.ok ? "✓" : "✗"} ${linha}`);
console.log(relatorio.ok ? "storage: ok" : "storage: NÃO confere");
process.exit(relatorio.ok ? 0 : 1);
