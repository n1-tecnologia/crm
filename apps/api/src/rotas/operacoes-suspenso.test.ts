/**
 * 1.2.1 — o Membro `suspenso` consulta, mas não grava: `POST /operacoes/:nome`
 * responde 403 logo depois de conferir o nome da operação, ANTES de validar o
 * argumento e antes de tocar o banco. O hook de autenticação deixa o suspenso
 * passar de propósito (para consultar); toda operação do registro grava
 * (`registro.ts`, regra de inclusão), então a recusa vale para todas.
 *
 * Sem banco: rodar com `DATABASE_URL` vazia prova que o 403 vem antes de
 * qualquer acesso a ele. A autenticação é uma tabela de tokens injetada, e este
 * arquivo não lê o `.env`.
 */

import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { FRASE_DE_SUSPENSO } from "../plugins/autenticacao";

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

describe("POST /operacoes/:nome — Membro suspenso (1.2.1), sem banco", () => {
  it("o suspenso chama trashContact com qualquer corpo e recebe 403 com a frase do acesso suspenso", async () => {
    // O corpo é inválido para a operação de propósito: a recusa vem antes da validação do argumento.
    const resposta = await chamar(TOKEN_SUSPENSO, "trashContact", { args: [] });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({ ok: false, error: FRASE_DE_SUSPENSO });
    expect(FRASE_DE_SUSPENSO).toBe("Seu acesso está suspenso: você consulta, mas não altera.");
  });

  it("o nome da operação é conferido primeiro: o suspenso chamando uma operação que não existe recebe 404", async () => {
    const resposta = await chamar(TOKEN_SUSPENSO, "naoExiste", { args: [] });
    expect(resposta.statusCode).toBe(404);
  });

  it("um Membro ativo com argumentos inválidos continua recebendo 400 (a recusa nova não engole a validação)", async () => {
    const resposta = await chamar(TOKEN_ATIVO, "trashContact", { args: [] });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });
});
