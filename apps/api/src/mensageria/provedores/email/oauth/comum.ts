/**
 * O que o login do Google e o da Microsoft têm em comum (Fase 17, 17-12, D-17-04). Só tipos e funções puras: nada aqui
 * conhece banco, Canal ou Espaço, e nada abre rede.
 *
 *   ClienteOauthDoEmail   a conversa HTTP com UM serviço (URL do login, troca do código, renovação)
 *   TokensDoLogin         o que a troca do código devolve
 *   ErroDoLogin           a falha do login, com uma frase de produto e NUNCA o token, o código nem o corpo da resposta
 *   lerIdToken            o `id_token` lido sem confiar nele (ele só serve de pré-conferência da frase de erro)
 */

import type { RenovadorDeToken } from "../credencial";
import type { ServicoDeLogin } from "../configuracao";

export type { ServicoDeLogin } from "../configuracao";

/** A conta que o serviço diz ter entrado. Só pré-conferência: a prova é o login XOAUTH2 na caixa (A9, A11). */
export interface ContaDoLogin {
  /** O endereço que o `id_token` informa; mutável e "não garantido" pela Microsoft, nunca serve de prova. */
  readonly email?: string;
  /** O identificador estável da conta no serviço: `oid:tid` na Microsoft, `sub` no Google. */
  readonly idEstavel?: string;
  /** O serviço diz que confirmou o `email` (`email_verified` do Google). Ausente quando o serviço não informa (Microsoft). */
  readonly emailVerificado?: boolean;
}

export interface TokensDoLogin {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** ISO 8601: quando o `accessToken` vence. */
  readonly expiraEm: string;
  readonly conta: ContaDoLogin;
}

export interface PedidoDeAutorizacao {
  readonly state: string;
  /** O `code_challenge` do PKCE (S256). */
  readonly desafio: string;
  /** O endereço do Canal: a janela de login já vem com ele preenchido. */
  readonly loginHint: string;
}

export interface ClienteOauthDoEmail {
  readonly servico: ServicoDeLogin;
  urlDeAutorizacao(pedido: PedidoDeAutorizacao): string;
  trocarCodigo(codigo: string, verificador: string): Promise<TokensDoLogin>;
  renovar: RenovadorDeToken;
  /** Só existe onde o serviço tem endpoint de revogação por token. */
  revogar?(token: string): Promise<void>;
}

export type CodigoDoLogin = "CONSENTIMENTO_DO_ADMINISTRADOR" | "LOGIN_RECUSADO" | "SERVICO_FORA";

/** A falha do login: a mensagem é uma frase fixa por código, sem o corpo da resposta do serviço, sem token e sem código. */
export class ErroDoLogin extends Error {
  readonly codigo: CodigoDoLogin;
  constructor(codigo: CodigoDoLogin, mensagem: string) {
    super(mensagem);
    this.name = "ErroDoLogin";
    this.codigo = codigo;
  }
}

/** O que sai do `id_token`: nada mais que isto é lido. */
export interface DadosDoIdToken {
  readonly email?: string;
  /** `email_verified`: o Google o manda como booleano (ou, em alguns pontos, como a palavra "true"). */
  readonly emailVerificado?: boolean;
  readonly sub?: string;
  readonly oid?: string;
  readonly tid?: string;
}

const texto = (valor: unknown): string | undefined => (typeof valor === "string" && valor.trim() !== "" ? valor : undefined);

/**
 * Lê o `id_token` SEM confiar no conteúdo: ele veio direto do endpoint de token, por TLS, e a assinatura não é conferida
 * (a OIDC permite quando a origem é o endpoint de token). Confere a forma de JWT, a audiência (`aud` = o client id do app) e
 * o prazo (`exp`); qualquer falha devolve `undefined`, e quem chama segue só com a prova da caixa. O e-mail é
 * `email` ou, na falta, `preferred_username` quando parece um endereço.
 */
export function lerIdToken(idToken: string | undefined, opcoes: { readonly clientId: string; readonly agora?: number }): DadosDoIdToken | undefined {
  if (idToken === undefined) return undefined;
  const partes = idToken.split(".");
  if (partes.length !== 3 || partes.some((p) => !/^[A-Za-z0-9_-]*$/.test(p))) return undefined;
  let corpo: unknown;
  try {
    corpo = JSON.parse(Buffer.from(partes[1]!, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) return undefined;
  const c = corpo as Record<string, unknown>;
  const audiencia = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!audiencia.includes(opcoes.clientId)) return undefined;
  const agoraEmSegundos = (opcoes.agora ?? Date.now()) / 1000;
  if (typeof c.exp !== "number" || c.exp < agoraEmSegundos) return undefined;

  const candidato = texto(c.email) ?? texto(c.preferred_username);
  const email = candidato !== undefined && candidato.includes("@") ? candidato.trim() : undefined;
  const verificado = c.email_verified === true || c.email_verified === "true" ? true : c.email_verified === false || c.email_verified === "false" ? false : undefined;
  const sub = texto(c.sub);
  const oid = texto(c.oid);
  const tid = texto(c.tid);
  return {
    ...(email !== undefined ? { email } : {}),
    ...(verificado !== undefined ? { emailVerificado: verificado } : {}),
    ...(sub !== undefined ? { sub } : {}),
    ...(oid !== undefined ? { oid } : {}),
    ...(tid !== undefined ? { tid } : {}),
  };
}
