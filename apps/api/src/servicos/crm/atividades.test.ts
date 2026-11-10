/**
 * Serviço de Atividades do CRM (15-37, D-15-09), contra o Postgres LOCAL.
 *
 * O traçador: a Atividade que a Nota do Contato grava (15-04) sai por `listar`
 * como `ActivityRecord`. A leitura nunca grava, e o Espaço vem da sessão.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, poolDoDono, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeAtividades } from "./atividades";
import { criarServicoDeNotas } from "./notas";
import type { ResultadoCrm } from "./resultado";

// A matriz de hoje (`podeNoCrm`) não tem Papel que leia um recurso e não outro. Para provar que a
// leitura sem objeto filtra POR TIPO, o Convidado perde `ler` em `negocio` só neste arquivo; todo o
// resto da matriz é a de verdade.
vi.mock("@n1/dominio/crm/permissoes", async (original) => {
  const real = await original<typeof import("@n1/dominio/crm/permissoes")>();
  return {
    ...real,
    podeNoCrm: ((base, estado, acao, recurso, contexto) =>
      base === "convidado" && acao === "ler" && recurso === "negocio"
        ? "O Convidado não consulta Negócios (papel de teste)."
        : real.podeNoCrm(base, estado, acao, recurso, contexto)) satisfies typeof real.podeNoCrm,
  };
});

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
  const outroWs = novoEspacoDeTeste("svcativb");
  const eu = membro(ws);

  /** Atividade com o momento escolhido (`em` do banco é `now()`; aqui é explícito para o cursor não depender do relógio). */
  async function semearAtividade(
    workspaceId: string,
    objetoTipo: string,
    objetoId: string,
    acao: string,
    em: string,
  ): Promise<void> {
    await poolDoDono().query(
      `insert into plataforma.crm_atividades (workspace_id, ator_tipo, ator_id, acao, objeto_tipo, objeto_id, objeto_nome, em)
       values ($1, 'member', 'mem_ana', $2, $3, $4, 'Objeto', $5::timestamptz)`,
      [workspaceId, acao, objetoTipo, objetoId, em],
    );
  }

  const contarAtividades = async (workspaceId: string) =>
    Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.crm_atividades where workspace_id = $1", [workspaceId])).rows[0]!.n);

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
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    await semearMembro(ws, { id: "mem_saiu", base: "membro", state: "removido" });
    await semearMembro(outroWs, { id: "mem_ana", base: "membro", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
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

  it("(b) Atividade de outro Espaço nunca aparece, nem com o mesmo objeto nem sem objeto (T-15-12)", async () => {
    const objetoId = "obj-compartilhado-entre-espacos";
    await semearAtividade(ws, "contact", objetoId, "Gesto do Espaço da sessão", "2026-11-01T10:00:00Z");
    await semearAtividade(outroWs, "contact", objetoId, "Gesto de OUTRO Espaço", "2026-11-01T11:00:00Z");

    const comObjeto = valor(await servico.listar(eu, { objetoTipo: "contact", objetoId, limite: 50 }));
    expect(comObjeto.map((a) => a.action)).toEqual(["Gesto do Espaço da sessão"]);
    expect(comObjeto.every((a) => a.workspaceId === ws)).toBe(true);

    const semObjeto = valor(await servico.listar(eu, { limite: 200 }));
    expect(semObjeto.some((a) => a.action === "Gesto de OUTRO Espaço")).toBe(false);
    expect(semObjeto.every((a) => a.workspaceId === ws)).toBe(true);

    // E o contrário: quem é do outro Espaço não enxerga o nosso.
    const doOutro = valor(await servico.listar(membro(outroWs), { objetoTipo: "contact", objetoId, limite: 50 }));
    expect(doOutro.map((a) => a.action)).toEqual(["Gesto de OUTRO Espaço"]);
  });

  it("(c) sem objeto, o Papel sem `ler` em Negócio não recebe linhas de Negócio; com objeto Negócio é 403", async () => {
    await semearAtividade(ws, "deal", "negocio-do-papel", "Negócio movido", "2026-11-02T10:00:00Z");
    await semearAtividade(ws, "contact", "contato-do-papel", "Contato editado", "2026-11-02T11:00:00Z");
    const convidado = membro(ws, "mem_convidado");

    const doConvidado = valor(await servico.listar(convidado, { limite: 200 }));
    expect(doConvidado.some((a) => a.objectType === "contact")).toBe(true);
    expect(doConvidado.some((a) => a.objectType === "deal")).toBe(false);

    const doMembro = valor(await servico.listar(eu, { limite: 200 }));
    expect(doMembro.some((a) => a.objectType === "deal")).toBe(true);

    const recusa = await servico.listar(convidado, { objetoTipo: "deal", objetoId: "negocio-do-papel", limite: 50 });
    expect(recusa).toMatchObject({ ok: false, status: 403, codigo: "PERMISSAO" });
  });

  it("(d) Membro removido ou desconhecido não lê nada: 403, com e sem objeto", async () => {
    for (const quem of [membro(ws, "mem_saiu"), membro(ws, "mem_que_nao_existe")]) {
      expect(await servico.listar(quem, { limite: 50 })).toMatchObject({ ok: false, status: 403, codigo: "PERMISSAO" });
      expect(await servico.listar(quem, { objetoTipo: "contact", objetoId: "qualquer", limite: 50 })).toMatchObject({
        ok: false,
        status: 403,
        codigo: "PERMISSAO",
      });
    }
  });

  it("(e) o cursor `ate` devolve só as linhas anteriores a ele, e o limite corta nas mais recentes", async () => {
    const objetoId = "obj-do-cursor";
    await semearAtividade(ws, "contact", objetoId, "primeira", "2026-10-01T10:00:00Z");
    await semearAtividade(ws, "contact", objetoId, "segunda", "2026-10-02T10:00:00Z");
    await semearAtividade(ws, "contact", objetoId, "terceira", "2026-10-03T10:00:00Z");

    const todas = valor(await servico.listar(eu, { objetoTipo: "contact", objetoId, limite: 50 }));
    expect(todas.map((a) => a.action)).toEqual(["terceira", "segunda", "primeira"]);

    const antesDaSegunda = valor(await servico.listar(eu, { objetoTipo: "contact", objetoId, limite: 50, ate: todas[1]!.at }));
    expect(antesDaSegunda.map((a) => a.action)).toEqual(["primeira"]);

    const duas = valor(await servico.listar(eu, { objetoTipo: "contact", objetoId, limite: 2 }));
    expect(duas.map((a) => a.action)).toEqual(["terceira", "segunda"]);
  });

  it("(g) cursor composto (ate + ateId): linhas do MESMO instante atravessam a fronteira da pagina sem pular nem repetir (WINDOWS 15-37)", async () => {
    // A sucessao grava varias Atividades no mesmo commit, e `now()` e o da transacao: elas dividem o `em`.
    const objetoId = "obj-do-mesmo-instante";
    const mesmoInstante = "2026-10-10T10:00:00.123Z";
    for (const acao of ["a", "b", "c", "d", "e"]) await semearAtividade(ws, "contact", objetoId, acao, mesmoInstante);

    const todas = valor(await servico.listar(eu, { objetoTipo: "contact", objetoId, limite: 50 }));
    expect(todas).toHaveLength(5);

    // Cursor so de tempo: a fronteira da pagina corta o grupo e o resto some (a limitacao registrada).
    const soTempo = valor(await servico.listar(eu, { objetoTipo: "contact", objetoId, limite: 50, ate: todas[1]!.at }));
    expect(soTempo).toHaveLength(0);

    // Cursor composto: pagina a pagina (2 por vez) devolve as cinco, na ordem, sem repetir.
    const vistas: string[] = [];
    let cursor: { ate?: string; ateId?: string } = {};
    for (let paginas = 0; paginas < 5; paginas += 1) {
      const pagina = valor(await servico.listar(eu, { objetoTipo: "contact", objetoId, limite: 2, ...cursor }));
      if (pagina.length === 0) break;
      vistas.push(...pagina.map((a) => a.id));
      const ultima = pagina[pagina.length - 1]!;
      cursor = { ate: ultima.at, ateId: ultima.id };
    }
    expect(vistas).toEqual(todas.map((a) => a.id));
  });

  it("(f) o pedido torto é 400 e a leitura nunca grava", async () => {
    const antes = await contarAtividades(ws);
    expect(await servico.listar(eu, { objetoTipo: "contact", limite: 50 })).toMatchObject({ ok: false, status: 400, campo: "objetoId" });
    expect(await servico.listar(eu, { objetoId: "x", limite: 50 })).toMatchObject({ ok: false, status: 400, campo: "objetoTipo" });
    expect(await servico.listar(eu, { limite: 0 })).toMatchObject({ ok: false, status: 400, campo: "limite" });
    expect(await servico.listar(eu, { limite: 201 })).toMatchObject({ ok: false, status: 400, campo: "limite" });
    expect(await servico.listar(eu, { objetoTipo: "grupo", objetoId: "x", limite: 50 })).toMatchObject({
      ok: false,
      status: 400,
      campo: "objetoTipo",
    });
    valor(await servico.listar(eu, { limite: 200 }));
    expect(await contarAtividades(ws)).toBe(antes);
  });
});
