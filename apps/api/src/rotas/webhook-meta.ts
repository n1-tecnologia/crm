/**
 * Os webhooks da Meta — WhatsApp oficial (WhatsApp Business Platform) e
 * Instagram (DMs): os endereços que o painel do app da Meta chama, sem
 * `Authorization: Bearer` (`config: { publica: true }`, o mesmo gancho de
 * `/saude`).
 *
 * Por ora SÓ ESCUTAM: conferem a origem, registram o corpo no log do processo e
 * respondem 200. Nada é gravado e nenhuma Mensagem é criada — o formato que a
 * Meta manda ainda será validado, e `registrarRecebida` (Mensagens) é a porta
 * que o provedor vai usar quando esse passo vier.
 *
 * Cada canal tem duas rotas no mesmo caminho, porque a Meta usa as duas:
 *   · GET  — o aperto de mão ao cadastrar a URL: devolve `hub.challenge` se o
 *            `hub.verify_token` for o `META_WEBHOOK_VERIFY_TOKEN` (o mesmo
 *            token serve aos dois canais);
 *   · POST — os eventos. Com o segredo do app definido, exige a assinatura
 *            `X-Hub-Signature-256` (HMAC-SHA256 do corpo CRU com o segredo do
 *            app); sem ele, aceita e avisa no log.
 *
 * O segredo muda por canal: o WhatsApp assina com `META_APP_SECRET`; o
 * Instagram, com `INSTAGRAM_APP_SECRET` (o app do Instagram tem chave própria)
 * e, enquanto não se confirmar qual a Meta usa de fato, também com
 * `META_APP_SECRET`. O log do POST aceito diz qual segredo bateu.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";

export const CAMINHO_WEBHOOK_META_WHATSAPP = "/webhooks/meta/whatsapp";
export const CAMINHO_WEBHOOK_META_INSTAGRAM = "/webhooks/meta/instagram";

export interface OpcoesDeWebhookMeta {
  /** Padrão: `process.env.META_WEBHOOK_VERIFY_TOKEN`, lido a cada pedido. */
  readonly tokenDeVerificacao?: string;
  /** Padrão: `process.env.META_APP_SECRET`, lido a cada pedido. */
  readonly segredoDoApp?: string;
  /** Padrão: `process.env.INSTAGRAM_APP_SECRET`, lido a cada pedido. */
  readonly segredoDoInstagram?: string;
}

/** O corpo como o parser o entrega: o JSON lido e os bytes exatos que a assinatura cobre. */
interface CorpoDoWebhook {
  readonly bruto: Buffer;
  readonly json: unknown;
}

/** Um segredo que pode assinar o POST de um canal; `valor` vazio ou ausente = não configurado. */
interface SegredoCandidato {
  readonly nome: string;
  readonly valor: string | undefined;
}

