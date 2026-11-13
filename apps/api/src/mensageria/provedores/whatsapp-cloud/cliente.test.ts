/**
 * O cliente da Cloud API contra um servidor falso no lugar da Meta (7.2.2): o que vai em cada pedido (endereço, método,
 * corpo, onde o token viaja) e o que se lê da resposta, nos formatos da documentação. Nenhum erro carrega o token.
 * NÃO é prova contra a Meta real: a conferência dos nomes dos campos na versão fixada é da primeira conexão.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import { criarClienteDaCloudApi, ErroDaCloudApi } from "./cliente";
import type { ConfiguracaoDaCloudApi } from "./configuracao";

const TOKEN = "EAAG-token-secreto-de-teste";
const FONE = "109876543210001";
const WABA = "100200300400500";

let meta: ServidorFalso;
let config: ConfiguracaoDaCloudApi;

beforeAll(async () => {
  meta = await criarServidorFalso();
  config = { appSecret: "segredo-do-app", versao: "v24.0", graph: meta.url };
});

afterAll(async () => {
  await meta.fechar();
});

const cliente = () => criarClienteDaCloudApi(config, { tempoLimiteMs: 1_500 });
const ultima = () => meta.recebidas.at(-1)!;
const enviadaOk = (id = "wamid.ENVIADA1") =>
  meta.enfileirar({ kind: "ok", status: 200, corpo: { messaging_product: "whatsapp", contacts: [{ input: "5511987654321", wa_id: "5511987654321" }], messages: [{ id }] } });

describe("enviar", () => {
  it("texto: POST /{numero}/messages na versão fixada, token no cabeçalho, nunca na URL", async () => {
    enviadaOk();
    expect(await cliente().enviarTexto(TOKEN, FONE, "5511987654321", "Olá!")).toEqual({ idExterno: "wamid.ENVIADA1" });
    const pedido = ultima();
    expect(pedido.metodo).toBe("POST");
    expect(pedido.caminho).toBe(`/v24.0/${FONE}/messages`);
    expect(pedido.cabecalhos.authorization).toBe(`Bearer ${TOKEN}`);
    expect(pedido.caminho).not.toContain(TOKEN);
    expect(pedido.corpo).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511987654321",
      type: "text",
      text: { body: "Olá!", preview_url: false },
    });
  });

  it("citação: leva o id da Mensagem citada em context.message_id", async () => {
    enviadaOk();
    await cliente().enviarTexto(TOKEN, FONE, "5511987654321", "Sim", { emRespostaA: "wamid.ORIGINAL" });
    expect(ultima().corpo).toMatchObject({ context: { message_id: "wamid.ORIGINAL" } });
  });

  it.each([
    ["image", { link: "https://arquivos.exemplo.test/a.jpg", caption: "Legenda" }],
    ["video", { link: "https://arquivos.exemplo.test/a.mp4", caption: "Legenda" }],
  ] as const)("%s: por link, com a legenda", async (tipo, carga) => {
    enviadaOk();
    await cliente().enviarMidia(TOKEN, FONE, "5511987654321", { tipo, url: carga.link, legenda: "Legenda" });
    expect(ultima().corpo).toMatchObject({ type: tipo, [tipo]: carga });
  });

  it("áudio: sem legenda, mesmo que venha uma", async () => {
    enviadaOk();
    await cliente().enviarMidia(TOKEN, FONE, "5511987654321", { tipo: "audio", url: "https://arquivos.exemplo.test/a.ogg", legenda: "ignorada" });
    expect((ultima().corpo as { audio: Record<string, unknown> }).audio).toEqual({ link: "https://arquivos.exemplo.test/a.ogg" });
  });

  it("documento: leva o nome do arquivo e a legenda", async () => {
    enviadaOk();
    await cliente().enviarMidia(TOKEN, FONE, "5511987654321", { tipo: "document", url: "https://arquivos.exemplo.test/p.pdf", legenda: "Proposta", nome: "proposta.pdf" });
    expect((ultima().corpo as { document: Record<string, unknown> }).document).toEqual({
      link: "https://arquivos.exemplo.test/p.pdf",
      caption: "Proposta",
      filename: "proposta.pdf",
    });
  });

  it("modelo: nome, idioma e as variáveis do corpo, em ordem", async () => {
    enviadaOk();
    await cliente().enviarModelo(TOKEN, FONE, "5511987654321", { nome: "boas_vindas", idioma: "pt_BR", variaveis: ["Ana", "Quarta"] });
    expect((ultima().corpo as { type: string; template: unknown }).template).toEqual({
      name: "boas_vindas",
      language: { code: "pt_BR" },
      components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "Quarta" }] }],
    });
  });

  it("modelo sem variável: não manda components", async () => {
    enviadaOk();
    await cliente().enviarModelo(TOKEN, FONE, "5511987654321", { nome: "ola", idioma: "pt_BR", variaveis: [] });
    expect((ultima().corpo as { template: Record<string, unknown> }).template).toEqual({ name: "ola", language: { code: "pt_BR" } });
  });

  it("aceito sem o id da mensagem é ErroDaCloudApi 200: saiu, sem como acompanhar", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { messaging_product: "whatsapp", messages: [] } });
    const erro = await cliente().enviarTexto(TOKEN, FONE, "5511987654321", "x").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaCloudApi);
    expect((erro as ErroDaCloudApi).status).toBe(200);
  });
});

describe("as outras chamadas", () => {
  it("marcarComoLida: POST /{numero}/messages com status read", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { success: true } });
    await cliente().marcarComoLida(TOKEN, FONE, "wamid.RECEBIDA");
    expect(ultima().corpo).toEqual({ messaging_product: "whatsapp", status: "read", message_id: "wamid.RECEBIDA" });
  });

  it("dadosDoNumero: GET /{numero}?fields=display_phone_number,verified_name", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { id: FONE, display_phone_number: "+55 11 97777-0001", verified_name: "Tria" } });
    expect(await cliente().dadosDoNumero(TOKEN, FONE)).toEqual({ numeroExibido: "+55 11 97777-0001", nomeVerificado: "Tria" });
    expect(ultima().metodo).toBe("GET");
    expect(ultima().caminho).toBe(`/v24.0/${FONE}?fields=display_phone_number%2Cverified_name`);
    expect(ultima().cabecalhos.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("dadosDoNumero sem display_phone_number: erro, não um número vazio", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { id: FONE } });
    await expect(cliente().dadosDoNumero(TOKEN, FONE)).rejects.toBeInstanceOf(ErroDaCloudApi);
  });

  it("inscreverApp: POST /{waba}/subscribed_apps", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { success: true } });
    await cliente().inscreverApp(TOKEN, WABA);
    expect(ultima().metodo).toBe("POST");
    expect(ultima().caminho).toBe(`/v24.0/${WABA}/subscribed_apps`);
  });

  it("inscreverApp sem success: erro", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { success: false } });
    await expect(cliente().inscreverApp(TOKEN, WABA)).rejects.toBeInstanceOf(ErroDaCloudApi);
  });

  it("lerMidia: GET /{midia} devolve o endereço temporário e o tipo", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1", mime_type: "image/jpeg", file_size: 2048, id: "MID1" } });
    expect(await cliente().lerMidia(TOKEN, "MID1")).toEqual({
      url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1",
      tipoDeMidia: "image/jpeg",
      tamanhoBytes: 2048,
    });
    expect(ultima().caminho).toBe("/v24.0/MID1");
  });
});

describe("erros", () => {
  it("token vencido (190): tokenInvalido, com o status e a frase da Meta, sem o token", async () => {
    meta.enfileirar({ kind: "ok", status: 401, corpo: { error: { message: "Error validating access token", type: "OAuthException", code: 190, fbtrace_id: "x" } } });
    const erro = (await cliente().enviarTexto(TOKEN, FONE, "5511987654321", "x").catch((e: unknown) => e)) as ErroDaCloudApi;
    expect(erro).toBeInstanceOf(ErroDaCloudApi);
    expect(erro.tokenInvalido).toBe(true);
    expect(erro.status).toBe(401);
    expect(erro.message).not.toContain(TOKEN);
  });

  it("fora da janela (131047): o código chega ao provedor; a frase usa o detalhe da Meta", async () => {
    meta.enfileirar({ kind: "ok", status: 400, corpo: { error: { message: "(#131047) Re-engagement message", type: "OAuthException", code: 131047, error_data: { messaging_product: "whatsapp", details: "Message failed to send because more than 24 hours have passed." } } } });
    const erro = (await cliente().enviarTexto(TOKEN, FONE, "5511987654321", "x").catch((e: unknown) => e)) as ErroDaCloudApi;
    expect(erro.codigo).toBe(131047);
    expect(erro.message).toMatch(/24 hours/);
  });

  it("tempo esgotado: transporte tempo_esgotado (pode ter chegado)", async () => {
    meta.enfileirar({ kind: "timeout" });
    const erro = (await cliente().enviarTexto(TOKEN, FONE, "5511987654321", "x").catch((e: unknown) => e)) as ErroDaCloudApi;
    expect(erro.transporte).toBe("tempo_esgotado");
    expect(erro.message).not.toContain(TOKEN);
  });

  it("resposta perdida: transporte resposta_perdida (pode ter chegado)", async () => {
    meta.enfileirar({ kind: "respostaPerdida" });
    const erro = (await cliente().enviarTexto(TOKEN, FONE, "5511987654321", "x").catch((e: unknown) => e)) as ErroDaCloudApi;
    expect(erro.transporte).toBe("resposta_perdida");
  });

  it("conexão recusada (ECONNREFUSED na causa): transporte rede (certamente não saiu)", async () => {
    // O `fetch` do Node embrulha o erro de socket em `TypeError: fetch failed`, com o código na causa.
    const recusado = (async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
    }) as unknown as typeof fetch;
    const fora = criarClienteDaCloudApi(config, { fetch: recusado });
    const erro = (await fora.enviarTexto(TOKEN, FONE, "5511987654321", "x").catch((e: unknown) => e)) as ErroDaCloudApi;
    expect(erro.transporte).toBe("rede");
    expect(erro.message).not.toContain(TOKEN);
  });
});

describe("listarModelos (7.3.2)", () => {
  const modelo = (n: number, extras: Record<string, unknown> = {}) => ({
    id: `19000${n}`,
    name: `modelo_${n}`,
    language: "pt_BR",
    category: "UTILITY",
    status: "APPROVED",
    components: [{ type: "BODY", text: `Olá {{1}} ${n}` }],
    ...extras,
  });

  it("lê uma página: GET /{waba}/message_templates com os campos, o limite e o token no cabeçalho", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { data: [modelo(1), modelo(2, { status: "REJECTED", rejected_reason: "INVALID_FORMAT" })] } });
    const lidos = await cliente().listarModelos(TOKEN, WABA);
    expect(lidos.map((m) => [m.name, m.status, m.rejected_reason])).toEqual([["modelo_1", "APPROVED", undefined], ["modelo_2", "REJECTED", "INVALID_FORMAT"]]);
    const pedido = ultima();
    expect(pedido.metodo).toBe("GET");
    expect(pedido.caminho).toBe(`/v24.0/${WABA}/message_templates?fields=id%2Cname%2Clanguage%2Ccategory%2Cstatus%2Ccomponents%2Crejected_reason&limit=100`);
    expect(pedido.cabecalhos.authorization).toBe(`Bearer ${TOKEN}`);
    expect(pedido.caminho).not.toContain(TOKEN);
  });

  it("segue a paginação no MESMO host, com o token em cada página", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { data: [modelo(1)], paging: { next: `${meta.url}/v24.0/${WABA}/message_templates?after=ABC` } } });
    meta.enfileirar({ kind: "ok", status: 200, corpo: { data: [modelo(2)] } });
    const antes = meta.recebidas.length;
    const lidos = await cliente().listarModelos(TOKEN, WABA);
    expect(lidos.map((m) => m.name)).toEqual(["modelo_1", "modelo_2"]);
    const novas = meta.recebidas.slice(antes);
    expect(novas).toHaveLength(2);
    expect(novas[1]!.caminho).toBe(`/v24.0/${WABA}/message_templates?after=ABC`);
    expect(novas[1]!.cabecalhos.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("uma próxima página em OUTRO host nunca é seguida (o token não sai para lá)", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { data: [modelo(1)], paging: { next: "https://interno.exemplo.test/v24.0/x/message_templates?after=ABC" } } });
    const antes = meta.recebidas.length;
    const erro = (await cliente().listarModelos(TOKEN, WABA).catch((e: unknown) => e)) as ErroDaCloudApi;
    expect(erro).toBeInstanceOf(ErroDaCloudApi);
    expect(erro.message).toMatch(/outro endereço/);
    expect(meta.recebidas.length - antes).toBe(1);
  });

  it("uma paginação que nunca acaba para no teto, em vez de rodar para sempre", async () => {
    for (let i = 0; i < 25; i += 1) {
      meta.enfileirar({ kind: "ok", status: 200, corpo: { data: [modelo(i)], paging: { next: `${meta.url}/v24.0/${WABA}/message_templates?after=P${i}` } } });
    }
    const antes = meta.recebidas.length;
    const erro = (await cliente().listarModelos(TOKEN, WABA).catch((e: unknown) => e)) as ErroDaCloudApi;
    expect(erro).toBeInstanceOf(ErroDaCloudApi);
    expect(erro.message).toMatch(/muitas páginas/);
    expect(meta.recebidas.length - antes).toBe(20);
    // Esvazia a fila que sobrou, para não vazar para os testes seguintes.
    for (let i = 0; i < 5; i += 1) await cliente().listarModelos(TOKEN, WABA).catch(() => undefined);
  });

  it("resposta sem `data` é erro; item sem id, nome, idioma, categoria ou estado fica de fora", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { sem: "data" } });
    await expect(cliente().listarModelos(TOKEN, WABA)).rejects.toBeInstanceOf(ErroDaCloudApi);
    meta.enfileirar({ kind: "ok", status: 200, corpo: { data: [modelo(1), { id: "x", name: "sem_idioma" }, null, modelo(3)] } });
    expect((await cliente().listarModelos(TOKEN, WABA)).map((m) => m.name)).toEqual(["modelo_1", "modelo_3"]);
  });

  it("token vencido (190) na listagem: tokenInvalido", async () => {
    meta.enfileirar({ kind: "ok", status: 401, corpo: { error: { message: "Error validating access token", code: 190 } } });
    const erro = (await cliente().listarModelos(TOKEN, WABA).catch((e: unknown) => e)) as ErroDaCloudApi;
    expect(erro.tokenInvalido).toBe(true);
  });
});
