/**
 * O que a conexão do e-mail precisa do servidor (Fase 17, 17-05, D-17-03).
 *
 * Duas coisas moram aqui, e as duas são do SERVIDOR, nunca do cliente:
 *
 *   - as predefinições de Gmail e Outlook (host e porta de IMAP e SMTP). A tela só escolhe o NOME da predefinição
 *     (`gmail` ou `outlook`); o host que a plataforma abre vem desta tabela, não do corpo do pedido (D-17-07);
 *   - o login do Google e da Microsoft, que é opcional: o botão só aparece quando o par de variáveis do serviço e a URI de
 *     retorno existem. O login em si é do 17-12 e do 17-13; aqui só se lê o ambiente para dizer quais botões a ficha
 *     oferece.
 *
 *   EMAIL_OAUTH_REDIRECT_URI     a página de retorno da WEB, igual, letra por letra, à cadastrada nos dois painéis
 *   GOOGLE_OAUTH_CLIENT_ID       e GOOGLE_OAUTH_CLIENT_SECRET      (os dois, ou o Google fica desligado)
 *   MICROSOFT_OAUTH_CLIENT_ID    e MICROSOFT_OAUTH_CLIENT_SECRET   (os dois, ou a Microsoft fica desligada)
 *
 * Nada daqui vai a log nem a resposta: o segredo do cliente OAuth só existe em `ConfiguracaoDoOauth`, em memória.
 */

export type PredefinicaoDeServidor = "gmail" | "outlook";
export type ServicoDeLogin = "google" | "microsoft";

export interface EnderecoDeServidor {
  readonly host: string;
  readonly porta: number;
}

export interface ServidoresDaConta {
  readonly imap: EnderecoDeServidor;
  readonly smtp: EnderecoDeServidor;
}

export const PREDEFINICOES_DE_SERVIDOR: Readonly<Record<PredefinicaoDeServidor, ServidoresDaConta>> = {
  gmail: {
    imap: { host: "imap.gmail.com", porta: 993 },
    smtp: { host: "smtp.gmail.com", porta: 465 },
  },
  outlook: {
    imap: { host: "outlook.office365.com", porta: 993 },
    smtp: { host: "smtp.office365.com", porta: 587 },
  },
};

export interface CredencialDoAppOauth {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface ConfiguracaoDoOauth {
  readonly redirectUri: string;
  readonly google?: CredencialDoAppOauth;
  readonly microsoft?: CredencialDoAppOauth;
}

const VARIAVEIS_DO_SERVICO: Readonly<Record<ServicoDeLogin, readonly [string, string]>> = {
  google: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  microsoft: ["MICROSOFT_OAUTH_CLIENT_ID", "MICROSOFT_OAUTH_CLIENT_SECRET"],
};

const VARIAVEL_DA_URI = "EMAIL_OAUTH_REDIRECT_URI";

const valorDe = (env: NodeJS.ProcessEnv, nome: string): string | undefined => {
  const texto = env[nome]?.trim();
  return texto ? texto : undefined;
};

/** O que falta para o login do serviço ligar, pelo nome da variável; vazio quando está completo. */
export function variaveisQueFaltam(servico: ServicoDeLogin, env: NodeJS.ProcessEnv = process.env): string[] {
  return [VARIAVEL_DA_URI, ...VARIAVEIS_DO_SERVICO[servico]].filter((nome) => valorDe(env, nome) === undefined);
}

/**
 * Lê o ambiente. `undefined` quando não há URI de retorno OU nenhum serviço tem o par completo (o login fica desligado e a
 * ficha só oferece a senha). Lança se a URI existe e é inválida (precisa ser https, exceto `localhost` e `127.0.0.1`, como
 * a do Instagram).
 */
export function lerConfiguracaoDoOauth(env: NodeJS.ProcessEnv = process.env): ConfiguracaoDoOauth | undefined {
  const redirectUri = valorDe(env, VARIAVEL_DA_URI);
  if (redirectUri === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new Error(`${VARIAVEL_DA_URI} precisa ser uma URL completa.`);
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(`${VARIAVEL_DA_URI} precisa usar https (fora do localhost).`);
  }
  const app = (servico: ServicoDeLogin): CredencialDoAppOauth | undefined => {
    const [nomeDoId, nomeDoSegredo] = VARIAVEIS_DO_SERVICO[servico];
    const clientId = valorDe(env, nomeDoId);
    const clientSecret = valorDe(env, nomeDoSegredo);
    return clientId !== undefined && clientSecret !== undefined ? { clientId, clientSecret } : undefined;
  };
  const google = app("google");
  const microsoft = app("microsoft");
  if (!google && !microsoft) return undefined;
  return { redirectUri, ...(google ? { google } : {}), ...(microsoft ? { microsoft } : {}) };
}

export interface ServicosDisponiveis {
  readonly google: boolean;
  readonly microsoft: boolean;
}

/** Quais botões de login a ficha oferece, a partir de uma configuração já lida. */
export function servicosDaConfiguracao(configuracao: ConfiguracaoDoOauth | undefined): ServicosDisponiveis {
  return { google: configuracao?.google !== undefined, microsoft: configuracao?.microsoft !== undefined };
}

/** Quais botões de login a ficha oferece, direto do ambiente. Uma URI inválida desliga os dois, sem lançar. */
export function servicosDisponiveis(env: NodeJS.ProcessEnv = process.env): ServicosDisponiveis {
  try {
    return servicosDaConfiguracao(lerConfiguracaoDoOauth(env));
  } catch {
    return { google: false, microsoft: false };
  }
}
