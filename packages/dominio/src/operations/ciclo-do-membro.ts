/**
 * 12.3.3 e 12.3.7 — o ciclo de vida do Membro depois do convite: aceitar,
 * suspender e reativar.
 *
 * Decisão 12.1.5 (B): o suspenso fica SEM acesso (não entra, como um
 * removido), mas volta com o histórico ao ser reativado — por isso suspender
 * não mexe em Equipes (RN-ET-12 aceita `suspenso`), Concessões nem
 * propriedades. Quem barra a entrada é o hook de autenticação da api; aqui
 * fica só a transição de estado e o seu registro.
 *
 * Mora fora de `members.ts` para não disputar o arquivo com a Sessão 3.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Id, Member } from "../types";
import { memberActor, recordActivity } from "./activity";
import { recusaDeGovernanca } from "./governanca";

const TAMANHO_MAXIMO_DO_NOME = 80;

/**
 * Quem chama é o próprio convidado: um Membro `pendente` que já tem Usuário
 * (`userId`), porque só um Usuário autenticado chega aqui. Passa a `ativo`,
 * ganha `joinedAt`, perde `invitedIdentity` (B27: o e-mail passa a ser o da
 * conta) e o nome informado vira o `displayName`.
 */
export function aceitarConvite(state: DataState, actingMemberId: Id, input: { readonly nome: string }): OperationResult<Member> {
  const membro = state.members.find((m) => m.id === actingMemberId);
  if (!membro || membro.state !== "pendente" || !membro.userId) return fail("Não há convite pendente para aceitar.");
  const nome = input.nome.trim();
  if (!nome) return fail("Informe o seu nome.", "nome");
  if (nome.length > TAMANHO_MAXIMO_DO_NOME) return fail(`O nome tem no máximo ${TAMANHO_MAXIMO_DO_NOME} caracteres.`, "nome");

  membro.state = "ativo";
  membro.joinedAt = new Date().toISOString();
  delete membro.invitedIdentity;
  membro.displayName = nome;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Convite aceito",
    objectType: "member",
    objectId: membro.id,
    objectName: membro.displayName,
    before: "pendente",
    after: "ativo",
  });
  return ok(membro, membro.id);
}

/**
 * 12.3.2 — o reenvio do convite, chamado pelo serviço da api DEPOIS de o
 * Supabase Auth reenviar o e-mail. NÃO entra em `OPERACOES` (T-1-08): o
 * `userId` vem do Auth, nunca do corpo de uma requisição, e uma operação no
 * registro deixaria o cliente escolher a conta de outra pessoa.
 *
 * O convite feito antes da Sessão 12 não tem Usuário (`userId`): o reenvio cria
 * a conta no Auth e o vínculo nasce aqui. Um Membro que já tem conta não muda
 * de conta por reenvio.
 */
export function registrarReenvioDoConvite(
  state: DataState,
  actingMemberId: Id,
  input: { readonly memberId: Id; readonly userId?: Id },
): OperationResult<Member> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "reenvia um convite");
  if (recusa) return fail(recusa);
  const membro = state.members.find((m) => m.id === input.memberId);
  if (!membro || membro.state !== "pendente") return fail("Só um convite pendente pode ser reenviado.");
  if (input.userId !== undefined && membro.userId !== undefined && membro.userId !== input.userId) {
    return fail("Este convite já está ligado a outra conta.");
  }
  if (input.userId !== undefined) membro.userId = input.userId;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Convite reenviado",
    objectType: "member",
    objectId: membro.id,
    objectName: membro.displayName,
  });
  return ok(membro, membro.id);
}

/** Só um Membro `ativo` é suspenso; nunca o Proprietário, nunca quem suspende. */
export function suspenderMembro(state: DataState, actingMemberId: Id, memberId: Id): OperationResult<Member> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "suspende um Membro");
  if (recusa) return fail(recusa);
  const membro = state.members.find((m) => m.id === memberId);
  if (!membro || membro.state === "removido") return fail("Membro não encontrado.");
  if (state.workspace.ownerMemberId === membro.id) return fail("O Proprietário do Espaço de Trabalho não pode ser suspenso.");
  if (membro.id === actingMemberId) return fail("Você não pode suspender a si mesmo.");
  if (membro.state === "suspenso") return ok(membro, membro.id);
  if (membro.state !== "ativo") return fail("Só um Membro ativo é suspenso. Um convite pendente se cancela removendo o Membro.");

  membro.state = "suspenso";
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Membro suspenso",
    objectType: "member",
    objectId: membro.id,
    objectName: membro.displayName,
    before: "ativo",
    after: "suspenso",
  });
  return ok(membro, membro.id);
}

export function reativarMembro(state: DataState, actingMemberId: Id, memberId: Id): OperationResult<Member> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "reativa um Membro");
  if (recusa) return fail(recusa);
  const membro = state.members.find((m) => m.id === memberId);
  if (!membro || membro.state === "removido") return fail("Membro não encontrado.");
  if (membro.state === "ativo") return ok(membro, membro.id);
  if (membro.state !== "suspenso") return fail("Só um Membro suspenso é reativado.");

  membro.state = "ativo";
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Membro reativado",
    objectType: "member",
    objectId: membro.id,
    objectName: membro.displayName,
    before: "suspenso",
    after: "ativo",
  });
  return ok(membro, membro.id);
}