interface CanalDeWebhook {
  readonly canal: "whatsapp" | "instagram";
  readonly caminho: string;
  /** Os nomes das variáveis de ambiente dos segredos, só para o aviso do log. */
  readonly variaveis: string;
  readonly tokenDeVerificacao: () => string | undefined;
  readonly segredos: () => readonly SegredoCandidato[];
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

function registrarWebhook(app: FastifyInstance, canal: CanalDeWebhook): void {
  app.get(canal.caminho, { config: { publica: true } }, async (request, reply) => {
    const consulta = request.query as Record<string, unknown>;
    const modo = texto(consulta["hub.mode"]);
    const token = texto(consulta["hub.verify_token"]);
    const desafio = texto(consulta["hub.challenge"]);
    const esperado = canal.tokenDeVerificacao();

    if (!esperado) {
      request.log.warn(
        { rota: "webhook-meta", canal: canal.canal },
        "META_WEBHOOK_VERIFY_TOKEN não definido: verificação recusada",
      );
      return reply.code(403).send({ ok: false, error: "Verificação indisponível." });
    }
    if (modo !== "subscribe" || token === undefined || !iguais(token, esperado) || !desafio) {
      request.log.info({ rota: "webhook-meta", canal: canal.canal, status: 403 }, "verificação da Meta recusada");
      return reply.code(403).send({ ok: false, error: "Verificação recusada." });
    }
    request.log.info({ rota: "webhook-meta", canal: canal.canal, status: 200 }, "verificação da Meta aceita");
    // text/plain: a Meta espera o desafio devolvido como veio, sem JSON em volta.
    return reply.code(200).type("text/plain; charset=utf-8").send(desafio);
  });

  app.post(canal.caminho, { config: { publica: true } }, async (request: FastifyRequest, reply) => {
    const corpo = request.body as CorpoDoWebhook | undefined;
    const configurados = canal.segredos().filter((s): s is { nome: string; valor: string } => !!s.valor);
    let segredoUsado: string | undefined;

    if (configurados.length > 0) {
      const cabecalho = request.headers["x-hub-signature-256"];
      const assinatura = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
      const quemAssinou = corpo ? configurados.find((s) => assinaturaConfere(s.valor, corpo.bruto, assinatura)) : undefined;
      if (!quemAssinou) {
        request.log.warn(
          { rota: "webhook-meta", canal: canal.canal, status: 401 },
          "assinatura da Meta inválida ou ausente",
        );
        return reply.code(401).send({ ok: false, error: "Assinatura inválida." });
      }
      segredoUsado = quemAssinou.nome;
    } else {
      request.log.warn(
        { rota: "webhook-meta", canal: canal.canal },
        `${canal.variaveis} não definido: assinatura NÃO verificada`,
      );
    }

    request.log.info(
      { rota: "webhook-meta", canal: canal.canal, status: 200, segredo: segredoUsado, payload: corpo?.json ?? null },
      "webhook da Meta recebido",
    );
    // A Meta reenvia o que não receber 200 em poucos segundos: responder já.
    return reply.code(200).send({ ok: true });
  });
}

export async function rotasDeWebhookMeta(app: FastifyInstance, opcoes: OpcoesDeWebhookMeta = {}): Promise<void> {
  const tokenDeVerificacao = () => opcoes.tokenDeVerificacao ?? process.env.META_WEBHOOK_VERIFY_TOKEN;
  const segredoDoApp = () => opcoes.segredoDoApp ?? process.env.META_APP_SECRET;
  const segredoDoInstagram = () => opcoes.segredoDoInstagram ?? process.env.INSTAGRAM_APP_SECRET;

  // Encapsulado neste plugin: o corpo cru só é guardado aqui, para a assinatura
  // ser conferida sobre os bytes que a Meta assinou (re-serializar o JSON mudaria
  // espaços e ordem de chaves e a conferência nunca fecharia). Um parser só serve
  // aos dois canais — registrá-lo duas vezes no mesmo plugin é erro do Fastify.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, bruto, feito) => {
    const buffer = bruto as Buffer;
    try {
      const json: unknown = buffer.length === 0 ? null : JSON.parse(buffer.toString("utf8"));
      feito(null, { bruto: buffer, json } satisfies CorpoDoWebhook);
    } catch {
      feito(Object.assign(new Error("JSON inválido."), { statusCode: 400 }), undefined);
    }
  });

  registrarWebhook(app, {
    canal: "whatsapp",
    caminho: CAMINHO_WEBHOOK_META_WHATSAPP,
    variaveis: "META_APP_SECRET",
    tokenDeVerificacao,
    segredos: () => [{ nome: "META_APP_SECRET", valor: segredoDoApp() }],
  });
  registrarWebhook(app, {
    canal: "instagram",
    caminho: CAMINHO_WEBHOOK_META_INSTAGRAM,
    variaveis: "INSTAGRAM_APP_SECRET e META_APP_SECRET",
    tokenDeVerificacao,
    segredos: () => [
      { nome: "INSTAGRAM_APP_SECRET", valor: segredoDoInstagram() },
      { nome: "META_APP_SECRET", valor: segredoDoApp() },
    ],
  });
}
