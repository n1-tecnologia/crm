/**
 * Fase 9, 1.2.2 — Contatos e Empresas do CRM antigo: toda operação registrada
 * recusa o Convidado e o Membro não ativo pelo domínio, com o estado intacto.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Contact, Id, Member } from "../types";
import {
  addCompanyIdentifier,
  addCompanyNote,
  addContactIdentifier,
  addContactNote,
  createCompany,
  createContact,
  endContactCompanyLink,
  importContacts,
  linkContactToCompany,
  markContactsAsDistinct,
  mergeContacts,
  restoreCompany,
  restoreContact,
  restoreMergedCopy,
  setContactCatalogValue,
  transferContactIdentifier,
  trashCompany,
  trashContact,
  updateCompany,
} from "./contacts";

const CONVIDADO = "mem_beatriz";
const MEMBRO = "mem_julia";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const membro = (id: Id): Member => {
  const m = state.members.find((x) => x.id === id);
  if (!m) throw new Error(`Membro ${id} não está no seed.`);
  return m;
};
const contato = (id: Id): Contact => {
  const c = state.contacts.find((x) => x.id === id);
  if (!c) throw new Error(`Contato ${id} não está no seed.`);
  return c;
};

const FRASE_DO_CRM = /Um Convidado não altera o CRM|Só um Membro ativo altera o CRM/;
const FRASE_DE_REGISTRO = /Um Convidado não cria registro|Só um Membro ativo cria registro de CRM/;

type Chamada = (s: DataState, quem: Id) => { ok: boolean; error?: string };

/** As 13 que ainda não conferiam o ator: a frase tem de ser a do CRM antigo. */
const semConferenciaAntes: ReadonlyArray<readonly [string, Chamada]> = [
  ["addContactIdentifier", (s, q) => addContactIdentifier(s, q, "cnt_1", "email", "novo@exemplo.com")],
  ["transferContactIdentifier", (s, q) => transferContactIdentifier(s, q, "cnt_1", "id_qualquer", "cnt_2")],
  ["mergeContacts", (s, q) => mergeContacts(s, q, "cnt_1", "cnt_2")],
  ["endContactCompanyLink", (s, q) => endContactCompanyLink(s, q, "ccl_c1", "2030-01-01")],
  ["trashContact", (s, q) => trashContact(s, q, "cnt_1")],
  ["trashCompany", (s, q) => trashCompany(s, q, "cmp_1")],
  ["restoreMergedCopy", (s, q) => restoreMergedCopy(s, q, "cnt_32")],
  ["importContacts", (s, q) => importContacts(s, q, [], { onCollision: "rejeitar" })],
  ["restoreContact", (s, q) => restoreContact(s, q, "cnt_21")],
  ["restoreCompany", (s, q) => restoreCompany(s, q, "cmp_2")],
  ["markContactsAsDistinct", (s, q) => markContactsAsDistinct(s, q, "cnt_1", "cnt_2")],
  ["addContactNote", (s, q) => addContactNote(s, q, "cnt_1", "Uma nota")],
  ["addCompanyNote", (s, q) => addCompanyNote(s, q, "cmp_1", "Uma nota")],
];

/** As seis que já recusavam pelo ator com a frase de criação de registro: seguem como estão. */
const jaConferiam: ReadonlyArray<readonly [string, Chamada]> = [
  ["createContact", (s, q) => createContact(s, q, { firstName: "Ana", lastName: "Lima" })],
  ["createCompany", (s, q) => createCompany(s, q, { tradeName: "Acme", legalName: "Acme SA" })],
  ["linkContactToCompany", (s, q) => linkContactToCompany(s, q, { contactId: "cnt_1", companyId: "cmp_3", role: "x" })],
  ["addCompanyIdentifier", (s, q) => addCompanyIdentifier(s, q, "cmp_1", "dominio", "exemplo.com")],
  ["setContactCatalogValue", (s, q) => setContactCatalogValue(s, q, "cnt_1", "qualificacao", undefined)],
  ["updateCompany", (s, q) => updateCompany(s, q, "cmp_1", { description: "x" })],
];

describe("Contatos — 1.2.2: Convidado e Membro não ativo recebem ok: false e o estado não muda", () => {
  it.each(semConferenciaAntes)("%s: o Convidado recebe a frase do CRM antigo e o estado fica idêntico", (_nome, chamar) => {
    const antes = structuredClone(state);
    const r = chamar(state, CONVIDADO);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(FRASE_DO_CRM);
    expect(state).toStrictEqual(antes);
  });

  it.each(semConferenciaAntes)("%s: um Membro suspenso recebe a frase do CRM antigo e o estado fica idêntico", (_nome, chamar) => {
    membro(MEMBRO).state = "suspenso";
    const antes = structuredClone(state);
    const r = chamar(state, MEMBRO);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(FRASE_DO_CRM);
    expect(state).toStrictEqual(antes);
  });

  it.each(jaConferiam)("%s: já recusava o Convidado pelo ator e continua recusando, com o estado intacto", (_nome, chamar) => {
    const antes = structuredClone(state);
    const r = chamar(state, CONVIDADO);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(FRASE_DE_REGISTRO);
    expect(state).toStrictEqual(antes);
  });

  it("trashContact: o Convidado não manda o Contato à lixeira", () => {
    const antes = structuredClone(state);
    expect(trashContact(state, CONVIDADO, "cnt_1").ok).toBe(false);
    expect(contato("cnt_1").lifecycle).toBe("ativo");
    expect(state).toStrictEqual(antes);
  });

  it("addContactNote: o Convidado não acrescenta nota; o estado fica intacto", () => {
    const antes = structuredClone(state);
    expect(addContactNote(state, CONVIDADO, "cnt_1", "Uma nota").ok).toBe(false);
    expect(state).toStrictEqual(antes);
  });

  it("trashContact: um Membro marcado suspenso recebe ok: false", () => {
    membro(MEMBRO).state = "suspenso";
    expect(trashContact(state, MEMBRO, "cnt_1").ok).toBe(false);
    expect(contato("cnt_1").lifecycle).toBe("ativo");
  });

  it("trashContact: um Membro ativo de base membro envia o Contato à lixeira com ok: true", () => {
    expect(trashContact(state, MEMBRO, "cnt_1").ok).toBe(true);
    expect(contato("cnt_1").lifecycle).toBe("naLixeira");
  });

  it("addContactNote: um Membro ativo de base membro acrescenta a nota com ok: true", () => {
    const r = addContactNote(state, MEMBRO, "cnt_1", "Cliente pediu retorno");
    expect(r.ok).toBe(true);
    expect(contato("cnt_1").comments.at(-1)?.content).toBe("Cliente pediu retorno");
  });
});
