/**
 * O pool de conexões. Uma instância por processo; quem usa pede `pool()`.
 */

import { readFileSync } from "node:fs";
import { Pool, type PoolConfig } from "pg";

/** Lê apps/api/.env sem depender de dotenv — só as chaves que faltam. */
export function carregarEnv(caminho = new URL("../../.env", import.meta.url)): void {
  let texto: string;
  try {
    texto = readFileSync(caminho, "utf8");
  } catch {
    return;
  }
  for (const linha of texto.split("\n")) {
    const corte = linha.indexOf("=");
    if (corte <= 0 || linha.trimStart().startsWith("#")) continue;
    const chave = linha.slice(0, corte).trim();
    if (process.env[chave] === undefined) process.env[chave] = linha.slice(corte + 1).trim();
  }
}

const HOST_LOCAL = /localhost|127\.0\.0\.1/;

/** A mesma forma que `pg` aceita em `PoolConfig.ssl`. */
export type OpcoesSsl = PoolConfig["ssl"];

/**
 * Decide a configuração de TLS a partir das variáveis de ambiente, sem abrir
 * socket — separado de `pool()` para poder ser testado puro (Plan 02-15,
 * T-02-TLS). `localhost`/`127.0.0.1` nunca usa TLS: é o Postgres do dev, sem
 * CA nenhuma para verificar.
 *
 * Precedência: `DATABASE_SSL_INSECURE=true` sempre vence — e sempre avisa
 * alto no log — como válvula de escape explícita para desenvolvimento sem a
 * CA à mão; depois `DATABASE_CA_CERT` (conteúdo PEM em env) e
 * `DATABASE_CA_PATH` (caminho de um arquivo PEM). Sem nenhuma das três, a
 * função lança: conectar sem verificar a identidade do servidor nunca é o
 * comportamento padrão. É o blocker de STATE.md ("fixar a CA do Supabase
 * antes de o apps/api ir para a VPS") fechado por recusa em vez de silêncio.
 */
export function construirSsl(args: {
  readonly connectionString: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly lerArquivo?: (caminho: string) => string;
}): OpcoesSsl {
  const env = args.env ?? process.env;
  if (HOST_LOCAL.test(args.connectionString)) return undefined;

  if (env.DATABASE_SSL_INSECURE === "true") {
    console.warn(
      "[conexao] DATABASE_SSL_INSECURE=true: a verificação da cadeia TLS do Postgres está DESLIGADA. " +
        "Isto é proibido fora de desenvolvimento local — nesse modo um MITM na rota poderia ler e alterar " +
        "dado financeiro sem detecção (T-02-TLS). Fixe DATABASE_CA_CERT ou DATABASE_CA_PATH antes de " +
        "qualquer ambiente que não seja o notebook do desenvolvedor.",
    );
    return { rejectUnauthorized: false };
  }

  const lerArquivo = args.lerArquivo ?? ((caminho: string) => readFileSync(caminho, "utf8"));
  const ca = env.DATABASE_CA_CERT ?? (env.DATABASE_CA_PATH ? lerArquivo(env.DATABASE_CA_PATH) : undefined);
  if (!ca) {
    throw new Error(
      "Conexão remota ao Postgres sem verificação de TLS definida. Defina DATABASE_CA_CERT (conteúdo PEM) " +
        "ou DATABASE_CA_PATH (caminho de um arquivo PEM) com a CA do Supabase, ou DATABASE_SSL_INSECURE=true " +
        "só em desenvolvimento local (ver apps/api/README.md).",
    );
  }
  return { ca, rejectUnauthorized: true };
}

/** O tempo máximo de UMA consulta, do lado do cliente, quando `DATABASE_QUERY_TIMEOUT_MS` não diz outro. */
export const TEMPO_DE_CONSULTA_PADRAO_MS = 30_000;

/**
 * Os limites de tempo do pool, separados de `pool()` para serem testados
 * puros. Sem eles, uma conexão que o pooler do Supabase derruba NO MEIO de uma
 * requisição só é notada quando o TCP desiste: em 2026-09-29 duas escritas no
 * `ws_n1` ficaram 16 e 10 minutos paradas ("Connection terminated
 * unexpectedly" no fim), e o Espaço de Trabalho parou junto, porque a
 * transação presa segurava a revisão dele.
 *
 *   - `query_timeout`: consulta sem resposta vira erro em 30 s — e quem pegou
 *     a conexão a DESCARTA (`release(true)`, ver `executar`): depois de um
 *     timeout o protocolo pode ter ficado no meio, e ela não serve a mais
 *     ninguém. `DATABASE_QUERY_TIMEOUT_MS=0` desliga (migração longa, à mão).
 *   - `connectionTimeoutMillis`: abrir conexão nova nunca espera para sempre.
 *   - `keepAlive`: a conexão ociosa que morreu é percebida antes de ser usada.
 */
