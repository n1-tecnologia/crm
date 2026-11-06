/**
 * Serviço de Atividades do CRM (15-37, D-15-09), contra o Postgres LOCAL.
 *
 * O traçador: a Atividade que a Nota do Contato grava (15-04) sai por `listar`
 * como `ActivityRecord`. A leitura nunca grava, e o Espaço vem da sessão.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeAtividades } from "./atividades";
import { criarServicoDeNotas } from "./notas";
import type { ResultadoCrm } from "./resultado";

const acesso = criarAcessoAoCrmPg(pool);
const servico = criarServicoDeAtividades({ pool, acesso });
const notas = criarServicoDeNotas({ pool, acesso });

function membro(workspaceId: string, id = "mem_ana"): MembroDaSessao {
  return { id, workspaceId, state: "ativo" };
}

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

describeComBanco("ServicoDeAtividades — Postgres local", () => {
  const ws = novoEspacoDeTeste("svcativ");
  const eu = membro(ws);

  /** Contato por SQL: o serviço de Contatos não é o assunto aqui. */
  async function semearContato(workspaceId: string, nome: string): Promise<string> {
    const { rows } = await pool().query<{ id: string }>(
      "insert into plataforma.contatos (workspace_id, nome, estado, proprietario_id, criado_por) values ($1, $2, 'ativo', 'mem_ana', 'mem_ana') returning id",
      [workspaceId, nome],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await encerrar();
  });

  it("(a) traçador: a Nota registrada no Contato sai de listar como ActivityRecord", async () => {
    const contatoId = await semearContato(ws, "Contato do traçador");
    valor(await notas.adicionar(eu, contatoId, { conteudo: "dado pessoal" }));

    const lidas = valor(await servico.listar(eu, { objetoTipo: "contact", objetoId: contatoId, limite: 50 }));

    expect(lidas).toHaveLength(1);
    expect(lidas[0]).toMatchObject({
      workspaceId: ws,
      actor: { kind: "member", id: "mem_ana" },
      action: "Nota registrada no Contato",
      objectType: "contact",
      objectId: contatoId,
      objectName: "Contato do traçador",
      result: "ok",
    });
    expect(JSON.stringify(lidas)).not.toContain("dado pessoal");
  });
});
