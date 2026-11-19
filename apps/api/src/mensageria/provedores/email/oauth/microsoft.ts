/**
 * O cliente do login da Microsoft para IMAP e SMTP (Fase 17, 17-12, D-17-02, D-17-04): a URL da janela de login, a troca do
 * código (com o `client_secret` e o PKCE) e a renovação do token de acesso. Só HTTP: nada aqui conhece banco, Canal ou Espaço.
 *
 * Segredos: o código, o token de acesso, o de renovação e o `client_secret` só saem daqui no corpo do pedido à Microsoft.
 * Nenhum erro lançado os carrega, nem o corpo da resposta: as mensagens são frases fixas por tipo de falha (T-17-54).
 *
 * PRESSUPOSTOS A CONFIRMAR NA PROVA REAL (9.4.4), nenhum deles vira texto de tela:
 *   - A12: a autoridade `common` serve contas pessoais E de trabalho, com o app registrado como "contas em qualquer diretório
 *     organizacional e contas Microsoft pessoais". Se o app real for só de um diretório, o endereço muda (configurável abaixo).
 *   - A9: a Microsoft não documenta endpoint de revogação por token na v2.0; por isso este cliente NÃO tem `revogar`, e
 *     desconectar apaga o token só localmente (o `refreshToken` segue vivo até vencer, 90 dias por padrão).
 *   - A11: com o login OAuth, o servidor aceita XOAUTH2 do usuário = o endereço do Canal (a prova da caixa é este login, não o
 *     `id_token`).
 * O refresh token da Microsoft é trocado a cada uso e o antigo NÃO é revogado (pesquisa): quem renova grava o novo no cofre.
 */

import { ErroDeRenovacao } from "../credencial";
import { ErroDoLogin, lerIdToken, type ClienteOauthDoEmail, type PedidoDeAutorizacao, type TokensDoLogin } from "./comum";

export interface EnderecosDaMicrosoft {
  readonly autorizacao: string;
  readonly token: string;
}

/** Autoridade `common`: pressuposto A12, a confirmar com o app real (ver o cabeçalho). */
export const ENDERECOS_DA_MICROSOFT: EnderecosDaMicrosoft = {
  autorizacao: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

/**
 * `offline_access` dá o token de renovação; os dois escopos do Exchange Online são do MESMO recurso (a Microsoft exige um só
 * recurso por pedido de token), mais os escopos do OIDC para o `id_token`.
 */
export const ESCOPOS_MICROSOFT = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "https://outlook.office.com/IMAP.AccessAsUser.All",
  "https://outlook.office.com/SMTP.Send",
] as const;

export interface ConfiguracaoDoClienteMicrosoft {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface OpcoesDoClienteMicrosoft {
  /** Testes trocam por um servidor falso; em produção, o `fetch` do Node. */
  readonly fetch?: typeof fetch;
  readonly tempoLimiteMs?: number;
  /** Para calcular o vencimento do token; testes fixam o relógio. */
  readonly agora?: () => number;
}

const TEMPO_LIMITE_PADRAO_MS = 15_000;

export const FRASE_MICROSOFT_RENOVACAO_PERMANENTE = "A autorização da Microsoft venceu ou foi retirada: entre de novo com a Microsoft.";

/** Erros da Microsoft que NÃO se resolvem repetindo: a pessoa precisa entrar de novo (Pitfall 6 da pesquisa). */
const ERROS_PERMANENTES = new Set(["invalid_grant", "interaction_required", "consent_required", "invalid_client"]);

/** O administrador da organização ainda não aprovou o app (`AADSTS65001`, e `AADSTS90094`: "a concessão exige o administrador"). */
const SINAIS_DE_ADMINISTRADOR = ["AADSTS65001", "AADSTS90094"];

const FRASES_DO_LOGIN = {
  CONSENTIMENTO_DO_ADMINISTRADOR: "A sua organização exige que um administrador aprove o aplicativo antes de você entrar.",
  LOGIN_RECUSADO: "A Microsoft recusou o login. Comece de novo pelo botão da ficha do Canal.",
  SERVICO_FORA: "Não foi possível falar com a Microsoft agora. Tente de novo em instantes.",
} as const;

interface RespostaDoToken {
  readonly status: number;
  readonly corpo: Record<string, unknown> | undefined;
}

const texto = (valor: unknown): string | undefined => (typeof valor === "string" && valor !== "" ? valor : undefined);

export function criarClienteMicrosoft(
  config: ConfiguracaoDoClienteMicrosoft,
  enderecos: EnderecosDaMicrosoft = ENDERECOS_DA_MICROSOFT,
  opcoes: OpcoesDoClienteMicrosoft = {},
): ClienteOauthDoEmail {
  const buscar = opcoes.fetch ?? fetch;
  const tempoLimite = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;
  const agora = opcoes.agora ?? Date.now;
  const escopo = ESCOPOS_MICROSOFT.join(" ");

  /** POST de formulário ao endpoint de token. `undefined` quando não houve resposta (rede, tempo): quem chama decide o que isso é. */
  async function pedirToken(campos: Record<string, string>): Promise<RespostaDoToken | undefined> {
    try {
      const resposta = await buscar(enderecos.token, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams(campos).toString(),
        signal: AbortSignal.timeout(tempoLimite),
      });
      let corpo: Record<string, unknown> | undefined;
      try {
        const lido: unknown = JSON.parse(await resposta.text());
        corpo = typeof lido === "object" && lido !== null && !Array.isArray(lido) ? (lido as Record<string, unknown>) : undefined;
      } catch {
        corpo = undefined;
      }
      return { status: resposta.status, corpo };
    } catch {
      // A causa pode carregar a URL e o corpo do pedido: nada dela sai daqui.
      return undefined;
    }
  }

