/**
 * As derivações do chat por Canal (Fase 8, D-13/D-14/D-15): a chave do chat
 * deixa de ser o TIPO e passa a ser o Canal — duas contas de WhatsApp dão duas
 * abas, o "Responder por" padrão é o Canal da última Mensagem recebida, e a
 * troca de Canal numa sequência ganha um separador "via …". Sem jsdom: tudo
 * aqui é função pura do estado.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  ORDEM_DOS_TIPOS_DE_CANAL,
  canaisDeResposta,
  canaisDoFio,
  canaisQueAlcancam,
  canalDaAbaInicial,
  canalPadraoDeResposta,
  canalPadraoDoTipo,
  marcadoresDeCanal,
  rotuloDoCanal,
  textoDoSeparadorDeCanal,
} from "./derive-conversacional";
import { buildSeed } from "./seed";
import type { DataState } from "./state";
import type { Channel, Contact, Conversation, Message } from "./types";

let state: DataState;
let contato: Contact;

/** Um Canal de WhatsApp novo, clonado do `chn_wpp` do seed, criado em `criadoEm`. */
function novoCanal(
  id: string,
  nome: string,
  provider: Channel["provider"],
  connection: Channel["connection"],
  criadoEm: string,
): Channel {
  const base = state.channels.find((c) => c.id === "chn_wpp");
  if (!base) throw new Error("o seed precisa do Canal chn_wpp");
  const canal: Channel = {
    ...structuredClone(base),
    id,
    name: nome,
    externalId: `+55119${id.length}${nome.length}000000`,
    connection,
    createdAt: criadoEm,
    messageTemplates: [],
    ...(provider ? { provider } : {}),
  };
  state.channels.push(canal);
  return canal;
}

type Recebimento = readonly [direcao: Message["direction"], criadoEm: string];

/** Uma Conversa ativa do Contato no Canal, com Mensagens nas direções e instantes dados. */
function novaConversa(id: string, canalId: string, mensagens: readonly Recebimento[]): Conversation {
  const base = state.conversations.find((c) => c.messages.length > 0);
  const modelo = base?.messages[0];
  if (!base || !modelo) throw new Error("o seed precisa de uma Conversa com Mensagem");
  const conversa: Conversation = {
    ...structuredClone(base),
    id,
    channelId: canalId,
    contactId: contato.id,
    lifecycle: "ativo",
    state: "aberta",
    drafts: [],
    messages: mensagens.map(([direction, createdAt], i) => ({
      ...structuredClone(modelo),
      id: `${id}_m${i}`,
      conversationId: id,
      direction,
      createdAt,
    })),
  };
  state.conversations.push(conversa);
  return conversa;
}

beforeEach(() => {
  state = buildSeed();
  const candidato = state.contacts.find((c) => c.identifiers.some((i) => i.type === "identidadeDeWhatsApp"));
  if (!candidato) throw new Error("o seed precisa de um Contato com WhatsApp");
  // Só o WhatsApp: o e-mail e os demais Canais não o alcançam.
  candidato.identifiers = candidato.identifiers.filter((i) => i.type === "identidadeDeWhatsApp");
  contato = candidato;
  state.conversations = state.conversations.filter((c) => c.contactId !== contato.id);

  novoCanal("chn_comercial", "Comercial", "whatsapp-cloud", "conectada", "2026-01-01T09:00:00.000Z");
  novoCanal("chn_suporte", "Suporte", "whatsapp-nao-oficial", "conectada", "2026-01-02T09:00:00.000Z");
  novoCanal("chn_desligado", "Desligado", "whatsapp-nao-oficial", "desconectada", "2026-01-03T09:00:00.000Z");
});

/** O cenário do plano: a recebida mais recente de todas está em "Suporte". */
function cenarioComSuporteComoUltimaRecebida(): void {
  novaConversa("cnv_wpp", "chn_wpp", [
    ["recebida", "2026-10-09T10:00:00.000Z"],
    ["enviada", "2026-10-12T08:00:00.000Z"],
  ]);
  novaConversa("cnv_comercial", "chn_comercial", [
    ["recebida", "2026-10-10T10:00:00.000Z"],
    ["interna", "2026-10-12T09:00:00.000Z"],
  ]);
  novaConversa("cnv_suporte", "chn_suporte", [["recebida", "2026-10-11T09:00:00.000Z"]]);
}

