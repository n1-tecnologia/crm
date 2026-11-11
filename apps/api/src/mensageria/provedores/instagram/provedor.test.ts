/**
 * O provedor do Instagram contra o conjunto de contrato do 16-02, com o servidor HTTP FALSO no lugar da Meta (Graph e
 * CDN da mídia), e os casos que só ele tem: a assinatura da Meta com a conta de outro Canal, a troca do IGSID pelo @, a
 * tradução do webhook e o desfecho de cada resposta da Meta no envio. Sem banco: a tabela de quem escreveu é a da memória.
 */

import { randomBytes } from "node:crypto";
import { createServer, type AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { fraseDaJanelaBloqueada } from "@n1/dominio/crm/mensagens";
import type { RecebidaDoProvedor } from "@n1/dominio/crm/recebimento";
import { assinaturaDoCorpo } from "../../../testes/assinatura-da-meta";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import { descreverContratoDoProvedor } from "../../contrato-do-provedor";
import type { CanalParaProvedor, ChamadaDoWebhook, EventoDoProvedor, ProvedorDeMensageria } from "../../provedor";
import type { ConfiguracaoDoInstagram } from "./configuracao";
import { hostDaMetaPermitido } from "./midia";
import { CABECALHO_DA_ASSINATURA_DA_META, criarProvedorInstagram, FRASE_SEM_IGSID } from "./provedor";
import type { Remetente, RemetentesDoInstagram } from "./repositorio";
import { FRASE_TOKEN_VENCIDO, tokensSoDaCredencial } from "./token";
import { PREFIXO_DO_IGSID, TEXTO_DE_MENSAGEM_NAO_SUPORTADA } from "./traduzir";

const CONTA = "17841400000000001";
const OUTRA_CONTA = "17841400000000999";
const IGSID = "9123456789012345";
const AGORA = Date.parse("2026-11-10T12:00:00.000Z");

function configuracao(url: string, segredo: string): ConfiguracaoDoInstagram {
  return {
    appId: "1234567890",
    appSecret: segredo,
    segredosDoWebhook: [segredo],
    redirectUri: "https://crm.exemplo.test/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno",
    versao: "v24.0",
    enderecos: { autorizar: `${url}/oauth/authorize`, api: url, graph: url },
  };
}

function canalDoInstagram(credencial?: Record<string, unknown>): CanalParaProvedor {
  const agora = new Date(AGORA).toISOString();
  const canal: Canal = {
    id: "canal_contrato_instagram",
    nome: "Instagram",
    tipo: "instagram",
    provedor: "instagram-graph",
    identificadorExterno: "loja.n1",
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
  const padrao = {
    contaId: CONTA,
    token: `IGAA-${randomBytes(12).toString("hex")}`,
    expiraEm: new Date(AGORA + 50 * 86_400_000).toISOString(),
    obtidoEm: new Date(AGORA - 86_400_000).toISOString(),
  };
  return { workspaceId: "ws_contrato_instagram", canal, credencial: JSON.stringify({ ...padrao, ...credencial }) };
}

/** A tabela de quem escreveu, em memória. */
function remetentesEmMemoria(iniciais: readonly Remetente[] = []): RemetentesDoInstagram & { readonly linhas: Map<string, Remetente> } {
  const linhas = new Map(iniciais.map((r) => [r.igsid, r]));
  return {
    linhas,
    async doIgsid(_ws, _canal, igsid) {
      return linhas.get(igsid);
    },
    async igsidDoUsuario(_ws, _canal, usuario) {
      return [...linhas.values()].find((r) => r.usuario === usuario)?.igsid;
    },
    async gravar(_ws, _canal, r) {
      linhas.set(r.igsid, { ...r, atualizadoEm: new Date(AGORA).toISOString() });
    },
  };
}

const direct = (conta: string, item: Record<string, unknown>) => ({ object: "instagram", entry: [{ id: conta, time: AGORA, messaging: [item] }] });
const texto = (conta = CONTA, mid = "mid.contrato.1") =>
  direct(conta, { sender: { id: IGSID }, recipient: { id: conta }, timestamp: AGORA, message: { mid, text: "oi" } });

function chamada(corpo: unknown, segredo: string): ChamadaDoWebhook {
  const cru = JSON.stringify(corpo);
  return { cabecalhos: { [CABECALHO_DA_ASSINATURA_DA_META]: assinaturaDoCorpo(cru, segredo) }, corpoCru: Buffer.from(cru), corpo };
}

/** O servidor falso faz o papel do Graph e da CDN: a mídia é servida de `127.0.0.1`, que só o teste permite. */
const permitirOFalso = (url: URL) => url.hostname === "127.0.0.1";

descreverContratoDoProvedor("instagram", async () => {
  const falso = await criarServidorFalso();
  const segredo = randomBytes(16).toString("hex");
  const canal = canalDoInstagram();
  const provedor = criarProvedorInstagram({
    configuracao: configuracao(falso.url, segredo),
    remetentes: remetentesEmMemoria([{ igsid: IGSID, usuario: "ana.souza", nome: "Ana", atualizadoEm: new Date(AGORA).toISOString() }]),
    tokens: tokensSoDaCredencial(() => AGORA),
    midia: { permitido: permitirOFalso, timeoutMs: 2_000 },
    agora: () => AGORA,
  });
  return {
    provedor,
    canal,
    chamadaDeTexto: () => chamada(texto(), segredo),
    chamadasRecusadas: () => [
      { nome: "assinatura com outra chave", chamada: chamada(texto(), "outra-chave-qualquer"), canal },
      { nome: "corpo mexido depois de assinado", chamada: { ...chamada(texto(), segredo), corpoCru: Buffer.from(JSON.stringify(texto(CONTA, "mid.outro"))) }, canal },
      { nome: "assinatura certa, conta de outro Canal", chamada: chamada(texto(OUTRA_CONTA), segredo), canal },
      { nome: "Canal sem credencial", chamada: chamada(texto(), segredo), canal: { ...canal, credencial: undefined } as unknown as CanalParaProvedor },
    ],
    remetenteValido: new RegExp(`^${PREFIXO_DO_IGSID}\\d+$`),
    destinoDoEnvio: { tipo: "instagram", valor: "ana.souza" },
    segredos: [segredo, JSON.parse(canal.credencial!).token as string],
    prepararEnvioAceito: async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { recipient_id: IGSID, message_id: `mid.saida.${randomBytes(3).toString("hex")}` } });
    },
    prepararMidiaGrande: async (tetoBytes) => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: "x".repeat(tetoBytes + 8), cabecalhos: { "content-type": "image/jpeg" } });
      return `${falso.url}/midia/grande.jpg`;
    },
    encerrar: async () => falso.fechar(),
  };
});

