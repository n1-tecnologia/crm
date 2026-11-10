/** O código de confirmação da exclusão de dados: assinado, não guardado. Sem banco. */

import { describe, expect, it } from "vitest";
import { codigoDeExclusao, lerCodigoDeExclusao } from "./desautorizacao";

const SEGREDO = "segredo-do-app-de-teste";

describe("o código de confirmação da exclusão", () => {
  it("vale mesmo quando a assinatura (base64url) tem `-`: o corte é no primeiro `-`", () => {
    // Procura um instante cuja assinatura tenha `-`: em base64url isso sai em boa parte deles.
    let agora = Date.parse("2026-11-10T12:00:00.000Z");
    let codigo = codigoDeExclusao(SEGREDO, agora);
    for (let i = 0; i < 500 && codigo.split("-").length <= 2; i += 1) {
      agora += 1;
      codigo = codigoDeExclusao(SEGREDO, agora);
    }
    expect(codigo.split("-").length).toBeGreaterThan(2);
    expect(lerCodigoDeExclusao([SEGREDO], codigo)?.getTime()).toBe(agora);
  });

  it("recusa o código de outra chave, mexido ou sem o separador", () => {
    const codigo = codigoDeExclusao(SEGREDO, Date.parse("2026-11-10T12:00:00.000Z"));
    expect(lerCodigoDeExclusao(["outra-chave"], codigo)).toBeUndefined();
    expect(lerCodigoDeExclusao([SEGREDO], `${codigo.slice(0, -1)}${codigo.endsWith("A") ? "B" : "A"}`)).toBeUndefined();
    expect(lerCodigoDeExclusao([SEGREDO], codigo.replace("-", ""))).toBeUndefined();
    expect(lerCodigoDeExclusao([SEGREDO], "")).toBeUndefined();
  });
});
