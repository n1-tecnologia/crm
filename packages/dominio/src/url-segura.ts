/**
 * Tira o segredo de link de uma URL antes dela ir para um log, um evento do
 * Sentry ou qualquer texto que sobreviva ao pedido (D-18, 1.5.1).
 *
 * Fica no domínio, e não na api, porque a regra precisa ser uma só: o log da
 * `apps/api`, o Sentry da api e o Sentry da web importam esta função e nenhum
 * deles pode depender do outro (`CONTEXT.md` da raiz). O `map` do nginx
 * (Plan 09-06) não importa TypeScript, então espelha à mão o trecho
 * `/v1/public/` — se a regra mudar aqui, o `map` muda junto.
 *
 * O que é segredo:
 * - o segmento logo depois de `/v1/public/forms/` e de `/v1/public/tasks/`,
 *   em qualquer posição da string e em todas as ocorrências;
 * - o primeiro segmento depois de `/f/` e `/p/` (os links que a web serve),
 *   SÓ quando são o começo do caminho — no início da string ou logo depois de
 *   `esquema://host`. `/financeiro/f/abc` não é link público.
 *
 * O resto do caminho e a query ficam como vieram. Função pura, sem import.
 */

const SEGREDO_DA_API = /(\/v1\/public\/(?:forms|tasks)\/)[^/?#\s]+/g;
const SEGREDO_DA_WEB = /^((?:[a-z][a-z0-9+.-]*:\/\/[^/?#\s]+)?\/(?:f|p)\/)[^/?#\s]+/i;

export function mascararSegredoDeUrl(url: string): string {
  return url.replace(SEGREDO_DA_API, "$1***").replace(SEGREDO_DA_WEB, "$1***");
}
