/**
 * O cliente do login do Google (Fase 17, 17-13) contra o servidor HTTP FALSO (`criarServidorFalso`): nenhum teste chama o Google
 * (accounts.google.com, oauth2.googleapis.com). Sem banco.
 *
 * Prova: a URL do login; a troca do código (formulário, segredo, verificador, `email_verified` e `sub` lidos do id_token); a
 * renovação sem rotação do token; a classificação permanente x transitória do erro de renovação (`invalid_grant`, inclusive os 7
 * dias do modo de teste); a revogação; e que nenhum erro serializado carrega o token, o código nem o segredo do cliente.
 */

import { afterEach, describe, expect, it } from "vitest";
import { ErroDeRenovacao } from "../credencial";
import { renovadoresDoAmbiente } from "../token";
import { camposDoPedido, idTokenDeTeste } from "../../../../testes/login-oauth-falso";
import { criarServidorFalso, type ServidorFalso } from "../../../../testes/servidor-falso";
import { ErroDoLogin } from "./comum";
import { ENDERECOS_DO_GOOGLE, ESCOPOS_GOOGLE, FRASE_GOOGLE_RENOVACAO_PERMANENTE, criarClienteGoogle } from "./google";

const CONFIG = { clientId: "id-do-app-google-de-teste", clientSecret: "segredo-do-app-google-de-teste", redirectUri: "https://crm.exemplo.test/retorno" };
const AGORA = Date.parse("2026-11-19T12:00:00.000Z");

