/**
 * Serviço de Notas do Contato (14-06, 3.2.7), contra o Postgres LOCAL.
 *
 * A nota nasce com o Membro da sessão como autor (T-14-13), só entra em Contato
 * `ativo` ou `arquivado` deste Espaço (T-14-14) e volta da mais recente para a
 * mais antiga. O Contato `mesclado` entra por SQL, porque só a mesclagem (14-09)
 * grava esse estado.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, poolDoDono, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { listar as listarAtividades, registrarAtividade } from "../../repositorios/crm/atividades";
import { criarRepositorioDeNotasPg } from "../../repositorios/crm/notas";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeNotas } from "./notas";
import type { ResultadoCrm } from "./resultado";
import { comTransacao } from "./transacao";

const servico = criarServicoDeNotas({ pool, acesso: criarAcessoAoCrmPg(pool) });

function membro(workspaceId: string, id = "mem_ana"): MembroDaSessao {
  return { id, workspaceId, state: "ativo" };
}

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

describeComBanco("ServicoDeNotas — Postgres local", () => {
  const ws = novoEspacoDeTeste("svcnotas");
  const outroWs = novoEspacoDeTeste("svcnotasb");
  const eu = membro(ws);

  /** Contato por SQL: o serviço de Contatos não é o assunto aqui. */
  async function semearContato(workspaceId: string, nome: string, estado = "ativo"): Promise<string> {
    const { rows } = await pool().query<{ id: string }>(
      "insert into plataforma.contatos (workspace_id, nome, estado, proprietario_id, criado_por) values ($1, $2, $3, 'mem_ana', 'mem_ana') returning id",
      [workspaceId, nome, estado],
    );
    return rows[0]!.id;
  }

  const notasNoBanco = async (contatoId: string) =>
    (
      await pool().query<{ conteudo: string; autor_id: string }>(
        "select conteudo, autor_id from plataforma.contato_notas where workspace_id = $1 and contato_id = $2 order by criado_em, id",
        [ws, contatoId],
      )
    ).rows;

  beforeAll(async () => {
    await prepararBancoCrm();
    for (const espaco of [ws, outroWs]) {
      await semearMembro(espaco, { id: "mem_ana", base: "membro", state: "ativo" });
      await semearMembro(espaco, { id: "mem_convidado", base: "convidado", state: "ativo" });
    }
    await semearMembro(ws, { id: "mem_bia", base: "membro", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
    await encerrar();
  });

  it("(a) adicionar grava a linha com o Membro da sessão como autor e devolve a nota", async () => {
    const contatoId = await semearContato(ws, "Com nota");
    const nota = valor(await servico.adicionar(membro(ws, "mem_bia"), contatoId, { conteudo: "  Pediu retorno na sexta.  " }));
    expect(nota).toMatchObject({ contatoId, conteudo: "Pediu retorno na sexta.", autorId: "mem_bia" });
    expect(await notasNoBanco(contatoId)).toEqual([{ conteudo: "Pediu retorno na sexta.", autor_id: "mem_bia" }]);
  });

  it("(b) listar devolve a mais recente primeiro, com o total, e pagina", async () => {
    const contatoId = await semearContato(ws, "Várias notas");
    for (const conteudo of ["primeira", "segunda", "terceira"]) {
      valor(await servico.adicionar(eu, contatoId, { conteudo }));
    }
    const todas = valor(await servico.listar(eu, contatoId, { limite: 50, deslocamento: 0 }));
    expect(todas.total).toBe(3);
    expect(todas.itens.map((n) => n.conteudo)).toEqual(["terceira", "segunda", "primeira"]);
    const segundaPagina = valor(await servico.listar(eu, contatoId, { limite: 2, deslocamento: 2 }));
    expect(segundaPagina.total).toBe(3);
    expect(segundaPagina.itens.map((n) => n.conteudo)).toEqual(["primeira"]);
  });

  it("(c) nota em branco é 400 com o campo conteudo e nada é gravado", async () => {
    const contatoId = await semearContato(ws, "Nota vazia");
    const recusa = recusado(await servico.adicionar(eu, contatoId, { conteudo: "   " }));
    expect(recusa).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "conteudo" });
    expect(await notasNoBanco(contatoId)).toEqual([]);
  });

  it("(d) Contato mesclado recusa a nota (409 NOTA_RECUSADA) e continua legível", async () => {
    const absorvido = await semearContato(ws, "Absorvido");
    const sobrevivente = await semearContato(ws, "Sobrevivente");
    valor(await servico.adicionar(eu, absorvido, { conteudo: "de antes da mesclagem" }));
    await poolDoDono().query(
      "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
      [ws, absorvido, sobrevivente],
    );
    const recusa = recusado(await servico.adicionar(eu, absorvido, { conteudo: "tarde demais" }));
    expect(recusa).toMatchObject({ status: 409, codigo: "NOTA_RECUSADA" });
    expect(recusa.error).toBe("Um Contato mesclado é somente leitura. Escreva a nota no Contato que ficou.");
    expect(await notasNoBanco(absorvido)).toHaveLength(1);
    expect(valor(await servico.listar(eu, absorvido, { limite: 50, deslocamento: 0 })).total).toBe(1);
  });

  it("(e) Contato na lixeira recusa a nota; o arquivado aceita", async () => {
    const naLixeira = await semearContato(ws, "Na lixeira", "na_lixeira");
    const arquivado = await semearContato(ws, "Arquivado", "arquivado");
    expect(recusado(await servico.adicionar(eu, naLixeira, { conteudo: "oi" }))).toMatchObject({ status: 409, codigo: "NOTA_RECUSADA" });
    valor(await servico.adicionar(eu, arquivado, { conteudo: "oi" }));
  });

  it("(f) Contato de outro Espaço é 404 para listar e para adicionar (T-14-14)", async () => {
    const deOutro = await semearContato(outroWs, "De outro Espaço");
    expect(recusado(await servico.listar(eu, deOutro, { limite: 50, deslocamento: 0 }))).toMatchObject({ status: 404, codigo: "CONTATO_NAO_ENCONTRADO" });
    expect(recusado(await servico.adicionar(eu, deOutro, { conteudo: "invasão" }))).toMatchObject({ status: 404, codigo: "CONTATO_NAO_ENCONTRADO" });
    const { rows } = await pool().query("select 1 from plataforma.contato_notas where workspace_id = $1", [outroWs]);
    expect(rows).toHaveLength(0);
  });

  it("(g) Convidado lê as notas, mas adicionar é 403 e nada é gravado", async () => {
    const contatoId = await semearContato(ws, "Para o Convidado");
    valor(await servico.adicionar(eu, contatoId, { conteudo: "visível" }));
    const convidado = membro(ws, "mem_convidado");
    expect(recusado(await servico.adicionar(convidado, contatoId, { conteudo: "tentativa" })).status).toBe(403);
    expect(valor(await servico.listar(convidado, contatoId, { limite: 50, deslocamento: 0 })).total).toBe(1);
    expect(await notasNoBanco(contatoId)).toHaveLength(1);
  });

  const atividadesNoBanco = async (contatoId: string) =>
    (
      await pool().query<{ acao: string; objeto_tipo: string; objeto_id: string; objeto_nome: string; ator_tipo: string; ator_id: string; detalhe: string | null }>(
        "select acao, objeto_tipo, objeto_id, objeto_nome, ator_tipo, ator_id, detalhe from plataforma.crm_atividades where workspace_id = $1 and objeto_id = $2 order by em, id",
        [ws, contatoId],
      )
    ).rows;

  it("(h) adicionar grava a Atividade \"Nota registrada no Contato\" no mesmo commit, sem o conteúdo da nota (D-15-09, T-15-14)", async () => {
    const contatoId = await semearContato(ws, "Contato da Atividade");
    valor(await servico.adicionar(membro(ws, "mem_bia"), contatoId, { conteudo: "dado pessoal que não pode vazar" }));
    const atividades = await atividadesNoBanco(contatoId);
    expect(atividades).toEqual([
      {
        acao: "Nota registrada no Contato",
        objeto_tipo: "contact",
        objeto_id: contatoId,
        objeto_nome: "Contato da Atividade",
        ator_tipo: "member",
        ator_id: "mem_bia",
        detalhe: null,
      },
    ]);
    expect(JSON.stringify(atividades)).not.toContain("dado pessoal");
  });

  it("(i) o repositório devolve a Atividade como ActivityRecord, com a data em ISO", async () => {
    const contatoId = await semearContato(ws, "Contato da leitura");
    valor(await servico.adicionar(eu, contatoId, { conteudo: "uma nota" }));
    const lidas = await listarAtividades(pool(), ws, { objetoTipo: "contact", objetoId: contatoId, limite: 50 }, ["contact"]);
    expect(lidas).toHaveLength(1);
    expect(lidas[0]).toMatchObject({
      workspaceId: ws,
      actor: { kind: "member", id: "mem_ana" },
      action: "Nota registrada no Contato",
      objectType: "contact",
      objectId: contatoId,
      objectName: "Contato da leitura",
      result: "ok",
    });
    expect(new Date(lidas[0]!.at).toISOString()).toBe(lidas[0]!.at);
    // Outro tipo permitido não enxerga a Atividade do Contato (a leitura respeita o que o Papel pode ver).
    expect(await listarAtividades(pool(), ws, { objetoTipo: "contact", objetoId: contatoId, limite: 50 }, ["deal"])).toEqual([]);
    // Outro Espaço não enxerga a Atividade deste.
    expect(await listarAtividades(pool(), outroWs, { objetoTipo: "contact", objetoId: contatoId, limite: 50 }, ["contact"])).toEqual([]);
  });

  it("(j) um gesto que lança depois de registrarAtividade não deixa linha em contato_notas nem em crm_atividades", async () => {
    const contatoId = await semearContato(ws, "Contato do rollback");
    await expect(
      comTransacao(pool, async (cliente) => {
        await criarRepositorioDeNotasPg(cliente).inserir(ws, contatoId, "vai desfazer", "mem_ana");
        await registrarAtividade(cliente, ws, {
          ator: { kind: "member", id: "mem_ana" },
          acao: "Nota registrada no Contato",
          objetoTipo: "contact",
          objetoId: contatoId,
          objetoNome: "Contato do rollback",
        });
        throw new Error("falha depois da Atividade");
      }),
    ).rejects.toThrow("falha depois da Atividade");
    expect(await notasNoBanco(contatoId)).toEqual([]);
    expect(await atividadesNoBanco(contatoId)).toEqual([]);
  });

  it("(k) se o serviço falha depois de gravar a Atividade, nem a nota nem a Atividade ficam", async () => {
    const contatoId = await semearContato(ws, "Contato da falha no serviço");
    // Um pool cujo cliente lança LOGO DEPOIS do insert em crm_atividades: o commit nunca acontece.
    const poolQueFalha = () =>
      ({
        connect: async () => {
          const cliente = await pool().connect();
          const original = cliente.query.bind(cliente) as (...args: unknown[]) => Promise<unknown>;
          (cliente as unknown as { query: unknown }).query = async (...args: unknown[]) => {
            const resultado = await original(...args);
            if (typeof args[0] === "string" && /insert into plataforma\.crm_atividades/.test(args[0])) throw new Error("falha depois da Atividade");
            return resultado;
          };
          return cliente;
        },
      }) as never;
    const servicoQueFalha = criarServicoDeNotas({ pool: poolQueFalha, acesso: criarAcessoAoCrmPg(pool) });
    await expect(servicoQueFalha.adicionar(eu, contatoId, { conteudo: "não pode ficar" })).rejects.toThrow("falha depois da Atividade");
    expect(await notasNoBanco(contatoId)).toEqual([]);
    expect(await atividadesNoBanco(contatoId)).toEqual([]);
  });
});
