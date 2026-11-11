/** `esquemas/papeis.ts` — só a forma dos args (12.4.1); a regra fica no domínio. */
import { describe, expect, it } from "vitest";
import { PAPEIS } from "./papeis";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/papeis", () => {
  it("as formas que a tela manda passam, inclusive base proprietario (o domínio recusa)", () => {
    expect(PAPEIS.createRole.safeParse(viaJson([{ nome: "Comercial", base: "membro", modulos: ["trabalho", "crm"] }])).success).toBe(true);
    expect(PAPEIS.createRole.safeParse(viaJson([{ nome: "X", base: "proprietario", modulos: [] }])).success).toBe(true);
    expect(PAPEIS.updateRole.safeParse(viaJson(["role_1", { nome: "Novo" }])).success).toBe(true);
    expect(PAPEIS.updateRole.safeParse(viaJson(["role_1", { modulos: ["financeiro"] }])).success).toBe(true);
  });

  it("formas hostis caem: módulo desconhecido, chave a mais, base inventada", () => {
    expect(PAPEIS.createRole.safeParse(viaJson([{ nome: "X", base: "membro", modulos: ["root"] }])).success).toBe(false);
    expect(PAPEIS.createRole.safeParse(viaJson([{ nome: "X", base: "membro", modulos: [], system: true }])).success).toBe(false);
    expect(PAPEIS.createRole.safeParse(viaJson([{ nome: "X", base: "superadmin", modulos: [] }])).success).toBe(false);
    expect(PAPEIS.updateRole.safeParse(viaJson(["role_1", { base: "administrador" }])).success).toBe(false);
  });
});
