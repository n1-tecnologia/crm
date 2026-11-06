/**
 * Fase 9, 1.2.2, e 15-32 — a Conversa de GRUPO e as Mensagens do modelo antigo (F14-D-05). As cinco
 * operações que a Conversa de grupo na Caixa ainda chama pelo store recusam o Convidado e o Membro
 * não ativo pelo domínio, com o estado intacto; as composições internas das Ferramentas
 * (`sendMessageSemConferencia`, `startConversation`, `sendMessage`) não são alcançáveis por
 * `POST /operacoes/:nome`. O resto do módulo antigo de Conversas saiu de `OPERACOES` na 15-32.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import type { DataState } from "../../state";
import type { ConversaDeGrupo, Id, Member } from "../../types";
import { canalDeTeste, contatoDeTeste, conversaDeTeste, crmDeTeste } from "../../testes/crm-de-teste";
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
const conversa = (id: Id): ConversaDeGrupo => {
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

describe("composições internas das Ferramentas (Canal e Contato do CRM novo, Conversa no estado)", () => {
  const canal = canalDeTeste({ id: "chn_interno" });
  const contato = contatoDeTeste("cnt_interno", "Ana Ribeiro", "+5511988880003");
  const crm = crmDeTeste([canal], [contato]);
  const CONVERSA = "cnv_interno";

  beforeEach(() => {
    state.conversations.push(conversaDeTeste(CONVERSA, canal.id, contato.id, [["recebida", new Date().toISOString()]]));
  });

  it("startConversation recusa o Convidado e o Membro não ativo", () => {
    expect(startConversation(state, CONVIDADO, canal.id, contato.id, crm).ok).toBe(false);
    membro(MEMBRO).state = "suspenso";
    const suspenso = structuredClone(state);
    expect(startConversation(state, MEMBRO, canal.id, contato.id, crm).ok).toBe(false);
    expect(state).toStrictEqual(suspenso);
  });

  it("sendMessage: o Convidado não envia Mensagem numa Conversa; o estado fica intacto", () => {
    const antes = structuredClone(state);
    const r = sendMessage(state, CONVIDADO, { conversationId: CONVERSA, content: "Olá", internal: true, crm });
    expect(r.ok).toBe(false);
    expect(state).toStrictEqual(antes);
  });

  it("um Membro ativo de base membro envia Mensagem com ok: true", () => {
    const total = conversa(CONVERSA).messages.length;
    const r = sendMessage(state, MEMBRO, { conversationId: CONVERSA, content: "Olá", internal: true, crm });
    expect(r.ok).toBe(true);
    expect(conversa(CONVERSA).messages.length).toBe(total + 1);
  });

  it("sendMessageSemConferencia não confere o ator (quem a chama já foi conferido) e grava a Mensagem", () => {
    const total = conversa(CONVERSA).messages.length;
    const r = sendMessageSemConferencia(state, CONVIDADO, { conversationId: CONVERSA, content: "Automático", internal: true, crm });
    expect(r.ok).toBe(true);
    expect(conversa(CONVERSA).messages.length).toBe(total + 1);
  });

  it("sem o Canal em crm.canais a Mensagem é recusada: o estado não é consultado", () => {
    const r = sendMessage(state, MEMBRO, { conversationId: CONVERSA, content: "Olá", internal: true });
    expect(r).toMatchObject({ ok: false, error: "Canal não encontrado." });
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

/**
 * A Mensageria e o Rascunho das Mensagens que as Ferramentas (Grupo, Flow, Automação) ainda enviam
 * (RN-CXE-09, RN-CXE-19, RN-CXE-33, B66, doc 14, 7.10). Eram blocos de `sobre-o-crm-antigo.test.ts`, que
 * dependia do CRM antigo semeado: aqui o Canal e o Contato são os do CRM novo e a Conversa é montada no teste.
 */
