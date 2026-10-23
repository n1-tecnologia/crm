// @vitest-environment jsdom
/**
 * Fronteira de erro global (D-13; UI-SPEC S5): registra o erro no Sentry uma
 * vez, mostra só o texto fixo e nunca o que veio no erro (T-09-82).
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capturar = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (erro: unknown) => capturar(erro) }));
vi.mock("./globals.css", () => ({}));

import GlobalError from "./global-error";

function erroComSegredo() {
  return Object.assign(new Error("falha em https://app.exemplo.com/p/SEGREDO-P"), { digest: "DIGEST-123" });
}

describe("GlobalError", () => {
  beforeEach(() => {
    capturar.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("captura o erro no Sentry uma vez", () => {
    const erro = erroComSegredo();
    const { rerender } = render(<GlobalError error={erro} retry={() => {}} />, { container: document });
    expect(capturar).toHaveBeenCalledTimes(1);
    expect(capturar).toHaveBeenCalledWith(erro);
    rerender(<GlobalError error={erro} retry={() => {}} />);
    expect(capturar).toHaveBeenCalledTimes(1);
  });

  it("mostra o texto fixo e nada do erro: nem mensagem, nem digest, nem segredo", () => {
    render(<GlobalError error={erroComSegredo()} retry={() => {}} />, { container: document });
    expect(screen.getByText("Algo deu errado.")).toBeTruthy();
    expect(screen.getByText("O erro foi registrado.")).toBeTruthy();
    const html = document.documentElement.outerHTML;
    for (const proibido of ["SEGREDO-P", "DIGEST-123", "app.exemplo.com"]) {
      expect(html, `vazou ${proibido}`).not.toContain(proibido);
    }
    expect(document.documentElement.getAttribute("lang")).toBe("pt-BR");
  });

  it("o botão Tentar de novo chama retry", () => {
    const retry = vi.fn();
    render(<GlobalError error={erroComSegredo()} retry={retry} />, { container: document });
    screen.getByRole("button", { name: "Tentar de novo" }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
