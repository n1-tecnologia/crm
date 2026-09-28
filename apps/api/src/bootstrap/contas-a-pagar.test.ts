/**
 * `contas-a-pagar:configurar` — a parte do CLI que decide se grava. Puro, sem
 * banco: a regra do evolver é provada em
 * `packages/dominio/src/contas-a-pagar-evolver.test.ts`; aqui só se prova que
 * gravar exige a intenção escrita (`--apply`) e para onde vai.
 */

import { describe, expect, it } from "vitest";
import { opcoesDaLinhaDeComando } from "./contas-a-pagar";

describe("opcoesDaLinhaDeComando — dry-run por padrão", () => {
  it("(a) sem flag: dry-run, ws_n1, mem_maryane", () => {
    expect(opcoesDaLinhaDeComando([], {})).toEqual({ workspaceId: "ws_n1", actingMemberId: "mem_maryane", dryRun: true });
  });

  it("(b) só --apply grava; --dry-run explícito continua dry-run", () => {
    expect(opcoesDaLinhaDeComando(["--apply"], {}).dryRun).toBe(false);
    expect(opcoesDaLinhaDeComando(["--dry-run"], {}).dryRun).toBe(true);
    // Um quase-acerto não grava.
    expect(opcoesDaLinhaDeComando(["--aply"], {}).dryRun).toBe(true);
    expect(opcoesDaLinhaDeComando(["apply"], {}).dryRun).toBe(true);
  });

  it("(c) --workspace vence WORKSPACE_ID, que vence ws_n1; --membro troca quem age", () => {
    expect(opcoesDaLinhaDeComando([], { WORKSPACE_ID: "ws_env" }).workspaceId).toBe("ws_env");
    expect(opcoesDaLinhaDeComando(["--workspace=ws_flag"], { WORKSPACE_ID: "ws_env" }).workspaceId).toBe("ws_flag");
    expect(opcoesDaLinhaDeComando(["--membro=mem_tarjrn"], {}).actingMemberId).toBe("mem_tarjrn");
  });

  it("(d) valor vazio não vira Espaço vazio: cai no padrão", () => {
    expect(opcoesDaLinhaDeComando(["--workspace="], {}).workspaceId).toBe("ws_n1");
    expect(opcoesDaLinhaDeComando(["--membro="], {}).actingMemberId).toBe("mem_maryane");
  });
});
