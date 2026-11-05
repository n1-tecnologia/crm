/**
 * 12.4.2 e 12.5.3 — as operações de Equipe: criar, editar, pôr e tirar Membro,
 * excluir. Recusa o Membro `removido` (RN-ET-12) e a exclusão de Equipe com
 * Concessão. Cada ato grava Atividade com quem, quando, antes e depois.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Member, Team } from "../types";
import { addMemberToTeam, createTeam, deleteTeam, removeMemberFromTeam, updateTeam } from "./equipes";

let state: DataState;
let dono: string;
const base = (m: Member) => state.roles.find((r) => r.id === m.roleId)?.base;
const comum = () => state.members.find((m) => m.state === "ativo" && base(m) === "membro")!;
const ultimaAtividade = () => state.activity[0]!;

function novaEquipe(nome = "Suporte"): Team {
  const r = createTeam(state, dono, { nome, descricao: "Atendimento de 2º nível" });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

beforeEach(() => {
  state = buildSeed();
  dono = state.workspace.ownerMemberId;
});

describe("createTeam", () => {
  it("cria a Equipe vazia e grava a Atividade", () => {
    const equipe = novaEquipe();
    expect(state.teams).toContain(equipe);
    expect(equipe).toMatchObject({ name: "Suporte", description: "Atendimento de 2º nível", memberIds: [], createdBy: { kind: "member", id: dono } });
    expect(ultimaAtividade()).toMatchObject({ action: "Equipe criada", objectType: "team", objectId: equipe.id, after: "Suporte · Atendimento de 2º nível" });
  });

  it("recusa nome vazio, nome repetido e quem não governa", () => {
    expect(createTeam(state, dono, { nome: " " })).toMatchObject({ ok: false, field: "nome" });
    const existente = state.teams[0]!;
    expect(createTeam(state, dono, { nome: existente.name.toUpperCase() })).toMatchObject({ ok: false, field: "nome" });
    expect(createTeam(state, comum().id, { nome: "Outra" }).ok).toBe(false);
  });
});

describe("updateTeam", () => {
  it("troca nome e descrição, e a Atividade guarda antes e depois", () => {
    const equipe = novaEquipe();
    expect(updateTeam(state, dono, equipe.id, { nome: "Suporte N2", descricao: "" }).ok).toBe(true);
    const editada = state.teams.find((t) => t.id === equipe.id)!;
    expect(editada.name).toBe("Suporte N2");
    expect(editada.description).toBeUndefined();
    expect(ultimaAtividade()).toMatchObject({
      action: "Equipe alterada",
      before: "Suporte · Atendimento de 2º nível",
      after: "Suporte N2",
    });
  });
});

describe("addMemberToTeam e removeMemberFromTeam", () => {
  it("põe um Membro ativo e um suspenso, e tira", () => {
    const equipe = novaEquipe();
    const ativo = comum();
    const suspenso = state.members.find((m) => m.state === "ativo" && m.id !== ativo.id && m.id !== dono)!;
    suspenso.state = "suspenso";

    expect(addMemberToTeam(state, dono, equipe.id, ativo.id).ok).toBe(true);
    expect(ultimaAtividade()).toMatchObject({ action: "Membro adicionado à Equipe", objectId: equipe.id, before: "0 Membro(s)" });
    expect(ultimaAtividade().after).toContain(ativo.displayName);
    expect(addMemberToTeam(state, dono, equipe.id, suspenso.id).ok).toBe(true);
    expect(state.teams.find((t) => t.id === equipe.id)!.memberIds).toEqual([ativo.id, suspenso.id]);

    expect(removeMemberFromTeam(state, dono, equipe.id, ativo.id).ok).toBe(true);
    expect(state.teams.find((t) => t.id === equipe.id)!.memberIds).toEqual([suspenso.id]);
    expect(ultimaAtividade()).toMatchObject({ action: "Membro retirado da Equipe", after: "1 Membro(s)" });
    expect(ultimaAtividade().before).toContain(ativo.displayName);
  });

  it("recusa Membro removido e pendente (RN-ET-12)", () => {
    const equipe = novaEquipe();
    const removido = state.members.find((m) => m.state === "removido")!;
    expect(addMemberToTeam(state, dono, equipe.id, removido.id)).toMatchObject({ ok: false, field: "membro" });
    const pendente = comum();
    pendente.state = "pendente";
    expect(addMemberToTeam(state, dono, equipe.id, pendente.id)).toMatchObject({ ok: false, field: "membro" });
    expect(state.teams.find((t) => t.id === equipe.id)!.memberIds).toEqual([]);
  });

  it("pôr quem já está, ou tirar quem não está, não registra nada", () => {
    const equipe = novaEquipe();
    addMemberToTeam(state, dono, equipe.id, comum().id);
    const antes = state.activity.length;
    expect(addMemberToTeam(state, dono, equipe.id, comum().id).ok).toBe(true);
    expect(removeMemberFromTeam(state, dono, equipe.id, "mem_fora").ok).toBe(true);
    expect(state.activity.length).toBe(antes);
  });

  it("recusa quem não governa", () => {
    const equipe = novaEquipe();
    expect(addMemberToTeam(state, comum().id, equipe.id, comum().id).ok).toBe(false);
  });
});

describe("deleteTeam", () => {
  it("exclui a Equipe sem Concessão e grava a Atividade", () => {
    const equipe = novaEquipe();
    expect(deleteTeam(state, dono, equipe.id).ok).toBe(true);
    expect(state.teams.some((t) => t.id === equipe.id)).toBe(false);
    expect(ultimaAtividade()).toMatchObject({ action: "Equipe excluída", objectId: equipe.id, objectName: "Suporte" });
  });

  it("recusa a Equipe com Concessão e diz quantas", () => {
    const equipe = novaEquipe();
    for (const action of ["ver", "editar"] as const) {
      state.grants.push({
        id: `grn_t_${action}`,
        workspaceId: state.workspace.id,
        subjectKind: "team",
        subjectId: equipe.id,
        action,
        resourceType: "list",
        resourceId: state.lists[0]!.id,
        scope: "subarvore",
        origin: "concessaoDireta",
        grantedBy: dono,
        grantedAt: new Date().toISOString(),
      });
    }
    const r = deleteTeam(state, dono, equipe.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("2 concessão(ões)");
    expect(state.teams.some((t) => t.id === equipe.id)).toBe(true);
  });
});
