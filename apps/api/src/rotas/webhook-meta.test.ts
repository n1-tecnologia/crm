/** Os webhooks da Meta (WhatsApp oficial e Instagram): sem banco, sem Authorization, segredos injetados. */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { signedRequest } from "../testes/assinatura-da-meta";
import type { ChamadaDoWebhook } from "../mensageria/provedor";
import type { OpcoesDeWebhookMeta } from "./webhook-meta";

const TOKEN = "token-de-verificacao";
const SEGREDO = "segredo-do-app";
const SEGREDO_DO_INSTAGRAM = "segredo-do-app-do-instagram";

const EVENTO_WHATSAPP = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ id: "123", changes: [{ field: "messages", value: { messages: [{ id: "wamid.X", text: { body: "oi" } }] } }] }],
});

const EVENTO_INSTAGRAM = JSON.stringify({
  object: "instagram",
  entry: [
    {
      id: "17841400000000000",
      time: 1792680000,
      messaging: [
        {
          sender: { id: "1000000000000001" },
          recipient: { id: "17841400000000000" },
          timestamp: 1792680000,
          message: { mid: "aWdfZG1", text: "Oi, quero saber o preço" },
        },
      ],
    },
  ],
});

function assinar(corpo: string, segredo = SEGREDO): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;
}

/** `""` desliga o segredo (em vez de cair no ambiente): o teste nunca depende do `.env` de quem o roda. */
function appCom(webhookMeta: OpcoesDeWebhookMeta) {
  return buildApp({ logger: false, webhookMeta });
}

const CANAIS = [
  {
    nome: "WhatsApp",
    caminho: "/webhooks/meta/whatsapp",
    evento: EVENTO_WHATSAPP,
    segredo: SEGREDO,
    comSegredo: { segredoDoApp: SEGREDO, segredoDoInstagram: "" },
    semSegredo: { segredoDoApp: "", segredoDoInstagram: "" },
  },
  {
    nome: "Instagram",
    caminho: "/webhooks/meta/instagram",
    evento: EVENTO_INSTAGRAM,
    segredo: SEGREDO_DO_INSTAGRAM,
    comSegredo: { segredoDoApp: "", segredoDoInstagram: SEGREDO_DO_INSTAGRAM },
    semSegredo: { segredoDoApp: "", segredoDoInstagram: "" },
  },
] as const;

