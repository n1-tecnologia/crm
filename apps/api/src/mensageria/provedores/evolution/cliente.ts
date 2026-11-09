/**
 * O cliente HTTP da Evolution API v2.3.7 (16-12, D-16-04, MSG-06): só `fetch`, nenhum SDK. Toda chamada leva o
 * cabeçalho `apikey` e `AbortSignal.timeout`; o host é sempre `EVOLUTION_URL` (fixo, nunca uma URL do corpo de um
 * webhook: sem SSRF).
 *
 * Duas regras que valem para o arquivo inteiro:
 *   - o `ErroDaEvolution` nunca carrega a `apikey`, o corpo da resposta nem o do pedido: a mensagem é uma frase fixa e
 *     o que o chamador precisa vem em `tipo` e `status`. A resposta de erro da Evolution ecoa cabeçalhos e números, então
 *     o corpo de um erro só é lido onde a decisão depende dele (o 400 de "número sem WhatsApp") e nunca é guardado;
 *   - nenhuma chamada manda `delay`: ele simularia digitação e alongaria a resposta que o tempo limite mede.
 *
 * As funções de envio devolvem a `RespostaDaEvolution` de QUALQUER status HTTP (quem decide se é permanente, transitório
 * ou ambíguo é o provedor, `provedor.ts`) e só lançam quando a chamada nem chegou a ter resposta (`rede`,
 * `tempo_esgotado`, `resposta_perdida`). As demais funções lançam também o status HTTP que não é 2xx.
 */

import { normalizarTipoDeMidia } from "@n1/dominio/crm/midia";
import { ErroDeProvedor } from "../../provedor";

export type TipoDeErroDaEvolution = "rede" | "tempo_esgotado" | "resposta_perdida" | "http";

export class ErroDaEvolution extends Error {
  readonly tipo: TipoDeErroDaEvolution;
  readonly status?: number;

  constructor(tipo: TipoDeErroDaEvolution, status?: number) {
    super(FRASES[tipo]);
    this.name = "ErroDaEvolution";
    this.tipo = tipo;
    if (status !== undefined) this.status = status;
  }
}

const FRASES: Record<TipoDeErroDaEvolution, string> = {
  rede: "Não foi possível falar com a Evolution.",
  tempo_esgotado: "A Evolution não respondeu a tempo.",
  resposta_perdida: "A conexão com a Evolution caiu antes da resposta.",
  http: "A Evolution recusou a chamada.",
};

/** O que sobra de uma resposta de envio: o status, o id da Mensagem enviada e se o número não tem WhatsApp. */
export interface RespostaDaEvolution {
  readonly status: number;
  readonly idExterno?: string;
  readonly semWhatsapp?: boolean;
}

export interface OpcoesDoClienteDaEvolution {
  readonly url: string;
  readonly fetchImpl?: typeof fetch;
  /** Padrão 15 s. */
  readonly timeoutMs?: number;
}

export const TIMEOUT_PADRAO_DA_EVOLUTION_MS = 15_000;

/** A folga do envelope JSON (`mimetype`, `fileName`, `mediaType`...) em volta do base64 que o corte de `baixarMidia` soma ao teto. */
const MARGEM_DO_JSON_BYTES = 64 * 1024;

/**
 * Erros de conexão que provam que o pedido nem saiu (ninguém recebeu): a chamada pode ser tentada de novo sem risco
 * de duplicar. Qualquer outra falha depois de o pedido ter ido é "resposta perdida".
 */
const CODIGOS_DE_REDE_SEM_ENVIO: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "ERR_INVALID_URL",
]);

function codigoDaCausa(erro: unknown): string | undefined {
  let atual: unknown = erro;
  for (let i = 0; i < 4 && typeof atual === "object" && atual !== null; i += 1) {
    const codigo = (atual as { code?: unknown }).code;
    if (typeof codigo === "string") return codigo;
    atual = (atual as { cause?: unknown }).cause;
  }
  return undefined;
}

