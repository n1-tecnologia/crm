/**
 * O login da Microsoft para a caixa de e-mail (Fase 17, 17-12) contra o Postgres LOCAL, um servidor de login FALSO
 * (`criarServidorFalso`) e os dublês de IMAP e SMTP de 17-02. Nenhum teste fala com a Microsoft:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55755/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55755/postgres \
 *   npx vitest run src/mensageria/provedores/email/oauth.test.ts
 *
 * Prova: `autorizar` devolve a URL do login com `state` e PKCE S256; `concluir` troca o código no servidor falso (com o
 * verificador que casa com o desafio da URL), PROVA a caixa por XOAUTH2 com `user` = o endereço do Canal, e só então grava; o
 * `state` de outro Membro, de outro Espaço, vencido, adulterado, de outro serviço ou já usado não grava nada; outra conta,
 * consentimento do administrador e serviço sem configuração são recusas com a frase exata; e nenhum código, token ou segredo do
 * cliente aparece numa resposta.
 */

import { createHash, randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MembroDaSessao } from "../../../plugins/autenticacao";
import { encerrar, pool } from "../../../persistencia/conexao";
import { lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { criarAcessoAoCrmPg } from "../../../servicos/crm/acesso";
import { criarServicoDeCanais } from "../../../servicos/crm/canais";
import type { ResultadoCrm } from "../../../servicos/crm/resultado";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../../testes/banco-crm";
import { camposDoPedido, idTokenDeTeste } from "../../../testes/login-oauth-falso";
import { iniciarServidorDeEmailFalso, type ServidorDeEmailFalso } from "../../../testes/servidor-de-email-falso";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import type { ConfiguracaoDoOauth } from "./configuracao";
import { criarServicoDeConexaoDoEmail, type DependenciasDoEmail, type ServicoDeConexaoDoEmail } from "./conexao";
import { TIPO_DA_CREDENCIAL, lerCredencialDoEmail } from "./credencial";
import { assinarEstadoDoEmail } from "./estado";
import { criarFabricaDeConexao } from "./fabrica-de-conexao";
import { criarClienteGoogle } from "./oauth/google";
import { criarClienteMicrosoft } from "./oauth/microsoft";
import { criarPoliticaDeRede, type Resolvedor } from "./rede";
import { contaDoCanal, lerCursor } from "./repositorio";

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const ENDERECO = "vendas@caixa.teste";
const CLIENT_ID = "id-do-app-de-teste";
const CLIENT_SECRET = "segredo-do-app-de-teste-17-12";
const REDIRECT_URI = "https://crm.exemplo.test/crm/caixa-de-entrada/configuracoes/canais/email/retorno";
const CODIGO = "codigo-de-autorizacao-de-teste-17-12";
const ACCESS = "access-token-da-microsoft-17-12";
const REFRESH = "refresh-token-da-microsoft-17-12";
const SEGREDOS = [CLIENT_SECRET, CODIGO, ACCESS, REFRESH];

// Google (17-13): valores só de teste; o servidor de login é o falso, nunca um host do Google.
const G_CLIENT_ID = "id-do-app-google-de-teste";
const G_CLIENT_SECRET = "segredo-do-app-google-de-teste-17-13";
const G_ENDERECO = "pessoa@googlemail.com";
const G_ACCESS = "access-token-do-google-17-13";
const G_REFRESH = "refresh-token-do-google-17-13";
const G_SEGREDOS = [G_CLIENT_SECRET, CODIGO, G_ACCESS, G_REFRESH];

const CONFIG: ConfiguracaoDoOauth = {
  redirectUri: REDIRECT_URI,
  microsoft: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
  google: { clientId: G_CLIENT_ID, clientSecret: G_CLIENT_SECRET },
};

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado<T>(resultado: ResultadoCrm<T>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

/** A resposta do endpoint de token da Microsoft para um código bom. */
const respostaDoToken = (extra: Record<string, unknown> = {}) => ({
  kind: "ok" as const,
  status: 200,
  corpo: {
    token_type: "Bearer",
    access_token: ACCESS,
    refresh_token: REFRESH,
    expires_in: 3599,
    id_token: idTokenDeTeste({ aud: CLIENT_ID, oid: "oid-1", tid: "tid-1", preferred_username: ENDERECO }),
    ...extra,
  },
});

/** A resposta do endpoint de token do Google para um código bom. */
const respostaDoTokenDoGoogle = (extra: Record<string, unknown> = {}, claims: Record<string, unknown> = {}) => ({
  kind: "ok" as const,
  status: 200,
  corpo: {
    token_type: "Bearer",
    access_token: G_ACCESS,
    refresh_token: G_REFRESH,
    expires_in: 3599,
    scope: "openid https://www.googleapis.com/auth/userinfo.email https://mail.google.com/",
    id_token: idTokenDeTeste({ aud: G_CLIENT_ID, sub: "123", email: "pessoa@gmail.com", email_verified: true, ...claims }),
    ...extra,
  },
});

describeComBanco("login da Microsoft — Postgres local, servidor de login falso e dublês de IMAP e SMTP", () => {
  const espacos: string[] = [];
  const caixas: ServidorDeEmailFalso[] = [];
  const logins: ServidorFalso[] = [];
  const acesso = criarAcessoAoCrmPg(pool);
  const canais = criarServicoDeCanais({ pool, acesso });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterEach(async () => {
    while (caixas.length > 0) await caixas.pop()!.fechar();
    while (logins.length > 0) await logins.pop()!.fechar();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  /** Um Espaço com um Canal de e-mail, a caixa falsa (que aceita XOAUTH2 do `ACCESS` para o endereço do Canal) e o login falso. */
  async function preparar(
    rotulo: string,
    extras: Partial<DependenciasDoEmail> = {},
    opcoes: { tokenDaCaixa?: string; usuarioDaCaixa?: string; endereco?: string } = {},
  ) {
    const endereco = opcoes.endereco ?? ENDERECO;
    const ws = novoEspacoDeTeste(`ms_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_bia", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);

    const caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: opcoes.usuarioDaCaixa ?? endereco, tokens: [opcoes.tokenDaCaixa ?? (opcoes.endereco === undefined ? ACCESS : G_ACCESS)] }] });
    caixas.push(caixa);
    const login = await criarServidorFalso();
    logins.push(login);

    const resolver = vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]);
    const fabrica = criarFabricaDeConexao({
      resolver,
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
      ca: caixa.ca,
    });
    let relogio = Date.now();
    const servico: ServicoDeConexaoDoEmail = criarServicoDeConexaoDoEmail({
      pool,
      acesso,
      fabrica,
      chaves: () => CHAVES,
      configuracaoDoOauth: () => CONFIG,
      clientesOauth: {
        microsoft: (config) => criarClienteMicrosoft(config, { autorizacao: `${login.url}/authorize`, token: `${login.url}/token` }),
        google: (config) =>
          criarClienteGoogle(config, { autorizacao: `${login.url}/authorize`, token: `${login.url}/token`, revogacao: `${login.url}/revoke` }),
      },
      servidoresDoLogin: {
        microsoft: { imap: { host: "imap.caixa.teste", porta: caixa.imap.porta }, smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta } },
        // No lugar de imap.gmail.com e smtp.gmail.com: a caixa é o dublê local, nunca um host do Google.
        google: { imap: { host: "imap.caixa.teste", porta: caixa.imap.porta }, smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta } },
      },
      agora: () => relogio,
      ...extras,
    });
    const admin = sessao(ws, "mem_admin");
    const canal = valor(await canais.criar(admin, { provedor: "email-imap-smtp", nome: "Vendas", identificador: endereco }));
    return {
      ws,
      admin,
      outro: sessao(ws, "mem_bia"),
      membro: sessao(ws, "mem_ana"),
      canal,
      servico,
      caixa,
      login,
      avancar: (ms: number) => {
        relogio += ms;
      },
    };
  }

  const canalNoBanco = async (ws: string, id: string) =>
    (await pool().query<{ conexao: string }>("select conexao from plataforma.canais where workspace_id = $1 and id = $2", [ws, id])).rows[0]!;

  const nadaGravado = async (ws: string, canalId: string) => {
    expect(await contaDoCanal(pool(), ws, canalId)).toBeUndefined();
    expect(await lerCursor(pool(), ws, canalId, "INBOX")).toBeUndefined();
    expect(await lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DA_CREDENCIAL })).toBeUndefined();
    expect((await canalNoBanco(ws, canalId)).conexao).toBe("desconectada");
  };

  const estadoDaUrl = (url: string) => new URL(url).searchParams.get("state")!;

  describe("o traçador: autorizar e concluir deixam o Canal conectado", () => {
    it("autorizar devolve a URL do login com o state, o PKCE S256 e o pedido de escopos", async () => {
      const c = await preparar("url");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      const u = new URL(url);
      expect(`${u.origin}${u.pathname}`).toBe(`${c.login.url}/authorize`);
      expect(u.searchParams.get("client_id")).toBe(CLIENT_ID);
      expect(u.searchParams.get("response_type")).toBe("code");
      expect(u.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
      expect(u.searchParams.get("response_mode")).toBe("query");
      expect(u.searchParams.get("code_challenge_method")).toBe("S256");
      expect(u.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(u.searchParams.get("login_hint")).toBe(ENDERECO);
      expect(u.searchParams.get("prompt")).toBe("select_account");
      const escopos = u.searchParams.get("scope")!.split(" ");
      expect(escopos).toEqual(
        expect.arrayContaining(["openid", "email", "profile", "offline_access", "https://outlook.office.com/IMAP.AccessAsUser.All", "https://outlook.office.com/SMTP.Send"]),
      );
      expect(u.searchParams.get("state")).toBeTruthy();
      // O segredo do cliente nunca vai à URL do navegador.
      expect(url).not.toContain(CLIENT_SECRET);
    });

    it("concluir troca o código com o verificador do desafio, prova a caixa por XOAUTH2 e grava credencial, conta e cursor", async () => {
      const c = await preparar("tracador");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      const desafio = new URL(url).searchParams.get("code_challenge")!;
      c.login.enfileirar(respostaDoToken());

      const canal = valor(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));

      expect(canal).toMatchObject({ id: c.canal.id, conexao: "conectada", conexaoSimulada: false });
      expect((await canalNoBanco(c.ws, c.canal.id)).conexao).toBe("conectada");

      // O pedido ao servidor de login: formulário, com o segredo do app e o verificador que casa com o desafio da URL.
      expect(c.login.recebidas).toHaveLength(1);
      const pedido = camposDoPedido(c.login.recebidas[0]!);
      expect(c.login.recebidas[0]!.metodo).toBe("POST");
      expect(c.login.recebidas[0]!.caminho).toBe("/token");
      expect(pedido).toMatchObject({
        grant_type: "authorization_code",
        code: CODIGO,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      });
      expect(createHash("sha256").update(pedido.code_verifier!).digest("base64url")).toBe(desafio);

      // A caixa foi aberta por XOAUTH2 (a prova), no IMAP e no SMTP.
      expect(c.caixa.conexoesImap().length).toBeGreaterThan(0);
      expect(c.caixa.conexoesSmtp().length).toBeGreaterThan(0);

      // O cofre tem a credencial `v: 1` de OAuth, com o usuário = o endereço do Canal.
      const guardada = await lerCredencial(pool(), CHAVES, { workspaceId: c.ws, donoTipo: "canal", donoId: c.canal.id, tipo: TIPO_DA_CREDENCIAL });
      expect(lerCredencialDoEmail(guardada)).toMatchObject({
        v: 1,
        tipo: "oauth",
        servico: "microsoft",
        usuario: ENDERECO,
        refreshToken: REFRESH,
        accessToken: ACCESS,
      });

      const conta = await contaDoCanal(pool(), c.ws, c.canal.id);
      expect(conta).toMatchObject({ endereco: ENDERECO, tipoDeLogin: "microsoft", contaExternaId: "oid-1:tid-1", conectadaPor: "mem_admin", motivoDaQueda: null });
      const cursor = await lerCursor(pool(), c.ws, c.canal.id, "INBOX");
      expect(cursor).toBeDefined();
      expect(cursor!.proximoUid).toBeGreaterThanOrEqual(1);

      // Nenhum segredo nem o código na resposta do serviço.
      const tudo = JSON.stringify({ canal, url });
      for (const segredo of SEGREDOS) expect(tudo).not.toContain(segredo);
    });
  });

  describe("o state", () => {
    it("de outro Membro do mesmo Espaço: 400 ESTADO_INVALIDO, nada gravado e o login nem é chamado", async () => {
      const c = await preparar("outro-membro");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      const r = recusado(await c.servico.concluir(c.outro, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({ status: 400, codigo: "ESTADO_INVALIDO", error: "O pedido de conexão expirou ou não é válido. Comece de novo pelo botão da ficha do Canal." });
      expect(c.login.recebidas).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("de outro Espaço: 400 ESTADO_INVALIDO e nada gravado", async () => {
      const c = await preparar("outro-espaco");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      const intruso = await preparar("intruso");
      const r = recusado(await intruso.servico.concluir(sessao(intruso.ws, "mem_admin"), { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({ status: 400, codigo: "ESTADO_INVALIDO" });
      expect(intruso.login.recebidas).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
      await nadaGravado(intruso.ws, intruso.canal.id);
    });

    it("com mais de 10 minutos: 400 ESTADO_INVALIDO e nada gravado", async () => {
      const c = await preparar("vencido");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.avancar(10 * 60_000 + 1);
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({ status: 400, codigo: "ESTADO_INVALIDO" });
      expect(c.login.recebidas).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("adulterado em um caractere: 400 ESTADO_INVALIDO e nada gravado", async () => {
      const c = await preparar("adulterado");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      const state = estadoDaUrl(url);
      const adulterado = `${state.slice(0, 5)}${state[5] === "A" ? "B" : "A"}${state.slice(6)}`;
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: adulterado }));
      expect(r).toMatchObject({ status: 400, codigo: "ESTADO_INVALIDO" });
      expect(c.login.recebidas).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("assinado com o segredo do Google e marcado microsoft: 400 ESTADO_INVALIDO", async () => {
      const c = await preparar("outro-servico");
      const doGoogle = assinarEstadoDoEmail("segredo-do-google-de-teste", { workspaceId: c.ws, canalId: c.canal.id, membroId: "mem_admin", servico: "microsoft" });
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: doGoogle }));
      expect(r).toMatchObject({ status: 400, codigo: "ESTADO_INVALIDO" });
      expect(c.login.recebidas).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("vale uma vez: o mesmo state na segunda volta é recusado e o login só é chamado na primeira", async () => {
      const c = await preparar("uso-unico");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      const state = estadoDaUrl(url);
      c.login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "AADSTS70008: o código expirou" } });
      recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state }));
      expect(c.login.recebidas).toHaveLength(1);

      c.login.enfileirar(respostaDoToken());
      const segunda = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state }));
      expect(segunda).toMatchObject({ status: 400, codigo: "ESTADO_INVALIDO" });
      expect(c.login.recebidas).toHaveLength(1);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("o state de outra pessoa não queima o de quem pediu (o uso só vale depois de conferir de quem é)", async () => {
      const c = await preparar("nao-queima");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      recusado(await c.servico.concluir(c.outro, { codigo: CODIGO, state: estadoDaUrl(url) }));
      c.login.enfileirar(respostaDoToken());
      const canal = valor(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(canal.conexao).toBe("conectada");
    });
  });

  describe("a prova da conta", () => {
    it("id_token de outra conta: 409 CONTA_DIFERENTE com a frase exata e nada gravado (a caixa nem é aberta)", async () => {
      const c = await preparar("outra-conta");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.login.enfileirar(
        respostaDoToken({ id_token: idTokenDeTeste({ aud: CLIENT_ID, oid: "oid-9", tid: "tid-9", preferred_username: "outra@empresa.com" }) }),
      );
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({
        status: 409,
        codigo: "CONTA_DIFERENTE",
        error: "Você entrou com outra@empresa.com, mas este Canal é da caixa vendas@caixa.teste. Entre com a conta da própria caixa.",
      });
      expect(c.caixa.conexoesImap()).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("id_token sem e-mail, mas a caixa recusa o XOAUTH2 do token para o endereço do Canal: 409 CONTA_DIFERENTE e nada gravado", async () => {
      // A caixa falsa só aceita o token de OUTRA conta: o token que o login devolveu não abre a caixa do Canal.
      const c = await preparar("caixa-recusa", {}, { usuarioDaCaixa: "outra@empresa.com" });
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.login.enfileirar(respostaDoToken({ id_token: idTokenDeTeste({ aud: CLIENT_ID, oid: "oid-1", tid: "tid-1" }) }));
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({
        status: 409,
        codigo: "CONTA_DIFERENTE",
        error:
          "A conta que entrou não tem acesso à caixa vendas@caixa.teste. Entre com a conta da própria caixa e confira se o IMAP e o SMTP autenticado estão ligados para ela.",
      });
      await nadaGravado(c.ws, c.canal.id);
    });

    it("o id_token com o e-mail certo NÃO basta: a caixa que recusa o token impede a gravação (a prova é o XOAUTH2)", async () => {
      const c = await preparar("id-token-mente", {}, { tokenDaCaixa: "outro-token-que-a-caixa-conhece" });
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.login.enfileirar(respostaDoToken());
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({ status: 409, codigo: "CONTA_DIFERENTE" });
      await nadaGravado(c.ws, c.canal.id);
    });

    it("id_token de outro cliente (aud errada) é ignorado como pré-conferência; a caixa decide", async () => {
      const c = await preparar("aud-errada");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.login.enfileirar(respostaDoToken({ id_token: idTokenDeTeste({ aud: "outro-app", oid: "oid-9", tid: "tid-9", preferred_username: "outra@empresa.com" }) }));
      const canal = valor(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(canal.conexao).toBe("conectada");
      // Sem id_token confiável, o id estável não é gravado.
      expect((await contaDoCanal(pool(), c.ws, c.canal.id))!.contaExternaId).toBeNull();
    });
  });

  describe("as recusas do serviço de login", () => {
    it("AADSTS65001 na troca do código: 409 CONSENTIMENTO_DO_ADMINISTRADOR e nada gravado", async () => {
      const c = await preparar("admin");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "AADSTS65001: The user or administrator has not consented to use the application." } });
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({
        status: 409,
        codigo: "CONSENTIMENTO_DO_ADMINISTRADOR",
        error: "A sua organização exige que um administrador aprove o aplicativo antes de você entrar.",
      });
      await nadaGravado(c.ws, c.canal.id);
    });

    it("código recusado (invalid_grant comum): 422 LOGIN_RECUSADO; serviço fora (503): 502 SERVICO_DE_LOGIN_FORA; nada gravado", async () => {
      const c = await preparar("recusado");
      const um = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: "AADSTS70008: expired" } });
      expect(recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(um.url) }))).toMatchObject({ status: 422, codigo: "LOGIN_RECUSADO" });

      const dois = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.login.enfileirar({ kind: "ok", status: 503, corpo: { error: "temporarily_unavailable" } });
      expect(recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(dois.url) }))).toMatchObject({ status: 502, codigo: "SERVICO_DE_LOGIN_FORA" });
      await nadaGravado(c.ws, c.canal.id);
    });

    it("sem o MICROSOFT_OAUTH_CLIENT_ID na configuração: autorizar responde 503 EMAIL_OAUTH_NAO_CONFIGURADO com o NOME das variáveis", async () => {
      const c = await preparar("sem-config", { configuracaoDoOauth: () => ({ redirectUri: REDIRECT_URI }) });
      const r = recusado(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      expect(r).toMatchObject({
        status: 503,
        codigo: "EMAIL_OAUTH_NAO_CONFIGURADO",
        error: "Falta no servidor: MICROSOFT_OAUTH_CLIENT_ID, MICROSOFT_OAUTH_CLIENT_SECRET.",
      });
      expect(JSON.stringify(r)).not.toContain(CLIENT_SECRET);
    });

    it("sem a configuração inteira, autorizar diz o que falta pelo ambiente (só os nomes)", async () => {
      const c = await preparar("sem-nada", { configuracaoDoOauth: () => undefined, ambiente: () => ({}) });
      const r = recusado(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      expect(r).toMatchObject({ status: 503, codigo: "EMAIL_OAUTH_NAO_CONFIGURADO" });
      expect(r.error).toBe("Falta no servidor: EMAIL_OAUTH_REDIRECT_URI, MICROSOFT_OAUTH_CLIENT_ID, MICROSOFT_OAUTH_CLIENT_SECRET.");
    });

    it("sem o cofre, autorizar responde 503 antes de a pessoa entrar no serviço", async () => {
      const c = await preparar("sem-cofre", {
        chaves: () => {
          throw new Error("sem COFRE_CHAVE");
        },
      });
      expect(recusado(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"))).toMatchObject({ status: 503, codigo: "COFRE_NAO_CONFIGURADO" });
    });

    it("Membro sem permissão de conectar: 403; Canal de outro Espaço: 404", async () => {
      const c = await preparar("permissao");
      expect(recusado(await c.servico.autorizar(c.membro, c.canal.id, "microsoft"))).toMatchObject({ status: 403 });
      const outro = await preparar("permissao-outro");
      expect(recusado(await c.servico.autorizar(sessao(outro.ws, "mem_admin"), c.canal.id, "microsoft"))).toMatchObject({ status: 404 });
    });

    it("reconectar (Canal já conectado pela Microsoft) troca a credencial e mantém uma conta só", async () => {
      const c = await preparar("reconectar");
      for (let vez = 0; vez < 2; vez += 1) {
        const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
        c.login.enfileirar(respostaDoToken({ refresh_token: `${REFRESH}-${vez}` }));
        expect(valor(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) })).conexao).toBe("conectada");
      }
      const guardada = await lerCredencial(pool(), CHAVES, { workspaceId: c.ws, donoTipo: "canal", donoId: c.canal.id, tipo: TIPO_DA_CREDENCIAL });
      expect(lerCredencialDoEmail(guardada)).toMatchObject({ refreshToken: `${REFRESH}-1` });
    });
  });

  describe("o login do Google (17-13)", () => {
    const g = (rotulo: string, extras: Partial<DependenciasDoEmail> = {}, opcoes: { tokenDaCaixa?: string; usuarioDaCaixa?: string } = {}) =>
      preparar(rotulo, extras, { endereco: G_ENDERECO, ...opcoes });

    it("Google: autorizar devolve a URL do login com os escopos, access_type=offline, prompt=consent, login_hint, state e PKCE S256", async () => {
      const c = await g("g-url");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      const u = new URL(url);
      expect(`${u.origin}${u.pathname}`).toBe(`${c.login.url}/authorize`);
      expect(u.searchParams.get("client_id")).toBe(G_CLIENT_ID);
      expect(u.searchParams.get("response_type")).toBe("code");
      expect(u.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
      expect(u.searchParams.get("scope")!.split(" ")).toEqual(["openid", "email", "https://mail.google.com/"]);
      expect(u.searchParams.get("access_type")).toBe("offline");
      expect(u.searchParams.get("prompt")).toBe("consent");
      expect(u.searchParams.get("login_hint")).toBe(G_ENDERECO);
      expect(u.searchParams.get("code_challenge_method")).toBe("S256");
      expect(u.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(u.searchParams.get("state")).toBeTruthy();
      // Nem o segredo do Google nem o da Microsoft vão à URL do navegador.
      expect(url).not.toContain(G_CLIENT_SECRET);
      expect(url).not.toContain(CLIENT_SECRET);
    });

    it("Google: concluir com e-mail verificado (googlemail x gmail) prova a caixa por XOAUTH2 e deixa o Canal conectado, com o sub como conta externa", async () => {
      const c = await g("g-tracador");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      const desafio = new URL(url).searchParams.get("code_challenge")!;
      c.login.enfileirar(respostaDoTokenDoGoogle());

      const canal = valor(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));

      expect(canal).toMatchObject({ id: c.canal.id, conexao: "conectada", conexaoSimulada: false, identificadorExterno: G_ENDERECO });
      expect((await canalNoBanco(c.ws, c.canal.id)).conexao).toBe("conectada");

      const pedido = camposDoPedido(c.login.recebidas[0]!);
      expect(c.login.recebidas).toHaveLength(1);
      expect(c.login.recebidas[0]!.caminho).toBe("/token");
      expect(pedido).toMatchObject({
        grant_type: "authorization_code",
        code: CODIGO,
        redirect_uri: REDIRECT_URI,
        client_id: G_CLIENT_ID,
        client_secret: G_CLIENT_SECRET,
      });
      expect(createHash("sha256").update(pedido.code_verifier!).digest("base64url")).toBe(desafio);

      // A prova: a caixa foi aberta por XOAUTH2 no IMAP e no SMTP com o endereço do Canal.
      expect(c.caixa.conexoesImap().length).toBeGreaterThan(0);
      expect(c.caixa.conexoesSmtp().length).toBeGreaterThan(0);

      const guardada = await lerCredencial(pool(), CHAVES, { workspaceId: c.ws, donoTipo: "canal", donoId: c.canal.id, tipo: TIPO_DA_CREDENCIAL });
      expect(lerCredencialDoEmail(guardada)).toMatchObject({ v: 1, tipo: "oauth", servico: "google", usuario: G_ENDERECO, refreshToken: G_REFRESH, accessToken: G_ACCESS });
      const conta = await contaDoCanal(pool(), c.ws, c.canal.id);
      expect(conta).toMatchObject({ endereco: G_ENDERECO, tipoDeLogin: "google", contaExternaId: "123", conectadaPor: "mem_admin", motivoDaQueda: null });
      expect(await lerCursor(pool(), c.ws, c.canal.id, "INBOX")).toBeDefined();

      const tudo = JSON.stringify({ canal, url });
      for (const segredo of G_SEGREDOS) expect(tudo).not.toContain(segredo);
    });

    it("Google: email_verified falso responde 409 CONTA_DIFERENTE, a caixa nem é aberta e nada é gravado", async () => {
      const c = await g("g-nao-verificado");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      c.login.enfileirar(respostaDoTokenDoGoogle({}, { email: G_ENDERECO, email_verified: false }));
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({ status: 409, codigo: "CONTA_DIFERENTE" });
      expect(r.error).toContain("não confirmou");
      expect(c.caixa.conexoesImap()).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("Google: email_verified ausente também não vale (a ausência é não verificado)", async () => {
      const c = await g("g-sem-campo");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      const { email_verified: _fora, ...semCampo } = { aud: G_CLIENT_ID, sub: "123", email: G_ENDERECO, email_verified: true };
      c.login.enfileirar(respostaDoTokenDoGoogle({ id_token: idTokenDeTeste(semCampo) }));
      expect(recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }))).toMatchObject({ status: 409, codigo: "CONTA_DIFERENTE" });
      expect(c.caixa.conexoesImap()).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("Google: e-mail verificado de OUTRA caixa responde 409 CONTA_DIFERENTE com a frase exata e nada é gravado", async () => {
      const c = await g("g-outra-caixa");
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      c.login.enfileirar(respostaDoTokenDoGoogle({}, { email: "outra@gmail.com", email_verified: true }));
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({
        status: 409,
        codigo: "CONTA_DIFERENTE",
        error: `Você entrou com outra@gmail.com, mas este Canal é da caixa ${G_ENDERECO}. Entre com a conta da própria caixa.`,
      });
      expect(c.caixa.conexoesImap()).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("Google: o e-mail em maiúsculas e com googlemail.com no lugar de gmail.com é a mesma caixa", async () => {
      const c = await preparar("g-forma", {}, { endereco: "pessoa@gmail.com", tokenDaCaixa: G_ACCESS });
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      c.login.enfileirar(respostaDoTokenDoGoogle({}, { email: "Pessoa@GoogleMail.com", email_verified: true }));
      expect(valor(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) })).conexao).toBe("conectada");
    });

    it("Google: o id_token com e-mail verificado NÃO basta, a caixa que recusa o token impede a gravação (a prova é o XOAUTH2)", async () => {
      const c = await g("g-id-token-mente", {}, { tokenDaCaixa: "outro-token-que-a-caixa-conhece" });
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      c.login.enfileirar(respostaDoTokenDoGoogle());
      const r = recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      expect(r).toMatchObject({ status: 409, codigo: "CONTA_DIFERENTE" });
      await nadaGravado(c.ws, c.canal.id);
    });

    it("Google: state assinado com o segredo da Microsoft e marcado google é recusado (400 ESTADO_INVALIDO)", async () => {
      const c = await g("g-estado");
      const falso = assinarEstadoDoEmail(CLIENT_SECRET, { workspaceId: c.ws, canalId: c.canal.id, membroId: "mem_admin", servico: "google" });
      expect(recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: falso }))).toMatchObject({ status: 400, codigo: "ESTADO_INVALIDO" });
      expect(c.login.recebidas).toHaveLength(0);
      await nadaGravado(c.ws, c.canal.id);
    });

    it("Google: código recusado 422 LOGIN_RECUSADO, serviço fora 502, resposta sem refresh_token 422; nada gravado", async () => {
      const c = await g("g-recusas");
      const um = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      c.login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: `Bad Request ${CODIGO}` } });
      expect(recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(um.url) }))).toMatchObject({ status: 422, codigo: "LOGIN_RECUSADO" });

      const dois = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      c.login.enfileirar({ kind: "ok", status: 503, corpo: { error: "backend_error" } });
      expect(recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(dois.url) }))).toMatchObject({ status: 502, codigo: "SERVICO_DE_LOGIN_FORA" });

      const tres = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      const { refresh_token: _fora, ...semRefresh } = respostaDoTokenDoGoogle().corpo;
      c.login.enfileirar({ kind: "ok", status: 200, corpo: semRefresh });
      expect(recusado(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(tres.url) }))).toMatchObject({ status: 422, codigo: "LOGIN_RECUSADO" });
      await nadaGravado(c.ws, c.canal.id);
    });

    it("Google: sem o par GOOGLE_OAUTH_* autorizar responde 503 com o NOME das variáveis, nunca valores", async () => {
      const c = await g("g-sem-config", { configuracaoDoOauth: () => ({ redirectUri: REDIRECT_URI, microsoft: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } }) });
      const r = recusado(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      expect(r).toMatchObject({ status: 503, codigo: "EMAIL_OAUTH_NAO_CONFIGURADO", error: "Falta no servidor: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET." });
      expect(JSON.stringify(r)).not.toContain(CLIENT_SECRET);
    });

    it("Google: nenhuma resposta de nenhum caso leva o código, os tokens nem o segredo do cliente", async () => {
      const c = await g("g-sigilo");
      const respostas: unknown[] = [];
      const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      respostas.push(url);
      c.login.enfileirar(respostaDoTokenDoGoogle({}, { email: "outra@gmail.com", email_verified: true }));
      respostas.push(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
      for (const corpo of [
        { status: 400, corpo: { error: "invalid_grant", error_description: `${CODIGO} ${G_REFRESH}` } },
        { status: 500, corpo: { error: "server_error", error_description: G_ACCESS } },
      ]) {
        const novo = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
        c.login.enfileirar({ kind: "ok", ...corpo });
        respostas.push(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(novo.url) }));
      }
      const feliz = valor(await c.servico.autorizar(c.admin, c.canal.id, "google"));
      c.login.enfileirar(respostaDoTokenDoGoogle());
      respostas.push(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(feliz.url) }));
      respostas.push(await c.servico.conta(c.admin, c.canal.id));
      const tudo = JSON.stringify(respostas);
      for (const segredo of G_SEGREDOS) expect(tudo).not.toContain(segredo);
    });
  });

  it("nenhuma resposta de nenhum caso leva o código, os tokens nem o segredo do cliente", async () => {
    const c = await preparar("sigilo");
    const respostas: unknown[] = [];
    const { url } = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
    respostas.push(url);
    // Id token de outra conta, consentimento, código recusado, serviço fora, e o caso feliz.
    c.login.enfileirar(respostaDoToken({ id_token: idTokenDeTeste({ aud: CLIENT_ID, preferred_username: "outra@empresa.com" }) }));
    respostas.push(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(url) }));
    for (const corpo of [
      { status: 400, corpo: { error: "invalid_grant", error_description: `AADSTS65001 ${CODIGO} ${REFRESH}` } },
      { status: 400, corpo: { error: "invalid_request", error_description: `${CODIGO} ${ACCESS}` } },
      { status: 500, corpo: { error: "server_error", error_description: `${REFRESH}` } },
    ]) {
      const novo = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
      c.login.enfileirar({ kind: "ok", ...corpo });
      respostas.push(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(novo.url) }));
    }
    const feliz = valor(await c.servico.autorizar(c.admin, c.canal.id, "microsoft"));
    c.login.enfileirar(respostaDoToken());
    respostas.push(await c.servico.concluir(c.admin, { codigo: CODIGO, state: estadoDaUrl(feliz.url) }));
    respostas.push(await c.servico.conta(c.admin, c.canal.id));

    const tudo = JSON.stringify(respostas);
    for (const segredo of SEGREDOS) expect(tudo).not.toContain(segredo);
  });
});
