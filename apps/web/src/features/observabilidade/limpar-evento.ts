/**
 * O Sentry da `apps/web` (D-13, 1.7.4, SEG-10; T-09-82, T-09-83): o erro de
 * render e de servidor chega ao painel, e só ele — sem corpo, cabeçalho
 * (inclusive o `Referer`, que carrega o link de onde a pessoa veio), cookie,
 * query string, e-mail do usuário nem o segredo de `/f/<segredo>` e
 * `/p/<segredo>`.
 *
 * É o espelho de `apps/api/src/observabilidade/sentry.ts` (09-13), adaptado às
 * URLs da web. Os dois lados não se importam (`CONTEXT.md` da raiz): a regra do
 * segredo de link mora no domínio, em `mascararSegredoDeUrl`, e é lida daqui.
 *
 * Duas camadas, nesta ordem:
 *
 * 1. `dataCollection` desliga na origem o que o SDK coletaria sozinho. Ao
 *    informá-lo, o SDK passa a ler só ele e a ignorar `sendDefaultPii`, e todo
 *    campo omitido volta ao padrão LIGADO — por isso todos aparecem, explícitos.
 * 2. `limparEvento` e `limparMigalha` rodam em `beforeSend`/`beforeBreadcrumb` e
 *    apagam o que mesmo assim tenha chegado ao evento.
 *
 * A regra do domínio só enxerga o segredo no COMEÇO do texto (`/f/x`,
 * `https://host/f/x`), de propósito, para não tocar em `/financeiro/f/abc`. Numa
 * mensagem de exceção a URL vem no meio da frase ("Failed to fetch … para
 * https://app/p/x"), então `mascararTexto` repete a busca em qualquer posição.
 * Errar aqui é para o lado de mascarar a mais: um relatório de erro não perde
 * nada de útil sem o trecho de um link.
 *
 * Funções puras, sem importar o SDK: testáveis sem rede.
 */

import { mascararSegredoDeUrl } from "@n1/dominio/url-segura";

type Registro = Record<string, unknown>;

const ehRegistro = (valor: unknown): valor is Registro => typeof valor === "object" && valor !== null && !Array.isArray(valor);

/**
 * `/f/` e `/p/` (com ou sem `esquema://host`) em qualquer posição do texto, desde
 * que o caractere anterior não seja de palavra, barra, ponto ou hífen — assim
 * `/financeiro/f/abc` não casa. O segredo termina em barra, `?`, `#`, espaço ou
 * aspas, e a pontuação final da frase fica de fora dele.
 */
const SEGREDO_NO_TEXTO = /(^|[^\w/.-])((?:[a-z][a-z0-9+.-]*:\/\/[^/?#\s'"`]+)?\/(?:f|p)\/)[^/?#\s'"`)\]>]*[^/?#\s'"`)\]>.,;:!]/gi;

/** Texto livre (mensagem, transação, valor de exceção): só o segredo de link sai. */
function mascararTexto(texto: string): string {
  return mascararSegredoDeUrl(texto).replace(SEGREDO_NO_TEXTO, "$1$2***");
}

/** Uma cópia do registro sem as chaves dadas. */
function sem(registro: Registro, chaves: readonly string[]): Registro {
  return Object.fromEntries(Object.entries(registro).filter(([chave]) => !chaves.includes(chave)));
}

/** Uma URL: sem o segredo de link e sem query nem fragmento (a query pode carregar token). */
function semQuery<V>(valor: V): V {
  return (typeof valor === "string" ? mascararTexto(valor).split(/[?#]/)[0] : valor) as V;
}

/** Valor qualquer de uma migalha (por ex. `data.arguments` do console): mascara as strings em profundidade limitada. */
function mascararProfundo(valor: unknown, profundidade = 4): unknown {
  if (typeof valor === "string") return mascararTexto(valor);
  if (profundidade <= 0) return valor;
  if (Array.isArray(valor)) return valor.map((item) => mascararProfundo(item, profundidade - 1));
  if (ehRegistro(valor)) return Object.fromEntries(Object.entries(valor).map(([campo, item]) => [campo, mascararProfundo(item, profundidade - 1)]));
  return valor;
}

const CAMPOS_DE_URL_DA_MIGALHA: ReadonlySet<string> = new Set(["url", "from", "to"]);

export function limparMigalha<T extends object>(migalha: T): T {
  const origem = migalha as Registro;
  const saida: Registro = { ...origem };
  if (typeof origem.message === "string") saida.message = mascararTexto(origem.message);
  if (ehRegistro(origem.data)) {
    saida.data = Object.fromEntries(
      Object.entries(origem.data).map(([campo, valor]) => [campo, CAMPOS_DE_URL_DA_MIGALHA.has(campo) ? semQuery(valor) : mascararProfundo(valor)]),
    );
  }
  return saida as T;
}

/** As variáveis locais de um frame podem ser qualquer coisa (senha, corpo): saem todas. */
function limparExcecao(excecao: unknown): unknown {
  if (!ehRegistro(excecao)) return excecao;
  const saida: Registro = { ...excecao };
  if (typeof excecao.value === "string") saida.value = mascararTexto(excecao.value);
  if (ehRegistro(excecao.stacktrace) && Array.isArray(excecao.stacktrace.frames)) {
    saida.stacktrace = {
      ...excecao.stacktrace,
      frames: excecao.stacktrace.frames.map((frame: unknown) => {
        if (!ehRegistro(frame)) return frame;
        return sem(frame, ["vars"]);
      }),
    };
  }
  return saida;
}

export function limparEvento<T extends object>(evento: T): T {
  const origem = evento as Registro;
  // `user` sai inteiro: e-mail, id e IP. O Sentry não precisa saber de quem foi o pedido.
  const saida = sem(origem, ["user"]);

  if (typeof origem.message === "string") saida.message = mascararTexto(origem.message);
  if (typeof origem.transaction === "string") saida.transaction = mascararTexto(origem.transaction);

  if (ehRegistro(origem.request)) {
    // Fica o método e a URL sem segredo e sem query: o suficiente para achar a rota.
    // `headers` leva o `Referer` (link de onde a pessoa veio) e o `cookie`.
    const requisicao = sem(origem.request, ["headers", "cookies", "data", "query_string", "env"]);
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

/**
 * O objeto de `Sentry.init`, para o navegador e para o servidor do Next. Sem
 * DSN não há chave `dsn` e o SDK não envia nada (desenvolvimento, testes, build).
 */
export function opcoesDoSentryNaWeb(dsn: string | undefined) {
  const valor = dsn?.trim();
  return {
    ...(valor ? { dsn: valor } : {}),
    // Só erros: nenhum traço de desempenho sai, e nem `replayIntegration` entra.
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
