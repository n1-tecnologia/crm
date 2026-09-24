import { describe, expect, it } from "vitest";
import { classificarFalha } from "./microfone";

describe("o motivo de o microfone não abrir", () => {
  it("o navegador permitiu, mas o sistema bloqueou", () => {
    expect(classificarFalha("NotAllowedError", "granted")).toBe("sistema");
    expect(classificarFalha("NotAllowedError", "desconhecido", "Permission denied by system")).toBe("sistema");
  });

  it("o navegador bloqueou", () => {
    expect(classificarFalha("NotAllowedError", "denied", "Permission denied")).toBe("negado");
    expect(classificarFalha("NotAllowedError", "desconhecido")).toBe("negado");
  });

  it("o pedido fechou sem resposta", () => {
    expect(classificarFalha("NotAllowedError", "prompt")).toBe("dispensado");
    expect(classificarFalha("NotAllowedError", "desconhecido", "Permission dismissed")).toBe("dispensado");
  });

  it("o microfone existe mas não abre", () => {
    expect(classificarFalha("NotReadableError", "granted", "Could not start audio source")).toBe("ocupado");
    expect(classificarFalha("AbortError", "granted")).toBe("ocupado");
  });

  it("não há microfone", () => {
    expect(classificarFalha("NotFoundError", "granted")).toBe("sem-microfone");
    expect(classificarFalha("OverconstrainedError", "granted")).toBe("sem-microfone");
  });

  it("o resto é erro genérico", () => {
    expect(classificarFalha("TypeError", "granted")).toBe("erro");
    expect(classificarFalha("", "desconhecido")).toBe("erro");
  });
});
