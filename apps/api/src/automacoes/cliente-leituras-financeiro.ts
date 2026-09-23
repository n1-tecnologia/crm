/**
 * O cliente HTTP que o `apps/api` usa para as leituras do Financeiro
 * (Fase 4, D4-01/D4-02) — o irmão de leitura de `invocar-agente.ts`: mesmo
 * Bearer, mesmo `AbortSignal.timeout`, mesma classificação transitório ×
 * permanente e o mesmo `sanitizarErro()` importado de
 * `persistencia/outbox-worker.ts`, nunca reescrito.
 *
 * O que ele NÃO tem, e por quê: sem `aquecer()`/cache — não há pré-passo,
 * a chamada nasce dentro do handler HTTP que recebe a requisição do
 * `apps/web`; sem `Idempotency-Key` — GETs e as ações desta ponte (retry,
 * cancel, gatilhos de NF em lote) são idempotentes por natureza do lado que
 * as recebe; sem transação — nada aqui grava em `plataforma.registros`.
 *
 * A credencial de leitura é distinta da credencial de lançamento por D4-02
 * — escopo mínimo: um vazamento do token de leitura não gasta dinheiro.
 * Este arquivo nunca lê variável de ambiente diretamente — quem lê é
 * `rotas/financeiro.ts` (04-05), que injeta `destinoUrl`/`token`; é isso
 * que torna o teste possível sem env.
 */

import { randomUUID } from "node:crypto";
import { sanitizarErro } from "../persistencia/outbox-worker";

const STATUS_PERMANENTES: readonly number[] = [400, 401, 403, 404, 422];

function retryableDoEnvelope(corpo: unknown): boolean | undefined {
  if (typeof corpo !== "object" || corpo === null) return undefined;
  const envelope = corpo as { readonly error?: { readonly retryable?: unknown } };
  return typeof envelope.error?.retryable === "boolean" ? envelope.error.retryable : undefined;
}

function codigoDoEnvelope(corpo: unknown): string | undefined {
  if (typeof corpo !== "object" || corpo === null) return undefined;
  const envelope = corpo as { readonly error?: { readonly code?: unknown } };
  return typeof envelope.error?.code === "string" ? envelope.error.code : undefined;
}

/**
 * Mesma semântica de `classificar()` em `invocar-agente.ts`: `retryable === true`
 * no envelope vence a lista de status (é assim que um `503 CONFIGURACAO_AUSENTE`
 * vira permanente); `429` e `5xx` sem `retryable` declarado são transitórios;
 * sem `status` (rede/`AbortError`) é transitório com code `ERRO_DE_REDE`;
 * status desconhecido é permanente, por segurança.
 */
export function classificarLeitura(
  status: number | undefined,
  corpo: unknown,
  erroDeRede: unknown,
): { readonly permanente: boolean; readonly code: string } {
  if (status === undefined) {
    void erroDeRede; // registrado por quem chama, via `sanitizarErro`; aqui só decide a classificação.
    return { permanente: false, code: codigoDoEnvelope(corpo) ?? "ERRO_DE_REDE" };
  }
  const retryable = retryableDoEnvelope(corpo);
  const code = codigoDoEnvelope(corpo) ?? `HTTP_${status}`;
  if (retryable === true) return { permanente: false, code };
  if (retryable === false) return { permanente: true, code };
  if (status === 429 || (status >= 500 && status < 600)) return { permanente: false, code };
  if (STATUS_PERMANENTES.includes(status)) return { permanente: true, code };
  return { permanente: true, code }; // status desconhecido — por segurança, permanente.
}

