/**
 * Serviço de Consentimentos do Contato (14-08, 3.2.4), contra o Postgres LOCAL.
 *
 * O consentimento é só inserção (T-14-19): revogar é registrar um `revogado`, a
 * linha anterior continua. O registrador é o Membro da sessão, a finalidade é
 * conferida no Catálogo DESTE Espaço e a evidência é Mensagem de uma Conversa
 * deste Contato (T-14-20). O Contato `mesclado` entra por SQL, porque só a
 * mesclagem (14-09) grava esse estado.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consentimentoVigente } from "@n1/dominio/crm/consentimentos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../../repositorios/crm/mensagens";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, poolDoDono, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeConsentimentos } from "./consentimentos";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeConsentimentos({ pool, acesso: criarAcessoAoCrmPg(pool) });

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

const marketingWhatsapp = { finalidadeId: "cat_fin_mkt", tipoDeCanal: "whatsapp", decisao: "concedido", origem: "formulario" } as const;

describeComBanco("ServicoDeConsentimentos — Postgres local", () => {
  const ws = novoEspacoDeTeste("svcconsent");
  const outroWs = novoEspacoDeTeste("svcconsentb");
  const eu = membro(ws);

  /** Item do Catálogo por SQL: o Catálogo mora em `plataforma.registros` até a unificação. */
  async function semearFinalidade(workspaceId: string, id: string, nome: string, lifecycle = "ativo") {
    await pool().query(
      `insert into plataforma.registros (workspace_id, colecao, id, dados)
       values ($1, 'catalog', $2, $3::jsonb)
       on conflict (workspace_id, colecao, id) do update set dados = excluded.dados`,
      [workspaceId, id, JSON.stringify({ id, kind: "finalidadeConsentimento", name: nome, lifecycle })],
    );
  }

  async function semearContato(workspaceId: string, nome: string, estado = "ativo"): Promise<string> {
    const { rows } = await pool().query<{ id: string }>(
      "insert into plataforma.contatos (workspace_id, nome, estado, proprietario_id, criado_por) values ($1, $2, $3, 'mem_ana', 'mem_ana') returning id",
      [workspaceId, nome, estado],
    );
    return rows[0]!.id;
  }

  /** Uma Mensagem de verdade num Canal e numa Conversa do Contato: a evidência possível. */
  async function semearMensagem(workspaceId: string, contatoId: string, rotulo: string): Promise<string> {
    const canalId = await semearCanal(workspaceId, {
      nome: `Canal ${rotulo}`,
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: `+5511${Math.floor(Math.random() * 1e8)}`,
      conexao: "conectada",
    });
    const conversa = await criarRepositorioDeConversasPg(pool()).inserir(workspaceId, {
      canalId,
      contatoId,
      titulo: `Conversa ${rotulo}`,
      filaId: null,
      atribuido: { tipo: "membro", id: "mem_ana" },
      participantes: [],
      criadoPor: { tipo: "member", id: "mem_ana" },
    });
    const mensagem = await criarRepositorioDeMensagensPg(pool()).inserir(workspaceId, {
      conversaId: conversa.id,
      canalId,
      direcao: "interna",
      ator: { tipo: "member", id: "mem_ana" },
      conteudo: "Pode mandar as novidades.",
      statusEntrega: null,
    });
    return mensagem.id;
  }

  const linhasNoBanco = async (contatoId: string) =>
    (
      await pool().query<{ decisao: string; tipo_de_canal: string; registrado_por: string; evidencia_mensagem_id: string | null }>(
        "select decisao, tipo_de_canal, registrado_por, evidencia_mensagem_id from plataforma.contato_consentimentos where workspace_id = $1 and contato_id = $2 order by em, registrado_em, id",
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
    await semearFinalidade(ws, "cat_fin_mkt", "Marketing");
    await semearFinalidade(ws, "cat_fin_arq", "Antiga", "arquivado");
    await semearFinalidade(outroWs, "cat_fin_de_outro", "Marketing");
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
    await encerrar();
  });

  it("(a) registrar grava uma linha com o Membro da sessão como registrador e listar a devolve", async () => {
    const contatoId = await semearContato(ws, "Consentiu");
    const registrado = valor(await servico.registrar(membro(ws, "mem_bia"), contatoId, marketingWhatsapp));
    expect(registrado).toMatchObject({ contatoId, finalidadeId: "cat_fin_mkt", tipoDeCanal: "whatsapp", decisao: "concedido", registradoPor: "mem_bia" });
    expect(await linhasNoBanco(contatoId)).toEqual([
      { decisao: "concedido", tipo_de_canal: "whatsapp", registrado_por: "mem_bia", evidencia_mensagem_id: null },
    ]);
    const lista = valor(await servico.listar(eu, contatoId));
    expect(lista.total).toBe(1);
    expect(lista.itens[0]?.id).toBe(registrado.id);
  });

  it("(a2) registrar grava 'Consentimento registrado' com a finalidade e a decisão, sem a evidência (15-09)", async () => {
    const contatoId = await semearContato(ws, "Consentiu Atv");
    const mensagemId = await semearMensagem(ws, contatoId, "atv");
    valor(await servico.registrar(membro(ws, "mem_bia"), contatoId, { ...marketingWhatsapp, evidenciaMensagemId: mensagemId }));

    const linhas = (
      await pool().query<{ acao: string; ator_id: string; objeto_tipo: string; objeto_nome: string; antes: string | null; depois: string | null; detalhe: string | null }>(
        "select acao, ator_id, objeto_tipo, objeto_nome, antes, depois, detalhe from plataforma.crm_atividades where workspace_id = $1 and objeto_id = $2",
        [ws, contatoId],
      )
    ).rows;
    expect(linhas).toEqual([
      {
        acao: "Consentimento registrado",
        ator_id: "mem_bia",
        objeto_tipo: "contact",
        objeto_nome: "Consentiu Atv",
        antes: null,
        depois: null,
        detalhe: "Marketing (whatsapp): concedido",
      },
    ]);
    expect(JSON.stringify(linhas)).not.toContain("Pode mandar as novidades");
    expect(JSON.stringify(linhas)).not.toContain(mensagemId);
  });

  it("(a3) o consentimento recusado (finalidade ruim, Contato mesclado, Convidado, outro Espaço) não grava Atividade", async () => {
    const mesclado = await semearContato(ws, "Mesclado Atv");
    await poolDoDono().query("update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2", [
      ws,
      mesclado,
      await semearContato(ws, "Sobrevivente Atv"),
    ]);
    const livre = await semearContato(ws, "Livre Atv");
    const contar = async (contatoId: string) =>
      Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.crm_atividades where workspace_id = $1 and objeto_id = $2", [ws, contatoId])).rows[0]!.n);

    recusado(await servico.registrar(eu, livre, { ...marketingWhatsapp, finalidadeId: "cat_fin_inexistente" }));
    recusado(await servico.registrar(eu, mesclado, marketingWhatsapp));
    recusado(await servico.registrar(membro(ws, "mem_convidado"), livre, marketingWhatsapp));
    recusado(await servico.registrar(membro(outroWs), livre, marketingWhatsapp));

    expect(await contar(livre)).toBe(0);
    expect(await contar(mesclado)).toBe(0);
  });

  it("(b) revogar é registrar um revogado: a linha anterior continua e o vigente passa a ser o revogado (T-14-19)", async () => {
    const contatoId = await semearContato(ws, "Revogou");
    const concedido = valor(await servico.registrar(eu, contatoId, { ...marketingWhatsapp, em: "2026-10-01T10:00:00.000Z" }));
    const revogado = valor(await servico.registrar(eu, contatoId, { ...marketingWhatsapp, decisao: "revogado", origem: "verbal", em: "2026-10-02T10:00:00.000Z" }));
    expect((await linhasNoBanco(contatoId)).map((l) => l.decisao)).toEqual(["concedido", "revogado"]);
    const lista = valor(await servico.listar(eu, contatoId));
    expect(lista.itens.map((c) => c.id)).toEqual([revogado.id, concedido.id]);
    expect(consentimentoVigente(lista.itens, "cat_fin_mkt", "whatsapp")?.decisao).toBe("revogado");
  });

  it("(c) finalidade que não é item ativo do Catálogo deste Espaço é 400 no campo finalidadeId", async () => {
    const contatoId = await semearContato(ws, "Finalidade ruim");
    for (const finalidadeId of ["cat_fin_inexistente", "cat_fin_de_outro", "cat_fin_arq"]) {
      const r = recusado(await servico.registrar(eu, contatoId, { ...marketingWhatsapp, finalidadeId }));
      expect(r).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "finalidadeId" });
    }
    expect(await linhasNoBanco(contatoId)).toEqual([]);
  });

  it("(d) evidência: a Mensagem de uma Conversa do Contato entra; a de outro Contato, a inexistente e a de outro Espaço são 400", async () => {
    const contatoId = await semearContato(ws, "Com evidência");
    const outroContato = await semearContato(ws, "Outro contato");
    const doContato = await semearMensagem(ws, contatoId, "evid1");
    const deOutroContato = await semearMensagem(ws, outroContato, "evid2");
    const contatoDeOutroEspaco = await semearContato(outroWs, "Contato de outro Espaço");
    const deOutroEspaco = await semearMensagem(outroWs, contatoDeOutroEspaco, "evid3");

    const ok = valor(await servico.registrar(eu, contatoId, { ...marketingWhatsapp, origem: "mensagem", evidenciaMensagemId: doContato }));
    expect(ok.evidenciaMensagemId).toBe(doContato);

    for (const evidenciaMensagemId of [deOutroContato, deOutroEspaco, "msg_que_nao_existe"]) {
      const r = recusado(await servico.registrar(eu, contatoId, { ...marketingWhatsapp, origem: "mensagem", evidenciaMensagemId }));
      expect(r).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "evidenciaMensagemId" });
    }
    expect(await linhasNoBanco(contatoId)).toHaveLength(1);
  });

  it("(e) Contato mesclado ou na lixeira recusa (409 CONSENTIMENTO_RECUSADO); o arquivado aceita", async () => {
    const absorvido = await semearContato(ws, "Absorvido");
    const sobrevivente = await semearContato(ws, "Sobrevivente");
    await poolDoDono().query(
      "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
      [ws, absorvido, sobrevivente],
    );
    const naLixeira = await semearContato(ws, "Na lixeira", "na_lixeira");
    const arquivado = await semearContato(ws, "Arquivado", "arquivado");

    const r = recusado(await servico.registrar(eu, absorvido, marketingWhatsapp));
    expect(r).toMatchObject({ status: 409, codigo: "CONSENTIMENTO_RECUSADO" });
    expect(r.error).toBe("Um Contato mesclado é somente leitura. Registre o consentimento no Contato que ficou.");
    expect(recusado(await servico.registrar(eu, naLixeira, marketingWhatsapp))).toMatchObject({ status: 409, codigo: "CONSENTIMENTO_RECUSADO" });
    valor(await servico.registrar(eu, arquivado, marketingWhatsapp));
    expect(await linhasNoBanco(absorvido)).toEqual([]);
  });

  it("(f) Contato de outro Espaço é 404 para listar e para registrar (T-14-20)", async () => {
    const deOutro = await semearContato(outroWs, "De outro Espaço");
    expect(recusado(await servico.listar(eu, deOutro))).toMatchObject({ status: 404, codigo: "CONTATO_NAO_ENCONTRADO" });
    expect(recusado(await servico.registrar(eu, deOutro, marketingWhatsapp))).toMatchObject({ status: 404, codigo: "CONTATO_NAO_ENCONTRADO" });
    const { rows } = await pool().query("select 1 from plataforma.contato_consentimentos where workspace_id = $1", [outroWs]);
    expect(rows).toHaveLength(0);
  });

  it("(g) Convidado lê o histórico, mas registrar é 403 e nada é gravado", async () => {
    const contatoId = await semearContato(ws, "Para o Convidado");
    valor(await servico.registrar(eu, contatoId, marketingWhatsapp));
    const convidado = membro(ws, "mem_convidado");
    expect(recusado(await servico.registrar(convidado, contatoId, { ...marketingWhatsapp, decisao: "revogado" })).status).toBe(403);
    expect(valor(await servico.listar(convidado, contatoId)).total).toBe(1);
    expect(await linhasNoBanco(contatoId)).toHaveLength(1);
  });

  it("(h) `em` no futuro é 400 no campo em; `em` no passado é gravado como veio", async () => {
    const contatoId = await semearContato(ws, "Datas");
    const futuro = new Date(Date.now() + 2 * 86_400_000).toISOString();
    expect(recusado(await servico.registrar(eu, contatoId, { ...marketingWhatsapp, em: futuro }))).toMatchObject({ status: 400, campo: "em" });
    const gravado = valor(await servico.registrar(eu, contatoId, { ...marketingWhatsapp, origem: "importacao", em: "2026-01-15T09:30:00.000Z" }));
    expect(gravado.em).toBe("2026-01-15T09:30:00.000Z");
    expect(await linhasNoBanco(contatoId)).toHaveLength(1);
  });
});
