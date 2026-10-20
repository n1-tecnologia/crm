/** O webhook da Meta (WhatsApp oficial): sem banco, sem Authorization, segredos injetados. */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app";

const CAMINHO = "/webhooks/meta/whatsapp";
const TOKEN = "token-de-verificacao";
const SEGREDO = "segredo-do-app";

const EVENTO = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ id: "123", changes: [{ field: "messages", value: { messages: [{ id: "wamid.X", text: { body: "oi" } }] } }] }],
});

function assinar(corpo: string, segredo = SEGREDO): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;
}

function appCom(webhookMeta: { tokenDeVerificacao?: string; segredoDoApp?: string }) {
  return buildApp({ logger: false, webhookMeta });
}

describe(`GET ${CAMINHO} (verificação)`, () => {
  const consulta = (token: string, extra = "") =>
    `${CAMINHO}?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=1158201444${extra}`;

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
      (await app.inject({ method: "GET", url: `${CAMINHO}?hub.mode=unsubscribe&hub.verify_token=${TOKEN}&hub.challenge=1` })).statusCode,
    ).toBe(403);
    expect((await app.inject({ method: "GET", url: `${CAMINHO}?hub.mode=subscribe&hub.verify_token=${TOKEN}` })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: CAMINHO })).statusCode).toBe(403);
  });

  it("sem token configurado no servidor, nunca verifica — nem com token vazio", async () => {
    const app = buildApp({ logger: false, webhookMeta: { tokenDeVerificacao: "" } });
    expect((await app.inject({ method: "GET", url: consulta("") })).statusCode).toBe(403);
  });
});

describe(`POST ${CAMINHO} (eventos)`, () => {
  it("aceita com assinatura válida, sem Authorization", async () => {
    const resposta = await appCom({ segredoDoApp: SEGREDO }).inject({
      method: "POST",
      url: CAMINHO,
      headers: { "content-type": "application/json", "x-hub-signature-256": assinar(EVENTO) },
      payload: EVENTO,
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    expect(resposta.json()).toEqual({ ok: true });
  });

  it("recusa assinatura errada, de outro corpo ou ausente", async () => {
    const app = appCom({ segredoDoApp: SEGREDO });
    const enviar = (headers: Record<string, string>) =>
      app.inject({ method: "POST", url: CAMINHO, headers: { "content-type": "application/json", ...headers }, payload: EVENTO });
    expect((await enviar({ "x-hub-signature-256": assinar(EVENTO, "outro-segredo") })).statusCode).toBe(401);
    expect((await enviar({ "x-hub-signature-256": assinar("{}") })).statusCode).toBe(401);
    expect((await enviar({ "x-hub-signature-256": "sha256=" })).statusCode).toBe(401);
    expect((await enviar({})).statusCode).toBe(401);
  });

  it("sem segredo configurado, aceita sem assinatura (modo de escuta)", async () => {
    const resposta = await appCom({ segredoDoApp: "" }).inject({
      method: "POST",
      url: CAMINHO,
      headers: { "content-type": "application/json" },
      payload: EVENTO,
    });
    expect(resposta.statusCode).toBe(200);
  });

  it("JSON malformado é 400, não 500", async () => {
    const resposta = await appCom({ segredoDoApp: "" }).inject({
      method: "POST",
      url: CAMINHO,
      headers: { "content-type": "application/json" },
      payload: "{nao e json",
    });
    expect(resposta.statusCode).toBe(400);
  });

  it("o parser do corpo cru não vaza para o resto da API", async () => {
    const app = appCom({});
    // Rota autenticada continua exigindo Bearer — e não passa pelo parser do webhook.
    const resposta = await app.inject({ method: "POST", url: "/operacoes/qualquer", headers: { "content-type": "application/json" }, payload: "{}" });
    expect(resposta.statusCode).toBe(401);
  });
});
