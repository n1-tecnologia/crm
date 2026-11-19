/**
 * A credencial do e-mail e a porta de acesso (17-04, D-17-05). Os casos sem banco usam um `pool` falso que só anota as
 * consultas; o bloco do Postgres LOCAL prova a renovação gravada de verdade no cofre:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55731/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55731/postgres \
 *   npx vitest run src/mensageria/provedores/email/credencial.test.ts
 *
 * Os valores de senha e token abaixo são de teste. O que se prova: só a versão 1 é lida; a senha vira `AutenticacaoDoEmail`;
 * o OAuth renova só quando faltam menos de 5 min e grava a credencial nova; o erro do renovador vira recusa permanente ou
 * transitória; e NENHUM resultado, erro ou frase carrega a senha, o `refreshToken` ou o `accessToken`.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { encerrar, pool } from "../../../persistencia/conexao";
import { lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../../testes/banco-crm";
import type { CanalParaProvedor } from "../../provedor";
import {
  acessoDoEmailDoAmbiente,
  criarAcessoDoEmail,
  ErroDeRenovacao,
  FRASE_AUTORIZACAO_RECUSADA,
  guardarCredencialDoEmail,
  lerCredencialDoEmail,
  TIPO_DA_CREDENCIAL,
  type CredencialDoEmail,
  type RenovadorDeToken,
} from "./credencial";

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };

const SENHA = "senha-de-teste-xyz";
const REFRESH = "refresh-de-teste-123";
const ACCESS = "access-de-teste-456";
const SEGREDOS = [SENHA, REFRESH, ACCESS];

const AGORA = Date.parse("2026-11-19T12:00:00.000Z");
const emMin = (min: number) => new Date(AGORA + min * 60_000).toISOString();

const canalCom = (credencial: string | undefined, ids = { ws: "ws_x", canal: "cnl_x" }): CanalParaProvedor => ({
  workspaceId: ids.ws,
  canal: { id: ids.canal } as unknown as Canal,
  credencial,
});

const json = (c: CredencialDoEmail) => JSON.stringify(c);
const oauth = (extra: Partial<Extract<CredencialDoEmail, { tipo: "oauth" }>> = {}): CredencialDoEmail => ({
  v: 1,
  tipo: "oauth",
  servico: "microsoft",
  usuario: "pessoa@empresa.com",
  refreshToken: REFRESH,
  ...extra,
});

/** Um `pool` falso: anota as consultas e pode fazer o INSERT da credencial falhar (a corrida em `credenciais_ativa_unica`). */
function poolFalso(opcoes: { falharNoInsert?: boolean } = {}) {
  const consultas: string[] = [];
  const parametros: unknown[][] = [];
  let liberados = 0;
  const cliente = {
    async query(texto: string, valores?: unknown[]) {
      const curto = texto.trim().split(/\s+/)[0]!.toLowerCase();
      consultas.push(curto);
      parametros.push(valores ?? []);
      if (opcoes.falharNoInsert && curto === "insert") throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
      return { rows: [{ id: "cred_nova" }], rowCount: 1 };
    },
    release() {
      liberados += 1;
    },
  };
  return { pool: { connect: async () => cliente } as never, consultas, parametros, liberados: () => liberados };
}

/** Tudo que um resultado, um erro ou uma frase pode mostrar, serializado: nenhum dos três segredos pode aparecer. */
function mostra(valor: unknown): string {
  return JSON.stringify(valor, (_chave, v: unknown) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v));
}

