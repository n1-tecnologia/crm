/**
 * `alterarPapelDoMembro` — a troca de Papel que a tela de Membro fazia só na
 * cópia do store (e se perdia no servidor). Mesmas regras que a tela já
 * aplicava, agora no domínio.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Member } from "../types";
import { alterarPapelDoMembro } from "./members";

let state: DataState;
const base = (m: Member) => state.roles.find((r) => r.id === m.roleId)?.base;
const papelDeBase = (b: string) => state.roles.find((r) => r.base === b)!;

beforeEach(() => {
  state = buildSeed();
});

describe("alterarPapelDoMembro", () => {
  it("Administrador troca o Papel de um Membro comum e a troca fica na Atividade", () => {
    const dono = state.workspace.ownerMemberId;
    const alvo = state.members.find((m) => m.id !== dono && base(m) === "membro" && m.state === "ativo")!;
    const novo = papelDeBase("administrador");
    const antes = state.activity.length;
    const r = alterarPapelDoMembro(state, dono, { memberId: alvo.id, roleId: novo.id });
    expect(r.ok).toBe(true);
    expect(alvo.roleId).toBe(novo.id);
    expect(state.activity.length).toBe(antes + 1);
    expect(state.activity.find((a) => a.action === "Papel alterado" && a.objectId === alvo.id)?.after).toBe(novo.name);
  });

  it("quem não é Administrador nem Proprietário: recusa", () => {
    const comum = state.members.find((m) => base(m) === "membro" && m.state === "ativo")!;
    const outro = state.members.find((m) => m.id !== comum.id && base(m) === "membro" && m.state === "ativo")!;
    const r = alterarPapelDoMembro(state, comum.id, { memberId: outro.id, roleId: papelDeBase("administrador").id });
    expect(r.ok).toBe(false);
  });

  it("o Proprietário não muda de Papel por aqui, e ninguém vira Proprietário por aqui", () => {
    const dono = state.workspace.ownerMemberId;
    const admin = state.members.find((m) => base(m) === "administrador" && m.state === "ativo" && m.id !== dono)!;
    expect(alterarPapelDoMembro(state, admin.id, { memberId: dono, roleId: papelDeBase("membro").id }).ok).toBe(false);
    const alvo = state.members.find((m) => m.id !== dono && base(m) === "membro" && m.state === "ativo")!;
    expect(alterarPapelDoMembro(state, dono, { memberId: alvo.id, roleId: papelDeBase("proprietario").id }).ok).toBe(false);
  });

  it("rebaixar a Convidado quem ainda é dono de registros: recusa com a contagem", () => {
    const dono = state.workspace.ownerMemberId;
    const comRegistros = state.members.find(
      (m) => m.id !== dono && m.state === "ativo" && base(m) !== "convidado" && state.contacts.some((c) => c.ownerMemberId === m.id),
    )!;
    const r = alterarPapelDoMembro(state, dono, { memberId: comRegistros.id, roleId: papelDeBase("convidado").id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/exige transferir \d+ registro/);
  });

  it("o mesmo Papel: nada muda, nada é registrado", () => {
    const dono = state.workspace.ownerMemberId;
    const alvo = state.members.find((m) => m.id !== dono && base(m) === "membro" && m.state === "ativo")!;
    const antes = state.activity.length;
    expect(alterarPapelDoMembro(state, dono, { memberId: alvo.id, roleId: alvo.roleId }).ok).toBe(true);
    expect(state.activity.length).toBe(antes);
  });
});
