/**
 * `npm run whatsapp-oficial:fumaca -w @n1/api` — a casca fina de `whatsapp-oficial-fumaca.ts` (Sessão 7): lê o ambiente
 * (`WHATSAPP_FUMACA_TOKEN`, `WHATSAPP_FUMACA_PHONE_NUMBER_ID`, `WHATSAPP_FUMACA_WABA_ID` e, se quiser, `WHATSAPP_FUMACA_NUMERO` e
 * `META_GRAPH_VERSAO`), roda a fumaça contra a Graph API de verdade e devolve o código de saída (0 tudo certo, 1 algum passo falhou,
 * 2 faltou configuração). `--inscrever` liga o único passo que escreve na Meta. Não usa o banco.
 *
 * O token NUNCA vai por argumento (ficaria no histórico do shell e na lista de processos): entra por variável de ambiente, e o jeito
 * de não o deixar no histórico é lê-lo sem eco:
 *
 *   read -s WHATSAPP_FUMACA_TOKEN && export WHATSAPP_FUMACA_TOKEN
 *   WHATSAPP_FUMACA_PHONE_NUMBER_ID=... WHATSAPP_FUMACA_WABA_ID=... npm run whatsapp-oficial:fumaca -w @n1/api
 *   unset WHATSAPP_FUMACA_TOKEN
 */

import { carregarEnv } from "../persistencia/conexao";
import { clienteDaFumaca, configuracaoDaFumaca, descreverFumacaOficial, lerEntradaDaFumaca, rodarFumacaDoWhatsAppOficial } from "./whatsapp-oficial-fumaca";

carregarEnv();
const config = configuracaoDaFumaca();
const leitura = lerEntradaDaFumaca(process.env, process.argv.slice(2));
if (!config.ok) {
  console.error(`recusado: ${config.erro}`);
  process.exitCode = 2;
} else if (!leitura.ok) {
  console.error(`recusado: ${leitura.invalida ?? `falta no ambiente: ${leitura.faltam.join(", ")}.`}`);
  process.exitCode = 2;
} else {
  const resultado = await rodarFumacaDoWhatsAppOficial({
    entrada: leitura.entrada,
    cliente: clienteDaFumaca(config.configuracao),
    versao: config.configuracao.versao,
  });
  console.log(descreverFumacaOficial(resultado));
  process.exitCode = resultado.ok ? 0 : 1;
}