describe("lerCredencialDoEmail — o JSON v: 1", () => {
  it("aceita a senha e o OAuth, com e sem o accessToken", () => {
    expect(lerCredencialDoEmail('{"v":1,"tipo":"senha","usuario":"a","senha":"b"}')).toEqual({ v: 1, tipo: "senha", usuario: "a", senha: "b" });
    expect(lerCredencialDoEmail('{"v":1,"tipo":"oauth","servico":"microsoft","usuario":"a@b.com","refreshToken":"r"}')).toEqual({
      v: 1,
      tipo: "oauth",
      servico: "microsoft",
      usuario: "a@b.com",
      refreshToken: "r",
    });
    expect(lerCredencialDoEmail(json(oauth({ servico: "google", accessToken: ACCESS, expiraEm: emMin(30) })))).toMatchObject({ servico: "google", accessToken: ACCESS, expiraEm: emMin(30) });
  });

  it("recusa (undefined) JSON quebrado, versão e tipo desconhecidos, serviço fora de google/microsoft e campo vazio", () => {
    const recusadas: Array<string | undefined> = [
      undefined,
      "",
      "{quebrado",
      "[]",
      "null",
      '"texto"',
      '{"v":2,"tipo":"senha","usuario":"a","senha":"b"}',
      '{"tipo":"senha","usuario":"a","senha":"b"}',
      '{"v":1,"tipo":"cartao","usuario":"a","senha":"b"}',
      '{"v":1,"tipo":"senha","usuario":"","senha":"b"}',
      '{"v":1,"tipo":"senha","usuario":"a","senha":"  "}',
      '{"v":1,"tipo":"senha","usuario":"a"}',
      '{"v":1,"tipo":"oauth","servico":"yahoo","usuario":"a@b.com","refreshToken":"r"}',
      '{"v":1,"tipo":"oauth","usuario":"a@b.com","refreshToken":"r"}',
      '{"v":1,"tipo":"oauth","servico":"google","usuario":"","refreshToken":"r"}',
      '{"v":1,"tipo":"oauth","servico":"google","usuario":"a@b.com","refreshToken":""}',
      // accessToken sem o instante (ou com instante inválido): lixo.
      '{"v":1,"tipo":"oauth","servico":"google","usuario":"a@b.com","refreshToken":"r","accessToken":"t"}',
      '{"v":1,"tipo":"oauth","servico":"google","usuario":"a@b.com","refreshToken":"r","accessToken":"t","expiraEm":"ontem"}',
    ];
    for (const texto of recusadas) expect(lerCredencialDoEmail(texto), String(texto)).toBeUndefined();
  });
});

