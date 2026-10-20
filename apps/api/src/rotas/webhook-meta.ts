/**
 * O webhook da Meta para o WhatsApp oficial (WhatsApp Business Platform): o
 * endereço que o painel do app da Meta chama, sem `Authorization: Bearer`
 * (`config: { publica: true }`, o mesmo gancho de `/saude`).
 *
 * Por ora SÓ ESCUTA: confere a origem, registra o corpo no log do processo e
 * responde 200. Nada é gravado e nenhuma Mensagem é criada — o formato que a
 * Meta manda ainda será validado, e `registrarRecebida` (Mensagens) é a porta
 * que o provedor vai usar quando esse passo vier.
 *
 * Duas rotas no mesmo caminho, porque a Meta usa as duas:
 *   · GET  — o aperto de mão ao cadastrar a URL: devolve `hub.challenge` se o
 *            `hub.verify_token` for o `META_WEBHOOK_VERIFY_TOKEN`;
 *   · POST — os eventos. Com `META_APP_SECRET` definido, exige a assinatura
 *            `X-Hub-Signature-256` (HMAC-SHA256 do corpo CRU com o segredo do
 *            app); sem ele, aceita e avisa no log.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";

export const CAMINHO_WEBHOOK_META_WHATSAPP = "/webhooks/meta/whatsapp";

export interface OpcoesDeWebhookMeta {
  /** Padrão: `process.env.META_WEBHOOK_VERIFY_TOKEN`, lido a cada pedido. */
  readonly tokenDeVerificacao?: string;
  /** Padrão: `process.env.META_APP_SECRET`, lido a cada pedido. */
  readonly segredoDoApp?: string;
}

/** O corpo como o parser o entrega: o JSON lido e os bytes exatos que a assinatura cobre. */
interface CorpoDoWebhook {
  readonly bruto: Buffer;
  readonly json: unknown;
}

/** Compara em tempo constante; o hash faz os dois lados terem o mesmo tamanho. */
function iguais(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function assinaturaConfere(segredo: string, bruto: Buffer, cabecalho: string | undefined): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", segredo).update(bruto).digest("hex");
  return iguais(cabecalho.slice("sha256=".length), esperada);
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}

export async function rotasDeWebhookMeta(app: FastifyInstance, opcoes: OpcoesDeWebhookMeta = {}): Promise<void> {
  const tokenDeVerificacao = () => opcoes.tokenDeVerificacao ?? process.env.META_WEBHOOK_VERIFY_TOKEN;
  const segredoDoApp = () => opcoes.segredoDoApp ?? process.env.META_APP_SECRET;

  // Encapsulado neste plugin: o corpo cru só é guardado aqui, para a assinatura
  // ser conferida sobre os bytes que a Meta assinou (re-serializar o JSON mudaria
  // espaços e ordem de chaves e a conferência nunca fecharia).
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, bruto, feito) => {
    const buffer = bruto as Buffer;
    try {
      const json: unknown = buffer.length === 0 ? null : JSON.parse(buffer.toString("utf8"));
      feito(null, { bruto: buffer, json } satisfies CorpoDoWebhook);
    } catch {
      feito(Object.assign(new Error("JSON inválido."), { statusCode: 400 }), undefined);
    }
  });

  app.get(CAMINHO_WEBHOOK_META_WHATSAPP, { config: { publica: true } }, async (request, reply) => {
    const consulta = request.query as Record<string, unknown>;
    const modo = texto(consulta["hub.mode"]);
    const token = texto(consulta["hub.verify_token"]);
    const desafio = texto(consulta["hub.challenge"]);
    const esperado = tokenDeVerificacao();

    if (!esperado) {
      request.log.warn({ rota: "webhook-meta" }, "META_WEBHOOK_VERIFY_TOKEN não definido: verificação recusada");
      return reply.code(403).send({ ok: false, error: "Verificação indisponível." });
    }
    if (modo !== "subscribe" || token === undefined || !iguais(token, esperado) || !desafio) {
      request.log.info({ rota: "webhook-meta", status: 403 }, "verificação da Meta recusada");
      return reply.code(403).send({ ok: false, error: "Verificação recusada." });
    }
    request.log.info({ rota: "webhook-meta", status: 200 }, "verificação da Meta aceita");
    // text/plain: a Meta espera o desafio devolvido como veio, sem JSON em volta.
    return reply.code(200).type("text/plain; charset=utf-8").send(desafio);
  });

  app.post(CAMINHO_WEBHOOK_META_WHATSAPP, { config: { publica: true } }, async (request: FastifyRequest, reply) => {
    const corpo = request.body as CorpoDoWebhook | undefined;
    const segredo = segredoDoApp();

    if (segredo) {
      const cabecalho = request.headers["x-hub-signature-256"];
      const assinatura = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
      if (!corpo || !assinaturaConfere(segredo, corpo.bruto, assinatura)) {
        request.log.warn({ rota: "webhook-meta", status: 401 }, "assinatura da Meta inválida ou ausente");
        return reply.code(401).send({ ok: false, error: "Assinatura inválida." });
      }
    } else {
      request.log.warn({ rota: "webhook-meta" }, "META_APP_SECRET não definido: assinatura NÃO verificada");
    }

    request.log.info({ rota: "webhook-meta", status: 200, payload: corpo?.json ?? null }, "webhook da Meta recebido");
    // A Meta reenvia o que não receber 200 em poucos segundos: responder já.
    return reply.code(200).send({ ok: true });
  });
}
