/**
 * O cliente da WhatsApp Business Platform (Cloud API), pela Graph API da Meta (Sessão 7, 7.2.2). Só HTTP: nada aqui
 * conhece banco, Canal ou Espaço de Trabalho. O molde é o do Instagram (`../instagram/cliente.ts`): o mesmo transporte
 * (`rede` é o pedido que certamente não saiu; `tempo_esgotado` e `resposta_perdida` são o pedido que pode ter chegado)
 * e a mesma regra de segredo.
 *
 * Os endereços seguem a documentação da Meta para a Cloud API, na versão fixada em `META_GRAPH_VERSAO`:
 *   - `POST /{phone-number-id}/messages`  — enviar (texto, mídia por URL, modelo) e marcar como lida;
 *   - `GET  /{media-id}`                  — o endereço temporário de uma mídia recebida (o download leva o token);
 *   - `GET  /{phone-number-id}`           — o número, o nome verificado e a situação, para conferir a conexão;
 *   - `POST /{waba-id}/subscribed_apps`   — inscreve o app na conta para os webhooks chegarem;
 *   - `GET  /{waba-id}/message_templates` — os modelos de mensagem da conta, paginado (7.3.2).
 *
 * Segredos: o token só sai daqui no cabeçalho `Authorization` do pedido à Meta. Nenhum erro lançado carrega o token nem
 * a URL: só o status e a frase curta que a Meta devolveu.
 *
 * NÃO conferido contra a Meta real (nunca houve um número conectado): os nomes dos campos seguem a documentação e os
 * testes de `cliente.test.ts` rodam contra o servidor falso. Conferir na versão fixada antes da primeira conexão.
 */

import type { ConfiguracaoDaCloudApi } from "./configuracao";

/** A falha antes de haver resposta: `rede` = o pedido nem saiu; as outras duas = pode ter chegado. */
export type FalhaDeTransporte = "rede" | "tempo_esgotado" | "resposta_perdida";

export class ErroDaCloudApi extends Error {
  constructor(
    /** O status HTTP; 0 quando não houve resposta (ver `transporte`). */
    readonly status: number,
    message: string,
    /** O `error.code` da Meta: 190 é token inválido ou vencido; 131047 é a mensagem fora da janela de 24 h. */
    readonly codigo?: number,
    /** O `error.error_subcode` da Meta. */
    readonly subcodigo?: number,
    readonly transporte?: FalhaDeTransporte,
  ) {
    super(message);
    this.name = "ErroDaCloudApi";
  }

  /** Token inválido, vencido ou revogado: o Canal precisa ser conectado de novo. */
  get tokenInvalido(): boolean {
    return this.codigo === 190;
  }
}

/** Erros de conexão que provam que o pedido nem saiu (ninguém recebeu): a mesma lista do Instagram e da Evolution. */
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

const FRASES_DO_TRANSPORTE: Record<FalhaDeTransporte, string> = {
  rede: "Não foi possível falar com o WhatsApp.",
  tempo_esgotado: "O WhatsApp não respondeu a tempo.",
  resposta_perdida: "A conexão com o WhatsApp caiu antes da resposta.",
};

/** A causa pode carregar a URL: só a frase genérica do tipo sai daqui. */
export function falhaDeTransporte(erro: unknown): ErroDaCloudApi {
  if (erro instanceof ErroDaCloudApi) return erro;
  const nome = erro instanceof Error ? erro.name : "";
  const codigo = codigoDaCausa(erro);
  const tipo: FalhaDeTransporte =
    nome === "TimeoutError" || nome === "AbortError"
      ? "tempo_esgotado"
      : codigo !== undefined && CODIGOS_DE_REDE_SEM_ENVIO.has(codigo)
        ? "rede"
        : "resposta_perdida";
  return new ErroDaCloudApi(0, FRASES_DO_TRANSPORTE[tipo], undefined, undefined, tipo);
}

/** Os tipos de arquivo que o WhatsApp oficial envia por URL (o `sticker` e a `localização` não saem pelo CRM). */
export type TipoDeMidiaDoEnvio = "image" | "audio" | "video" | "document";

