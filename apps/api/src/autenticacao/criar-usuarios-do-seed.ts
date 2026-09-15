/**
 * Cria no Supabase Auth um Usuário para cada Membro do seed — com o **mesmo
 * id** que `Member.userId` carrega. É o que faz o login resolver o Membro sem
 * tabela de-para: `members.find((m) => m.userId === user.id)`.
 *
 * Idempotente: quem já existe é pulado. A senha é uma só para todos, de
 * desenvolvimento, e vem de `SEED_SENHA` (padrão abaixo). Nada disto serve
 * para produção — lá o Usuário nasce ao aceitar um convite, com senha própria.
 *
 *   npm run usuarios:seed -w @n1/api
 */

import { createClient } from "@supabase/supabase-js";
import { USUARIOS_DO_SEED, emailDoSeed } from "@n1/dominio";
import { carregarEnv } from "../persistencia/conexao";

carregarEnv();
const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
if (!url || !chave) throw new Error("SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar em apps/api/.env.");

const senha = process.env.SEED_SENHA ?? "n1-teste-2026";
const admin = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: existentes, error: erroLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (erroLista) throw erroLista;
const jaExistem = new Set(existentes.users.map((u) => u.id));

let criados = 0;
for (const [memberId, id] of Object.entries(USUARIOS_DO_SEED)) {
  const email = emailDoSeed(memberId);
  if (jaExistem.has(id)) {
    console.log(`existe   ${email}`);
    continue;
  }
  const { error } = await admin.auth.admin.createUser({
    id,
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { member_id: memberId },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  console.log(`criado   ${email}`);
  criados += 1;
}
console.log(`\n${criados} criado(s) · senha de desenvolvimento: ${senha}`);
