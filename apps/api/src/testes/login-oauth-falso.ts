/**
 * Peças para testar o login OAuth do e-mail (Fase 17, 17-12) contra o `criarServidorFalso`, sem nenhum serviço real:
 *
 *   idTokenDeTeste   um JWT SEM assinatura válida (o cliente não confere a assinatura: ele veio do endpoint de token)
 *   camposDoPedido   o corpo de formulário que o cliente mandou ao endpoint de token, já em objeto
 *
 * Todos os valores são de teste; nenhum client id nem segredo reais moram aqui.
 */

import type { RequisicaoRecebida } from "./servidor-falso";

const emBase64Url = (texto: string) => Buffer.from(texto, "utf8").toString("base64url");

/** Um `id_token` com os `claims` dados. `exp` padrão: daqui a 1 h. */
export function idTokenDeTeste(claims: Record<string, unknown>): string {
  const corpo = { exp: Math.floor(Date.now() / 1000) + 3600, ...claims };
  return `${emBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${emBase64Url(JSON.stringify(corpo))}.assinatura-de-teste`;
}

/** O corpo `application/x-www-form-urlencoded` de um pedido recebido pelo servidor falso, como objeto. */
export function camposDoPedido(recebida: RequisicaoRecebida): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(typeof recebida.corpo === "string" ? recebida.corpo : ""));
}
