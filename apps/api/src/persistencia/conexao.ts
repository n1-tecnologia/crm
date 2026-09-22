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

let instancia: Pool | undefined;

export function pool(): Pool {
  if (!instancia) {
    carregarEnv();
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida (ver apps/api/.env.example).");

    const config: PoolConfig = { connectionString, max: 10 };
    // Postgres local roda sem TLS; qualquer host remoto exige. O Supabase
    // assina o certificado da conexão direta com uma CA própria, que o Node
    // não conhece — por isso a verificação da cadeia fica desligada aqui. O
    // tráfego segue cifrado; o que não se verifica é a identidade do servidor.
    // Quando a CA da Supabase for fixada no repositório, isto vira `true`.
    if (!/localhost|127\.0\.0\.1/.test(connectionString)) {
      config.ssl = { rejectUnauthorized: false };
    }
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
  }
  return instancia;
}

export async function encerrar(): Promise<void> {
  await instancia?.end();
  instancia = undefined;
}
