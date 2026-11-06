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
import { canalDeTeste, contatoDeTeste, crmDeTeste } from "../../testes/crm-de-teste";
import { ehNomeDeOperacao, OPERACOES } from "../registro";
import { enviarLinkDeConvite } from "../ferramentas";
import {
  assignConversation,
  receiveMessage,
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

/**
 * 15-42, WINDOWS #37 — o Contato das composições antigas vem do `crm` (o que o servidor leu de
 * `plataforma.contatos`), do mesmo lugar do Canal. Nenhum destes casos tem Contato nem Canal no
 * estado: o link de convite do "Novo Grupo" não diz mais "Contato não encontrado".
 */
describe("o Contato só existe no CRM novo (crm.contatos)", () => {
  const canal = canalDeTeste({ id: "chn_so_no_crm" });
  const marina = contatoDeTeste("cnt_so_no_crm", "Marina Alves", "+5511988880001");
  const crm = crmDeTeste([canal], [marina]);

  it("startConversation abre a Conversa 1:1 do Contato, com o nome dele no título", () => {
    const r = startConversation(state, MEMBRO, canal.id, marina.id, crm);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ channelId: canal.id, contactId: marina.id, title: "Marina Alves", lifecycle: "ativo" });
    expect(state.conversations.some((c) => c.id === r.value.id)).toBe(true);
    // Repetir devolve a mesma Conversa aberta, sem criar outra.
    const outra = startConversation(state, MEMBRO, canal.id, marina.id, crm);
    expect(outra.ok && outra.value.id).toBe(r.value.id);
  });

  it("startConversation recusa o Contato que o servidor não leu, o que não está ativo e o sem WhatsApp", () => {
    expect(startConversation(state, MEMBRO, canal.id, "cnt_inexistente", crm)).toMatchObject({ ok: false, error: "Contato não encontrado." });
    const naLixeira = crmDeTeste([canal], [contatoDeTeste("cnt_lixo", "Na lixeira", "+5511988880002", "na_lixeira")]);
    expect(startConversation(state, MEMBRO, canal.id, "cnt_lixo", naLixeira)).toMatchObject({ ok: false });
    const semZap = crmDeTeste([canal], [contatoDeTeste("cnt_sem_zap", "Sem WhatsApp", null)]);
    const r = startConversation(state, MEMBRO, canal.id, "cnt_sem_zap", semZap);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/não tem Identificador que o Canal/);
    expect(startConversation(state, MEMBRO, canal.id, marina.id)).toMatchObject({ ok: false });
  });

  it("receiveMessage põe a Mensagem recebida do Contato na Conversa aberta, criando-a se não houver", () => {
    const r = receiveMessage(state, canal.id, marina.id, "Oi, quero saber do grupo", crm);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.messages.at(-1)).toMatchObject({ direction: "recebida", content: "Oi, quero saber do grupo" });
    expect(r.value.contactId).toBe(marina.id);
    const segunda = receiveMessage(state, canal.id, marina.id, "Mais uma", crm);
    expect(segunda.ok && segunda.value.id).toBe(r.value.id);
    expect(receiveMessage(state, canal.id, "cnt_inexistente", "x", crm)).toMatchObject({ ok: false, error: "Contato não encontrado." });
  });

  it("enviarLinkDeConvite manda o link ao Contato que só está no CRM novo (o Novo Grupo)", () => {
    const grupo = state.grupos.find((g) => g.linkDeConvite && g.lifecycle === "ativo");
    if (!grupo) throw new Error("o seed precisa de um Grupo com link de convite");
    grupo.canalId = canal.id;
    const r = enviarLinkDeConvite(state, MEMBRO, grupo.id, [marina.id], crm);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.falhas).toEqual([]);
    expect(r.value.enviados).toEqual([marina.id]);
    const conversa = state.conversations.find((c) => c.contactId === marina.id && c.channelId === canal.id);
    expect(conversa?.messages.at(-1)?.content).toContain(grupo.linkDeConvite?.endereco ?? "sem link");
  });
});