export interface OpcoesDoClienteDeLeituras {
  /** Origem do `automation/`, sem barra final. */
  readonly destinoUrl: string;
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

/**
 * O erro NUNCA carrega o corpo da resposta do `automation/` — só `code` +
 * `summary` já saneados por `sanitizarErro()`.
 */
export type RespostaDeLeitura<T> =
  | { readonly ok: true; readonly status: number; readonly corpo: T }
  | { readonly ok: false; readonly status?: number; readonly permanente: boolean; readonly code: string; readonly summary: string };

export interface ArquivoParaEnviar {
  readonly conteudo: Buffer;
  readonly contentType: string;
  readonly nome: string;
  readonly origem: string;
}

export interface ClienteDeLeituras {
  ler<T>(caminho: string, opcoes?: { readonly query?: Record<string, string> }): Promise<RespostaDeLeitura<T>>;
  enviar<T>(caminho: string, corpo: unknown): Promise<RespostaDeLeitura<T>>;
  enviarArquivo<T>(caminho: string, arquivo: ArquivoParaEnviar): Promise<RespostaDeLeitura<T>>;
}

function respostaDeErro(status: number | undefined, code: string, permanente: boolean, summary: string): RespostaDeLeitura<never> {
  return { ok: false, ...(status !== undefined ? { status } : {}), permanente, code, summary };
}

export function criarClienteDeLeituras(opcoes: OpcoesDoClienteDeLeituras): ClienteDeLeituras {
  const { destinoUrl, token } = opcoes;
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const timeoutMs = opcoes.timeoutMs ?? 10_000;

  function urlDe(caminho: string, query?: Record<string, string>): string {
    const base = `${destinoUrl}${caminho}`;
    if (!query || Object.keys(query).length === 0) return base;
    const querystring = new URLSearchParams(query).toString();
    return `${base}?${querystring}`;
  }

  async function executar<T>(
    metodo: "GET" | "POST",
    caminho: string,
    opcoesDaChamada: { readonly query?: Record<string, string>; readonly corpo?: unknown; readonly corpoBruto?: ArquivoParaEnviar },
  ): Promise<RespostaDeLeitura<T>> {
    // Token vazio nunca autentica, e o processo não deixa de subir por falta
    // dele — a convenção de `optionalEnv` do outro lado. Nenhuma requisição
    // parte para a rede.
    if (token === "") {
      return respostaDeErro(undefined, "CREDENCIAL_AUSENTE", true, "Credencial de leitura ausente.");
    }

    const cabecalhos: Record<string, string> = {
      authorization: `Bearer ${token}`,
      "x-request-id": randomUUID(),
    };
    let corpo: string | Buffer | undefined;
    if (opcoesDaChamada.corpoBruto) {
      const arquivo = opcoesDaChamada.corpoBruto;
      corpo = arquivo.conteudo;
      cabecalhos["content-type"] = arquivo.contentType;
      cabecalhos["x-file-name"] = arquivo.nome;
      cabecalhos["x-source"] = "crm-n1-financeiro";
    } else if (opcoesDaChamada.corpo !== undefined) {
      corpo = JSON.stringify(opcoesDaChamada.corpo);
      cabecalhos["content-type"] = "application/json";
    }

    const url = urlDe(caminho, opcoesDaChamada.query);
    let resposta: Response | undefined;
    let erroDeRede: unknown;
    try {
      resposta = await fetchImpl(url, {
        method: metodo,
        headers: cabecalhos,
        ...(corpo !== undefined ? { body: corpo } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (erro) {
      erroDeRede = erro;
    }

    if (!resposta) {
      const erro = sanitizarErro(erroDeRede, "ERRO_DE_REDE");
      return respostaDeErro(undefined, "ERRO_DE_REDE", false, erro.summary);
    }

    if (resposta.ok) {
      let corpoResposta: unknown;
      try {
        corpoResposta = await resposta.json();
      } catch {
        const erro = sanitizarErro(new Error(`Resposta não-JSON de ${caminho}`), "RESPOSTA_INVALIDA");
        return respostaDeErro(resposta.status, "RESPOSTA_INVALIDA", true, erro.summary);
      }
      return { ok: true, status: resposta.status, corpo: corpoResposta as T };
    }

    const corpoResposta = await resposta.json().catch(() => undefined);
    const classificacao = classificarLeitura(resposta.status, corpoResposta, undefined);
    // O caminho entra, a ORIGEM completa e o corpo NÃO — mesma disciplina de T-3-04.
    const erro = sanitizarErro(new Error(`HTTP ${resposta.status} de ${destinoUrl}${caminho}`), classificacao.code);
    return respostaDeErro(resposta.status, classificacao.code, classificacao.permanente, erro.summary);
  }

  return {
    ler<T>(caminho: string, opcoesDaLeitura?: { readonly query?: Record<string, string> }) {
      return executar<T>("GET", caminho, { ...(opcoesDaLeitura?.query ? { query: opcoesDaLeitura.query } : {}) });
    },
    enviar<T>(caminho: string, corpo: unknown) {
      return executar<T>("POST", caminho, { corpo });
    },
    enviarArquivo<T>(caminho: string, arquivo: ArquivoParaEnviar) {
      return executar<T>("POST", caminho, { corpoBruto: arquivo });
    },
  };
}
