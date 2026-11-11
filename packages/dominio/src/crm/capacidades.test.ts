/**
 * D-02 (Fase 8), movido para `crm/capacidades.ts` na 15-32 — as Capacidades continuam do Tipo de Canal (RN-CXE-05), mas o
 * provedor sobrepõe o que difere: o WhatsApp não oficial não tem janela de
 * 24 h nem exige Mensagem de modelo. Cada teste afirma o resultado, nunca que
 * uma função foi chamada.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { responseWindowOpenUntil } from "../derive";
import { sendMessage } from "../operations/ferramentas/conversa-de-grupo";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { canalDeTeste, contatoDeTeste, conversaDeTeste, crmDeTeste } from "../testes/crm-de-teste";
import type { ConversaDeGrupo, CrmDasFerramentas } from "../types";
import { CHANNEL_CAPABILITIES, capacidadesDoCanal, type ProvedorDeCanal } from "./capacidades";

const THIAGO = "mem_thiago";
const AGORA = new Date("2026-10-12T12:00:00.000Z");
const HORA = 3_600_000;

let state: DataState;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  state = buildSeed();
});
afterEach(() => {
  vi.useRealTimers();
});

/** O Canal de WhatsApp do provedor dado e uma Conversa dele, com uma só Mensagem recebida há `horas`. */
function conversaNoCanal(
  provedor: ProvedorDeCanal,
  horas: number,
): { canal: { channelType: "whatsapp"; provider: ProvedorDeCanal }; conversa: ConversaDeGrupo; crm: CrmDasFerramentas } {
  const canalDaTabela = canalDeTeste({ id: `chn_t_${provedor}`, nome: `Teste ${provedor}`, provedor });
  const contato = contatoDeTeste("cnt_t_1", "Contato de teste");
  const conversa = conversaDeTeste(`cnv_t_${provedor}`, canalDaTabela.id, contato.id, [
    ["recebida", new Date(AGORA.getTime() - horas * HORA).toISOString()],
  ]);
  state.conversations.push(conversa);
  return { canal: { channelType: "whatsapp", provider: provedor }, conversa, crm: crmDeTeste([canalDaTabela], [contato]) };
}

describe("capacidadesDoCanal (D-02)", () => {
  it("Canal sem provedor e WhatsApp oficial são exatamente a tabela do tipo", () => {
    expect(capacidadesDoCanal({ channelType: "whatsapp" })).toEqual(CHANNEL_CAPABILITIES.whatsapp);
    expect(capacidadesDoCanal({ channelType: "whatsapp", provider: "whatsapp-cloud" })).toEqual(CHANNEL_CAPABILITIES.whatsapp);
  });

  it("WhatsApp não oficial perde a janela e a exigência de modelo, e só isso", () => {
    const capacidades = capacidadesDoCanal({ channelType: "whatsapp", provider: "whatsapp-nao-oficial" });
    expect(capacidades.responseWindowHours).toBeUndefined();
    expect(capacidades.foraDaJanela).toBe("livre");
    const { responseWindowHours: _janela, foraDaJanela: _modelo, ...resto } = CHANNEL_CAPABILITIES.whatsapp;
    const { responseWindowHours: _j2, foraDaJanela: _m2, ...restoDoNaoOficial } = capacidades;
    expect(restoDoNaoOficial).toEqual(resto);
    expect(capacidades.resolvesIdentifierTypes).toEqual(CHANNEL_CAPABILITIES.whatsapp.resolvesIdentifierTypes);
    expect(capacidades.sendableMediaTypes).toEqual(CHANNEL_CAPABILITIES.whatsapp.sendableMediaTypes);
  });

  it("Instagram, E-mail, LinkedIn e Chat do site seguem a tabela do tipo", () => {
    expect(capacidadesDoCanal({ channelType: "instagram", provider: "instagram-graph" })).toEqual(CHANNEL_CAPABILITIES.instagram);
    expect(capacidadesDoCanal({ channelType: "email", provider: "email-imap-smtp" })).toEqual(CHANNEL_CAPABILITIES.email);
    expect(capacidadesDoCanal({ channelType: "linkedin" })).toEqual(CHANNEL_CAPABILITIES.linkedin);
    expect(capacidadesDoCanal({ channelType: "chatDoSite" })).toEqual(CHANNEL_CAPABILITIES.chatDoSite);
  });
});

describe("responseWindowOpenUntil por Canal (RN-CXE-19, D-02)", () => {
  it("Canal não oficial não tem janela", () => {
    const { conversa, canal } = conversaNoCanal("whatsapp-nao-oficial", 30);
    expect(responseWindowOpenUntil(conversa, canal, capacidadesDoCanal)).toBeNull();
  });

  it("Canal oficial com recebida há 30 h tem a janela encerrada 6 h atrás", () => {
    const { conversa, canal } = conversaNoCanal("whatsapp-cloud", 30);
    const ate = responseWindowOpenUntil(conversa, canal, capacidadesDoCanal);
    expect(ate?.toISOString()).toBe(new Date(AGORA.getTime() - 6 * HORA).toISOString());
  });

  it("Canal sem provedor mantém a janela de 24 h (a tabela do tipo)", () => {
    const { conversa } = conversaNoCanal("whatsapp-cloud", 30);
    const ate = responseWindowOpenUntil(conversa, { channelType: "whatsapp" }, capacidadesDoCanal);
    expect(ate?.toISOString()).toBe(new Date(AGORA.getTime() - 6 * HORA).toISOString());
  });

  it("sem Canal não há janela", () => {
    const { conversa } = conversaNoCanal("whatsapp-cloud", 30);
    expect(responseWindowOpenUntil(conversa, undefined, capacidadesDoCanal)).toBeNull();
  });
});

describe("sendMessage fora da janela (RN-CXE-19, D-02)", () => {
  it("não oficial com recebida há 30 h envia sem Mensagem de modelo", () => {
    const { conversa, crm } = conversaNoCanal("whatsapp-nao-oficial", 30);
    const resultado = sendMessage(state, THIAGO, { conversationId: conversa.id, content: "Oi, tudo bem?", crm });
    expect(resultado.ok).toBe(true);
    expect(conversa.messages.at(-1)?.content).toBe("Oi, tudo bem?");
  });

  it("oficial com recebida há 30 h é recusado com campo modelo", () => {
    const { conversa, crm } = conversaNoCanal("whatsapp-cloud", 30);
    const resultado = sendMessage(state, THIAGO, { conversationId: conversa.id, content: "Oi, tudo bem?", crm });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("modelo");
    expect(conversa.messages).toHaveLength(1);
  });

  it("oficial dentro da janela (recebida há 2 h) envia livre", () => {
    const { conversa, crm } = conversaNoCanal("whatsapp-cloud", 2);
    expect(sendMessage(state, THIAGO, { conversationId: conversa.id, content: "Oi!", crm }).ok).toBe(true);
  });
});
