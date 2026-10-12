/**
 * As invariantes da 008 (Canal, Conversa, Mensagem) provadas no banco, sem
 * serviço no meio — Postgres LOCAL (`testes/banco-crm.ts`), nunca o pooler.
 *
 * Estas são as provas que o `checkpoint:decision` de 08-14 cita antes de a 008
 * ficar imutável: o que o Postgres segura sozinho. Cada "barrado" confere o
 * SQLSTATE E o nome do constraint, não só que lançou — um teste que aceita
 * qualquer erro passaria com um erro de sintaxe.
 *
 * Os dois WhatsApps do Espaço têm números DISTINTOS de propósito: o mesmo
 * número em dois Canais ativos do mesmo tipo é recusado por INV-CXE-01
 * (`canais_conta_uq`), e o que distingue "cloud" de "não oficial" é o
 * provedor, não o número (Pitfall 12).
 *
 * Rodar: DATABASE_URL=postgres://postgres:x@localhost:55584/postgres npx vitest run src/repositorios/crm/canais-008.test.ts
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, it } from "vitest";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../testes/banco-crm";

const SQL_008 = fileURLToPath(new URL("../../../migracoes/008-canais-conversas-mensagens.sql", import.meta.url));

/** A promessa tem de rejeitar com este SQLSTATE e este constraint, exatamente. */
async function barrado(promessa: Promise<unknown>, code: string, constraint?: string): Promise<void> {
  await expect(promessa).rejects.toMatchObject({ code, ...(constraint !== undefined ? { constraint } : {}) });
}

