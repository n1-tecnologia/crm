/**
 * O tradutor do webhook do WhatsApp oficial (7.2.4): corpos no formato da documentação da Cloud API viram eventos. Puro,
 * sem rede nem banco. NÃO é prova contra a Meta real: os corpos são exemplos escritos a partir da documentação.
 */

import { describe, expect, it } from "vitest";
import { chaveDoItem, corpoDeUmItem, itensDoValor, traduzirChamadaDaCloudApi, valoresDoCorpo, TEXTO_DE_MENSAGEM_NAO_SUPORTADA } from "./traduzir";

const FONE = "109876543210001";
const WABA = "100200300400500";
const T = "1783605600"; // 2026-07-09T...Z (segundos, como texto)

function corpo(valor: Record<string, unknown>, fone = FONE) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "5511977770001", phone_number_id: fone }, ...valor } }] }],
  };
}

const contatos = [{ profile: { name: "Ana Souza" }, wa_id: "5511987654321" }];
const recebida = (mensagem: Record<string, unknown>) => corpo({ contacts: contatos, messages: [{ from: "5511987654321", id: "wamid.R1", timestamp: T, ...mensagem }] });

describe("mensagens recebidas", () => {
  it("texto: remetente com + e o nome do perfil, instante em ISO, carga bruta guardada", () => {
    const [evento] = traduzirChamadaDaCloudApi(recebida({ type: "text", text: { body: "Olá, tudo bem?" } }), FONE);
    expect(evento).toMatchObject({
      tipo: "mensagem",
      idExterno: "wamid.R1",
      remetente: { tipo: "whatsapp", valor: "+5511987654321", nomeExibido: "Ana Souza" },
      conteudo: "Olá, tudo bem?",
    });
    expect((evento as { criadoEm: string }).criadoEm).toBe(new Date(Number(T) * 1000).toISOString());
    expect((evento as { cargaBruta: unknown }).cargaBruta).toMatchObject({ id: "wamid.R1" });
  });

  it("mensagem citada: context.id vira emRespostaAIdExterno", () => {
    const [evento] = traduzirChamadaDaCloudApi(recebida({ type: "text", text: { body: "Sim" }, context: { from: "5511977770001", id: "wamid.ORIGINAL" } }), FONE);
    expect(evento).toMatchObject({ tipo: "mensagem", emRespostaAIdExterno: "wamid.ORIGINAL" });
  });

  it.each([
    ["image", { id: "M1", mime_type: "image/jpeg", caption: "Olha", sha256: "x" }, "image/jpeg", "Olha"],
    ["audio", { id: "M2", mime_type: "audio/ogg; codecs=opus", voice: true }, "audio/ogg; codecs=opus", undefined],
    ["video", { id: "M3", mime_type: "video/mp4" }, "video/mp4", undefined],
    ["document", { id: "M4", mime_type: "application/pdf", filename: "proposta.pdf", caption: "Segue" }, "application/pdf", "Segue"],
    ["sticker", { id: "M5", mime_type: "image/webp" }, "image/webp", undefined],
  ] as const)("%s: o id da mídia é a referência (não há URL), com o tipo declarado e a legenda", (tipo, carga, mime, legenda) => {
    const [evento] = traduzirChamadaDaCloudApi(recebida({ type: tipo, [tipo]: carga }), FONE);
    expect(evento).toMatchObject({ tipo: "mensagem", anexos: [{ referenciaNoProvedor: carga.id, tipoDeMidia: mime }] });
    expect((evento as { conteudo?: string }).conteudo).toBe(legenda);
  });

  it("documento: o nome do arquivo vem do filename", () => {
    const [evento] = traduzirChamadaDaCloudApi(recebida({ type: "document", document: { id: "M4", mime_type: "application/pdf", filename: "proposta.pdf" } }), FONE);
    expect(evento).toMatchObject({ anexos: [{ nome: "proposta.pdf" }] });
  });

  it("localização e contato compartilhado viram texto legível", () => {
    const [local] = traduzirChamadaDaCloudApi(recebida({ type: "location", location: { latitude: -23.55, longitude: -46.63, name: "Escritório", address: "Av. Paulista, 1" } }), FONE);
    expect(local).toMatchObject({ conteudo: "Localização: Escritório, Av. Paulista, 1 (-23.55, -46.63)" });
    const [cartao] = traduzirChamadaDaCloudApi(recebida({ type: "contacts", contacts: [{ name: { formatted_name: "Bruno" } }] }), FONE);
    expect(cartao).toMatchObject({ conteudo: "Contato compartilhado: Bruno" });
  });

  it("resposta de botão e de lista: o título é o texto", () => {
    const [botao] = traduzirChamadaDaCloudApi(recebida({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "1", title: "Quero saber mais" } } }), FONE);
    expect(botao).toMatchObject({ conteudo: "Quero saber mais" });
    const [lista] = traduzirChamadaDaCloudApi(recebida({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "2", title: "Plano Ouro" } } }), FONE);
    expect(lista).toMatchObject({ conteudo: "Plano Ouro" });
    const [rapida] = traduzirChamadaDaCloudApi(recebida({ type: "button", button: { text: "Confirmar", payload: "c" } }), FONE);
    expect(rapida).toMatchObject({ conteudo: "Confirmar" });
  });

  it("resposta de Flow (nfm_reply): ignorada por enquanto, com o motivo (é da 7.4)", () => {
    const [evento] = traduzirChamadaDaCloudApi(recebida({ type: "interactive", interactive: { type: "nfm_reply", nfm_reply: { response_json: "{}" } } }), FONE);
    expect(evento).toEqual({ tipo: "ignorado", motivo: "resposta_de_flow", idExterno: "wamid.R1" });
  });

  it("tipo que o WhatsApp não repassa: a Mensagem leva a frase de não suportada, para o atendente ver que veio algo", () => {
    const [evento] = traduzirChamadaDaCloudApi(recebida({ type: "unsupported", errors: [{ code: 131051 }] }), FONE);
    expect(evento).toMatchObject({ tipo: "mensagem", conteudo: TEXTO_DE_MENSAGEM_NAO_SUPORTADA });
  });

  it("sem id, sem remetente ou sem instante: ignorada com o motivo, nunca exceção", () => {
    expect(traduzirChamadaDaCloudApi(corpo({ messages: [{ from: "55", timestamp: T, type: "text", text: { body: "x" } }] }), FONE)).toEqual([{ tipo: "ignorado", motivo: "sem_id" }]);
    expect(traduzirChamadaDaCloudApi(corpo({ messages: [{ id: "w", timestamp: T, type: "text", text: { body: "x" } }] }), FONE)).toEqual([{ tipo: "ignorado", motivo: "sem_remetente", idExterno: "w" }]);
    expect(traduzirChamadaDaCloudApi(corpo({ messages: [{ id: "w", from: "55", type: "text", text: { body: "x" } }] }), FONE)).toEqual([{ tipo: "ignorado", motivo: "sem_instante", idExterno: "w" }]);
  });
});

