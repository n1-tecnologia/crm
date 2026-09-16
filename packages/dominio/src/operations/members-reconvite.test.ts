/**
 * PERS-09 — reconvidar por `userId` reativa o MESMO Membro `removido`
 * (RN-ET-11, INV-ET-04), mesmo quando `invitedIdentity` já sumiu (B27,
 * Pitfall 5 do RESEARCH.md). Arquivo novo para não tocar
 * `operations.test.ts`, que já cobre o caminho sem `userId`.
 *
 * `mem_tiago` (seed.ts) é a fixture: `removido`, com `userId` (via
 * `usuarioDoSeed`) e SEM `invitedIdentity` — exatamente o estado em que um
 * Membro fica depois de aceitar um convite e ser removido, quando o e-mail
 * não está guardado em lugar nenhum do `DataState`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { USUARIOS_DO_SEED, emailDoSeed } from "../usuarios-do-seed";
import type { DataState } from "../state";
import { inviteMember } from "./members";

const THIAGO = "mem_thiago"; // ativo, Proprietário — pode convidar
const FAKE_USER_ID = "11111111-1111-1111-1111-111111111111";

describe("inviteMember — reconvite por userId (PERS-09, RN-ET-11)", () => {
  let state: DataState;

  beforeEach(() => {
    state = buildSeed();
  });

  it("(a) casa por userId e reativa o MESMO Membro removido, mesmo sem invitedIdentity", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");
    const before = state.members.length;

    const result = inviteMember(state, THIAGO, {
      email: emailDoSeed("mem_tiago"),
      roleId: role.id,
      userId: USUARIOS_DO_SEED.mem_tiago,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria reconvidar");
    expect(result.value.id).toBe("mem_tiago");
    expect(result.value.state).toBe("pendente");
    expect(state.members.length).toBe(before);
    expect(result.value.userId).toBe(USUARIOS_DO_SEED.mem_tiago);
    expect(result.value.removedAt).toBeUndefined();
    expect(state.activity[0]?.action).toBe("Membro reconvidado");
  });

  it("(b) sem userId, o mesmo e-mail cria um Membro NOVO — a lacuna que o serviço de apps/api fecha", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");
    const before = state.members.length;

    const result = inviteMember(state, THIAGO, { email: emailDoSeed("mem_tiago"), roleId: role.id });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria convidar");
    expect(result.value.id).not.toBe("mem_tiago");
    expect(state.members.length).toBe(before + 1);
  });

  it("(c) userId de um Membro ativo recusa — o e-mail já pertence a alguém que não está removido", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");
    const before = state.members.length;

    const result = inviteMember(state, THIAGO, {
      email: "novato@empresa.com.br",
      roleId: role.id,
      userId: USUARIOS_DO_SEED.mem_thiago, // mem_thiago está ativo
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("já pertence a um Membro");
    expect(state.members.length).toBe(before);
  });

  it("(d) e-mail inédito + userId inédito cria Membro novo pendente com userId E invitedIdentity", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");
    const before = state.members.length;

    const result = inviteMember(state, THIAGO, {
      email: "novissimo@empresa.com.br",
      roleId: role.id,
      userId: FAKE_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria convidar");
    expect(state.members.length).toBe(before + 1);
    expect(result.value.state).toBe("pendente");
    expect(result.value.userId).toBe(FAKE_USER_ID);
    expect(result.value.invitedIdentity?.value).toBe("novissimo@empresa.com.br");
  });

  it("(e) userId presente mas e-mail inválido recusa no campo email — a validação continua antes da busca", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");

    const result = inviteMember(state, THIAGO, {
      email: "não-é-um-email",
      roleId: role.id,
      userId: FAKE_USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.field).toBe("email");
  });

  it("(f) reconvite reativado pelo caminho userId respeita o limite RN-ET-23", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");

    const convite = inviteMember(state, THIAGO, {
      email: "userlimite@empresa.com.br",
      roleId: role.id,
      userId: FAKE_USER_ID,
    });
    if (!convite.ok) throw new Error("convite inicial falhou");
    convite.value.state = "removido";
    // RN-ET-23 — o teto conta os não removidos; forçar o limite no ponto atual.
    Object.assign(state.workspace.limits, {
      members: state.members.filter((m) => m.state !== "removido").length,
    });

    const reconvite = inviteMember(state, THIAGO, {
      email: "userlimite@empresa.com.br",
      roleId: role.id,
      userId: FAKE_USER_ID,
    });

    expect(reconvite.ok).toBe(false);
    expect(convite.value.state).toBe("removido");
  });
});

// Os casos (a)–(f) acima cobrem o caminho de um Membro que já foi `ativo` e
// tem `userId` desde a criação. Os casos abaixo cobrem o caminho irmão do
// (a): um Membro que NUNCA aceitou, nasceu `pendente` só com `invitedIdentity`
// (sem `userId`), e cujo e-mail passa a resolver um `userId` depois — CR-01
// do `01-REVIEW.md`.
describe("inviteMember — os dois critérios em paralelo (CR-01, RN-ET-11/INV-ET-04)", () => {
  let state: DataState;

  beforeEach(() => {
    state = buildSeed();
  });

  it("(g) pendente por invitedIdentity + userId resolvido depois → recusa 'Já existe um convite pendente', não cria um segundo Membro", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");

    const primeiro = inviteMember(state, THIAGO, { email: "ana@empresa.com.br", roleId: role.id });
    expect(primeiro.ok).toBe(true);
    if (!primeiro.ok) throw new Error("deveria convidar");
    expect(primeiro.value.state).toBe("pendente");
    expect(primeiro.value.userId).toBeUndefined();
    expect(primeiro.value.invitedIdentity?.value).toBe("ana@empresa.com.br");
    const before = state.members.length;

    const segundo = inviteMember(state, THIAGO, {
      email: "ana@empresa.com.br",
      roleId: role.id,
      userId: FAKE_USER_ID,
    });

    expect(segundo.ok).toBe(false);
    if (segundo.ok) throw new Error("deveria recusar");
    expect(segundo.error).toContain("convite pendente");
    expect(segundo.field).toBe("email");
    expect(state.members.length).toBe(before);
    expect(state.members.filter((m) => m.invitedIdentity?.value === "ana@empresa.com.br").length).toBe(1);
  });

  it("(h) removido reencontrado só por invitedIdentity + userId resolvido depois → reativa o MESMO Membro e grava o userId", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");

    const convite = inviteMember(state, THIAGO, { email: "bia@empresa.com.br", roleId: role.id });
    expect(convite.ok).toBe(true);
    if (!convite.ok) throw new Error("convite inicial falhou");
    // Nunca aceitou (B27 não rodou) — a remoção é forçada como em (f), sem
    // passar por `removeMember`.
    convite.value.state = "removido";
    const before = state.members.length;

    const reconvite = inviteMember(state, THIAGO, {
      email: "bia@empresa.com.br",
      roleId: role.id,
      userId: FAKE_USER_ID,
    });

    expect(reconvite.ok).toBe(true);
    if (!reconvite.ok) throw new Error("deveria reconvidar");
    expect(reconvite.value.id).toBe(convite.value.id);
    expect(reconvite.value.state).toBe("pendente");
    expect(reconvite.value.userId).toBe(FAKE_USER_ID);
    expect(reconvite.value.invitedIdentity?.value).toBe("bia@empresa.com.br");
    expect(state.members.length).toBe(before);
    expect(state.activity[0]?.action).toBe("Membro reconvidado");
  });

  it("(i) userId prevalece sobre invitedIdentity quando apontam para Membros diferentes", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");

    const pendenteA = inviteMember(state, THIAGO, { email: "carla@empresa.com.br", roleId: role.id });
    expect(pendenteA.ok).toBe(true);
    const before = state.members.length;

    const result = inviteMember(state, THIAGO, {
      email: "carla@empresa.com.br",
      roleId: role.id,
      userId: USUARIOS_DO_SEED.mem_thiago, // mem_thiago está ativo
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("já pertence a um Membro");
    expect(state.members.length).toBe(before);
  });
});
