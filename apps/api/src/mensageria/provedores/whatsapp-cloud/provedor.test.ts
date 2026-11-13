/**
 * O provedor do WhatsApp oficial contra o conjunto de contrato do 16-02, com o servidor HTTP FALSO no lugar da Meta
 * (Graph e CDN da mídia), e os casos que só ele tem: a assinatura da Meta com o número de outro Canal, o desfecho de cada
 * resposta da Meta no envio e o token no download da mídia. Sem banco. NÃO é prova contra a Meta real (7.1 é do dono).
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { assinaturaDoCorpo } from "../../../testes/assinatura-da-meta";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import { descreverContratoDoProvedor } from "../../contrato-do-provedor";
import type { CanalParaProvedor, ChamadaDoWebhook, ProvedorDeMensageria } from "../../provedor";
import type { ClienteDaCloudApi } from "./cliente";
import type { ConfiguracaoDaCloudApi } from "./configuracao";
import { CABECALHO_DA_ASSINATURA_DA_META, criarProvedorWhatsAppCloud, FRASE_FORA_DA_JANELA, FRASE_TOKEN_INVALIDO } from "./provedor";

const FONE = "109876543210001";
const OUTRO_FONE = "109876543210999";
const WABA = "100200300400500";
const AGORA = Date.parse("2026-11-13T12:00:00.000Z");
const T = String(Math.floor(AGORA / 1000));

const configuracao = (url: string, appSecret: string): ConfiguracaoDaCloudApi => ({ appSecret, versao: "v24.0", graph: url });

function canalDoWhatsApp(credencial?: Record<string, unknown>): CanalParaProvedor {
  const agora = new Date(AGORA).toISOString();
  const canal: Canal = {
    id: "canal_contrato_cloud",
    nome: "WhatsApp oficial",
    tipo: "whatsapp",
    provedor: "whatsapp-cloud",
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
  const padrao = { phoneNumberId: FONE, wabaId: WABA, token: `EAAG-${randomBytes(12).toString("hex")}` };
  return { workspaceId: "ws_contrato_cloud", canal, credencial: JSON.stringify({ ...padrao, ...credencial }) };
}

const recebida = (fone = FONE, id = "wamid.contrato.1") => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: WABA,
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "5511977770001", phone_number_id: fone },
            contacts: [{ profile: { name: "Ana" }, wa_id: "5511987654321" }],
            messages: [{ from: "5511987654321", id, timestamp: T, type: "text", text: { body: "oi" } }],
          },
        },
      ],
    },
  ],
});

function chamada(corpo: unknown, segredo: string): ChamadaDoWebhook {
  const cru = JSON.stringify(corpo);
  return { cabecalhos: { [CABECALHO_DA_ASSINATURA_DA_META]: assinaturaDoCorpo(cru, segredo) }, corpoCru: Buffer.from(cru), corpo };
}

/** O servidor falso faz o papel do Graph e da CDN: a mídia é servida de `127.0.0.1`, que só o teste permite. */
const permitirOFalso = (url: URL) => url.hostname === "127.0.0.1";

