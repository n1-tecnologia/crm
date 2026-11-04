/** `esquemas/equipes.ts` — só a forma dos args (12.4.2). */
import { describe, expect, it } from "vitest";
import { EQUIPES } from "./equipes";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/equipes", () => {
  it("as formas que a tela manda passam", () => {
    expect(EQUIPES.createTeam.safeParse(viaJson([{ nome: "Suporte" }])).success).toBe(true);
    expect(EQUIPES.createTeam.safeParse(viaJson([{ nome: "Suporte", descricao: "N2" }])).success).toBe(true);
    expect(EQUIPES.updateTeam.safeParse(viaJson(["team_1", { descricao: "" }])).success).toBe(true);
    expect(EQUIPES.addMemberToTeam.safeParse(viaJson(["team_1", "mem_1"])).success).toBe(true);
    expect(EQUIPES.removeMemberFromTeam.safeParse(viaJson(["team_1", "mem_1"])).success).toBe(true);
    expect(EQUIPES.deleteTeam.safeParse(viaJson(["team_1"])).success).toBe(true);
  });

  it("formas hostis caem", () => {
    expect(EQUIPES.createTeam.safeParse(viaJson([{ nome: "X", memberIds: ["mem_1"] }])).success).toBe(false);
    expect(EQUIPES.addMemberToTeam.safeParse(viaJson(["team_1"])).success).toBe(false);
    expect(EQUIPES.deleteTeam.safeParse(viaJson([{ id: "team_1" }])).success).toBe(false);
  });
});
