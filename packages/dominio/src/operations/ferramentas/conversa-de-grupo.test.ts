/**
 * Fase 9, 1.2.2, e 15-32 — a Conversa de GRUPO e as Mensagens do modelo antigo (F14-D-05). As cinco
 * operações que a Conversa de grupo na Caixa ainda chama pelo store recusam o Convidado e o Membro
 * não ativo pelo domínio, com o estado intacto; as composições internas das Ferramentas
 * (`sendMessageSemConferencia`, `startConversation`, `sendMessage`) não são alcançáveis por
 * `POST /operacoes/:nome`. O resto do módulo antigo de Conversas saiu de `OPERACOES` na 15-32.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import { semearCrmAntigo } from "../../seed-crm-antigo";
import type { DataState } from "../../state";
import type { Conversation, Id, Member } from "../../types";
import { ehNomeDeOperacao, OPERACOES } from "../registro";
import {
  assignConversation,
  reopenConversation,
  resolveConversation,
  sendMessage,
  sendMessageSemConferencia,
  startConversation,
  toggleConversationStar,
  trashConversation,
} from "./conversa-de-grupo";

const CONVIDADO = "mem_beatriz";
const MEMBRO = "mem_julia";
const GRUPO = "cnv_grp_avisos";

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

/** As cinco registradas: a frase tem de ser a do CRM antigo. */
const registradas: ReadonlyArray<readonly [string, Chamada]> = [
  ["resolveConversation", (s, q) => resolveConversation(s, q, GRUPO)],
  ["reopenConversation", (s, q) => reopenConversation(s, q, GRUPO)],
  ["assignConversation", (s, q) => assignConversation(s, q, GRUPO, { kind: "member", id: "mem_julia" })],
  ["trashConversation", (s, q) => trashConversation(s, q, GRUPO)],
  ["toggleConversationStar", (s, q) => toggleConversationStar(s, q, GRUPO)],
];

describe("Conversa de grupo — 1.2.2: Convidado e Membro não ativo recebem ok: false e o estado não muda", () => {
  it.each(registradas)("%s: o Convidado recebe a frase do CRM antigo e o estado fica idêntico", (_nome, chamar) => {
    const antes = structuredClone(state);
    const r = chamar(state, CONVIDADO);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(FRASE_DO_CRM);
    expect(state).toStrictEqual(antes);
  });

  it.each(registradas)("%s: um Membro suspenso recebe a frase do CRM antigo e o estado fica idêntico", (_nome, chamar) => {
    membro(MEMBRO).state = "suspenso";
    const antes = structuredClone(state);
    const r = chamar(state, MEMBRO);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(FRASE_DO_CRM);
    expect(state).toStrictEqual(antes);
  });

  it("um Membro ativo de base membro resolve, reabre, atribui, estrela e manda para a lixeira a Conversa de grupo", () => {
    expect(resolveConversation(state, MEMBRO, GRUPO).ok).toBe(true);
    expect(conversa(GRUPO).state).toBe("resolvida");
    expect(reopenConversation(state, MEMBRO, GRUPO).ok).toBe(true);
    expect(conversa(GRUPO).state).toBe("aberta");
    expect(assignConversation(state, MEMBRO, GRUPO, { kind: "member", id: "mem_julia" }).ok).toBe(true);
    expect(toggleConversationStar(state, MEMBRO, GRUPO).ok).toBe(true);
    expect(conversa(GRUPO).starredBy).toContain(MEMBRO);
    expect(resolveConversation(state, MEMBRO, GRUPO).ok).toBe(true);
    expect(trashConversation(state, MEMBRO, GRUPO).ok).toBe(true);
    expect(conversa(GRUPO).lifecycle).toBe("naLixeira");
  });

  it("as cinco seguem em OPERACOES: a tela da Conversa de grupo as chama pelo store", () => {
    for (const [nome] of registradas) expect(ehNomeDeOperacao(nome)).toBe(true);
  });
});

describe("composições internas das Ferramentas sobre o CRM antigo semeado", () => {
  beforeEach(() => {
    // Testa código do CRM antigo que sai (15-43): o seed deixou de criar o CRM (15-31), então ele é semeado aqui.
    state = semearCrmAntigo(buildSeed());
  });

  it("startConversation recusa o Convidado e o Membro não ativo", () => {
    expect(startConversation(state, CONVIDADO, "chn_wpp", "cnt_5").ok).toBe(false);
    membro(MEMBRO).state = "suspenso";
    const suspenso = structuredClone(state);
    expect(startConversation(state, MEMBRO, "chn_wpp", "cnt_5").ok).toBe(false);
    expect(state).toStrictEqual(suspenso);
  });

  it("sendMessage: o Convidado não envia Mensagem numa Conversa; o estado fica intacto", () => {
    const antes = structuredClone(state);
    const r = sendMessage(state, CONVIDADO, { conversationId: "cnv_1", content: "Olá", internal: true });
    expect(r.ok).toBe(false);
    expect(state).toStrictEqual(antes);
  });

  it("um Membro ativo de base membro envia Mensagem com ok: true", () => {
    const total = conversa("cnv_1").messages.length;
    const r = sendMessage(state, MEMBRO, { conversationId: "cnv_1", content: "Olá", internal: true });
    expect(r.ok).toBe(true);
    expect(conversa("cnv_1").messages.length).toBe(total + 1);
  });

  it("sendMessageSemConferencia não confere o ator (quem a chama já foi conferido) e grava a Mensagem", () => {
    const total = conversa("cnv_1").messages.length;
    const r = sendMessageSemConferencia(state, CONVIDADO, { conversationId: "cnv_1", content: "Automático", internal: true });
    expect(r.ok).toBe(true);
    expect(conversa("cnv_1").messages.length).toBe(total + 1);
  });

  it("sendMessage, sendMessageSemConferencia e startConversation nunca entram em OPERACOES", () => {
    expect(Object.keys(OPERACOES).filter((nome) => nome.includes("SemConferencia"))).toEqual([]);
    expect(Object.values(OPERACOES)).not.toContain(sendMessageSemConferencia);
    expect(Object.values(OPERACOES)).not.toContain(sendMessage);
    expect(Object.values(OPERACOES)).not.toContain(startConversation);
  });
});
