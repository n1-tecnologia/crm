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
    expect(traduzirChamadaDaEvolution(deCelular({}, { reactionMessage: { text: "👍" } }), INSTANCIA)).toMatchObject([{ tipo: "ignorado", motivo: "reacao" }]);
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
    expect(traduzirChamadaDaEvolution({ ...texto, event: "messages.update" }, INSTANCIA)).toEqual([]);
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

describe("semApikey", () => {
  it("tira a apikey de qualquer nível e deixa o resto igual, sem mexer no original", () => {
    const original = { a: 1, apikey: "x", data: { b: [{ apikey: "y", c: 2 }] } };
    expect(semApikey(original)).toEqual({ a: 1, data: { b: [{ c: 2 }] } });
    expect(original.apikey).toBe("x");
    expect(semApikey("texto")).toBe("texto");
    expect(semApikey(null)).toBeNull();
  });
});