describe.each(CANAIS)("webhook da Meta — $nome", ({ caminho, evento, segredo, comSegredo, semSegredo }) => {
  describe(`GET ${caminho} (verificação)`, () => {
    const consulta = (token: string, extra = "") =>
      `${caminho}?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=1158201444${extra}`;

    it("devolve o hub.challenge em texto puro com o token certo, sem Authorization", async () => {
      const resposta = await appCom({ tokenDeVerificacao: TOKEN }).inject({ method: "GET", url: consulta(TOKEN) });
      expect(resposta.statusCode, resposta.body).toBe(200);
      expect(resposta.body).toBe("1158201444");
      expect(resposta.headers["content-type"]).toContain("text/plain");
    });

    it("recusa token errado, modo errado e desafio ausente", async () => {
      const app = appCom({ tokenDeVerificacao: TOKEN });
      expect((await app.inject({ method: "GET", url: consulta("outro") })).statusCode).toBe(403);
      expect(
        (await app.inject({ method: "GET", url: `${caminho}?hub.mode=unsubscribe&hub.verify_token=${TOKEN}&hub.challenge=1` })).statusCode,
      ).toBe(403);
      expect((await app.inject({ method: "GET", url: `${caminho}?hub.mode=subscribe&hub.verify_token=${TOKEN}` })).statusCode).toBe(403);
      expect((await app.inject({ method: "GET", url: caminho })).statusCode).toBe(403);
    });

    it("sem token configurado no servidor, nunca verifica — nem com token vazio", async () => {
      const app = appCom({ tokenDeVerificacao: "" });
      expect((await app.inject({ method: "GET", url: consulta("") })).statusCode).toBe(403);
    });
  });

  describe(`POST ${caminho} (eventos)`, () => {
    it("aceita com assinatura válida, sem Authorization", async () => {
      const resposta = await appCom(comSegredo).inject({
        method: "POST",
        url: caminho,
        headers: { "content-type": "application/json", "x-hub-signature-256": assinar(evento, segredo) },
        payload: evento,
      });
      expect(resposta.statusCode, resposta.body).toBe(200);
      expect(resposta.json()).toEqual({ ok: true });
    });

    it("recusa assinatura errada, de outro corpo ou ausente", async () => {
      const app = appCom(comSegredo);
      const enviar = (headers: Record<string, string>) =>
        app.inject({ method: "POST", url: caminho, headers: { "content-type": "application/json", ...headers }, payload: evento });
      expect((await enviar({ "x-hub-signature-256": assinar(evento, "outro-segredo") })).statusCode).toBe(401);
      expect((await enviar({ "x-hub-signature-256": assinar("{}", segredo) })).statusCode).toBe(401);
      expect((await enviar({ "x-hub-signature-256": "sha256=" })).statusCode).toBe(401);
      expect((await enviar({})).statusCode).toBe(401);
    });

    it("sem segredo configurado, aceita sem assinatura (modo de escuta)", async () => {
      const resposta = await appCom(semSegredo).inject({
        method: "POST",
        url: caminho,
        headers: { "content-type": "application/json" },
        payload: evento,
      });
      expect(resposta.statusCode).toBe(200);
    });

    it("JSON malformado é 400, não 500", async () => {
      const resposta = await appCom(semSegredo).inject({
        method: "POST",
        url: caminho,
        headers: { "content-type": "application/json" },
        payload: "{nao e json",
      });
      expect(resposta.statusCode).toBe(400);
    });
  });
});

describe("POST /webhooks/meta/instagram (os dois segredos)", () => {
  const CAMINHO = "/webhooks/meta/instagram";
  const enviar = (opcoes: OpcoesDeWebhookMeta, assinatura: string) =>
    appCom(opcoes).inject({
      method: "POST",
      url: CAMINHO,
      headers: { "content-type": "application/json", "x-hub-signature-256": assinatura },
      payload: EVENTO_INSTAGRAM,
    });
  const AMBOS = { segredoDoApp: SEGREDO, segredoDoInstagram: SEGREDO_DO_INSTAGRAM };

  it("aceita a assinatura do segredo do Instagram ou a do app da Meta", async () => {
    expect((await enviar(AMBOS, assinar(EVENTO_INSTAGRAM, SEGREDO_DO_INSTAGRAM))).statusCode).toBe(200);
    expect((await enviar(AMBOS, assinar(EVENTO_INSTAGRAM, SEGREDO))).statusCode).toBe(200);
  });

  it("recusa a assinatura de um terceiro segredo mesmo com os dois configurados", async () => {
    expect((await enviar(AMBOS, assinar(EVENTO_INSTAGRAM, "de-outro-app"))).statusCode).toBe(401);
  });

  it("com só o segredo da Meta configurado, ele basta (o do Instagram ainda não foi posto)", async () => {
    const opcoes = { segredoDoApp: SEGREDO, segredoDoInstagram: "" };
    expect((await enviar(opcoes, assinar(EVENTO_INSTAGRAM, SEGREDO))).statusCode).toBe(200);
    expect((await enviar(opcoes, assinar(EVENTO_INSTAGRAM, SEGREDO_DO_INSTAGRAM))).statusCode).toBe(401);
  });
});