describe("provedor do Instagram: o que só ele tem", () => {
  let falso: ServidorFalso;
  const segredo = "segredo-do-app-de-teste";
  let remetentes: ReturnType<typeof remetentesEmMemoria>;
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
    remetentes = remetentesEmMemoria([{ igsid: IGSID, usuario: "ana.souza", nome: "Ana", atualizadoEm: new Date(AGORA).toISOString() }]);
    canal = canalDoInstagram();
    provedor = criarProvedorInstagram({
      configuracao: configuracao(falso.url, segredo),
      remetentes,
      tokens: tokensSoDaCredencial(() => AGORA),
      midia: { permitido: permitirOFalso, timeoutMs: 1_000 },
      agora: () => AGORA,
    });
  });

  const interpretar = (corpo: unknown): readonly EventoDoProvedor[] => provedor.interpretarChamada(corpo, canal);
  const enviar = (destino = "ana.souza", conteudo = "Claro!") =>
    provedor.enviar(canal, { mensagemId: "msg_1", destino: { tipo: "instagram", valor: destino }, conteudo });

  describe("o webhook", () => {
    it("a chave do app da Meta (META_APP_SECRET) também assina, quando configurada", () => {
      const comAsDuas = criarProvedorInstagram({
        configuracao: { ...configuracao(falso.url, segredo), segredosDoWebhook: [segredo, "chave-do-app-da-meta"] },
        remetentes,
        tokens: tokensSoDaCredencial(() => AGORA),
      });
      expect(comAsDuas.verificarChamada(chamada(texto(), "chave-do-app-da-meta"), canal)).toBe(true);
      expect(provedor.verificarChamada(chamada(texto(), "chave-do-app-da-meta"), canal)).toBe(false);
    });

    it("o eco do que a conta mandou, a mensagem apagada, a reação e a conta de outro Canal não viram Mensagem", () => {
      const eco = direct(CONTA, { sender: { id: CONTA }, recipient: { id: IGSID }, timestamp: AGORA, message: { mid: "mid.eco", text: "oi", is_echo: true } });
      expect(interpretar(eco)).toEqual([{ tipo: "ignorado", motivo: "eco", idExterno: "mid.eco" }]);
      const apagada = direct(CONTA, { sender: { id: IGSID }, recipient: { id: CONTA }, timestamp: AGORA, message: { mid: "mid.x", is_deleted: true } });
      expect(interpretar(apagada)).toEqual([{ tipo: "ignorado", motivo: "apagada", idExterno: "mid.x" }]);
      const reacao = direct(CONTA, { sender: { id: IGSID }, recipient: { id: CONTA }, timestamp: AGORA, reaction: { mid: "mid.1", action: "react", reaction: "love" } });
      expect(interpretar(reacao)).toEqual([{ tipo: "ignorado", motivo: "reacao" }]);
      expect(interpretar(texto(OUTRA_CONTA))).toEqual([{ tipo: "ignorado", motivo: "outra_conta" }]);
      expect(interpretar({ object: "page", entry: [] })).toEqual([{ tipo: "ignorado", motivo: "corpo_invalido" }]);
    });

    it("a leitura vira o status lida da Mensagem com aquele mid", () => {
      const lida = direct(CONTA, { sender: { id: IGSID }, recipient: { id: CONTA }, timestamp: AGORA, read: { mid: "mid.saida.1" } });
      expect(interpretar(lida)).toEqual([{ tipo: "status", idExterno: "mid.saida.1", status: "lida", em: new Date(AGORA).toISOString() }]);
      expect(provedor.chaveDaChamada?.(lida)).toBe("lida:mid.saida.1");
      expect(provedor.chaveDaChamada?.(texto())).toBe("mid.contrato.1");
    });

    it("imagem, vídeo, áudio e arquivo viram anexo com a URL da Meta; a publicação compartilhada vira a frase de não suportada", () => {
      const comAnexos = direct(CONTA, {
        sender: { id: IGSID },
        recipient: { id: CONTA },
        timestamp: AGORA,
        message: {
          mid: "mid.anexos",
          reply_to: { mid: "mid.anterior" },
          attachments: [
            { type: "image", payload: { url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1" } },
            { type: "share", payload: { url: "https://www.instagram.com/p/abc" } },
          ],
        },
      });
      const [evento] = interpretar(comAnexos);
      expect(evento).toMatchObject({
        tipo: "mensagem",
        idExterno: "mid.anexos",
        emRespostaAIdExterno: "mid.anterior",
        anexos: [{ referenciaNoProvedor: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1", tipoDeMidia: "image/jpeg", nome: "Imagem do Instagram" }],
      });
      expect(evento).not.toHaveProperty("conteudo");

      const soCompartilhou = direct(CONTA, {
        sender: { id: IGSID },
        recipient: { id: CONTA },
        timestamp: AGORA,
        message: { mid: "mid.share", attachments: [{ type: "share", payload: { url: "https://www.instagram.com/p/abc" } }] },
      });
      expect(interpretar(soCompartilhou)[0]).toMatchObject({ tipo: "mensagem", conteudo: TEXTO_DE_MENSAGEM_NAO_SUPORTADA });
    });
  });

  describe("quem escreveu: o IGSID vira o @ do perfil", () => {
    const recebida = (igsid: string): RecebidaDoProvedor => ({
      idExterno: "mid.r",
      criadoEm: new Date(AGORA).toISOString(),
      remetente: { tipo: "instagram", valor: `${PREFIXO_DO_IGSID}${igsid}` },
      conteudo: "oi",
      cargaBruta: {},
    });

    it("quem ainda não é conhecido: lê o perfil, guarda o @ na forma canônica e devolve o nome", async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { name: "Bruno Lima", username: "Bruno.Lima", profile_pic: "https://cdn/x.jpg" } });
      const resolvida = await provedor.resolverRemetente!(canal, recebida("777"));
      expect(resolvida.remetente).toEqual({ tipo: "instagram", valor: "bruno.lima", nomeExibido: "Bruno Lima" });
      expect(falso.recebidas.at(-1)!.caminho).toBe("/v24.0/777?fields=name%2Cusername%2Cprofile_pic");
      expect(falso.recebidas.at(-1)!.cabecalhos.authorization).toMatch(/^Bearer IGAA-/);
      expect(remetentes.linhas.get("777")).toMatchObject({ usuario: "bruno.lima", nome: "Bruno Lima" });
    });

    it("quem já é conhecido há menos de 24 h: nenhuma chamada à Meta", async () => {
      const resolvida = await provedor.resolverRemetente!(canal, recebida(IGSID));
      expect(resolvida.remetente).toEqual({ tipo: "instagram", valor: "ana.souza", nomeExibido: "Ana" });
      expect(falso.recebidas).toHaveLength(0);
    });

    it("guardado há mais de 24 h e a Meta fora do ar: vale o guardado; sem nada guardado, a linha volta à fila", async () => {
      remetentes.linhas.set(IGSID, { igsid: IGSID, usuario: "ana.souza", nome: "Ana", atualizadoEm: new Date(AGORA - 2 * 86_400_000).toISOString() });
      falso.enfileirar({ kind: "ok", status: 503, corpo: { error: { message: "fora", code: 2 } } });
      expect((await provedor.resolverRemetente!(canal, recebida(IGSID))).remetente.valor).toBe("ana.souza");

      falso.enfileirar({ kind: "ok", status: 503, corpo: { error: { message: "fora", code: 2 } } });
      await expect(provedor.resolverRemetente!(canal, recebida("888"))).rejects.toMatchObject({ name: "ErroDeProvedor", codigo: "PROVEDOR_INDISPONIVEL" });
    });

    it("um remetente que não é IGSID passa como veio", async () => {
      const comArroba: RecebidaDoProvedor = { ...recebida("1"), remetente: { tipo: "instagram", valor: "carla" } };
      expect(await provedor.resolverRemetente!(canal, comArroba)).toBe(comArroba);
    });
  });

  describe("o envio", () => {
    it("sai para o IGSID de quem tem o @, com o token no cabeçalho, e devolve o id da Meta", async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { recipient_id: IGSID, message_id: "mid.saida.ok" } });
      expect(await enviar()).toEqual({ ok: true, idExterno: "mid.saida.ok" });
      const pedido = falso.recebidas.at(-1)!;
      expect(pedido).toMatchObject({ metodo: "POST", caminho: `/v24.0/${CONTA}/messages`, corpo: { recipient: { id: IGSID }, message: { text: "Claro!" } } });
      expect(pedido.cabecalhos.authorization).toMatch(/^Bearer IGAA-/);
    });

    it("quem nunca escreveu para a conta não tem IGSID: recusa permanente, sem chamar a Meta", async () => {
      expect(await enviar("ninguem")).toEqual({ ok: false, transitorio: false, codigo: "SEM_IGSID", motivo: FRASE_SEM_IGSID });
      expect(falso.recebidas).toHaveLength(0);
    });

    it("fora da janela de 24 h a Meta recusa, e a frase diz que só o Contato reabre", async () => {
      falso.enfileirar({ kind: "ok", status: 400, corpo: { error: { message: "This message is sent outside of allowed window.", code: 10, error_subcode: 2018278 } } });
      expect(await enviar()).toEqual({ ok: false, transitorio: false, codigo: "FORA_DA_JANELA", motivo: fraseDaJanelaBloqueada(24) });
    });

    it("token recusado (190) e token vencido: recusa permanente, pedindo para conectar de novo", async () => {
      falso.enfileirar({ kind: "ok", status: 400, corpo: { error: { message: "Invalid OAuth access token", code: 190 } } });
      expect(await enviar()).toMatchObject({ ok: false, transitorio: false, codigo: "TOKEN_INVALIDO", motivo: FRASE_TOKEN_VENCIDO });

      canal = canalDoInstagram({ expiraEm: new Date(AGORA - 1).toISOString() });
      expect(await enviar()).toMatchObject({ ok: false, transitorio: false, codigo: "TOKEN_VENCIDO" });
    });

    it("o que certamente não saiu volta à fila; o que pode ter saído é ambíguo e nunca reenvia sozinho", async () => {
      falso.enfileirar({ kind: "ok", status: 429, corpo: { error: { message: "limite", code: 4 } } });
      expect(await enviar()).toMatchObject({ ok: false, transitorio: true, codigo: "LIMITE_DO_INSTAGRAM" });
      falso.enfileirar({ kind: "ok", status: 503, corpo: { error: { message: "fora" } } });
      expect(await enviar()).toMatchObject({ ok: false, transitorio: true, codigo: "HTTP_503" });
      falso.enfileirar({ kind: "ok", status: 500, corpo: { error: { message: "erro" } } });
      expect(await enviar()).toMatchObject({ ok: false, ambiguo: true, codigo: "HTTP_500" });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { recipient_id: IGSID } });
      expect(await enviar()).toMatchObject({ ok: false, ambiguo: true, codigo: "RESPOSTA_SEM_ID" });
      falso.enfileirar({ kind: "respostaPerdida" });
      expect(await enviar()).toMatchObject({ ok: false, ambiguo: true, codigo: "RESPOSTA_PERDIDA" });
    });

    it("a conexão recusada (o pedido nem saiu) é transitória", async () => {
      // Uma porta que acabou de ficar livre: ninguém escuta nela.
      const porta = await new Promise<number>((resolve) => {
        const servidor = createServer();
        servidor.listen(0, "127.0.0.1", () => {
          const { port } = servidor.address() as AddressInfo;
          servidor.close(() => resolve(port));
        });
      });
      const longe = criarProvedorInstagram({
        configuracao: configuracao(`http://127.0.0.1:${porta}`, segredo),
        remetentes,
        tokens: tokensSoDaCredencial(() => AGORA),
      });
      expect(await longe.enviar(canal, { mensagemId: "m", destino: { tipo: "instagram", valor: "ana.souza" }, conteudo: "oi" })).toMatchObject({
        ok: false,
        transitorio: true,
        codigo: "INSTAGRAM_INDISPONIVEL",
      });
    });

    it("uma imagem com texto sai em duas mensagens, o arquivo pela URL assinada; documento não sai pelo Direct", async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { message_id: "mid.imagem" } });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { message_id: "mid.texto" } });
      const r = await provedor.enviar(canal, {
        mensagemId: "m",
        destino: { tipo: "instagram", valor: "ana.souza" },
        conteudo: "Segue a foto",
        anexos: [{ urlAssinada: "https://bucket.exemplo/foto.jpg?token=x", tipoDeMidia: "image/jpeg", nome: "foto.jpg" }],
      });
      expect(r).toEqual({ ok: true, idExterno: "mid.imagem" });
      expect(falso.recebidas.map((p) => p.corpo)).toEqual([
        { recipient: { id: IGSID }, message: { attachment: { type: "image", payload: { url: "https://bucket.exemplo/foto.jpg?token=x" } } } },
        { recipient: { id: IGSID }, message: { text: "Segue a foto" } },
      ]);

      const pdf = await provedor.enviar(canal, {
        mensagemId: "m2",
        destino: { tipo: "instagram", valor: "ana.souza" },
        anexos: [{ urlAssinada: "https://bucket.exemplo/a.pdf", tipoDeMidia: "application/pdf", nome: "a.pdf" }],
      });
      expect(pdf).toMatchObject({ ok: false, transitorio: false, codigo: "TIPO_NAO_ENVIADO" });
    });

    it("o arquivo saiu e o texto não se confirmou: ambíguo, para não reenviar o arquivo", async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: { message_id: "mid.imagem" } });
      falso.enfileirar({ kind: "ok", status: 500, corpo: { error: { message: "erro" } } });
      const r = await provedor.enviar(canal, {
        mensagemId: "m",
        destino: { tipo: "instagram", valor: "ana.souza" },
        conteudo: "legenda",
        anexos: [{ urlAssinada: "https://bucket.exemplo/f.jpg", tipoDeMidia: "image/jpeg", nome: "f.jpg" }],
      });
      expect(r).toMatchObject({ ok: false, ambiguo: true, codigo: "TEXTO_NAO_CONFIRMADO" });
    });
  });

  describe("a mídia recebida", () => {
    it("só https num host da Meta (e os subdomínios dela)", () => {
      expect(hostDaMetaPermitido(new URL("https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1"))).toBe(true);
      expect(hostDaMetaPermitido(new URL("https://scontent-gru1-1.cdninstagram.com/v/t51.jpg"))).toBe(true);
      expect(hostDaMetaPermitido(new URL("https://video.xx.fbcdn.net/v/a.mp4"))).toBe(true);
      expect(hostDaMetaPermitido(new URL("http://lookaside.fbsbx.com/a"))).toBe(false);
      expect(hostDaMetaPermitido(new URL("https://fbsbx.com.atacante.test/a"))).toBe(false);
      expect(hostDaMetaPermitido(new URL("https://user:senha@lookaside.fbsbx.com/a"))).toBe(false);
      expect(hostDaMetaPermitido(new URL("https://169.254.169.254/latest"))).toBe(false);
    });

    it("baixa e devolve o tipo da resposta; o padrão nunca segue um host de fora da Meta", async () => {
      falso.enfileirar({ kind: "ok", status: 200, corpo: "bytes", cabecalhos: { "content-type": "image/png" } });
      const midia = await provedor.baixarMidia(canal, `${falso.url}/midia/a.png`, { tetoBytes: 1024 });
      expect(midia.tipoDeMidia).toBe("image/png");
      expect(Buffer.from(midia.bytes).toString("utf8")).toBe('"bytes"');

      const padrao = criarProvedorInstagram({ configuracao: configuracao(falso.url, segredo), remetentes, tokens: tokensSoDaCredencial(() => AGORA) });
      await expect(padrao.baixarMidia(canal, `${falso.url}/midia/a.png`, { tetoBytes: 1024 })).rejects.toMatchObject({ codigo: "MIDIA_INDISPONIVEL" });
    });

    it("um redirecionamento para fora dos hosts permitidos não é seguido", async () => {
      falso.enfileirar({ kind: "ok", status: 302, cabecalhos: { location: "https://interno.exemplo/segredo" } });
      await expect(provedor.baixarMidia(canal, `${falso.url}/midia/r.jpg`, { tetoBytes: 1024 })).rejects.toMatchObject({ codigo: "MIDIA_INDISPONIVEL" });
      expect(falso.recebidas).toHaveLength(1);
    });

    it("404 é mídia que já não existe; 503 passa sozinha", async () => {
      falso.enfileirar({ kind: "ok", status: 404 });
      await expect(provedor.baixarMidia(canal, `${falso.url}/midia/x.jpg`, { tetoBytes: 1024 })).rejects.toMatchObject({ codigo: "MIDIA_INDISPONIVEL" });
      falso.enfileirar({ kind: "ok", status: 503 });
      await expect(provedor.baixarMidia(canal, `${falso.url}/midia/x.jpg`, { tetoBytes: 1024 })).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
    });
  });
});
