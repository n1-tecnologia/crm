/**
 * Os webhooks da Meta — WhatsApp oficial (WhatsApp Business Platform) e
 * Instagram (DMs): os endereços que o painel do app da Meta chama, sem
 * `Authorization: Bearer` (`config: { publica: true }`, o mesmo gancho de
 * `/saude`).
 *
 * O Instagram (Sessão 8) e o WhatsApp oficial (Sessão 7) entram na mensageria como
 * qualquer provedor: com a assinatura conferida, `enfileirarInstagram` e
 * `enfileirarWhatsApp` (`mensageria/provedores/<provedor>/entrada.ts`) acham o Canal
 * de cada conta ou número do corpo, conferem a chamada pelo provedor dele e GUARDAM
 * cada evento em `plataforma.webhooks_recebidos`; a rota responde 200 e acorda o
 * processador de entrada, que é quem chama `receberMensagem`. Nada é interpretado na
 * requisição. Sem segredo configurado, o canal volta a só escutar: evento sem
 * assinatura nunca vira dado, e o corpo NUNCA vai ao log (tem número de telefone,
 * @ e texto de terceiros).
 *
 * Do Instagram também vêm, por formulário com `signed_request`, a desautorização
 * e o pedido de exclusão de dados (`/desautorizar` e `/exclusao-de-dados`), e a
 * página de situação da exclusão (`GET /exclusao-de-dados/:codigo`).
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

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ChamadaDoWebhook } from "../mensageria/provedor";
import { codigoDeExclusao, lerCodigoDeExclusao } from "../mensageria/provedores/instagram/desautorizacao";
import type { ResultadoDaEntradaDoInstagram } from "../mensageria/provedores/instagram/entrada";
import type { ResultadoDaEntradaDaCloudApi } from "../mensageria/provedores/whatsapp-cloud/entrada";
import { assinaturaDoCorpoConfere as assinaturaConfere, iguais, lerSignedRequest } from "../mensageria/provedores/meta/assinatura";

export const CAMINHO_WEBHOOK_META_WHATSAPP = "/webhooks/meta/whatsapp";
export const CAMINHO_WEBHOOK_META_INSTAGRAM = "/webhooks/meta/instagram";
export const CAMINHO_DESAUTORIZAR_INSTAGRAM = "/webhooks/meta/instagram/desautorizar";
export const CAMINHO_EXCLUSAO_INSTAGRAM = "/webhooks/meta/instagram/exclusao-de-dados";

export interface OpcoesDeWebhookMeta {
  /** Padrão: `process.env.META_WEBHOOK_VERIFY_TOKEN`, lido a cada pedido. */
  readonly tokenDeVerificacao?: string;
  /** Padrão: `process.env.META_APP_SECRET`, lido a cada pedido. */
  readonly segredoDoApp?: string;
  /** Padrão: `process.env.INSTAGRAM_APP_SECRET`, lido a cada pedido. */
  readonly segredoDoInstagram?: string;
  /**
   * Sessão 8: guarda os eventos do Instagram na fila de entrada da mensageria. Ausente, o
   * Instagram só escuta (é o que os testes das rotas usam); `app.ts` liga a fila de verdade.
   */
  readonly enfileirarInstagram?: (chamada: ChamadaDoWebhook) => Promise<ResultadoDaEntradaDoInstagram>;
  /** Sessão 7: o mesmo para o WhatsApp oficial. Ausente, ele só escuta. */
  readonly enfileirarWhatsApp?: (chamada: ChamadaDoWebhook) => Promise<ResultadoDaEntradaDaCloudApi>;
  /**
   * Sessão 7 (7.3.2): a Meta avisou que um modelo de mensagem mudou (`message_template_status_update`). Recebe a conta (WABA)
   * de cada aviso com a assinatura conferida; quem liga sincroniza os modelos dela, sem segurar a resposta. Ausente, o
   * aviso é ignorado (a sincronização de hora em hora e o botão da ficha cobrem).
   */
  readonly aoMudarModelosDoWhatsApp?: (wabaId: string) => void;
  /** Chamado depois do 200 quando algo entrou na fila: acorda o processador de entrada. Nunca derruba a resposta. */
  readonly acordarProcessador?: () => void;
  /** Sessão 8: desliga os Canais do `user_id` da Meta (desautorização e exclusão). Devolve quantos. */
  readonly esquecerContaDoInstagram?: (userId: string) => Promise<number>;
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
  /** Guarda o evento já conferido na fila de entrada. Ausente, o canal só escuta. */
  readonly enfileirar?: (chamada: ChamadaDoWebhook) => Promise<ResultadoDaEntradaDoInstagram | ResultadoDaEntradaDaCloudApi>;
  /** Só o WhatsApp tem: a Meta avisou que um modelo mudou. */
  readonly aoMudarModelos?: (wabaId: string) => void;
  readonly acordarProcessador?: () => void;
}

