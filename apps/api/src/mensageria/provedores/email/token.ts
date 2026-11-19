/**
 * Os renovadores do token de acesso do login do e-mail, montados a partir da configuração do ambiente (Fase 17, 17-12,
 * D-17-20). É a ponte entre a porta de acesso (`credencial.ts`, que só conhece `RenovadorDeToken`) e o cliente de cada serviço
 * (`oauth/microsoft.ts` e `oauth/google.ts`).
 *
 * A renovação é preguiçosa e mora na porta: quem lê ou envia pede `acessoParaUsar(canal)` e, quando faltam menos de 5 min,
 * a porta chama o `renovar` daqui e grava o token novo (e o de renovação novo, quando o serviço o gira) no cofre. Sem o par
 * de variáveis do serviço não há renovador dele, e a credencial responde `OAUTH_NAO_CONFIGURADO` (transitório).
 */

import type { ConfiguracaoDoOauth, ServicoDeLogin } from "./configuracao";
import type { RenovadorDeToken } from "./credencial";
import type { ClienteOauthDoEmail } from "./oauth/comum";
import { criarClienteGoogle } from "./oauth/google";
import { criarClienteMicrosoft } from "./oauth/microsoft";

export interface ConfiguracaoDeUmApp {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

/** A fábrica do cliente de cada serviço. Testes trocam por clientes que falam com um servidor de login falso. */
export type FabricasDeClienteOauth = Partial<Record<ServicoDeLogin, (config: ConfiguracaoDeUmApp) => ClienteOauthDoEmail>>;

/** As fábricas de produção: os endereços reais de cada serviço. */
export const CLIENTES_DE_PRODUCAO: FabricasDeClienteOauth = {
  google: (config) => criarClienteGoogle(config),
  microsoft: (config) => criarClienteMicrosoft(config),
};

/** Só os serviços com o par de variáveis (e a URI de retorno) completo têm renovador. */
export function renovadoresDoAmbiente(
  configuracao?: ConfiguracaoDoOauth,
  clientes: FabricasDeClienteOauth = CLIENTES_DE_PRODUCAO,
): Partial<Record<ServicoDeLogin, RenovadorDeToken>> {
  const renovadores: Partial<Record<ServicoDeLogin, RenovadorDeToken>> = {};
  if (!configuracao) return renovadores;
  for (const servico of ["google", "microsoft"] as const) {
    const app = configuracao[servico];
    const fabrica = clientes[servico];
    if (!app || !fabrica) continue;
    renovadores[servico] = fabrica({ ...app, redirectUri: configuracao.redirectUri }).renovar;
  }
  return renovadores;
}
