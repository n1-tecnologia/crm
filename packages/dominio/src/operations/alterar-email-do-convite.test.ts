/**
 * `alterarEmailDoConvite` — o e-mail de um Membro que ainda não tem login.
 * Nasceu para o Aprovador do Financeiro (`mem_marcos_paulo`), criado no Espaço
 * de produção com e-mail provisório e SEM convite enviado (2026-09-28), para o
 * dono trocar o e-mail pela tela quando souber o certo.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Member } from "../types";
import { alterarEmailDoConvite, inviteMember } from "./members";

let state: DataState;
let dono: string;
let comum: string;

function semLogin(id: string, estado: Member["state"], email?: string): Member {
  const membro = {
    id,
    workspaceId: state.workspace.id,
    displayName: "Aprovador Provisório",
    state: estado,
    roleId: state.members.find((m) => m.id === comum)!.roleId,
    availability: { value: "disponivel", at: new Date().toISOString(), origin: "membro" },
    userMemory: { enabled: true, items: [] },
    ...(email ? { invitedIdentity: { type: "email" as const, value: email } } : {}),
  } as Member;
  state.members.push(membro);
  return membro;
}

beforeEach(() => {
  state = buildSeed();
  const base = (m: Member) => state.roles.find((r) => r.id === m.roleId)?.base;
  dono = state.members.find((m) => base(m) === "proprietario" && m.state === "ativo")!.id;
  comum = state.members.find((m) => base(m) !== "proprietario" && base(m) !== "administrador" && m.state === "ativo")!.id;
  // O limite do seed pode estar no teto: estes testes falam de e-mail, não de limite.
  (state.workspace.limits as { members: number }).members = 10_000;
});

describe("alterarEmailDoConvite", () => {
  it("Membro ATIVO sem login (o caso do Aprovador provisório): troca o e-mail e registra antes/depois", () => {
    const membro = semLogin("mem_provisorio", "ativo", "provisorio@exemplo.com");
    const antes = state.activity.length;
    const r = alterarEmailDoConvite(state, dono, { memberId: membro.id, email: "  Certo@Exemplo.COM " });
    expect(r.ok).toBe(true);
    expect(membro.invitedIdentity).toEqual({ type: "email", value: "certo@exemplo.com" });
    expect(membro.state).toBe("ativo");
    expect(state.activity.length).toBe(antes + 1);
    const registro = state.activity.find((a) => a.action === "E-mail do convite alterado" && a.objectId === membro.id);
    expect(registro?.before).toBe("provisorio@exemplo.com");
    expect(registro?.after).toBe("certo@exemplo.com");
  });

  it("Membro PENDENTE de um convite: troca o e-mail do convite", () => {
    const convite = inviteMember(state, dono, { email: "errado@exemplo.com", roleId: state.members.find((m) => m.id === comum)!.roleId });
    expect(convite.ok).toBe(true);
    if (!convite.ok) return;
    const r = alterarEmailDoConvite(state, dono, { memberId: convite.value.id, email: "certo@exemplo.com" });
    expect(r.ok).toBe(true);
    expect(convite.value.invitedIdentity?.value).toBe("certo@exemplo.com");
  });

  it("Membro com login: recusa — o e-mail é o da conta dele", () => {
    const comLogin = state.members.find((m) => m.userId && m.state === "ativo" && m.id !== dono)!;
    const r = alterarEmailDoConvite(state, dono, { memberId: comLogin.id, email: "outro@exemplo.com" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/já tem login/);
  });

  it("quem não é Administrador nem Proprietário: recusa", () => {
    const membro = semLogin("mem_provisorio", "ativo", "provisorio@exemplo.com");
    const r = alterarEmailDoConvite(state, comum, { memberId: membro.id, email: "certo@exemplo.com" });
    expect(r.ok).toBe(false);
    expect(membro.invitedIdentity?.value).toBe("provisorio@exemplo.com");
  });

  it("e-mail inválido e e-mail de outro Membro: recusa sem mudar nada", () => {
    semLogin("mem_outro", "pendente", "ocupado@exemplo.com");
    const membro = semLogin("mem_provisorio", "ativo", "provisorio@exemplo.com");
    expect(alterarEmailDoConvite(state, dono, { memberId: membro.id, email: "sem-arroba" }).ok).toBe(false);
    const repetido = alterarEmailDoConvite(state, dono, { memberId: membro.id, email: "OCUPADO@exemplo.com" });
    expect(repetido.ok).toBe(false);
    if (!repetido.ok) expect(repetido.error).toMatch(/outro Membro/);
    expect(membro.invitedIdentity?.value).toBe("provisorio@exemplo.com");
  });

  it("o mesmo e-mail: nada muda, nada é registrado", () => {
    const membro = semLogin("mem_provisorio", "ativo", "provisorio@exemplo.com");
    const antes = state.activity.length;
    const r = alterarEmailDoConvite(state, dono, { memberId: membro.id, email: "PROVISORIO@exemplo.com" });
    expect(r.ok).toBe(true);
    expect(state.activity.length).toBe(antes);
  });
});
