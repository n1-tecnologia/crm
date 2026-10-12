/**
 * Serviço de Contatos completo (07-03, Task 2), contra o Postgres LOCAL.
 *
 * Os casos (a)-(i) do plano: criação com normalização e principal por tipo,
 * RN-CON-11 (Identificador já de outro Contato), edição, Identificadores como
 * sub-recurso, D-09 (último admin / Contato de Negócio), lixeira, exclusão
 * permanente, isolamento entre Espaços e Papel. Empresa, vínculo, Funil, Etapa
 * e Negócio de apoio entram por SQL direto, numa transação, porque os serviços
 * deles chegam em 07-04/07-05/07-08.
 *
 * Rode com `TZ=America/Sao_Paulo` para provar a data civil (Pitfall 5).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ContatoDetalhado, NovoContato } from "@n1/dominio/crm/contatos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeContatos, FRASES_DE_CONTATOS } from "./contatos";
import type { ResultadoCrm } from "./resultado";
import { traduzirErroDePg } from "./transacao";

const servico = criarServicoDeContatos({ pool, acesso: criarAcessoAoCrmPg(pool) });

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

describeComBanco("ServicoDeContatos — Postgres local", () => {
  const ws = novoEspacoDeTeste("svccontatos");
  const outroWs = novoEspacoDeTeste("svccontatosb");
  const eu = membro(ws);

  const criar = async (entrada: NovoContato, quem = eu): Promise<ContatoDetalhado> => valor(await servico.criar(quem, entrada));
  const estadoNoBanco = async (id: string): Promise<string | undefined> =>
    (await pool().query<{ estado: string }>("select estado from plataforma.contatos where workspace_id = $1 and id = $2", [ws, id]))
      .rows[0]?.estado;

  /** Empresa + vínculos admin numa transação (o trigger de admin é deferido). */
  async function semearEmpresa(nome: string, admins: readonly string[], estado = "ativo"): Promise<string> {
    const c = await pool().connect();
    try {
      await c.query("begin");
      const e = await c.query<{ id: string }>(
        "insert into plataforma.empresas (workspace_id, nome_fantasia, estado, proprietario_id, criado_por) values ($1, $2, $3, 'mem_ana', 'mem_ana') returning id",
        [ws, nome, estado],
      );
      const empresaId = e.rows[0]!.id;
      for (const contatoId of admins) {
        await c.query(
          "insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, true, 'mem_ana')",
          [ws, contatoId, empresaId],
        );
      }
      await c.query("commit");
      return empresaId;
    } catch (erro) {
      await c.query("rollback");
      throw erro;
    } finally {
      c.release();
    }
  }

  async function semearNegocio(contatoId: string, estado = "ativo"): Promise<string> {
    const funil = await pool().query<{ id: string }>(
      "insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, $2, 'mem_ana') returning id",
      [ws, `Funil ${Math.random()}`],
    );
    const funilId = funil.rows[0]!.id;
    const etapa = await pool().query<{ id: string }>(
      "insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Início', 1) returning id",
      [ws, funilId],
    );
    const negocio = await pool().query<{ id: string }>(
      `insert into plataforma.negocios (workspace_id, titulo, contato_id, funil_id, etapa_id, estado, proprietario_id, criado_por)
       values ($1, 'Negócio de apoio', $2, $3, $4, $5, 'mem_ana', 'mem_ana') returning id`,
      [ws, contatoId, funilId, etapa.rows[0]!.id, estado],
    );
    return negocio.rows[0]!.id;
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    for (const espaco of [ws, outroWs]) {
      await semearMembro(espaco, { id: "mem_ana", base: "membro", state: "ativo" });
      await semearMembro(espaco, { id: "mem_convidado", base: "convidado", state: "ativo" });
    }
    await semearMembro(ws, { id: "mem_bia", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_removido", base: "membro", state: "removido" });
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
    await encerrar();
  });

  it("(a) criar normaliza o e-mail, o primeiro de cada tipo nasce principal e a data civil volta igual", async () => {
    const detalhe = await criar({
      nome: "Ana Souza",
      dataNascimento: "1990-05-17",
      identificadores: [
        { tipo: "email", valor: " Ana@X.com " },
        { tipo: "email", valor: "ana2@x.com" },
        { tipo: "telefone", valor: "(11) 98765-4321" },
      ],
    });
    expect(detalhe.contato.dataNascimento).toBe("1990-05-17");
    expect(detalhe.contato.modoCriacao).toBe("manual");
    const emails = detalhe.identificadores.filter((i) => i.tipo === "email");
    expect(emails.map((i) => [i.valor, i.principal])).toEqual([
      ["ana@x.com", true],
      ["ana2@x.com", false],
    ]);
    expect(detalhe.identificadores.find((i) => i.tipo === "telefone")).toMatchObject({
      valor: "+5511987654321",
      principal: true,
    });
  });

  it("(b) Identificador já de outro Contato do Espaço é 409 IDENTIFICADOR_EM_USO, nomeia o detentor e nada é gravado", async () => {
    const dono = await criar({ nome: "Detentor Dono", identificadores: [{ tipo: "email", valor: "dono@x.com" }] });
    const recusa = recusado(await servico.criar(eu, { nome: "Intruso", identificadores: [{ tipo: "email", valor: "DONO@x.com" }] }));
    expect(recusa.status).toBe(409);
    expect(recusa.codigo).toBe("IDENTIFICADOR_EM_USO");
    expect(recusa.bloqueios?.contatos?.[0]).toEqual({ id: dono.contato.id, nome: "Detentor Dono" });
    expect(recusa.error).toContain("Detentor Dono");
    const gravado = await pool().query("select 1 from plataforma.contatos where workspace_id = $1 and nome = 'Intruso'", [ws]);
    expect(gravado.rowCount).toBe(0);

    // o mesmo valor em OUTRO Espaço é aceito
    const noutro = valor(
      await servico.criar(membro(outroWs), { nome: "Outro Espaço", identificadores: [{ tipo: "email", valor: "dono@x.com" }] }),
    );
    expect(noutro.identificadores[0]?.valor).toBe("dono@x.com");
  });

  it("(c) editar muda nome e Proprietário; recusa Proprietário removido, Contato inativo e nome esvaziado", async () => {
    const c = await criar({ nome: "Para Editar" });
    const editado = valor(await servico.editar(eu, c.contato.id, { nome: "Editado", proprietarioId: "mem_bia" }));
    expect(editado.contato).toMatchObject({ nome: "Editado", proprietarioId: "mem_bia" });

    const invalido = recusado(await servico.editar(eu, c.contato.id, { proprietarioId: "mem_removido" }));
    expect([invalido.status, invalido.codigo]).toEqual([409, "PROPRIETARIO_INVALIDO"]);

    const semNome = recusado(await servico.editar(eu, c.contato.id, { nome: "" }));
    expect([semNome.status, semNome.codigo]).toEqual([409, "CONTATO_SEM_NOME_NEM_IDENTIFICADOR"]);

    valor(await servico.arquivar(eu, c.contato.id));
    const inativo = recusado(await servico.editar(eu, c.contato.id, { nome: "Tarde" }));
    expect([inativo.status, inativo.codigo]).toEqual([409, "CONTATO_INATIVO"]);
    expect(inativo.error).toContain("Restaure o Contato antes de editar.");
  });

  it("(d) trocar o principal rebaixa o anterior; remover o principal promove o mais antigo; remover o único sem nome é 409", async () => {
    const c = await criar({
      nome: "Com E-mails",
      identificadores: [
        { tipo: "email", valor: "um@x.com" },
        { tipo: "email", valor: "dois@x.com" },
      ],
    });
    const segundo = c.identificadores.find((i) => i.valor === "dois@x.com")!;
    const trocado = valor(await servico.editarIdentificador(eu, c.contato.id, segundo.id, { principal: true }));
    expect(trocado.identificadores.filter((i) => i.principal).map((i) => i.valor)).toEqual(["dois@x.com"]);

    const adicionado = valor(await servico.adicionarIdentificador(eu, c.contato.id, { tipo: "email", valor: "tres@x.com" }));
    expect(adicionado.identificadores.find((i) => i.valor === "tres@x.com")?.principal).toBe(false);

    const removido = valor(await servico.removerIdentificador(eu, c.contato.id, segundo.id));
    expect(removido.identificadores.map((i) => i.valor)).toEqual(["um@x.com", "tres@x.com"]);
    expect(removido.identificadores.filter((i) => i.principal).map((i) => i.valor)).toEqual(["um@x.com"]);

    const semNome = await criar({ identificadores: [{ tipo: "email", valor: "so@x.com" }] });
    const recusa = recusado(await servico.removerIdentificador(eu, semNome.contato.id, semNome.identificadores[0]!.id));
    expect([recusa.status, recusa.codigo]).toEqual([409, "CONTATO_SEM_NOME_NEM_IDENTIFICADOR"]);
  });

  it("(e) D-09: único admin de uma Empresa bloqueia a lixeira; com segundo admin ativo passa", async () => {
    const admin = await criar({ nome: "Admin Único" });
    const colega = await criar({ nome: "Colega Admin" });
    const empresaId = await semearEmpresa("Alfa", [admin.contato.id]);

    const recusa = recusado(await servico.enviarParaLixeira(eu, admin.contato.id));
    expect([recusa.status, recusa.codigo]).toEqual([409, "CONTATO_BLOQUEADO"]);
    expect(recusa.bloqueios?.empresas).toEqual([{ id: empresaId, nome: "Alfa" }]);
    expect(recusa.error).toContain("Alfa");
    expect(await estadoNoBanco(admin.contato.id)).toBe("ativo");

    await pool().query(
      "insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, true, 'mem_ana')",
      [ws, colega.contato.id, empresaId],
    );
    const passou = valor(await servico.enviarParaLixeira(eu, admin.contato.id));
    expect(passou.contato.estado).toBe("na_lixeira");
  });

  it("(e) D-09: Contato de um Negócio fora da lixeira bloqueia a lixeira", async () => {
    const c = await criar({ nome: "Dono do Negócio" });
    await semearNegocio(c.contato.id);
    const recusa = recusado(await servico.enviarParaLixeira(eu, c.contato.id));
    expect([recusa.status, recusa.codigo]).toEqual([409, "CONTATO_BLOQUEADO"]);
    expect(recusa.bloqueios?.negocios?.total).toBe(1);
    expect(recusa.bloqueios?.negocios?.itens).toHaveLength(1);
    expect(await estadoNoBanco(c.contato.id)).toBe("ativo");
  });

  it("(f) lixeira não mexe nos vínculos; restaurar volta a ativo; arquivar só de ativo", async () => {
    const c = await criar({ nome: "Ciclo de Vida" });
    const colega = await criar({ nome: "Outro Admin" });
    const empresaId = await semearEmpresa("Beta", [c.contato.id, colega.contato.id]);

    const naLixeira = valor(await servico.enviarParaLixeira(eu, c.contato.id));
    expect(naLixeira.contato.estado).toBe("na_lixeira");
    expect(naLixeira.vinculos).toHaveLength(1);
    const vinculo = await pool().query("select fim from plataforma.contato_empresa where workspace_id = $1 and contato_id = $2 and empresa_id = $3", [ws, c.contato.id, empresaId]);
    expect(vinculo.rows[0]?.fim).toBeNull();

    expect(recusado(await servico.arquivar(eu, c.contato.id)).status).toBe(409);
    expect(valor(await servico.restaurar(eu, c.contato.id)).contato.estado).toBe("ativo");
    expect(valor(await servico.arquivar(eu, c.contato.id)).contato.estado).toBe("arquivado");
    expect(valor(await servico.restaurar(eu, c.contato.id)).contato.estado).toBe("ativo");
  });

  it("(g) excluir permanentemente: só da lixeira; Negócio em qualquer estado bloqueia; sem Negócio apaga em cascata", async () => {
    const ativo = await criar({ nome: "Ainda Ativo" });
    const fora = recusado(await servico.excluirPermanentemente(eu, ativo.contato.id));
    expect(fora.status).toBe(409);
    expect(fora.error).toContain("lixeira");

    const comNegocio = await criar({ nome: "Com Negócio" });
    await semearNegocio(comNegocio.contato.id, "na_lixeira");
    valor(await servico.enviarParaLixeira(eu, comNegocio.contato.id));
    const bloqueado = recusado(await servico.excluirPermanentemente(eu, comNegocio.contato.id));
    expect([bloqueado.status, bloqueado.codigo]).toEqual([409, "CONTATO_COM_NEGOCIOS"]);
    expect(bloqueado.bloqueios?.negocios?.total).toBe(1);

    const livre = await criar({ nome: "Livre", identificadores: [{ tipo: "email", valor: "livre@x.com" }] });
    valor(await servico.enviarParaLixeira(eu, livre.contato.id));
    expect(valor(await servico.excluirPermanentemente(eu, livre.contato.id))).toEqual({ id: livre.contato.id });
    expect((await pool().query("select 1 from plataforma.contatos where workspace_id = $1 and id = $2", [ws, livre.contato.id])).rowCount).toBe(0);
    expect(
      (await pool().query("select 1 from plataforma.contato_identificadores where workspace_id = $1 and contato_id = $2", [ws, livre.contato.id])).rowCount,
    ).toBe(0);
  });

  it("(g) excluir permanentemente o único admin de uma Empresa é CONTATO_BLOQUEADO", async () => {
    const admin = await criar({ nome: "Admin Na Lixeira" });
    await semearEmpresa("Gama", [admin.contato.id]);
    // vai para a lixeira por SQL, contornando a pré-checagem do serviço
    await pool().query("update plataforma.contatos set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, admin.contato.id]);
    const recusa = recusado(await servico.excluirPermanentemente(eu, admin.contato.id));
    expect([recusa.status, recusa.codigo]).toEqual([409, "CONTATO_BLOQUEADO"]);
  });

  it("(g) excluir permanentemente um Contato com Conversa é 409 CONTATO_COM_CONVERSAS e o Contato continua existindo (Pitfall 2)", async () => {
    const c = await criar({ nome: "Com Conversa" });
    const canal = await semearCanal(ws, {
      nome: "Canal das Conversas",
      tipo: "whatsapp",
      provedor: "whatsapp-cloud",
      identificadorExterno: "+5511977770401",
    });
    const conversa = await pool().query<{ id: string }>(
      `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, criado_por_tipo, criado_por_id)
       values ($1, $2, $3, 'Pedido de orçamento', 'system', 'sistema') returning id`,
      [ws, canal, c.contato.id],
    );
    valor(await servico.enviarParaLixeira(eu, c.contato.id));

    const recusa = recusado(await servico.excluirPermanentemente(eu, c.contato.id));
    expect([recusa.status, recusa.codigo]).toEqual([409, "CONTATO_COM_CONVERSAS"]);
    expect(recusa.error).toContain("1 Conversa");
    expect(recusa.bloqueios?.conversas).toEqual({ total: 1, itens: [{ id: conversa.rows[0]!.id, titulo: "Pedido de orçamento" }] });
    expect(await estadoNoBanco(c.contato.id)).toBe("na_lixeira");
  });

  it("(g) a corrida: o 23503 de conversas_workspace_id_contato_id_fkey vira 409 CONTATO_COM_CONVERSAS, sem o nome do constraint (T-08-20)", () => {
    const recusa = traduzirErroDePg(
      { code: "23503", constraint: "conversas_workspace_id_contato_id_fkey" },
      FRASES_DE_CONTATOS,
    );
    expect(recusa).toMatchObject({ status: 409, codigo: "CONTATO_COM_CONVERSAS" });
    expect(recusa?.error).not.toContain("conversas_workspace_id_contato_id_fkey");
  });

  it("(h) obter de outro Espaço é 404; listar acha por nome e por Identificador, e % não é curinga", async () => {
    const c = await criar({ nome: "Busca Única", identificadores: [{ tipo: "email", valor: "achame@busca.com" }] });
    expect(valor(await servico.obter(eu, c.contato.id)).contato.id).toBe(c.contato.id);
    const alheio = recusado(await servico.obter(membro(outroWs), c.contato.id));
    expect([alheio.status, alheio.error]).toEqual([404, "Contato não encontrado."]);

    const porNome = valor(await servico.listar(eu, { estado: "ativo", q: "busca únic", limite: 50, deslocamento: 0 }));
    expect(porNome.itens.map((i) => i.id)).toContain(c.contato.id);
    const porEmail = valor(await servico.listar(eu, { estado: "ativo", q: "achame@busca", limite: 50, deslocamento: 0 }));
    expect(porEmail.itens.map((i) => i.id)).toEqual([c.contato.id]);

    await criar({ nome: "Desconto 50% off" });
    const curinga = valor(await servico.listar(eu, { estado: "ativo", q: "50%", limite: 50, deslocamento: 0 }));
    expect(curinga.itens.map((i) => i.nomeDeExibicao)).toEqual(["Desconto 50% off"]);
    const sublinhado = valor(await servico.listar(eu, { estado: "ativo", q: "_", limite: 50, deslocamento: 0 }));
    expect(sublinhado.total).toBe(0);
  });

  it("(i) Convidado recebe 403 em toda escrita e nada muda", async () => {
    const c = await criar({ nome: "Intocável" });
    const convidado = membro(ws, "mem_convidado");
    const tentativas = [
      servico.criar(convidado, { nome: "Do Convidado" }),
      servico.editar(convidado, c.contato.id, { nome: "Mudou" }),
      servico.adicionarIdentificador(convidado, c.contato.id, { tipo: "email", valor: "c@x.com" }),
      servico.arquivar(convidado, c.contato.id),
      servico.enviarParaLixeira(convidado, c.contato.id),
      servico.restaurar(convidado, c.contato.id),
      servico.excluirPermanentemente(convidado, c.contato.id),
    ];
    for (const resultado of await Promise.all(tentativas)) {
      const recusa = recusado(resultado);
      expect([recusa.status, recusa.codigo]).toEqual([403, "PERMISSAO"]);
    }
    expect(valor(await servico.obter(convidado, c.contato.id)).contato.nome).toBe("Intocável");
    expect((await pool().query("select 1 from plataforma.contatos where workspace_id = $1 and nome = 'Do Convidado'", [ws])).rowCount).toBe(0);
  });
});
