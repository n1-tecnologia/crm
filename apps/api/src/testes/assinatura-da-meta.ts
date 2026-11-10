/**
 * Para os testes do que a Meta assina: um `signed_request` (desautorização e exclusão
 * de dados do Instagram) e o `X-Hub-Signature-256` de um corpo. O mesmo algoritmo de
 * `provedores/meta/assinatura.ts`, escrito do lado de quem assina.
 */

import { createHmac } from "node:crypto";

export function signedRequest(carga: unknown, segredo: string): string {
  const cargaTexto = Buffer.from(JSON.stringify(carga), "utf8").toString("base64url");
  const assinatura = createHmac("sha256", segredo).update(cargaTexto).digest("base64url");
  return `${assinatura}.${cargaTexto}`;
}

export function assinaturaDoCorpo(corpo: string, segredo: string): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;
}
