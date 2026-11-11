/**
 * O tradutor do `MESSAGES_UPSERT` da Evolution contra os exemplos sintéticos (16-12, Task 3, MSG-06). Função pura: sem
 * banco, sem rede. Os exemplos (`exemplos/*.json`) seguem a forma de `prepareMessage@2.3.7` com números fictícios.
 */

import { describe, expect, it } from "vitest";
import type { EventoDoProvedor } from "../../provedor";
import audio from "./exemplos/audio.json";
import documento from "./exemplos/documento.json";
import figurinha from "./exemplos/figurinha.json";
import ignorados from "./exemplos/ignorados.json";
import imagem from "./exemplos/imagem.json";
import textoDoCelular from "./exemplos/texto-do-celular.json";
import texto from "./exemplos/texto.json";
import video from "./exemplos/video.json";
import { semApikey, traduzirChamadaDaEvolution } from "./traduzir";

const INSTANCIA = "inst-teste";

function umaMensagem(corpo: unknown): Extract<EventoDoProvedor, { tipo: "mensagem" }> {
  const eventos = traduzirChamadaDaEvolution(corpo, INSTANCIA);
  expect(eventos).toHaveLength(1);
  const evento = eventos[0]!;
  expect(evento.tipo).toBe("mensagem");
  if (evento.tipo !== "mensagem") throw new Error("esperava uma mensagem");
  return evento;
}

/** O corpo de um `connection.update` da Evolution: `data.state` e, no `close`, o `statusReason` numérico. */
const conexao = (data: unknown, evento = "connection.update") => ({ event: evento, instance: INSTANCIA, data });

describe("traduzirChamadaDaEvolution: connection.update (Sessão 4, 4.3.1)", () => {
  it("open: avisa que conectou (quem GRAVA conectada é a conferência na fonte, não o aviso)", () => {
    expect(traduzirChamadaDaEvolution(conexao({ instance: INSTANCIA, state: "open", statusReason: 200 }), INSTANCIA)).toEqual([
      { tipo: "conexao", conexao: "conectada", motivo: "open" },
    ]);
  });

  it("close com a razão 401 (aparelho removido no celular) é desconectada", () => {
    expect(traduzirChamadaDaEvolution(conexao({ state: "close", statusReason: 401 }), INSTANCIA)).toEqual([
      { tipo: "conexao", conexao: "desconectada", motivo: "aparelho_removido" },
    ]);
  });

  it.each([408, 428, 440, 500, 515])("close com a razão %s (queda, não remoção) é com_erro, com a razão no motivo", (razao) => {
    expect(traduzirChamadaDaEvolution(conexao({ state: "close", statusReason: razao }), INSTANCIA)).toEqual([
      { tipo: "conexao", conexao: "com_erro", motivo: `close:${razao}` },
    ]);
  });

  it("close sem razão (ou com razão que não é número) é queda: com_erro", () => {
    expect(traduzirChamadaDaEvolution(conexao({ state: "close" }), INSTANCIA)).toEqual([{ tipo: "conexao", conexao: "com_erro", motivo: "close" }]);
    expect(traduzirChamadaDaEvolution(conexao({ state: "close", statusReason: "401" }), INSTANCIA)).toEqual([
      { tipo: "conexao", conexao: "com_erro", motivo: "close" },
    ]);
  });

  it("connecting não muda nada, e estado desconhecido ou corpo sem data vira ignorado, nunca exceção", () => {
    expect(traduzirChamadaDaEvolution(conexao({ state: "connecting" }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "conectando" }]);
    for (const data of [{ state: "refused" }, { state: 7 }, {}, null, undefined, "open", []]) {
      expect(traduzirChamadaDaEvolution(conexao(data), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "conexao_sem_estado" }]);
    }
  });

  it("o nome do evento vale em minúsculas com ponto e em maiúsculas com sublinhado (a grafia do webhook assinado)", () => {
    for (const nome of ["connection.update", "CONNECTION_UPDATE", "connection_update", " Connection.Update "]) {
      expect(traduzirChamadaDaEvolution(conexao({ state: "open" }, nome), INSTANCIA)).toEqual([{ tipo: "conexao", conexao: "conectada", motivo: "open" }]);
    }
  });

  it("nada do corpo além do estado e da razão numérica passa adiante (o payload traz sender, apikey e o resto)", () => {
    const [evento] = traduzirChamadaDaEvolution(
      { event: "connection.update", instance: INSTANCIA, sender: "5511987654321@s.whatsapp.net", apikey: "SEGREDO-DA-INSTANCIA", data: { state: "open", statusReason: 200 } },
      INSTANCIA,
    );
    expect(JSON.stringify(evento)).not.toMatch(/SEGREDO-DA-INSTANCIA|5511987654321/);
  });
});

