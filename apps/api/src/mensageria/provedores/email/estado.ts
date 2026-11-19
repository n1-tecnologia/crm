/**
 * O `state` do login do e-mail (Fase 17, 17-12, D-17-04): diz, na volta do Google ou da Microsoft, de qual Canal, Espaço,
 * Membro e serviço era o pedido, e prova que foi esta API que o emitiu.
 *
 * Assinado em vez de guardado, no molde do `instagram/estado.ts`: a volta passa pelo navegador e pela página da web, e a API
 * pode ter reiniciado no meio. A forma é `<dados>.<assinatura>`, os dois em base64url; a assinatura é o HMAC-SHA256 dos dados
 * com o segredo do cliente OAuth DO SERVIÇO (por isso um `state` do Google não vale como da Microsoft), com um prefixo
 * próprio para não valer como assinatura de outra coisa. A comparação é `timingSafeEqual`. Vale 10 minutos.
 *
 * PKCE sem tabela (Pattern 7 da pesquisa, A8): o `code_verifier` é derivado do segredo do servidor e do nonce do `state`,
 * `base64url(HMAC-SHA256(segredo, "pkce:" + nonce))` (43 caracteres), e recalculado no `concluir` depois de o `state` ser
 * conferido; o navegador só vê o `code_challenge`, o SHA-256 dele. Quem intercepta o código sem o servidor não o troca.
 *
 * O que impede usar o `state` de outra pessoa: o retorno é uma rota AUTENTICADA, e o serviço confere que o Membro e o
 * Espaço da sessão são os do `state`. Nada daqui vai a log nem a erro.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ServicoDeLogin } from "./configuracao";

export const VALIDADE_DO_ESTADO_MS = 10 * 60_000;
const PREFIXO = "n1/email/estado:";
const PREFIXO_DO_PKCE = "pkce:";

export interface PedidoDeLoginDoEmail {
  readonly workspaceId: string;
  readonly canalId: string;
  readonly membroId: string;
  readonly servico: ServicoDeLogin;
}

export interface EstadoDoEmail extends PedidoDeLoginDoEmail {
  /** O nonce do pedido: dele sai o verificador do PKCE e a marca de uso único. */
  readonly nonce: string;
  /** Milissegundos desde a época. */
  readonly expiraEm: number;
}

const paraBase64Url = (bytes: Buffer): string => bytes.toString("base64url");

function assinatura(segredo: string, dados: string): Buffer {
  return createHmac("sha256", segredo).update(PREFIXO + dados).digest();
}

/** Emite o `state` e devolve o nonce que o PKCE precisa (o verificador se deriva dele). */
export function emitirEstadoDoEmail(
  segredo: string,
  pedido: PedidoDeLoginDoEmail,
  agora: number = Date.now(),
): { readonly state: string; readonly nonce: string } {
  const nonce = randomBytes(9).toString("base64url");
  const dados = paraBase64Url(
    Buffer.from(
      JSON.stringify({
        w: pedido.workspaceId,
        c: pedido.canalId,
        m: pedido.membroId,
        s: pedido.servico,
        e: agora + VALIDADE_DO_ESTADO_MS,
        n: nonce,
      }),
      "utf8",
    ),
  );
  return { state: `${dados}.${paraBase64Url(assinatura(segredo, dados))}`, nonce };
}

export function assinarEstadoDoEmail(segredo: string, pedido: PedidoDeLoginDoEmail, agora: number = Date.now()): string {
  return emitirEstadoDoEmail(segredo, pedido, agora).state;
}

const ehServico = (valor: unknown): valor is ServicoDeLogin => valor === "google" || valor === "microsoft";

/**
 * `undefined` para forma errada, serviço sem segredo, assinatura que não confere ou prazo vencido: o motivo não é dito a
 * quem chamou. O `s` é lido dos dados ANTES da assinatura só para escolher o segredo; ele também está sob a assinatura, e um
 * `s` trocado não confere com a assinatura do outro segredo.
 */
export function lerEstadoDoEmail(
  segredoDoServico: (servico: ServicoDeLogin) => string | undefined,
  texto: string,
  agora: number = Date.now(),
): EstadoDoEmail | undefined {
  const partes = texto.split(".");
  if (partes.length !== 2) return undefined;
  const [dados, assinado] = partes as [string, string];
  if (!/^[A-Za-z0-9_-]+$/.test(dados) || !/^[A-Za-z0-9_-]+$/.test(assinado)) return undefined;

  let corpo: unknown;
  try {
    corpo = JSON.parse(Buffer.from(dados, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  if (typeof corpo !== "object" || corpo === null) return undefined;
  const { w, c, m, s, e, n } = corpo as Record<string, unknown>;
  if (typeof w !== "string" || typeof c !== "string" || typeof m !== "string" || typeof e !== "number" || typeof n !== "string") return undefined;
  if (!ehServico(s)) return undefined;

  const segredo = segredoDoServico(s);
  if (segredo === undefined) return undefined;
  const recebida = Buffer.from(assinado, "base64url");
  const esperada = assinatura(segredo, dados);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return undefined;
  if (agora > e) return undefined;
  return { workspaceId: w, canalId: c, membroId: m, servico: s, nonce: n, expiraEm: e };
}

/** O `code_verifier` do PKCE: 43 caracteres base64url, derivados do segredo do servidor e do nonce do `state`. */
export function verificadorPkce(segredo: string, nonce: string): string {
  return paraBase64Url(createHmac("sha256", segredo).update(PREFIXO_DO_PKCE + nonce).digest());
}

/** O `code_challenge` (S256): `base64url(sha256(verificador))`, 43 caracteres. */
export function desafioPkce(verificador: string): string {
  return paraBase64Url(createHash("sha256").update(verificador).digest());
}
