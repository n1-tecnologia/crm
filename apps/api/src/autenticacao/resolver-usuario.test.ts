/**
 * `resolverUsuarioPorEmail` contra o Supabase Auth de verdade — é a
 * integração arriscada de PERS-09 (Open Question #1 do RESEARCH.md), não a
 * regra de negócio (que `members-reconvite.test.ts`, no domínio, já cobre
 * com um `userId` simulado). Pula sem `SUPABASE_URL`/`SUPABASE_SECRET_KEY`
 * (D-DEC-09).
 *
 * Pré-condição: `npm run usuarios:seed -w @n1/api` já rodou — os 11
 * Usuários `<nome>@n1.teste` (D-09) existem no Auth do projeto.
 */

import { describe, expect, it } from "vitest";
import { USUARIOS_DO_SEED } from "@n1/dominio";
import { carregarEnv } from "../persistencia/conexao";
import { resolverUsuarioPorEmail } from "./resolver-usuario";

carregarEnv();
const temAuth = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const d = temAuth ? describe : describe.skip;

d("resolverUsuarioPorEmail — contra o Supabase Auth real", () => {
  it("(a) acha o userId de um e-mail existente", async () => {
    const userId = await resolverUsuarioPorEmail("maryane@n1.teste");
    expect(userId).toBe(USUARIOS_DO_SEED.mem_maryane);
  });

  it("(b) normaliza espaço e caixa antes de comparar", async () => {
    const userId = await resolverUsuarioPorEmail("  MARYANE@N1.TESTE  ");
    expect(userId).toBe(USUARIOS_DO_SEED.mem_maryane);
  });

  it("(c) e-mail sem conta no Auth devolve undefined", async () => {
    const userId = await resolverUsuarioPorEmail("ninguem@n1.teste");
    expect(userId).toBeUndefined();
  });
});
