/**
 * O cliente da Evolution e o `enviar`/`baixarMidia` do provedor contra o servidor HTTP FALSO (16-12, Task 2, MSG-06).
 * Sem banco, sem Evolution real: `testes/servidor-falso.ts` abre uma porta efêmera e responde o que o teste programa.
 */

import { createServer } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { ErroDeProvedor, type CanalParaProvedor, type EnvioAoProvedor } from "../../provedor";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import { criarClienteDaEvolution, ErroDaEvolution, imagemDoQrCode } from "./cliente";
import { criarProvedorEvolution } from "./provedor";

const APIKEY = "tok-inst-segredo-9f3a";
const GLOBAL = "chave-global-7c1d";
const INSTANCIA = "inst-teste";
const SEGREDO_DO_WEBHOOK = "segredo-do-webhook-1b2c";

let falso: ServidorFalso;

beforeEach(async () => {
  falso = await criarServidorFalso();
});

afterEach(async () => {
  await falso.fechar();
});

/** Uma porta em que acabou de haver um servidor e agora não há ninguém: a conexão é recusada. */
async function portaSemNinguem(): Promise<number> {
  return new Promise<number>((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const porta = (s.address() as { port: number }).port;
      s.close(() => resolve(porta));
    });
  });
}

const cliente = (timeoutMs = 2_000) => criarClienteDaEvolution({ url: falso.url, timeoutMs });

