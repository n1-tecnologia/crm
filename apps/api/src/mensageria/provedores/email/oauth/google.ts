/**
 * O cliente do login do Google para IMAP e SMTP (Fase 17, 17-13, D-17-01, D-17-02, D-17-06, D-17-20): a URL da janela de
 * login, a troca do código (com o `client_secret` e o PKCE), a renovação do token de acesso e a revogação do token. Só HTTP:
 * nada aqui conhece banco, Canal ou Espaço. É o molde da Microsoft (`microsoft.ts`) com as diferenças do Google.
 *
 * Segredos: o código, o token de acesso, o de renovação e o `client_secret` só saem daqui no corpo do pedido ao Google. Nenhum
 * erro lançado os carrega, nem o corpo da resposta: as mensagens são frases fixas por tipo de falha (T-17-60).
 *
 * O que é do Google, e já está provado só contra um servidor FALSO (os pontos abaixo são PRESSUPOSTOS A CONFIRMAR NA PROVA
 * REAL, 9.4.4; nenhum vira texto de tela):
 *   - O escopo `https://mail.google.com/` é RESTRITO: até o app passar pela verificação do Google (avaliação CASA), o app fica em
 *     modo de teste, com no máximo 100 usuários de teste cadastrados, e o token de renovação de um app em teste vale 7 dias.
 *     Passados os 7 dias, a renovação responde `invalid_grant`: é a mesma queda permanente da autorização retirada, e a pessoa
 *     entra de novo (a senha de app cobre o Gmail enquanto isso, D-17-02).
 *   - `access_type=offline` + `prompt=consent`: o Google só devolve o `refresh_token` na primeira autorização de cada par
 *     (usuário, app); quem reconecta precisa de um novo, e o consentimento forçado garante isso.
 *   - O Google NÃO gira o token de renovação a cada uso (diferente da Microsoft): a renovação devolve só o token de acesso e o
 *     cofre fica com o mesmo `refresh_token`. Se um dia vier um novo, quem renova o grava (a porta já faz).
 *   - Há endpoint de revogação por token (`/revoke`), que aceita o de renovação e derruba os de acesso derivados.
 *   - O `id_token` traz `email`, `email_verified` e `sub` (o identificador estável da conta); `googlemail.com` é a mesma caixa
 *     de `gmail.com`. A prova da caixa continua sendo o login XOAUTH2 com `user` = o endereço do Canal em `imap.gmail.com` e
 *     `smtp.gmail.com`, nunca o `id_token`.
 */

import { ErroDeRenovacao } from "../credencial";
import { ErroDoLogin, lerIdToken, type ClienteOauthDoEmail, type PedidoDeAutorizacao, type TokensDoLogin } from "./comum";

export interface EnderecosDoGoogle {
  readonly autorizacao: string;
  readonly token: string;
  readonly revogacao: string;
}

export const ENDERECOS_DO_GOOGLE: EnderecosDoGoogle = {
  autorizacao: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revogacao: "https://oauth2.googleapis.com/revoke",
};

/** `openid email` dão o `id_token` com o endereço; `https://mail.google.com/` é o único escopo que abre IMAP e SMTP (restrito). */
export const ESCOPOS_GOOGLE = ["openid", "email", "https://mail.google.com/"] as const;

