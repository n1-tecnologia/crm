/**
 * `comTransacao` e `traduzirErroDePg` (07-02).
 *
 * A primeira parte roda sempre: a tradução de SQLSTATE sobre erros fabricados.
 * A segunda (`describeComBanco`) prova a transação no Postgres LOCAL: commit,
 * rollback por recusa, o constraint trigger deferido que só dispara no
 * `commit` (Pitfall 1) e o unique violado traduzido sem expor o nome do
 * constraint (T-07-06).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../../testes/banco-crm";
import { recusa, sucesso } from "./resultado";
import { comTransacao, traduzirErroDePg, type FrasesDeRestricao } from "./transacao";

const FRASES: FrasesDeRestricao = {
  contato_identificadores_unico: { codigo: "IDENTIFICADOR_EM_USO", error: "Esse e-mail já pertence a outro Contato." },
  empresa_exige_admin: { codigo: "EMPRESA_SEM_ADMIN", error: "Toda Empresa precisa de ao menos um Contato admin." },
};

function erroDePg(code: string, constraint?: string): Error {
  return Object.assign(new Error(`falha ${code} em ${constraint ?? "?"}`), { code, constraint });
}

describe("traduzirErroDePg — erros fabricados, sem banco", () => {
  it.each(["23505", "23503", "23514"])("SQLSTATE %s com constraint conhecido vira 409 com a frase", (code) => {
    const traduzido = traduzirErroDePg(erroDePg(code, "contato_identificadores_unico"), FRASES);
    expect(traduzido).toEqual({
      status: 409,
      error: "Esse e-mail já pertence a outro Contato.",
      codigo: "IDENTIFICADOR_EM_USO",
    });
  });

  it("a frase pode pedir 404", () => {
    const traduzido = traduzirErroDePg(erroDePg("23503", "fk_x"), {
      fk_x: { codigo: "NAO_ENCONTRADO", error: "Não existe.", status: 404 },
    });
    expect(traduzido?.status).toBe(404);
  });

  it("nunca expõe o nome do constraint no texto", () => {
    const traduzido = traduzirErroDePg(erroDePg("23505", "contato_identificadores_unico"), FRASES);
    expect(traduzido?.error).not.toContain("contato_identificadores_unico");
  });

  it("SQLSTATE sem frase conhecida não é traduzido", () => {
    expect(traduzirErroDePg(erroDePg("23505", "outro_constraint"), FRASES)).toBeUndefined();
    expect(traduzirErroDePg(erroDePg("23505"), FRASES)).toBeUndefined();
    expect(traduzirErroDePg(erroDePg("42P01", "contato_identificadores_unico"), FRASES)).toBeUndefined();
    expect(traduzirErroDePg(new Error("qualquer"), FRASES)).toBeUndefined();
    expect(traduzirErroDePg("texto", FRASES)).toBeUndefined();
  });
});

describeComBanco("comTransacao — Postgres local", () => {
  const espaco = novoEspacoDeTeste("transacao");

  async function contarContatos(nome: string): Promise<number> {
    const r = await pool().query("select 1 from plataforma.contatos where workspace_id = $1 and nome = $2", [
      espaco,
      nome,
    ]);
    return r.rowCount ?? 0;
  }

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    await limparEspaco(espaco);
    await encerrar();
  });

  it("(a) fn que devolve sucesso faz commit: a linha persiste", async () => {
    const resultado = await comTransacao(pool, async (cliente) => {
      await cliente.query(
        "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'comita', 'm', 'm')",
        [espaco],
      );
      return sucesso("feito");
    });
    expect(resultado).toEqual({ ok: true, valor: "feito" });
    expect(await contarContatos("comita")).toBe(1);
  });

  it("(b) fn que devolve recusa faz rollback: nada persiste e a mesma recusa volta", async () => {
    const resultado = await comTransacao(pool, async (cliente) => {
      await cliente.query(
        "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'desfaz', 'm', 'm')",
        [espaco],
      );
      return recusa(409, "Não pode.", { codigo: "X" });
    });
    expect(resultado).toEqual({ ok: false, status: 409, error: "Não pode.", codigo: "X" });
    expect(await contarContatos("desfaz")).toBe(0);
  });

  it("(c) Empresa sem Contato admin falha no commit (trigger deferido) e vira 409 com a frase", async () => {
    const inserirEmpresa = async (cliente: Parameters<Parameters<typeof comTransacao>[1]>[0]) => {
      await cliente.query(
        "insert into plataforma.empresas (workspace_id, nome_fantasia, proprietario_id, criado_por) values ($1, 'Sem Admin', 'm', 'm')",
        [espaco],
      );
      return sucesso("inseriu");
    };
    const resultado = await comTransacao(pool, inserirEmpresa, FRASES);
    expect(resultado).toEqual({
      ok: false,
      status: 409,
      error: "Toda Empresa precisa de ao menos um Contato admin.",
      codigo: "EMPRESA_SEM_ADMIN",
    });
    const gravada = await pool().query("select 1 from plataforma.empresas where workspace_id = $1", [espaco]);
    expect(gravada.rowCount).toBe(0);
  });

  it("(d) 23505 em contato_identificadores_unico é traduzido pela frase passada", async () => {
    const criarContatoComEmail = async (cliente: Parameters<Parameters<typeof comTransacao>[1]>[0], nome: string) => {
      const contato = await cliente.query<{ id: string }>(
        "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, $2, 'm', 'm') returning id",
        [espaco, nome],
      );
      await cliente.query(
        "insert into plataforma.contato_identificadores (workspace_id, contato_id, tipo, valor) values ($1, $2, 'email', 'dup@exemplo.com')",
        [espaco, contato.rows[0]?.id],
      );
      return sucesso(nome);
    };

    const primeiro = await comTransacao(pool, (c) => criarContatoComEmail(c, "primeiro"), FRASES);
    expect(primeiro.ok).toBe(true);

    const segundo = await comTransacao(pool, (c) => criarContatoComEmail(c, "segundo"), FRASES);
    expect(segundo).toEqual({
      ok: false,
      status: 409,
      error: "Esse e-mail já pertence a outro Contato.",
      codigo: "IDENTIFICADOR_EM_USO",
    });
    expect(await contarContatos("segundo")).toBe(0);
  });

  it("(d) erro sem frase conhecida é relançado, com rollback e a conexão devolvida", async () => {
    const semFrase = comTransacao(pool, async (cliente) => {
      await cliente.query(
        "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'relanca', 'm', 'm')",
        [espaco],
      );
      await cliente.query("select * from plataforma.tabela_que_nao_existe");
      return sucesso("nunca");
    });
    await expect(semFrase).rejects.toMatchObject({ code: "42P01" });
    expect(await contarContatos("relanca")).toBe(0);

    // O mesmo unique violado sem a frase correspondente também é relançado.
    const duplicado = comTransacao(
      pool,
      async (cliente) => {
        const contato = await cliente.query<{ id: string }>(
          "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'terceiro', 'm', 'm') returning id",
          [espaco],
        );
        await cliente.query(
          "insert into plataforma.contato_identificadores (workspace_id, contato_id, tipo, valor) values ($1, $2, 'email', 'dup@exemplo.com')",
          [espaco, contato.rows[0]?.id],
        );
        return sucesso("x");
      },
      {},
    );
    await expect(duplicado).rejects.toMatchObject({ code: "23505" });
  });
});
