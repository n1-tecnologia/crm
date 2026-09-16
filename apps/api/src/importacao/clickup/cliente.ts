/**
 * Cliente HTTP fino sobre o `fetch` nativo para a API do ClickUp v2 (D-01,
 * PREP-02). Não é um SDK: cobre só os ~6 endpoints que o exportador (Plan
 * 00-03) precisa, sem tipar as ~130 rotas do ClickUp — D-03 pede o JSON bruto
 * sem transformar, e um SDK de terceiros tende a desserializar para um
 * formato próprio (RESEARCH.md "Alternatives Considered").
 *
 * Auth: token pessoal vai no header `Authorization` SEM o prefixo `Bearer` —
 * esse prefixo é só para OAuth2 (developer.clickup.com/docs/authentication).
 * Um erro aqui não falha claramente: a API devolve 401 genérico, não uma
 * mensagem específica sobre o formato do header.
 *
 * Rate limit: 100 requisições/minuto por token. O backoff é só em 429, pelo
 * timestamp exato de `X-RateLimit-Reset` — não é retry genérico (RESEARCH.md
 * "Don't Hand-Roll": uma lib de retry com jitter configurável resolveria um
 * problema que não existe aqui). O pacing complementar por
 * `X-RateLimit-Remaining` evita bater no 429 quando dá para prever.
 *
 * Nunca loga: este cliente não chama `console.*`. Quem loga é o CLI (Plan
 * 00-03), e só caminho/status — o token não pode aparecer em log, em
 * mensagem de erro nem em fixture de teste (T-0-01).
 */

export const BASE_URL = "https://api.clickup.com/api/v2";
export const TETO_DE_TENTATIVAS = 5;
/** Sufixos de host (com ponto obrigatório) para onde o token pode viajar em `baixar` (T-0-07, SSRF). */
export const HOSTS_PERMITIDOS = [".clickup.com", ".clickup-attachments.com"] as const;

export interface RespostaClickUp {
  readonly status: number;
  readonly corpoCru: string;
  readonly json: unknown;
  readonly cabecalhos: Headers;
}

export interface ClienteClickUp {
  /** `caminho` relativo a `BASE_URL`, ex.: "/list/901109104938/task". */
  get(caminho: string, query?: Record<string, string>): Promise<RespostaClickUp>;
  /** Anexos. Recusa qualquer host fora de `HOSTS_PERMITIDOS`, sem chamar `fetch`. */
  baixar(url: string): Promise<{ readonly bytes: Uint8Array; readonly contentType: string | null }>;
}

export interface OpcoesDoCliente {
  readonly token: string;
  /** Injetável nos testes. */
  readonly fetch?: typeof fetch;
  /** Injetável nos testes. */
  readonly dormir?: (ms: number) => Promise<void>;
  /** Injetável nos testes (`Date.now`). */
  readonly agora?: () => number;
}

/** Mensagem = status + caminho + trecho do corpo (≤ 300 chars). Nunca headers, nunca o token. */
export class ErroClickUp extends Error {
  readonly status: number;
  readonly caminho: string;

  constructor(status: number, caminho: string, trechoDoCorpo: string) {
    super(`ClickUp ${status} em ${caminho}: ${trechoDoCorpo}`);
    this.name = "ErroClickUp";
    this.status = status;
    this.caminho = caminho;
  }
}

/** Sufixo com ponto obrigatório: "evil-clickup.com" não deve passar por terminar em "clickup.com". */
export function hostPermitido(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return HOSTS_PERMITIDOS.some((sufixo) => hostname.endsWith(sufixo));
}

async function dormirPadrao(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function criarClienteClickUp(opcoes: OpcoesDoCliente): ClienteClickUp {
  const { token } = opcoes;
  const buscar = opcoes.fetch ?? globalThis.fetch;
  const dormir = opcoes.dormir ?? dormirPadrao;
  const agora = opcoes.agora ?? Date.now;

  // Pacing (T-0-02): quando uma resposta chega perto do teto (`X-RateLimit-Remaining`
  // <= 1), guarda o instante da próxima janela; a chamada SEGUINTE espera antes
  // de disparar o `fetch`, em vez de arriscar um 429 previsível.
  let proximaJanelaEm = 0;

  async function aguardarPacing(): Promise<void> {
    if (agora() < proximaJanelaEm) {
      await dormir(proximaJanelaEm - agora());
    }
  }

  function registrarPacing(cabecalhos: Headers): void {
    const restante = cabecalhos.get("X-RateLimit-Remaining");
    const reset = cabecalhos.get("X-RateLimit-Reset");
    if (restante !== null && reset !== null && Number(restante) <= 1) {
      proximaJanelaEm = Number(reset) * 1000;
    }
  }

  function tempoDeEsperaPara429(cabecalhos: Headers): number {
    const reset = cabecalhos.get("X-RateLimit-Reset");
    const resetEm = reset !== null ? Number(reset) * 1000 : agora() + 60_000; // ausente → 60s (RESEARCH.md Pattern 3)
    return Math.max(1000, resetEm - agora() + 250);
  }

  /** Loop de até `TETO_DE_TENTATIVAS`; só repete em 429, pela mesma URL/headers. */
  async function requisitar(url: URL, identificador: string, headers: Record<string, string>): Promise<Response> {
    for (let tentativa = 1; tentativa <= TETO_DE_TENTATIVAS; tentativa += 1) {
      await aguardarPacing();
      const resposta = await buscar(url, { headers });
      if (resposta.status === 429) {
        if (tentativa === TETO_DE_TENTATIVAS) {
          throw new ErroClickUp(429, identificador, "limite de tentativas em 429 esgotado");
        }
        await dormir(tempoDeEsperaPara429(resposta.headers));
        continue;
      }
      registrarPacing(resposta.headers);
      return resposta;
    }
    // Inalcançável — o loop acima sempre retorna ou lança antes de sair.
    throw new ErroClickUp(429, identificador, "limite de tentativas em 429 esgotado");
  }

  return {
    async get(caminho, query) {
      const url = new URL(BASE_URL + caminho);
      for (const [chave, valor] of Object.entries(query ?? {})) url.searchParams.set(chave, valor);

      const resposta = await requisitar(url, caminho, { Authorization: token, Accept: "application/json" });
      // O corpo de erro do ClickUp é `{ err, ECODE }`, sem eco de headers — o
      // corpo cru vira mensagem (≤ 300 chars), nunca a Response inteira.
      const corpoCru = await resposta.text();
      if (!resposta.ok) {
        throw new ErroClickUp(resposta.status, caminho, corpoCru.slice(0, 300));
      }
      // `await resposta.text()` + `JSON.parse` (não `resposta.json()`): o texto
      // cru é o que o manifesto (Plan 00-04) hasheia para provar paridade —
      // reserializar via `JSON.stringify` poderia reordenar chaves.
      return { status: resposta.status, corpoCru, json: JSON.parse(corpoCru) as unknown, cabecalhos: resposta.headers };
    },

    async baixar(url) {
      if (!hostPermitido(url)) {
        throw new ErroClickUp(403, url, "host fora da allowlist do ClickUp — Authorization nunca sai para ele");
      }
      const alvo = new URL(url);
      const resposta = await requisitar(alvo, url, { Authorization: token });
      if (!resposta.ok) {
        const corpoCru = await resposta.text();
        throw new ErroClickUp(resposta.status, url, corpoCru.slice(0, 300));
      }
      const bytes = new Uint8Array(await resposta.arrayBuffer());
      return { bytes, contentType: resposta.headers.get("content-type") };
    },
  };
}
