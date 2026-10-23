/**
 * Fase 9, 1.2.2 — Conversas e Mensagens do CRM antigo: toda operação
 * registrada recusa o Convidado e o Membro não ativo pelo domínio, com o
 * estado intacto. As variantes `…SemConferencia` existem para as composições
 * internas (Automações) e nunca entram em `OPERACOES`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Conversation, Id, Member } from "../types";
import {
  assignConversation,
  discardDraft,
  markConversationRead,
  moveConversationToContact,
  reopenConversation,
  resolveConversation,
  restoreConversation,
  sendMessage,
  sendMessageSemConferencia,
  startConversation,
  toggleConversationStar,
  trashConversation,
} from "./conversations";
import { OPERACOES } from "./registro";

const CONVIDADO = "mem_beatriz";
const MEMBRO = "mem_julia";
const CONVERSA = "cnv_1";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const membro = (id: Id): Member => {
  const m = state.members.find((x) => x.id === id);
  if (!m) throw new Error(`Membro ${id} não está no seed.`);
  return m;
};
const conversa = (id: Id): Conversation => {
  const c = state.conversations.find((x) => x.id === id);
  if (!c) throw new Error(`Conversa ${id} não está no seed.`);
  return c;
};

const FRASE_DO_CRM = /Um Convidado não altera o CRM|Só um Membro ativo altera o CRM/;

type Chamada = (s: DataState, quem: Id) => { ok: boolean; error?: string };

/** Registradas que ainda não conferiam o ator: a frase tem de ser a do CRM antigo. */
const semConferenciaAntes: ReadonlyArray<readonly [string, Chamada]> = [
  ["sendMessage", (s, q) => sendMessage(s, q, { conversationId: CONVERSA, content: "Olá", internal: true })],
  ["resolveConversation", (s, q) => resolveConversation(s, q, CONVERSA)],
  ["reopenConversation", (s, q) => reopenConversation(s, q, CONVERSA)],
  ["assignConversation", (s, q) => assignConversation(s, q, CONVERSA, { kind: "member", id: "mem_julia" })],
  ["trashConversation", (s, q) => trashConversation(s, q, CONVERSA)],
  ["moveConversationToContact", (s, q) => moveConversationToContact(s, q, CONVERSA, "cnt_5")],
  ["discardDraft", (s, q) => discardDraft(s, q, CONVERSA, { kind: "agent", id: "agt_qualquer" })],
  ["restoreConversation", (s, q) => restoreConversation(s, q, "cnv_13")],
  ["toggleConversationStar", (s, q) => toggleConversationStar(s, q, CONVERSA)],
  ["markConversationRead", (s, q) => markConversationRead(s, q, CONVERSA)],
];

describe("Conversas — 1.2.2: Convidado e Membro não ativo recebem ok: false e o estado não muda", () => {
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

  it("startConversation já recusava o Convidado e o Membro não ativo, e continua recusando", () => {
    const antes = structuredClone(state);
    expect(startConversation(state, CONVIDADO, "chn_wpp", "cnt_5").ok).toBe(false);
    membro(MEMBRO).state = "suspenso";
    const suspenso = structuredClone(state);
    expect(startConversation(state, MEMBRO, "chn_wpp", "cnt_5").ok).toBe(false);
    expect(state).toStrictEqual(suspenso);
    expect(antes.conversations).toStrictEqual(state.conversations);
  });

  it("sendMessage: o Convidado não envia Mensagem numa Conversa do seed; o estado fica intacto", () => {
    const antes = structuredClone(state);
    const r = sendMessage(state, CONVIDADO, { conversationId: CONVERSA, content: "Olá", internal: true });
    expect(r.ok).toBe(false);
    expect(conversa(CONVERSA).messages.length).toBe(antes.conversations.find((c) => c.id === CONVERSA)?.messages.length);
    expect(state).toStrictEqual(antes);
  });

  it("resolveConversation: o Convidado não resolve a Conversa", () => {
    const antes = structuredClone(state);
    expect(resolveConversation(state, CONVIDADO, CONVERSA).ok).toBe(false);
    expect(conversa(CONVERSA).state).not.toBe("resolvida");
    expect(state).toStrictEqual(antes);
  });

  it("um Membro ativo de base membro envia Mensagem com ok: true", () => {
    const total = conversa(CONVERSA).messages.length;
    const r = sendMessage(state, MEMBRO, { conversationId: CONVERSA, content: "Olá", internal: true });
    expect(r.ok).toBe(true);
    expect(conversa(CONVERSA).messages.length).toBe(total + 1);
  });

  it("um Membro ativo de base membro resolve a Conversa com ok: true", () => {
    expect(resolveConversation(state, MEMBRO, CONVERSA).ok).toBe(true);
    expect(conversa(CONVERSA).state).toBe("resolvida");
  });
});

describe("sendMessageSemConferencia — a variante das composições internas", () => {
  it("não confere o ator (quem a chama já foi conferido) e grava a Mensagem como sendMessage grava", () => {
    const total = conversa(CONVERSA).messages.length;
    const r = sendMessageSemConferencia(state, CONVIDADO, { conversationId: CONVERSA, content: "Automático", internal: true });
    expect(r.ok).toBe(true);
    expect(conversa(CONVERSA).messages.length).toBe(total + 1);
  });

  it("nunca entra em OPERACOES: não é alcançável por POST /operacoes/:nome", () => {
    expect(Object.keys(OPERACOES).filter((nome) => nome.includes("SemConferencia"))).toEqual([]);
    expect(Object.values(OPERACOES)).not.toContain(sendMessageSemConferencia);
  });
});