describe("criarClienteGoogle", () => {
  const servidores: ServidorFalso[] = [];
  afterEach(async () => {
    while (servidores.length > 0) await servidores.pop()!.fechar();
  });

  async function cliente(opcoes: { tempoLimiteMs?: number; tempoLimiteDaRevogacaoMs?: number } = {}) {
    const login = await criarServidorFalso();
    servidores.push(login);
    const c = criarClienteGoogle(
      CONFIG,
      { autorizacao: `${login.url}/authorize`, token: `${login.url}/token`, revogacao: `${login.url}/revoke` },
      { agora: () => AGORA, ...opcoes },
    );
    return { login, c };
  }

  const mostra = (erro: unknown) => JSON.stringify(erro, (_k, v: unknown) => (v instanceof Error ? { ...v, name: v.name, message: v.message, stack: v.stack } : v));

  it("os endereços de produção são os do Google e o escopo pede o acesso restrito ao e-mail", () => {
    expect(ENDERECOS_DO_GOOGLE.autorizacao).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(ENDERECOS_DO_GOOGLE.token).toBe("https://oauth2.googleapis.com/token");
    expect(ENDERECOS_DO_GOOGLE.revogacao).toBe("https://oauth2.googleapis.com/revoke");
    expect([...ESCOPOS_GOOGLE]).toEqual(["openid", "email", "https://mail.google.com/"]);
  });

  it("a URL do login leva offline, consent, state, PKCE S256, login_hint e a URI de retorno, e nunca o segredo do cliente", async () => {
    const { c } = await cliente();
    const url = new URL(c.urlDeAutorizacao({ state: "state-1", desafio: "d".repeat(43), loginHint: "vendas@gmail.com" }));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toBe("openid email https://mail.google.com/");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("code_challenge")).toBe("d".repeat(43));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("login_hint")).toBe("vendas@gmail.com");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.toString()).not.toContain(CONFIG.clientSecret);
  });

  describe("trocarCodigo", () => {
    it("manda o formulário certo e devolve os tokens, o vencimento e a conta do id_token (email, email_verified, sub)", async () => {
      const { login, c } = await cliente();
      login.enfileirar({
        kind: "ok",
        status: 200,
        corpo: {
          access_token: "at-1",
          refresh_token: "rt-1",
          expires_in: 3599,
          id_token: idTokenDeTeste({ aud: CONFIG.clientId, sub: "1234567890", email: "vendas@gmail.com", email_verified: true }),
        },
      });
      const tokens = await c.trocarCodigo("codigo-1", "verificador-1");
      expect(tokens).toEqual({
        accessToken: "at-1",
        refreshToken: "rt-1",
        expiraEm: new Date(AGORA + 3599_000).toISOString(),
        conta: { email: "vendas@gmail.com", emailVerificado: true, idEstavel: "1234567890" },
      });
      const pedido = camposDoPedido(login.recebidas[0]!);
      expect(login.recebidas[0]!.cabecalhos["content-type"]).toBe("application/x-www-form-urlencoded");
      expect(pedido).toMatchObject({
        grant_type: "authorization_code",
        code: "codigo-1",
        code_verifier: "verificador-1",
        redirect_uri: CONFIG.redirectUri,
        client_id: CONFIG.clientId,
        client_secret: CONFIG.clientSecret,
      });
    });

    it("email_verified falso ou como texto é lido como é; id_token de outra audiência é ignorado", async () => {
      const { login, c } = await cliente();
      const resposta = (claims: Record<string, unknown>) => ({
        kind: "ok" as const,
        status: 200,
        corpo: { access_token: "at-1", refresh_token: "rt-1", expires_in: 3599, id_token: idTokenDeTeste(claims) },
      });
      login.enfileirar(resposta({ aud: CONFIG.clientId, sub: "1", email: "a@gmail.com", email_verified: false }));
      expect((await c.trocarCodigo("x", "y")).conta).toMatchObject({ emailVerificado: false });
      login.enfileirar(resposta({ aud: CONFIG.clientId, sub: "1", email: "a@gmail.com", email_verified: "true" }));
      expect((await c.trocarCodigo("x", "y")).conta).toMatchObject({ emailVerificado: true });
      login.enfileirar(resposta({ aud: "outro-app", sub: "1", email: "a@gmail.com", email_verified: true }));
      expect((await c.trocarCodigo("x", "y")).conta).toEqual({});
    });

    it("invalid_grant e outros erros do serviço são LOGIN_RECUSADO; 5xx, 429 e servidor mudo são SERVICO_FORA", async () => {
      const { login, c } = await cliente({ tempoLimiteMs: 150 });
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "Bad Request" } });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "LOGIN_RECUSADO" });
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "redirect_uri_mismatch" } });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "LOGIN_RECUSADO" });
      login.enfileirar({ kind: "ok", status: 503, corpo: { error: "backend_error" } });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "SERVICO_FORA" });
      login.enfileirar({ kind: "ok", status: 429, corpo: {} });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "SERVICO_FORA" });
      login.enfileirar({ kind: "timeout" });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "SERVICO_FORA" });
    });

    it("resposta sem refresh_token (o Google só o manda com offline e consentimento) é LOGIN_RECUSADO", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "at-1", expires_in: 3599 } });
      await expect(c.trocarCodigo("x", "y")).rejects.toBeInstanceOf(ErroDoLogin);
    });

    it("nenhum erro carrega o código, o verificador, o token nem o segredo do cliente", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "codigo-secreto-9 rt-secreto-9" } });
      const erro = await c.trocarCodigo("codigo-secreto-9", "verificador-secreto-9").catch((e: unknown) => e);
      const texto = mostra(erro);
      for (const segredo of ["codigo-secreto-9", "verificador-secreto-9", "rt-secreto-9", CONFIG.clientSecret]) expect(texto).not.toContain(segredo);
    });
  });

  describe("renovar", () => {
    it("manda grant_type=refresh_token e devolve só o token de acesso: o Google não gira o refresh token", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "at-2", expires_in: 3599, token_type: "Bearer", scope: "https://mail.google.com/" } });
      const nova = await c.renovar("r1");
      expect(nova).toEqual({ accessToken: "at-2", expiraEm: new Date(AGORA + 3599_000).toISOString() });
      expect(nova).not.toHaveProperty("refreshToken");
      const pedido = camposDoPedido(login.recebidas[0]!);
      expect(login.recebidas[0]!.caminho).toBe("/token");
      expect(pedido).toMatchObject({ grant_type: "refresh_token", refresh_token: "r1", client_id: CONFIG.clientId, client_secret: CONFIG.clientSecret });
    });

    it("se um dia vier um refresh token novo, ele é repassado", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "at-2", refresh_token: "r2", expires_in: 3599 } });
      expect(await c.renovar("r1")).toMatchObject({ refreshToken: "r2" });
    });

    it("invalid_grant (os 7 dias do modo de teste, senha trocada, acesso retirado) é recusa PERMANENTE com a frase de produto", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "Token has been expired or revoked." } });
      const erro = await c.renovar("r1").catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroDeRenovacao);
      expect((erro as ErroDeRenovacao).permanente).toBe(true);
      expect((erro as ErroDeRenovacao).frase).toBe(FRASE_GOOGLE_RENOVACAO_PERMANENTE);
      expect(FRASE_GOOGLE_RENOVACAO_PERMANENTE).toBe("A autorização do Google venceu ou foi retirada: entre de novo com o Google.");
    });

    it("500, 503, 429, servidor que não responde no tempo e erro desconhecido são TRANSITÓRIOS", async () => {
      const { login, c } = await cliente({ tempoLimiteMs: 150 });
      login.enfileirar({ kind: "ok", status: 500, corpo: {} });
      login.enfileirar({ kind: "ok", status: 503, corpo: { error: "backend_error" } });
      login.enfileirar({ kind: "ok", status: 429, corpo: { error: "rate_limit_exceeded" } });
      login.enfileirar({ kind: "timeout" });
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "erro_que_ninguem_conhece" } });
      for (let i = 0; i < 5; i += 1) {
        const erro = await c.renovar("r1").catch((e: unknown) => e);
        expect(erro).toBeInstanceOf(ErroDeRenovacao);
        expect((erro as ErroDeRenovacao).permanente).toBe(false);
      }
    });

    it("nenhum erro serializado carrega o refresh token nem o client_secret", async () => {
      const { login, c } = await cliente({ tempoLimiteMs: 150 });
      const erros: unknown[] = [];
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "refresh-antigo-xyz" } });
      login.enfileirar({ kind: "ok", status: 503, corpo: { error_description: "refresh-antigo-xyz" } });
      login.enfileirar({ kind: "timeout" });
      for (let i = 0; i < 3; i += 1) erros.push(await c.renovar("refresh-antigo-xyz").catch((e: unknown) => e));
      const texto = mostra(erros);
      for (const segredo of ["refresh-antigo-xyz", CONFIG.clientSecret]) expect(texto).not.toContain(segredo);
    });
  });

  describe("revogar", () => {
    it("manda um POST de formulário em /revoke só com o token", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 200, corpo: {} });
      await c.revogar!("r1");
      expect(login.recebidas).toHaveLength(1);
      expect(login.recebidas[0]!.metodo).toBe("POST");
      expect(login.recebidas[0]!.caminho).toBe("/revoke");
      expect(login.recebidas[0]!.cabecalhos["content-type"]).toBe("application/x-www-form-urlencoded");
      expect(camposDoPedido(login.recebidas[0]!)).toEqual({ token: "r1" });
    });

    it("400 do Google (token já vencido ou revogado), 5xx e servidor mudo rejeitam com uma frase fixa, sem o token", async () => {
      const { login, c } = await cliente({ tempoLimiteDaRevogacaoMs: 150 });
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_token", error_description: "token-secreto-7" } });
      login.enfileirar({ kind: "ok", status: 503, corpo: {} });
      login.enfileirar({ kind: "timeout" });
      const erros: unknown[] = [];
      for (let i = 0; i < 3; i += 1) erros.push(await c.revogar!("token-secreto-7").catch((e: unknown) => e));
      for (const erro of erros) expect(erro).toBeInstanceOf(Error);
      expect(mostra(erros)).not.toContain("token-secreto-7");
      expect(mostra(erros)).not.toContain(CONFIG.clientSecret);
    });
  });
});

describe("renovadoresDoAmbiente com o Google", () => {
  const REDIRECT = "https://crm.exemplo.test/retorno";
  const fabricas = { google: (config: typeof CONFIG) => criarClienteGoogle(config) };

  it("tem o renovador do Google com o par e a URI de retorno; sem o par, não tem", () => {
    const com = renovadoresDoAmbiente({ redirectUri: REDIRECT, google: { clientId: "g", clientSecret: "s" } }, fabricas);
    expect(typeof com.google).toBe("function");
    expect(com.microsoft).toBeUndefined();
    expect(renovadoresDoAmbiente({ redirectUri: REDIRECT }, fabricas)).toEqual({});
    expect(renovadoresDoAmbiente(undefined, fabricas)).toEqual({});
  });

  it("a fábrica de produção (sem fábricas dadas) também conhece o Google", () => {
    const com = renovadoresDoAmbiente({ redirectUri: REDIRECT, google: { clientId: "g", clientSecret: "s" } });
    expect(Object.keys(com)).toEqual(["google"]);
  });
});
