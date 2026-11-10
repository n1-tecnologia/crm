/**
 * Fase 15 (3.4.9, UCR-08) — a Âncora de uma Sessão de Chat num Negócio, Contato,
 * Empresa ou Conversa guarda o nome que o servidor leu das tabelas do CRM novo
 * (último parâmetro `nomes`, opcional). O estado não guarda mais Negócio, Contato, Empresa
 * nem Conversa 1:1 para procurar (3.5.4): sem o nome lido, a Âncora recusa.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { configureChatSession, createChatSession } from "./ai";

const THIAGO = "mem_thiago";
const RECUSA = "O registro da Âncora não foi encontrado.";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

/** Um id que nenhum `nomes` traz: o estado não tem onde procurá-lo. */
const NEGOCIO_SEM_NOME = "deal_sem_nome";

const erroDe = (r: { readonly ok: boolean; readonly error?: string }): string => (r.ok ? "" : (r.error ?? ""));

describe("createChatSession — a Âncora nomeada pelo que o servidor leu (nomes)", () => {
  it.each([
    ["deal", "Proposta Acme"],
    ["contact", "Maria Souza"],
    ["company", "Acme Ltda"],
    ["conversation", "Atendimento da Maria"],
  ] as const)("ancora num registro do tipo %s com o nome vindo de nomes", (type, nome) => {
    const r = createChatSession(state, THIAGO, { title: "Conversa", anchor: { type, id: "id_da_tabela" } }, { id_da_tabela: nome });
    expect(r.ok, erroDe(r)).toBe(true);
    if (!r.ok) return;
    expect(r.value.anchor).toEqual({ type, id: "id_da_tabela", nameAtTheTime: nome });
    expect(state.activity[0]?.detail).toBe(`Ancorada em ${nome}`);
  });

  it("com nomes vazio recusa: o nome vem do que o servidor leu, não do estado", () => {
    const sessoes = state.chatSessions.length;
    const r = createChatSession(state, THIAGO, { title: "Conversa", anchor: { type: "deal", id: NEGOCIO_SEM_NOME } }, {});
    expect(erroDe(r)).toBe(RECUSA);
    expect(state.chatSessions).toHaveLength(sessoes);
  });

  it("sem o parâmetro nomes vale {}: nenhum registro é achado", () => {
    expect(erroDe(createChatSession(state, THIAGO, { title: "Conversa", anchor: { type: "deal", id: NEGOCIO_SEM_NOME } }))).toBe(RECUSA);
  });

  it("um id como \"constructor\" não herda nome do protótipo de nomes", () => {
    expect(erroDe(createChatSession(state, THIAGO, { title: "Conversa", anchor: { type: "contact", id: "constructor" } }, {}))).toBe(RECUSA);
  });

  it("os demais tipos seguem no state: Lista ancora sem nomes", () => {
    const lista = state.lists[0];
    if (!lista) throw new Error("seed sem Lista");
    const r = createChatSession(state, THIAGO, { title: "Conversa", anchor: { type: "list", id: lista.id } });
    expect(r.ok, erroDe(r)).toBe(true);
    if (!r.ok) return;
    expect(r.value.anchor?.nameAtTheTime).toBe(lista.name);
  });
});

describe("configureChatSession — a Âncora trocada com nomes", () => {
  const vazia = () => {
    const nova = createChatSession(state, THIAGO, { title: "Sessão vazia" });
    if (!nova.ok) throw new Error(nova.error);
    return nova.value.id;
  };

  it("ancora a Sessão sem Mensagem num Negócio da tabela", () => {
    const id = vazia();
    const r = configureChatSession(state, THIAGO, id, { anchor: { type: "deal", id: "neg_tabela" } }, { neg_tabela: "Proposta Acme" });
    expect(r.ok, erroDe(r)).toBe(true);
    if (!r.ok) return;
    expect(r.value.anchor).toEqual({ type: "deal", id: "neg_tabela", nameAtTheTime: "Proposta Acme" });
  });

  it("com nomes vazio recusa a Âncora e não grava nada", () => {
    const id = vazia();
    const r = configureChatSession(state, THIAGO, id, { anchor: { type: "company", id: "emp_tabela" } }, {});
    expect(erroDe(r)).toBe(RECUSA);
    expect(state.chatSessions.find((s) => s.id === id)?.anchor).toBeUndefined();
  });
});