describe("reações", () => {
  it("o emoji vai para a Mensagem reagida (message_id), autor contato", () => {
    const [evento] = traduzirChamadaDaCloudApi(recebida({ type: "reaction", reaction: { message_id: "wamid.NOSSA", emoji: "👍" } }), FONE);
    expect(evento).toEqual({ tipo: "reacao", idExterno: "wamid.NOSSA", autor: "contato", emoji: "👍", em: new Date(Number(T) * 1000).toISOString() });
  });

  it("sem emoji é a reação removida", () => {
    const [evento] = traduzirChamadaDaCloudApi(recebida({ type: "reaction", reaction: { message_id: "wamid.NOSSA" } }), FONE);
    expect(evento).toMatchObject({ tipo: "reacao", emoji: "" });
  });
});

describe("status de entrega", () => {
  const status = (s: Record<string, unknown>) => corpo({ statuses: [{ id: "wamid.ENVIADA1", recipient_id: "5511987654321", timestamp: T, ...s }] });

  it.each([
    ["sent", "enviada"],
    ["delivered", "entregue"],
    ["read", "lida"],
  ] as const)("%s → %s, com o instante", (da, para) => {
    expect(traduzirChamadaDaCloudApi(status({ status: da }), FONE)).toEqual([
      { tipo: "status", idExterno: "wamid.ENVIADA1", status: para, em: new Date(Number(T) * 1000).toISOString() },
    ]);
  });

  it("failed → falhou, com o código e o título curto da Meta como motivo", () => {
    const [evento] = traduzirChamadaDaCloudApi(status({ status: "failed", errors: [{ code: 131047, title: "Re-engagement message", message: "longo..." }] }), FONE);
    expect(evento).toMatchObject({ tipo: "status", status: "falhou", motivo: "131047: Re-engagement message" });
  });

  it("estado que não conhecemos é ignorado", () => {
    expect(traduzirChamadaDaCloudApi(status({ status: "deleted" }), FONE)).toEqual([{ tipo: "ignorado", motivo: "status_desconhecido", idExterno: "wamid.ENVIADA1" }]);
  });
});