describe("cliente da Evolution: uma chamada por função, com apikey e o corpo exato", () => {
  it("versao: GET / devolve o version", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: 200, message: "Welcome to the Evolution API", version: "2.3.7" } });
    expect(await cliente().versao(GLOBAL)).toBe("2.3.7");
    expect(falso.recebidas[0]).toMatchObject({ metodo: "GET", caminho: "/", cabecalhos: { apikey: GLOBAL } });
  });

  it("buscarInstancia: GET /instance/fetchInstances?instanceName= devolve ownerJid, token e o estado; sem a instância, undefined", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: "inst", ownerJid: "5511977770001@s.whatsapp.net", token: "tok-da-inst", connectionStatus: "open" }] });
    expect(await cliente().buscarInstancia(GLOBAL, "inst")).toEqual({ ownerJid: "5511977770001@s.whatsapp.net", token: "tok-da-inst", connectionStatus: "open" });
    expect(falso.recebidas[0]).toMatchObject({ metodo: "GET", caminho: "/instance/fetchInstances?instanceName=inst", cabecalhos: { apikey: GLOBAL } });

    falso.enfileirar({ kind: "ok", status: 200, corpo: [] });
    expect(await cliente().buscarInstancia(GLOBAL, "inst")).toBeUndefined();
  });

  it("estadoDaConexao: GET /instance/connectionState/<instancia> devolve open, close ou connecting", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA, state: "open" } } });
    expect(await cliente().estadoDaConexao(APIKEY, INSTANCIA)).toBe("open");
    expect(falso.recebidas[0]).toMatchObject({ metodo: "GET", caminho: `/instance/connectionState/${INSTANCIA}`, cabecalhos: { apikey: APIKEY } });

    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA, state: "connecting" } } });
    expect(await cliente().estadoDaConexao(APIKEY, INSTANCIA)).toBe("connecting");
  });

  it("configurarWebhook: POST /webhook/set/<instancia> com enabled, url, headers com o segredo, byEvents false, base64 false e os eventos MESSAGES_UPSERT e CONNECTION_UPDATE (4.3.1)", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { enabled: true } });
    await cliente().configurarWebhook(APIKEY, INSTANCIA, { url: "https://api.exemplo.test/webhooks/mensageria/canal_1", segredo: SEGREDO_DO_WEBHOOK });
    expect(falso.recebidas[0]).toMatchObject({ metodo: "POST", caminho: `/webhook/set/${INSTANCIA}`, cabecalhos: { apikey: APIKEY } });
    expect(falso.recebidas[0]!.corpo).toEqual({
      webhook: {
        enabled: true,
        url: "https://api.exemplo.test/webhooks/mensageria/canal_1",
        headers: { "x-n1-webhook-segredo": SEGREDO_DO_WEBHOOK },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      },
    });
  });

  it("configurarWebhook que não é 2xx lança sem repetir o corpo (a resposta ecoa os cabeçalhos com o segredo)", async () => {
    falso.enfileirar({ kind: "ok", status: 400, corpo: { response: { message: [`headers ${SEGREDO_DO_WEBHOOK}`] } } });
    const erro = await cliente()
      .configurarWebhook(APIKEY, INSTANCIA, { url: "https://api.exemplo.test/w", segredo: SEGREDO_DO_WEBHOOK })
      .then(() => undefined, (e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaEvolution);
    expect(erro).toMatchObject({ tipo: "http", status: 400 });
    expect(JSON.stringify([(erro as Error).message, (erro as Error).stack])).not.toContain(SEGREDO_DO_WEBHOOK);
  });

  it("enviarTexto: 201 devolve o key.id; o 400 com exists:false marca semWhatsapp", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0AA" } } });
    expect(await cliente().enviarTexto(APIKEY, INSTANCIA, { numero: "5511987654321", texto: "olá" })).toEqual({ status: 201, idExterno: "3EB0AA" });

    falso.enfileirar({ kind: "ok", status: 400, corpo: { status: 400, error: "Bad Request", response: { message: [{ jid: "5511900000000@s.whatsapp.net", exists: false, number: "5511900000000" }] } } });
    expect(await cliente().enviarTexto(APIKEY, INSTANCIA, { numero: "5511900000000", texto: "olá" })).toEqual({ status: 400, semWhatsapp: true });

    falso.enfileirar({ kind: "ok", status: 400, corpo: { response: { message: ["text is required"] } } });
    expect(await cliente().enviarTexto(APIKEY, INSTANCIA, { numero: "5511900000000", texto: "x" })).toEqual({ status: 400 });
  });

  it("enviarMidia: POST /message/sendMedia/<instancia> com number, mediatype, media, mimetype, fileName e caption", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { id: "3EB0BB" } } });
    const r = await cliente().enviarMidia(APIKEY, INSTANCIA, {
      numero: "5511987654321",
      mediatype: "document",
      media: "https://bucket.exemplo.test/arquivo?token=abc",
      mimetype: "application/pdf",
      fileName: "contrato.pdf",
      caption: "segue",
    });
    expect(r).toEqual({ status: 201, idExterno: "3EB0BB" });
    expect(falso.recebidas[0]).toMatchObject({ metodo: "POST", caminho: `/message/sendMedia/${INSTANCIA}`, cabecalhos: { apikey: APIKEY } });
    expect(falso.recebidas[0]!.corpo).toEqual({
      number: "5511987654321",
      mediatype: "document",
      media: "https://bucket.exemplo.test/arquivo?token=abc",
      mimetype: "application/pdf",
      fileName: "contrato.pdf",
      caption: "segue",
    });
  });

  it("enviarAudio: POST /message/sendWhatsAppAudio/<instancia> com number e audio", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { id: "3EB0CC" } } });
    expect(await cliente().enviarAudio(APIKEY, INSTANCIA, { numero: "5511987654321", audio: "https://bucket.exemplo.test/a.ogg" })).toEqual({ status: 201, idExterno: "3EB0CC" });
    expect(falso.recebidas[0]).toMatchObject({ metodo: "POST", caminho: `/message/sendWhatsAppAudio/${INSTANCIA}` });
    expect(falso.recebidas[0]!.corpo).toEqual({ number: "5511987654321", audio: "https://bucket.exemplo.test/a.ogg" });
  });

  it("baixarMidia: manda o message inteiro com convertToMp4 false e devolve os bytes e o mimetype sem parâmetros", async () => {
    const bytes = Buffer.from("OggS-conteudo-de-teste");
    falso.enfileirar({ kind: "ok", status: 201, corpo: { mediaType: "audioMessage", fileName: "3EB0DD.ogg", mimetype: "audio/ogg; codecs=opus", base64: bytes.toString("base64") } });
    const message = { key: { id: "3EB0DD", remoteJid: "5511987654321@s.whatsapp.net", fromMe: false }, message: { audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true } } };
    const midia = await cliente().baixarMidia(APIKEY, INSTANCIA, { message, tetoBytes: 1_000_000 });
    expect(Buffer.from(midia.bytes).toString()).toBe("OggS-conteudo-de-teste");
    expect(midia).toMatchObject({ mimetype: "audio/ogg", fileName: "3EB0DD.ogg" });
    expect(falso.recebidas[0]).toMatchObject({ metodo: "POST", caminho: `/chat/getBase64FromMediaMessage/${INSTANCIA}`, cabecalhos: { apikey: APIKEY } });
    expect(falso.recebidas[0]!.corpo).toEqual({ message, convertToMp4: false });
  });

  it("baixarMidia: base64 inválido lança MIDIA_INDISPONIVEL", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { mimetype: "image/png", base64: "isto não é base64 !!!" } });
    await expect(cliente().baixarMidia(APIKEY, INSTANCIA, { message: {}, tetoBytes: 1_000 })).rejects.toMatchObject({ name: "ErroDeProvedor", codigo: "MIDIA_INDISPONIVEL" });
  });

  it("baixarMidia: a mídia decodificada acima do teto lança MIDIA_GRANDE_DEMAIS", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { mimetype: "image/png", base64: Buffer.alloc(200, 1).toString("base64") } });
    await expect(cliente().baixarMidia(APIKEY, INSTANCIA, { message: {}, tetoBytes: 100 })).rejects.toMatchObject({ name: "ErroDeProvedor", codigo: "MIDIA_GRANDE_DEMAIS" });
  });

  it("baixarMidia: o corpo é lido em fluxo e abortado acima de teto x 4/3 + 64 KiB, sem ler o resto", async () => {
    let lidos = 0;
    const fetchInfinito = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controlador) {
            lidos += 1;
            controlador.enqueue(new Uint8Array(65_536).fill(65));
          },
        }),
        { status: 201 },
      )) as unknown as typeof fetch;
    const c = criarClienteDaEvolution({ url: "http://evolution.exemplo.test", fetchImpl: fetchInfinito, timeoutMs: 2_000 });
    await expect(c.baixarMidia(APIKEY, INSTANCIA, { message: {}, tetoBytes: 100 })).rejects.toMatchObject({ name: "ErroDeProvedor", codigo: "MIDIA_GRANDE_DEMAIS" });
    // teto 100 => corte em 134 + 65.536 bytes: dois blocos de 64 KiB bastam, e o fluxo nunca é esvaziado.
    expect(lidos).toBeLessThanOrEqual(4);
  });
});

