/**
 * O `state` do login do Instagram (8.2.2): diz, na volta, de qual Canal, Espaço e
 * Membro era o pedido, e prova que foi esta API que o emitiu.
 *
 * Assinado em vez de guardado: o retorno chega depois de o navegador passar pela
 * Meta, e a API pode ter reiniciado no meio. A forma é `<dados>.<assinatura>`, os
 * dois em base64url; a assinatura é o HMAC-SHA256 dos dados com o segredo do app,
 * com um prefixo próprio para não valer como assinatura de outra coisa.
 *
 * O que impede usar o `state` de outra pessoa (falsificação de login): o retorno é
 * uma rota AUTENTICADA, e o serviço confere que o Membro e o Espaço da sessão são
 * os do `state`. Vale 10 minutos.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const VALIDADE_DO_ESTADO_MS = 10 * 60_000;
const PREFIXO = "n1/instagram/estado:";

export interface EstadoDaAutorizacao {
  readonly workspaceId: string;
  readonly canalId: string;
  readonly membroId: string;
  /** Milissegundos desde a época. */
  readonly expiraEm: number;
}

const paraBase64Url = (bytes: Buffer): string => bytes.toString("base64url");

function assinatura(segredo: string, dados: string): Buffer {
  return createHmac("sha256", segredo).update(PREFIXO + dados).digest();
}

export function assinarEstado(
  segredo: string,
  pedido: Omit<EstadoDaAutorizacao, "expiraEm">,
  agora: number = Date.now(),
): string {
  const dados = paraBase64Url(
    Buffer.from(
      JSON.stringify({
        w: pedido.workspaceId,
        c: pedido.canalId,
        m: pedido.membroId,
        e: agora + VALIDADE_DO_ESTADO_MS,
        n: randomBytes(9).toString("base64url"),
      }),
      "utf8",
    ),
  );
  return `${dados}.${paraBase64Url(assinatura(segredo, dados))}`;
}

/** `undefined` para forma errada, assinatura que não confere ou prazo vencido: o motivo não é dito a quem chamou. */
export function lerEstado(segredo: string, texto: string, agora: number = Date.now()): EstadoDaAutorizacao | undefined {
  const partes = texto.split(".");
  if (partes.length !== 2) return undefined;
  const [dados, assinado] = partes as [string, string];
  if (!/^[A-Za-z0-9_-]+$/.test(dados) || !/^[A-Za-z0-9_-]+$/.test(assinado)) return undefined;
  const recebida = Buffer.from(assinado, "base64url");
  const esperada = assinatura(segredo, dados);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return undefined;

  let corpo: unknown;
  try {
    corpo = JSON.parse(Buffer.from(dados, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  if (typeof corpo !== "object" || corpo === null) return undefined;
  const { w, c, m, e } = corpo as Record<string, unknown>;
  if (typeof w !== "string" || typeof c !== "string" || typeof m !== "string" || typeof e !== "number") return undefined;
  if (agora > e) return undefined;
  return { workspaceId: w, canalId: c, membroId: m, expiraEm: e };
}

