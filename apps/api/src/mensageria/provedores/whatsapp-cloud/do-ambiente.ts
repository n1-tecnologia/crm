/**
 * O provedor do WhatsApp oficial montado com o ambiente do processo: `META_APP_SECRET` e `META_GRAPH_VERSAO`. É o que
 * `registroPadrao()` liga. Sem `META_APP_SECRET` (ou com a versão da Graph inválida), não há provedor: um Canal
 * `whatsapp-cloud` real continua sem provedor e a Mensagem não é dada como enviada (MSG-05).
 */

import type { ProvedorDeMensageria } from "../../provedor";
import { lerConfiguracaoDaCloudApi, type ConfiguracaoDaCloudApi } from "./configuracao";
import { criarProvedorWhatsAppCloud } from "./provedor";

/** A configuração, ou `undefined` quando falta variável ou ela é inválida (o "Conectar" diz o que falta). */
export function configuracaoDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfiguracaoDaCloudApi | undefined {
  try {
    return lerConfiguracaoDaCloudApi(env);
  } catch {
    return undefined;
  }
}

export function provedorWhatsAppCloudDoAmbiente(env: NodeJS.ProcessEnv = process.env): ProvedorDeMensageria | undefined {
  const configuracao = configuracaoDoAmbiente(env);
  return configuracao ? criarProvedorWhatsAppCloud({ configuracao }) : undefined;
}
