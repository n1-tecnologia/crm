/**
 * Desconectar e arquivar o Canal de e-mail esquecem a caixa (Fase 17, 17-05, D-17-06, T-17-24), contra o Postgres LOCAL:
 * a conta, o cursor e a credencial do cofre somem na MESMA transação da mudança do Canal. A credencial de outro Canal, o
 * segredo do webhook e o que o Canal de outro provedor guarda não são tocados.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55745/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55745/postgres \
 *   npx vitest run src/servicos/crm/canais-email.test.ts
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../../mensageria/provedor";
import { criarConectorDoEmail, type ConectorDoEmail } from "../../mensageria/provedores/email/conexao";
import type { ConfiguracaoDoOauth } from "../../mensageria/provedores/email/configuracao";
import { TIPO_DA_CREDENCIAL, guardarCredencialDoEmail, type CredencialDoEmail } from "../../mensageria/provedores/email/credencial";
import { criarClienteGoogle } from "../../mensageria/provedores/email/oauth/google";
import { criarClienteMicrosoft } from "../../mensageria/provedores/email/oauth/microsoft";
import { contaDoCanal, gravarConta, gravarCursor, lerCursor } from "../../mensageria/provedores/email/repositorio";
import { registrarQuedaDoEmail } from "../../mensageria/provedores/email/queda";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { camposDoPedido } from "../../testes/login-oauth-falso";
import { criarServidorFalso, type ServidorFalso } from "../../testes/servidor-falso";
import { guardarCredencial, lerCredencial, type ChavesDoCofre } from "../cofre";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeCanais } from "./canais";
import type { ResultadoCrm } from "./resultado";

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

describeComBanco("ServicoDeCanais: desconectar e arquivar o e-mail esquecem a caixa (D-17-06)", () => {
  const espacos: string[] = [];
  const servico = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool) });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(`ce_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    return { ws, admin: sessao(ws, "mem_admin") };
  }

  /** Um Canal de e-mail conectado, com conta, cursor e credencial gravados como a conexão os deixa. */
  async function canalDeEmail(ws: string, nome: string) {
    const id = await semearCanal(ws, {
      nome,
      tipo: "email",
      provedor: "email-imap-smtp",
      identificadorExterno: `${nome.toLowerCase()}@caixa.teste`,
      conexao: "conectada",
    });
    await gravarConta(pool(), {
      workspaceId: ws,
      canalId: id,
      endereco: `${nome.toLowerCase()}@caixa.teste`,
      tipoDeLogin: "senha",
      imap: { host: "imap.caixa.teste", porta: 993 },
      smtp: { host: "smtp.caixa.teste", porta: 465 },
      conectadaPor: "mem_admin",
    });
    await gravarCursor(pool(), ws, id, { pasta: "INBOX", uidValidity: "42", proximoUid: 10 });
    await guardarCredencialDoEmail(pool(), CHAVES, { workspaceId: ws, canalId: id }, { v: 1, tipo: "senha", usuario: `${nome.toLowerCase()}@caixa.teste`, senha: `senha-${nome}` });
    return id;
  }

  const credencial = (ws: string, id: string, tipo = TIPO_DA_CREDENCIAL) =>
    lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo });

  const canalNoBanco = async (ws: string, id: string) =>
    (await pool().query<{ conexao: string; estado: string }>("select conexao, estado from plataforma.canais where workspace_id = $1 and id = $2", [ws, id])).rows[0]!;

  it("desconectar: o Canal fica desconectada e a conta, o cursor e a credencial somem; a do OUTRO Canal fica", async () => {
    const { ws, admin } = await espaco("desc");
    const a = await canalDeEmail(ws, "Vendas");
    const b = await canalDeEmail(ws, "Suporte");

    const desconectado = valor(await servico.desconectar(admin, a));

    expect(desconectado).toMatchObject({ id: a, conexao: "desconectada" });
    expect(await canalNoBanco(ws, a)).toMatchObject({ conexao: "desconectada", estado: "ativo" });
    expect(await contaDoCanal(pool(), ws, a)).toBeUndefined();
    expect(await lerCursor(pool(), ws, a, "INBOX")).toBeUndefined();
    expect(await credencial(ws, a)).toBeUndefined();

    // O outro Canal do mesmo Espaço segue inteiro.
    expect(await contaDoCanal(pool(), ws, b)).toBeDefined();
    expect(await lerCursor(pool(), ws, b, "INBOX")).toBeDefined();
    expect(await credencial(ws, b)).toBeDefined();
  });

  it("arquivar: o Canal fica arquivado e a mesma caixa é esquecida", async () => {
    const { ws, admin } = await espaco("arq");
    const a = await canalDeEmail(ws, "Vendas");

    const arquivado = valor(await servico.arquivar(admin, a));

    expect(arquivado).toMatchObject({ id: a, estado: "arquivado" });
    expect(await contaDoCanal(pool(), ws, a)).toBeUndefined();
    expect(await lerCursor(pool(), ws, a, "INBOX")).toBeUndefined();
    expect(await credencial(ws, a)).toBeUndefined();
  });

  it("arquivar um Canal que já tinha caído (a conta e a credencial ficaram) também esquece a caixa", async () => {
    const { ws, admin } = await espaco("arqqueda");
    const a = await canalDeEmail(ws, "Vendas");
    expect(await registrarQuedaDoEmail(pool, { workspaceId: ws, canalId: a }, "A senha da caixa mudou: conecte de novo.")).toEqual({ mudou: true });
    expect(await credencial(ws, a)).toBeDefined();

    valor(await servico.arquivar(admin, a));

    expect(await contaDoCanal(pool(), ws, a)).toBeUndefined();
    expect(await credencial(ws, a)).toBeUndefined();
  });

  it("o segredo do webhook do e-mail (outro tipo de credencial do mesmo Canal) não é o que esta sessão apaga", async () => {
    const { ws, admin } = await espaco("outrotipo");
    const a = await canalDeEmail(ws, "Vendas");
    await guardarCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: a, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "segredo-do-hook" });

    valor(await servico.desconectar(admin, a));

    expect(await credencial(ws, a)).toBeUndefined();
    expect(await credencial(ws, a, TIPO_DO_SEGREDO_DO_WEBHOOK)).toBe("segredo-do-hook");
  });

  it("Membro sem permissão não apaga nada, e a transição recusada (já desconectado) também não", async () => {
    const { ws, admin } = await espaco("recusa");
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    const a = await canalDeEmail(ws, "Vendas");

    const semPermissao = await servico.desconectar(sessao(ws, "mem_ana"), a);
    expect(semPermissao.ok).toBe(false);
    expect(await contaDoCanal(pool(), ws, a)).toBeDefined();
    expect(await credencial(ws, a)).toBeDefined();

    valor(await servico.desconectar(admin, a));
    const denovo = await servico.desconectar(admin, a);
    expect(denovo.ok).toBe(false);
  });
});

