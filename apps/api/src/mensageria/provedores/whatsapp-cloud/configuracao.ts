/**
 * O que a integração do WhatsApp oficial (Cloud API) precisa do ambiente. Sem `META_APP_SECRET` a integração fica
 * desligada: nenhum Canal `whatsapp-cloud` tem provedor, a conexão responde 503 dizendo o que falta, e o webhook só
 * escuta (sem a chave não há como conferir a assinatura da Meta, e evento sem assinatura nunca vira dado).
 *
 *   META_APP_SECRET     a "Chave secreta do app" da Meta (painel do app › Configurações › Básico). A mesma que
 *                       `rotas/webhook-meta.ts` usa para a assinatura `X-Hub-Signature-256`.
 *   META_GRAPH_VERSAO   opcional; a versão da Graph API fixada, no formato `v26.0` (padrão `VERSAO_PADRAO`, a versão do app da Meta).
 *
 * O token de cada número NÃO vem do ambiente: entra pelo formulário de conectar do Canal e fica cifrado no cofre.
 */

export interface ConfiguracaoDaCloudApi {
  readonly appSecret: string;
  readonly versao: string;
  /** O host da Graph API; os testes apontam para o servidor falso. */
  readonly graph: string;
}

export const VERSAO_PADRAO = "v26.0";

export const ENDERECO_DA_GRAPH = "https://graph.facebook.com";

/** O que falta para a integração ligar, pelo nome da variável; vazio quando está completa. */
export function variaveisQueFaltam(env: NodeJS.ProcessEnv = process.env): string[] {
  return ["META_APP_SECRET"].filter((nome) => !env[nome]?.trim());
}

export function lerConfiguracaoDaCloudApi(env: NodeJS.ProcessEnv = process.env): ConfiguracaoDaCloudApi | undefined {
  if (variaveisQueFaltam(env).length > 0) return undefined;
  const versao = env.META_GRAPH_VERSAO?.trim() || VERSAO_PADRAO;
  if (!/^v\d+\.\d+$/.test(versao)) throw new Error("META_GRAPH_VERSAO precisa ter a forma v26.0.");
  return { appSecret: env.META_APP_SECRET!.trim(), versao, graph: ENDERECO_DA_GRAPH };
}
