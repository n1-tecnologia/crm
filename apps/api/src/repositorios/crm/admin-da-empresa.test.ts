/**
 * Prova SQL do constraint trigger "toda Empresa tem ao menos um Contato admin
 * vigente" depois da correção de D-12 (07-05), contra o Postgres 16 LOCAL.
 *
 * D-08 manda encerrar os vínculos ao enviar a Empresa à lixeira. A versão
 * anterior da 007 recusava isso no commit (Pitfall 2): `crm_confere_admin` não
 * olhava o `estado`. Agora a Empresa na lixeira não exige admin, e VOLTAR da
 * lixeira (ou qualquer troca de estado) exige. Cada caso roda numa transação
 * própria e lê `code`/`constraint` do erro do `pg` no commit — é nele que o
 * trigger deferido dispara.
 *
 * Só roda com `DATABASE_URL` apontando para o Postgres local (`banco-crm.ts`).
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../../testes/banco-crm";

describeComBanco("trigger de admin da Empresa (007, D-12) — Postgres local", () => {
  const ws = novoEspacoDeTeste("admintrigger");

  /** O desfecho do commit numa linha só: `ok`, ou `<sqlstate>/<constraint>` do erro do `pg`. */
  const OK = "ok";
  const SEM_ADMIN = "23514/empresa_exige_admin";

  /** Roda `corpo` numa transação e devolve o desfecho do commit. */
  async function transacao(corpo: (c: PoolClient) => Promise<void>): Promise<string> {
    const c = await pool().connect();
    try {
      await c.query("begin");
      await corpo(c);
      await c.query("commit");
      return OK;
    } catch (erro) {
      try {
        await c.query("rollback");
      } catch {
        // a conexão pode já estar fora da transação
      }
      const { code, constraint } = erro as { code?: string; constraint?: string };
      return `${code ?? "?"}/${constraint ?? "?"}`;
    } finally {
      c.release();
    }
  }

  async function novoContato(c: PoolClient, nome: string): Promise<string> {
    const r = await c.query<{ id: string }>(
      "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, $2, 'mem_ana', 'mem_ana') returning id",
      [ws, nome],
    );
    return r.rows[0]!.id;
  }

  async function novaEmpresa(c: PoolClient, estado = "ativo"): Promise<string> {
    const r = await c.query<{ id: string }>(
      "insert into plataforma.empresas (workspace_id, nome_fantasia, estado, proprietario_id, criado_por) values ($1, 'Acme', $2, 'mem_ana', 'mem_ana') returning id",
      [ws, estado],
    );
    return r.rows[0]!.id;
  }

  async function vincular(c: PoolClient, contatoId: string, empresaId: string, admin = true): Promise<string> {
    const r = await c.query<{ id: string }>(
      "insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, $4, 'mem_ana') returning id",
      [ws, contatoId, empresaId, admin],
    );
    return r.rows[0]!.id;
  }

  /** Uma Empresa com um admin, já commitada, no estado pedido. */
  async function empresaComAdmin(estado = "ativo"): Promise<{ empresaId: string; contatoId: string; vinculoId: string }> {
    let ids = { empresaId: "", contatoId: "", vinculoId: "" };
    const erro = await transacao(async (c) => {
      const contatoId = await novoContato(c, "Admin");
      const empresaId = await novaEmpresa(c, estado);
      const vinculoId = await vincular(c, contatoId, empresaId);
      ids = { empresaId, contatoId, vinculoId };
    });
    expect(erro).toBe(OK);
    return ids;
  }

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await encerrar();
  });

  it("(a) Empresa e vínculo admin na mesma transação: o commit passa", async () => {
    const erro = await transacao(async (c) => {
      const contatoId = await novoContato(c, "Bia");
      const empresaId = await novaEmpresa(c);
      await vincular(c, contatoId, empresaId);
    });
    expect(erro).toBe(OK);
  });

  it("(b) lixeira + fim no único vínculo admin na mesma transação: o commit passa (D-08)", async () => {
    const { empresaId, vinculoId } = await empresaComAdmin();
    const erro = await transacao(async (c) => {
      await c.query("update plataforma.empresas set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, empresaId]);
      await c.query("update plataforma.contato_empresa set fim = current_date where workspace_id = $1 and id = $2", [ws, vinculoId]);
    });
    expect(erro).toBe(OK);
  });

  it("(c) Empresa sem admin vigente: criar ativa ou voltar da lixeira falha no commit com empresa_exige_admin", async () => {
    const semAdmin = await transacao(async (c) => {
      await novaEmpresa(c);
    });
    expect(semAdmin).toBe(SEM_ADMIN);

    const { empresaId, vinculoId } = await empresaComAdmin();
    await transacao(async (c) => {
      await c.query("update plataforma.empresas set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, empresaId]);
      await c.query("update plataforma.contato_empresa set fim = current_date where workspace_id = $1 and id = $2", [ws, vinculoId]);
    });
    const restaurada = await transacao(async (c) => {
      await c.query("update plataforma.empresas set estado = 'ativo' where workspace_id = $1 and id = $2", [ws, empresaId]);
    });
    expect(restaurada).toBe(SEM_ADMIN);
  });

  it("(d) voltar da lixeira com um novo vínculo admin na mesma transação: o commit passa", async () => {
    const { empresaId, vinculoId } = await empresaComAdmin();
    expect(
      await transacao(async (c) => {
        await c.query("update plataforma.empresas set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, empresaId]);
        await c.query("update plataforma.contato_empresa set fim = current_date where workspace_id = $1 and id = $2", [ws, vinculoId]);
      }),
    ).toBe(OK);
    const erro = await transacao(async (c) => {
      const novo = await novoContato(c, "Novo admin");
      await c.query("update plataforma.empresas set estado = 'ativo' where workspace_id = $1 and id = $2", [ws, empresaId]);
      await vincular(c, novo, empresaId);
    });
    expect(erro).toBe(OK);
  });

  it("(e) Empresa ativa que perde o último admin (rebaixar, encerrar ou apagar o vínculo) falha no commit", async () => {
    const esperado = SEM_ADMIN;

    const rebaixar = await empresaComAdmin();
    expect(
      await transacao(async (c) => {
        await c.query("update plataforma.contato_empresa set admin = false where workspace_id = $1 and id = $2", [ws, rebaixar.vinculoId]);
      }),
    ).toBe(esperado);

    const encerrarVinculo = await empresaComAdmin();
    expect(
      await transacao(async (c) => {
        await c.query("update plataforma.contato_empresa set fim = current_date where workspace_id = $1 and id = $2", [
          ws,
          encerrarVinculo.vinculoId,
        ]);
      }),
    ).toBe(esperado);

    const apagar = await empresaComAdmin();
    expect(
      await transacao(async (c) => {
        await c.query("delete from plataforma.contato_empresa where workspace_id = $1 and id = $2", [ws, apagar.vinculoId]);
      }),
    ).toBe(esperado);
  });

  it("(f) Empresa arquivada continua exigindo admin", async () => {
    const { vinculoId } = await empresaComAdmin("arquivado");
    const erro = await transacao(async (c) => {
      await c.query("update plataforma.contato_empresa set fim = current_date where workspace_id = $1 and id = $2", [ws, vinculoId]);
    });
    expect(erro).toBe(SEM_ADMIN);
  });
});
