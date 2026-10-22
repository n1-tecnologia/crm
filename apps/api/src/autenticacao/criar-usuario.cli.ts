/**
 * Cria um Usuário no Supabase Auth e o Membro `ativo` correspondente no
 * Espaço de Trabalho, já pronto para entrar.
 *
 *   npm run usuarios:criar -w @n1/api -- <email> [administrador|membro|convidado] [nome]
 *
 * É a ponte até existir o aceite de convite (Sessão 12): hoje `inviteMember`
 * cria o Membro `pendente`, ninguém envia o e-mail, e um Membro `pendente`
 * recebe 403 ao entrar. Aqui o convite passa pelo mesmo `inviteMember` (com as
 * regras de e-mail único, limite de Membros e "Proprietário não se convida") e
 * o Membro é ativado na mesma transação, como faria o aceite.
 *
 * A senha é gerada e impressa uma única vez. Se o Usuário já existe no Auth,
 * ele é reaproveitado e a senha não muda.
 */

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { SystemRole } from "@n1/dominio";
import { memberActor, recordActivity } from "@n1/dominio/operations/activity";
import { inviteMember } from "@n1/dominio/operations/members";
import { carregarEnv, pool } from "../persistencia/conexao";
import { executar } from "../persistencia/unidade-de-trabalho";

carregarEnv();

const [emailBruto, baseBruta = "administrador", ...nomePartes] = process.argv.slice(2);
const email = (emailBruto ?? "").trim().toLowerCase();
const base = baseBruta as SystemRole;
const nome = nomePartes.join(" ").trim() || email;
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Uso: npm run usuarios:criar -w @n1/api -- <email> [administrador|membro|convidado] [nome]");
if (!["administrador", "membro", "convidado"].includes(base)) throw new Error("O Papel precisa ser administrador, membro ou convidado.");

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
const workspaceId = process.env.WORKSPACE_ID;
if (!url || !chave || !workspaceId) throw new Error("SUPABASE_URL, SUPABASE_SECRET_KEY e WORKSPACE_ID precisam estar em apps/api/.env.");

const admin = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. Usuário no Auth: reaproveita se o e-mail já existe.
let userId: string | undefined;
let senha: string | undefined;
for (let pagina = 1; pagina <= 10 && !userId; pagina += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (data.users.length < 1000) break;
}
if (!userId) {
  senha = randomBytes(15).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
  if (error) throw new Error(`Auth: ${error.message}`);
  userId = data.user.id;
}

// 2. Membro ativo, pelo mesmo convite que a tela usa, ativado na mesma transação.
const resultado = await executar(workspaceId, (state) => {
  const proprietario = state.workspace.ownerMemberId;
  const papel = state.roles.find((r) => r.system && r.base === base);
  if (!papel) return { ok: false as const, error: `Papel de sistema “${base}” não encontrado.` };
  const convite = inviteMember(state, proprietario, { email, roleId: papel.id, userId });
  if (!convite.ok) return convite;
  const membro = convite.value;
  membro.state = "ativo";
  membro.joinedAt = new Date().toISOString();
  membro.displayName = nome;
  delete membro.invitedIdentity;
  recordActivity(state, {
    actor: memberActor(proprietario),
    action: "Membro ativado por script",
    objectType: "member",
    objectId: membro.id,
    objectName: membro.displayName,
    before: "pendente",
    after: "ativo",
    detail: "usuarios:criar (sem aceite de convite pela tela)",
  });
  return { ok: true as const, value: { id: membro.id, papel: papel.name } };
});

await pool().end();
if (!resultado.ok) throw new Error("conflito" in resultado ? resultado.error : resultado.error);
console.log(`Membro ${resultado.value.id} ativo como ${resultado.value.papel}.`);
console.log(`E-mail: ${email}`);
console.log(senha ? `Senha (mostrada só agora): ${senha}` : "O Usuário já existia no Auth: a senha não foi alterada.");