describeComBanco("008 — Canal, Conversa e Mensagem no Postgres local", () => {
  const A = novoEspacoDeTeste("cxe008a");
  const B = novoEspacoDeTeste("cxe008b");

  let comercial = ""; // whatsapp-cloud +5511977770101
  let suporte = ""; // whatsapp-nao-oficial +5511977770102
  let ana = "";
  let bia = "";
  let contatoDeB = "";

  async function contato(workspaceId: string, nome: string): Promise<string> {
    const r = await pool().query<{ id: string }>(
      `insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por)
       values ($1, $2, 'mem_teste', 'mem_teste') returning id`,
      [workspaceId, nome],
    );
    return r.rows[0]!.id;
  }

  function conversa(workspaceId: string, canalId: string, contatoId: string, titulo = "Conversa", situacao = "aberta") {
    return pool().query<{ id: string }>(
      `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, situacao, criado_por_tipo, criado_por_id)
       values ($1, $2, $3, $4, $5, 'system', 'sistema') returning id`,
      [workspaceId, canalId, contatoId, titulo, situacao],
    );
  }

  function mensagem(
    workspaceId: string,
    conversaId: string,
    canalId: string,
    campos: { direcao?: string; idExterno?: string | null; status?: string | null; conteudo?: string | null; respostaA?: string | null } = {},
  ) {
    return pool().query<{ id: string }>(
      `insert into plataforma.mensagens
         (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo, id_externo, status_entrega, em_resposta_a_id)
       values ($1, $2, $3, $4, 'system', 'sistema', $5, $6, $7, $8) returning id`,
      [
        workspaceId,
        conversaId,
        canalId,
        campos.direcao ?? "recebida",
        campos.conteudo === undefined ? "oi" : campos.conteudo,
        campos.idExterno === undefined ? null : campos.idExterno,
        campos.status === undefined ? null : campos.status,
        campos.respostaA === undefined ? null : campos.respostaA,
      ],
    );
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    ana = await contato(A, "Ana");
    bia = await contato(A, "Bia");
    contatoDeB = await contato(B, "Contato de B");
  });

  afterAll(async () => {
    await limparEspaco(A);
    await limparEspaco(B);
    await encerrar();
  });

  it("1. dois WhatsApps (cloud e não oficial) com números distintos inserem", async () => {
    comercial = await semearCanal(A, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-cloud",
      identificadorExterno: "+5511977770101",
    });
    suporte = await semearCanal(A, {
      nome: "Suporte",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770102",
    });
    expect(comercial).not.toBe(suporte);
  });

  it("2. o mesmo número no WhatsApp não oficial é recusado por canais_conta_uq (INV-CXE-01)", async () => {
    await barrado(
      semearCanal(A, { nome: "Terceiro", tipo: "whatsapp", provedor: "whatsapp-nao-oficial", identificadorExterno: "+5511977770101" }),
      "23505",
      "canais_conta_uq",
    );
  });

  it("3. nome com espaços e caixa diferentes é recusado por canais_nome_uq (RN-CXE-31)", async () => {
    await barrado(
      semearCanal(A, { nome: "  comercial ", tipo: "whatsapp", provedor: "whatsapp-nao-oficial", identificadorExterno: "+5511977770199" }),
      "23505",
      "canais_nome_uq",
    );
  });

  it("4. email com provedor de WhatsApp é recusado por canais_provedor_tipo_ck", async () => {
    await barrado(
      semearCanal(A, { nome: "Email torto", tipo: "email", provedor: "whatsapp-cloud", identificadorExterno: "torto@x.com" }),
      "23514",
      "canais_provedor_tipo_ck",
    );
  });

  it("5. conexão simulada com Canal desconectado é recusada por canais_simulada_ck", async () => {
    await barrado(
      semearCanal(A, {
        nome: "Simulada solta",
        tipo: "email",
        provedor: "email-imap-smtp",
        identificadorExterno: "simulada@x.com",
        conexao: "desconectada",
        conexaoSimulada: true,
      }),
      "23514",
      "canais_simulada_ck",
    );
  });

  it("6. arquivar um Canal conectado sem desconectar é recusado por canais_arquivado_desconectado_ck", async () => {
    const id = await semearCanal(A, {
      nome: "Conectado",
      tipo: "email",
      provedor: "email-imap-smtp",
      identificadorExterno: "conectado@x.com",
      conexao: "conectada",
    });
    await barrado(
      pool().query("update plataforma.canais set estado = 'arquivado', arquivado_em = now() where workspace_id = $1 and id = $2", [A, id]),
      "23514",
      "canais_arquivado_desconectado_ck",
    );
  });

  it("7. arquivar desconectando na mesma linha passa e o número do arquivado fica livre", async () => {
    const id = await semearCanal(A, {
      nome: "Marketing",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770103",
      conexao: "conectada",
    });
    await pool().query(
      "update plataforma.canais set estado = 'arquivado', conexao = 'desconectada', arquivado_em = now() where workspace_id = $1 and id = $2",
      [A, id],
    );
    const novo = await semearCanal(A, {
      nome: "Marketing 2",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770103",
    });
    expect(novo).not.toBe(id);
  });

  it("8. Conversa de um Espaço apontando o Canal de outro é recusada pela FK composta (T-08-19)", async () => {
    await barrado(conversa(B, comercial, contatoDeB), "23503", "conversas_workspace_id_canal_id_fkey");
  });

  let conversaComercial = "";
  let conversaSuporte = "";

  it("9. a 2ª Conversa aberta do par (Contato, Canal) é recusada; o mesmo Contato noutro Canal do mesmo tipo passa (20.6)", async () => {
    conversaComercial = (await conversa(A, comercial, ana, "Ana no Comercial")).rows[0]!.id;
    await barrado(conversa(A, comercial, ana, "Ana de novo"), "23505", "conversas_nao_resolvida_uq");
    conversaSuporte = (await conversa(A, suporte, ana, "Ana no Suporte")).rows[0]!.id;
    expect(conversaSuporte).not.toBe(conversaComercial);
  });

  it("10. Mensagem num Canal diferente do da Conversa é recusada pela FK composta (T-08-19)", async () => {
    await barrado(
      mensagem(A, conversaComercial, suporte, { idExterno: "wamid.fora" }),
      "23503",
      "mensagens_workspace_id_conversa_id_canal_id_fkey",
    );
  });

  it("11. id externo repetido no mesmo Canal é recusado; noutro Canal passa (INV-CXE-08)", async () => {
    await mensagem(A, conversaComercial, comercial, { idExterno: "wamid.1" });
    await barrado(mensagem(A, conversaComercial, comercial, { idExterno: "wamid.1" }), "23505", "mensagens_id_externo_uq");
    await mensagem(A, conversaSuporte, suporte, { idExterno: "wamid.1" });
  });

  it("12. recebida sem id externo, enviada sem status, recebida com status e Mensagem vazia são recusadas (INV-CXE-09, 7.6, INV-CXE-07)", async () => {
    await barrado(mensagem(A, conversaComercial, comercial, { direcao: "recebida", idExterno: null }), "23514", "mensagens_id_externo_ck");
    await barrado(
      mensagem(A, conversaComercial, comercial, { direcao: "enviada", status: null }),
      "23514",
      "mensagens_status_direcao_ck",
    );
    await barrado(
      mensagem(A, conversaComercial, comercial, { direcao: "recebida", idExterno: "wamid.2", status: "entregue" }),
      "23514",
      "mensagens_status_direcao_ck",
    );
    await barrado(
      mensagem(A, conversaComercial, comercial, { direcao: "recebida", idExterno: "wamid.3", conteudo: null }),
      "23514",
      "mensagens_conteudo_ck",
    );
  });

  it("13. em resposta a uma Mensagem de outra Conversa é recusado; da mesma Conversa passa (INV-CXE-10)", async () => {
    const original = (await mensagem(A, conversaComercial, comercial, { idExterno: "wamid.orig" })).rows[0]!.id;
    const outraConversa = (await conversa(A, comercial, bia, "Bia no Comercial")).rows[0]!.id;
    await barrado(
      mensagem(A, outraConversa, comercial, { idExterno: "wamid.resp-fora", respostaA: original }),
      "23503",
      "mensagens_workspace_id_conversa_id_em_resposta_a_id_fkey",
    );
    await mensagem(A, conversaComercial, comercial, { idExterno: "wamid.resp", respostaA: original });
  });

  it("14. apagar Canal ou Contato que tem Conversa é recusado", async () => {
    await barrado(
      pool().query("delete from plataforma.canais where workspace_id = $1 and id = $2", [A, comercial]),
      "23503",
      "conversas_workspace_id_canal_id_fkey",
    );
    await barrado(
      pool().query("delete from plataforma.contatos where workspace_id = $1 and id = $2", [A, ana]),
      "23503",
      "conversas_workspace_id_contato_id_fkey",
    );
  });

  it("15. apagar uma Conversa leva as Mensagens, inclusive a que responde a outra", async () => {
    const antes = await pool().query<{ total: number }>(
      "select count(*)::int as total from plataforma.mensagens where conversa_id = $1",
      [conversaComercial],
    );
    expect(antes.rows[0]!.total).toBeGreaterThanOrEqual(3);
    await pool().query("delete from plataforma.conversas where workspace_id = $1 and id = $2", [A, conversaComercial]);
    const depois = await pool().query<{ total: number }>(
      "select count(*)::int as total from plataforma.mensagens where conversa_id = $1",
      [conversaComercial],
    );
    expect(depois.rows[0]!.total).toBe(0);
  });

  it("16. o trigger move atualizado_em a cada update", async () => {
    const lido = () =>
      pool().query<{ atualizado_em: Date }>("select atualizado_em from plataforma.canais where workspace_id = $1 and id = $2", [A, suporte]);
    const antes = (await lido()).rows[0]!.atualizado_em;
    await pool().query("select pg_sleep(0.05)");
    await pool().query("update plataforma.canais set nome = 'Suporte N1' where workspace_id = $1 and id = $2", [A, suporte]);
    const depois = (await lido()).rows[0]!.atualizado_em;
    expect(depois.getTime()).toBeGreaterThan(antes.getTime());
  });

  it("17. a 008 roda uma 2ª vez sobre si mesma sem erro (idempotente)", async () => {
    const texto = readFileSync(SQL_008, "utf8");
    await expect(pool().query(texto)).resolves.toBeDefined();
  });
});