describe("criarAcessoDoEmail — a porta de acesso", () => {
  it("senha: devolve a autenticação pronta; sem credencial (ou ilegível): CREDENCIAL_AUSENTE permanente", async () => {
    const acesso = criarAcessoDoEmail({ agora: () => AGORA });
    expect(await acesso.acessoParaUsar(canalCom(json({ v: 1, tipo: "senha", usuario: "vendas@caixa.teste", senha: SENHA })))).toEqual({
      ok: true,
      servico: "senha",
      auth: { tipo: "senha", usuario: "vendas@caixa.teste", senha: SENHA },
    });
    for (const credencial of [undefined, "{quebrado", '{"v":2}']) {
      expect(await acesso.acessoParaUsar(canalCom(credencial))).toMatchObject({ ok: false, permanente: true, codigo: "CREDENCIAL_AUSENTE" });
    }
  });

  it("OAuth com accessToken que vence em mais de 5 min: devolve o guardado, sem chamar o renovador nem gravar", async () => {
    const falso = poolFalso();
    let chamadas = 0;
    const acesso = criarAcessoDoEmail({
      pool: () => falso.pool,
      chaves: () => CHAVES,
      agora: () => AGORA,
      renovadores: { microsoft: async () => { chamadas += 1; throw new Error("não devia chamar"); } },
    });
    const resultado = await acesso.acessoParaUsar(canalCom(json(oauth({ accessToken: ACCESS, expiraEm: emMin(6) }))));
    expect(resultado).toEqual({ ok: true, servico: "microsoft", auth: { tipo: "oauth", usuario: "pessoa@empresa.com", accessToken: ACCESS, expiraEm: emMin(6) } });
    expect(chamadas).toBe(0);
    expect(falso.consultas).toEqual([]);
  });

  it("OAuth vencendo em menos de 5 min (ou sem accessToken): renova, grava a credencial nova numa transação própria e devolve o token novo", async () => {
    for (const guardada of [oauth({ accessToken: ACCESS, expiraEm: emMin(2) }), oauth({ accessToken: ACCESS, expiraEm: emMin(-10) }), oauth()]) {
      const falso = poolFalso();
      const recebidos: string[] = [];
      const renovador: RenovadorDeToken = async (refreshToken) => {
        recebidos.push(refreshToken);
        return { accessToken: "access-novo-789", expiraEm: emMin(60), refreshToken: "refresh-novo-000" };
      };
      const acesso = criarAcessoDoEmail({ pool: () => falso.pool, chaves: () => CHAVES, agora: () => AGORA, renovadores: { microsoft: renovador } });

      const resultado = await acesso.acessoParaUsar(canalCom(json(guardada)));

      expect(resultado).toEqual({ ok: true, servico: "microsoft", auth: { tipo: "oauth", usuario: "pessoa@empresa.com", accessToken: "access-novo-789", expiraEm: emMin(60) } });
      expect(recebidos).toEqual([REFRESH]);
      // Revoga a ativa, insere a nova, e as duas valem juntas (begin ... commit); a conexão volta ao pool.
      expect(falso.consultas).toEqual(["begin", "update", "insert", "commit"]);
      expect(falso.liberados()).toBe(1);
    }
  });

  it("o renovador não devolve refreshToken novo: o atual continua guardado", async () => {
    const falso = poolFalso();
    const acesso = criarAcessoDoEmail({
      pool: () => falso.pool,
      chaves: () => CHAVES,
      agora: () => AGORA,
      renovadores: { google: async () => ({ accessToken: "access-novo", expiraEm: emMin(60) }) },
    });
    const resultado = await acesso.acessoParaUsar(canalCom(json(oauth({ servico: "google" }))));
    expect(resultado).toMatchObject({ ok: true, servico: "google" });
    expect(falso.consultas).toEqual(["begin", "update", "insert", "commit"]);
  });

  it("corrida em credenciais_ativa_unica: desfaz a gravação e segue com o token que acabou de receber", async () => {
    const falso = poolFalso({ falharNoInsert: true });
    const acesso = criarAcessoDoEmail({
      pool: () => falso.pool,
      chaves: () => CHAVES,
      agora: () => AGORA,
      renovadores: { microsoft: async () => ({ accessToken: "access-novo", expiraEm: emMin(60) }) },
    });
    const resultado = await acesso.acessoParaUsar(canalCom(json(oauth())));
    expect(resultado).toMatchObject({ ok: true, auth: { accessToken: "access-novo" } });
    expect(falso.consultas).toEqual(["begin", "update", "insert", "rollback"]);
    expect(falso.liberados()).toBe(1);
  });

  it("erro do renovador: permanente vira AUTORIZACAO_RECUSADA; passageiro ou qualquer outro vira RENOVACAO_FALHOU; sem renovador vira OAUTH_NAO_CONFIGURADO", async () => {
    const falso = poolFalso();
    const com = (renovador: RenovadorDeToken | undefined) =>
      criarAcessoDoEmail({ pool: () => falso.pool, chaves: () => CHAVES, agora: () => AGORA, renovadores: renovador ? { microsoft: renovador } : {} });
    const canal = canalCom(json(oauth()));

    expect(await com(async () => { throw new ErroDeRenovacao(true); }).acessoParaUsar(canal)).toMatchObject({ ok: false, permanente: true, codigo: "AUTORIZACAO_RECUSADA" });
    expect(await com(async () => { throw new ErroDeRenovacao(false); }).acessoParaUsar(canal)).toMatchObject({ ok: false, permanente: false, codigo: "RENOVACAO_FALHOU" });
    expect(await com(async () => { throw new Error(`falha com ${REFRESH}`); }).acessoParaUsar(canal)).toMatchObject({ ok: false, permanente: false, codigo: "RENOVACAO_FALHOU" });
    expect(await com(undefined).acessoParaUsar(canal)).toMatchObject({ ok: false, permanente: false, codigo: "OAUTH_NAO_CONFIGURADO" });
    // Nenhuma dessas recusas grava nada.
    expect(falso.consultas).toEqual([]);
  });

  it("a recusa permanente leva a frase de produto do serviço a motivo; sem frase, a frase padrão", async () => {
    const falso = poolFalso();
    const com = (erro: ErroDeRenovacao) =>
      criarAcessoDoEmail({ pool: () => falso.pool, chaves: () => CHAVES, agora: () => AGORA, renovadores: { microsoft: async () => { throw erro; } } });
    const canal = canalCom(json(oauth()));
    expect(await com(new ErroDeRenovacao(true, "A autorização da Microsoft venceu ou foi retirada: entre de novo com a Microsoft.")).acessoParaUsar(canal)).toMatchObject({
      ok: false,
      permanente: true,
      motivo: "A autorização da Microsoft venceu ou foi retirada: entre de novo com a Microsoft.",
    });
    expect(await com(new ErroDeRenovacao(true)).acessoParaUsar(canal)).toMatchObject({ ok: false, permanente: true, motivo: FRASE_AUTORIZACAO_RECUSADA });
  });

  it("renovações ao mesmo tempo do mesmo Canal são uma só (serializadas); de Canais diferentes, cada uma a sua", async () => {
    const falso = poolFalso();
    let idas = 0;
    const acesso = criarAcessoDoEmail({
      pool: () => falso.pool,
      chaves: () => CHAVES,
      agora: () => AGORA,
      renovadores: {
        microsoft: async () => {
          idas += 1;
          await new Promise((resolver) => setTimeout(resolver, 20));
          return { accessToken: "access-novo", expiraEm: emMin(60), refreshToken: "refresh-novo" };
        },
      },
    });
    const um = canalCom(json(oauth()), { ws: "ws_x", canal: "cnl_1" });
    await Promise.all([acesso.acessoParaUsar(um), acesso.acessoParaUsar(um), acesso.acessoParaUsar(um)]);
    expect(idas).toBe(1);
    await Promise.all([acesso.acessoParaUsar(um), acesso.acessoParaUsar(canalCom(json(oauth()), { ws: "ws_x", canal: "cnl_2" }))]);
    expect(idas).toBe(3);
  });

  it("acessoDoEmailDoAmbiente monta a porta sem renovadores (o login chega nos planos 17-12 e 17-13)", async () => {
    const acesso = acessoDoEmailDoAmbiente({});
    expect(await acesso.acessoParaUsar(canalCom(json(oauth())))).toMatchObject({ ok: false, codigo: "OAUTH_NAO_CONFIGURADO", permanente: false });
    expect(await acesso.acessoParaUsar(canalCom(json({ v: 1, tipo: "senha", usuario: "a", senha: SENHA })))).toMatchObject({ ok: true });
  });

  it("nenhum resultado carrega a senha nem o token (fora da autenticação pronta), e o erro do renovador não vaza o token", async () => {
    const falso = poolFalso();
    const comRenovador = (renovador: RenovadorDeToken) =>
      criarAcessoDoEmail({ pool: () => falso.pool, chaves: () => CHAVES, agora: () => AGORA, renovadores: { microsoft: renovador } });

    // Toda recusa (sem `ok`) é serializada inteira: nada de senha nem token.
    const recusas = [
      await criarAcessoDoEmail({ agora: () => AGORA }).acessoParaUsar(canalCom(`{"v":2,"senha":"${SENHA}","refreshToken":"${REFRESH}","accessToken":"${ACCESS}"}`)),
      await comRenovador(async () => { throw new ErroDeRenovacao(true); }).acessoParaUsar(canalCom(json(oauth({ accessToken: ACCESS, expiraEm: emMin(1) })))),
      await comRenovador(async () => { throw new Error(`o servidor devolveu ${REFRESH} e ${ACCESS}`); }).acessoParaUsar(canalCom(json(oauth({ accessToken: ACCESS, expiraEm: emMin(1) })))),
      await criarAcessoDoEmail({ agora: () => AGORA }).acessoParaUsar(canalCom(json(oauth({ accessToken: ACCESS, expiraEm: emMin(1) })))),
    ];
    for (const recusa of recusas) {
      expect(recusa.ok).toBe(false);
      const texto = mostra(recusa);
      for (const segredo of SEGREDOS) expect(texto).not.toContain(segredo);
    }

    // O erro do renovador, serializado com a pilha, também não leva o token.
    for (const permanente of [true, false]) {
      const texto = mostra(new ErroDeRenovacao(permanente));
      for (const segredo of SEGREDOS) expect(texto).not.toContain(segredo);
    }

    // As frases fixas de recusa.
    const frases = recusas.flatMap((r) => (r.ok ? [] : [r.motivo]));
    expect(frases.length).toBe(recusas.length);
    for (const frase of frases) for (const segredo of SEGREDOS) expect(frase).not.toContain(segredo);
  });
});

