/**
 * `app.inject()` sobre `buildApp()` — sem `listen()`, sem socket, sem banco
 * e sem `SUPABASE_*`/`DATABASE_URL` (D-DEC-09). Prova a casca: saúde, CORS
 * por allowlist e o formato de erro de transporte.
 */

import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

describe("buildApp — casca do apps/api", () => {
  it("GET /saude responde 200 sem exigir token", async () => {
    const app = buildApp({ logger: false });
    const resposta = await app.inject({ method: "GET", url: "/saude" });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, servico: "apps/api" });
  });

  it("rota inexistente sem Authorization responde 401 — a autenticação vem antes do 404", async () => {
    const app = buildApp({ logger: false });
    const resposta = await app.inject({ method: "GET", url: "/nao-existe" });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({ ok: false, error: "Sem sessão." });
  });

  it("CORS: origem permitida recebe access-control-allow-origin no preflight", async () => {
    const app = buildApp({ logger: false, webOrigin: "http://localhost:3001" });
    const resposta = await app.inject({
      method: "OPTIONS",
      url: "/saude",
      headers: {
        origin: "http://localhost:3001",
        "access-control-request-method": "GET",
      },
    });
    expect(resposta.headers["access-control-allow-origin"]).toBe("http://localhost:3001");
  });

  it("CORS: origem fora da allowlist não recebe access-control-allow-origin", async () => {
    const app = buildApp({ logger: false, webOrigin: "http://localhost:3001" });
    const resposta = await app.inject({
      method: "OPTIONS",
      url: "/saude",
      headers: {
        origin: "https://outro.exemplo",
        "access-control-request-method": "GET",
      },
    });
    expect(resposta.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("CORS: WEB_ORIGIN aceita mais de uma origem, separadas por vírgula", async () => {
    const app = buildApp({ logger: false, webOrigin: "https://crm.exemplo, https://crm-n1.vercel.app" });
    for (const origin of ["https://crm.exemplo", "https://crm-n1.vercel.app"]) {
      const resposta = await app.inject({
        method: "OPTIONS",
        url: "/saude",
        headers: { origin, "access-control-request-method": "GET" },
      });
      expect(resposta.headers["access-control-allow-origin"]).toBe(origin);
    }
  });
});

describe("buildApp — CORS para as rotas REST do CRM (PATCH, PUT, DELETE)", () => {
  const origem = "http://localhost:3001";
  const preflight = (metodo: string, url = "/contatos", origin = origem) =>
    buildApp({ logger: false, webOrigin: origem }).inject({
      method: "OPTIONS",
      url,
      headers: { origin, "access-control-request-method": metodo },
    });

  it.each(["PATCH", "PUT", "DELETE"])("preflight de %s da origem da allowlist libera o método", async (metodo) => {
    const resposta = await preflight(metodo);
    expect(resposta.headers["access-control-allow-origin"]).toBe(origem);
    const metodos = String(resposta.headers["access-control-allow-methods"]);
    for (const esperado of ["GET", "POST", "PATCH", "PUT", "DELETE"]) expect(metodos).toContain(esperado);
  });

  it.each(["PATCH", "PUT", "DELETE"])("preflight de %s de origem fora da allowlist não recebe allow-origin", async (metodo) => {
    const resposta = await preflight(metodo, "/contatos", "https://outro.exemplo");
    expect(resposta.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("/v1/integrations/* continua sem cabeçalho CORS", async () => {
    const resposta = await preflight("DELETE", "/v1/integrations/payment-requests/x");
    expect(resposta.headers["access-control-allow-origin"]).toBeUndefined();
    expect(resposta.headers["access-control-allow-methods"]).toBeUndefined();
  });
});

describe("buildApp — o IP de quem chamou (limite de taxa do Formulário público)", () => {
  function comRotaDeIp(trustProxy: string) {
    const app = buildApp({ logger: false, trustProxy });
    app.get("/ip-de-teste", { config: { publica: true } }, async (request) => ({ ip: request.ip }));
    return app;
  }
  async function ipVisto(trustProxy: string, remoteAddress: string, encaminhadoPara: string) {
    const app = comRotaDeIp(trustProxy);
    const resposta = await app.inject({
      method: "GET",
      url: "/ip-de-teste",
      remoteAddress,
      headers: { "x-forwarded-for": encaminhadoPara },
    });
    return resposta.json().ip;
  }

  it("atrás do nginx local (TRUST_PROXY=loopback), o IP é o do navegador, não o 127.0.0.1 do proxy", async () => {
    expect(await ipVisto("loopback", "127.0.0.1", "203.0.113.7")).toBe("203.0.113.7");
  });

  it("o X-Forwarded-For que o navegador forja antes do nginx não vale: vale o que o nginx viu", async () => {
    expect(await ipVisto("loopback", "127.0.0.1", "198.51.100.1, 203.0.113.7")).toBe("203.0.113.7");
  });

  it("quem chama direto, sem passar pelo nginx, não escolhe o próprio IP", async () => {
    expect(await ipVisto("loopback", "198.51.100.4", "203.0.113.7")).toBe("198.51.100.4");
  });

  it("sem TRUST_PROXY (desenvolvimento, sem proxy), o cabeçalho é ignorado", async () => {
    expect(await ipVisto("", "127.0.0.1", "203.0.113.7")).toBe("127.0.0.1");
  });
});
