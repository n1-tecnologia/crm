/**
 * 12.3.2 — reenviar o convite de um Membro `pendente`.
 *
 * Mesmo desenho de `convidar-membro.ts`: ensaia a regra do domínio
 * (`registrarReenvioDoConvite`: só Administrador ou Proprietário ativo, só
 * convite pendente) ANTES de falar com o Auth, para que nenhum e-mail saia de
 * um pedido que seria recusado. Depois:
 *
 * - convite sem e-mail guardado (o Membro removido e reconvidado já tem conta):
 *   não há o que reenviar, a pessoa entra com a senha dela;
 * - convite com Usuário (feito na Sessão 12): o Auth reenvia; se a pessoa já
 *   criou a senha, não há o que reenviar;
 * - convite sem Usuário (feito antes da Sessão 12): se o e-mail já tem conta,
 *   o convite passa a apontar para ela, sem e-mail; se não tem, o Auth cria a
 *   conta e manda o convite, e um Usuário criado por um reenvio que o domínio
 *   acabou recusando é apagado.
 *
 * O `userId` nunca vem do cliente (T-1-08): `registrarReenvioDoConvite` fica
 * fora de `OPERACOES`.
 */

import type { Member } from "@n1/dominio";
import { registrarReenvioDoConvite } from "@n1/dominio/operations/ciclo-do-membro";
import { authDeConviteDoSupabase, ContaJaConfirmada, type AuthDeConvite } from "../autenticacao/auth-de-convite";
import { resolverUsuarioPorEmail, type ResolverUsuario } from "../autenticacao/resolver-usuario";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";

export interface PedidoDeReenvio {
  readonly workspaceId: string;
  readonly actingMemberId: string;
  readonly memberId: string;
}

export type ResultadoDoReenvio =
  | { readonly ok: true; readonly enviado: boolean; readonly aviso?: string }
  | { readonly ok: false; readonly status: 400 | 409; readonly error: string };

export const AVISO_JA_TEM_CONTA = "Esta pessoa já tem conta: ela entra com a senha dela e aceita o convite no primeiro acesso.";
export const AVISO_JA_CRIOU_SENHA = "Esta pessoa já criou a senha: ela entra com ela e aceita o convite no primeiro acesso.";

export async function reenviarConvite(
  pedido: PedidoDeReenvio,
  deps: { readonly auth?: AuthDeConvite; readonly resolverUsuario?: ResolverUsuario } = {},
): Promise<ResultadoDoReenvio> {
  const auth = deps.auth ?? authDeConviteDoSupabase;
  const resolver = deps.resolverUsuario ?? resolverUsuarioPorEmail;

  // O ensaio: a regra do domínio sobre o estado lido agora, numa cópia que ninguém grava.
  const membro = await ensaiar(pedido);
  if (!membro.ok) return { ok: false, status: 400, error: membro.error };

  const email = membro.value.invitedIdentity?.value;
  if (!email) return { ok: false, status: 409, error: AVISO_JA_TEM_CONTA };

  let userId: string | undefined;
  let criado: string | undefined;
  let enviado = false;
  try {
    if (membro.value.userId !== undefined) {
      // A conta já está ligada ao convite: o Auth só reenvia, e nada muda de vínculo.
      await auth.reenviar(email);
      enviado = true;
    } else {
      userId = await resolver(email);
      if (userId === undefined) {
        criado = await auth.convidar(email);
        userId = criado;
        enviado = true;
      }
    }
  } catch (erro) {
    if (erro instanceof ContaJaConfirmada) return { ok: false, status: 409, error: AVISO_JA_CRIOU_SENHA };
    throw erro;
  }

  const resultado = await executar(pedido.workspaceId, (state) =>
    registrarReenvioDoConvite(state, pedido.actingMemberId, { memberId: pedido.memberId, ...(userId !== undefined ? { userId } : {}) }),
  ).catch(async (erro: unknown) => {
    if (criado !== undefined) await auth.apagar(criado);
    throw erro;
  });
  if (!resultado.ok) {
    if (criado !== undefined) await auth.apagar(criado);
    return { ok: false, status: "conflito" in resultado ? 409 : 400, error: resultado.error };
  }
  return enviado ? { ok: true, enviado } : { ok: true, enviado, aviso: AVISO_JA_TEM_CONTA };
}

async function ensaiar(pedido: PedidoDeReenvio): Promise<{ ok: true; value: Member } | { ok: false; error: string }> {
  const cliente = await pool().connect();
  try {
    const { state } = await hidratar(cliente, pedido.workspaceId);
    const r = registrarReenvioDoConvite(state, pedido.actingMemberId, { memberId: pedido.memberId });
    return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
  } finally {
    cliente.release();
  }
}
