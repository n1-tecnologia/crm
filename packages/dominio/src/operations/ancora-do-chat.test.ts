/**
 * Fase 15 (3.4.9, UCR-08) — a Âncora de uma Sessão de Chat num Negócio, Contato,
 * Empresa ou Conversa guarda o nome que o servidor leu das tabelas do CRM novo
 * (último parâmetro `nomes`, opcional), não o do modelo antigo em `state.deals`,
 * `state.contacts`, `state.companies` e `state.conversations`, que a 3.5.4 apaga.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Deal } from "../types";
import { configureChatSession, createChatSession } from "./ai";

const THIAGO = "mem_thiago";
const RECUSA = "O registro da Âncora não foi encontrado.";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

/** O seed não cria mais Negócio (15-31): o teste põe um no modelo antigo, que a Âncora NÃO pode ler. */
function comNegocioAntigo(estado: DataState): Deal {
  const negocio = { id: "deal_antigo", workspaceId: "ws_n1", title: "Negócio do modelo antigo", lifecycle: "ativo", situation: "aberto", contactLinks: [] } as unknown as Deal;
  estado.deals.push(negocio);
  return negocio;
}

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

  it("com nomes vazio recusa, mesmo que o modelo antigo tenha o registro (não lê mais state.deals)", () => {
    const negocio = comNegocioAntigo(state);
    const sessoes = state.chatSessions.length;
    const r = createChatSession(state, THIAGO, { title: "Conversa", anchor: { type: "deal", id: negocio.id } }, {});
    expect(erroDe(r)).toBe(RECUSA);
    expect(state.chatSessions).toHaveLength(sessoes);
  });

  it("sem o parâmetro nomes vale {}: o Negócio do modelo antigo também não é achado", () => {
    const negocio = comNegocioAntigo(state);
    expect(erroDe(createChatSession(state, THIAGO, { title: "Conversa", anchor: { type: "deal", id: negocio.id } }))).toBe(RECUSA);
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