describe("Mensageria sobre Canal e Contato do CRM novo (RN-CXE-09, RN-CXE-19, RN-CXE-33, B66)", () => {
  const canal = canalDeTeste({ id: "chn_msg" });
  const desligado = canalDeTeste({ id: "chn_off", nome: "Instagram da loja", conexao: "desconectada" });
  const contato = contatoDeTeste("cnt_msg", "Carla Dias", "+5511988880004");
  const crm = crmDeTeste([canal, desligado], [contato]);
  const THIAGO = "mem_thiago";

  it("envia, esvazia o Rascunho do autor e mantém a autoria de quem enviou", () => {
    const c = conversaDeTeste("cnv_msg", canal.id, contato.id, [["recebida", new Date().toISOString()]]);
    c.drafts = [{ actor: { kind: "agent", id: "agt_x" }, content: "Rascunho do Agente", origin: "agente", at: new Date().toISOString() }];
    state.conversations.push(c);

    const result = sendMessage(state, THIAGO, { conversationId: c.id, content: "Segue o cronograma.", crm });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.actor).toEqual({ kind: "member", id: THIAGO });
    // O Membro escreveu o seu próprio texto: o Rascunho do Agente segue à espera.
    expect(c.drafts).toHaveLength(1);
    expect(c.messages.at(-1)?.content).toBe("Segue o cronograma.");
  });

  it("grava a Mensagem como pendente quando o Canal está desconectado, sem descarte silencioso", () => {
    const c = conversaDeTeste("cnv_off", desligado.id, contato.id);
    state.conversations.push(c);

    const result = sendMessage(state, THIAGO, { conversationId: c.id, content: "Oi!", crm });

    expect(result.ok).toBe(true);
    expect(c.messages.at(-1)?.deliveryStatus).toBe("pendente");
    expect(state.activity[0]?.detail).toContain("Canal desconectado");
  });

  it("reabre a MESMA Conversa quando a Mensagem chega dentro do Prazo de reabertura", () => {
    const c = conversaDeTeste("cnv_res", canal.id, contato.id);
    c.state = "resolvida";
    c.resolvedAt = new Date().toISOString();
    state.conversations.push(c);
    const before = state.conversations.length;

    const result = receiveMessage(state, canal.id, contato.id, "Voltei!", crm);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(c.id);
    expect(result.value.state).toBe("aberta");
    expect(result.value.reopenCount).toBe(1);
    expect(state.conversations.length).toBe(before);
  });

  it("cria uma Conversa NOVA quando a Mensagem chega fora do prazo", () => {
    const c = conversaDeTeste("cnv_velha", canal.id, contato.id);
    c.state = "resolvida";
    c.resolvedAt = new Date(Date.now() - 100 * 3_600_000).toISOString();
    state.conversations.push(c);
    const before = state.conversations.length;

    const result = receiveMessage(state, canal.id, contato.id, "Muito tempo depois", crm);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).not.toBe(c.id);
    expect(state.conversations.length).toBe(before + 1);
  });

  it("uma Conversa na lixeira não recebe Mensagem (RN-CXE-33)", () => {
    const c = conversaDeTeste("cnv_lixo", canal.id, contato.id);
    c.lifecycle = "naLixeira";
    state.conversations.push(c);
    expect(sendMessage(state, THIAGO, { conversationId: c.id, content: "Oi", crm })).toMatchObject({ ok: false, error: "Esta Conversa está na lixeira." });
  });
});

describe("Adoção de Rascunho de IA no envio (documento 14, 7.10)", () => {
  const canal = canalDeTeste({ id: "chn_rasc" });
  const contato = contatoDeTeste("cnt_rasc", "Carla Dias", "+5511988880004");
  const crm = crmDeTeste([canal], [contato]);
  const THIAGO = "mem_thiago";
  const AGENTE = { kind: "agent" as const, id: "agt_rascunho" };
  let c: ConversaDeGrupo;

  beforeEach(() => {
    c = conversaDeTeste("cnv_rasc", canal.id, contato.id, [["recebida", new Date().toISOString()]]);
    c.drafts = [{ actor: AGENTE, content: "Posso ajudar com o certificado?", origin: "agente", at: new Date().toISOString() }];
    state.conversations.push(c);
  });

  it("adotar e enviar esvazia o Rascunho do Agente e registra a adoção", () => {
    const rascunho = c.drafts[0];
    if (!rascunho) throw new Error("sem Rascunho");

    const result = sendMessage(state, THIAGO, { conversationId: c.id, content: rascunho.content, adoptedDraftOf: rascunho.actor, crm });

    expect(result.ok).toBe(true);
    expect(c.drafts).toHaveLength(0);
    const record = state.activity.find((entry) => entry.action === "Mensagem enviada");
    expect(record?.detail).toContain("Rascunho de Agente adotado");
  });

  it("o mesmo Rascunho não vai duas vezes ao Contato", () => {
    const rascunho = c.drafts[0];
    if (!rascunho) throw new Error("sem Rascunho");

    sendMessage(state, THIAGO, { conversationId: c.id, content: rascunho.content, adoptedDraftOf: rascunho.actor, crm });
    // Não há mais Rascunho para o próximo Atendente adotar.
    expect(c.drafts).toHaveLength(0);
    expect(c.messages.filter((m) => m.direction === "enviada" && m.content === rascunho.content)).toHaveLength(1);
  });

  it("a nota interna não consome o Rascunho: ela não sai da plataforma", () => {
    sendMessage(state, THIAGO, { conversationId: c.id, content: "Confere isto antes de eu responder.", internal: true, crm });
    expect(c.drafts).toHaveLength(1);
  });
});