  const pedirComSecret = (campos: Record<string, string>) =>
    pedirToken({ client_id: config.clientId, client_secret: config.clientSecret, scope: escopo, ...campos });

  return {
    servico: "microsoft",

    urlDeAutorizacao(pedido: PedidoDeAutorizacao): string {
      const url = new URL(enderecos.autorizacao);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("response_mode", "query");
      url.searchParams.set("scope", escopo);
      url.searchParams.set("state", pedido.state);
      url.searchParams.set("code_challenge", pedido.desafio);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("login_hint", pedido.loginHint);
      url.searchParams.set("prompt", "select_account");
      return url.toString();
    },

    async trocarCodigo(codigo: string, verificador: string): Promise<TokensDoLogin> {
      const resposta = await pedirComSecret({
        grant_type: "authorization_code",
        code: codigo,
        redirect_uri: config.redirectUri,
        code_verifier: verificador,
      });
      if (resposta === undefined || resposta.status >= 500 || resposta.status === 429) {
        throw new ErroDoLogin("SERVICO_FORA", FRASES_DO_LOGIN.SERVICO_FORA);
      }
      const corpo = resposta.corpo;
      if (resposta.status >= 400 || corpo === undefined || texto(corpo.error) !== undefined) {
        const erro = texto(corpo?.error);
        const descricao = texto(corpo?.error_description) ?? "";
        if (erro === "consent_required" || SINAIS_DE_ADMINISTRADOR.some((sinal) => descricao.includes(sinal) || (erro ?? "").includes(sinal))) {
          throw new ErroDoLogin("CONSENTIMENTO_DO_ADMINISTRADOR", FRASES_DO_LOGIN.CONSENTIMENTO_DO_ADMINISTRADOR);
        }
        if (erro === "temporarily_unavailable") throw new ErroDoLogin("SERVICO_FORA", FRASES_DO_LOGIN.SERVICO_FORA);
        throw new ErroDoLogin("LOGIN_RECUSADO", FRASES_DO_LOGIN.LOGIN_RECUSADO);
      }

      const accessToken = texto(corpo.access_token);
      const refreshToken = texto(corpo.refresh_token);
      const expiraEmSegundos = typeof corpo.expires_in === "number" ? corpo.expires_in : Number(corpo.expires_in);
      if (accessToken === undefined || refreshToken === undefined || !Number.isFinite(expiraEmSegundos) || expiraEmSegundos <= 0) {
        // Sem o token de renovação não há conexão que dure: o `offline_access` não foi concedido.
        throw new ErroDoLogin("LOGIN_RECUSADO", FRASES_DO_LOGIN.LOGIN_RECUSADO);
      }
      const id = lerIdToken(texto(corpo.id_token), { clientId: config.clientId, agora: agora() });
      return {
        accessToken,
        refreshToken,
        expiraEm: new Date(agora() + expiraEmSegundos * 1000).toISOString(),
        conta: {
          ...(id?.email !== undefined ? { email: id.email } : {}),
          // `oid:tid` é o identificador estável da conta na Microsoft (o `sub` é por app).
          ...(id?.oid !== undefined && id.tid !== undefined ? { idEstavel: `${id.oid}:${id.tid}` } : {}),
        },
      };
    },

    async renovar(refreshToken: string) {
      const resposta = await pedirComSecret({ grant_type: "refresh_token", refresh_token: refreshToken });
      // Rede, tempo, 5xx e 429: passageiro (D-17-20), a plataforma tenta de novo.
      if (resposta === undefined || resposta.status >= 500 || resposta.status === 429) throw new ErroDeRenovacao(false);
      const corpo = resposta.corpo;
      const erro = texto(corpo?.error);
      if (erro !== undefined && ERROS_PERMANENTES.has(erro)) throw new ErroDeRenovacao(true, FRASE_MICROSOFT_RENOVACAO_PERMANENTE);
      if (resposta.status >= 400 || erro !== undefined || corpo === undefined) throw new ErroDeRenovacao(false);

      const accessToken = texto(corpo.access_token);
      const expiraEmSegundos = typeof corpo.expires_in === "number" ? corpo.expires_in : Number(corpo.expires_in);
      if (accessToken === undefined || !Number.isFinite(expiraEmSegundos) || expiraEmSegundos <= 0) throw new ErroDeRenovacao(false);
      const novo = texto(corpo.refresh_token);
      return {
        accessToken,
        expiraEm: new Date(agora() + expiraEmSegundos * 1000).toISOString(),
        // A Microsoft gira o token de renovação a cada uso: o novo substitui o antigo no cofre.
        ...(novo !== undefined ? { refreshToken: novo } : {}),
      };
    },
    // Sem `revogar` (A9): ver o cabeçalho.
  };
}
