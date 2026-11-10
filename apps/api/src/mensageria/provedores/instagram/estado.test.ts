import { describe, expect, it } from "vitest";
import { assinarEstado, lerEstado, VALIDADE_DO_ESTADO_MS } from "./estado";

const SEGREDO = "segredo-do-app";
const AGORA = Date.parse("2026-11-09T12:00:00.000Z");
const PEDIDO = { workspaceId: "ws_1", canalId: "canal_1", membroId: "mem_admin" };

describe("o state do login do Instagram", () => {
  it("volta com o Espaço, o Canal e o Membro, e vale 10 minutos", () => {
    const state = assinarEstado(SEGREDO, PEDIDO, AGORA);
    expect(lerEstado(SEGREDO, state, AGORA + 60_000)).toEqual({ ...PEDIDO, expiraEm: AGORA + VALIDADE_DO_ESTADO_MS });
    expect(lerEstado(SEGREDO, state, AGORA + VALIDADE_DO_ESTADO_MS)).toBeDefined();
    expect(lerEstado(SEGREDO, state, AGORA + VALIDADE_DO_ESTADO_MS + 1)).toBeUndefined();
  });

  it("cada pedido tem um state diferente", () => {
    expect(assinarEstado(SEGREDO, PEDIDO, AGORA)).not.toBe(assinarEstado(SEGREDO, PEDIDO, AGORA));
  });

  it("recusa outro segredo, dados trocados e forma inválida", () => {
    const state = assinarEstado(SEGREDO, PEDIDO, AGORA);
    expect(lerEstado("outro", state, AGORA)).toBeUndefined();
    const [, assinatura] = state.split(".");
    const outroCanal = Buffer.from(JSON.stringify({ w: "ws_1", c: "canal_2", m: "mem_admin", e: AGORA + 1000, n: "x" })).toString("base64url");
    expect(lerEstado(SEGREDO, `${outroCanal}.${assinatura}`, AGORA)).toBeUndefined();
    expect(lerEstado(SEGREDO, "nada", AGORA)).toBeUndefined();
    expect(lerEstado(SEGREDO, "a.b.c", AGORA)).toBeUndefined();
    expect(lerEstado(SEGREDO, "@@.##", AGORA)).toBeUndefined();
  });
});