descreverContratoDoProvedor("whatsapp-cloud", async () => {
  const falso = await criarServidorFalso();
  const segredo = randomBytes(16).toString("hex");
  const canal = canalDoWhatsApp();
  const provedor = criarProvedorWhatsAppCloud({ configuracao: configuracao(falso.url, segredo), midia: { permitido: permitirOFalso, timeoutMs: 2_000 } });
  return {
    provedor,
    canal,
    chamadaDeTexto: () => chamada(recebida(), segredo),
    chamadasRecusadas: () => [
      { nome: "assinatura com outra chave", chamada: chamada(recebida(), "outra-chave-qualquer"), canal },
      { nome: "corpo mexido depois de assinado", chamada: { ...chamada(recebida(), segredo), corpoCru: Buffer.from(JSON.stringify(recebida(FONE, "wamid.outro"))) }, canal },
      { nome: "assinatura certa, número de outro Canal", chamada: chamada(recebida(OUTRO_FONE), segredo), canal },
      { nome: "Canal sem credencial", chamada: chamada(recebida(), segredo), canal: { ...canal, credencial: undefined } as unknown as CanalParaProvedor },
    ],
    segredos: [segredo, JSON.parse(canal.credencial!).token as string],
    prepararEnvioAceito: async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { messaging_product: "whatsapp", contacts: [], messages: [{ id: `wamid.saida.${randomBytes(3).toString("hex")}` }] } });
    },
    prepararMidiaGrande: async (tetoBytes) => {
      // Primeiro o Graph devolve o endereço da mídia; depois o servidor serve o arquivo (grande demais).
      falso.enfileirar({ kind: "ok", status: 200, corpo: { url: `${falso.url}/midia/grande.jpg`, mime_type: "image/jpeg", id: "MGRANDE" } });
      falso.enfileirar({ kind: "ok", status: 200, corpo: "x".repeat(tetoBytes + 8), cabecalhos: { "content-type": "image/jpeg" } });
      return "MGRANDE";
    },
    encerrar: async () => falso.fechar(),
  };
});