describe("canaisDoFio (D-14: uma aba por Canal)", () => {
  it("traz todos os Canais ativos: WhatsApp pela criação, depois Instagram, LinkedIn, E-mail e Chat do site", () => {
    expect(canaisDoFio(state, contato).map((c) => c.canal.id)).toEqual([
      "chn_wpp",
      "chn_comercial",
      "chn_suporte",
      "chn_desligado",
      "chn_insta",
      "chn_linkedin",
      "chn_mail",
      "chn_site",
    ]);
  });

  it("os de WhatsApp alcançam o Contato; o de e-mail, o de Instagram e os demais não", () => {
    const alcance = new Map(canaisDoFio(state, contato).map((c) => [c.canal.id, c.alcancavel]));
    expect(alcance.get("chn_wpp")).toBe(true);
    expect(alcance.get("chn_comercial")).toBe(true);
    expect(alcance.get("chn_suporte")).toBe(true);
    expect(alcance.get("chn_desligado")).toBe(true);
    expect(alcance.get("chn_mail")).toBe(false);
    expect(alcance.get("chn_insta")).toBe(false);
    expect(alcance.get("chn_linkedin")).toBe(false);
    expect(alcance.get("chn_site")).toBe(false);
  });

  it("um Canal arquivado não aparece", () => {
    const suporte = state.channels.find((c) => c.id === "chn_suporte");
    if (!suporte) throw new Error("fixture");
    suporte.lifecycle = "arquivado";
    expect(canaisDoFio(state, contato).map((c) => c.canal.id)).not.toContain("chn_suporte");
  });

  it("a ordem é do tipo, depois da criação, depois do id", () => {
    const empate = novoCanal("chn_a_empate", "Empate", "whatsapp-cloud", "conectada", "2026-01-02T09:00:00.000Z");
    const ids = canaisDoFio(state, contato).map((c) => c.canal.id);
    expect(ids.indexOf(empate.id)).toBe(ids.indexOf("chn_suporte") - 1);
    expect(ORDEM_DOS_TIPOS_DE_CANAL).toEqual(["whatsapp", "instagram", "linkedin", "email", "chatDoSite"]);
  });

  it("sem Contato, todos os Canais ativos alcançam", () => {
    expect(canaisDoFio(state, undefined).every((c) => c.alcancavel)).toBe(true);
  });
});

describe("canaisDeResposta (D-15: só os conectados que alcançam)", () => {
  it("traz chn_wpp, Comercial e Suporte; não o desconectado nem o de e-mail", () => {
    expect(canaisDeResposta(state, contato).map((c) => c.id)).toEqual(["chn_wpp", "chn_comercial", "chn_suporte"]);
  });
});

describe("canalPadraoDeResposta (D-15)", () => {
  it("dois WhatsApps dão duas abas e o padrão de resposta é o da última recebida", () => {
    cenarioComSuporteComoUltimaRecebida();
    const abasDeWhatsApp = canaisDoFio(state, contato).filter((c) => c.canal.channelType === "whatsapp" && c.alcancavel);
    expect(abasDeWhatsApp.length).toBeGreaterThanOrEqual(2);
    expect(canalPadraoDeResposta(state, contato)).toBe("chn_suporte");
  });

  it("se o Canal da última recebida não serve, cai no primeiro Canal de resposta do mesmo tipo", () => {
    cenarioComSuporteComoUltimaRecebida();
    const suporte = state.channels.find((c) => c.id === "chn_suporte");
    if (!suporte) throw new Error("fixture");
    suporte.connection = "desconectada";
    expect(canalPadraoDeResposta(state, contato)).toBe("chn_wpp");
  });

  it("sem nenhuma recebida, é o primeiro Canal de resposta", () => {
    novaConversa("cnv_wpp", "chn_wpp", [["enviada", "2026-10-12T08:00:00.000Z"]]);
    expect(canalPadraoDeResposta(state, contato)).toBe("chn_wpp");
  });

  it("sem nenhum Canal que sirva, é undefined", () => {
    for (const canal of state.channels) canal.connection = "desconectada";
    expect(canalPadraoDeResposta(state, contato)).toBeUndefined();
  });

  it("uma Conversa na lixeira não conta como a última recebida", () => {
    cenarioComSuporteComoUltimaRecebida();
    const suporte = state.conversations.find((c) => c.id === "cnv_suporte");
    if (!suporte) throw new Error("fixture");
    suporte.lifecycle = "naLixeira";
    expect(canalPadraoDeResposta(state, contato)).toBe("chn_comercial");
  });
});

