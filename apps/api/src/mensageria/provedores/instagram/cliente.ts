/**
 * O cliente da API do Instagram com login do Instagram (Sessão 8, decisão 8.2.1 (A):
 * a pessoa entra com a conta profissional, sem Página do Facebook). Só HTTP: nada
 * aqui conhece banco, Canal ou Espaço de Trabalho.
 *
 * Os endereços e as respostas seguem a documentação da Meta para "Instagram API
 * with Instagram Login". Os três hosts:
 *   - `www.instagram.com/oauth/authorize` — a janela de login (o navegador vai lá);
 *   - `api.instagram.com/oauth/access_token` — troca o código pelo token curto;
 *   - `graph.instagram.com` — token de longa duração, renovação, conta, inscrição
 *     no webhook, envio e perfil de quem escreveu.
 *
 * Segredos: o token só sai daqui no corpo ou no cabeçalho do pedido à Meta. Nenhum
 * erro lançado carrega o token, o segredo do app ou a URL com `access_token`: só o
 * status e a frase que a Meta devolveu.
 *
 * O transporte (`ErroDoInstagram.transporte`) separa o que o envio do outbox precisa
 * saber, no molde do cliente da Evolution: `rede` é o pedido que certamente não saiu
 * (conexão recusada, DNS), `tempo_esgotado` e `resposta_perdida` são o pedido que pode
 * ter chegado. Só o primeiro pode ser tentado de novo sem risco de duplicar.
 */

import type { ConfiguracaoDoInstagram } from "./configuracao";

/** As duas permissões pedidas na Revisão do app (o PDF de 23/10). */
export const PERMISSOES_DO_INSTAGRAM = ["instagram_business_basic", "instagram_business_manage_messages"] as const;

/** A falha antes de haver resposta: `rede` = o pedido nem saiu; as outras duas = pode ter chegado. */
export type FalhaDeTransporte = "rede" | "tempo_esgotado" | "resposta_perdida";

export class ErroDoInstagram extends Error {
  constructor(
    /** O status HTTP; 0 quando não houve resposta (ver `transporte`). */
    readonly status: number,
    message: string,
    /** O `error.code` da Meta: 190 é token inválido ou vencido. */
    readonly codigo?: number,
    /** O `error.error_subcode` da Meta: 2018278 é a resposta fora da janela de 24 h. */
    readonly subcodigo?: number,
    readonly transporte?: FalhaDeTransporte,
  ) {
    super(message);
    this.name = "ErroDoInstagram";
  }

  /** Token inválido, vencido ou revogado: o Canal precisa ser conectado de novo. */
  get tokenInvalido(): boolean {
    return this.codigo === 190;
  }
}

/**
 * Erros de conexão que provam que o pedido nem saiu (ninguém recebeu): a mesma lista do cliente da Evolution.
 * Qualquer outra falha depois de o pedido ter ido é "resposta perdida".
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

const FRASES_DO_TRANSPORTE: Record<FalhaDeTransporte, string> = {
  rede: "Não foi possível falar com o Instagram.",
  tempo_esgotado: "O Instagram não respondeu a tempo.",
  resposta_perdida: "A conexão com o Instagram caiu antes da resposta.",
};

/** A causa pode carregar a URL (com o token): só a frase genérica do tipo sai daqui. */
export function falhaDeTransporte(erro: unknown): ErroDoInstagram {
  if (erro instanceof ErroDoInstagram) return erro;
  const nome = erro instanceof Error ? erro.name : "";
  const codigo = codigoDaCausa(erro);
  const tipo: FalhaDeTransporte =
    nome === "TimeoutError" || nome === "AbortError"
      ? "tempo_esgotado"
      : codigo !== undefined && CODIGOS_DE_REDE_SEM_ENVIO.has(codigo)
        ? "rede"
        : "resposta_perdida";
  return new ErroDoInstagram(0, FRASES_DO_TRANSPORTE[tipo], undefined, undefined, tipo);
}

/** O anexo que o Direct manda por URL: a Meta baixa o arquivo do endereço (a URL assinada do bucket). */
export type TipoDeAnexoDoDirect = "image" | "video" | "audio";

export interface TokenCurto {
  readonly token: string;
  /** O `user_id` que o login devolve: é o id que a desautorização da Meta traz. */
  readonly idNoApp: string;
  readonly permissoes: readonly string[];
}

export interface TokenLongo {
  readonly token: string;
  /** ISO 8601. A Meta dá cerca de 60 dias. */
  readonly expiraEm: string;
}

