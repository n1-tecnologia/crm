/**
 * O cliente do login da Microsoft (Fase 17, 17-12) contra o servidor HTTP FALSO (`criarServidorFalso`): nenhum teste chama a
 * Microsoft. Sem banco.
 *
 * Prova: a URL do login; a troca do código (formulário, segredo, verificador, id_token lido); a renovação com rotação do
 * refresh token; a classificação permanente x transitória do erro de renovação; o consentimento do administrador; e que
 * nenhum erro serializado carrega o token, o código nem o segredo do cliente.
 */

import { afterEach, describe, expect, it } from "vitest";
import { ErroDeRenovacao } from "../credencial";
import { camposDoPedido, idTokenDeTeste } from "../../../../testes/login-oauth-falso";
import { criarServidorFalso, type ServidorFalso } from "../../../../testes/servidor-falso";
import { ErroDoLogin, lerIdToken } from "./comum";
import { ENDERECOS_DA_MICROSOFT, ESCOPOS_MICROSOFT, criarClienteMicrosoft, FRASE_MICROSOFT_RENOVACAO_PERMANENTE } from "./microsoft";

const CONFIG = { clientId: "id-do-app-de-teste", clientSecret: "segredo-do-app-de-teste", redirectUri: "https://crm.exemplo.test/retorno" };
const AGORA = Date.parse("2026-11-19T12:00:00.000Z");

describe("criarClienteMicrosoft", () => {
  const servidores: ServidorFalso[] = [];
  afterEach(async () => {
    while (servidores.length > 0) await servidores.pop()!.fechar();
  });

  async function cliente(opcoes: { tempoLimiteMs?: number } = {}) {
    const login = await criarServidorFalso();
    servidores.push(login);
    const c = criarClienteMicrosoft(CONFIG, { autorizacao: `${login.url}/authorize`, token: `${login.url}/token` }, { agora: () => AGORA, ...opcoes });
    return { login, c };
  }

  const mostra = (erro: unknown) => JSON.stringify(erro, (_k, v: unknown) => (v instanceof Error ? { ...v, name: v.name, message: v.message, stack: v.stack } : v));

  it("os endereços de produção são os da autoridade common e os escopos pedem IMAP e SMTP do Exchange Online", () => {
    expect(ENDERECOS_DA_MICROSOFT.autorizacao).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(ENDERECOS_DA_MICROSOFT.token).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/token");
    expect(ESCOPOS_MICROSOFT).toContain("offline_access");
    expect(ESCOPOS_MICROSOFT).toContain("https://outlook.office.com/IMAP.AccessAsUser.All");
    expect(ESCOPOS_MICROSOFT).toContain("https://outlook.office.com/SMTP.Send");
  });

  it("a URL do login leva state, PKCE S256, login_hint e a URI de retorno, e nunca o segredo do cliente", async () => {
    const { c } = await cliente();
    const url = new URL(c.urlDeAutorizacao({ state: "state-1", desafio: "d".repeat(43), loginHint: "vendas@caixa.teste" }));
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("code_challenge")).toBe("d".repeat(43));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("login_hint")).toBe("vendas@caixa.teste");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.toString()).not.toContain(CONFIG.clientSecret);
  });

  describe("trocarCodigo", () => {
    it("manda o formulário certo e devolve os tokens, o vencimento e a conta do id_token (oid:tid)", async () => {
      const { login, c } = await cliente();
      login.enfileirar({
        kind: "ok",
        status: 200,
        corpo: {
          access_token: "at-1",
          refresh_token: "rt-1",
          expires_in: 3599,
          id_token: idTokenDeTeste({ aud: CONFIG.clientId, oid: "oid-1", tid: "tid-1", preferred_username: "vendas@caixa.teste" }),
        },
      });
      const tokens = await c.trocarCodigo("codigo-1", "verificador-1");
      expect(tokens).toEqual({
        accessToken: "at-1",
        refreshToken: "rt-1",
        expiraEm: new Date(AGORA + 3599_000).toISOString(),
        conta: { email: "vendas@caixa.teste", idEstavel: "oid-1:tid-1" },
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

    it("AADSTS65001 e consent_required viram CONSENTIMENTO_DO_ADMINISTRADOR", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "AADSTS65001: sem consentimento" } });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "CONSENTIMENTO_DO_ADMINISTRADOR" });
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "consent_required" } });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "CONSENTIMENTO_DO_ADMINISTRADOR" });
    });

    it("outro erro do serviço é LOGIN_RECUSADO; 5xx, 429 e servidor mudo são SERVICO_FORA", async () => {
      const { login, c } = await cliente({ tempoLimiteMs: 150 });
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "AADSTS70008: expirou" } });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "LOGIN_RECUSADO" });
      login.enfileirar({ kind: "ok", status: 503, corpo: { error: "temporarily_unavailable" } });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "SERVICO_FORA" });
      login.enfileirar({ kind: "ok", status: 429, corpo: {} });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "SERVICO_FORA" });
      login.enfileirar({ kind: "timeout" });
      await expect(c.trocarCodigo("x", "y")).rejects.toMatchObject({ codigo: "SERVICO_FORA" });
    });

    it("resposta sem refresh_token (offline_access não concedido) é LOGIN_RECUSADO", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "at-1", expires_in: 3599 } });
      await expect(c.trocarCodigo("x", "y")).rejects.toBeInstanceOf(ErroDoLogin);
    });

    it("nenhum erro carrega o código, o verificador, o token nem o segredo do cliente", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "AADSTS65001 codigo-secreto-9 rt-secreto-9" } });
      const erro = await c.trocarCodigo("codigo-secreto-9", "verificador-secreto-9").catch((e: unknown) => e);
      const texto = mostra(erro);
      for (const segredo of ["codigo-secreto-9", "verificador-secreto-9", "rt-secreto-9", CONFIG.clientSecret]) expect(texto).not.toContain(segredo);
    });
  });

  describe("renovar", () => {
    it("manda grant_type=refresh_token com os escopos e devolve o refresh token NOVO (rotação)", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "at-2", refresh_token: "r2", expires_in: 3599 } });
      const nova = await c.renovar("r1");
      expect(nova).toEqual({ accessToken: "at-2", refreshToken: "r2", expiraEm: new Date(AGORA + 3599_000).toISOString() });
      const pedido = camposDoPedido(login.recebidas[0]!);
      expect(pedido).toMatchObject({ grant_type: "refresh_token", refresh_token: "r1", client_id: CONFIG.clientId, client_secret: CONFIG.clientSecret });
      expect(pedido.scope!.split(" ")).toEqual([...ESCOPOS_MICROSOFT]);
    });

    it("sem refresh_token na resposta, não inventa um (o antigo continua valendo)", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "at-2", expires_in: 3599 } });
      expect(await c.renovar("r1")).toEqual({ accessToken: "at-2", expiraEm: new Date(AGORA + 3599_000).toISOString() });
    });

    it.each(["invalid_grant", "interaction_required", "consent_required", "invalid_client"])("%s (400) é recusa PERMANENTE com a frase de produto", async (codigo) => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: codigo, error_description: "AADSTS700082: refresh token r1 expirou" } });
      const erro = await c.renovar("r1").catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroDeRenovacao);
      expect((erro as ErroDeRenovacao).permanente).toBe(true);
      expect((erro as ErroDeRenovacao).frase).toBe(FRASE_MICROSOFT_RENOVACAO_PERMANENTE);
      expect(FRASE_MICROSOFT_RENOVACAO_PERMANENTE).toBe("A autorização da Microsoft venceu ou foi retirada: entre de novo com a Microsoft.");
    });

    it("503, temporarily_unavailable, 429 e servidor que não responde no tempo são TRANSITÓRIOS", async () => {
      const { login, c } = await cliente({ tempoLimiteMs: 150 });
      login.enfileirar({ kind: "ok", status: 503, corpo: {} });
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "temporarily_unavailable" } });
      login.enfileirar({ kind: "ok", status: 429, corpo: { error: "too_many_requests" } });
      login.enfileirar({ kind: "timeout" });
      for (let i = 0; i < 4; i += 1) {
        const erro = await c.renovar("r1").catch((e: unknown) => e);
        expect(erro).toBeInstanceOf(ErroDeRenovacao);
        expect((erro as ErroDeRenovacao).permanente).toBe(false);
      }
    });

    it("um erro desconhecido NÃO derruba a conexão (transitório)", async () => {
      const { login, c } = await cliente();
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "erro_que_ninguem_conhece" } });
      expect(((await c.renovar("r1").catch((e: unknown) => e)) as ErroDeRenovacao).permanente).toBe(false);
    });

    it("nenhum erro serializado carrega o refresh token (antigo ou novo) nem o client_secret", async () => {
      const { login, c } = await cliente({ tempoLimiteMs: 150 });
      const erros: unknown[] = [];
      login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "refresh refresh-antigo-xyz refresh-novo-xyz" } });
      login.enfileirar({ kind: "ok", status: 503, corpo: { error_description: "refresh-antigo-xyz refresh-novo-xyz" } });
      login.enfileirar({ kind: "timeout" });
      for (let i = 0; i < 3; i += 1) erros.push(await c.renovar("refresh-antigo-xyz").catch((e: unknown) => e));
      const texto = mostra(erros);
      for (const segredo of ["refresh-antigo-xyz", "refresh-novo-xyz", CONFIG.clientSecret]) expect(texto).not.toContain(segredo);
    });

    it("a Microsoft não tem revogação por token (A9): o cliente não oferece `revogar`", async () => {
      const { c } = await cliente();
      expect(c.revogar).toBeUndefined();
    });
  });
});

