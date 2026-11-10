/**
 * 12.1.5 (B) — o Membro `suspenso` fica sem acesso: o hook de autenticação o
 * recusa com 403 `SUSPENSO` antes de qualquer rota, inclusive a leitura de
 * `GET /estado`, antes de validar o argumento e antes de tocar o banco. Até a
 * Sessão 12 (1.2.1) ele consultava e só a escrita era recusada; a recusa de
 * `POST /operacoes/:nome` continua lá como segunda barreira.
 *
 * Sem banco: rodar com `DATABASE_URL` vazia prova que o 403 vem antes de
 * qualquer acesso a ele. A autenticação é uma tabela de tokens injetada, e este
 * arquivo não lê o `.env`.
 */

import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { CODIGO_SUSPENSO, FRASE_DE_SUSPENSO } from "../plugins/autenticacao";

const semente = buildSeed();
const ativo = semente.members.find((m) => m.id === "mem_maryane");
if (!ativo?.userId) throw new Error("o seed precisa do Membro mem_maryane, com usuário");
// O mesmo Membro do seed, só que suspenso: o que muda é o estado, nunca o Papel.
const suspenso = { ...ativo, id: "mem_suspenso_teste", userId: usuarioDoSeed("mem_maryane") + "-suspenso", state: "suspenso" as const };

const TOKEN_ATIVO = "token-ativo";
const TOKEN_SUSPENSO = "token-suspenso";

function appDeTeste() {
  const usuarios: Record<string, string | undefined> = { [TOKEN_ATIVO]: ativo!.userId, [TOKEN_SUSPENSO]: suspenso.userId };
  return buildApp({
    logger: false,
    workspaceId: "ws_suspenso_teste",
    verificarToken: async (token) => {
      const sub = usuarios[token];
      return sub ? { sub } : null;
    },
    resolverMembro: async (_workspaceId, userId) => [ativo!, suspenso].find((m) => m.userId === userId),
  });
}

const chamar = (token: string, nome: string, payload: unknown) =>
  appDeTeste().inject({ method: "POST", url: `/operacoes/${nome}`, headers: { authorization: `Bearer ${token}` }, payload: payload as object });

describe("Membro suspenso (12.1.5 B), sem banco", () => {
  it("o suspenso chama toggleConversationStar com qualquer corpo e recebe 403 com a frase e o codigo do suspenso", async () => {
    // O corpo é inválido para a operação de propósito: a recusa vem antes da validação do argumento.
    const resposta = await chamar(TOKEN_SUSPENSO, "toggleConversationStar", { args: [] });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({ ok: false, error: FRASE_DE_SUSPENSO, codigo: CODIGO_SUSPENSO });
    expect(FRASE_DE_SUSPENSO).toBe("Seu acesso foi suspenso.");
  });

  it("o suspenso não chega nem à conferência do nome: uma operação que não existe também dá 403", async () => {
    const resposta = await chamar(TOKEN_SUSPENSO, "naoExiste", { args: [] });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().codigo).toBe(CODIGO_SUSPENSO);
  });

  it("o suspenso não consulta: GET /estado dá 403 antes de tocar o banco", async () => {
    const resposta = await appDeTeste().inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${TOKEN_SUSPENSO}` } });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({ ok: false, error: FRASE_DE_SUSPENSO, codigo: CODIGO_SUSPENSO });
  });

  it("um Membro ativo com argumentos inválidos continua recebendo 400 (a recusa nova não engole a validação)", async () => {
    const resposta = await chamar(TOKEN_ATIVO, "toggleConversationStar", { args: [] });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });
});
