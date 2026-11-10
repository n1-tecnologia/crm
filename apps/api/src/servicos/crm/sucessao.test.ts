/**
 * A prévia da sucessão de um Membro (14-10, 3.2.8), contra o Postgres LOCAL.
 *
 * Só Administrador ou Proprietário ativo vê quanto vai mudar de mãos (T-14-26);
 * um Membro de outro Espaço, ou que não existe, é 404 — e quem não pode
 * ver nem descobre se o Membro existe (o Papel é conferido primeiro).
 *
 * `passarAoSucessor` (15-03, D-15-08): as Conversas do Membro removido passam ao
 * Sucessor como Atribuído, no mesmo commit, e a de Agente não muda.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { contarDoMembro, passarAoSucessor } from "../../repositorios/crm/sucessao";
import { criarServicoDeSucessao } from "./sucessao";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeSucessao({ pool });

/** Quem remove o Membro: o ator das Atividades da sucessão. */
const QUEM_REMOVE = { kind: "member", id: "mem_admin" } as const;

function membro(workspaceId: string, id: string): MembroDaSessao {
  return { id, workspaceId, state: "ativo" };
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

describeComBanco("ServicoDeSucessao — Postgres local", () => {
  const ws = novoEspacoDeTeste("svcsucessao");
  const outroWs = novoEspacoDeTeste("svcsucessaob");

  async function contato(workspaceId: string, nome: string, dono: string): Promise<string> {
    const { rows } = await pool().query<{ id: string }>(
      "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, $2, $3, $3) returning id",
      [workspaceId, nome, dono],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_dono", base: "proprietario", state: "ativo" });
    await semearMembro(ws, { id: "mem_comum", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    await semearMembro(ws, { id: "mem_admin_suspenso", base: "administrador", state: "suspenso" });
    await semearMembro(ws, { id: "mem_alvo", base: "membro", state: "ativo" });
    await semearMembro(outroWs, { id: "mem_de_outro", base: "membro", state: "ativo" });

    const c1 = await contato(ws, "Do alvo 1", "mem_alvo");
    await contato(ws, "Do alvo 2", "mem_alvo");
    await contato(ws, "De outro Membro", "mem_comum");
    // Dois registros de outro Espaço com o mesmo dono: não entram na conta.
    await contato(outroWs, "Outro Espaço", "mem_alvo");
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { rows } = await cliente.query<{ id: string }>(
        "insert into plataforma.empresas (workspace_id, nome_fantasia, proprietario_id, criado_por) values ($1, 'Empresa do alvo', 'mem_alvo', 'mem_alvo') returning id",
        [ws],
      );
      await cliente.query("insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, true, 'mem_alvo')", [ws, c1, rows[0]!.id]);
      await cliente.query("commit");
    } finally {
      cliente.release();
    }
    const funil = (await pool().query<{ id: string }>("insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, 'Funil', 'mem_alvo') returning id", [ws])).rows[0]!.id;
    const etapa = (await pool().query<{ id: string }>("insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Etapa', 1) returning id", [ws, funil])).rows[0]!.id;
    await pool().query(
      "insert into plataforma.negocios (workspace_id, titulo, contato_id, funil_id, etapa_id, proprietario_id, criado_por) values ($1, 'Negócio do alvo', $2, $3, $4, 'mem_alvo', 'mem_alvo')",
      [ws, c1, funil, etapa],
    );
    const canal = await semearCanal(ws, { nome: "Canal", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "5511911111111" });
    await pool().query(
      `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, atribuido_tipo, atribuido_id, criado_por_tipo, criado_por_id)
       values ($1, $2, $3, 'Atribuída ao alvo', 'membro', 'mem_alvo', 'membro', 'mem_alvo')`,
      [ws, canal, c1],
    );
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
    await encerrar();
  });

  it("o Administrador ativo recebe as contagens do Membro neste Espaço", async () => {
    const resultado = await servico.previa(membro(ws, "mem_admin"), "mem_alvo");
    expect(resultado).toEqual({ ok: true, valor: { contatos: 2, empresas: 1, negocios: 1, conversasPassadas: 1 } });
  });

  it("o Proprietário ativo também vê; um Membro sem nada dá tudo zero", async () => {
    expect(await servico.previa(membro(ws, "mem_dono"), "mem_alvo")).toMatchObject({ ok: true });
    expect(await servico.previa(membro(ws, "mem_dono"), "mem_convidado")).toEqual({
      ok: true,
      valor: { contatos: 0, empresas: 0, negocios: 0, conversasPassadas: 0 },
    });
  });

  it.each([
    ["Membro comum", "mem_comum"],
    ["Convidado", "mem_convidado"],
    ["Administrador suspenso", "mem_admin_suspenso"],
    ["quem não é Membro deste Espaço", "mem_de_outro"],
  ])("%s recebe 403 com a frase", async (_rotulo, quem) => {
    const r = recusado(await servico.previa(membro(ws, quem), "mem_alvo"));
    expect(r.status).toBe(403);
    expect(r.error).toBe("Só um Administrador ou o Proprietário ativo vê a sucessão de um Membro.");
  });

  it("um Membro de outro Espaço, ou que não existe, é 404 — e não vaza as contagens do outro Espaço", async () => {
    for (const alvo of ["mem_de_outro", "mem_que_nao_existe"]) {
      const r = recusado(await servico.previa(membro(ws, "mem_admin"), alvo));
      expect(r.status).toBe(404);
      expect(r.codigo).toBe("MEMBRO_NAO_ENCONTRADO");
    }
  });

  // Sempre por último: muda o dono do que as contagens acima leem.
  describe("passarAoSucessor — Conversas do Membro removido (D-15-08)", () => {
    const conversaDe = async (titulo: string) =>
      (
        await pool().query<{ atribuido_tipo: string | null; atribuido_id: string | null }>(
          "select atribuido_tipo, atribuido_id from plataforma.conversas where workspace_id = $1 and titulo = $2",
          [ws, titulo],
        )
      ).rows[0];

    async function passar() {
      const cliente = await pool().connect();
      try {
        await cliente.query("begin");
        await passarAoSucessor(cliente, ws, "mem_alvo", "mem_dono", QUEM_REMOVE);
        await cliente.query("commit");
      } finally {
        cliente.release();
      }
    }

    it("a Conversa atribuída ao Membro passa ao Sucessor como membro, e a de Agente não muda", async () => {
      const canal = await semearCanal(ws, { nome: "Canal do Agente", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "5511922222222" });
      const doAgente = await contato(ws, "Contato do Agente", "mem_comum");
      await pool().query(
        `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, atribuido_tipo, atribuido_id, criado_por_tipo, criado_por_id)
         values ($1, $2, $3, 'Atribuída ao Agente', 'agente', 'age_x', 'agente', 'age_x')`,
        [ws, canal, doAgente],
      );
      expect(await contarDoMembro(pool(), ws, "mem_alvo")).toMatchObject({ conversasPassadas: 1 });

      await passar();

      expect(await conversaDe("Atribuída ao alvo")).toEqual({ atribuido_tipo: "membro", atribuido_id: "mem_dono" });
      expect(await conversaDe("Atribuída ao Agente")).toEqual({ atribuido_tipo: "agente", atribuido_id: "age_x" });
    });

    it("rodar de novo não muda nada: já está com o Sucessor e a contagem do removido é zero", async () => {
      await passar();
      expect(await conversaDe("Atribuída ao alvo")).toEqual({ atribuido_tipo: "membro", atribuido_id: "mem_dono" });
      expect(await contarDoMembro(pool(), ws, "mem_alvo")).toEqual({ contatos: 0, empresas: 0, negocios: 0, conversasPassadas: 0 });
    });
  });

  // 15-09 (D-15-08, RN-ET-09): cada registro passado ao Sucessor deixa o seu Registro de Atividade.
  // Dentro do describe externo: o pool é encerrado uma vez só, no `afterAll` dele.
  describe("passarAoSucessor — Atividade por registro passado (15-09)", () => {
  const ws = novoEspacoDeTeste("sucativ");
  const outroWs = novoEspacoDeTeste("sucativb");

  interface LinhaDeAtividade {
    readonly acao: string;
    readonly ator_tipo: string;
    readonly ator_id: string;
    readonly objeto_tipo: string;
    readonly objeto_nome: string;
    readonly antes: string | null;
    readonly depois: string | null;
    readonly detalhe: string | null;
    readonly em: Date;
  }

  const atividades = async (workspaceId: string) =>
    (
      await pool().query<LinhaDeAtividade>(
        `select acao, ator_tipo, ator_id, objeto_tipo, objeto_nome, antes, depois, detalhe, em
           from plataforma.crm_atividades where workspace_id = $1 order by objeto_tipo, objeto_nome`,
        [workspaceId],
      )
    ).rows;

  async function passar(workspaceId: string, de: string, para: string) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      await passarAoSucessor(cliente, workspaceId, de, para, QUEM_REMOVE);
      await cliente.query("commit");
    } finally {
      cliente.release();
    }
  }

  async function contato(workspaceId: string, nome: string | null, sobrenome: string | null, dono: string): Promise<string> {
    const { rows } = await pool().query<{ id: string }>(
      "insert into plataforma.contatos (workspace_id, nome, sobrenome, proprietario_id, criado_por) values ($1, $2, $3, $4, $4) returning id",
      [workspaceId, nome, sobrenome, dono],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    await semearMembro(ws, { id: "mem_alvo", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_dono", base: "proprietario", state: "ativo" });
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(outroWs, { id: "mem_alvo", base: "membro", state: "ativo" });

    const c1 = await contato(ws, "Ana", "Souza", "mem_alvo");
    const semNome = await contato(ws, null, null, "mem_alvo");
    await contato(ws, "De outro Membro", null, "mem_admin");
    await contato(outroWs, "Outro Espaço", null, "mem_alvo");
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { rows } = await cliente.query<{ id: string }>(
        "insert into plataforma.empresas (workspace_id, nome_fantasia, proprietario_id, criado_por) values ($1, 'Empresa do alvo', 'mem_alvo', 'mem_alvo') returning id",
        [ws],
      );
      await cliente.query("insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, true, 'mem_alvo')", [ws, c1, rows[0]!.id]);
      await cliente.query("commit");
    } finally {
      cliente.release();
    }
    const funil = (await pool().query<{ id: string }>("insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, 'Funil', 'mem_alvo') returning id", [ws])).rows[0]!.id;
    const etapa = (await pool().query<{ id: string }>("insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Etapa', 1) returning id", [ws, funil])).rows[0]!.id;
    await pool().query(
      "insert into plataforma.negocios (workspace_id, titulo, contato_id, funil_id, etapa_id, proprietario_id, criado_por) values ($1, 'Negócio do alvo', $2, $3, $4, 'mem_alvo', 'mem_alvo')",
      [ws, c1, funil, etapa],
    );
    const canal = await semearCanal(ws, { nome: "Canal", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "5511933333333" });
    await pool().query(
      `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, atribuido_tipo, atribuido_id, criado_por_tipo, criado_por_id)
       values ($1, $2, $3, 'Conversa do alvo', 'membro', 'mem_alvo', 'membro', 'mem_alvo')`,
      [ws, canal, c1],
    );
    // Uma Conversa de Agente: não é do Membro e não gera linha.
    await pool().query(
      `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, atribuido_tipo, atribuido_id, criado_por_tipo, criado_por_id)
       values ($1, $2, $3, 'Conversa do Agente', 'agente', 'age_x', 'agente', 'age_x')`,
      [ws, canal, semNome],
    );
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
  });

  it("uma linha por Contato, Empresa, Negócio e Conversa passados, com o ator de quem remove e o nome do Sucessor", async () => {
    await passar(ws, "mem_alvo", "mem_dono");

    const linhas = await atividades(ws);
    expect(linhas.map((l) => [l.objeto_tipo, l.objeto_nome, l.acao])).toEqual([
      ["company", "Empresa do alvo", "Empresa passada ao Sucessor"],
      ["contact", "Ana Souza", "Contato passado ao Sucessor"],
      ["contact", "Contato sem nome", "Contato passado ao Sucessor"],
      ["conversation", "Conversa do alvo", "Conversa passada ao Sucessor"],
      ["deal", "Negócio do alvo", "Negócio passado ao Sucessor"],
    ]);
    // O ator é quem removeu, não o Membro removido; `depois` é o nome do Sucessor e nada mais vai na linha.
    expect(linhas.every((l) => l.ator_tipo === "member" && l.ator_id === "mem_admin")).toBe(true);
    expect(linhas.every((l) => l.depois === "mem_dono" && l.antes === null && l.detalhe === null)).toBe(true);
    // Todas no mesmo instante (o commit é um só), em milissegundos.
    expect(new Set(linhas.map((l) => l.em.getTime())).size).toBe(1);
    // O que é de outro Espaço não gera linha aqui nem lá.
    expect(await atividades(outroWs)).toEqual([]);
  });

  it("repetir não grava linha nova: só o que ainda é do Membro gera Atividade", async () => {
    const antes = (await atividades(ws)).length;
    await passar(ws, "mem_alvo", "mem_dono");
    expect(await atividades(ws)).toHaveLength(antes);
  });

  it("a remoção que desfaz (rollback) leva as Atividades junto", async () => {
    await contato(ws, "Chegou depois", null, "mem_alvo");
    const antes = (await atividades(ws)).length;
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      await passarAoSucessor(cliente, ws, "mem_alvo", "mem_dono", QUEM_REMOVE);
      await cliente.query("rollback");
    } finally {
      cliente.release();
    }
    expect(await atividades(ws)).toHaveLength(antes);
  });
});
});
