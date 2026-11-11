/** `esquemas/acessos.ts` — só a forma dos args (12.4.3). */
import { describe, expect, it } from "vitest";
import { ACESSOS } from "./acessos";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];
const pedido = { subjectKind: "team", subjectId: "team_1", action: "ver", resourceType: "list", resourceId: "lst_1" };

describe("esquemas/acessos", () => {
  it("as formas que a tela manda passam", () => {
    expect(ACESSOS.concederAcesso.safeParse(viaJson([pedido])).success).toBe(true);
    expect(ACESSOS.concederAcesso.safeParse(viaJson([{ ...pedido, subjectKind: "role", action: "administrar" }])).success).toBe(true);
    expect(ACESSOS.revogarAcesso.safeParse(viaJson(["grn_1"])).success).toBe(true);
  });

  it("formas hostis caem: sujeito agente, ação excluir, recurso tarefa, origem forjada", () => {
    expect(ACESSOS.concederAcesso.safeParse(viaJson([{ ...pedido, subjectKind: "agent" }])).success).toBe(false);
    expect(ACESSOS.concederAcesso.safeParse(viaJson([{ ...pedido, action: "excluir" }])).success).toBe(false);
    expect(ACESSOS.concederAcesso.safeParse(viaJson([{ ...pedido, resourceType: "task" }])).success).toBe(false);
    expect(ACESSOS.concederAcesso.safeParse(viaJson([{ ...pedido, origin: "compartilhamento" }])).success).toBe(false);
  });
});
