/**
 * `npm run evolution:fumaca -w @n1/api` — a casca fina de `evolution-fumaca.ts` (Sessão 4): carrega o ambiente (`EVOLUTION_URL`,
 * `EVOLUTION_API_KEY` e `API_URL_PUBLICA`), roda a fumaça contra a Evolution configurada e devolve o código de saída
 * (0 tudo certo, 1 algum passo falhou, 2 faltou configuração). Não usa o banco. A regra e os testes estão no outro arquivo.
 */

import { lerConfiguracaoDaEvolution } from "../mensageria/provedores/evolution/ambiente";
import { criarClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";
import { carregarEnv } from "../persistencia/conexao";
import { descreverFumaca, rodarFumacaDaEvolution } from "./evolution-fumaca";

carregarEnv();
const leitura = lerConfiguracaoDaEvolution();
if (!leitura.ok) {
  console.error(`recusado: ${leitura.invalida ?? `falta no ambiente: ${leitura.faltam.join(", ")}.`}`);
  process.exitCode = 2;
} else {
  const resultado = await rodarFumacaDaEvolution({ cliente: criarClienteDaEvolution({ url: leitura.configuracao.url }), configuracao: leitura.configuracao });
  console.log(descreverFumaca(resultado));
  process.exitCode = resultado.ok ? 0 : 1;
}
