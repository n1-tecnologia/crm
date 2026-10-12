/**
 * D-02 (Fase 8) — as Capacidades continuam do Tipo de Canal (RN-CXE-05), mas o
 * provedor sobrepõe o que difere: o WhatsApp não oficial não tem janela de
 * 24 h nem exige Mensagem de modelo. Cada teste afirma o resultado, nunca que
 * uma função foi chamada.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { responseWindowOpenUntil } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Channel, Conversation, Message } from "../types";
import { CHANNEL_CAPABILITIES, capacidadesDoCanal, sendMessage } from "./conversations";

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

/** Um Canal de WhatsApp e uma Conversa dele, com uma só Mensagem recebida há `horas`. */
function conversaNoCanal(provider: Channel["provider"], horas: number): { canal: Channel; conversa: Conversation } {
  const base = state.channels.find((c) => c.id === "chn_wpp");
  const modelo = state.conversations.find((c) => c.channelId === "chn_wpp");
  const recebida = modelo?.messages.find((m) => m.direction === "recebida");
  if (!base || !modelo || !recebida) throw new Error("o seed precisa de um Canal de WhatsApp com uma Mensagem recebida");
  const sufixo = provider ?? "padrao";
  const canal: Channel = {
    ...structuredClone(base),
    id: `chn_t_${sufixo}`,
    name: `Teste ${sufixo}`,
    externalId: `+5511900000${sufixo.length}`,
    connection: "conectada",
    messageTemplates: [],
    ...(provider ? { provider } : {}),
  };
  if (!provider) delete (canal as { provider?: unknown }).provider;
  const mensagem: Message = { ...structuredClone(recebida), createdAt: new Date(AGORA.getTime() - horas * HORA).toISOString() };
  const conversa: Conversation = {
    ...structuredClone(modelo),
    id: `cnv_t_${sufixo}`,
    channelId: canal.id,
    drafts: [],
    messages: [mensagem],
  };
  state.channels.push(canal);
  state.conversations.push(conversa);
  return { canal, conversa };
}

describe("capacidadesDoCanal (D-02)", () => {
  it("Canal sem provedor e WhatsApp oficial são exatamente a tabela do tipo", () => {
    expect(capacidadesDoCanal({ channelType: "whatsapp" })).toEqual(CHANNEL_CAPABILITIES.whatsapp);
    expect(capacidadesDoCanal({ channelType: "whatsapp", provider: "whatsapp-cloud" })).toEqual(CHANNEL_CAPABILITIES.whatsapp);
  });

  it("WhatsApp não oficial perde a janela e a exigência de modelo, e só isso", () => {
    const capacidades = capacidadesDoCanal({ channelType: "whatsapp", provider: "whatsapp-nao-oficial" });
    expect(capacidades.responseWindowHours).toBeUndefined();
    expect(capacidades.requiresTemplateOutsideWindow).toBe(false);
    const { responseWindowHours: _janela, requiresTemplateOutsideWindow: _modelo, ...resto } = CHANNEL_CAPABILITIES.whatsapp;
    const { responseWindowHours: _j2, requiresTemplateOutsideWindow: _m2, ...restoDoNaoOficial } = capacidades;
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
    const { conversa } = conversaNoCanal("whatsapp-nao-oficial", 30);
    expect(responseWindowOpenUntil(state, conversa, capacidadesDoCanal)).toBeNull();
  });

  it("Canal oficial com recebida há 30 h tem a janela encerrada 6 h atrás", () => {
    const { conversa } = conversaNoCanal("whatsapp-cloud", 30);
    const ate = responseWindowOpenUntil(state, conversa, capacidadesDoCanal);
    expect(ate?.toISOString()).toBe(new Date(AGORA.getTime() - 6 * HORA).toISOString());
  });

  it("Canal sem provedor (seed) mantém a janela de 24 h", () => {
    const { conversa } = conversaNoCanal(undefined, 30);
    const ate = responseWindowOpenUntil(state, conversa, capacidadesDoCanal);
    expect(ate?.toISOString()).toBe(new Date(AGORA.getTime() - 6 * HORA).toISOString());
  });
});

describe("sendMessage fora da janela (RN-CXE-19, D-02)", () => {
  it("não oficial com recebida há 30 h envia sem Mensagem de modelo", () => {
    const { conversa } = conversaNoCanal("whatsapp-nao-oficial", 30);
    const resultado = sendMessage(state, THIAGO, { conversationId: conversa.id, content: "Oi, tudo bem?" });
    expect(resultado.ok).toBe(true);
    expect(conversa.messages.at(-1)?.content).toBe("Oi, tudo bem?");
  });

  it("oficial com recebida há 30 h é recusado com campo modelo", () => {
    const { conversa } = conversaNoCanal("whatsapp-cloud", 30);
    const resultado = sendMessage(state, THIAGO, { conversationId: conversa.id, content: "Oi, tudo bem?" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("modelo");
    expect(conversa.messages).toHaveLength(1);
  });

  it("Canal sem provedor com recebida há 30 h também é recusado (como hoje)", () => {
    const { conversa } = conversaNoCanal(undefined, 30);
    const resultado = sendMessage(state, THIAGO, { conversationId: conversa.id, content: "Oi, tudo bem?" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("modelo");
  });

  it("oficial dentro da janela (recebida há 2 h) envia livre", () => {
    const { conversa } = conversaNoCanal("whatsapp-cloud", 2);
    expect(sendMessage(state, THIAGO, { conversationId: conversa.id, content: "Oi!" }).ok).toBe(true);
  });
});