export interface ContaDoInstagramNaMeta {
  /** O id da conta profissional: o `entry[].id` do webhook. */
  readonly contaId: string;
  readonly usuario: string;
  readonly nome?: string;
  readonly fotoUrl?: string;
}

export interface PerfilDoRemetente {
  readonly usuario?: string;
  readonly nome?: string;
  readonly fotoUrl?: string;
}

export interface ClienteDoInstagram {
  urlDeAutorizacao(state: string): string;
  trocarCodigo(codigo: string): Promise<TokenCurto>;
  tokenDeLongaDuracao(tokenCurto: string): Promise<TokenLongo>;
  renovarToken(token: string): Promise<TokenLongo>;
  lerConta(token: string): Promise<ContaDoInstagramNaMeta>;
  inscreverNasMensagens(token: string): Promise<void>;
  enviarTexto(token: string, contaId: string, igsid: string, texto: string): Promise<{ readonly idExterno: string }>;
  enviarAnexo(token: string, contaId: string, igsid: string, anexo: { readonly tipo: TipoDeAnexoDoDirect; readonly url: string }): Promise<{ readonly idExterno: string }>;
  lerRemetente(token: string, igsid: string): Promise<PerfilDoRemetente>;
}

export interface OpcoesDoCliente {
  /** Testes trocam por um servidor falso; em produção, o `fetch` do Node. */
  readonly fetch?: typeof fetch;
  readonly tempoLimiteMs?: number;
  /** Para calcular o vencimento do token; testes fixam o relógio. */
  readonly agora?: () => number;
}

const TEMPO_LIMITE_PADRAO_MS = 15_000;

function texto(valor: unknown): string | undefined {
  if (typeof valor === "string" && valor.trim() !== "") return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return undefined;
}

/** A frase de erro da Meta, nos dois formatos que ela usa, curta e sem quebra de linha. */
function fraseDaMeta(corpo: unknown, status: number): { readonly frase: string; readonly codigo?: number; readonly subcodigo?: number } {
  const objeto = (typeof corpo === "object" && corpo !== null ? corpo : {}) as Record<string, unknown>;
  const erro = (typeof objeto.error === "object" && objeto.error !== null ? objeto.error : objeto) as Record<string, unknown>;
  const bruta = texto(erro.message) ?? texto(erro.error_message) ?? texto(objeto.error_description) ?? `HTTP ${status}`;
  const codigo = typeof erro.code === "number" ? erro.code : undefined;
  const subcodigo = typeof erro.error_subcode === "number" ? erro.error_subcode : undefined;
  return {
    frase: bruta.replace(/\s+/g, " ").slice(0, 300),
    ...(codigo !== undefined ? { codigo } : {}),
    ...(subcodigo !== undefined ? { subcodigo } : {}),
  };
}