/**
 * 17-13, D-17-06: o Canal conectado pelo Google pede a revogação do token ao Google ANTES da transação, e a falha dela nunca
 * impede apagar a conta e a credencial. Nenhum host do Google: o conector real fala com um servidor de login FALSO.
 */
describeComBanco("ServicoDeCanais: desconectar e arquivar o e-mail do Google revogam o token (D-17-06, 17-13)", () => {
  const espacos: string[] = [];
  const logins: ServidorFalso[] = [];
  const REFRESH_DO_GOOGLE = "refresh-token-do-google-17-13-revogar";
  const CONFIG: ConfiguracaoDoOauth = {
    redirectUri: "https://crm.exemplo.test/retorno",
    google: { clientId: "id-google-de-teste", clientSecret: "segredo-google-de-teste-17-13" },
    microsoft: { clientId: "id-ms-de-teste", clientSecret: "segredo-ms-de-teste-17-13" },
  };

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterEach(async () => {
    while (logins.length > 0) await logins.pop()!.fechar();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(`cg_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    return { ws, admin: sessao(ws, "mem_admin") };
  }

  async function canalDeEmail(ws: string, nome: string, credencial: (usuario: string) => CredencialDoEmail) {
    const endereco = `${nome.toLowerCase()}@caixa.teste`;
    const id = await semearCanal(ws, { nome, tipo: "email", provedor: "email-imap-smtp", identificadorExterno: endereco, conexao: "conectada" });
    await gravarConta(pool(), {
      workspaceId: ws,
      canalId: id,
      endereco,
      tipoDeLogin: "google",
      imap: { host: "imap.caixa.teste", porta: 993 },
      smtp: { host: "smtp.caixa.teste", porta: 465 },
      conectadaPor: "mem_admin",
    });
    await gravarCursor(pool(), ws, id, { pasta: "INBOX", uidValidity: "42", proximoUid: 10 });
    await guardarCredencialDoEmail(pool(), CHAVES, { workspaceId: ws, canalId: id }, credencial(endereco));
    return id;
  }

  const doGoogle = (usuario: string): CredencialDoEmail => ({ v: 1, tipo: "oauth", servico: "google", usuario, refreshToken: REFRESH_DO_GOOGLE });
  const daMicrosoft = (usuario: string): CredencialDoEmail => ({ v: 1, tipo: "oauth", servico: "microsoft", usuario, refreshToken: "refresh-da-microsoft" });
  const daSenha = (usuario: string): CredencialDoEmail => ({ v: 1, tipo: "senha", usuario, senha: "senha-de-app" });

  const credencial = (ws: string, id: string) => lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo: TIPO_DA_CREDENCIAL });
  const canalNoBanco = async (ws: string, id: string) =>
    (await pool().query<{ conexao: string; estado: string }>("select conexao, estado from plataforma.canais where workspace_id = $1 and id = $2", [ws, id])).rows[0]!;

  /** O conector REAL, falando com o login falso: o endereço de revogação do Google é o do servidor falso. */
  async function conectorReal(opcoes: { tempoLimiteDaRevogacaoMs?: number } = {}) {
    const login = await criarServidorFalso();
    logins.push(login);
    const conector = criarConectorDoEmail({
      pool,
      chaves: () => CHAVES,
      configuracaoDoOauth: () => CONFIG,
      clientes: {
        google: (config) =>
          criarClienteGoogle(config, { autorizacao: `${login.url}/authorize`, token: `${login.url}/token`, revogacao: `${login.url}/revoke` }, opcoes),
        microsoft: (config) => criarClienteMicrosoft(config, { autorizacao: `${login.url}/authorize`, token: `${login.url}/token` }),
      },
    });
    return { login, conector, servico: criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool), conectores: { email: conector } }) };
  }

  const esquecido = async (ws: string, id: string) => {
    expect(await contaDoCanal(pool(), ws, id)).toBeUndefined();
    expect(await lerCursor(pool(), ws, id, "INBOX")).toBeUndefined();
    expect(await credencial(ws, id)).toBeUndefined();
  };

  it("desconectar um Canal do Google pede a revogação do refresh token ANTES da transação e depois esquece a caixa", async () => {
    const { ws, admin } = await espaco("desc");
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    let visto: { conexao: string; credencial: string | undefined } | undefined;
    const falso: ConectorDoEmail = {
      async revogar(workspaceId, canal) {
        // Neste instante a transação ainda não rodou: o Canal segue conectado e a credencial segue no cofre.
        visto = { conexao: (await canalNoBanco(workspaceId, canal.id)).conexao, credencial: await credencial(workspaceId, canal.id) };
      },
    };
    const servico = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool), conectores: { email: falso } });

    valor(await servico.desconectar(admin, a));

    expect(visto?.conexao).toBe("conectada");
    expect(visto?.credencial).toBeDefined();
    expect(await canalNoBanco(ws, a)).toMatchObject({ conexao: "desconectada", estado: "ativo" });
    await esquecido(ws, a);
  });

  it("o conector real faz um POST em /revoke com o refresh token do cofre (e só ele) e o Canal desconecta", async () => {
    const { ws, admin } = await espaco("real");
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    const { login, servico, conector } = await conectorReal();
    login.enfileirar({ kind: "ok", status: 200, corpo: {} });

    valor(await servico.desconectar(admin, a));

    expect(login.recebidas).toHaveLength(1);
    expect(login.recebidas[0]!.caminho).toBe("/revoke");
    expect(camposDoPedido(login.recebidas[0]!)).toEqual({ token: REFRESH_DO_GOOGLE });
    expect(conector.falhasDeRevogacao()).toBe(0);
    await esquecido(ws, a);
  });

  it("revogar que falha não impede desconectar: o Google recusa, e o Canal desconecta e esquece do mesmo jeito (só a contagem sobe)", async () => {
    const { ws, admin } = await espaco("falha");
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    const { login, servico, conector } = await conectorReal({ tempoLimiteDaRevogacaoMs: 150 });
    login.enfileirar({ kind: "ok", status: 400, corpo: { error: "invalid_token", error_description: REFRESH_DO_GOOGLE } });

    const desconectado = valor(await servico.desconectar(admin, a));

    expect(login.recebidas).toHaveLength(1);
    expect(desconectado).toMatchObject({ id: a, conexao: "desconectada" });
    expect(conector.falhasDeRevogacao()).toBe(1);
    expect(JSON.stringify(desconectado)).not.toContain(REFRESH_DO_GOOGLE);
    await esquecido(ws, a);
  });

  it("revogar que lança (conector que não cumpre o contrato) também não impede desconectar", async () => {
    const { ws, admin } = await espaco("lanca");
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    const servico = criarServicoDeCanais({
      pool,
      acesso: criarAcessoAoCrmPg(pool),
      conectores: {
        email: {
          async revogar() {
            throw new Error(`falhou com ${REFRESH_DO_GOOGLE}`);
          },
        },
      },
    });
    expect(valor(await servico.desconectar(admin, a))).toMatchObject({ id: a, conexao: "desconectada" });
    await esquecido(ws, a);
  });

  it("servidor de login mudo (tempo esgotado): a desconexão não trava nem falha", async () => {
    const { ws, admin } = await espaco("mudo");
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    const { login, servico, conector } = await conectorReal({ tempoLimiteDaRevogacaoMs: 150 });
    login.enfileirar({ kind: "timeout" });
    valor(await servico.desconectar(admin, a));
    expect(conector.falhasDeRevogacao()).toBe(1);
    await esquecido(ws, a);
  });

  it("arquivar um Canal do Google pede a mesma revogação antes e esquece a caixa", async () => {
    const { ws, admin } = await espaco("arq");
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    const { login, servico } = await conectorReal();
    login.enfileirar({ kind: "ok", status: 200, corpo: {} });

    const arquivado = valor(await servico.arquivar(admin, a));

    expect(arquivado).toMatchObject({ id: a, estado: "arquivado" });
    expect(login.recebidas).toHaveLength(1);
    expect(camposDoPedido(login.recebidas[0]!)).toEqual({ token: REFRESH_DO_GOOGLE });
    await esquecido(ws, a);
  });

  it("Canal por senha ou pela Microsoft: nenhum pedido de revogação sai (o conector real não faz rede)", async () => {
    const { ws, admin } = await espaco("semrede");
    const porSenha = await canalDeEmail(ws, "Senha", daSenha);
    const porMicrosoft = await canalDeEmail(ws, "Microsoft", daMicrosoft);
    const { login, servico, conector } = await conectorReal();

    valor(await servico.desconectar(admin, porSenha));
    valor(await servico.arquivar(admin, porMicrosoft));

    expect(login.recebidas).toHaveLength(0);
    expect(conector.falhasDeRevogacao()).toBe(0);
    await esquecido(ws, porSenha);
    await esquecido(ws, porMicrosoft);
  });

  it("sem o par do Google configurado não há o que revogar: a desconexão segue e a contagem registra", async () => {
    const { ws, admin } = await espaco("semconfig");
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    const conector = criarConectorDoEmail({ pool, chaves: () => CHAVES, configuracaoDoOauth: () => undefined });
    const servico = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool), conectores: { email: conector } });
    valor(await servico.desconectar(admin, a));
    expect(conector.falhasDeRevogacao()).toBe(1);
    await esquecido(ws, a);
  });

  it("Membro sem permissão e transição recusada (já desconectado) não revogam nada", async () => {
    const { ws, admin } = await espaco("recusa");
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    const { login, servico } = await conectorReal();
    login.enfileirar({ kind: "ok", status: 200, corpo: {} });

    expect((await servico.desconectar(sessao(ws, "mem_ana"), a)).ok).toBe(false);
    expect(login.recebidas).toHaveLength(0);
    expect(await credencial(ws, a)).toBeDefined();

    valor(await servico.desconectar(admin, a));
    expect(login.recebidas).toHaveLength(1);
    // Já desconectado: a segunda tentativa é recusada e não pede nada ao Google.
    expect((await servico.desconectar(admin, a)).ok).toBe(false);
    expect(login.recebidas).toHaveLength(1);
  });

  it("sem conectores.email (o serviço dos outros testes), desconectar segue como no 17-05", async () => {
    const { ws, admin } = await espaco("semconector");
    const a = await canalDeEmail(ws, "Vendas", doGoogle);
    const servico = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool) });
    valor(await servico.desconectar(admin, a));
    await esquecido(ws, a);
  });
});
