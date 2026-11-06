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
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, poolDoDono, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
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

  it("traçador (011): um Contato `mesclado` sai de obter com `mescladoEmId` e não aparece entre os ativos", async () => {
    const absorvido = (await criar({ nome: "Absorvido" })).contato.id;
    const sobrevivente = (await criar({ nome: "Sobrevivente" })).contato.id;
    // Só o serviço de mesclagem (14-09) grava este estado; aqui entra por SQL, como o dono do banco.
    await poolDoDono().query(
      "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
      [ws, absorvido, sobrevivente],
    );

    const lido = valor(await servico.obter(eu, absorvido));
    expect(lido.contato.estado).toBe("mesclado");
    expect(lido.contato.mescladoEmId).toBe(sobrevivente);
    expect(lido.contato.mescladoEm).toEqual(expect.any(String));

    const ativos = valor(await servico.listar(eu, { estado: "ativo", limite: 100, deslocamento: 0 }));
    expect(ativos.itens.map((item) => item.id)).not.toContain(absorvido);
    expect(ativos.itens.map((item) => item.id)).toContain(sobrevivente);
  });

  describe("RN-CON-14: Contato `mesclado` é somente leitura", () => {
    const FRASE = "Este Contato foi mesclado e agora é somente leitura. Abra o Contato que ficou.";

    /** Um absorvido com um e-mail, já marcado `mesclado` no sobrevivente por SQL (só a 14-09 grava isso). */
    async function absorvidoPorSql(nome: string): Promise<{ id: string; identificadorId: string }> {
      const absorvido = await criar({ nome, identificadores: [{ tipo: "email", valor: `${nome.toLowerCase().replace(/\W+/g, "")}@mesclado.test` }] });
      const sobrevivente = (await criar({ nome: `Sobrevivente de ${nome}` })).contato.id;
      await poolDoDono().query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
        [ws, absorvido.contato.id, sobrevivente],
      );
      return { id: absorvido.contato.id, identificadorId: absorvido.identificadores[0]!.id };
    }

    const linhaDoContato = async (id: string) =>
      (await pool().query("select * from plataforma.contatos where workspace_id = $1 and id = $2", [ws, id])).rows[0];

    it.each([
      ["editar", (id: string) => servico.editar(eu, id, { nome: "Mudou" })],
      ["adicionarIdentificador", (id: string) => servico.adicionarIdentificador(eu, id, { tipo: "email", valor: "novo@mesclado.test" })],
      ["editarIdentificador", (id: string, identificadorId: string) => servico.editarIdentificador(eu, id, identificadorId, { verificado: true })],
      ["removerIdentificador", (id: string, identificadorId: string) => servico.removerIdentificador(eu, id, identificadorId)],
      ["arquivar", (id: string) => servico.arquivar(eu, id)],
      ["restaurar", (id: string) => servico.restaurar(eu, id)],
      ["enviarParaLixeira", (id: string) => servico.enviarParaLixeira(eu, id)],
      ["excluirPermanentemente", (id: string) => servico.excluirPermanentemente(eu, id)],
    ])("%s sobre um Contato mesclado é 409 CONTATO_MESCLADO e a linha não muda", async (gesto, executar) => {
      const absorvido = await absorvidoPorSql(`Absorvido ${gesto}`);
      const antes = await linhaDoContato(absorvido.id);
      const recusa = recusado(await executar(absorvido.id, absorvido.identificadorId));
      expect(recusa.status).toBe(409);
      expect(recusa.codigo).toBe("CONTATO_MESCLADO");
      expect(recusa.error).toBe(FRASE);
      expect(await linhaDoContato(absorvido.id)).toEqual(antes);
    });

    it("obter continua devolvendo o Contato mesclado (leitura liberada)", async () => {
      const absorvido = await absorvidoPorSql("Absorvido lido");
      const lido = valor(await servico.obter(eu, absorvido.id));
      expect(lido.contato.estado).toBe("mesclado");
    });
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

  it("(k) WR-06: excluir de vez o sobrevivente de uma mesclagem é 409 CONTATO_COM_MESCLADOS, repetido dá o mesmo 409 e a linha continua", async () => {
    const absorvido = await criar({ nome: "Absorvido (k)" });
    const sobrevivente = await criar({ nome: "Sobrevivente (k)" });
    await poolDoDono().query(
      "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
      [ws, absorvido.contato.id, sobrevivente.contato.id],
    );
    valor(await servico.enviarParaLixeira(eu, sobrevivente.contato.id));
    const linhas = async () =>
      (await pool().query("select * from plataforma.contatos where workspace_id = $1 and id in ($2, $3) order by id", [ws, absorvido.contato.id, sobrevivente.contato.id]))
        .rows;
    const antes = await linhas();

    for (const _tentativa of [1, 2]) {
      const recusa = recusado(await servico.excluirPermanentemente(eu, sobrevivente.contato.id));
      expect([recusa.status, recusa.codigo]).toEqual([409, "CONTATO_COM_MESCLADOS"]);
      expect(recusa.error).toBe("Este Contato absorveu outros Contatos e não pode ser excluído de vez.");
      expect(recusa.error).not.toContain("contatos_mesclado_em_fk");
    }
    expect(await linhas()).toEqual(antes);
    expect(await estadoNoBanco(sobrevivente.contato.id)).toBe("na_lixeira");
  });

  it("(k) WR-06: a corrida: o 23503 de contatos_mesclado_em_fk vira 409 CONTATO_COM_MESCLADOS, sem o nome do constraint (T-07-06)", () => {
    const recusa = traduzirErroDePg({ code: "23503", constraint: "contatos_mesclado_em_fk" }, FRASES_DE_CONTATOS);
    expect(recusa).toMatchObject({
      status: 409,
      codigo: "CONTATO_COM_MESCLADOS",
      error: "Outros Contatos foram mesclados neste e ele não pode ser excluído de vez.",
    });
    expect(recusa?.error).not.toContain("contatos_mesclado_em_fk");
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

  describe("transferirIdentificador (3.2.3, DO-CON-12)", () => {
    let seq = 0;
    /** Um WhatsApp novo a cada chamada: o par (tipo, valor) é único no Espaço. */
    const zap = (): string => `+55119880${String(++seq).padStart(5, "0")}`;

    const donoNoBanco = async (tipo: string, valorCanonico: string) =>
      (
        await pool().query<{ contato_id: string; principal: boolean }>(
          "select contato_id, principal from plataforma.contato_identificadores where workspace_id = $1 and tipo = $2 and valor = $3",
          [ws, tipo, valorCanonico],
        )
      ).rows[0];

    it("(a) o número vai para o destino como principal, a origem perde, e o detentor passa a ser o destino", async () => {
      const numero = zap();
      const a = await criar({ nome: "Origem A", identificadores: [{ tipo: "whatsapp", valor: numero }] });
      const b = await criar({ nome: "Destino B", identificadores: [{ tipo: "email", valor: "b-a@transf.test" }] });
      const identificador = a.identificadores[0]!;

      const ficha = valor(await servico.transferirIdentificador(eu, a.contato.id, identificador.id, { paraContatoId: b.contato.id }));

      expect(ficha.contato.id).toBe(a.contato.id);
      expect(ficha.identificadores).toEqual([]);
      expect(await donoNoBanco("whatsapp", identificador.valor)).toEqual({ contato_id: b.contato.id, principal: true });
      const detentor = await criarRepositorioDeContatosPg(pool()).detentorDoIdentificador(ws, "whatsapp", identificador.valor);
      expect(detentor?.contatoId).toBe(b.contato.id);
      expect(valor(await servico.obter(eu, b.contato.id)).identificadores.map((i) => i.id)).toContain(identificador.id);
    });

    it("(a2) transferir grava 'Identificador transferido' no Contato de origem, com o nome do destino e sem o valor do Identificador (15-09)", async () => {
      const numero = zap();
      const a = await criar({ nome: "Origem Atv", identificadores: [{ tipo: "whatsapp", valor: numero }] });
      const b = await criar({ nome: "Destino Atv", identificadores: [{ tipo: "email", valor: "destino-atv@transf.test" }] });
      const identificador = a.identificadores[0]!;

      valor(await servico.transferirIdentificador(eu, a.contato.id, identificador.id, { paraContatoId: b.contato.id }));

      const linhas = (
        await pool().query<{ acao: string; ator_id: string; objeto_tipo: string; objeto_id: string; objeto_nome: string; antes: string | null; depois: string | null; detalhe: string | null }>(
          "select acao, ator_id, objeto_tipo, objeto_id, objeto_nome, antes, depois, detalhe from plataforma.crm_atividades where workspace_id = $1 and objeto_id = $2",
          [ws, a.contato.id],
        )
      ).rows;
      expect(linhas).toEqual([
        {
          acao: "Identificador transferido",
          ator_id: eu.id,
          objeto_tipo: "contact",
          objeto_id: a.contato.id,
          objeto_nome: "Origem Atv",
          antes: null,
          depois: "Destino Atv",
          detalhe: "whatsapp",
        },
      ]);
      // Nenhum campo da linha leva o valor do Identificador (T-15-27).
      expect(JSON.stringify(linhas)).not.toContain(identificador.valor);
      expect(JSON.stringify(linhas)).not.toContain(numero);
    });

    it("(a3) a transferência recusada não grava Atividade", async () => {
      const a = await criar({ nome: "Origem Recusa", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const antes = Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.crm_atividades where workspace_id = $1", [ws])).rows[0]!.n);

      recusado(await servico.transferirIdentificador(eu, a.contato.id, a.identificadores[0]!.id, { paraContatoId: a.contato.id }));
      recusado(await servico.transferirIdentificador(eu, a.contato.id, "identificador-que-nao-existe", { paraContatoId: a.contato.id }));

      const depois = Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.crm_atividades where workspace_id = $1", [ws])).rows[0]!.n);
      expect(depois).toBe(antes);
    });

    it("(b) o destino que já tem WhatsApp principal recebe o transferido como não principal", async () => {
      const a = await criar({ nome: "Origem B1", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const b = await criar({ nome: "Destino B1", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const identificador = a.identificadores[0]!;

      valor(await servico.transferirIdentificador(eu, a.contato.id, identificador.id, { paraContatoId: b.contato.id }));

      expect(await donoNoBanco("whatsapp", identificador.valor)).toEqual({ contato_id: b.contato.id, principal: false });
      const doDestino = valor(await servico.obter(eu, b.contato.id)).identificadores.filter((i) => i.tipo === "whatsapp");
      expect(doDestino.filter((i) => i.principal).map((i) => i.id)).toEqual([b.identificadores[0]!.id]);
    });

    it("(c) transferir o principal da origem promove o outro do mesmo tipo, como removerIdentificador", async () => {
      const a = await criar({
        nome: "Origem C",
        identificadores: [
          { tipo: "whatsapp", valor: zap() },
          { tipo: "whatsapp", valor: zap() },
        ],
      });
      const b = await criar({ nome: "Destino C" });
      const [principal, segundo] = a.identificadores;
      expect([principal!.principal, segundo!.principal]).toEqual([true, false]);

      const ficha = valor(await servico.transferirIdentificador(eu, a.contato.id, principal!.id, { paraContatoId: b.contato.id }));

      expect(ficha.identificadores.map((i) => [i.id, i.principal])).toEqual([[segundo!.id, true]]);
    });

    it("(d) a Conversa aberta antes da transferência continua no Contato de origem (DO-CON-12)", async () => {
      const a = await criar({ nome: "Origem D", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const b = await criar({ nome: "Destino D" });
      const canal = await semearCanal(ws, { nome: "Canal D", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: zap() });
      const conversa = await pool().query<{ id: string }>(
        `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, criado_por_tipo, criado_por_id)
         values ($1, $2, $3, 'Antes da transferência', 'system', 'sistema') returning id`,
        [ws, canal, a.contato.id],
      );

      valor(await servico.transferirIdentificador(eu, a.contato.id, a.identificadores[0]!.id, { paraContatoId: b.contato.id }));

      const depois = await pool().query<{ contato_id: string }>(
        "select contato_id from plataforma.conversas where workspace_id = $1 and id = $2",
        [ws, conversa.rows[0]!.id],
      );
      expect(depois.rows[0]?.contato_id).toBe(a.contato.id);
    });

    it("(e) Identificador que não é da origem é 404 e nada muda", async () => {
      const a = await criar({ nome: "Origem E" });
      const b = await criar({ nome: "Dono E", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const c = await criar({ nome: "Destino E" });
      const recusa = recusado(await servico.transferirIdentificador(eu, a.contato.id, b.identificadores[0]!.id, { paraContatoId: c.contato.id }));
      expect([recusa.status, recusa.codigo]).toEqual([404, "IDENTIFICADOR_NAO_ENCONTRADO"]);
      expect((await donoNoBanco("whatsapp", b.identificadores[0]!.valor))?.contato_id).toBe(b.contato.id);
    });

    it("(f) Contato de outro Espaço, de origem ou de destino, é 404 (T-14-14)", async () => {
      const a = await criar({ nome: "Origem F", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const deOutro = valor(await servico.criar(membro(outroWs), { nome: "De outro Espaço", identificadores: [{ tipo: "whatsapp", valor: zap() }] }));

      const destinoAlheio = recusado(await servico.transferirIdentificador(eu, a.contato.id, a.identificadores[0]!.id, { paraContatoId: deOutro.contato.id }));
      expect([destinoAlheio.status, destinoAlheio.codigo, destinoAlheio.campo]).toEqual([404, "CONTATO_NAO_ENCONTRADO", "paraContatoId"]);
      const origemAlheia = recusado(
        await servico.transferirIdentificador(eu, deOutro.contato.id, deOutro.identificadores[0]!.id, { paraContatoId: a.contato.id }),
      );
      expect([origemAlheia.status, origemAlheia.codigo]).toEqual([404, "CONTATO_NAO_ENCONTRADO"]);
      expect((await donoNoBanco("whatsapp", a.identificadores[0]!.valor))?.contato_id).toBe(a.contato.id);
    });

    it("(g) destino mesclado, destino na lixeira e o mesmo Contato são 409 TRANSFERENCIA_RECUSADA no campo paraContatoId", async () => {
      const a = await criar({ nome: "Origem G", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const mesclado = await criar({ nome: "Destino mesclado" });
      const naLixeira = await criar({ nome: "Destino na lixeira" });
      const sobrevivente = await criar({ nome: "Sobrevivente G" });
      await poolDoDono().query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
        [ws, mesclado.contato.id, sobrevivente.contato.id],
      );
      await pool().query("update plataforma.contatos set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, naLixeira.contato.id]);
      const identificadorId = a.identificadores[0]!.id;

      for (const destino of [mesclado.contato.id, naLixeira.contato.id, a.contato.id]) {
        const recusa = recusado(await servico.transferirIdentificador(eu, a.contato.id, identificadorId, { paraContatoId: destino }));
        expect([recusa.status, recusa.codigo, recusa.campo]).toEqual([409, "TRANSFERENCIA_RECUSADA", "paraContatoId"]);
      }
      expect((await donoNoBanco("whatsapp", a.identificadores[0]!.valor))?.contato_id).toBe(a.contato.id);
    });

    it("(h) a origem que ficaria sem nome nem Identificador é 409 TRANSFERENCIA_RECUSADA e o número fica onde estava (INV-CON-01)", async () => {
      const a = await criar({ identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const b = await criar({ nome: "Destino H" });
      const recusa = recusado(await servico.transferirIdentificador(eu, a.contato.id, a.identificadores[0]!.id, { paraContatoId: b.contato.id }));
      expect([recusa.status, recusa.codigo, recusa.campo]).toEqual([409, "TRANSFERENCIA_RECUSADA", "nome"]);
      expect((await donoNoBanco("whatsapp", a.identificadores[0]!.valor))?.contato_id).toBe(a.contato.id);
    });

    it("(i) a origem mesclada é 409 CONTATO_MESCLADO (RN-CON-14) e o destino cheio recusa", async () => {
      const absorvido = await criar({ nome: "Origem mesclada", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const sobrevivente = await criar({ nome: "Sobrevivente I" });
      await poolDoDono().query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
        [ws, absorvido.contato.id, sobrevivente.contato.id],
      );
      const recusa = recusado(
        await servico.transferirIdentificador(eu, absorvido.contato.id, absorvido.identificadores[0]!.id, { paraContatoId: sobrevivente.contato.id }),
      );
      expect([recusa.status, recusa.codigo]).toEqual([409, "CONTATO_MESCLADO"]);

      const a = await criar({ nome: "Origem cheio", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const cheio = await criar({
        nome: "Destino cheio",
        identificadores: Array.from({ length: 20 }, (_, i) => ({ tipo: "email" as const, valor: `cheio${i}@transf.test` })),
      });
      const demais = recusado(await servico.transferirIdentificador(eu, a.contato.id, a.identificadores[0]!.id, { paraContatoId: cheio.contato.id }));
      expect([demais.status, demais.codigo, demais.campo]).toEqual([409, "TRANSFERENCIA_RECUSADA", "paraContatoId"]);
    });

    it("(j) Convidado recebe 403 e nada muda", async () => {
      const a = await criar({ nome: "Origem J", identificadores: [{ tipo: "whatsapp", valor: zap() }] });
      const b = await criar({ nome: "Destino J" });
      const recusa = recusado(
        await servico.transferirIdentificador(membro(ws, "mem_convidado"), a.contato.id, a.identificadores[0]!.id, { paraContatoId: b.contato.id }),
      );
      expect([recusa.status, recusa.codigo]).toEqual([403, "PERMISSAO"]);
      expect((await donoNoBanco("whatsapp", a.identificadores[0]!.valor))?.contato_id).toBe(a.contato.id);
    });
  });
});
