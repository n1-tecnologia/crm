import { describe, expect, it } from "vitest";
import { recusaDaNovaSenha } from "./senha";

describe("recusaDaNovaSenha", () => {
  it("aceita 8 caracteres ou mais com a confirmação igual", () => {
    expect(recusaDaNovaSenha("12345678", "12345678")).toBeUndefined();
  });

  it("recusa senha curta e confirmação diferente", () => {
    expect(recusaDaNovaSenha("1234567", "1234567")).toContain("pelo menos 8");
    expect(recusaDaNovaSenha("12345678", "12345679")).toContain("confirmação");
  });
});
