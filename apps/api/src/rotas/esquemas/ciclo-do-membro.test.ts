/** `esquemas/ciclo-do-membro.ts` — só a forma dos args (12.3.3 e 12.3.7). */
import { describe, expect, it } from "vitest";
import { CICLO_DO_MEMBRO } from "./ciclo-do-membro";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/ciclo-do-membro", () => {
  it("as formas que a tela manda passam", () => {
    expect(CICLO_DO_MEMBRO.aceitarConvite.safeParse(viaJson([{ nome: "Nova Pessoa" }])).success).toBe(true);
    expect(CICLO_DO_MEMBRO.suspenderMembro.safeParse(viaJson(["mem_1"])).success).toBe(true);
    expect(CICLO_DO_MEMBRO.reativarMembro.safeParse(viaJson(["mem_1"])).success).toBe(true);
  });

  it("formas hostis caem: aceite com estado ou userId forjado", () => {
    expect(CICLO_DO_MEMBRO.aceitarConvite.safeParse(viaJson([{ nome: "X", state: "ativo" }])).success).toBe(false);
    expect(CICLO_DO_MEMBRO.aceitarConvite.safeParse(viaJson([{ nome: "X", userId: "usr_1" }])).success).toBe(false);
    expect(CICLO_DO_MEMBRO.suspenderMembro.safeParse(viaJson([])).success).toBe(false);
  });
});