/** Um base64 válido (os bytes importam pouco: o cliente só confere o formato). */
const QR_BASE64 = Buffer.from("fake-png-bytes-do-qr-code-1234567890").toString("base64");
const QR_DATA_URL = `data:image/png;base64,${QR_BASE64}`;
const INSTANCIA_DO_CRM = "n1-ws_n1-can_abc123";
const TOKEN_DA_INSTANCIA = "tok-gerado-pelo-crm-0123456789abcdef";

describe("cliente da Evolution: conectar pelo CRM (Sessão 4, 4.2.2)", () => {
  const pedido = {
    nome: INSTANCIA_DO_CRM,
    token: TOKEN_DA_INSTANCIA,
    numero: "5511987654321",
    webhook: { url: "https://api.exemplo.test/webhooks/mensageria/can_abc123", segredo: SEGREDO_DO_WEBHOOK },
  };

  it("criarInstancia: POST /instance/create com a chave GLOBAL, o token escolhido, WHATSAPP-BAILEYS, qrcode, o número e o webhook", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { instance: { instanceName: INSTANCIA_DO_CRM, status: "connecting" }, hash: TOKEN_DA_INSTANCIA, qrcode: { count: 1, base64: QR_DATA_URL, code: "2@abc", pairingCode: "WZYEH1YY" } } });
    const criada = await cliente().criarInstancia(GLOBAL, pedido);
    expect(falso.recebidas[0]).toMatchObject({ metodo: "POST", caminho: "/instance/create", cabecalhos: { apikey: GLOBAL } });
    expect(falso.recebidas[0]!.corpo).toEqual({
      instanceName: INSTANCIA_DO_CRM,
      token: TOKEN_DA_INSTANCIA,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      number: "5511987654321",
      webhook: {
        enabled: true,
        url: "https://api.exemplo.test/webhooks/mensageria/can_abc123",
        headers: { "x-n1-webhook-segredo": SEGREDO_DO_WEBHOOK },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      },
    });
    expect(criada).toEqual({ qrcode: { imagem: QR_DATA_URL, codigoDePareamento: "WZYEH1YY" } });
  });

  it("criarInstancia: o base64 sem o prefixo vira data URL de PNG, e a resposta sem QR (a Evolution ainda não o gerou) é só {}", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { hash: TOKEN_DA_INSTANCIA, qrcode: { count: 1, base64: QR_BASE64 } } });
    expect(await cliente().criarInstancia(GLOBAL, pedido)).toEqual({ qrcode: { imagem: QR_DATA_URL } });
    falso.enfileirar({ kind: "ok", status: 201, corpo: { hash: TOKEN_DA_INSTANCIA, qrcode: { count: 0 } } });
    expect(await cliente().criarInstancia(GLOBAL, { ...pedido, numero: undefined })).toEqual({});
    expect(falso.recebidas[1]!.corpo).not.toHaveProperty("number");
  });

  it("criarInstancia: só cria instância do CRM (n1-...): a do Financeiro e qualquer outro nome são recusados SEM chamar a rede", async () => {
    for (const nome of ["numeropvmarcos", "NumeroPVMarcos", "comercial", "n1", "x-n1-ws"]) {
      await expect(cliente().criarInstancia(GLOBAL, { ...pedido, nome })).rejects.toThrow("Recusado");
    }
    expect(falso.recebidas).toHaveLength(0);
  });

  it("criarInstancia que a Evolution recusa lança http sem repetir o corpo (ele ecoa o token e o segredo do webhook)", async () => {
    falso.enfileirar({ kind: "ok", status: 403, corpo: { status: 403, error: "Forbidden", response: { message: [`This name "${INSTANCIA_DO_CRM}" is already in use. ${TOKEN_DA_INSTANCIA} ${SEGREDO_DO_WEBHOOK}`] } } });
    const erro = await cliente().criarInstancia(GLOBAL, pedido).then(() => undefined, (e: unknown) => e);
    expect(erro).toMatchObject({ tipo: "http", status: 403 });
    expect(JSON.stringify([(erro as Error).message, (erro as Error).stack])).not.toMatch(new RegExp(`${TOKEN_DA_INSTANCIA}|${SEGREDO_DO_WEBHOOK}`));
  });

  it("pedirQrCode: GET /instance/connect/<instancia> com o token da instância devolve o QR e o código de pareamento", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { pairingCode: "ABCD1234", code: "2@x", base64: QR_DATA_URL, count: 3 } });
    expect(await cliente().pedirQrCode(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM, "5511987654321")).toEqual({
      tipo: "qrcode",
      qrcode: { imagem: QR_DATA_URL, codigoDePareamento: "ABCD1234" },
    });
    expect(falso.recebidas[0]).toMatchObject({ metodo: "GET", caminho: `/instance/connect/${INSTANCIA_DO_CRM}?number=5511987654321`, cabecalhos: { apikey: TOKEN_DA_INSTANCIA } });
  });

  it("pedirQrCode: sem número a consulta não leva ?number; instância já aberta é conectada; sem QR ainda é aguardando", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA_DO_CRM, state: "open" } } });
    expect(await cliente().pedirQrCode(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).toEqual({ tipo: "conectada" });
    expect(falso.recebidas[0]!.caminho).toBe(`/instance/connect/${INSTANCIA_DO_CRM}`);
    falso.enfileirar({ kind: "ok", status: 200, corpo: { count: 0 } });
    expect(await cliente().pedirQrCode(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).toEqual({ tipo: "aguardando" });
  });

  it("pedirQrCode: o 200 com { error: true } (instância inexistente) é http 404, e um base64 que não é base64 NUNCA vira QR", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { error: true, message: "BadRequestException" } });
    await expect(cliente().pedirQrCode(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).rejects.toMatchObject({ tipo: "http", status: 404 });
    for (const base64 of ["<script>alert(1)</script>", "data:text/html;base64,PGgxPg==", "aaa", `${"A".repeat(300_004)}`, 12345]) {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { base64 } });
      expect(await cliente().pedirQrCode(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).toEqual({ tipo: "aguardando" });
    }
  });

  it("sairDaSessao: DELETE /instance/logout/<instancia>; já desconectada (400) ou inexistente (404) é sucesso; credencial recusada lança", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false, response: { message: "Instance logged out" } } });
    await cliente().sairDaSessao(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM);
    expect(falso.recebidas[0]).toMatchObject({ metodo: "DELETE", caminho: `/instance/logout/${INSTANCIA_DO_CRM}`, cabecalhos: { apikey: TOKEN_DA_INSTANCIA } });
    expect(falso.recebidas[0]!.cabecalhos["content-type"]).toBeUndefined();
    for (const status of [400, 404]) {
      falso.enfileirar({ kind: "ok", status, corpo: { status, error: "Bad Request", response: { message: ["The instance is not connected"] } } });
      await expect(cliente().sairDaSessao(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).resolves.toBeUndefined();
    }
    for (const status of [401, 500]) {
      falso.enfileirar({ kind: "ok", status, corpo: { error: "x" } });
      await expect(cliente().sairDaSessao(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).rejects.toMatchObject({ tipo: "http", status });
    }
  });

  it("apagarInstancia: DELETE /instance/delete/<instancia> com a chave GLOBAL; inexistente (404) é sucesso; 5xx lança", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false, response: { message: "Instance deleted" } } });
    await cliente().apagarInstancia(GLOBAL, INSTANCIA_DO_CRM);
    expect(falso.recebidas[0]).toMatchObject({ metodo: "DELETE", caminho: `/instance/delete/${INSTANCIA_DO_CRM}`, cabecalhos: { apikey: GLOBAL } });
    falso.enfileirar({ kind: "ok", status: 404, corpo: { error: "Not Found" } });
    await expect(cliente().apagarInstancia(GLOBAL, INSTANCIA_DO_CRM)).resolves.toBeUndefined();
    falso.enfileirar({ kind: "ok", status: 500, corpo: { error: "x" } });
    await expect(cliente().apagarInstancia(GLOBAL, INSTANCIA_DO_CRM)).rejects.toMatchObject({ tipo: "http", status: 500 });
  });

  it("apagarInstancia NUNCA apaga a instância do Financeiro nem uma que o CRM não criou: recusa sem chamar a rede", async () => {
    for (const nome of ["numeropvmarcos", "NUMEROPVMARCOS", " numeropvmarcos ", "comercial", "instancia-do-dono", ""]) {
      await expect(cliente().apagarInstancia(GLOBAL, nome)).rejects.toThrow("Recusado");
    }
    expect(falso.recebidas).toHaveLength(0);
  });

  it("falhas de transporte nas chamadas novas: rede, tempo esgotado e resposta perdida, sem vazar a chave", async () => {
    const semNinguem = criarClienteDaEvolution({ url: `http://127.0.0.1:${await portaSemNinguem()}`, timeoutMs: 1_000 });
    await expect(semNinguem.sairDaSessao(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).rejects.toMatchObject({ tipo: "rede" });
    await expect(semNinguem.pedirQrCode(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).rejects.toMatchObject({ tipo: "rede" });
    falso.enfileirar({ kind: "timeout" });
    await expect(cliente(200).pedirQrCode(TOKEN_DA_INSTANCIA, INSTANCIA_DO_CRM)).rejects.toMatchObject({ tipo: "tempo_esgotado" });
    falso.enfileirar({ kind: "respostaPerdida" });
    await expect(cliente().apagarInstancia(GLOBAL, INSTANCIA_DO_CRM)).rejects.toMatchObject({ tipo: "resposta_perdida" });
  });
});

