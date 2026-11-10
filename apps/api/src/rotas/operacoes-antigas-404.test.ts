/**
 * 15-32, UCR-12 — as operações do CRM antigo saíram de `OPERACOES`: `POST /operacoes/<nome
 * antigo>` responde 404 "Operação ... não existe.", sempre, sem tocar no banco. Um navegador com
 * a versão antiga em cache que ainda chame uma delas recebe a recusa; nada grava no CRM antigo em
 * `plataforma.registros` depois do corte (T-15-78).
 *
 * Sem banco: o `pool()` da conexão é trocado por um que conta a chamada e lança. O 404 sai antes
 * da autenticação do Membro gravar qualquer coisa, e o teste prova isso duas vezes seguidas por
 * nome (a borda de UCR-12: repetir a chamada continua 404, não vira 200 nem 500).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { ehNomeDeOperacao } from "@n1/dominio/operations/registro";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";

const idas = vi.hoisted(() => ({ ao: 0 }));

vi.mock("../persistencia/conexao", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("../persistencia/conexao")>()),
  pool: () => {
    idas.ao += 1;
    throw new Error("o 404 de uma operação antiga não pode ir ao banco");
  },
}));

/** As 40 operações do CRM antigo que saíram do registro (45 menos as 5 que o Grupo ainda usa). */
const OPERACOES_ANTIGAS = [
  // deals.ts
  "moveDealToStage",
  "winDeal",
  "loseDeal",
  "reopenDeal",
  "linkContactToDeal",
  "removeStage",
  "migrateDealsToFunnel",
  "restoreDeal",
  "moveDealToFunnel",
  "createDeal",
  "unlinkContactFromDeal",
  "setDealFieldValue",
  // conversations.ts (as outras cinco seguem, ver operacoes-antigas-fora.test.ts)
  "sendMessage",
  "moveConversationToContact",
  "discardDraft",
  "restoreConversation",
  "startConversation",
  "markConversationRead",
  // contacts.ts
  "addContactIdentifier",
  "transferContactIdentifier",
  "mergeContacts",
  "endContactCompanyLink",
  "trashContact",
  "trashCompany",
  "restoreMergedCopy",
  "importContacts",
  "restoreContact",
  "restoreCompany",
  "markContactsAsDistinct",
  "addContactNote",
  "createContact",
  "createCompany",
  "linkContactToCompany",
  "addCompanyIdentifier",
  "setContactCatalogValue",
  "updateCompany",
  "addCompanyNote",
  // iniciar-conversa.ts e canais.ts
  "iniciarConversa",
  "criarCanal",
  "configurarCanal",
] as const;

const THIAGO = usuarioDoSeed("mem_thiago"); // Proprietário: nenhuma recusa de Papel explica o 404
const membros = buildSeed().members;

function appDeTeste() {
  return buildApp({
    logger: false,
    workspaceId: "ws_antigas_404_teste",
    verificarToken: async (token) => (token === "token-thiago" ? { sub: THIAGO } : null),
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
  });
}

describe("POST /operacoes/<nome antigo> — o CRM antigo saiu do registro (15-32, UCR-12)", () => {
  beforeEach(() => {
    idas.ao = 0;
  });

  it("a lista cobre 40 nomes distintos e nenhum deles está em OPERACOES", () => {
    expect(new Set(OPERACOES_ANTIGAS).size).toBe(40);
    expect(OPERACOES_ANTIGAS.filter((nome) => ehNomeDeOperacao(nome))).toEqual([]);
  });

  it.each(OPERACOES_ANTIGAS)("%s responde 404 duas vezes seguidas, sem ir ao banco", async (nome) => {
    const app = appDeTeste();
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const resposta = await app.inject({
        method: "POST",
        url: `/operacoes/${nome}`,
        headers: { authorization: "Bearer token-thiago" },
        payload: { args: [] },
      });
      expect(resposta.statusCode).toBe(404);
      expect(resposta.json()).toEqual({ ok: false, error: `Operação "${nome}" não existe.` });
    }
    expect(idas.ao).toBe(0);
  });
});