describe("de quem é o corpo", () => {
  it("o corpo de OUTRO número não vira evento neste Canal", () => {
    expect(traduzirChamadaDaCloudApi(recebida({ type: "text", text: { body: "x" } }), "999000111222")).toEqual([{ tipo: "ignorado", motivo: "outro_numero" }]);
  });

  it("corpo que não é da Meta, ou de outro produto, é corpo_invalido", () => {
    expect(traduzirChamadaDaCloudApi(null, FONE)).toEqual([{ tipo: "ignorado", motivo: "corpo_invalido" }]);
    expect(traduzirChamadaDaCloudApi({ object: "instagram", entry: [] }, FONE)).toEqual([{ tipo: "ignorado", motivo: "corpo_invalido" }]);
  });

  it("só o campo messages interessa: message_template_status_update não vira valor", () => {
    const corpoDeModelo = { object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "message_template_status_update", value: { event: "APPROVED" } }] }] };
    expect(valoresDoCorpo(corpoDeModelo)).toEqual([]);
  });

  it("um valor sem mensagem nem status é evento_nao_tratado", () => {
    expect(traduzirChamadaDaCloudApi(corpo({}), FONE)).toEqual([{ tipo: "ignorado", motivo: "evento_nao_tratado" }]);
  });
});

describe("a fila: um item por linha", () => {
  const dois = corpo({
    contacts: contatos,
    messages: [
      { from: "5511987654321", id: "wamid.A", timestamp: T, type: "text", text: { body: "um" } },
      { from: "5511987654321", id: "wamid.B", timestamp: T, type: "text", text: { body: "dois" } },
    ],
    statuses: [{ id: "wamid.ENVIADA1", status: "read", timestamp: T }],
  });

  it("cada mensagem e cada status vira um item, e cada item vira um corpo só com ele (mantendo o perfil)", () => {
    const [valor] = valoresDoCorpo(dois);
    const itens = itensDoValor(valor!.valor);
    expect(itens.map((i) => i.tipo)).toEqual(["mensagem", "mensagem", "status"]);
    const corpos = itens.map((i) => corpoDeUmItem(valor!, i));
    expect(chaveDoItem(corpos[0])).toBe("wamid.A");
    expect(chaveDoItem(corpos[1])).toBe("wamid.B");
    expect(chaveDoItem(corpos[2])).toBe("status:wamid.ENVIADA1:read");
    // O corpo de um item traduz sozinho, e o nome de quem escreveu continua nele.
    expect(traduzirChamadaDaCloudApi(corpos[0], FONE)[0]).toMatchObject({ tipo: "mensagem", idExterno: "wamid.A", remetente: { nomeExibido: "Ana Souza" } });
    expect(traduzirChamadaDaCloudApi(corpos[2], FONE)[0]).toMatchObject({ tipo: "status", status: "lida" });
  });

  it("o mesmo status em estados diferentes tem chaves diferentes (sent, delivered e read não se anulam)", () => {
    const chave = (estado: string) => chaveDoItem(corpo({ statuses: [{ id: "wamid.X", status: estado, timestamp: T }] }));
    expect(new Set([chave("sent"), chave("delivered"), chave("read")]).size).toBe(3);
  });
});
