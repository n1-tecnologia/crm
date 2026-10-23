/**
 * O Sentry da `apps/api` (D-13, 1.7.4, SEG-10; T-09-63, T-09-64, T-09-65): o
 * erro inesperado chega ao painel, e só ele — sem corpo, cabeçalho, cookie,
 * query string nem o segredo de link de uma requisição.
 *
 * Duas camadas, nesta ordem:
 *
 * 1. `dataCollection` desliga na origem o que o SDK coletaria sozinho (usuário,
 *    cookies, cabeçalhos, corpos, query, dado de consulta, variáveis de frame).
 *    Ao informar `dataCollection`, o SDK passa a ler só ele e a ignorar
 *    `sendDefaultPii`, e todo campo omitido volta ao padrão LIGADO — por isso
 *    todos aparecem, explícitos.
 * 2. `limparEvento` e `limparMigalha` rodam em `beforeSend`/`beforeBreadcrumb`
 *    e apagam o que mesmo assim tenha chegado ao evento, e mascaram o segredo
 *    de link com `mascararSegredoDeUrl` — a MESMA regra do log (`log.ts`, D-18),
 *    que mora no domínio porque api e web não se importam.
 *
 * Sem depender de auto-instrumentação. O processo roda por `vite-node`, sem
 * `--import`, e o Fastify é o 5: o erro entra por `capturarErroNoSentry`,
 * chamado pelo ramo 500 do `setErrorHandler` (`app.ts`). O 400 do zod e o 4xx do
 * Fastify nunca chegam aqui. Sem `SENTRY_DSN` o SDK nem é iniciado
 * (desenvolvimento e testes).
 */

import { mascararSegredoDeUrl } from "@n1/dominio/url-segura";
import * as Sentry from "@sentry/node";
import type { NodeOptions } from "@sentry/node";

type Registro = Record<string, unknown>;

const ehRegistro = (valor: unknown): valor is Registro => typeof valor === "object" && valor !== null && !Array.isArray(valor);

/** Texto livre (mensagem, transação, valor de exceção): só o segredo de link sai. */
function mascarar<V>(valor: V): V {
  return (typeof valor === "string" ? mascararSegredoDeUrl(valor) : valor) as V;
}

/** Uma URL: sem o segredo de link e sem query nem fragmento (a query pode carregar token). */
function semQuery<V>(valor: V): V {
  return (typeof valor === "string" ? mascararSegredoDeUrl(valor).split(/[?#]/)[0] : valor) as V;
}

const CAMPOS_DE_URL_DA_MIGALHA: ReadonlySet<string> = new Set(["url", "from", "to"]);

export function limparMigalha<T extends object>(migalha: T): T {
  const origem = migalha as Registro;
  const saida: Registro = { ...origem };
  if (typeof origem.message === "string") saida.message = mascarar(origem.message);
  if (ehRegistro(origem.data)) {
    saida.data = Object.fromEntries(
      Object.entries(origem.data).map(([campo, valor]) => [campo, CAMPOS_DE_URL_DA_MIGALHA.has(campo) ? semQuery(valor) : mascarar(valor)]),
    );
  }
  return saida as T;
}

/** As variáveis locais de um frame podem ser qualquer coisa (senha, corpo): saem todas. */
function limparExcecao(excecao: unknown): unknown {
  if (!ehRegistro(excecao)) return excecao;
  const saida: Registro = { ...excecao };
  if (typeof excecao.value === "string") saida.value = mascarar(excecao.value);
  if (ehRegistro(excecao.stacktrace) && Array.isArray(excecao.stacktrace.frames)) {
    saida.stacktrace = {
      ...excecao.stacktrace,
      frames: excecao.stacktrace.frames.map((frame: unknown) => {
        if (!ehRegistro(frame)) return frame;
        const { vars: _vars, ...semVariaveis } = frame;
        return semVariaveis;
      }),
    };
  }
  return saida;
}

export function limparEvento<T extends object>(evento: T): T {
  const origem = evento as Registro;
  // `user` sai inteiro: e-mail, id e IP. O Sentry não precisa saber de quem foi o pedido.
  const { user: _user, ...restante } = origem;
  const saida: Registro = { ...restante };

  if (typeof origem.message === "string") saida.message = mascarar(origem.message);
  if (typeof origem.transaction === "string") saida.transaction = mascarar(origem.transaction);

  if (ehRegistro(origem.request)) {
    // Fica o método e a URL sem segredo e sem query: o suficiente para achar a rota.
    const { headers: _cabecalhos, cookies: _cookies, data: _corpo, query_string: _query, env: _ambiente, ...requisicao } = origem.request;
    saida.request = "url" in requisicao ? { ...requisicao, url: semQuery(requisicao.url) } : requisicao;
  }

  if (Array.isArray(origem.breadcrumbs)) {
    saida.breadcrumbs = origem.breadcrumbs.map((migalha: unknown) => (ehRegistro(migalha) ? limparMigalha(migalha) : migalha));
  }

  if (ehRegistro(origem.exception) && Array.isArray(origem.exception.values)) {
    saida.exception = { ...origem.exception, values: origem.exception.values.map(limparExcecao) };
  }

  return saida as T;
}

export function opcoesDoSentry(env: NodeJS.ProcessEnv = process.env): NodeOptions {
  return {
    dsn: env.SENTRY_DSN?.trim(),
    environment: env.SENTRY_AMBIENTE?.trim() || "desenvolvimento",
    // Só erros: nenhum traço de desempenho sai (e o custo de coletá-los não existe).
    tracesSampleRate: 0,
    // O SDK ignora este quando `dataCollection` existe; fica declarado para quem ler.
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    beforeSend: limparEvento,
    beforeBreadcrumb: limparMigalha,
  };
}

/** Inicia o SDK quando há `SENTRY_DSN`. Devolve se iniciou. Chame antes de `buildApp`. */
export function iniciarSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!env.SENTRY_DSN?.trim()) return false;
  Sentry.init(opcoesDoSentry(env));
  return true;
}

/** Sem o SDK iniciado, `captureException` não faz nada. */
export function capturarErroNoSentry(erro: unknown): void {
  Sentry.captureException(erro);
}

/** Espera até 2 s o envio pendente: um erro capturado logo antes do desligamento ainda sai (T-09-65). */
export async function fecharSentry(): Promise<void> {
  await Sentry.close(2000);
}