describe("imagemDoQrCode: só imagem de base64 bem formado chega à tela", () => {
  it("aceita o base64 puro e a data URL de png, jpeg e webp, devolvendo sempre a data URL", () => {
    expect(imagemDoQrCode(QR_BASE64)).toBe(QR_DATA_URL);
    expect(imagemDoQrCode(QR_DATA_URL)).toBe(QR_DATA_URL);
    expect(imagemDoQrCode(`data:image/jpeg;base64,${QR_BASE64}`)).toBe(`data:image/jpeg;base64,${QR_BASE64}`);
    expect(imagemDoQrCode(`  ${QR_BASE64.slice(0, 8)}\n${QR_BASE64.slice(8)}  `)).toBe(QR_DATA_URL);
  });

  it("recusa o que não é imagem em base64: texto, SVG, HTML, vazio, tamanho de base64 quebrado, grande demais, e o que não é string", () => {
    for (const ruim of ["", "   ", "texto livre com espaço!", "data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,PGgxPg==", "javascript:alert(1)", "abc", QR_BASE64.slice(0, -1), "A".repeat(300_004), null, undefined, 7, {}]) {
      expect(imagemDoQrCode(ruim)).toBeUndefined();
    }
  });
});

describe("cliente da Evolution: falhas de transporte e HTTP sem vazar a apikey", () => {
  it("401 lança ErroDaEvolution http 401 sem a apikey na mensagem, mesmo se o servidor a ecoar", async () => {
    falso.enfileirar({ kind: "ok", status: 401, corpo: { status: 401, error: "Unauthorized", response: { message: `apikey ${APIKEY} inválida` } } });
    const erro = await cliente()
      .estadoDaConexao(APIKEY, INSTANCIA)
      .then(() => undefined, (e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaEvolution);
    expect(erro).toMatchObject({ tipo: "http", status: 401 });
    expect(JSON.stringify([(erro as Error).message, (erro as Error).stack])).not.toContain(APIKEY);
  });

  it("servidor que nunca responde: tempo_esgotado dentro do timeoutMs injetado (200 ms)", async () => {
    falso.enfileirar({ kind: "timeout" });
    const antes = Date.now();
    const erro = await cliente(200)
      .enviarTexto(APIKEY, INSTANCIA, { numero: "5511987654321", texto: "oi" })
      .then(() => undefined, (e: unknown) => e);
    expect(erro).toMatchObject({ name: "ErroDaEvolution", tipo: "tempo_esgotado" });
    expect(Date.now() - antes).toBeLessThan(1_500);
  });

  it("resposta perdida (o servidor recebe e derruba o socket): resposta_perdida", async () => {
    falso.enfileirar({ kind: "respostaPerdida" });
    const erro = await cliente()
      .enviarTexto(APIKEY, INSTANCIA, { numero: "5511987654321", texto: "oi" })
      .then(() => undefined, (e: unknown) => e);
    expect(erro).toMatchObject({ name: "ErroDaEvolution", tipo: "resposta_perdida" });
    expect(falso.recebidas).toHaveLength(1);
  });

  it("conexão recusada: rede (o pedido nem saiu)", async () => {
    const c = criarClienteDaEvolution({ url: `http://127.0.0.1:${await portaSemNinguem()}`, timeoutMs: 2_000 });
    const erro = await c.enviarTexto(APIKEY, INSTANCIA, { numero: "5511987654321", texto: "oi" }).then(() => undefined, (e: unknown) => e);
    expect(erro).toMatchObject({ name: "ErroDaEvolution", tipo: "rede" });
  });

  it("o nome da instância vai codificado no caminho", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { id: "x" } } });
    await cliente().enviarTexto(APIKEY, "inst com/barra", { numero: "5511987654321", texto: "oi" });
    expect(falso.recebidas[0]!.caminho).toBe("/message/sendText/inst%20com%2Fbarra");
  });
});