describe("traduzirChamadaDaEvolution: o que vira Mensagem", () => {
  it("texto: o número em E.164, o nome do pushName, o id da Evolution e o instante de messageTimestamp em ISO", () => {
    const evento = umaMensagem(texto);
    expect(evento).toMatchObject({
      idExterno: "3EB0A1B2C3D4E5F60001",
      conteudo: "oi",
      remetente: { tipo: "whatsapp", valor: "+5511987654321", nomeExibido: "Ana Teste" },
      criadoEm: "2024-11-09T11:00:00.000Z",
    });
    expect(evento.anexos).toBeUndefined();
  });

  it("texto longo (extendedTextMessage) também entra", () => {
    const corpo = { ...texto, data: { ...texto.data, message: { extendedTextMessage: { text: "olha https://exemplo.test" } }, messageType: "extendedTextMessage" } };
    expect(umaMensagem(corpo).conteudo).toBe("olha https://exemplo.test");
  });

  it("imagem: a legenda é o conteúdo e o anexo leva o tipo, o nome e a referência com o message do webhook", () => {
    const evento = umaMensagem(imagem);
    expect(evento.conteudo).toBe("olha esta foto");
    expect(evento.anexos).toHaveLength(1);
    expect(evento.anexos![0]).toMatchObject({ tipoDeMidia: "image/jpeg", nome: "imagem-3EB0A1B2C3D4E5F60002.jpg" });
    expect(JSON.parse(evento.anexos![0]!.referenciaNoProvedor)).toEqual({ key: imagem.data.key, message: imagem.data.message });
  });

  it("áudio de voz: o tipo vem com o parâmetro do WhatsApp (a normalização é de quem guarda) e não há conteúdo", () => {
    const evento = umaMensagem(audio);
    expect(evento.conteudo).toBeUndefined();
    expect(evento.anexos![0]).toMatchObject({ tipoDeMidia: "audio/ogg; codecs=opus", nome: "audio-3EB0A1B2C3D4E5F60003.ogg" });
  });

  it("vídeo: a legenda é o conteúdo", () => {
    const evento = umaMensagem(video);
    expect(evento.conteudo).toBe("veja este video");
    expect(evento.anexos![0]).toMatchObject({ tipoDeMidia: "video/mp4", nome: "video-3EB0A1B2C3D4E5F60004.mp4" });
  });

  it("documento: o nome do arquivo é o fileName do remetente", () => {
    const evento = umaMensagem(documento);
    expect(evento.conteudo).toBeUndefined();
    expect(evento.anexos![0]).toMatchObject({ tipoDeMidia: "application/pdf", nome: "contrato.pdf" });
  });

  it("documento com legenda embrulhado (documentWithCaptionMessage) também entra", () => {
    const interna = documento.data.message.documentMessage;
    const corpo = {
      ...documento,
      data: { ...documento.data, message: { documentWithCaptionMessage: { message: { documentMessage: { ...interna, caption: "segue o contrato" } } } }, messageType: "documentWithCaptionMessage" },
    };
    const evento = umaMensagem(corpo);
    expect(evento.conteudo).toBe("segue o contrato");
    expect(evento.anexos![0]).toMatchObject({ tipoDeMidia: "application/pdf", nome: "contrato.pdf" });
  });

  it("figurinha entra como image/webp", () => {
    const evento = umaMensagem(figurinha);
    expect(evento.anexos![0]).toMatchObject({ tipoDeMidia: "image/webp", nome: "figurinha-3EB0A1B2C3D4E5F60006.webp" });
  });

  it("o nome do arquivo do remetente não leva separador de caminho nem caractere de controle", () => {
    const interna = documento.data.message.documentMessage;
    const corpo = { ...documento, data: { ...documento.data, message: { documentMessage: { ...interna, fileName: "../../etc/pass\u0000wd.pdf" } } } };
    const nome = umaMensagem(corpo).anexos![0]!.nome;
    expect(nome).not.toMatch(/[\\/\u0000-\u001f]/);
    expect(nome.endsWith(".pdf")).toBe(true);
  });

  it("pushName nulo: sem nomeExibido (quem recebe usa o número)", () => {
    const corpo = { ...texto, data: { ...texto.data, pushName: null } };
    expect(umaMensagem(corpo).remetente).toEqual({ tipo: "whatsapp", valor: "+5511987654321" });
  });

  it("o instante vem só de messageTimestamp: o date_time local do corpo nunca é lido", () => {
    const corpo = { ...texto, date_time: "1999-01-01T00:00:00.000Z" };
    expect(umaMensagem(corpo).criadoEm).toBe("2024-11-09T11:00:00.000Z");
  });

  it("a cargaBruta não tem apikey em lugar nenhum, mesmo quando a Evolution a expõe", () => {
    const corpo = { ...texto, apikey: "tok-da-instancia-9f3a", data: { ...texto.data, apikey: "outra-chave-7c1d" } };
    const evento = umaMensagem(corpo);
    expect(JSON.stringify(evento.cargaBruta)).not.toContain("apikey");
    expect(JSON.stringify(evento)).not.toContain("tok-da-instancia-9f3a");
    expect(JSON.stringify(evento)).not.toContain("outra-chave-7c1d");
  });
});