/** Um valor de cabeçalho do Node pode ser lista; o provedor lê só o primeiro. */
function cabecalhosEmTexto(cabecalhos: Readonly<Record<string, string | string[] | undefined>>): Record<string, string | undefined> {
  const saida: Record<string, string | undefined> = {};
  for (const [nome, valor] of Object.entries(cabecalhos)) saida[nome] = Array.isArray(valor) ? valor[0] : valor;
  return saida;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}

/** Os campos da Meta que dizem que um modelo de mensagem mudou (estado, categoria). */
const CAMPOS_DE_MODELO: ReadonlySet<string> = new Set(["message_template_status_update", "template_category_update"]);

/** As contas (WABA, `entry[].id`) de um corpo que tem aviso de modelo alterado, sem repetir. Corpo fora do formato: nenhuma. */
export function contasComModeloAlterado(corpo: unknown): readonly string[] {
  const raiz = typeof corpo === "object" && corpo !== null ? (corpo as { entry?: unknown }) : undefined;
  if (!Array.isArray(raiz?.entry)) return [];
  const contas = new Set<string>();
  for (const bruta of raiz.entry) {
    const entrada = typeof bruta === "object" && bruta !== null ? (bruta as { id?: unknown; changes?: unknown }) : undefined;
    const id = typeof entrada?.id === "string" ? entrada.id : typeof entrada?.id === "number" ? String(entrada.id) : undefined;
    if (!id || !Array.isArray(entrada?.changes)) continue;
    if (entrada.changes.some((c) => typeof c === "object" && c !== null && CAMPOS_DE_MODELO.has(String((c as { field?: unknown }).field)))) contas.add(id);
  }
  return [...contas];
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

    // 7.3.2: o aviso de que um modelo mudou. Só com a assinatura conferida; a resposta nunca espera a sincronização.
    if (canal.aoMudarModelos && segredoUsado) {
      for (const wabaId of contasComModeloAlterado(corpo?.json)) {
        try {
          canal.aoMudarModelos(wabaId);
        } catch {
          // O aviso é um atalho: a rodada de hora em hora e o botão da ficha cobrem uma falha dele.
        }
      }
    }

    if (canal.enfileirar) {
      if (!segredoUsado) {
        request.log.warn({ rota: "webhook-meta", canal: canal.canal }, "evento sem assinatura conferida: não foi guardado");
        return reply.code(200).send({ ok: true });
      }
      let resultado: ResultadoDaEntradaDoInstagram | ResultadoDaEntradaDaCloudApi;
      try {
        resultado = await canal.enfileirar({
          cabecalhos: cabecalhosEmTexto(request.headers),
          corpoCru: corpo?.bruto ?? Buffer.alloc(0),
          corpo: corpo?.json ?? null,
        });
      } catch (erro) {
        // 500 faz a Meta reenviar; a fila não duplica a linha (chave = `mid`). Só o tipo do erro vai ao log.
        request.log.error({ rota: "webhook-meta", canal: canal.canal, erro: erro instanceof Error ? erro.name : "erro" }, "falha ao guardar o webhook da Meta");
        return reply.code(500).send({ ok: false, error: "Falha ao guardar o evento." });
      }
      // Só contagens: o texto e quem escreveu não vão para o log.
      request.log.info({ rota: "webhook-meta", canal: canal.canal, status: 200, segredo: segredoUsado, ...resultado }, "webhook da Meta guardado na fila");
      reply.code(200).send({ ok: true });
      if (resultado.guardadas > 0) {
        try {
          canal.acordarProcessador?.();
        } catch {
          // O acordador é um atalho: o intervalo do processador cobre uma falha dele.
        }
      }
      return reply;
    }

    // O corpo NUNCA vai ao log: tem número de telefone e texto de terceiros. Só o que diz que a chamada chegou.
    request.log.info(
      { rota: "webhook-meta", canal: canal.canal, status: 200, segredo: segredoUsado, bytes: corpo?.bruto.length ?? 0 },
      "webhook da Meta recebido (só escuta)",
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
    ...(opcoes.enfileirarWhatsApp ? { enfileirar: opcoes.enfileirarWhatsApp } : {}),
    ...(opcoes.aoMudarModelosDoWhatsApp ? { aoMudarModelos: opcoes.aoMudarModelosDoWhatsApp } : {}),
    ...(opcoes.acordarProcessador ? { acordarProcessador: opcoes.acordarProcessador } : {}),
  });
  const segredosDoInstagram = () => [
    { nome: "INSTAGRAM_APP_SECRET", valor: segredoDoInstagram() },
    { nome: "META_APP_SECRET", valor: segredoDoApp() },
  ];
  registrarWebhook(app, {
    canal: "instagram",
    caminho: CAMINHO_WEBHOOK_META_INSTAGRAM,
    variaveis: "INSTAGRAM_APP_SECRET e META_APP_SECRET",
    tokenDeVerificacao,
    segredos: segredosDoInstagram,
    ...(opcoes.enfileirarInstagram ? { enfileirar: opcoes.enfileirarInstagram } : {}),
    ...(opcoes.acordarProcessador ? { acordarProcessador: opcoes.acordarProcessador } : {}),
  });

  registrarAvisosDoInstagram(app, {
    segredos: () => segredosDoInstagram().map((s) => s.valor).filter((v): v is string => !!v),
    esquecer: opcoes.esquecerContaDoInstagram,
  });
}

