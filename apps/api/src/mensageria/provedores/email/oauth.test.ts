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

const CONFIG: ConfiguracaoDoOauth = { redirectUri: REDIRECT_URI, microsoft: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } };

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
  async function preparar(rotulo: string, extras: Partial<DependenciasDoEmail> = {}, opcoes: { tokenDaCaixa?: string; usuarioDaCaixa?: string } = {}) {
    const ws = novoEspacoDeTeste(`ms_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_bia", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);

    const caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: opcoes.usuarioDaCaixa ?? ENDERECO, tokens: [opcoes.tokenDaCaixa ?? ACCESS] }] });
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
      },
      servidoresDoLogin: {
        microsoft: { imap: { host: "imap.caixa.teste", porta: caixa.imap.porta }, smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta } },
      },
      agora: () => relogio,
      ...extras,
    });
    const admin = sessao(ws, "mem_admin");
    const canal = valor(await canais.criar(admin, { provedor: "email-imap-smtp", nome: "Vendas", identificador: ENDERECO }));
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

    it("o Google ainda não tem cliente (17-13): autorizar responde 503 sem inventar a URL", async () => {
      const c = await preparar("google", { configuracaoDoOauth: () => ({ ...CONFIG, google: { clientId: "g", clientSecret: "g-secret" } }) });
      expect(recusado(await c.servico.autorizar(c.admin, c.canal.id, "google"))).toMatchObject({ status: 503, codigo: "EMAIL_OAUTH_NAO_CONFIGURADO" });
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
