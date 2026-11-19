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
import { lerConfiguracaoDoOauth } from "../../mensageria/provedores/email/configuracao";
import { criarPoliticaDeRede, type Resolvedor } from "../../mensageria/provedores/email/rede";
import { opcoesDoLogger } from "../../observabilidade/log";
import { encerrar, pool } from "../../persistencia/conexao";
import type { ChavesDoCofre } from "../../servicos/cofre";
import { criarAcessoAoCrmPg } from "../../servicos/crm/acesso";
import { criarServicoDeCanais } from "../../servicos/crm/canais";
import { sucesso } from "../../servicos/crm/resultado";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { iniciarServidorDeEmailFalso, type ServidorDeEmailFalso } from "../../testes/servidor-de-email-falso";

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
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  async function montar(rotulo: string, ambiente: NodeJS.ProcessEnv = {}) {
    const ws = novoEspacoDeTeste(`rem_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    const caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: USUARIO, senha: SENHA }] });
    servidores.push(caixa);
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
      configuracaoDoOauth: () => lerConfiguracaoDoOauth(ambiente),
    });
    const linhas: string[] = [];
    const app = buildApp({
      // O logger de PRODUÇÃO, só que escrevendo num vetor: o que o servidor registra de uma requisição de conexão.
      logger: opcoesDoLogger({ LOG_LEVEL: "debug" }, { write: (linha: string) => void linhas.push(linha) }),
      workspaceId: ws,
      verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : null),
      resolverMembro: async (_workspaceId: string, userId: string) => {
        const m = membros.find((x) => x.userId === userId);
        return m ? { ...m, id: "mem_admin", state: "ativo" as const } : undefined;
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
    return { ws, app, linhas, canalId: r.valor.id, entrada, caixa };
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
});