describe("traduzirChamadaDaEvolution: a Mensagem digitada no celular (fromMe, 4.4.2)", () => {
  it("entra como digitadaNoAparelho: o remetente é o Contato (o remoteJid) e o pushName do dono do número nunca vira o nome dele", () => {
    const evento = umaMensagem(textoDoCelular);
    expect(textoDoCelular.data.pushName).toBe("Dono do Numero");
    expect(evento).toMatchObject({
      digitadaNoAparelho: true,
      idExterno: "3EB0A1B2C3D4E5F60010",
      conteudo: "enviada pelo celular",
      remetente: { tipo: "whatsapp", valor: "+5511987654321" },
      criadoEm: "2024-11-09T11:00:00.000Z",
    });
    expect(evento.remetente).not.toHaveProperty("nomeExibido");
  });

  it("a mídia digitada no celular entra com o anexo, e a referência leva o fromMe verdadeiro (a Evolution acha a mídia pela chave)", () => {
    const corpo = { ...imagem, data: { ...imagem.data, key: { ...imagem.data.key, fromMe: true } } };
    const evento = umaMensagem(corpo);
    expect(evento).toMatchObject({ digitadaNoAparelho: true, conteudo: "olha esta foto" });
    expect(evento.anexos).toHaveLength(1);
    expect(JSON.parse(evento.anexos![0]!.referenciaNoProvedor).key).toMatchObject({ fromMe: true });
  });

  it("a Mensagem do Contato (fromMe falso ou ausente) não leva a marca", () => {
    expect(umaMensagem(texto)).not.toHaveProperty("digitadaNoAparelho");
    const falso = { ...texto, data: { ...texto.data, key: { ...texto.data.key, fromMe: false } } };
    expect(umaMensagem(falso)).not.toHaveProperty("digitadaNoAparelho");
  });

  it("o que o dono mandou em grupo, no status, como reação, edição ou sem id continua ignorado (só a conversa 1:1 entra)", () => {
    const deCelular = (key: object, message?: object) => ({ ...textoDoCelular, data: { ...textoDoCelular.data, key: { ...textoDoCelular.data.key, ...key }, ...(message ? { message } : {}) } });
    expect(traduzirChamadaDaEvolution(deCelular({ remoteJid: "120363000000000000@g.us" }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "grupo" }]);
    expect(traduzirChamadaDaEvolution(deCelular({ remoteJid: "status@broadcast" }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "status" }]);
    expect(traduzirChamadaDaEvolution(deCelular({}, { reactionMessage: { text: "👍" } }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "reacao_sem_alvo" }]);
    expect(traduzirChamadaDaEvolution(deCelular({}, { protocolMessage: { type: 14 } }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "edicao" }]);
    expect(traduzirChamadaDaEvolution(deCelular({ id: "" }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "sem_id" }]);
  });

  it("o fromMe de um corpo de outra instância continua sem evento nenhum", () => {
    expect(traduzirChamadaDaEvolution({ ...textoDoCelular, instance: "outra" }, INSTANCIA)).toEqual([]);
  });
});