export function limitesDoPool(
  env: NodeJS.ProcessEnv = process.env,
): Pick<PoolConfig, "query_timeout" | "connectionTimeoutMillis" | "keepAlive" | "keepAliveInitialDelayMillis"> {
  const bruto = env.DATABASE_QUERY_TIMEOUT_MS?.trim();
  const lido = bruto ? Number(bruto) : TEMPO_DE_CONSULTA_PADRAO_MS;
  const consulta = Number.isInteger(lido) && lido >= 0 ? lido : TEMPO_DE_CONSULTA_PADRAO_MS;
  return {
    ...(consulta > 0 ? { query_timeout: consulta } : {}),
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  };
}

/** O mínimo de um cliente do `pg` que `encerrarAoEstourarOTempo` toca (`query` tem muitas sobrecargas). */
type ClienteConsultavel = { query: unknown; end: () => Promise<void> };

/**
 * Depois de um `query_timeout`, o `pg` devolve o erro mas deixa a conexão
 * aberta — e a resposta atrasada pode chegar à PRÓXIMA consulta de quem a
 * pegar do pool. A conexão cuja consulta estoura o tempo é encerrada na hora:
 * `end()` a marca como encerrando, e o pool a descarta ao ser devolvida —
 * em todos os pontos que usam `pool()`, sem cada um precisar lembrar. Quem
 * chamou recebe o erro do mesmo jeito.
 */
export function encerrarAoEstourarOTempo(cliente: ClienteConsultavel): void {
  const alvo = cliente as { query: (...args: unknown[]) => unknown; end: () => Promise<void> };
  const consultar = alvo.query.bind(alvo);
  alvo.query = (...args: unknown[]) => {
    const resposta = consultar(...args);
    if (resposta instanceof Promise) {
      resposta.catch((erro: unknown) => {
        if (erro instanceof Error && erro.message === "Query read timeout") cliente.end().catch(() => undefined);
      });
    }
    return resposta;
  };
}

let instancia: Pool | undefined;

export function pool(): Pool {
  if (!instancia) {
    carregarEnv();
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida (ver apps/api/.env.example).");

    const config: PoolConfig = { connectionString, max: 10, ...limitesDoPool() };
    const ssl = construirSsl({ connectionString });
    if (ssl) config.ssl = ssl;
    instancia = new Pool(config);

    // O pooler do Supabase encerra conexão ociosa por desenho. Quando isso
    // acontece com um cliente parado NO POOL, o `pg` emite `error` no próprio
    // Pool — e um `error` sem ouvinte, em Node, é exceção não capturada: o
    // processo inteiro cai. Sem este handler, o `apps/api` morreria sozinho
    // depois de um período de baixo tráfego, sem nenhuma requisição envolvida.
    //
    // Não é hipótese: medido nesta base ao migrar `DATABASE_URL` para
    // `aws-0-us-west-2.pooler.supabase.com`, uma execução da suíte produziu
    // sete "Connection terminated unexpectedly". Com a conexão direta o
    // sintoma era raro; pelo pooler é rotina — e a VPS (D-15) vai pelo pooler,
    // porque `db.<ref>.supabase.co` só publica AAAA e não há garantia de IPv6.
    //
    // O Pool se recupera sozinho: descarta o cliente quebrado e abre outro na
    // próxima aquisição. O que faltava era não morrer no caminho.
    instancia.on("error", (erro) => {
      console.error("[conexao] cliente ocioso do pool caiu (o pool se recompõe na próxima aquisição):", erro.message);
    });
    // Cada conexão nova: a consulta que estourar `query_timeout` a encerra.
    instancia.on("connect", (cliente) => encerrarAoEstourarOTempo(cliente));
  }
  return instancia;
}

export async function encerrar(): Promise<void> {
  await instancia?.end();
  instancia = undefined;
}