/** `null` é o Canal sem credencial no cofre. */
function canalReal(credencial: string | null = JSON.stringify({ instancia: INSTANCIA, apikey: APIKEY })): CanalParaProvedor {
  const agora = new Date().toISOString();
  const canal: Canal = {
    id: "canal_evolution",
    nome: "Evolution",
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: "+5511977770001",
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: agora,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_teste",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_teste",
    criadoEm: agora,
    atualizadoEm: agora,
  };
  return { workspaceId: "ws_evolution", canal, segredoDoWebhook: SEGREDO_DO_WEBHOOK, ...(credencial === null ? {} : { credencial }) };
}

const envioDeTexto: EnvioAoProvedor = { mensagemId: "msg_1", destino: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "olá" };

describe("provedor da Evolution: enviar nunca reenvia o que pode ter saído", () => {
  const provedor = (timeoutMs = 2_000) => criarProvedorEvolution({ url: falso.url, timeoutMs });

  it("201 grava o key.id como idExterno e manda o número só com dígitos", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { id: "3EB0AA" } } });
    expect(await provedor().enviar(canalReal(), envioDeTexto)).toEqual({ ok: true, idExterno: "3EB0AA" });
    expect(falso.recebidas[0]).toMatchObject({ caminho: `/message/sendText/${INSTANCIA}`, cabecalhos: { apikey: APIKEY } });
    expect(falso.recebidas[0]!.corpo).toEqual({ number: "5511987654321", text: "olá" });
  });

  it("201 sem o id da mensagem é ambíguo: saiu, mas não há como confirmar", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: {} });
    expect(await provedor().enviar(canalReal(), envioDeTexto)).toMatchObject({ ok: false, ambiguo: true });
  });

  it("400 com exists:false é permanente com a frase 'Este número não tem WhatsApp.'", async () => {
    falso.enfileirar({ kind: "ok", status: 400, corpo: { response: { message: [{ exists: false, number: "5511987654321" }] } } });
    expect(await provedor().enviar(canalReal(), envioDeTexto)).toEqual({ ok: false, transitorio: false, codigo: "NUMERO_SEM_WHATSAPP", motivo: "Este número não tem WhatsApp." });
  });

  it.each([401, 403, 404])("%i é permanente", async (status) => {
    falso.enfileirar({ kind: "ok", status, corpo: {} });
    const r = await provedor().enviar(canalReal(), envioDeTexto);
    expect(r).toMatchObject({ ok: false, transitorio: false, codigo: `HTTP_${status}` });
    expect(r).not.toHaveProperty("ambiguo");
  });

  it.each([429, 502, 503, 504])("%i é transitório (certamente não saiu)", async (status) => {
    falso.enfileirar({ kind: "ok", status, corpo: {} });
    expect(await provedor().enviar(canalReal(), envioDeTexto)).toMatchObject({ ok: false, transitorio: true, codigo: `HTTP_${status}` });
  });

  it("500 é ambíguo", async () => {
    falso.enfileirar({ kind: "ok", status: 500, corpo: { error: "Internal" } });
    expect(await provedor().enviar(canalReal(), envioDeTexto)).toMatchObject({ ok: false, ambiguo: true, codigo: "HTTP_500" });
  });

  it("tempo esgotado e resposta perdida são ambíguos", async () => {
    falso.enfileirar({ kind: "timeout" });
    expect(await provedor(200).enviar(canalReal(), envioDeTexto)).toMatchObject({ ok: false, ambiguo: true, codigo: "TEMPO_ESGOTADO" });
    falso.enfileirar({ kind: "respostaPerdida" });
    expect(await provedor().enviar(canalReal(), envioDeTexto)).toMatchObject({ ok: false, ambiguo: true, codigo: "RESPOSTA_PERDIDA" });
  });

  it("conexão recusada é transitória", async () => {
    const fechado = criarProvedorEvolution({ url: `http://127.0.0.1:${await portaSemNinguem()}`, timeoutMs: 2_000 });
    expect(await fechado.enviar(canalReal(), envioDeTexto)).toMatchObject({ ok: false, transitorio: true, codigo: "EVOLUTION_INDISPONIVEL" });
  });

  it("sem credencial no Canal: recusa permanente, sem tocar a rede", async () => {
    expect(await provedor().enviar(canalReal(null), envioDeTexto)).toMatchObject({ ok: false, transitorio: false, codigo: "CREDENCIAL_AUSENTE" });
    expect(falso.recebidas).toHaveLength(0);
  });

  it("a imagem sai por sendMedia com mediatype image, a URL assinada e o texto como caption", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { id: "3EB0IM" } } });
    const r = await provedor().enviar(canalReal(), {
      ...envioDeTexto,
      conteudo: "olha isso",
      anexos: [{ urlAssinada: "https://bucket.exemplo.test/f?token=zz", tipoDeMidia: "image/png", nome: "foto.png" }],
    });
    expect(r).toEqual({ ok: true, idExterno: "3EB0IM" });
    expect(falso.recebidas).toHaveLength(1);
    expect(falso.recebidas[0]).toMatchObject({ caminho: `/message/sendMedia/${INSTANCIA}` });
    expect(falso.recebidas[0]!.corpo).toEqual({
      number: "5511987654321",
      mediatype: "image",
      media: "https://bucket.exemplo.test/f?token=zz",
      mimetype: "image/png",
      fileName: "foto.png",
      caption: "olha isso",
    });
  });

  it("o PDF sai por sendMedia com mediatype document e o fileName", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { id: "3EB0PD" } } });
    const { conteudo: _sem, ...semTexto } = envioDeTexto;
    await provedor().enviar(canalReal(), { ...semTexto, anexos: [{ urlAssinada: "https://bucket.exemplo.test/c", tipoDeMidia: "application/pdf", nome: "contrato.pdf" }] });
    expect(falso.recebidas[0]!.corpo).toMatchObject({ mediatype: "document", fileName: "contrato.pdf", mimetype: "application/pdf" });
    expect(falso.recebidas[0]!.corpo).not.toHaveProperty("caption");
  });

  it("o áudio sai por sendWhatsAppAudio (mensagem de voz); o texto, se houver, vai em seguida por sendText", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { id: "3EB0AU" } } });
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { id: "3EB0TX" } } });
    const r = await provedor().enviar(canalReal(), { ...envioDeTexto, anexos: [{ urlAssinada: "https://bucket.exemplo.test/a", tipoDeMidia: "audio/ogg", nome: "voz.ogg" }] });
    expect(r).toEqual({ ok: true, idExterno: "3EB0AU" });
    expect(falso.recebidas.map((x) => x.caminho)).toEqual([`/message/sendWhatsAppAudio/${INSTANCIA}`, `/message/sendText/${INSTANCIA}`]);
    expect(falso.recebidas[0]!.corpo).toEqual({ number: "5511987654321", audio: "https://bucket.exemplo.test/a" });
  });

  it("mais de um anexo ou tipo fora da lista é recusa permanente, sem chamada", async () => {
    const anexo = { urlAssinada: "https://bucket.exemplo.test/a", tipoDeMidia: "image/png", nome: "a.png" };
    expect(await provedor().enviar(canalReal(), { ...envioDeTexto, anexos: [anexo, anexo] })).toMatchObject({ ok: false, transitorio: false });
    expect(await provedor().enviar(canalReal(), { ...envioDeTexto, anexos: [{ ...anexo, tipoDeMidia: "application/x-msdownload" }] })).toMatchObject({ ok: false, transitorio: false });
    expect(falso.recebidas).toHaveLength(0);
  });

  it("nenhum resultado carrega a apikey nem o segredo, nem quando o servidor os ecoa", async () => {
    falso.enfileirar({ kind: "ok", status: 400, corpo: { response: { message: [`apikey: ${APIKEY}`, SEGREDO_DO_WEBHOOK] } } });
    const r = await provedor().enviar(canalReal(), envioDeTexto);
    expect(JSON.stringify(r)).not.toContain(APIKEY);
    expect(JSON.stringify(r)).not.toContain(SEGREDO_DO_WEBHOOK);
  });
});