describe("traduzirChamadaDaEvolution: o que é ignorado, com o motivo", () => {
  for (const caso of ignorados) {
    it(`${caso.caso}`, () => {
      const eventos = traduzirChamadaDaEvolution(caso.corpo, INSTANCIA);
      expect(eventos).toHaveLength(1);
      const evento = eventos[0]!;
      if (caso.motivo === null) {
        expect(evento).toMatchObject({ tipo: "mensagem", remetente: { valor: caso.numero } });
      } else {
        expect(evento).toMatchObject({ tipo: "ignorado", motivo: caso.motivo });
      }
    });
  }

  it("event que não é messages.upsert nem connection.update, ou instance de outro Canal, não vira evento nenhum", () => {
    expect(traduzirChamadaDaEvolution({ ...texto, event: "qrcode.updated" }, INSTANCIA)).toEqual([]);
    expect(traduzirChamadaDaEvolution({ ...texto, event: "presence.update" }, INSTANCIA)).toEqual([]);
    expect(traduzirChamadaDaEvolution({ ...texto, instance: "outra" }, INSTANCIA)).toEqual([]);
    expect(traduzirChamadaDaEvolution({ event: "connection.update", instance: "outra", data: { state: "open" } }, INSTANCIA)).toEqual([]);
  });

  it("corpo que não é objeto ou sem data.key nunca lança", () => {
    for (const corpo of [null, undefined, "texto", 42, [], {}]) {
      expect(traduzirChamadaDaEvolution(corpo, INSTANCIA)).toEqual([]);
    }
    expect(traduzirChamadaDaEvolution({ event: "messages.upsert", instance: INSTANCIA, data: {} }, INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "formato_invalido" }]);
  });

  it("JID com lixo antes do @s.whatsapp.net não vira número", () => {
    const corpo = { ...texto, data: { ...texto.data, key: { ...texto.data.key, remoteJid: "abc@s.whatsapp.net" } } };
    expect(traduzirChamadaDaEvolution(corpo, INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "sem_numero", idExterno: texto.data.key.id }]);
  });
});

/** O corpo que a Evolution manda em cada evento que muda uma Mensagem existente (formas conferidas no código da 2.4.0-rc2, números fictícios). */
const evento = (nome: string, data: unknown) => ({ event: nome, instance: INSTANCIA, data, sender: "5511977770001@s.whatsapp.net", apikey: null });
const JID = "5511987654321@s.whatsapp.net";
const ID = "3EB0A1B2C3D4E5F60001";

