/**
 * 15-32, UCR-12 — o registro de operações (`OPERACOES`, a allowlist de `POST /operacoes/:nome`)
 * não tem mais as operações do CRM antigo. O CRM novo grava por rotas REST por recurso; o que
 * sobra do modelo antigo são as operações de que o Grupo ainda precisa (F14-D-05).
 */

import { describe, expect, it } from "vitest";
import * as barril from "./index";
import { OPERACOES, ehNomeDeOperacao } from "./registro";

/** As 40 operações do CRM antigo que saíram (deals 12, conversas 6, contatos 19, iniciar conversa 1, Canal 2). */
const SAIRAM = [
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
  "sendMessage",
  "moveConversationToContact",
  "discardDraft",
  "restoreConversation",
  "startConversation",
  "markConversationRead",
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
  "iniciarConversa",
  "criarCanal",
  "configurarCanal",
] as const;

/**
 * A Conversa de GRUPO aberta na Caixa (F14-D-05, WINDOWS #41) ainda resolve, reabre, atribui, vai à
 * lixeira e ganha estrela pelo store: o Grupo fica no modelo antigo até as Sessões 6 e 7. Estas
 * cinco ficam no registro, agora no módulo do Grupo, e saem junto com a Conversa de grupo antiga.
 */
const FICAM_PELO_GRUPO = ["resolveConversation", "reopenConversation", "assignConversation", "trashConversation", "toggleConversationStar"] as const;

describe("OPERACOES sem o CRM antigo (15-32, UCR-12)", () => {
  it.each(SAIRAM)("ehNomeDeOperacao(%s) é falso", (nome) => {
    expect(ehNomeDeOperacao(nome)).toBe(false);
  });

  it.each(SAIRAM)("%s não é exportada instrumentada pelo barril de operações", (nome) => {
    expect(Object.hasOwn(barril, nome)).toBe(false);
  });

  it.each(FICAM_PELO_GRUPO)("%s continua operação registrada: a Conversa de grupo ainda a usa (F14-D-05)", (nome) => {
    expect(ehNomeDeOperacao(nome)).toBe(true);
    expect(Object.hasOwn(barril, nome)).toBe(true);
  });

  it("as operações de Grupo, Flow e Automações seguem no registro", () => {
    for (const nome of ["criarGrupo", "enviarLinkDeConvite", "enviarMensagemAoGrupo", "criarFlow", "enviarFlow", "criarAutomacao"]) {
      expect(ehNomeDeOperacao(nome)).toBe(true);
    }
  });

  it("o registro encolheu exatamente as 40 operações (285 -> 245)", () => {
    expect(Object.keys(OPERACOES).length).toBe(245);
  });
});
