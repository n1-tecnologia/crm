/**
 * A renovação preguiçosa do token da Microsoft pela porta de acesso (Fase 17, 17-12, D-17-05, D-17-20), contra o Postgres LOCAL
 * e um servidor de login FALSO (nenhuma chamada à Microsoft):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55755/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55755/postgres \
 *   npx vitest run src/mensageria/provedores/email/token.test.ts
 *
 * Prova: `renovadoresDoAmbiente` só liga o serviço com o par completo; o token que vence em menos de 5 min é renovado, o
 * `refreshToken` NOVO substitui o antigo no cofre e a segunda chamada não renova; renovações ao mesmo tempo do mesmo Canal são
 * serializadas (uma só ida ao serviço); a recusa permanente devolve a frase de produto e leva o Canal a `desconectada`; e a
 * recusa transitória não derruba nada.
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { encerrar, pool } from "../../../persistencia/conexao";
import { lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../../testes/banco-crm";
import { camposDoPedido } from "../../../testes/login-oauth-falso";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import type { CanalParaProvedor } from "../../provedor";
import type { ConfiguracaoDoOauth } from "./configuracao";
import { TIPO_DA_CREDENCIAL, acessoDoEmailDoAmbiente, criarAcessoDoEmail, guardarCredencialDoEmail, lerCredencialDoEmail, type CredencialDoEmail } from "./credencial";
import { criarClienteGoogle, FRASE_GOOGLE_RENOVACAO_PERMANENTE } from "./oauth/google";
import { criarClienteMicrosoft, FRASE_MICROSOFT_RENOVACAO_PERMANENTE } from "./oauth/microsoft";
import { registrarQuedaDoEmail } from "./queda";
import { renovadoresDoAmbiente } from "./token";

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const ENDERECO = "vendas@caixa.teste";
const CLIENT_ID = "id-do-app-de-teste";
const CLIENT_SECRET = "segredo-do-app-de-teste-17-12";
const REDIRECT_URI = "https://crm.exemplo.test/retorno";
const CONFIG: ConfiguracaoDoOauth = { redirectUri: REDIRECT_URI, microsoft: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } };
const CONFIG_GOOGLE: ConfiguracaoDoOauth = { redirectUri: REDIRECT_URI, google: { clientId: "id-google-de-teste", clientSecret: "segredo-google-de-teste-17-13" } };

const REFRESH_ANTIGO = "refresh-antigo-17-12";
const REFRESH_NOVO = "refresh-novo-17-12";
const ACCESS_ANTIGO = "access-antigo-17-12";
const ACCESS_NOVO = "access-novo-17-12";

const AGORA = Date.parse("2026-11-19T12:00:00.000Z");
const emMin = (min: number) => new Date(AGORA + min * 60_000).toISOString();

const oauth = (extra: Partial<Extract<CredencialDoEmail, { tipo: "oauth" }>> = {}): CredencialDoEmail => ({
  v: 1,
  tipo: "oauth",
  servico: "microsoft",
  usuario: ENDERECO,
  refreshToken: REFRESH_ANTIGO,
  ...extra,
});

describe("renovadoresDoAmbiente", () => {
  it("só tem a Microsoft quando a configuração tem o par dela e a URI de retorno", () => {
    expect(Object.keys(renovadoresDoAmbiente(CONFIG))).toEqual(["microsoft"]);
    expect(renovadoresDoAmbiente(undefined)).toEqual({});
    expect(renovadoresDoAmbiente({ redirectUri: REDIRECT_URI })).toEqual({});
    // O Google tem renovador quando tem o par; só ele configurado não liga a Microsoft (17-13).
    expect(Object.keys(renovadoresDoAmbiente({ redirectUri: REDIRECT_URI, google: { clientId: "g", clientSecret: "g" } }))).toEqual(["google"]);
    expect(Object.keys(renovadoresDoAmbiente({ ...CONFIG, google: { clientId: "g", clientSecret: "g" } })).sort()).toEqual(["google", "microsoft"]);
  });

  it("usa as fábricas dadas (testes trocam o cliente de produção por um que fala com o servidor falso)", async () => {
    const renovador = async () => ({ accessToken: "x", expiraEm: emMin(60) });
    const renovadores = renovadoresDoAmbiente(CONFIG, { microsoft: () => ({ servico: "microsoft", urlDeAutorizacao: () => "", trocarCodigo: async () => { throw new Error("n/a"); }, renovar: renovador }) });
    expect(renovadores.microsoft).toBe(renovador);
  });
});

describeComBanco("a renovação do token da Microsoft — Postgres local e servidor de login falso", () => {
  const espacos: string[] = [];
  const logins: ServidorFalso[] = [];

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    while (logins.length > 0) await logins.pop()!.fechar();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  async function preparar(rotulo: string, credencial: CredencialDoEmail, opcoes: { tempoLimiteMs?: number } = {}) {
    const ws = novoEspacoDeTeste(`tk_${rotulo}`);
    espacos.push(ws);
    const canalId = await semearCanal(ws, { nome: "Vendas", tipo: "email", provedor: "email-imap-smtp", identificadorExterno: ENDERECO, conexao: "conectada" });
    await guardarCredencialDoEmail(pool(), CHAVES, { workspaceId: ws, canalId }, credencial);
    const login = await criarServidorFalso();
    logins.push(login);
    const renovadores = renovadoresDoAmbiente({ ...CONFIG, ...CONFIG_GOOGLE }, {
      microsoft: (config) => criarClienteMicrosoft(config, { autorizacao: `${login.url}/authorize`, token: `${login.url}/token` }, { agora: () => AGORA, ...opcoes }),
      google: (config) =>
        criarClienteGoogle(config, { autorizacao: `${login.url}/authorize`, token: `${login.url}/token`, revogacao: `${login.url}/revoke` }, { agora: () => AGORA, ...opcoes }),
    });
    const acesso = criarAcessoDoEmail({ pool, chaves: () => CHAVES, agora: () => AGORA, renovadores });
    const doCofre = async (): Promise<CanalParaProvedor> => ({
      workspaceId: ws,
      canal: { id: canalId } as unknown as Canal,
      credencial: await lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DA_CREDENCIAL }),
    });
    return { ws, canalId, login, acesso, doCofre };
  }

  const resposta = (extra: Record<string, unknown> = {}) => ({
    kind: "ok" as const,
    status: 200,
    corpo: { access_token: ACCESS_NOVO, refresh_token: REFRESH_NOVO, expires_in: 3600, token_type: "Bearer", ...extra },
  });

  it("vencendo em 2 min: renova, o cofre passa a ter o refreshToken novo e o token novo, e a segunda chamada logo depois NÃO renova", async () => {
    const c = await preparar("rotacao", oauth({ accessToken: ACCESS_ANTIGO, expiraEm: emMin(2) }));
    c.login.enfileirar(resposta());

    const primeira = await c.acesso.acessoParaUsar(await c.doCofre());
    expect(primeira).toMatchObject({ ok: true, servico: "microsoft", auth: { tipo: "oauth", usuario: ENDERECO, accessToken: ACCESS_NOVO } });
    expect(c.login.recebidas).toHaveLength(1);
    expect(camposDoPedido(c.login.recebidas[0]!)).toMatchObject({ grant_type: "refresh_token", refresh_token: REFRESH_ANTIGO, client_id: CLIENT_ID });

    const guardada = lerCredencialDoEmail((await c.doCofre()).credencial);
    expect(guardada).toMatchObject({ refreshToken: REFRESH_NOVO, accessToken: ACCESS_NOVO });
    // O token novo vale mais de 5 min: a segunda chamada devolve o guardado, sem ir ao serviço.
    const segunda = await c.acesso.acessoParaUsar(await c.doCofre());
    expect(segunda).toMatchObject({ ok: true, auth: { accessToken: ACCESS_NOVO } });
    expect(c.login.recebidas).toHaveLength(1);

    // Uma só credencial ativa: a anterior foi revogada na mesma transação em que a nova entrou.
    const ativas = await pool().query("select 1 from plataforma.credenciais where workspace_id = $1 and dono_id = $2 and tipo = $3 and revogado_em is null", [c.ws, c.canalId, TIPO_DA_CREDENCIAL]);
    expect(ativas.rowCount).toBe(1);
  });

  it("sem accessToken guardado, renova na primeira chamada; token com mais de 5 min não renova", async () => {
    const semToken = await preparar("sem-token", oauth());
    semToken.login.enfileirar(resposta());
    expect(await semToken.acesso.acessoParaUsar(await semToken.doCofre())).toMatchObject({ ok: true, auth: { accessToken: ACCESS_NOVO } });

    const fresco = await preparar("fresco", oauth({ accessToken: ACCESS_ANTIGO, expiraEm: emMin(30) }));
    expect(await fresco.acesso.acessoParaUsar(await fresco.doCofre())).toMatchObject({ ok: true, auth: { accessToken: ACCESS_ANTIGO } });
    expect(fresco.login.recebidas).toHaveLength(0);
  });

  it("renovações ao mesmo tempo do mesmo Canal são serializadas: uma só ida ao serviço e o novo token não se perde", async () => {
    const c = await preparar("serializada", oauth({ accessToken: ACCESS_ANTIGO, expiraEm: emMin(1) }));
    c.login.enfileirar({ ...resposta(), kind: "atraso", ms: 60 } as never);
    const canal = await c.doCofre();

    const [a, b, d] = await Promise.all([c.acesso.acessoParaUsar(canal), c.acesso.acessoParaUsar(canal), c.acesso.acessoParaUsar(canal)]);

    for (const r of [a, b, d]) expect(r).toMatchObject({ ok: true, auth: { accessToken: ACCESS_NOVO } });
    expect(c.login.recebidas).toHaveLength(1);
    expect(lerCredencialDoEmail((await c.doCofre()).credencial)).toMatchObject({ refreshToken: REFRESH_NOVO });
  });

  it("de Canais diferentes, as renovações NÃO esperam uma pela outra", async () => {
    const um = await preparar("canal-um", oauth({ expiraEm: emMin(1), accessToken: ACCESS_ANTIGO }));
    const dois = await preparar("canal-dois", oauth({ expiraEm: emMin(1), accessToken: ACCESS_ANTIGO }));
    um.login.enfileirar(resposta());
    dois.login.enfileirar(resposta());
    const [a, b] = await Promise.all([um.acesso.acessoParaUsar(await um.doCofre()), dois.acesso.acessoParaUsar(await dois.doCofre())]);
    expect(a.ok && b.ok).toBe(true);
    expect(um.login.recebidas).toHaveLength(1);
    expect(dois.login.recebidas).toHaveLength(1);
  });

  it("invalid_grant é permanente: a frase de produto vai a motivo e a queda deixa o Canal desconectada com ela", async () => {
    const c = await preparar("revogado", oauth({ accessToken: ACCESS_ANTIGO, expiraEm: emMin(1) }));
    c.login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: `AADSTS700082: ${REFRESH_ANTIGO} expirou` } });

    const r = await c.acesso.acessoParaUsar(await c.doCofre());
    expect(r).toEqual({ ok: false, permanente: true, codigo: "AUTORIZACAO_RECUSADA", motivo: FRASE_MICROSOFT_RENOVACAO_PERMANENTE });
    expect(JSON.stringify(r)).not.toContain(REFRESH_ANTIGO);
    // O cofre fica como estava: nada foi gravado.
    expect(lerCredencialDoEmail((await c.doCofre()).credencial)).toMatchObject({ refreshToken: REFRESH_ANTIGO, accessToken: ACCESS_ANTIGO });

    // O envio (e o leitor) passam o motivo à queda: o Canal vira `desconectada` com a frase.
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(await registrarQuedaDoEmail(() => pool(), { workspaceId: c.ws, canalId: c.canalId }, r.motivo)).toEqual({ mudou: true });
    }
    const linha = (await pool().query<{ conexao: string }>("select conexao from plataforma.canais where workspace_id = $1 and id = $2", [c.ws, c.canalId])).rows[0]!;
    expect(linha.conexao).toBe("desconectada");
  });

  it("Google: renova sem girar o token (o cofre fica com o mesmo refreshToken) e a recusa invalid_grant vira queda com a frase do Google", async () => {
    const c = await preparar("google-renova", oauth({ servico: "google", accessToken: ACCESS_ANTIGO, expiraEm: emMin(1) }));
    c.login.enfileirar({ kind: "ok", status: 200, corpo: { access_token: ACCESS_NOVO, expires_in: 3599, token_type: "Bearer" } });
    expect(await c.acesso.acessoParaUsar(await c.doCofre())).toMatchObject({ ok: true, servico: "google", auth: { tipo: "oauth", accessToken: ACCESS_NOVO } });
    expect(camposDoPedido(c.login.recebidas[0]!)).toMatchObject({ grant_type: "refresh_token", refresh_token: REFRESH_ANTIGO, client_id: "id-google-de-teste" });
    expect(lerCredencialDoEmail((await c.doCofre()).credencial)).toMatchObject({ servico: "google", refreshToken: REFRESH_ANTIGO, accessToken: ACCESS_NOVO });

    // Os 7 dias do modo de teste, a senha trocada e o acesso retirado são o mesmo `invalid_grant`.
    const vencida = await preparar("google-vence", oauth({ servico: "google", accessToken: ACCESS_ANTIGO, expiraEm: emMin(1) }));
    vencida.login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_grant", error_description: `Token has been expired or revoked. ${REFRESH_ANTIGO}` } });
    const r = await vencida.acesso.acessoParaUsar(await vencida.doCofre());
    expect(r).toEqual({ ok: false, permanente: true, codigo: "AUTORIZACAO_RECUSADA", motivo: FRASE_GOOGLE_RENOVACAO_PERMANENTE });
    expect(JSON.stringify(r)).not.toContain(REFRESH_ANTIGO);
    if (!r.ok) expect(await registrarQuedaDoEmail(() => pool(), { workspaceId: vencida.ws, canalId: vencida.canalId }, r.motivo)).toEqual({ mudou: true });
    const linha = (await pool().query<{ conexao: string }>("select conexao from plataforma.canais where workspace_id = $1 and id = $2", [vencida.ws, vencida.canalId])).rows[0]!;
    expect(linha.conexao).toBe("desconectada");
  });

  it("503, temporarily_unavailable e servidor mudo são transitórios: nada cai e nada é gravado", async () => {
    const c = await preparar("transitorio", oauth({ accessToken: ACCESS_ANTIGO, expiraEm: emMin(1) }), { tempoLimiteMs: 150 });
    c.login.enfileirar({ kind: "ok", status: 503, corpo: {} });
    c.login.enfileirar({ kind: "ok", status: 400, corpo: { error: "temporarily_unavailable" } });
    c.login.enfileirar({ kind: "timeout" });
    for (let i = 0; i < 3; i += 1) {
      const r = await c.acesso.acessoParaUsar(await c.doCofre());
      expect(r).toMatchObject({ ok: false, permanente: false, codigo: "RENOVACAO_FALHOU" });
    }
    const linha = (await pool().query<{ conexao: string }>("select conexao from plataforma.canais where workspace_id = $1 and id = $2", [c.ws, c.canalId])).rows[0]!;
    expect(linha.conexao).toBe("conectada");
    expect(lerCredencialDoEmail((await c.doCofre()).credencial)).toMatchObject({ refreshToken: REFRESH_ANTIGO });
  });

  it("acessoDoEmailDoAmbiente(env) usa os renovadores da configuração: com o par da Microsoft renova; sem ele, OAUTH_NAO_CONFIGURADO", async () => {
    const env = {
      COFRE_CHAVE: CHAVES.atual.chave.toString("base64"),
      COFRE_CHAVE_VERSAO: "1",
      EMAIL_OAUTH_REDIRECT_URI: REDIRECT_URI,
      MICROSOFT_OAUTH_CLIENT_ID: CLIENT_ID,
      MICROSOFT_OAUTH_CLIENT_SECRET: CLIENT_SECRET,
    };
    const c = await preparar("ambiente", oauth({ accessToken: ACCESS_ANTIGO, expiraEm: new Date(Date.now() + 60_000).toISOString() }));

    // O `fetch` é trocado por um dublê: nenhum pedido sai da máquina. O cliente de produção usa o endereço real da Microsoft, que só
    // aparece aqui como a URL que o dublê recebeu.
    const chamadas: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        chamadas.push(String(url));
        return new Response(JSON.stringify({ access_token: ACCESS_NOVO, refresh_token: REFRESH_NOVO, expires_in: 3600 }), { status: 200 });
      }),
    );
    // Sem a configuração do serviço, ou com a URI de retorno inválida (que desliga o login sem lançar): nada a renovar com.
    const semConfiguracao = acessoDoEmailDoAmbiente({ COFRE_CHAVE: env.COFRE_CHAVE, COFRE_CHAVE_VERSAO: "1" });
    expect(await semConfiguracao.acessoParaUsar(await c.doCofre())).toMatchObject({ ok: false, codigo: "OAUTH_NAO_CONFIGURADO", permanente: false });
    const uriInvalida = acessoDoEmailDoAmbiente({ ...env, EMAIL_OAUTH_REDIRECT_URI: "http://inseguro.exemplo.test/x" });
    expect(await uriInvalida.acessoParaUsar(await c.doCofre())).toMatchObject({ ok: false, codigo: "OAUTH_NAO_CONFIGURADO" });
    expect(chamadas).toHaveLength(0);

    const comMicrosoft = acessoDoEmailDoAmbiente(env);
    expect(await comMicrosoft.acessoParaUsar(await c.doCofre())).toMatchObject({ ok: true, auth: { accessToken: ACCESS_NOVO } });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatch(/\/oauth2\/v2\.0\/token$/);
  });
});
