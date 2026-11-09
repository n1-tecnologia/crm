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

  return {
    async versao() {
      throw new Error("não implementado");
    },
    async buscarInstancia() {
      throw new Error("não implementado");
    },
    async estadoDaConexao() {
      throw new Error("não implementado");
    },
    async configurarWebhook() {
      throw new Error("não implementado");
    },
    async enviarMidia() {
      throw new Error("não implementado");
    },
    async enviarAudio() {
      throw new Error("não implementado");
    },
    async baixarMidia() {
      throw new Error("não implementado");
    },

    async enviarTexto(apikey, instancia, { numero, texto }) {
      const resposta = await chamar("POST", `/message/sendText/${encodeURIComponent(instancia)}`, apikey, { number: numero, text: texto });
      if (resposta.status < 200 || resposta.status >= 300) {
        // Só o 400 diz algo que decide (número sem WhatsApp); o resto do corpo é descartado sem ser lido.
        return { status: resposta.status };
      }
      const corpo = await resposta.json().catch(() => undefined);
      const idExterno = idDaRespostaDeEnvio(corpo);
      return { status: resposta.status, ...(idExterno === undefined ? {} : { idExterno }) };
    },
  };
}
