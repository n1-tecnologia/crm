/**
 * As duas formas com que a Meta assina o que manda para cá (Sessão 7, 7.2.4, e
 * Sessão 8, 8.3.2). Mora aqui, fora das rotas, para o WhatsApp oficial e o
 * Instagram usarem a mesma conferência.
 *
 *   - `X-Hub-Signature-256` dos webhooks: HMAC-SHA256 do corpo CRU com o segredo
 *     do app, em hexadecimal, depois de `sha256=`. Re-serializar o JSON mudaria
 *     espaços e ordem de chaves, por isso a conferência é sobre os bytes.
 *   - `signed_request` da desautorização e do pedido de exclusão de dados:
 *     `<assinatura>.<carga>`, os dois em base64url; a assinatura é o HMAC-SHA256
 *     do TEXTO base64url da carga, e a carga é um JSON com `user_id`.
 *
 * Nada aqui loga ou lança com o segredo ou o corpo.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Compara em tempo constante; o hash faz os dois lados terem o mesmo tamanho. */
export function iguais(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** A assinatura `X-Hub-Signature-256` confere com o corpo cru e o segredo? */
export function assinaturaDoCorpoConfere(segredo: string, bruto: Buffer, cabecalho: string | undefined): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", segredo).update(bruto).digest("hex");
  return iguais(cabecalho.slice("sha256=".length), esperada);
}

function deBase64Url(texto: string): Buffer | undefined {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(texto)) return undefined;
  return Buffer.from(texto.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** O que a Meta diz num `signed_request`: de quem é o pedido. */
export interface PedidoAssinado {
  readonly userId: string;
  readonly emitidoEm?: number;
}

/**
 * Lê e confere um `signed_request`. `undefined` quando a forma, o algoritmo ou a
 * assinatura não batem: quem chama responde como pedido inválido, sem dizer qual.
 */
export function lerSignedRequest(signedRequest: string, segredo: string): PedidoAssinado | undefined {
  const partes = signedRequest.trim().split(".");
  if (partes.length !== 2) return undefined;
  const [assinaturaTexto, cargaTexto] = partes as [string, string];
  const assinatura = deBase64Url(assinaturaTexto);
  const cargaBytes = deBase64Url(cargaTexto);
  if (!assinatura || !cargaBytes) return undefined;

  const esperada = createHmac("sha256", segredo).update(cargaTexto).digest();
  if (assinatura.length !== esperada.length || !timingSafeEqual(assinatura, esperada)) return undefined;

  let carga: unknown;
  try {
    carga = JSON.parse(cargaBytes.toString("utf8"));
  } catch {
    return undefined;
  }
  if (typeof carga !== "object" || carga === null) return undefined;
  const { algorithm, user_id: userId, issued_at: emitidoEm } = carga as Record<string, unknown>;
  if (typeof algorithm !== "string" || algorithm.toUpperCase() !== "HMAC-SHA256") return undefined;
  if ((typeof userId !== "string" && typeof userId !== "number") || String(userId).trim() === "") return undefined;
  return { userId: String(userId), ...(typeof emitidoEm === "number" ? { emitidoEm } : {}) };
}
