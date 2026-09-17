/**
 * `esquemas/membros.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam três coisas: (1) as
 * formas hostis que motivaram CR-02 caem; (2) as formas LITERAIS que
 * `apps/web` manda hoje continuam passando; (3) T-1-08 — `inviteMember`
 * descarta `userId` forjado no corpo (`.strip()`), a segunda barreira além
 * de `SERVICOS.inviteMember` em `operacoes.ts`.
 */

import { describe, expect, it } from "vitest";
import { MEMBROS } from "./membros";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/membros — a forma dos args de members.ts", () => {
  it("(a) cobertura — as 5 chaves de members.ts em registro.ts", () => {
    const esperadas = [
      "removeMember",
      "transferWorkspaceOwnership",
      "inviteMember",
      "deleteRole",
      "grantGovernanceAccess",
    ].sort();
    expect(Object.keys(MEMBROS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    // configuracoes/membros/page.tsx
    expect(MEMBROS.removeMember.safeParse(viaJson(["mem_1", "mem_2"])).success).toBe(true);
    expect(
      MEMBROS.inviteMember.safeParse(viaJson([{ email: "a@b.c", roleId: "role_mem" }])).success,
    ).toBe(true);

    // transfer-ownership-dialog.tsx — `keepRoleId || undefined`
    expect(MEMBROS.transferWorkspaceOwnership.safeParse(viaJson(["mem_1"])).success).toBe(true);
    expect(MEMBROS.transferWorkspaceOwnership.safeParse(viaJson(["mem_1", "role_adm"])).success).toBe(true);
    const comUndefined = MEMBROS.transferWorkspaceOwnership.safeParse(viaJson(["mem_1", undefined]));
    expect(comUndefined.success).toBe(true);
    if (comUndefined.success) expect(comUndefined.data).toEqual(["mem_1", undefined]);

    // delete-role-dialog.tsx
    expect(MEMBROS.deleteRole.safeParse(viaJson(["role_1", {}])).success).toBe(true);
    expect(
      MEMBROS.deleteRole.safeParse(viaJson(["role_1", { memberRoleId: "role_2", agentRoleId: "role_3" }])).success,
    ).toBe(true);

    // governance-access-dialog.tsx
    expect(
      MEMBROS.grantGovernanceAccess.safeParse(
        viaJson([
          {
            subjectKind: "member",
            subjectId: "mem_1",
            resourceType: "list",
            resourceId: "lst_1",
            actions: ["ver", "editar"],
            reason: "Único administrador ativo saiu.",
          },
        ]),
      ).success,
    ).toBe(true);
  });

  it("(c) inviteMember descarta userId do corpo (T-1-08)", () => {
    const resultado = MEMBROS.inviteMember.safeParse(
      viaJson([{ email: "a@b.c", roleId: "r", userId: "uuid-forjado" }]),
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data[0]).toEqual({ email: "a@b.c", roleId: "r" });
      expect("userId" in (resultado.data[0] as Record<string, unknown>)).toBe(false);
    }

    expect(MEMBROS.inviteMember.safeParse(viaJson([{ email: "a@b.c" }])).success).toBe(false);
    expect(MEMBROS.inviteMember.safeParse(viaJson([{ email: 1, roleId: "r" }])).success).toBe(false);
  });

  it("(c) formas hostis caem", () => {
    expect(
      MEMBROS.grantGovernanceAccess.safeParse(
        viaJson([
          {
            subjectKind: "robot",
            subjectId: "mem_1",
            resourceType: "list",
            resourceId: "lst_1",
            actions: ["ver"],
            reason: "x",
          },
        ]),
      ).success,
    ).toBe(false);
    expect(
      MEMBROS.grantGovernanceAccess.safeParse(
        viaJson([
          {
            subjectKind: "member",
            subjectId: "mem_1",
            resourceType: "list",
            resourceId: "lst_1",
            actions: ["voar"],
            reason: "x",
          },
        ]),
      ).success,
    ).toBe(false);
    expect(
      MEMBROS.grantGovernanceAccess.safeParse(
        viaJson([
          {
            subjectKind: "member",
            subjectId: "mem_1",
            resourceType: "list",
            resourceId: "lst_1",
            actions: ["ver"],
            reason: "x",
            lixo: 1,
          },
        ]),
      ).success,
    ).toBe(false);
    expect(MEMBROS.removeMember.safeParse(viaJson(["mem_1"])).success).toBe(false);
  });
});