describe("canalDaAbaInicial (D-14)", () => {
  it("é o Canal da Conversa com a Mensagem mais recente, sem contar nota interna", () => {
    cenarioComSuporteComoUltimaRecebida();
    expect(canalDaAbaInicial(state, contato)).toBe("chn_wpp");
  });

  it("sem Conversa, é o primeiro Canal alcançável", () => {
    expect(canalDaAbaInicial(state, contato)).toBe("chn_wpp");
  });

  it("sem nenhum Canal alcançável, é undefined", () => {
    contato.identifiers = [];
    expect(canalDaAbaInicial(state, contato)).toBeUndefined();
  });
});

describe("canalPadraoDoTipo", () => {
  it("whatsapp é o Canal da última recebida; e-mail, que o Contato não alcança, é undefined", () => {
    cenarioComSuporteComoUltimaRecebida();
    expect(canalPadraoDoTipo(state, contato, "whatsapp")).toBe("chn_suporte");
    expect(canalPadraoDoTipo(state, contato, "email")).toBeUndefined();
  });

  it("sem recebida no tipo, é o primeiro Canal de resposta do tipo", () => {
    expect(canalPadraoDoTipo(state, contato, "whatsapp")).toBe("chn_wpp");
  });
});

describe("marcadoresDeCanal (D-13: o separador marca a troca de Canal)", () => {
  const itens = [{ channelId: "a" }, { channelId: "a" }, { channelId: "b" }, { channelId: "a" }];

  it("põe um 'via' antes de cada Mensagem cujo Canal difere da anterior", () => {
    expect(marcadoresDeCanal(itens)).toEqual([
      { tipo: "item", item: itens[0] },
      { tipo: "item", item: itens[1] },
      { tipo: "via", channelId: "b" },
      { tipo: "item", item: itens[2] },
      { tipo: "via", channelId: "a" },
      { tipo: "item", item: itens[3] },
    ]);
  });

  it("uma sequência de um Canal só não tem separador", () => {
    const so = [{ channelId: "a" }, { channelId: "a" }];
    expect(marcadoresDeCanal(so).map((m) => m.tipo)).toEqual(["item", "item"]);
  });

  it("lista vazia, nada", () => {
    expect(marcadoresDeCanal([])).toEqual([]);
  });
});

describe("rotuloDoCanal e textoDoSeparadorDeCanal (D-13)", () => {
  const canal = (id: string): Channel => {
    const c = state.channels.find((x) => x.id === id);
    if (!c) throw new Error(`fixture: ${id}`);
    return c;
  };

  it("o rótulo junta o nome e o provedor", () => {
    expect(rotuloDoCanal(canal("chn_comercial"))).toBe("Comercial · WhatsApp oficial");
    expect(rotuloDoCanal(canal("chn_suporte"))).toBe("Suporte · WhatsApp não oficial");
  });

  it("Canal sem provider usa o provedor padrão do tipo; sem provedor, o rótulo do tipo", () => {
    expect(rotuloDoCanal(canal("chn_wpp"))).toBe("Comercial SP · WhatsApp oficial");
    expect(rotuloDoCanal(canal("chn_linkedin"))).toBe("Instituto Igor Alves no LinkedIn · LinkedIn");
    expect(rotuloDoCanal(canal("chn_site"))).toBe("Chat do site · Chat do site");
  });

  it("o separador diz por qual Canal a Mensagem passou", () => {
    expect(textoDoSeparadorDeCanal(canal("chn_suporte"))).toBe("via Suporte (WhatsApp não oficial)");
    expect(textoDoSeparadorDeCanal(canal("chn_linkedin"))).toBe("via Instituto Igor Alves no LinkedIn (LinkedIn)");
  });
});

describe("canaisQueAlcancam continua como era", () => {
  it("devolve os Canais ativos que alcançam o Contato, por tipo", () => {
    expect(canaisQueAlcancam(state, contato).map((c) => c.id)).toEqual(
      expect.arrayContaining(["chn_wpp", "chn_comercial", "chn_suporte", "chn_desligado"]),
    );
    expect(canaisQueAlcancam(state, contato).map((c) => c.id)).not.toContain("chn_mail");
  });
});
