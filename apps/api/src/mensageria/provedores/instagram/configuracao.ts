/**
 * O que a integração do Instagram precisa do ambiente. Sem as três variáveis
 * obrigatórias, a integração fica desligada: a conexão responde 503 dizendo o
 * que falta, e o webhook só escuta, como antes da Sessão 8.
 *
 *   INSTAGRAM_APP_ID        o "ID do app do Instagram" (painel do app › Instagram › Configuração da API com login do Instagram)
 *   INSTAGRAM_APP_SECRET    a "Chave secreta do app do Instagram" (o webhook já a usa para a assinatura)
 *   INSTAGRAM_REDIRECT_URI  a página de retorno da WEB, igual, letra por letra, à cadastrada no painel:
 *                           https://<web>/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno
 *   INSTAGRAM_GRAPH_VERSAO  opcional; padrão `VERSAO_PADRAO`
 *   META_APP_SECRET         opcional; também aceita como assinatura do webhook (ver `segredosDoWebhook`)
 *
 * O token conectado fica no cofre (`COFRE_CHAVE`, 009): sem ele, conectar falha
 * ao guardar, e o serviço responde 503.
 */

export interface ConfiguracaoDoInstagram {
  readonly appId: string;
  readonly appSecret: string;
  /**
   * As chaves que podem assinar o webhook (`X-Hub-Signature-256`): a do app do Instagram e, se existir, a
   * `META_APP_SECRET`, como a rota da Meta já aceitava enquanto não se confirma qual a Meta usa para o Instagram.
   */
  readonly segredosDoWebhook?: readonly string[];
  readonly redirectUri: string;
  readonly versao: string;
  readonly enderecos: { readonly autorizar: string; readonly api: string; readonly graph: string };
}

export const VERSAO_PADRAO = "v24.0";

export const ENDERECOS_DA_META = {
  autorizar: "https://www.instagram.com/oauth/authorize",
  api: "https://api.instagram.com",
  graph: "https://graph.instagram.com",
} as const;

/** O que falta para a integração ligar, pelo nome da variável; vazio quando está completa. */
export function variaveisQueFaltam(env: NodeJS.ProcessEnv = process.env): string[] {
  return ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_REDIRECT_URI"].filter((nome) => !env[nome]?.trim());
}

export function lerConfiguracaoDoInstagram(env: NodeJS.ProcessEnv = process.env): ConfiguracaoDoInstagram | undefined {
  if (variaveisQueFaltam(env).length > 0) return undefined;
  const redirectUri = env.INSTAGRAM_REDIRECT_URI!.trim();
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new Error("INSTAGRAM_REDIRECT_URI precisa ser uma URL completa.");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("INSTAGRAM_REDIRECT_URI precisa usar https (a Meta recusa http fora do localhost).");
  }
  const versao = env.INSTAGRAM_GRAPH_VERSAO?.trim() || VERSAO_PADRAO;
  if (!/^v\d+\.\d+$/.test(versao)) throw new Error("INSTAGRAM_GRAPH_VERSAO precisa ter a forma v24.0.");
  const appSecret = env.INSTAGRAM_APP_SECRET!.trim();
  const doAppDaMeta = env.META_APP_SECRET?.trim();
  return {
    appId: env.INSTAGRAM_APP_ID!.trim(),
    appSecret,
    segredosDoWebhook: doAppDaMeta ? [appSecret, doAppDaMeta] : [appSecret],
    redirectUri,
    versao,
    enderecos: ENDERECOS_DA_META,
  };
}
