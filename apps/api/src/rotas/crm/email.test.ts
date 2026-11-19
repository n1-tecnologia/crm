/**
 * As rotas da conexão do e-mail (Fase 17, 17-05).
 *
 *   1. SEM banco (serviço falso injetado por `buildApp({ crm: { email } })`): a sessão é exigida, o corpo é validado
 *      (`.strict()`, predefinição OU os dois servidores) e a senha entra só pelo corpo do `conectar`.
 *   2. COM o Postgres local e os dublês de IMAP e SMTP: o serviço real atrás da rota, com o logger de PRODUÇÃO
 *      (`opcoesDoLogger`) capturado num `stream` de teste. A senha não aparece no log da requisição nem em nenhuma resposta
 *      (T-17-19), a ficha lê a conta sem segredo e a Microsoft só vira botão com as variáveis e a URI no ambiente.
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal } from "@n1/dominio/crm/canais";
import { buildApp } from "../../app";
import { criarFabricaDeConexao } from "../../mensageria/provedores/email/fabrica-de-conexao";
import { criarServicoDeConexaoDoEmail, type ServicoDeConexaoDoEmail } from "../../mensageria/provedores/email/conexao";
import { lerConfiguracaoDoOauth, type ConfiguracaoDoOauth } from "../../mensageria/provedores/email/configuracao";
import { criarPoliticaDeRede, type Resolvedor } from "../../mensageria/provedores/email/rede";
import { opcoesDoLogger } from "../../observabilidade/log";
import { encerrar, pool } from "../../persistencia/conexao";
import type { ChavesDoCofre } from "../../servicos/cofre";
import { criarAcessoAoCrmPg } from "../../servicos/crm/acesso";
import { criarServicoDeCanais } from "../../servicos/crm/canais";
import { sucesso } from "../../servicos/crm/resultado";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { camposDoPedido, idTokenDeTeste } from "../../testes/login-oauth-falso";
import { iniciarServidorDeEmailFalso, type ServidorDeEmailFalso } from "../../testes/servidor-de-email-falso";
import { criarServidorFalso, type ServidorFalso } from "../../testes/servidor-falso";
import { criarClienteMicrosoft } from "../../mensageria/provedores/email/oauth/microsoft";

const MARYANE = usuarioDoSeed("mem_maryane");
const membros = buildSeed().members;
const AUTORIZACAO = { authorization: "Bearer token-maryane" };
const SENHA = "senha-de-app-secreta-17-05";
const USUARIO = "vendas@caixa.teste";

const corpoBom = {
  usuario: USUARIO,
  senha: SENHA,
  imap: { host: "imap.caixa.teste", porta: 993 },
  smtp: { host: "smtp.caixa.teste", porta: 465 },
};

function novoApp() {
  const chamadas: unknown[][] = [];
  const servico: ServicoDeConexaoDoEmail = {
    autorizar: (...a) => {
      chamadas.push(["autorizar", ...a]);
      return Promise.resolve(sucesso({ url: "https://login.exemplo.test/autorizar?state=abc" }));
    },
    concluir: (...a) => {
      chamadas.push(["concluir", ...a]);
      return Promise.resolve(sucesso({ id: "canal_1", conexao: "conectada" } as Canal));
    },
    conectarPorSenha: (...a) => {
      chamadas.push(["conectarPorSenha", ...a]);
      return Promise.resolve(sucesso({ id: "canal_1", conexao: "conectada" } as Canal));
    },
    conta: (...a) => {
      chamadas.push(["conta", ...a]);
      return Promise.resolve(sucesso({ conta: null, servicosDisponiveis: { google: false, microsoft: false } }));
    },
  };
  const app = buildApp({
    logger: false,
    workspaceId: "ws_rota_email",
    verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId: string, userId: string) => membros.find((m) => m.userId === userId),
    crm: { email: servico },
  });
  return { app, chamadas };
}

const conectar = (app: ReturnType<typeof novoApp>["app"], payload: unknown, headers: Record<string, string> = AUTORIZACAO) =>
  app.inject({ method: "POST", url: "/canais/canal_1/email/conectar", headers, payload: payload as object });

describe("POST /canais/:id/email/conectar", () => {
  it("exige a sessão: sem Authorization, 401 e o serviço nem é chamado", async () => {
    const { app, chamadas } = novoApp();
    expect((await conectar(app, corpoBom, {})).statusCode).toBe(401);
    expect(chamadas).toEqual([]);
  });

  it("passa o Membro da sessão, o id do Canal e o corpo ao serviço, e responde com o Canal sem repetir a senha", async () => {
    const { app, chamadas } = novoApp();
    const resposta = await conectar(app, corpoBom);
    expect(resposta.statusCode).toBe(200);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]![0]).toBe("conectarPorSenha");
    expect(chamadas[0]![1]).toMatchObject({ workspaceId: "ws_rota_email" });
    expect(chamadas[0]![2]).toBe("canal_1");
    expect(chamadas[0]![3]).toEqual(corpoBom);
    expect(resposta.body).not.toContain(SENHA);
  });

  it("aceita a predefinição sem servidores", async () => {
    const { app, chamadas } = novoApp();
    const resposta = await conectar(app, { usuario: USUARIO, senha: SENHA, predefinicao: "gmail" });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]![3]).toEqual({ usuario: USUARIO, senha: SENHA, predefinicao: "gmail" });
  });

  it("não apara a senha (ela pode começar ou terminar com espaço), mas apara o usuário", async () => {
    const { app, chamadas } = novoApp();
    await conectar(app, { ...corpoBom, usuario: `  ${USUARIO}  `, senha: " com espaço " });
    expect(chamadas[0]![3]).toMatchObject({ usuario: USUARIO, senha: " com espaço " });
  });

  it.each([
    ["campo a mais (.strict)", { ...corpoBom, extra: 1 }],
    ["sem senha", { usuario: USUARIO, imap: corpoBom.imap, smtp: corpoBom.smtp }],
    ["sem usuário", { senha: SENHA, imap: corpoBom.imap, smtp: corpoBom.smtp }],
    ["senha vazia", { ...corpoBom, senha: "" }],
    ["sem predefinição e sem servidores", { usuario: USUARIO, senha: SENHA }],
    ["só o IMAP", { usuario: USUARIO, senha: SENHA, imap: corpoBom.imap }],
    ["predefinição junto com servidores", { ...corpoBom, predefinicao: "gmail" }],
    ["predefinição desconhecida", { usuario: USUARIO, senha: SENHA, predefinicao: "yahoo" }],
    ["porta 0", { ...corpoBom, imap: { host: "imap.caixa.teste", porta: 0 } }],
    ["porta acima de 65535", { ...corpoBom, smtp: { host: "smtp.caixa.teste", porta: 70000 } }],
    ["porta fracionária", { ...corpoBom, smtp: { host: "smtp.caixa.teste", porta: 465.5 } }],
    ["host vazio", { ...corpoBom, imap: { host: "", porta: 993 } }],
    ["campo a mais no servidor", { ...corpoBom, imap: { host: "imap.caixa.teste", porta: 993, tls: false } }],
  ])("recusa %s com 400, sem chamar o serviço e sem repetir a senha na resposta", async (_nome, corpo) => {
    const { app, chamadas } = novoApp();
    const resposta = await conectar(app, corpo);
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
    expect(resposta.body).not.toContain(SENHA);
  });

  it("a porta 25 passa pela forma (a lista de portas é da guarda de rede, uma regra num lugar só)", async () => {
    const { app, chamadas } = novoApp();
    const resposta = await conectar(app, { ...corpoBom, imap: { host: "imap.caixa.teste", porta: 25 } });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas).toHaveLength(1);
  });
});

const autorizar = (app: ReturnType<typeof novoApp>["app"], servico: string, headers: Record<string, string> = AUTORIZACAO) =>
  app.inject({ method: "POST", url: `/canais/canal_1/email/oauth/${servico}/autorizar`, headers });

const concluir = (app: ReturnType<typeof novoApp>["app"], payload: unknown, headers: Record<string, string> = AUTORIZACAO) =>
  app.inject({ method: "POST", url: "/canais/email/oauth/concluir", headers, payload: payload as object });

describe("POST /canais/:id/email/oauth/:servico/autorizar", () => {
  it("exige a sessão: sem Authorization, 401 e o serviço nem é chamado", async () => {
    const { app, chamadas } = novoApp();
    expect((await autorizar(app, "microsoft", {})).statusCode).toBe(401);
    expect(chamadas).toEqual([]);
  });

  it.each(["microsoft", "google"])("delega ao serviço com o Membro, o Canal e o serviço %s, e devolve a URL", async (servico) => {
    const { app, chamadas } = novoApp();
    const resposta = await autorizar(app, servico);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: { url: "https://login.exemplo.test/autorizar?state=abc" } });
    expect(chamadas[0]![0]).toBe("autorizar");
    expect(chamadas[0]![1]).toMatchObject({ workspaceId: "ws_rota_email" });
    expect(chamadas[0]![2]).toBe("canal_1");
    expect(chamadas[0]![3]).toBe(servico);
  });

  it("serviço fora de google|microsoft: 400 e o serviço nem é chamado", async () => {
    const { app, chamadas } = novoApp();
    for (const servico of ["yahoo", "Microsoft", "outlook"]) expect((await autorizar(app, servico)).statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });
});

describe("POST /canais/email/oauth/concluir", () => {
  it("exige a sessão e passa o Membro, o código e o state ao serviço, sem repetir nenhum dos dois na resposta", async () => {
    const { app, chamadas } = novoApp();
    expect((await concluir(app, { codigo: "c", state: "s" }, {})).statusCode).toBe(401);
    expect(chamadas).toEqual([]);

    const resposta = await concluir(app, { codigo: "codigo-secreto-da-volta", state: "state-da-volta" });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ ok: true, dados: { id: "canal_1", conexao: "conectada" } });
    expect(chamadas[0]![0]).toBe("concluir");
    expect(chamadas[0]![1]).toMatchObject({ workspaceId: "ws_rota_email" });
    expect(chamadas[0]![2]).toEqual({ codigo: "codigo-secreto-da-volta", state: "state-da-volta" });
    expect(resposta.body).not.toContain("codigo-secreto-da-volta");
  });

  it.each([
    ["campo a mais (.strict)", { codigo: "c", state: "s", extra: 1 }],
    ["sem código", { state: "s" }],
    ["sem state", { codigo: "c" }],
    ["código vazio", { codigo: "", state: "s" }],
    ["state vazio", { codigo: "c", state: "" }],
    ["código acima de 4096", { codigo: "c".repeat(4097), state: "s" }],
    ["state acima de 2048", { codigo: "c", state: "s".repeat(2049) }],
    ["tipo errado", { codigo: 1, state: "s" }],
  ])("recusa %s com 400, sem chamar o serviço e sem repetir o código", async (_nome, corpo) => {
    const { app, chamadas } = novoApp();
    const resposta = await concluir(app, corpo);
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
    expect(resposta.body).not.toContain("c".repeat(100));
  });

  it("aceita o código no limite de 4096 caracteres", async () => {
    const { app, chamadas } = novoApp();
    expect((await concluir(app, { codigo: "c".repeat(4096), state: "s" })).statusCode).toBe(200);
    expect(chamadas).toHaveLength(1);
  });
});

describe("GET /canais/:id/email/conta", () => {
  it("exige a sessão e delega ao serviço com o Membro da sessão", async () => {
    const { app, chamadas } = novoApp();
    expect((await app.inject({ method: "GET", url: "/canais/canal_1/email/conta" })).statusCode).toBe(401);
    expect(chamadas).toEqual([]);
    const resposta = await app.inject({ method: "GET", url: "/canais/canal_1/email/conta", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: { conta: null, servicosDisponiveis: { google: false, microsoft: false } } });
    expect(chamadas[0]![0]).toBe("conta");
    expect(chamadas[0]![2]).toBe("canal_1");
  });
});

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };

const CLIENT_ID = "id-do-app-da-rota-17-12";
const CLIENT_SECRET = "segredo-do-app-da-rota-17-12";
const CODIGO = "codigo-de-autorizacao-da-rota-17-12";
const ACCESS = "access-token-da-rota-17-12";
const REFRESH = "refresh-token-da-rota-17-12";
const SEGREDOS_DO_LOGIN = [CLIENT_SECRET, CODIGO, ACCESS, REFRESH];
const CONFIG_DO_LOGIN: ConfiguracaoDoOauth = {
  redirectUri: "https://crm.exemplo.test/crm/caixa-de-entrada/configuracoes/canais/email/retorno",
  microsoft: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
};
const OUTRA_ID = membros.find((m) => m.userId !== undefined && m.userId !== MARYANE)!.userId!;
const AUTORIZACAO_OUTRA = { authorization: "Bearer token-outra" };

describeComBanco("rotas do e-mail com o serviço real — Postgres local e dublês de IMAP e SMTP", () => {
  const espacos: string[] = [];
  const servidores: ServidorDeEmailFalso[] = [];
  const acesso = criarAcessoAoCrmPg(pool);
  const canais = criarServicoDeCanais({ pool, acesso });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterEach(async () => {
    while (servidores.length > 0) await servidores.pop()!.fechar();
    while (logins.length > 0) await logins.pop()!.fechar();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  const logins: ServidorFalso[] = [];

  async function montar(rotulo: string, ambiente: NodeJS.ProcessEnv = {}, oauth?: { readonly configuracao?: ConfiguracaoDoOauth }) {
    const ws = novoEspacoDeTeste(`rem_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_bia", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    const caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: USUARIO, senha: SENHA, tokens: [ACCESS] }] });
    servidores.push(caixa);
    const login = await criarServidorFalso();
    logins.push(login);
    const resolver = vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]);
    const fabrica = criarFabricaDeConexao({
      resolver,
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
      ca: caixa.ca,
    });
    const servico = criarServicoDeConexaoDoEmail({
      pool,
      acesso,
      fabrica,
      chaves: () => CHAVES,
      configuracaoDoOauth: () => (oauth ? oauth.configuracao : lerConfiguracaoDoOauth(ambiente)),
      clientesOauth: { microsoft: (config) => criarClienteMicrosoft(config, { autorizacao: `${login.url}/authorize`, token: `${login.url}/token` }) },
      servidoresDoLogin: { microsoft: { imap: { host: "imap.caixa.teste", porta: caixa.imap.porta }, smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta } } },
    });
    const linhas: string[] = [];
    const app = buildApp({
      // O logger de PRODUÇÃO, só que escrevendo num vetor: o que o servidor registra de uma requisição de conexão.
      logger: opcoesDoLogger({ LOG_LEVEL: "debug" }, { write: (linha: string) => void linhas.push(linha) }),
      workspaceId: ws,
      verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : token === "token-outra" ? { sub: OUTRA_ID } : null),
      resolverMembro: async (_workspaceId: string, userId: string) => {
        const m = membros.find((x) => x.userId === userId);
        return m ? { ...m, id: userId === MARYANE ? "mem_admin" : "mem_bia", state: "ativo" as const } : undefined;
      },
      crm: { email: servico },
    });
    const admin = { id: "mem_admin", workspaceId: ws, state: "ativo" as const };
    const r = await canais.criar(admin, { provedor: "email-imap-smtp", nome: "Vendas", identificador: USUARIO });
    if (!r.ok) throw new Error(r.error);
    const entrada = (senha = SENHA) => ({
      usuario: USUARIO,
      senha,
      imap: { host: "imap.caixa.teste", porta: caixa.imap.porta },
      smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta },
    });
    return { ws, app, linhas, canalId: r.valor.id, entrada, caixa, login };
  }

  it("a senha não aparece no log nem na resposta, com a senha certa e com a errada", async () => {
    const c = await montar("log");
    const errada = await c.app.inject({
      method: "POST",
      url: `/canais/${c.canalId}/email/conectar`,
      headers: AUTORIZACAO,
      payload: c.entrada("senha-errada-que-tambem-nao-vaza"),
    });
    expect(errada.statusCode).toBe(422);
    expect(errada.json()).toMatchObject({ ok: false, codigo: "CONEXAO_RECUSADA", campo: "imap" });
    expect(errada.json().error).toMatch(/^O servidor IMAP recusou o usuário ou a senha\./);

    const certa = await c.app.inject({ method: "POST", url: `/canais/${c.canalId}/email/conectar`, headers: AUTORIZACAO, payload: c.entrada() });
    expect(certa.statusCode).toBe(200);
    expect(certa.json().dados).toMatchObject({ id: c.canalId, conexao: "conectada" });

    const ficha = await c.app.inject({ method: "GET", url: `/canais/${c.canalId}/email/conta`, headers: AUTORIZACAO });
    expect(ficha.statusCode).toBe(200);

    expect(c.linhas.length).toBeGreaterThan(0);
    const tudo = [...c.linhas, errada.body, certa.body, ficha.body].join("\n");
    expect(tudo).not.toContain(SENHA);
    expect(tudo).not.toContain("senha-errada-que-tambem-nao-vaza");
  });

  it("antes de conectar a conta é nula; depois traz endereço, login por senha e servidores, sem segredo", async () => {
    const c = await montar("conta");
    const antes = await c.app.inject({ method: "GET", url: `/canais/${c.canalId}/email/conta`, headers: AUTORIZACAO });
    expect(antes.json()).toEqual({ ok: true, dados: { conta: null, servicosDisponiveis: { google: false, microsoft: false } } });

    const r = await c.app.inject({ method: "POST", url: `/canais/${c.canalId}/email/conectar`, headers: AUTORIZACAO, payload: c.entrada() });
    expect(r.statusCode).toBe(200);

    const depois = await c.app.inject({ method: "GET", url: `/canais/${c.canalId}/email/conta`, headers: AUTORIZACAO });
    const { conta } = depois.json().dados;
    expect(conta).toMatchObject({
      endereco: USUARIO,
      tipoDeLogin: "senha",
      imap: { host: "imap.caixa.teste", porta: c.caixa.imap.porta },
      smtp: { host: "smtp.caixa.teste", porta: c.caixa.smtp.porta },
      motivoDaQueda: null,
    });
    // Nenhum campo de segredo nem o usuário do login.
    expect(Object.keys(conta).sort()).toEqual(["caiuEm", "conectadaEm", "endereco", "imap", "motivoDaQueda", "smtp", "tipoDeLogin"]);
    expect(depois.body).not.toMatch(/"senha":|"usuario"|token|refresh|password/i);
    expect(depois.body).not.toContain(SENHA);
  });

  it("os botões de login: a Microsoft só aparece com o par de variáveis e a URI de retorno no ambiente", async () => {
    const semNada = await montar("botoes0");
    const a = await semNada.app.inject({ method: "GET", url: `/canais/${semNada.canalId}/email/conta`, headers: AUTORIZACAO });
    expect(a.json().dados.servicosDisponiveis).toEqual({ google: false, microsoft: false });

    const comMicrosoft = await montar("botoes1", {
      EMAIL_OAUTH_REDIRECT_URI: "https://crm.exemplo.test/crm/caixa-de-entrada/configuracoes/canais/email/retorno",
      MICROSOFT_OAUTH_CLIENT_ID: "id-da-microsoft",
      MICROSOFT_OAUTH_CLIENT_SECRET: "segredo-da-microsoft-que-nunca-sai",
    });
    const b = await comMicrosoft.app.inject({ method: "GET", url: `/canais/${comMicrosoft.canalId}/email/conta`, headers: AUTORIZACAO });
    expect(b.json().dados.servicosDisponiveis).toEqual({ google: false, microsoft: true });
    expect(b.body).not.toContain("segredo-da-microsoft-que-nunca-sai");

    // O par incompleto (só o id) não liga o serviço.
    const incompleto = await montar("botoes2", {
      EMAIL_OAUTH_REDIRECT_URI: "https://crm.exemplo.test/retorno",
      GOOGLE_OAUTH_CLIENT_ID: "so-o-id",
    });
    const d = await incompleto.app.inject({ method: "GET", url: `/canais/${incompleto.canalId}/email/conta`, headers: AUTORIZACAO });
    expect(d.json().dados.servicosDisponiveis).toEqual({ google: false, microsoft: false });
  });

  describe("o login da Microsoft pelas rotas", () => {
    const resposta = (extra: Record<string, unknown> = {}) => ({
      kind: "ok" as const,
      status: 200,
      corpo: {
        access_token: ACCESS,
        refresh_token: REFRESH,
        expires_in: 3599,
        id_token: idTokenDeTeste({ aud: CLIENT_ID, oid: "oid-1", tid: "tid-1", preferred_username: USUARIO }),
        ...extra,
      },
    });

    const autorizarRota = (c: Awaited<ReturnType<typeof montar>>, headers = AUTORIZACAO) =>
      c.app.inject({ method: "POST", url: `/canais/${c.canalId}/email/oauth/microsoft/autorizar`, headers });
    const concluirRota = (c: Awaited<ReturnType<typeof montar>>, payload: unknown, headers = AUTORIZACAO) =>
      c.app.inject({ method: "POST", url: "/canais/email/oauth/concluir", headers, payload: payload as object });
    const estadoDe = (corpo: string) => new URL((JSON.parse(corpo) as { dados: { url: string } }).dados.url).searchParams.get("state")!;

    it("autorizar e concluir de ponta a ponta: o Canal conecta, a ficha mostra o login da Microsoft, e nada de segredo no log nem nas respostas", async () => {
      const c = await montar("login", {}, { configuracao: CONFIG_DO_LOGIN });
      const u = await autorizarRota(c);
      expect(u.statusCode).toBe(200);
      const url = new URL(u.json().dados.url as string);
      expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");

      c.login.enfileirar(resposta());
      const feito = await concluirRota(c, { codigo: CODIGO, state: estadoDe(u.body) });
      expect(feito.statusCode).toBe(200);
      expect(feito.json().dados).toMatchObject({ id: c.canalId, conexao: "conectada" });
      expect(camposDoPedido(c.login.recebidas[0]!)).toMatchObject({ code: CODIGO, client_secret: CLIENT_SECRET });

      const ficha = await c.app.inject({ method: "GET", url: `/canais/${c.canalId}/email/conta`, headers: AUTORIZACAO });
      expect(ficha.json().dados.conta).toMatchObject({ endereco: USUARIO, tipoDeLogin: "microsoft" });
      expect(ficha.json().dados.servicosDisponiveis).toEqual({ google: false, microsoft: true });

      // O log de produção capturado e todas as respostas: nenhum código, token nem segredo do cliente.
      expect(c.linhas.length).toBeGreaterThan(0);
      const tudo = [...c.linhas, u.body.replace(/state=[^"&]*/, ""), feito.body, ficha.body].join("\n");
      for (const segredo of SEGREDOS_DO_LOGIN) expect(tudo, segredo).not.toContain(segredo);
    });

    it("o state de outro Membro: 400 ESTADO_INVALIDO com a frase, nada conectado, e o login nem é chamado", async () => {
      const c = await montar("outro-membro", {}, { configuracao: CONFIG_DO_LOGIN });
      const u = await autorizarRota(c);
      const r = await concluirRota(c, { codigo: CODIGO, state: estadoDe(u.body) }, AUTORIZACAO_OUTRA);
      expect(r.statusCode).toBe(400);
      expect(r.json()).toMatchObject({
        ok: false,
        codigo: "ESTADO_INVALIDO",
        error: "O pedido de conexão expirou ou não é válido. Comece de novo pelo botão da ficha do Canal.",
      });
      expect(c.login.recebidas).toHaveLength(0);
      const conta = await c.app.inject({ method: "GET", url: `/canais/${c.canalId}/email/conta`, headers: AUTORIZACAO });
      expect(conta.json().dados.conta).toBeNull();
      expect(r.body).not.toContain(CODIGO);
    });

    it("outra conta: 409 CONTA_DIFERENTE; consentimento do administrador: 409; nenhuma resposta leva o código nem os tokens", async () => {
      const c = await montar("recusas", {}, { configuracao: CONFIG_DO_LOGIN });
      const respostas: string[] = [];

      const um = await autorizarRota(c);
      c.login.enfileirar(resposta({ id_token: idTokenDeTeste({ aud: CLIENT_ID, preferred_username: "outra@empresa.com" }) }));
      const outraConta = await concluirRota(c, { codigo: CODIGO, state: estadoDe(um.body) });
      expect(outraConta.statusCode).toBe(409);
      expect(outraConta.json()).toMatchObject({
        codigo: "CONTA_DIFERENTE",
        error: `Você entrou com outra@empresa.com, mas este Canal é da caixa ${USUARIO}. Entre com a conta da própria caixa.`,
      });
      respostas.push(outraConta.body);

      const dois = await autorizarRota(c);
      c.login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: `AADSTS65001 ${CODIGO} ${REFRESH}` } });
      const admin = await concluirRota(c, { codigo: CODIGO, state: estadoDe(dois.body) });
      expect(admin.statusCode).toBe(409);
      expect(admin.json()).toMatchObject({
        codigo: "CONSENTIMENTO_DO_ADMINISTRADOR",
        error: "A sua organização exige que um administrador aprove o aplicativo antes de você entrar.",
      });
      respostas.push(admin.body);

      for (const segredo of SEGREDOS_DO_LOGIN) for (const corpo of respostas) expect(corpo).not.toContain(segredo);
      expect(c.linhas.join("\n")).not.toContain(CODIGO);
    });

    it("sem o par da Microsoft no servidor: autorizar responde 503 EMAIL_OAUTH_NAO_CONFIGURADO dizendo os NOMES do que falta", async () => {
      const c = await montar("nao-configurado", {}, { configuracao: { redirectUri: CONFIG_DO_LOGIN.redirectUri } });
      const r = await autorizarRota(c);
      expect(r.statusCode).toBe(503);
      expect(r.json()).toMatchObject({
        codigo: "EMAIL_OAUTH_NAO_CONFIGURADO",
        error: "Falta no servidor: MICROSOFT_OAUTH_CLIENT_ID, MICROSOFT_OAUTH_CLIENT_SECRET.",
      });
    });

    it("sem sessão, nenhuma das duas rotas chega ao serviço", async () => {
      const c = await montar("sem-sessao", {}, { configuracao: CONFIG_DO_LOGIN });
      expect((await autorizarRota(c, {} as never)).statusCode).toBe(401);
      expect((await concluirRota(c, { codigo: CODIGO, state: "x" }, {} as never)).statusCode).toBe(401);
      expect(c.login.recebidas).toHaveLength(0);
    });
  });
});