describe("provedor da Evolution: baixarMidia e estadoDaConexao", () => {
  const provedor = () => criarProvedorEvolution({ url: falso.url, timeoutMs: 2_000 });
  const referencia = JSON.stringify({ key: { id: "3EB0DD", remoteJid: "5511987654321@s.whatsapp.net", fromMe: false }, message: { audioMessage: { mimetype: "audio/ogg; codecs=opus" } } });

  it("a referência do webhook vira o pedido e o resultado traz o tipo normalizado e o nome", async () => {
    falso.enfileirar({ kind: "ok", status: 201, corpo: { mimetype: "audio/ogg; codecs=opus", fileName: "3EB0DD.ogg", base64: Buffer.from("OggS123").toString("base64") } });
    const midia = await provedor().baixarMidia(canalReal(), referencia, { tetoBytes: 1_000 });
    expect(midia).toMatchObject({ tipoDeMidia: "audio/ogg", nome: "3EB0DD.ogg" });
    expect(Buffer.from(midia.bytes).toString()).toBe("OggS123");
    expect(falso.recebidas[0]!.corpo).toEqual({ message: JSON.parse(referencia), convertToMp4: false });
  });

  it("o que o provedor já não tem é permanente (MIDIA_INDISPONIVEL); a Evolution fora do ar é transitório (PROVEDOR_INDISPONIVEL)", async () => {
    falso.enfileirar({ kind: "ok", status: 404, corpo: {} });
    await expect(provedor().baixarMidia(canalReal(), referencia, { tetoBytes: 1_000 })).rejects.toMatchObject({ codigo: "MIDIA_INDISPONIVEL" });
    falso.enfileirar({ kind: "ok", status: 503, corpo: {} });
    await expect(provedor().baixarMidia(canalReal(), referencia, { tetoBytes: 1_000 })).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
    falso.enfileirar({ kind: "respostaPerdida" });
    await expect(provedor().baixarMidia(canalReal(), referencia, { tetoBytes: 1_000 })).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
  });

  it("referência que não é o JSON do webhook ou Canal sem credencial: MIDIA_INDISPONIVEL e nenhuma chamada", async () => {
    await expect(provedor().baixarMidia(canalReal(), "referencia-qualquer", { tetoBytes: 1_000 })).rejects.toBeInstanceOf(ErroDeProvedor);
    await expect(provedor().baixarMidia(canalReal(null), referencia, { tetoBytes: 1_000 })).rejects.toMatchObject({ codigo: "CREDENCIAL_AUSENTE" });
    expect(falso.recebidas).toHaveLength(0);
  });

  it("estadoDaConexao: open é conectada; close e connecting, desconectada; 401, com_erro", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA, state: "open" } } });
    expect(await provedor().estadoDaConexao(canalReal())).toBe("conectada");
    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA, state: "close" } } });
    expect(await provedor().estadoDaConexao(canalReal())).toBe("desconectada");
    falso.enfileirar({ kind: "ok", status: 401, corpo: {} });
    expect(await provedor().estadoDaConexao(canalReal())).toBe("com_erro");
  });
});