describe("lerIdToken", () => {
  const agora = AGORA;
  const exp = AGORA / 1000 + 3600;

  it("lê e-mail (ou preferred_username) e o id estável de um token da audiência certa", () => {
    const token = idTokenDeTeste({ aud: "app", exp, email: "a@b.com", oid: "o", tid: "t", sub: "s" });
    expect(lerIdToken(token, { clientId: "app", agora })).toEqual({ email: "a@b.com", oid: "o", tid: "t", sub: "s" });
    expect(lerIdToken(idTokenDeTeste({ aud: "app", exp, preferred_username: "u@b.com" }), { clientId: "app", agora })).toEqual({ email: "u@b.com" });
  });

  it("recusa (undefined) audiência errada, token vencido, forma de JWT errada e ausência", () => {
    expect(lerIdToken(idTokenDeTeste({ aud: "outro", exp }), { clientId: "app", agora })).toBeUndefined();
    expect(lerIdToken(idTokenDeTeste({ aud: "app", exp: AGORA / 1000 - 1 }), { clientId: "app", agora })).toBeUndefined();
    expect(lerIdToken("nao-e-jwt", { clientId: "app", agora })).toBeUndefined();
    expect(lerIdToken("a.b", { clientId: "app", agora })).toBeUndefined();
    expect(lerIdToken("a.@@@.c", { clientId: "app", agora })).toBeUndefined();
    expect(lerIdToken(undefined, { clientId: "app", agora })).toBeUndefined();
  });

  it("preferred_username que não parece endereço não vira e-mail", () => {
    expect(lerIdToken(idTokenDeTeste({ aud: "app", exp, preferred_username: "usuario-sem-arroba" }), { clientId: "app", agora })).toEqual({});
  });
});
