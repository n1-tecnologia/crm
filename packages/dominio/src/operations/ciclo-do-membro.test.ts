/**
 * 12.3.3, 12.3.7 e 12.5.3 — aceitar convite, suspender e reativar: as
 * transições, as recusas e a Atividade de cada ato (quem, quando, antes e
 * depois).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Member } from "../types";
import { aceitarConvite, reativarMembro, suspenderMembro } from "./ciclo-do-membro";
import { inviteMember } from "./members";

let state: DataState;
let dono: string;
const base = (m: Member) => state.roles.find((r) => r.id === m.roleId)?.base;
const comum = () => state.members.find((m) => m.state === "ativo" && base(m) === "membro" && m.id !== dono)!;
const admin = () => state.members.find((m) => m.state === "ativo" && base(m) === "administrador" && m.id !== dono)!;
const ultimaAtividade = () => state.activity[0]!;

function convidado(userId?: string): Member {
  const r = inviteMember(state, dono, { email: "nova@tria.com.br", roleId: "role_mem", ...(userId ? { userId } : {}) });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

beforeEach(() => {
  state = buildSeed();
  dono = state.workspace.ownerMemberId;
});

describe("aceitarConvite", () => {
  it("o pendente com Usuário passa a ativo, ganha nome e joinedAt, e perde o e-mail do convite", () => {
    const membro = convidado("usr_nova");
    const r = aceitarConvite(state, membro.id, { nome: "  Nova Pessoa " });
    expect(r.ok).toBe(true);
    expect(membro.state).toBe("ativo");
    expect(membro.displayName).toBe("Nova Pessoa");
    expect(membro.joinedAt).toBeTruthy();
    expect(membro.invitedIdentity).toBeUndefined();
    expect(ultimaAtividade()).toMatchObject({
      action: "Convite aceito",
      actor: { kind: "member", id: membro.id },
      objectId: membro.id,
      before: "pendente",
      after: "ativo",
    });
  });

  it("recusa sem Usuário, quem já é ativo e nome vazio", () => {
    const semUsuario = convidado();
    expect(aceitarConvite(state, semUsuario.id, { nome: "X" }).ok).toBe(false);
    expect(semUsuario.state).toBe("pendente");
    expect(aceitarConvite(state, comum().id, { nome: "X" }).ok).toBe(false);
    const outro = state.members.find((m) => m.id === semUsuario.id)!;
    outro.userId = "usr_x";
    expect(aceitarConvite(state, outro.id, { nome: "  " })).toMatchObject({ ok: false, field: "nome" });
    expect(outro.state).toBe("pendente");
  });
});

describe("suspenderMembro e reativarMembro", () => {
  it("ida e volta: ativo → suspenso → ativo, com a Atividade de cada ato; as Equipes ficam", () => {
    const alvo = state.members.find((m) => m.id === "mem_julia")!;
    const equipesAntes = state.teams.filter((t) => t.memberIds.includes(alvo.id)).map((t) => t.id);
    expect(equipesAntes.length).toBeGreaterThan(0);

    expect(suspenderMembro(state, dono, alvo.id).ok).toBe(true);
    expect(alvo.state).toBe("suspenso");
    expect(ultimaAtividade()).toMatchObject({ action: "Membro suspenso", actor: { kind: "member", id: dono }, objectId: alvo.id, before: "ativo", after: "suspenso" });
    expect(state.teams.filter((t) => t.memberIds.includes(alvo.id)).map((t) => t.id)).toEqual(equipesAntes);

    expect(reativarMembro(state, dono, alvo.id).ok).toBe(true);
    expect(alvo.state).toBe("ativo");
    expect(ultimaAtividade()).toMatchObject({ action: "Membro reativado", objectId: alvo.id, before: "suspenso", after: "ativo" });
  });

  it("um Administrador suspende outro Membro", () => {
    expect(suspenderMembro(state, admin().id, comum().id).ok).toBe(true);
  });

  it("recusa suspender o Proprietário, a si mesmo e um pendente", () => {
    expect(suspenderMembro(state, admin().id, dono).ok).toBe(false);
    const adm = admin();
    expect(suspenderMembro(state, adm.id, adm.id).ok).toBe(false);
    const pendente = convidado();
    expect(suspenderMembro(state, dono, pendente.id).ok).toBe(false);
    expect(pendente.state).toBe("pendente");
  });

  it("recusa quem não governa, e o Administrador suspenso", () => {
    const alvo = state.members.find((m) => m.id === "mem_julia")!;
    expect(suspenderMembro(state, comum().id, alvo.id).ok).toBe(false);
    const adm = admin();
    suspenderMembro(state, dono, adm.id);
    expect(suspenderMembro(state, adm.id, alvo.id).ok).toBe(false);
    expect(reativarMembro(state, adm.id, adm.id).ok).toBe(false);
    expect(alvo.state).toBe("ativo");
  });

  it("reativar recusa quem não está suspenso e o removido", () => {
    const pendente = convidado();
    expect(reativarMembro(state, dono, pendente.id).ok).toBe(false);
    const removido = state.members.find((m) => m.state === "removido")!;
    expect(reativarMembro(state, dono, removido.id).ok).toBe(false);
  });
});
