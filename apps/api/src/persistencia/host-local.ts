/**
 * A regra "só banco local" e o host que o `pg` USA de fato (15-44, M-01, L-02).
 *
 * Três lugares barram o banco remoto antes de escrever ou apagar linha: o carregador `bootstrap:crm-demo`, o
 * `prepararBancoCrm` dos testes de banco e a banner `Banco:` da CLI do corte. Antes, cada um olhava
 * `new URL(url).hostname`, mas o `pg` monta a conexão com `pg-connection-string`, que copia cada parâmetro da
 * query para a configuração, e o `host` da query vence o da URL. Então
 * `postgres://u:p@localhost:5432/postgres?host=<pooler de produção>` passava na trava e conectava em produção.
 *
 * A regra agora é uma só, aqui, e nunca conecta: usa a API pública do `pg` (`new Client(url).host`), sem
 * dependência nova, só para conferir o host efetivo, e recusa de saída qualquer URL com query.
 */

import { Client } from "pg";

const HOSTS_LOCAIS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

const SEM_HOST = "(host indefinido)";

/** Host e porta que o `pg` usaria para esta URL (a query vale), ou `undefined` se ela não analisa. Não conecta. */
function enderecoEfetivo(url: string | undefined): { readonly host: string; readonly porta: number } | undefined {
  if (!url) return undefined;
  try {
    const cliente = new Client(url);
    const host = cliente.host;
    if (typeof host !== "string" || host === "") return undefined;
    return { host, porta: cliente.port };
  } catch {
    // O `pg-connection-string` já redige a entrada no erro; aqui nem a mensagem sai.
    return undefined;
  }
}

/**
 * `localhost`, `127.0.0.1` ou `[::1]` exatos, em URL SEM query. Recusa:
 *
 *  - qualquer `?…` na URL (`?host=`, `?hostaddr=` e o que mais troque o destino): banco local de Docker não precisa dela;
 *  - o que só parece local (`localhost.evil.com`, `localhost@evil.com`, `LOCALHOST`, `localhost.`, `local%68ost`);
 *  - URL vazia, ilegível, sem host ou caminho de socket.
 *
 * Além do host da URL, confere que o host que o `pg` usa é o mesmo: se divergirem, recusa.
 */
export function hostEhLocal(url: string | undefined): boolean {
  if (!url || url.includes("?")) return false;
  let analisada: URL;
  try {
    analisada = new URL(url);
  } catch {
    return false;
  }
  if (!HOSTS_LOCAIS.has(analisada.hostname)) return false;
  return enderecoEfetivo(url)?.host === analisada.hostname;
}

/**
 * `host:porta` que o `pg` usa, SEM usuário nem senha: o que o dono confere antes de deixar um script escrever.
 * É o host da query quando ela o troca, não o do corpo da URL. URL ausente ou ilegível vira `(host indefinido)`.
 */
export function hostDaConexao(url: string | undefined): string {
  const endereco = enderecoEfetivo(url);
  if (!endereco) return SEM_HOST;
  return Number.isFinite(endereco.porta) ? `${endereco.host}:${endereco.porta}` : endereco.host;
}
