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

  it("rota inexistente responde 404 (autenticação entra na Task 2 — ver Plan 01-02 Task 2)", async () => {
    const app = buildApp({ logger: false });
    const resposta = await app.inject({ method: "GET", url: "/nao-existe" });
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ ok: false, error: "Rota não encontrada." });
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
});