export function criarClienteDoInstagram(config: ConfiguracaoDoInstagram, opcoes: OpcoesDoCliente = {}): ClienteDoInstagram {
  const buscar = opcoes.fetch ?? fetch;
  const tempoLimite = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;
  const agora = opcoes.agora ?? Date.now;
  const graph = (caminho: string) => new URL(`${config.enderecos.graph}/${config.versao}/${caminho}`);

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
      throw new ErroDoInstagram(resposta.status, frase, codigo, subcodigo);
    }
    if (typeof corpo !== "object" || corpo === null) throw new ErroDoInstagram(resposta.status, "O Instagram respondeu num formato inesperado.");
    return corpo as Record<string, unknown>;
  }

  const comToken = (token: string): RequestInit["headers"] => ({ authorization: `Bearer ${token}` });

  /** Um Direct: `POST /{conta}/messages`. Aceito sem `message_id` é `ErroDoInstagram(200)`: saiu, mas sem como acompanhar. */
  async function enviarMensagem(token: string, contaId: string, igsid: string, mensagem: unknown): Promise<{ readonly idExterno: string }> {
    const corpo = await pedir(graph(`${encodeURIComponent(contaId)}/messages`), {
      method: "POST",
      headers: { ...comToken(token), "content-type": "application/json" },
      body: JSON.stringify({ recipient: { id: igsid }, message: mensagem }),
    });
    const idExterno = texto(corpo.message_id);
    if (!idExterno) throw new ErroDoInstagram(200, "O Instagram não devolveu o id da mensagem enviada.");
    return { idExterno };
  }

  function tokenLongo(corpo: Record<string, unknown>): TokenLongo {
    const token = texto(corpo.access_token);
    const segundos = typeof corpo.expires_in === "number" ? corpo.expires_in : undefined;
    if (!token || segundos === undefined) throw new ErroDoInstagram(200, "O Instagram não devolveu o token de longa duração.");
    return { token, expiraEm: new Date(agora() + segundos * 1000).toISOString() };
  }

  return {
    urlDeAutorizacao(state) {
      const url = new URL(config.enderecos.autorizar);
      url.searchParams.set("client_id", config.appId);
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", PERMISSOES_DO_INSTAGRAM.join(","));
      url.searchParams.set("state", state);
      // Sem o atalho de login pelo Facebook: a decisão 8.2.1 é o login do Instagram.
      url.searchParams.set("enable_fb_login", "0");
      // Sempre pede a conta: quem já está logado com outra conta escolhe a certa.
      url.searchParams.set("force_reauth", "true");
      return url.toString();
    },

    async trocarCodigo(codigo) {
      const url = new URL(`${config.enderecos.api}/oauth/access_token`);
      const corpo = await pedir(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.appId,
          client_secret: config.appSecret,
          grant_type: "authorization_code",
          redirect_uri: config.redirectUri,
          code: codigo,
        }).toString(),
      });
      // A Meta devolve `{ data: [ { access_token, user_id, permissions } ] }` ou, no formato antigo, os campos soltos.
      const item = (Array.isArray(corpo.data) ? corpo.data[0] : corpo) as Record<string, unknown> | undefined;
      const token = texto(item?.access_token);
      const idNoApp = texto(item?.user_id);
      if (!token || !idNoApp) throw new ErroDoInstagram(200, "O Instagram não devolveu o token da autorização.");
      const permissoesBrutas = item?.permissions;
      const permissoes = Array.isArray(permissoesBrutas)
        ? permissoesBrutas.map(String)
        : typeof permissoesBrutas === "string"
          ? permissoesBrutas.split(",").map((p) => p.trim()).filter(Boolean)
          : [];
      return { token, idNoApp, permissoes };
    },

    async tokenDeLongaDuracao(tokenCurto) {
      const url = new URL(`${config.enderecos.graph}/access_token`);
      url.searchParams.set("grant_type", "ig_exchange_token");
      url.searchParams.set("client_secret", config.appSecret);
      url.searchParams.set("access_token", tokenCurto);
      return tokenLongo(await pedir(url, { method: "GET" }));
    },

    async renovarToken(token) {
      const url = new URL(`${config.enderecos.graph}/refresh_access_token`);
      url.searchParams.set("grant_type", "ig_refresh_token");
      url.searchParams.set("access_token", token);
      return tokenLongo(await pedir(url, { method: "GET" }));
    },

    async lerConta(token) {
      const url = graph("me");
      url.searchParams.set("fields", "user_id,username,name,profile_picture_url");
      const corpo = await pedir(url, { method: "GET", headers: comToken(token) });
      const contaId = texto(corpo.user_id) ?? texto(corpo.id);
      const usuario = texto(corpo.username);
      if (!contaId || !usuario) throw new ErroDoInstagram(200, "O Instagram não devolveu a conta autorizada.");
      const nome = texto(corpo.name);
      const fotoUrl = texto(corpo.profile_picture_url);
      return { contaId, usuario, ...(nome ? { nome } : {}), ...(fotoUrl ? { fotoUrl } : {}) };
    },

    async inscreverNasMensagens(token) {
      const url = graph("me/subscribed_apps");
      url.searchParams.set("subscribed_fields", "messages");
      const corpo = await pedir(url, { method: "POST", headers: comToken(token) });
      if (corpo.success !== true) throw new ErroDoInstagram(200, "O Instagram não confirmou a inscrição da conta no webhook de mensagens.");
    },

    async enviarTexto(token, contaId, igsid, conteudo) {
      return enviarMensagem(token, contaId, igsid, { text: conteudo });
    },

    async enviarAnexo(token, contaId, igsid, anexo) {
      return enviarMensagem(token, contaId, igsid, { attachment: { type: anexo.tipo, payload: { url: anexo.url } } });
    },

    async lerRemetente(token, igsid) {
      const url = graph(encodeURIComponent(igsid));
      url.searchParams.set("fields", "name,username,profile_pic");
      const corpo = await pedir(url, { method: "GET", headers: comToken(token) });
      const usuario = texto(corpo.username);
      const nome = texto(corpo.name);
      const fotoUrl = texto(corpo.profile_pic);
      return { ...(usuario ? { usuario } : {}), ...(nome ? { nome } : {}), ...(fotoUrl ? { fotoUrl } : {}) };
    },
  };
}