describe("traduzirChamadaDaEvolution: messages.update, o tique (4.4.5)", () => {
  const atualizacao = (status: unknown, extras: Record<string, unknown> = {}) =>
    evento("messages.update", { keyId: ID, remoteJid: JID, fromMe: true, participant: JID, status, instanceId: "i", ...extras });

  it.each([
    ["SERVER_ACK", "enviada"],
    ["DELIVERY_ACK", "entregue"],
    ["READ", "lida"],
    ["PLAYED", "lida"],
  ])("%s é o status %s da Mensagem de id keyId", (status, esperado) => {
    expect(traduzirChamadaDaEvolution(atualizacao(status), INSTANCIA)).toMatchObject([{ tipo: "status", idExterno: ID, status: esperado }]);
  });

  it("o instante é o da chegada (o corpo não tem um): ISO, perto de agora", () => {
    const [e] = traduzirChamadaDaEvolution(atualizacao("READ"), INSTANCIA);
    expect(e).toMatchObject({ tipo: "status" });
    expect(Math.abs(Date.now() - Date.parse((e as { em: string }).em))).toBeLessThan(5_000);
  });

  it("ERROR é falhou, com o motivo técnico para quem grava traduzir em frase", () => {
    expect(traduzirChamadaDaEvolution(atualizacao("ERROR"), INSTANCIA)).toMatchObject([{ tipo: "status", idExterno: ID, status: "falhou", motivo: "ERROR" }]);
  });

  it("a grafia do evento não importa: MESSAGES_UPDATE, como no webhook assinado", () => {
    expect(traduzirChamadaDaEvolution({ ...atualizacao("READ"), event: "MESSAGES_UPDATE" }, INSTANCIA)).toMatchObject([{ tipo: "status", status: "lida" }]);
  });

  it("PENDING e um status que não existe são ignorados com o motivo", () => {
    expect(traduzirChamadaDaEvolution(atualizacao("PENDING"), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "status:pending", idExterno: ID }]);
    expect(traduzirChamadaDaEvolution(atualizacao("OUTRO"), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "status:outro", idExterno: ID }]);
    expect(traduzirChamadaDaEvolution(atualizacao(undefined), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "status_sem_valor", idExterno: ID }]);
  });

  it("o recibo de uma Mensagem do Contato (fromMe falso: o celular a leu) não é status nosso", () => {
    expect(traduzirChamadaDaEvolution(atualizacao("READ", { fromMe: false }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "status_de_recebida", idExterno: ID }]);
  });

  it("a edição que chega como messages.update (status de enfeite SERVER_ACK) não é tique", () => {
    const editada = atualizacao("SERVER_ACK", { message: { editedMessage: { message: { conversation: "novo" } } } });
    expect(traduzirChamadaDaEvolution(editada, INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "edicao_no_status", idExterno: ID }]);
  });

  it("grupo, status@broadcast, sem keyId e corpo sem objeto nunca viram status", () => {
    expect(traduzirChamadaDaEvolution(atualizacao("READ", { remoteJid: "120363000000000000@g.us" }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "grupo" }]);
    expect(traduzirChamadaDaEvolution(atualizacao("READ", { remoteJid: "status@broadcast" }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "status" }]);
    expect(traduzirChamadaDaEvolution(atualizacao("READ", { keyId: "" }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "status_sem_id" }]);
    expect(traduzirChamadaDaEvolution(evento("messages.update", "texto"), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "formato_invalido" }]);
  });

  it("o corpo de outra instância não é deste Canal", () => {
    expect(traduzirChamadaDaEvolution({ ...atualizacao("READ"), instance: "outra" }, INSTANCIA)).toEqual([]);
  });
});

describe("traduzirChamadaDaEvolution: messages.delete, a Mensagem apagada (4.4.5)", () => {
  const apagada = (extras: Record<string, unknown> = {}) => evento("messages.delete", { remoteJid: JID, fromMe: false, id: ID, status: "DELETED", ...extras });

  it("o Contato apagou para todos: a Mensagem id é do remetente externo", () => {
    expect(traduzirChamadaDaEvolution(apagada(), INSTANCIA)).toMatchObject([{ tipo: "exclusao", idExterno: ID, porQuem: "remetente_externo" }]);
  });

  it("fromMe verdadeiro (quem apagou foi o celular do Canal)", () => {
    expect(traduzirChamadaDaEvolution(apagada({ fromMe: true }), INSTANCIA)).toMatchObject([{ tipo: "exclusao", idExterno: ID, porQuem: "celular_do_canal" }]);
  });

  it("a forma do DELETE /chat/deleteMessageForEveryone (key dentro) também vale, e o id de dentro de key é o do WhatsApp", () => {
    const corpo = evento("messages.delete", { id: "linha-do-banco", key: { remoteJid: JID, fromMe: true, id: ID }, status: "DELETED" });
    expect(traduzirChamadaDaEvolution(corpo, INSTANCIA)).toMatchObject([{ tipo: "exclusao", idExterno: ID, porQuem: "celular_do_canal" }]);
  });

  it("grupo, status@broadcast e sem id são ignorados", () => {
    expect(traduzirChamadaDaEvolution(apagada({ remoteJid: "120363000000000000@g.us" }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "grupo" }]);
    expect(traduzirChamadaDaEvolution(apagada({ remoteJid: "status@broadcast" }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "status" }]);
    expect(traduzirChamadaDaEvolution(apagada({ id: undefined }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "exclusao_sem_id" }]);
  });
});