export interface ConfiguracaoDoClienteGoogle {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface OpcoesDoClienteGoogle {
  /** Testes trocam por um servidor falso; em produção, o `fetch` do Node. */
  readonly fetch?: typeof fetch;
  readonly tempoLimiteMs?: number;
  /** A revogação roda ao desconectar: o tempo é curto para a tela não esperar o Google. */
  readonly tempoLimiteDaRevogacaoMs?: number;
  /** Para calcular o vencimento do token; testes fixam o relógio. */
  readonly agora?: () => number;
}

const TEMPO_LIMITE_PADRAO_MS = 15_000;
const TEMPO_LIMITE_DA_REVOGACAO_MS = 5_000;

export const FRASE_GOOGLE_RENOVACAO_PERMANENTE = "A autorização do Google venceu ou foi retirada: entre de novo com o Google.";

/**
 * Erros do Google que NÃO se resolvem repetindo. Só `invalid_grant`: o token de renovação foi revogado, venceu (os 7 dias do modo de
 * teste), a senha da conta mudou ou o acesso foi retirado. `invalid_client` (segredo trocado no painel) é problema de configuração
 * do servidor, que entrar de novo não resolve: fica transitório, e a plataforma volta a tentar quando a configuração for corrigida.
 */
const ERROS_PERMANENTES = new Set(["invalid_grant"]);

const FRASES_DO_LOGIN = {
  LOGIN_RECUSADO: "O Google recusou o login. Comece de novo pelo botão da ficha do Canal.",
  SERVICO_FORA: "Não foi possível falar com o Google agora. Tente de novo em instantes.",
} as const;

/** Mensagem fixa: nunca leva o token, o corpo da resposta nem o endereço. */
export const FRASE_GOOGLE_REVOGACAO_FALHOU = "O Google não confirmou a revogação do acesso.";

interface RespostaDoToken {
  readonly status: number;
  readonly corpo: Record<string, unknown> | undefined;
}

const texto = (valor: unknown): string | undefined => (typeof valor === "string" && valor !== "" ? valor : undefined);

export function criarClienteGoogle(
  config: ConfiguracaoDoClienteGoogle,
  enderecos: EnderecosDoGoogle = ENDERECOS_DO_GOOGLE,
  opcoes: OpcoesDoClienteGoogle = {},
): ClienteOauthDoEmail {
  const buscar = opcoes.fetch ?? fetch;
  const tempoLimite = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;
  const tempoLimiteDaRevogacao = opcoes.tempoLimiteDaRevogacaoMs ?? TEMPO_LIMITE_DA_REVOGACAO_MS;
  const agora = opcoes.agora ?? Date.now;
  const escopo = ESCOPOS_GOOGLE.join(" ");

  /** POST de formulário. `undefined` quando não houve resposta (rede, tempo): quem chama decide o que isso é. */
  async function postar(endereco: string, campos: Record<string, string>, limiteMs: number): Promise<RespostaDoToken | undefined> {
    try {
      const resposta = await buscar(endereco, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams(campos).toString(),
        signal: AbortSignal.timeout(limiteMs),
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

  const pedirToken = (campos: Record<string, string>) =>
    postar(enderecos.token, { client_id: config.clientId, client_secret: config.clientSecret, ...campos }, tempoLimite);

  return {
    servico: "google",

    urlDeAutorizacao(pedido: PedidoDeAutorizacao): string {
      const url = new URL(enderecos.autorizacao);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("scope", escopo);
      // `offline` pede o token de renovação; `consent` o repete a cada autorização (o Google só o manda na primeira).
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", pedido.state);
      url.searchParams.set("code_challenge", pedido.desafio);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("login_hint", pedido.loginHint);
      return url.toString();
    },

    async trocarCodigo(codigo: string, verificador: string): Promise<TokensDoLogin> {
      const resposta = await pedirToken({
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
        // `invalid_grant` aqui é o código usado ou vencido; `redirect_uri_mismatch` e `invalid_client` são configuração.
        throw new ErroDoLogin("LOGIN_RECUSADO", FRASES_DO_LOGIN.LOGIN_RECUSADO);
      }

      const accessToken = texto(corpo.access_token);
      const refreshToken = texto(corpo.refresh_token);
      const expiraEmSegundos = typeof corpo.expires_in === "number" ? corpo.expires_in : Number(corpo.expires_in);
      if (accessToken === undefined || refreshToken === undefined || !Number.isFinite(expiraEmSegundos) || expiraEmSegundos <= 0) {
        // Sem o token de renovação não há conexão que dure: o acesso offline não foi concedido.
        throw new ErroDoLogin("LOGIN_RECUSADO", FRASES_DO_LOGIN.LOGIN_RECUSADO);
      }
      const id = lerIdToken(texto(corpo.id_token), { clientId: config.clientId, agora: agora() });
      return {
        accessToken,
        refreshToken,
        expiraEm: new Date(agora() + expiraEmSegundos * 1000).toISOString(),
        conta: {
          ...(id?.email !== undefined ? { email: id.email } : {}),
          // `email_verified` ausente com `email` presente vale como não verificado: a conferência é de quem chama.
          ...(id?.emailVerificado !== undefined ? { emailVerificado: id.emailVerificado } : {}),
          // O `sub` é o identificador estável da conta no Google (o e-mail muda; o `sub` não).
          ...(id?.sub !== undefined ? { idEstavel: id.sub } : {}),
        },
      };
    },

    async renovar(refreshToken: string) {
      const resposta = await pedirToken({ grant_type: "refresh_token", refresh_token: refreshToken });
      // Rede, tempo, 5xx e 429: passageiro (D-17-20), a plataforma tenta de novo.
      if (resposta === undefined || resposta.status >= 500 || resposta.status === 429) throw new ErroDeRenovacao(false);
      const corpo = resposta.corpo;
      const erro = texto(corpo?.error);
      if (erro !== undefined && ERROS_PERMANENTES.has(erro)) throw new ErroDeRenovacao(true, FRASE_GOOGLE_RENOVACAO_PERMANENTE);
      if (resposta.status >= 400 || erro !== undefined || corpo === undefined) throw new ErroDeRenovacao(false);

      const accessToken = texto(corpo.access_token);
      const expiraEmSegundos = typeof corpo.expires_in === "number" ? corpo.expires_in : Number(corpo.expires_in);
      if (accessToken === undefined || !Number.isFinite(expiraEmSegundos) || expiraEmSegundos <= 0) throw new ErroDeRenovacao(false);
      // O Google não gira o token de renovação: só repassa um novo se ele vier (o cofre fica com o mesmo, caso contrário).
      const novo = texto(corpo.refresh_token);
      return {
        accessToken,
        expiraEm: new Date(agora() + expiraEmSegundos * 1000).toISOString(),
        ...(novo !== undefined ? { refreshToken: novo } : {}),
      };
    },

    /** D-17-06: tira o acesso no Google ao desconectar. Lança uma frase fixa quando o Google não confirma; quem chama a engole. */
    async revogar(token: string): Promise<void> {
      const resposta = await postar(enderecos.revogacao, { token }, tempoLimiteDaRevogacao);
      if (resposta === undefined || resposta.status < 200 || resposta.status >= 300) throw new Error(FRASE_GOOGLE_REVOGACAO_FALHOU);
    },
  };
}