/**
 * Desautorização e exclusão de dados do Instagram: a Meta manda um formulário com
 * `signed_request`. O parser de formulário fica neste plugin, como o do corpo cru.
 */
function registrarAvisosDoInstagram(
  app: FastifyInstance,
  opcoes: { readonly segredos: () => readonly string[]; readonly esquecer: ((userId: string) => Promise<number>) | undefined },
): void {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, corpo, feito) => {
    feito(null, Object.fromEntries(new URLSearchParams(corpo as string)));
  });

  /** O `user_id` de um `signed_request` válido, e o segredo que o assinou; ou a resposta de recusa já dada. */
  function conferir(request: FastifyRequest): { readonly userId: string; readonly segredo: string } | { readonly status: 400 | 503 } {
    const segredos = opcoes.segredos();
    if (segredos.length === 0 || !opcoes.esquecer) return { status: 503 };
    const corpo = (request.body ?? {}) as Record<string, unknown>;
    const assinado = typeof corpo.signed_request === "string" ? corpo.signed_request : "";
    for (const segredo of segredos) {
      const pedido = lerSignedRequest(assinado, segredo);
      if (pedido) return { userId: pedido.userId, segredo };
    }
    return { status: 400 };
  }

  app.post(CAMINHO_DESAUTORIZAR_INSTAGRAM, { config: { publica: true } }, async (request, reply) => {
    const conferido = conferir(request);
    if ("status" in conferido) {
      request.log.warn({ rota: "webhook-meta", aviso: "desautorizacao", status: conferido.status }, "aviso da Meta recusado");
      return reply.code(conferido.status).send({ ok: false, error: conferido.status === 503 ? "Indisponível." : "Pedido inválido." });
    }
    const canais = await opcoes.esquecer!(conferido.userId);
    request.log.info({ rota: "webhook-meta", aviso: "desautorizacao", canais }, "conta do Instagram desautorizada");
    return reply.code(200).send({ ok: true });
  });

  app.post(CAMINHO_EXCLUSAO_INSTAGRAM, { config: { publica: true } }, async (request, reply) => {
    const conferido = conferir(request);
    if ("status" in conferido) {
      request.log.warn({ rota: "webhook-meta", aviso: "exclusao", status: conferido.status }, "aviso da Meta recusado");
      return reply.code(conferido.status).send({ ok: false, error: conferido.status === 503 ? "Indisponível." : "Pedido inválido." });
    }
    const canais = await opcoes.esquecer!(conferido.userId);
    const codigo = codigoDeExclusao(conferido.segredo);
    request.log.info({ rota: "webhook-meta", aviso: "exclusao", canais }, "dados da conta do Instagram apagados");
    // A forma que a Meta exige: onde acompanhar e o código que ela mostra à pessoa.
    return reply.code(200).send({ url: `${request.protocol}://${request.host}${CAMINHO_EXCLUSAO_INSTAGRAM}/${codigo}`, confirmation_code: codigo });
  });

  app.get(`${CAMINHO_EXCLUSAO_INSTAGRAM}/:codigo`, { config: { publica: true } }, async (request, reply) => {
    const { codigo } = request.params as { codigo: string };
    const momento = lerCodigoDeExclusao(opcoes.segredos(), codigo);
    if (!momento) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Pedido de exclusão não encontrado. / Data deletion request not found.");
    }
    return reply
      .code(200)
      .type("text/plain; charset=utf-8")
      .send(
        `Pedido de exclusão ${codigo}, recebido em ${momento.toISOString()}: concluído. O token de acesso e o vínculo da conta do Instagram foram apagados do N1 Digital no momento do pedido.\n\n` +
          `Data deletion request ${codigo}, received at ${momento.toISOString()}: completed. The access token and the Instagram account link were deleted from N1 Digital when the request arrived.`,
      );
  });
}