describe("traduzirChamadaDaEvolution: messages.edited, a edição (4.4.5)", () => {
  const editada = (extras: Record<string, unknown> = {}) =>
    evento("messages.edited", { key: { remoteJid: JID, fromMe: true, id: ID }, type: "MESSAGE_EDIT", editedMessage: { conversation: "texto novo" }, timestampMs: "1731150060000", ...extras });

  it("a Mensagem original é key.id, o texto novo é editedMessage.conversation e o instante vem de timestampMs (milissegundos)", () => {
    expect(traduzirChamadaDaEvolution(editada(), INSTANCIA)).toEqual([{ tipo: "edicao", idExterno: ID, conteudo: "texto novo", em: new Date(1731150060000).toISOString() }]);
  });

  it("o texto também vem de extendedTextMessage.text, com ou sem o embrulho message", () => {
    expect(traduzirChamadaDaEvolution(editada({ editedMessage: { extendedTextMessage: { text: "longo novo" } } }), INSTANCIA)).toMatchObject([{ tipo: "edicao", conteudo: "longo novo" }]);
    expect(traduzirChamadaDaEvolution(editada({ editedMessage: { message: { conversation: "embrulhado" } } }), INSTANCIA)).toMatchObject([{ tipo: "edicao", conteudo: "embrulhado" }]);
  });

  it("o timestampMs como Long serializado ({ low, high }) e como número também valem; sem ele, vale o instante da chegada", () => {
    const ms = 1731150060000;
    const comoLong = { low: ms % 4294967296 | 0, high: Math.floor(ms / 4294967296) };
    expect(traduzirChamadaDaEvolution(editada({ timestampMs: comoLong }), INSTANCIA)).toMatchObject([{ em: new Date(ms).toISOString() }]);
    expect(traduzirChamadaDaEvolution(editada({ timestampMs: ms }), INSTANCIA)).toMatchObject([{ em: new Date(ms).toISOString() }]);
    const [semInstante] = traduzirChamadaDaEvolution(editada({ timestampMs: undefined }), INSTANCIA);
    expect(Math.abs(Date.now() - Date.parse((semInstante as { em: string }).em))).toBeLessThan(5_000);
  });

  it("a revogação que também chega por aqui (type REVOKE, em texto ou número) NÃO é edição: quem a trata é messages.delete", () => {
    expect(traduzirChamadaDaEvolution(editada({ type: "REVOKE", editedMessage: undefined }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "revogacao", idExterno: ID }]);
    expect(traduzirChamadaDaEvolution(editada({ type: 0, editedMessage: undefined }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "revogacao", idExterno: ID }]);
  });

  it("edição sem texto (legenda de mídia, tipo sem suporte), sem id ou em grupo é ignorada", () => {
    expect(traduzirChamadaDaEvolution(editada({ editedMessage: { imageMessage: {} } }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "edicao_sem_texto", idExterno: ID }]);
    expect(traduzirChamadaDaEvolution(editada({ key: {} }), INSTANCIA)).toEqual([{ tipo: "ignorado", motivo: "edicao_sem_id" }]);
    expect(traduzirChamadaDaEvolution(editada({ key: { remoteJid: "120363000000000000@g.us", id: ID } }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "grupo" }]);
  });
});