function classificarFalhaDeTransporte(erro: unknown): ErroDaEvolution {
  if (erro instanceof ErroDaEvolution) return erro;
  const nome = erro instanceof Error ? erro.name : "";
  if (nome === "TimeoutError" || nome === "AbortError") return new ErroDaEvolution("tempo_esgotado");
  const codigo = codigoDaCausa(erro);
  if (codigo !== undefined && CODIGOS_DE_REDE_SEM_ENVIO.has(codigo)) return new ErroDaEvolution("rede");
  // `fetch failed` sem causa conhecida, ECONNRESET, `other side closed`: o pedido pode ter chegado.
  return new ErroDaEvolution("resposta_perdida");
}

type Metodo = "GET" | "POST";

/** A mídia de `getBase64FromMediaMessage`, já em bytes. */
export interface MidiaDaEvolution {
  readonly bytes: Uint8Array;
  /** Normalizado (`audio/ogg; codecs=opus` → `audio/ogg`). */
  readonly mimetype: string;
  readonly fileName?: string;
}

export interface InstanciaDaEvolution {
  readonly ownerJid: string | null;
  readonly token: string | null;
  readonly connectionStatus: string;
}

export type EstadoDaConexaoDaEvolution = "open" | "close" | "connecting";

export interface ClienteDaEvolution {
  versao(apikeyGlobal: string): Promise<string>;
  buscarInstancia(apikeyGlobal: string, nome: string): Promise<InstanciaDaEvolution | undefined>;
  estadoDaConexao(apikey: string, instancia: string): Promise<EstadoDaConexaoDaEvolution>;
  configurarWebhook(apikey: string, instancia: string, webhook: { readonly url: string; readonly segredo: string }): Promise<void>;
  enviarTexto(apikey: string, instancia: string, envio: { readonly numero: string; readonly texto: string }): Promise<RespostaDaEvolution>;
  enviarMidia(
    apikey: string,
    instancia: string,
    envio: {
      readonly numero: string;
      readonly mediatype: "image" | "video" | "document";
      readonly media: string;
      readonly mimetype: string;
      readonly fileName: string;
      readonly caption?: string;
    },
  ): Promise<RespostaDaEvolution>;
  enviarAudio(apikey: string, instancia: string, envio: { readonly numero: string; readonly audio: string }): Promise<RespostaDaEvolution>;
  baixarMidia(apikey: string, instancia: string, pedido: { readonly message: unknown; readonly tetoBytes: number }): Promise<MidiaDaEvolution>;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** O 400 de `sendMessageWithTyping` quando o número não está no WhatsApp: algum item com `exists: false`. */
function numeroSemWhatsapp(corpo: unknown, profundidade = 0): boolean {
  if (profundidade > 5) return false;
  if (Array.isArray(corpo)) return corpo.some((item) => numeroSemWhatsapp(item, profundidade + 1));
  if (!ehObjeto(corpo)) return false;
  if (corpo.exists === false) return true;
  return Object.values(corpo).some((valor) => numeroSemWhatsapp(valor, profundidade + 1));
}

/** O `key.id` da mensagem que a Evolution devolve num envio aceito. */
export function idDaRespostaDeEnvio(corpo: unknown): string | undefined {
  if (!ehObjeto(corpo) || !ehObjeto(corpo.key)) return undefined;
  const id = corpo.key.id;
  return typeof id === "string" && id !== "" ? id : undefined;
}

export function criarClienteDaEvolution(opcoes: OpcoesDoClienteDaEvolution): ClienteDaEvolution {
  const base = opcoes.url.replace(/\/+$/, "");
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const timeoutMs = opcoes.timeoutMs ?? TIMEOUT_PADRAO_DA_EVOLUTION_MS;

  /** Uma chamada: a Response, ou `ErroDaEvolution` de transporte. Nunca lança o status HTTP. */
  async function chamar(metodo: Metodo, caminho: string, apikey: string, corpo?: unknown): Promise<Response> {
    try {
      return await fetchImpl(`${base}${caminho}`, {
        method: metodo,
        headers: { apikey, ...(corpo === undefined ? {} : { "content-type": "application/json" }) },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (erro) {
      throw classificarFalhaDeTransporte(erro);
    }
  }

  /** Solta a conexão de uma resposta cujo corpo não interessa. */
  async function descartar(resposta: Response): Promise<void> {
    await resposta.body?.cancel().catch(() => undefined);
  }

  /** O JSON de uma resposta 2xx; qualquer outro status lança `http`; falha ao ler o corpo é falha de transporte. */
  async function lerJson(metodo: Metodo, caminho: string, apikey: string, corpo?: unknown): Promise<unknown> {
    const resposta = await chamar(metodo, caminho, apikey, corpo);
    if (resposta.status < 200 || resposta.status >= 300) {
      await descartar(resposta);
      throw new ErroDaEvolution("http", resposta.status);
    }
    try {
      return await resposta.json();
    } catch (erro) {
      throw classificarFalhaDeTransporte(erro);
    }
  }

  /** Um envio: a `RespostaDaEvolution` de qualquer status. Só o 400 tem o corpo lido (para saber se o número não tem WhatsApp). */
  async function enviar(caminho: string, apikey: string, corpo: unknown): Promise<RespostaDaEvolution> {
    const resposta = await chamar("POST", caminho, apikey, corpo);
    const { status } = resposta;
    if (status >= 200 && status < 300) {
      const lido = await resposta.json().catch(() => undefined);
      const idExterno = idDaRespostaDeEnvio(lido);
      return { status, ...(idExterno === undefined ? {} : { idExterno }) };
    }
    if (status === 400) {
      const lido = await resposta.json().catch(() => undefined);
      return { status, ...(numeroSemWhatsapp(lido) ? { semWhatsapp: true } : {}) };
    }
    await descartar(resposta);
    return { status };
  }

  return {
    async versao(apikeyGlobal) {
      const corpo = await lerJson("GET", "/", apikeyGlobal);
      return ehObjeto(corpo) && typeof corpo.version === "string" ? corpo.version : "desconhecida";
    },

    async buscarInstancia(apikeyGlobal, nome) {
      let corpo: unknown;
      try {
        corpo = await lerJson("GET", `/instance/fetchInstances?instanceName=${encodeURIComponent(nome)}`, apikeyGlobal);
      } catch (erro) {
        if (erro instanceof ErroDaEvolution && erro.tipo === "http" && erro.status === 404) return undefined;
        throw erro;
      }
      const lista = Array.isArray(corpo) ? corpo : [corpo];
      for (const item of lista) {
        const linha = ehObjeto(item) && ehObjeto(item.instance) ? item.instance : item;
        if (!ehObjeto(linha)) continue;
        const nomeDaLinha = typeof linha.name === "string" ? linha.name : typeof linha.instanceName === "string" ? linha.instanceName : undefined;
        if (nomeDaLinha !== undefined && nomeDaLinha !== nome) continue;
        return {
          ownerJid: typeof linha.ownerJid === "string" && linha.ownerJid !== "" ? linha.ownerJid : null,
          token: typeof linha.token === "string" && linha.token !== "" ? linha.token : null,
          connectionStatus: typeof linha.connectionStatus === "string" ? linha.connectionStatus : "close",
        };
      }
      return undefined;
    },

    async estadoDaConexao(apikey, instancia) {
      const corpo = await lerJson("GET", `/instance/connectionState/${encodeURIComponent(instancia)}`, apikey);
      const estado = ehObjeto(corpo) && ehObjeto(corpo.instance) ? corpo.instance.state : undefined;
      return estado === "open" || estado === "connecting" ? estado : "close";
    },

    async configurarWebhook(apikey, instancia, { url, segredo }) {
      await lerJson("POST", `/webhook/set/${encodeURIComponent(instancia)}`, apikey, {
        webhook: {
          enabled: true,
          url,
          headers: { "x-n1-webhook-segredo": segredo },
          byEvents: false,
          base64: false,
          events: ["MESSAGES_UPSERT"],
        },
      });
    },

    enviarTexto(apikey, instancia, { numero, texto }) {
      return enviar(`/message/sendText/${encodeURIComponent(instancia)}`, apikey, { number: numero, text: texto });
    },

    enviarMidia(apikey, instancia, { numero, mediatype, media, mimetype, fileName, caption }) {
      return enviar(`/message/sendMedia/${encodeURIComponent(instancia)}`, apikey, {
        number: numero,
        mediatype,
        media,
        mimetype,
        fileName,
        ...(caption === undefined || caption === "" ? {} : { caption }),
      });
    },

    enviarAudio(apikey, instancia, { numero, audio }) {
      return enviar(`/message/sendWhatsAppAudio/${encodeURIComponent(instancia)}`, apikey, { number: numero, audio });
    },

    async baixarMidia(apikey, instancia, { message, tetoBytes }) {
      // Sem conversão para mp4: o ffmpeg estouraria o orçamento de 2 s da prova, e o áudio sai como a Evolution o tem.
      const resposta = await chamar("POST", `/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, apikey, { message, convertToMp4: false });
      if (resposta.status < 200 || resposta.status >= 300) {
        await descartar(resposta);
        throw new ErroDaEvolution("http", resposta.status);
      }
      if (!resposta.body) throw new ErroDeProvedor("MIDIA_INDISPONIVEL", "A Evolution não devolveu a mídia.");

      // O base64 é 4/3 do arquivo: lê em fluxo e corta acima do teto do tipo + a margem do JSON em volta (T-16-46).
      const limite = Math.ceil((tetoBytes * 4) / 3) + MARGEM_DO_JSON_BYTES;
      const leitor = resposta.body.getReader();
      const pedacos: Uint8Array[] = [];
      let total = 0;
      try {
        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;
          total += value.byteLength;
          if (total > limite) {
            await leitor.cancel().catch(() => undefined);
            throw new ErroDeProvedor("MIDIA_GRANDE_DEMAIS", "A mídia passa do teto de tamanho.");
          }
          pedacos.push(value);
        }
      } catch (erro) {
        if (erro instanceof ErroDeProvedor) throw erro;
        throw classificarFalhaDeTransporte(erro);
      }

      let lido: unknown;
      try {
        lido = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
      } catch {
        throw new ErroDeProvedor("MIDIA_INDISPONIVEL", "A Evolution devolveu a mídia num formato que não se lê.");
      }
      const base64 = ehObjeto(lido) && typeof lido.base64 === "string" ? lido.base64.replace(/\s+/g, "") : "";
      if (base64 === "" || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        throw new ErroDeProvedor("MIDIA_INDISPONIVEL", "A Evolution devolveu a mídia num formato que não se lê.");
      }
      const bytes = Buffer.from(base64, "base64");
      if (bytes.toString("base64") !== base64) throw new ErroDeProvedor("MIDIA_INDISPONIVEL", "A Evolution devolveu a mídia num formato que não se lê.");
      if (bytes.byteLength > tetoBytes) throw new ErroDeProvedor("MIDIA_GRANDE_DEMAIS", "A mídia passa do teto de tamanho.");

      const mimetype = normalizarTipoDeMidia(ehObjeto(lido) && typeof lido.mimetype === "string" ? lido.mimetype : "");
      const fileName = ehObjeto(lido) && typeof lido.fileName === "string" && lido.fileName !== "" ? lido.fileName : undefined;
      return {
        bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        mimetype: mimetype === "" ? "application/octet-stream" : mimetype,
        ...(fileName === undefined ? {} : { fileName }),
      };
    },
  };
}