export interface OpcoesDeEnvio {
  /** O id da Mensagem citada (`context.message_id`). */
  readonly emRespostaA?: string;
}

export interface DadosDoNumero {
  /** O número como a Meta o mostra, ex. `+55 11 97777-0001`: quem confere é `conferirNumeroConectado`. */
  readonly numeroExibido: string;
  readonly nomeVerificado?: string;
}

export interface MidiaNaMeta {
  /** O endereço temporário do arquivo; o download leva o token. */
  readonly url: string;
  readonly tipoDeMidia: string;
  readonly tamanhoBytes?: number;
}

/** Um modelo como a Meta o devolve em `message_templates`: só os campos que a sincronização lê. */
export interface ModeloDaMeta {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  /** `UTILITY`, `MARKETING`, `AUTHENTICATION`. */
  readonly category: string;
  /** `APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`, `IN_APPEAL`, `FLAGGED`, `PENDING_DELETION`, `DELETED`… */
  readonly status: string;
  readonly components: readonly unknown[];
  readonly rejected_reason?: string;
}

/** Quantas páginas de modelos se leem no máximo: um teto contra uma paginação que nunca acaba. */
export const MAX_DE_PAGINAS_DE_MODELOS = 20;

export interface ClienteDaCloudApi {
  enviarTexto(token: string, phoneNumberId: string, para: string, texto: string, opcoes?: OpcoesDeEnvio): Promise<{ readonly idExterno: string }>;
  enviarMidia(
    token: string,
    phoneNumberId: string,
    para: string,
    midia: { readonly tipo: TipoDeMidiaDoEnvio; readonly url: string; readonly legenda?: string; readonly nome?: string },
    opcoes?: OpcoesDeEnvio,
  ): Promise<{ readonly idExterno: string }>;
  enviarModelo(
    token: string,
    phoneNumberId: string,
    para: string,
    modelo: { readonly nome: string; readonly idioma: string; readonly variaveis: readonly string[] },
    opcoes?: OpcoesDeEnvio,
  ): Promise<{ readonly idExterno: string }>;
  marcarComoLida(token: string, phoneNumberId: string, idExterno: string): Promise<void>;
  dadosDoNumero(token: string, phoneNumberId: string): Promise<DadosDoNumero>;
  inscreverApp(token: string, wabaId: string): Promise<void>;
  lerMidia(token: string, midiaId: string): Promise<MidiaNaMeta>;
  /** Todos os modelos da conta (todas as páginas). Uma resposta fora do formato vira `ErroDaCloudApi(200)`. */
  listarModelos(token: string, wabaId: string): Promise<readonly ModeloDaMeta[]>;
}

export interface OpcoesDoCliente {
  /** Testes trocam por um servidor falso; em produção, o `fetch` do Node. */
  readonly fetch?: typeof fetch;
  readonly tempoLimiteMs?: number;
}

const TEMPO_LIMITE_PADRAO_MS = 15_000;

function texto(valor: unknown): string | undefined {
  if (typeof valor === "string" && valor.trim() !== "") return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return undefined;
}

/** A frase de erro da Meta, curta e sem quebra de linha, e os códigos que o provedor decide em cima. */
function fraseDaMeta(corpo: unknown, status: number): { readonly frase: string; readonly codigo?: number; readonly subcodigo?: number } {
  const objeto = (typeof corpo === "object" && corpo !== null ? corpo : {}) as Record<string, unknown>;
  const erro = (typeof objeto.error === "object" && objeto.error !== null ? objeto.error : objeto) as Record<string, unknown>;
  const detalhe = (typeof erro.error_data === "object" && erro.error_data !== null ? (erro.error_data as Record<string, unknown>).details : undefined);
  const bruta = texto(detalhe) ?? texto(erro.message) ?? `HTTP ${status}`;
  const codigo = typeof erro.code === "number" ? erro.code : undefined;
  const subcodigo = typeof erro.error_subcode === "number" ? erro.error_subcode : undefined;
  return {
    frase: bruta.replace(/\s+/g, " ").slice(0, 300),
    ...(codigo !== undefined ? { codigo } : {}),
    ...(subcodigo !== undefined ? { subcodigo } : {}),
  };
}