describe("traduzirChamadaDaEvolution: a Reação dentro do messages.upsert (4.4.5)", () => {
  const reagiu = (reacao: Record<string, unknown>, chave: Record<string, unknown> = {}) => ({
    ...texto,
    data: {
      ...texto.data,
      key: { ...texto.data.key, id: "3EB0REACAO", ...chave },
      message: { reactionMessage: { key: { remoteJid: JID, fromMe: true, id: ID }, ...reacao } },
      messageType: "reactionMessage",
    },
  });

  it("o Contato reagiu: o alvo é reactionMessage.key.id (não o id do evento), o símbolo é o text e o instante é senderTimestampMs", () => {
    expect(traduzirChamadaDaEvolution(reagiu({ text: "👍", senderTimestampMs: 1731150123000 }), INSTANCIA)).toEqual([
      { tipo: "reacao", idExterno: ID, autor: "contato", emoji: "👍", em: new Date(1731150123000).toISOString() },
    ]);
  });

  it("o celular do Canal reagiu (key.fromMe de fora verdadeiro): o autor é o canal", () => {
    expect(traduzirChamadaDaEvolution(reagiu({ text: "❤️" }, { fromMe: true }), INSTANCIA)).toMatchObject([{ tipo: "reacao", autor: "canal", emoji: "❤️" }]);
  });

  it("a reação removida (text vazio ou ausente) é o símbolo vazio", () => {
    expect(traduzirChamadaDaEvolution(reagiu({ text: "" }), INSTANCIA)).toMatchObject([{ tipo: "reacao", emoji: "" }]);
    expect(traduzirChamadaDaEvolution(reagiu({}), INSTANCIA)).toMatchObject([{ tipo: "reacao", emoji: "" }]);
  });

  it("sem senderTimestampMs vale o messageTimestamp do evento", () => {
    expect(traduzirChamadaDaEvolution(reagiu({ text: "👍" }), INSTANCIA)).toMatchObject([{ em: new Date(texto.data.messageTimestamp * 1000).toISOString() }]);
  });

  it("sem a Mensagem reagida (reactionMessage.key.id) não há alvo: ignorada", () => {
    expect(traduzirChamadaDaEvolution(reagiu({ text: "👍", key: {} }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "reacao_sem_alvo" }]);
  });

  it("a reação em grupo continua ignorada", () => {
    expect(traduzirChamadaDaEvolution(reagiu({ text: "👍" }, { remoteJid: "120363000000000000@g.us" }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "grupo" }]);
  });
});

describe("traduzirChamadaDaEvolution: a citação de entrada (4.4.2)", () => {
  const comContexto = (message: Record<string, unknown>, topo: Record<string, unknown> = {}) => ({ ...texto, data: { ...texto.data, message, ...topo } });

  it("texto que cita (extendedTextMessage.contextInfo.stanzaId, a forma da 2.3.x)", () => {
    const corpo = comContexto({ extendedTextMessage: { text: "respondendo", contextInfo: { stanzaId: ID, participant: JID, quotedMessage: { conversation: "antes" } } } });
    expect(umaMensagem(corpo)).toMatchObject({ conteudo: "respondendo", emRespostaAIdExterno: ID });
  });

  it("texto que cita pelo contextInfo do topo do corpo (o achatamento da 2.3.7)", () => {
    expect(umaMensagem(comContexto({ conversation: "respondendo" }, { contextInfo: { stanzaId: ID } }))).toMatchObject({ emRespostaAIdExterno: ID });
  });

  it("mídia que cita (imageMessage.contextInfo.stanzaId)", () => {
    const corpo = comContexto({ imageMessage: { mimetype: "image/jpeg", caption: "foto", contextInfo: { stanzaId: ID } } });
    expect(umaMensagem(corpo)).toMatchObject({ conteudo: "foto", emRespostaAIdExterno: ID });
  });

  it("sem citação, a Mensagem não leva a marca", () => {
    expect(umaMensagem(texto)).not.toHaveProperty("emRespostaAIdExterno");
    expect(umaMensagem(comContexto({ conversation: "oi" }, { contextInfo: { stanzaId: "  " } }))).not.toHaveProperty("emRespostaAIdExterno");
  });
});

describe("semApikey", () => {
  it("tira a apikey de qualquer nível e deixa o resto igual, sem mexer no original", () => {
    const original = { a: 1, apikey: "x", data: { b: [{ apikey: "y", c: 2 }] } };
    expect(semApikey(original)).toEqual({ a: 1, data: { b: [{ c: 2 }] } });
    expect(original.apikey).toBe("x");
    expect(semApikey("texto")).toBe("texto");
    expect(semApikey(null)).toBeNull();
  });
});