describeComBanco("a porta de acesso com o cofre — Postgres local", () => {
  const espacos: string[] = [];

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  async function canal() {
    const ws = novoEspacoDeTeste("em_cred");
    espacos.push(ws);
    const canalId = await semearCanal(ws, { nome: "Vendas", tipo: "email", provedor: "email-imap-smtp", identificadorExterno: "vendas@caixa.teste", conexao: "conectada" });
    return { ws, canalId };
  }

  const dono = (ws: string, canalId: string) => ({ workspaceId: ws, donoTipo: "canal" as const, donoId: canalId, tipo: TIPO_DA_CREDENCIAL });

  it("guardarCredencialDoEmail cifra no cofre e a leitura devolve o JSON v: 1; a senha vira a autenticação pela porta", async () => {
    const { ws, canalId } = await canal();
    await guardarCredencialDoEmail(pool(), CHAVES, { workspaceId: ws, canalId }, { v: 1, tipo: "senha", usuario: "vendas@caixa.teste", senha: SENHA });

    const texto = await lerCredencial(pool(), CHAVES, dono(ws, canalId));
    expect(lerCredencialDoEmail(texto)).toEqual({ v: 1, tipo: "senha", usuario: "vendas@caixa.teste", senha: SENHA });
    // Na tabela só há o cifrado: o texto da senha não aparece em nenhuma coluna.
    const { rows } = await pool().query("select * from plataforma.credenciais where workspace_id = $1 and dono_id = $2", [ws, canalId]);
    expect(JSON.stringify(rows)).not.toContain(SENHA);

    const acesso = criarAcessoDoEmail({ pool, chaves: () => CHAVES, agora: () => AGORA });
    expect(await acesso.acessoParaUsar({ workspaceId: ws, canal: { id: canalId } as unknown as Canal, credencial: texto })).toMatchObject({
      ok: true,
      auth: { tipo: "senha", senha: SENHA },
    });
  });

  it("a renovação grava no cofre o refreshToken novo e o token novo; a segunda chamada logo depois NÃO renova", async () => {
    const { ws, canalId } = await canal();
    await guardarCredencialDoEmail(pool(), CHAVES, { workspaceId: ws, canalId }, oauth({ accessToken: ACCESS, expiraEm: emMin(2) }));
    let renovacoes = 0;
    const acesso = criarAcessoDoEmail({
      pool,
      chaves: () => CHAVES,
      agora: () => AGORA,
      renovadores: {
        microsoft: async () => {
          renovacoes += 1;
          return { accessToken: "access-novo-789", expiraEm: emMin(60), refreshToken: "refresh-novo-000" };
        },
      },
    });
    const doCofre = async () => ({ workspaceId: ws, canal: { id: canalId } as unknown as Canal, credencial: await lerCredencial(pool(), CHAVES, dono(ws, canalId)) });

    expect(await acesso.acessoParaUsar(await doCofre())).toMatchObject({ ok: true, auth: { accessToken: "access-novo-789" } });
    expect(renovacoes).toBe(1);
    expect(lerCredencialDoEmail((await doCofre()).credencial)).toMatchObject({ refreshToken: "refresh-novo-000", accessToken: "access-novo-789", expiraEm: emMin(60) });

    // O token novo vale mais de 5 min: a segunda chamada devolve o guardado e não renova.
    expect(await acesso.acessoParaUsar(await doCofre())).toMatchObject({ ok: true, auth: { accessToken: "access-novo-789" } });
    expect(renovacoes).toBe(1);
    // Uma só credencial ativa (a anterior foi revogada).
    const ativas = await pool().query("select 1 from plataforma.credenciais where workspace_id = $1 and dono_id = $2 and tipo = $3 and revogado_em is null", [ws, canalId, TIPO_DA_CREDENCIAL]);
    expect(ativas.rowCount).toBe(1);
  });
});
