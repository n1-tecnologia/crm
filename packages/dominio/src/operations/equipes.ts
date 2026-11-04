/**
 * 12.4.2 — criar, editar e excluir Equipe, e pôr e tirar Membros dela.
 *
 * Só um Administrador ou o Proprietário ativo. RN-ET-12: só Membro `ativo` ou
 * `suspenso` pertence a uma Equipe. Excluir uma Equipe que ainda tem
 * Concessões de acesso é recusado, com a contagem: a Concessão órfã não daria
 * acesso a ninguém, mas sumiria sem que quem exclui soubesse o que a Equipe
 * abria.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Id, Team } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { recusaDeGovernanca } from "./governanca";

const TAMANHO_MAXIMO_DO_NOME = 60;
const TAMANHO_MAXIMO_DA_DESCRICAO = 280;

export interface NovaEquipe {
  readonly nome: string;
  readonly descricao?: string;
}

export interface AlteracaoDeEquipe {
  readonly nome?: string;
  readonly descricao?: string;
}

export function createTeam(state: DataState, actingMemberId: Id, input: NovaEquipe): OperationResult<Team> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "cria uma Equipe");
  if (recusa) return fail(recusa);
  const nome = validarNome(state, input.nome);
  if (!nome.ok) return nome;
  const descricao = validarDescricao(input.descricao);
  if (!descricao.ok) return descricao;

  const equipe: Team = {
    id: nextId("team"),
    workspaceId: state.workspace.id,
    name: nome.value,
    ...(descricao.value ? { description: descricao.value } : {}),
    memberIds: [],
    createdBy: memberActor(actingMemberId),
    createdAt: new Date().toISOString(),
  };
  state.teams.push(equipe);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Equipe criada",
    objectType: "team",
    objectId: equipe.id,
    objectName: equipe.name,
    after: descrever(equipe),
  });
  return ok(equipe, equipe.id);
}

export function updateTeam(state: DataState, actingMemberId: Id, teamId: Id, input: AlteracaoDeEquipe): OperationResult<Team> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "edita uma Equipe");
  if (recusa) return fail(recusa);
  const indice = state.teams.findIndex((t) => t.id === teamId);
  const atual = state.teams[indice];
  if (!atual) return fail("Equipe não encontrada.");

  let nome = atual.name;
  if (input.nome !== undefined) {
    const validado = validarNome(state, input.nome, atual.id);
    if (!validado.ok) return validado;
    nome = validado.value;
  }
  let descricao = atual.description;
  if (input.descricao !== undefined) {
    const validada = validarDescricao(input.descricao);
    if (!validada.ok) return validada;
    descricao = validada.value;
  }
  if (nome === atual.name && (descricao ?? "") === (atual.description ?? "")) return ok(atual, atual.id);

  // `name` e `description` são readonly: a edição troca o objeto no mesmo lugar.
  const { description: _antiga, ...semDescricao } = atual;
  const editada: Team = { ...semDescricao, name: nome, ...(descricao ? { description: descricao } : {}) };
  state.teams[indice] = editada;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Equipe alterada",
    objectType: "team",
    objectId: editada.id,
    objectName: editada.name,
    before: descrever(atual),
    after: descrever(editada),
  });
  return ok(editada, editada.id);
}

export function addMemberToTeam(state: DataState, actingMemberId: Id, teamId: Id, memberId: Id): OperationResult<Team> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "muda os Membros de uma Equipe");
  if (recusa) return fail(recusa);
  const equipe = state.teams.find((t) => t.id === teamId);
  if (!equipe) return fail("Equipe não encontrada.");
  const membro = state.members.find((m) => m.id === memberId);
  if (!membro) return fail("Membro não encontrado.", "membro");
  // RN-ET-12 — pendente ainda não é Membro de fato; removido já não é.
  if (membro.state !== "ativo" && membro.state !== "suspenso") {
    return fail("Só um Membro ativo ou suspenso entra numa Equipe.", "membro");
  }
  if (equipe.memberIds.includes(memberId)) return ok(equipe, equipe.id);
  equipe.memberIds.push(memberId);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Membro adicionado à Equipe",
    objectType: "team",
    objectId: equipe.id,
    objectName: equipe.name,
    before: `${equipe.memberIds.length - 1} Membro(s)`,
    after: `${equipe.memberIds.length} Membro(s), com ${membro.displayName}`,
  });
  return ok(equipe, equipe.id);
}

export function removeMemberFromTeam(state: DataState, actingMemberId: Id, teamId: Id, memberId: Id): OperationResult<Team> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "muda os Membros de uma Equipe");
  if (recusa) return fail(recusa);
  const equipe = state.teams.find((t) => t.id === teamId);
  if (!equipe) return fail("Equipe não encontrada.");
  const indice = equipe.memberIds.indexOf(memberId);
  if (indice < 0) return ok(equipe, equipe.id);
  equipe.memberIds.splice(indice, 1);
  const nome = state.members.find((m) => m.id === memberId)?.displayName ?? memberId;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Membro retirado da Equipe",
    objectType: "team",
    objectId: equipe.id,
    objectName: equipe.name,
    before: `${equipe.memberIds.length + 1} Membro(s), com ${nome}`,
    after: `${equipe.memberIds.length} Membro(s)`,
  });
  return ok(equipe, equipe.id);
}

export function deleteTeam(state: DataState, actingMemberId: Id, teamId: Id): OperationResult<void> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "exclui uma Equipe");
  if (recusa) return fail(recusa);
  const indice = state.teams.findIndex((t) => t.id === teamId);
  const equipe = state.teams[indice];
  if (!equipe) return fail("Equipe não encontrada.");
  const concessoes = state.grants.filter((g) => g.subjectKind === "team" && g.subjectId === teamId).length;
  if (concessoes > 0) {
    return fail(
      `A Equipe tem ${concessoes} concessão(ões) de acesso. Revogue-as antes de excluir a Equipe.`,
    );
  }
  state.teams.splice(indice, 1);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Equipe excluída",
    objectType: "team",
    objectId: equipe.id,
    objectName: equipe.name,
    before: descrever(equipe),
  });
  return ok(undefined);
}

function validarNome(state: DataState, bruto: string, propriaId?: Id): OperationResult<string> {
  const nome = bruto.trim();
  if (!nome) return fail("Dê um nome à Equipe.", "nome");
  if (nome.length > TAMANHO_MAXIMO_DO_NOME) {
    return fail(`O nome da Equipe tem no máximo ${TAMANHO_MAXIMO_DO_NOME} caracteres.`, "nome");
  }
  const igual = state.teams.find((t) => t.id !== propriaId && t.name.trim().toLowerCase() === nome.toLowerCase());
  if (igual) return fail(`Já existe uma Equipe chamada "${igual.name}".`, "nome");
  return ok(nome);
}

function validarDescricao(bruta: string | undefined): OperationResult<string | undefined> {
  const descricao = bruta?.trim() ?? "";
  if (descricao.length > TAMANHO_MAXIMO_DA_DESCRICAO) {
    return fail(`A descrição tem no máximo ${TAMANHO_MAXIMO_DA_DESCRICAO} caracteres.`, "descricao");
  }
  return ok(descricao || undefined);
}

function descrever(equipe: Team): string {
  return equipe.description ? `${equipe.name} · ${equipe.description}` : equipe.name;
}