describe("POST /webhooks/meta/whatsapp (isolado do Instagram)", () => {
  it("não aceita a assinatura do segredo do Instagram", async () => {
    const resposta = await appCom({ segredoDoApp: SEGREDO, segredoDoInstagram: SEGREDO_DO_INSTAGRAM }).inject({
      method: "POST",
      url: "/webhooks/meta/whatsapp",
      headers: { "content-type": "application/json", "x-hub-signature-256": assinar(EVENTO_WHATSAPP, SEGREDO_DO_INSTAGRAM) },
      payload: EVENTO_WHATSAPP,
    });
    expect(resposta.statusCode).toBe(401);
  });
});

describe("o parser do corpo cru", () => {
  it("não vaza para o resto da API", async () => {
    const app = appCom({});
    // Rota autenticada continua exigindo Bearer — e não passa pelo parser do webhook.
    const resposta = await app.inject({ method: "POST", url: "/operacoes/qualquer", headers: { "content-type": "application/json" }, payload: "{}" });
    expect(resposta.statusCode).toBe(401);
  });
});

describe("Sessão 8 — o Instagram guarda na fila de entrada o que a Meta assinou", () => {
  const CAMINHO = "/webhooks/meta/instagram";
  const RESULTADO = { guardadas: 1, repetidas: 0, semCanal: 0, recusadas: 0 };
  const enviar = (opcoes: OpcoesDeWebhookMeta, assinatura?: string) =>
    appCom(opcoes).inject({
      method: "POST",
      url: CAMINHO,
      headers: { "content-type": "application/json", ...(assinatura ? { "x-hub-signature-256": assinatura } : {}) },
      payload: EVENTO_INSTAGRAM,
    });

  it("com a assinatura conferida, entrega a chamada inteira (cabeçalhos, corpo cru e JSON) à fila, responde 200 e acorda o processador", async () => {
    const recebidas: ChamadaDoWebhook[] = [];
    let acordou = 0;
    const assinatura = assinar(EVENTO_INSTAGRAM, SEGREDO_DO_INSTAGRAM);
    const resposta = await enviar(
      {
        segredoDoApp: "",
        segredoDoInstagram: SEGREDO_DO_INSTAGRAM,
        enfileirarInstagram: async (chamada) => (recebidas.push(chamada), RESULTADO),
        acordarProcessador: () => {
          acordou += 1;
        },
      },
      assinatura,
    );
    expect(resposta.statusCode).toBe(200);
    expect(recebidas).toHaveLength(1);
    expect(recebidas[0]!.corpo).toEqual(JSON.parse(EVENTO_INSTAGRAM));
    expect(recebidas[0]!.corpoCru.toString("utf8")).toBe(EVENTO_INSTAGRAM);
    expect(recebidas[0]!.cabecalhos["x-hub-signature-256"]).toBe(assinatura);
    expect(acordou).toBe(1);
  });

  it("nada novo na fila (a Meta repetiu o evento): 200 sem acordar o processador", async () => {
    let acordou = 0;
    const resposta = await enviar(
      {
        segredoDoApp: "",
        segredoDoInstagram: SEGREDO_DO_INSTAGRAM,
        enfileirarInstagram: async () => ({ ...RESULTADO, guardadas: 0, repetidas: 1 }),
        acordarProcessador: () => {
          acordou += 1;
        },
      },
      assinar(EVENTO_INSTAGRAM, SEGREDO_DO_INSTAGRAM),
    );
    expect(resposta.statusCode).toBe(200);
    expect(acordou).toBe(0);
  });

  it("sem segredo configurado, aceita mas NÃO guarda: evento sem assinatura nunca vira dado", async () => {
    let chamadas = 0;
    const resposta = await enviar({ segredoDoApp: "", segredoDoInstagram: "", enfileirarInstagram: async () => ((chamadas += 1), RESULTADO) });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas).toBe(0);
  });

  it("falha ao guardar é 500, para a Meta reenviar", async () => {
    const resposta = await enviar(
      { segredoDoApp: "", segredoDoInstagram: SEGREDO_DO_INSTAGRAM, enfileirarInstagram: async () => Promise.reject(new Error("banco fora")) },
      assinar(EVENTO_INSTAGRAM, SEGREDO_DO_INSTAGRAM),
    );
    expect(resposta.statusCode).toBe(500);
    expect(resposta.json()).toEqual({ ok: false, error: "Falha ao guardar o evento." });
  });
});

