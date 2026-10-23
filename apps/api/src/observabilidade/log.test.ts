/**
 * O log do `apps/api` sem segredo de link e sem token (D-18, 1.5.1, T-09-25..27).
 * Sem banco e sem `.env`: o logger escreve num fluxo de memória, o estado das
 * rotas públicas é injetado e o token recusa tudo.
 */

import { buildSeed } from "@n1/dominio/seed";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { opcoesDoLogger } from "./log";

// Os segredos reais têm 16+ caracteres (`PARAMS_SEGREDO`): estes passam da validação e chegam ao handler.
const SEGREDO_FORM = "SEGREDO-LOG-1-ABCDEFGH";
const SEGREDO_TAREFA = "SEGREDO-LOG-2-ABCDEFGH";
const TOKEN_BEARER = "TOKEN-LOG-3";

function appComLogCapturado(env: NodeJS.ProcessEnv = { LOG_LEVEL: "info" }) {
  const linhas: string[] = [];
  const destino = { write: (linha: string) => void linhas.push(linha) };
  const app = buildApp({
    logger: opcoesDoLogger(env, destino),
    workspaceId: "ws_log_teste",
    verificarToken: async () => null,
    resolverMembro: async () => undefined,
    formulariosPublicos: { lerEstado: async () => buildSeed() },
    tarefasPublicas: { lerEstado: async () => buildSeed() },
  });
  return { app, linhas };
}

describe("opcoesDoLogger — o log não carrega segredo", () => {
  it("o segredo do link público não aparece em nenhuma linha, e a entrada mostra a URL mascarada", async () => {
    const { app, linhas } = appComLogCapturado();
    await app.inject({ method: "GET", url: `/v1/public/forms/${SEGREDO_FORM}` });
    await app.inject({ method: "POST", url: `/v1/public/forms/${SEGREDO_FORM}/submissions`, payload: {} });
    await app.inject({ method: "GET", url: `/v1/public/tasks/${SEGREDO_TAREFA}` });
    await app.close();

    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) {
      expect(linha).not.toContain("SEGREDO-LOG-1");
      expect(linha).not.toContain("SEGREDO-LOG-2");
    }
    expect(linhas.some((linha) => linha.includes("/v1/public/forms/***"))).toBe(true);
    expect(linhas.some((linha) => linha.includes("/v1/public/tasks/***"))).toBe(true);
  });

  it("um Authorization: Bearer não aparece em linha nenhuma", async () => {
    const { app, linhas } = appComLogCapturado();
    const resposta = await app.inject({
      method: "GET",
      url: "/estado",
      headers: { authorization: `Bearer ${TOKEN_BEARER}`, cookie: "sid=COOKIE-LOG-3" },
    });
    await app.close();

    expect(resposta.statusCode).toBe(401);
    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) {
      expect(linha).not.toContain(TOKEN_BEARER);
      expect(linha).not.toContain("COOKIE-LOG-3");
    }
  });

  it("objeto logado com token/segredo/secret/senha sai censurado, no topo e aninhado", async () => {
    const { app, linhas } = appComLogCapturado();
    app.log.info({ token: "T-4", segredo: "S-4", secret: "Q-4", senha: "P-4" }, "objeto");
    app.log.info({ credencial: { token: "T-5", segredo: "S-5", secret: "Q-5", senha: "P-5" } }, "aninhado");
    app.log.info({ req: { headers: { authorization: "Bearer T-6", cookie: "sid=C-6" } } }, "cabecalhos");
    await app.close();

    const todas = linhas.join("\n");
    expect(todas).toContain("[oculto]");
    for (const valor of ["T-4", "S-4", "Q-4", "P-4", "T-5", "S-5", "Q-5", "P-5", "T-6", "C-6"]) {
      expect(todas).not.toContain(valor);
    }
  });

  it("o nível vem de LOG_LEVEL, com info por padrão", () => {
    expect(opcoesDoLogger({}).level).toBe("info");
    expect(opcoesDoLogger({ LOG_LEVEL: "warn" }).level).toBe("warn");
    expect(opcoesDoLogger({ LOG_LEVEL: "  " }).level).toBe("info");
  });
});
