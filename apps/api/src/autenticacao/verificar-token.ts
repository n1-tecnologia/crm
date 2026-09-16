/**
 * Verifica a assinatura de um access token do Supabase Auth.
 *
 * `getClaims()` confere a assinatura contra o JWKS do projeto (chave
 * assimétrica — `supabase.com/docs/guides/auth/signing-keys`) e cacheia a
 * chave por conta própria; se o projeto ainda estivesse numa chave simétrica
 * legada, ele mesmo cairia para o equivalente de `getUser()`. Por isso não se
 * reimplementa isto com `jose`/`createRemoteJWKSet` — seria reproduzir cache
 * e rotação de chave que a biblioteca já resolve (Don't Hand-Roll,
 * RESEARCH.md).
 */

import { createClient } from "@supabase/supabase-js";
import { carregarEnv } from "../persistencia/conexao";

export interface ClaimsDaSessao {
  readonly sub: string;
  readonly email?: string;
}

export type VerificarToken = (token: string) => Promise<ClaimsDaSessao | null>;

let instancia: ReturnType<typeof createClient> | undefined;

/**
 * Client admin do Supabase, uma instância por processo. Exportado (não só
 * uso interno) para `autenticacao/resolver-usuario.ts` reutilizar — a mesma
 * disciplina de "client instanciado uma vez" que `criar-usuarios-do-seed.ts`
 * já segue, sem duplicar a leitura de `SUPABASE_SECRET_KEY`.
 */
export function clienteAdmin(): ReturnType<typeof createClient> {
  if (!instancia) {
    carregarEnv();
    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SECRET_KEY;
    if (!url || !chave) throw new Error("SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar em apps/api/.env.");
    instancia = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return instancia;
}

export async function verificarTokenDoSupabase(token: string): Promise<ClaimsDaSessao | null> {
  const { data, error } = await clienteAdmin().auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { sub: data.claims.sub, email: data.claims.email };
}