describe("Sessão 8 — desautorização e exclusão de dados do Instagram", () => {
  const formulario = (signed: string) => new URLSearchParams({ signed_request: signed }).toString();
  const pedir = (opcoes: OpcoesDeWebhookMeta, url: string, signed: string) =>
    appCom(opcoes).inject({ method: "POST", url, headers: { "content-type": "application/x-www-form-urlencoded" }, payload: formulario(signed) });
  const comSpy = () => {
    const esquecidos: string[] = [];
    const opcoes: OpcoesDeWebhookMeta = {
      segredoDoApp: "",
      segredoDoInstagram: SEGREDO_DO_INSTAGRAM,
      esquecerContaDoInstagram: async (userId) => (esquecidos.push(userId), 1),
    };
    return { esquecidos, opcoes };
  };
  const valido = signedRequest({ algorithm: "HMAC-SHA256", user_id: "17841400000000000", issued_at: 1_792_680_000 }, SEGREDO_DO_INSTAGRAM);

  it("a desautorização assinada desliga a conta do user_id e responde 200, sem Authorization", async () => {
    const { esquecidos, opcoes } = comSpy();
    const resposta = await pedir(opcoes, "/webhooks/meta/instagram/desautorizar", valido);
    expect(resposta.statusCode).toBe(200);
    expect(esquecidos).toEqual(["17841400000000000"]);
  });

  it("a exclusão devolve a URL de situação e o código, e a URL confirma o pedido", async () => {
    const { esquecidos, opcoes } = comSpy();
    const app = appCom(opcoes);
    const resposta = await app.inject({
      method: "POST",
      url: "/webhooks/meta/instagram/exclusao-de-dados",
      headers: { "content-type": "application/x-www-form-urlencoded", host: "api.exemplo.test" },
      payload: formulario(valido),
    });
    expect(resposta.statusCode).toBe(200);
    expect(esquecidos).toEqual(["17841400000000000"]);
    const { url, confirmation_code: codigo } = resposta.json<{ url: string; confirmation_code: string }>();
    expect(url).toBe(`http://api.exemplo.test/webhooks/meta/instagram/exclusao-de-dados/${codigo}`);

    const situacao = await app.inject({ method: "GET", url: `/webhooks/meta/instagram/exclusao-de-dados/${codigo}` });
    expect(situacao.statusCode).toBe(200);
    expect(situacao.body).toContain(codigo);
    expect(situacao.body).toContain("concluído");

    const forjado = await app.inject({ method: "GET", url: `/webhooks/meta/instagram/exclusao-de-dados/${codigo.slice(0, -1)}A` });
    expect(forjado.statusCode).toBe(404);
  });

  it("assinatura de outro segredo ou sem signed_request é 400, sem desligar nada", async () => {
    const { esquecidos, opcoes } = comSpy();
    const deOutro = signedRequest({ algorithm: "HMAC-SHA256", user_id: "1" }, "de-outro-app");
    expect((await pedir(opcoes, "/webhooks/meta/instagram/desautorizar", deOutro)).statusCode).toBe(400);
    expect((await pedir(opcoes, "/webhooks/meta/instagram/exclusao-de-dados", "")).statusCode).toBe(400);
    expect(esquecidos).toEqual([]);
  });

  it("sem segredo no servidor, 503: nunca aceita um pedido que não dá para conferir", async () => {
    const { esquecidos } = comSpy();
    const opcoes: OpcoesDeWebhookMeta = { segredoDoApp: "", segredoDoInstagram: "", esquecerContaDoInstagram: async (u) => (esquecidos.push(u), 1) };
    expect((await pedir(opcoes, "/webhooks/meta/instagram/desautorizar", valido)).statusCode).toBe(503);
    expect(esquecidos).toEqual([]);
  });
});
