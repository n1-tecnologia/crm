/**
 * 12.3.6 — `trocarSenha` com o Supabase falso: a senha atual errada não troca
 * nada; a certa troca. Nenhuma chamada sai para o Auth de verdade.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
};
vi.mock("@/autenticacao/cliente-servidor", () => ({ clienteDoServidor: async () => ({ auth }) }));

import { trocarSenha } from "./acoes";

function formulario(campos: Record<string, string>): FormData {
  const form = new FormData();
  for (const [chave, valor] of Object.entries(campos)) form.set(chave, valor);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUser.mockResolvedValue({ data: { user: { email: "pessoa@tria.com.br" } } });
  auth.updateUser.mockResolvedValue({ error: null });
});

describe("trocarSenha", () => {
  it("com a senha atual errada, diz 'Senha atual incorreta.' e não grava a nova", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const r = await trocarSenha({}, formulario({ atual: "errada", nova: "novaSenha1", confirmacao: "novaSenha1" }));
    expect(r).toEqual({ erro: "Senha atual incorreta." });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("com a senha atual certa, confere no e-mail da sessão e grava a nova", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    const r = await trocarSenha({}, formulario({ atual: "certa123", nova: "novaSenha1", confirmacao: "novaSenha1" }));
    expect(r).toEqual({ feito: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "pessoa@tria.com.br", password: "certa123" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "novaSenha1" });
  });

  it("senha nova curta ou confirmação diferente: recusa antes de falar com o Auth", async () => {
    expect((await trocarSenha({}, formulario({ atual: "certa123", nova: "curta", confirmacao: "curta" }))).erro).toContain("pelo menos 8");
    expect((await trocarSenha({}, formulario({ atual: "certa123", nova: "novaSenha1", confirmacao: "outra" }))).erro).toContain("confirmação");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