export function criarClienteDaCloudApi(config: ConfiguracaoDaCloudApi, opcoes: OpcoesDoCliente = {}): ClienteDaCloudApi {
  const buscar = opcoes.fetch ?? fetch;
  const tempoLimite = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;
  const graph = (caminho: string) => new URL(`${config.graph}/${config.versao}/${caminho}`);

  async function pedir(url: URL, init: RequestInit): Promise<Record<string, unknown>> {
    let resposta: Response;
    try {
      resposta = await buscar(url, { ...init, signal: AbortSignal.timeout(tempoLimite) });
    } catch (erro) {
      throw falhaDeTransporte(erro);
    }
    let bruto: string;
    try {
      bruto = await resposta.text();
    } catch (erro) {
      throw falhaDeTransporte(erro);
    }
    let corpo: unknown = undefined;
    try {
      corpo = bruto === "" ? undefined : JSON.parse(bruto);
    } catch {
      corpo = undefined;
    }
    if (!resposta.ok) {
      const { frase, codigo, subcodigo } = fraseDaMeta(corpo, resposta.status);
      throw new ErroDaCloudApi(resposta.status, frase, codigo, subcodigo);
    }
    if (typeof corpo !== "object" || corpo === null) throw new ErroDaCloudApi(resposta.status, "O WhatsApp respondeu num formato inesperado.");
    return corpo as Record<string, unknown>;
  }

  const comToken = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

  /**
   * `POST /{phone-number-id}/messages`. Aceito sem `messages[0].id` é `ErroDaCloudApi(200)`: saiu, mas sem como
   * acompanhar. Quem chama trata como ambíguo e nunca reenvia.
   */
  async function enviar(token: string, phoneNumberId: string, mensagem: Record<string, unknown>, opcoesDeEnvio?: OpcoesDeEnvio) {
    const corpo = await pedir(graph(`${encodeURIComponent(phoneNumberId)}/messages`), {
      method: "POST",
      headers: { ...comToken(token), "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        ...mensagem,
        ...(opcoesDeEnvio?.emRespostaA ? { context: { message_id: opcoesDeEnvio.emRespostaA } } : {}),
      }),
    });
    const mensagens = Array.isArray(corpo.messages) ? corpo.messages : [];
    const idExterno = texto((mensagens[0] as Record<string, unknown> | undefined)?.id);
    if (!idExterno) throw new ErroDaCloudApi(200, "O WhatsApp não devolveu o id da mensagem enviada.");
    return { idExterno };
  }

  return {
    enviarTexto(token, phoneNumberId, para, conteudo, opcoesDeEnvio) {
      return enviar(token, phoneNumberId, { to: para, type: "text", text: { body: conteudo, preview_url: false } }, opcoesDeEnvio);
    },

    enviarMidia(token, phoneNumberId, para, midia, opcoesDeEnvio) {
      // O áudio não leva legenda; o documento leva o nome do arquivo.
      const carga: Record<string, unknown> = { link: midia.url };
      if (midia.legenda && midia.tipo !== "audio") carga.caption = midia.legenda;
      if (midia.nome && midia.tipo === "document") carga.filename = midia.nome;
      return enviar(token, phoneNumberId, { to: para, type: midia.tipo, [midia.tipo]: carga }, opcoesDeEnvio);
    },

    enviarModelo(token, phoneNumberId, para, modelo, opcoesDeEnvio) {
      const componentes =
        modelo.variaveis.length > 0
          ? [{ type: "body", parameters: modelo.variaveis.map((valor) => ({ type: "text", text: valor })) }]
          : [];
      return enviar(
        token,
        phoneNumberId,
        {
          to: para,
          type: "template",
          template: { name: modelo.nome, language: { code: modelo.idioma }, ...(componentes.length > 0 ? { components: componentes } : {}) },
        },
        opcoesDeEnvio,
      );
    },

    async marcarComoLida(token, phoneNumberId, idExterno) {
      const corpo = await pedir(graph(`${encodeURIComponent(phoneNumberId)}/messages`), {
        method: "POST",
        headers: { ...comToken(token), "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: idExterno }),
      });
      if (corpo.success !== true) throw new ErroDaCloudApi(200, "O WhatsApp não confirmou a leitura.");
    },

    async dadosDoNumero(token, phoneNumberId) {
      const url = graph(encodeURIComponent(phoneNumberId));
      url.searchParams.set("fields", "display_phone_number,verified_name");
      const corpo = await pedir(url, { method: "GET", headers: comToken(token) });
      const numeroExibido = texto(corpo.display_phone_number);
      if (!numeroExibido) throw new ErroDaCloudApi(200, "O WhatsApp não devolveu o número deste identificador.");
      const nomeVerificado = texto(corpo.verified_name);
      return { numeroExibido, ...(nomeVerificado ? { nomeVerificado } : {}) };
    },

    async inscreverApp(token, wabaId) {
      const corpo = await pedir(graph(`${encodeURIComponent(wabaId)}/subscribed_apps`), { method: "POST", headers: comToken(token) });
      if (corpo.success !== true) throw new ErroDaCloudApi(200, "O WhatsApp não confirmou a inscrição do app na conta.");
    },

    async lerMidia(token, midiaId) {
      const corpo = await pedir(graph(encodeURIComponent(midiaId)), { method: "GET", headers: comToken(token) });
      const url = texto(corpo.url);
      const tipoDeMidia = texto(corpo.mime_type);
      if (!url || !tipoDeMidia) throw new ErroDaCloudApi(200, "O WhatsApp não devolveu o endereço da mídia.");
      const tamanho = typeof corpo.file_size === "number" && Number.isFinite(corpo.file_size) ? corpo.file_size : undefined;
      return { url, tipoDeMidia, ...(tamanho !== undefined ? { tamanhoBytes: tamanho } : {}) };
    },

    async listarModelos(token, wabaId) {
      const modelos: ModeloDaMeta[] = [];
      let url: URL | undefined = graph(`${encodeURIComponent(wabaId)}/message_templates`);
      url.searchParams.set("fields", "id,name,language,category,status,components,rejected_reason");
      url.searchParams.set("limit", "100");
      const origem = new URL(config.graph).origin;
      for (let pagina = 0; url !== undefined; pagina += 1) {
        if (pagina >= MAX_DE_PAGINAS_DE_MODELOS) throw new ErroDaCloudApi(200, "A lista de modelos do WhatsApp não acabou depois de muitas páginas.");
        const corpo = await pedir(url, { method: "GET", headers: comToken(token) });
        if (!Array.isArray(corpo.data)) throw new ErroDaCloudApi(200, "O WhatsApp não devolveu a lista de modelos.");
        for (const bruto of corpo.data) {
          const m = typeof bruto === "object" && bruto !== null ? (bruto as Record<string, unknown>) : undefined;
          const id = texto(m?.id);
          const nome = texto(m?.name);
          const idioma = texto(m?.language);
          const categoria = texto(m?.category);
          const estado = texto(m?.status);
          // Um item sem o que identifica o modelo não entra: melhor uma lista curta do que um modelo que não se envia.
          if (!id || !nome || !idioma || !categoria || !estado) continue;
          const motivo = texto(m?.rejected_reason);
          modelos.push({
            id,
            name: nome,
            language: idioma,
            category: categoria,
            status: estado,
            components: Array.isArray(m?.components) ? m.components : [],
            ...(motivo ? { rejected_reason: motivo } : {}),
          });
        }
        // A próxima página vem como URL completa. Só se segue no host da Graph: o token vai no cabeçalho do pedido, e uma
        // URL de outro host (vinda do corpo da Meta) nunca o recebe.
        const proxima: unknown = (corpo.paging as { next?: unknown } | undefined)?.next;
        if (typeof proxima !== "string" || proxima === "") break;
        let seguinte: URL;
        try {
          seguinte = new URL(proxima);
        } catch {
          throw new ErroDaCloudApi(200, "O WhatsApp devolveu uma página de modelos inválida.");
        }
        if (seguinte.origin !== origem) throw new ErroDaCloudApi(200, "O WhatsApp devolveu uma página de modelos de outro endereço.");
        url = seguinte;
      }
      return modelos;
    },
  };
}