describe("provedor do WhatsApp oficial: o que só ele tem", () => {
  let falso: ServidorFalso;
  const segredo = "segredo-do-app-de-teste";
  let provedor: ProvedorDeMensageria;
  let canal: CanalParaProvedor;

  beforeAll(async () => {
    falso = await criarServidorFalso();
  });
  afterAll(async () => {
    await falso.fechar();
  });
  beforeEach(() => {
    while (falso.recebidas.length > 0) (falso.recebidas as unknown[]).pop();
    canal = canalDoWhatsApp();
    provedor = criarProvedorWhatsAppCloud({ configuracao: configuracao(falso.url, segredo), midia: { permitido: permitirOFalso, timeoutMs: 1_000 } });
  });

  const ultima = () => falso.recebidas.at(-1)!;
  const token = () => JSON.parse(canal.credencial!).token as string;
  const aceita = (id = "wamid.S1") => falso.enfileirar({ kind: "ok", status: 200, corpo: { messaging_product: "whatsapp", messages: [{ id }] } });
  const erroDaMeta = (status: number, code: number, message = "falha") =>
    falso.enfileirar({ kind: "ok", status, corpo: { error: { message, type: "OAuthException", code } } });
  const enviar = (extra: Partial<Parameters<ProvedorDeMensageria["enviar"]>[1]> = {}) =>
    provedor.enviar(canal, { mensagemId: "msg_1", destino: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "Claro!", ...extra });

  describe("o webhook", () => {
    it("a assinatura certa só passa com o número DESTE Canal no corpo", () => {
      expect(provedor.verificarChamada(chamada(recebida(), segredo), canal)).toBe(true);
      expect(provedor.verificarChamada(chamada(recebida(OUTRO_FONE), segredo), canal)).toBe(false);
    });

    it("um corpo com os dois números passa (a Meta pode juntar números do mesmo app), mas só o do Canal vira evento", () => {
      const dois = recebida();
      dois.entry[0]!.changes.push(recebida(OUTRO_FONE, "wamid.de.outro").entry[0]!.changes[0]!);
      expect(provedor.verificarChamada(chamada(dois, segredo), canal)).toBe(true);
      const eventos = provedor.interpretarChamada(dois, canal);
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({ tipo: "mensagem", idExterno: "wamid.contrato.1" });
    });

    it("sem credencial, interpretar devolve ignorado sem_credencial", () => {
      expect(provedor.interpretarChamada(recebida(), { ...canal, credencial: undefined })).toEqual([{ tipo: "ignorado", motivo: "sem_credencial" }]);
    });
  });

  describe("o envio", () => {
    it("texto: o número vai só com dígitos e o token no cabeçalho", async () => {
      aceita("wamid.OK1");
      expect(await enviar()).toEqual({ ok: true, idExterno: "wamid.OK1" });
      expect(ultima().caminho).toBe(`/v24.0/${FONE}/messages`);
      expect(ultima().corpo).toMatchObject({ to: "5511987654321", type: "text", text: { body: "Claro!" } });
      expect(ultima().cabecalhos.authorization).toBe(`Bearer ${token()}`);
    });

    it("citação: a Mensagem citada vai em context.message_id", async () => {
      aceita();
      await enviar({ emRespostaAIdExterno: "wamid.ORIGINAL" });
      expect(ultima().corpo).toMatchObject({ context: { message_id: "wamid.ORIGINAL" } });
    });

    it("imagem com texto: o texto é a legenda, numa mensagem só", async () => {
      aceita("wamid.IMG");
      const r = await enviar({ anexos: [{ urlAssinada: "https://arquivos.exemplo.test/a.jpg", tipoDeMidia: "image/jpeg", nome: "a.jpg" }] });
      expect(r).toEqual({ ok: true, idExterno: "wamid.IMG" });
      expect(falso.recebidas).toHaveLength(1);
      expect(ultima().corpo).toMatchObject({ type: "image", image: { link: "https://arquivos.exemplo.test/a.jpg", caption: "Claro!" } });
    });

    it("áudio com texto: duas mensagens (o áudio não leva legenda), e o id devolvido é o do áudio", async () => {
      aceita("wamid.AUDIO");
      aceita("wamid.TEXTO");
      const r = await enviar({ anexos: [{ urlAssinada: "https://arquivos.exemplo.test/a.ogg", tipoDeMidia: "audio/ogg", nome: "a.ogg" }] });
      expect(r).toEqual({ ok: true, idExterno: "wamid.AUDIO" });
      expect(falso.recebidas.map((p) => (p.corpo as { type: string }).type)).toEqual(["audio", "text"]);
    });

    it("áudio cujo texto não se confirma: ambíguo, para nunca reenviar o áudio", async () => {
      aceita("wamid.AUDIO");
      erroDaMeta(400, 100);
      const r = await enviar({ anexos: [{ urlAssinada: "https://arquivos.exemplo.test/a.ogg", tipoDeMidia: "audio/ogg", nome: "a.ogg" }] });
      expect(r).toMatchObject({ ok: false, transitorio: false, ambiguo: true, codigo: "TEXTO_NAO_CONFIRMADO" });
    });

    it("modelo: sai pelo nome e idioma, com as variáveis, e ignora o texto livre", async () => {
      aceita("wamid.MODELO");
      const r = await enviar({ conteudo: "texto que não vale", modelo: { idNoProvedor: "190001", nome: "boas_vindas", idioma: "pt_BR", variaveis: ["Ana"] } });
      expect(r).toEqual({ ok: true, idExterno: "wamid.MODELO" });
      expect(ultima().corpo).toMatchObject({ type: "template", template: { name: "boas_vindas", language: { code: "pt_BR" } } });
      expect(JSON.stringify(ultima().corpo)).not.toContain("texto que não vale");
    });

    it("modelo sem o nome do modelo na Meta: recusa antes de chamar a Meta", async () => {
      const r = await enviar({ modelo: { idNoProvedor: "190001", idioma: "pt_BR", variaveis: [] } });
      expect(r).toMatchObject({ ok: false, transitorio: false, codigo: "MODELO_INVALIDO" });
      expect(falso.recebidas).toHaveLength(0);
    });

    it.each([
      ["destino que não é WhatsApp", { destino: { tipo: "instagram" as const, valor: "ana" } }, "DESTINO_INVALIDO"],
      ["número inválido", { destino: { tipo: "whatsapp" as const, valor: "123" } }, "DESTINO_INVALIDO"],
      ["mensagem vazia", { conteudo: "  " }, "MENSAGEM_VAZIA"],
      ["dois anexos", { anexos: [{ urlAssinada: "u", tipoDeMidia: "image/jpeg", nome: "a" }, { urlAssinada: "u", tipoDeMidia: "image/jpeg", nome: "b" }] }, "ANEXO_INVALIDO"],
      ["tipo de arquivo que não se envia", { anexos: [{ urlAssinada: "u", tipoDeMidia: "application/x-msdownload", nome: "a.exe" }] }, "TIPO_NAO_ENVIADO"],
    ])("%s: recusa definitiva, sem chamar a Meta", async (_nome, extra, codigo) => {
      const r = await enviar(extra as Partial<Parameters<ProvedorDeMensageria["enviar"]>[1]>);
      expect(r).toMatchObject({ ok: false, transitorio: false, codigo });
      expect(falso.recebidas).toHaveLength(0);
    });

    it("sem credencial no Canal: recusa com a frase de conectar de novo", async () => {
      const r = await provedor.enviar({ ...canal, credencial: undefined }, { mensagemId: "m", destino: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "x" });
      expect(r).toMatchObject({ ok: false, transitorio: false, codigo: "CREDENCIAL_AUSENTE", motivo: FRASE_TOKEN_INVALIDO });
    });
  });

  describe("o desfecho de cada resposta da Meta", () => {
    it("token vencido (190): recusa definitiva, com a frase de conectar de novo e sem o token", async () => {
      erroDaMeta(401, 190, "Error validating access token");
      const r = await enviar();
      expect(r).toMatchObject({ ok: false, transitorio: false, codigo: "TOKEN_INVALIDO", motivo: FRASE_TOKEN_INVALIDO });
      expect(JSON.stringify(r)).not.toContain(token());
    });

    it("fora da janela (131047): recusa definitiva com a frase de só modelo aprovado", async () => {
      erroDaMeta(400, 131047);
      expect(await enviar()).toMatchObject({ ok: false, transitorio: false, codigo: "FORA_DA_JANELA", motivo: FRASE_FORA_DA_JANELA });
    });

    it.each([[429, 130429], [400, 131056], [400, 80007], [400, 4]])("limite da Meta (HTTP %i, código %i): transitório, volta à fila", async (status, code) => {
      erroDaMeta(status, code);
      expect(await enviar()).toMatchObject({ ok: false, transitorio: true });
    });

    it.each([502, 503, 504])("HTTP %i: transitório (certamente não processou)", async (status) => {
      falso.enfileirar({ kind: "ok", status, corpo: {} });
      expect(await enviar()).toMatchObject({ ok: false, transitorio: true });
    });

    it("HTTP 500: ambíguo (a Meta pode ter enviado antes de falhar), nunca reenviado sozinho", async () => {
      falso.enfileirar({ kind: "ok", status: 500, corpo: {} });
      expect(await enviar()).toMatchObject({ ok: false, transitorio: false, ambiguo: true });
    });

    it("aceito sem o id: ambíguo", async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { messaging_product: "whatsapp", messages: [] } });
      expect(await enviar()).toMatchObject({ ok: false, transitorio: false, ambiguo: true, codigo: "RESPOSTA_SEM_ID" });
    });

    it("tempo esgotado e resposta perdida: ambíguos", async () => {
      falso.enfileirar({ kind: "respostaPerdida" });
      expect(await enviar()).toMatchObject({ ok: false, ambiguo: true, codigo: "RESPOSTA_PERDIDA" });
    });

    it.each([
      [131030, "DESTINO_NAO_PERMITIDO"],
      [131026, "NAO_ENTREGAVEL"],
      [132001, "MODELO_RECUSADO"],
      [132000, "MODELO_RECUSADO"],
    ])("código %i: recusa definitiva %s", async (code, esperado) => {
      erroDaMeta(400, code);
      expect(await enviar()).toMatchObject({ ok: false, transitorio: false, codigo: esperado });
    });
  });

  describe("a mídia recebida", () => {
    it("troca o id pelo endereço e baixa levando o token só no primeiro pedido, nunca no redirecionamento para a CDN", async () => {
      const pedidos: { url: string; authorization: string | undefined }[] = [];
      const fetchImpl = (async (entrada: URL | string, init?: RequestInit) => {
        const url = String(entrada);
        pedidos.push({ url, authorization: (init?.headers as Record<string, string> | undefined)?.authorization });
        if (url.includes("lookaside")) return new Response(null, { status: 302, headers: { location: "https://scontent.xx.fbcdn.net/arquivo.jpg" } });
        return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
      }) as typeof fetch;
      const cliente = { lerMidia: async () => ({ url: "https://lookaside.fbsbx.com/whatsapp/x?mid=1", tipoDeMidia: "image/jpeg" }) } as unknown as ClienteDaCloudApi;
      const p = criarProvedorWhatsAppCloud({ configuracao: configuracao(falso.url, segredo), cliente, midia: { fetchImpl } });

      const midia = await p.baixarMidia(canal, "MID1", { tetoBytes: 1_000 });
      expect(midia.tipoDeMidia).toBe("image/jpeg");
      expect(midia.bytes.byteLength).toBe(7);
      expect(pedidos).toHaveLength(2);
      expect(pedidos[0]).toEqual({ url: "https://lookaside.fbsbx.com/whatsapp/x?mid=1", authorization: `Bearer ${token()}` });
      expect(pedidos[1]!.authorization).toBeUndefined();
    });

    it("um endereço que não é da Meta nunca é seguido (sem SSRF), e o token não sai para lá", async () => {
      let chamou = false;
      const fetchImpl = (async () => {
        chamou = true;
        return new Response("x");
      }) as unknown as typeof fetch;
      const cliente = { lerMidia: async () => ({ url: "https://interno.exemplo.test/segredo", tipoDeMidia: "image/jpeg" }) } as unknown as ClienteDaCloudApi;
      const p = criarProvedorWhatsAppCloud({ configuracao: configuracao(falso.url, segredo), cliente, midia: { fetchImpl } });
      await expect(p.baixarMidia(canal, "MID2", { tetoBytes: 1_000 })).rejects.toMatchObject({ codigo: "MIDIA_INDISPONIVEL" });
      expect(chamou).toBe(false);
    });

    it("a Meta não tem mais a mídia (404): MIDIA_INDISPONIVEL; a Meta fora do ar (503): PROVEDOR_INDISPONIVEL", async () => {
      erroDaMeta(404, 100);
      await expect(provedor.baixarMidia(canal, "MID3", { tetoBytes: 1_000 })).rejects.toMatchObject({ codigo: "MIDIA_INDISPONIVEL" });
      falso.enfileirar({ kind: "ok", status: 503, corpo: {} });
      await expect(provedor.baixarMidia(canal, "MID4", { tetoBytes: 1_000 })).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
    });

    it("sem credencial: CREDENCIAL_AUSENTE", async () => {
      await expect(provedor.baixarMidia({ ...canal, credencial: undefined }, "MID5", { tetoBytes: 1_000 })).rejects.toMatchObject({ codigo: "CREDENCIAL_AUSENTE" });
    });
  });

  describe("a conexão", () => {
    it("o número responde: conectada", async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { id: FONE, display_phone_number: "+55 11 97777-0001" } });
      expect(await provedor.estadoDaConexao(canal)).toBe("conectada");
    });

    it("token recusado (190) ou sem credencial: com_erro", async () => {
      erroDaMeta(401, 190);
      expect(await provedor.estadoDaConexao(canal)).toBe("com_erro");
      expect(await provedor.estadoDaConexao({ ...canal, credencial: undefined })).toBe("com_erro");
    });

    it("a Meta fora do ar: lança PROVEDOR_INDISPONIVEL (a conferência tenta de novo, não grava erro)", async () => {
      falso.enfileirar({ kind: "timeout" });
      const curto = criarProvedorWhatsAppCloud({
        configuracao: configuracao(falso.url, segredo),
        cliente: (await import("./cliente")).criarClienteDaCloudApi(configuracao(falso.url, segredo), { tempoLimiteMs: 300 }),
      });
      await expect(curto.estadoDaConexao(canal)).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
    });
  });
});
