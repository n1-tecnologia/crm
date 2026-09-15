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
  }
  return instancia;
}

export async function encerrar(): Promise<void> {
  await instancia?.end();
  instancia = undefined;
}
