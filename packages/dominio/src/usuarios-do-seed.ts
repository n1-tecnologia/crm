/**
 * O Usuário de cada Membro do seed.
 *
 * `Member.userId` é a identidade global que se autentica (A1.4): na plataforma
 * é o id do usuário no Supabase Auth, um UUID que o Auth gera ao aceitar o
 * convite. O seed não passa por convite, então os UUIDs estão fixos aqui — e
 * o script que cria as contas de teste (`apps/api/src/autenticacao/
 * criar-usuarios-do-seed.ts`) cria cada usuário **com este mesmo id**, para
 * que `members.find((m) => m.userId === user.id)` resolva sem tabela de-para.
 *
 * São literais e não uma derivação porque o seed roda no navegador, onde não
 * há hash síncrono; e porque um id de seed é um literal como qualquer outro.
 */

import type { Id } from "./types";

export const USUARIOS_DO_SEED: Readonly<Record<Id, string>> = {
  mem_thiago: "bb98a2fc-422a-5e28-ab86-9c5c44b2e4f9",
  mem_rafael: "5f72fbb8-a5e1-57f6-8ce8-34b54a17e97e",
  mem_julia: "0f51fc51-549b-5dcb-84d5-19c9ce0c8c36",
  mem_marcos: "9c656561-03ab-52a9-800f-0650cf52c470",
  mem_beatriz: "6a9590ae-69a7-540a-8405-f767b8078afd",
  mem_tiago: "89c6cebe-d209-5eb2-9a1e-e22c87197cff",
  mem_maryane: "4147570e-817f-510a-bf9b-d1115e5ebeb0",
  mem_marcos_paulo: "3495fde6-494c-5e64-8ccc-ebf77e4ebec8",
  mem_walter: "d741cd55-ee04-5591-b2b3-888dad6b790f",
  mem_thiago_pereira: "c1f377ba-0b50-5c20-af34-80c8c5c0afb8",
  mem_joao_konq: "c464d50c-4a84-565c-906a-3e59cf997546",
};

/** O e-mail de teste de cada Membro: `<id sem prefixo>@n1.teste`. */
export function emailDoSeed(memberId: Id): string {
  return `${memberId.replace(/^mem_/, "").replace(/_/g, ".")}@n1.teste`;
}

export function usuarioDoSeed(memberId: Id): string {
  const id = USUARIOS_DO_SEED[memberId];
  if (!id) throw new Error(`Membro "${memberId}" não tem Usuário em usuarios-do-seed.ts.`);
  return id;
}
