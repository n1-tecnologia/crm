/**
 * Rotas REST de Contato — o traçador (07-01) e o CRUD completo (07-03).
 *
 * Duas partes. A primeira roda sempre, com um serviço falso injetado por
 * `buildApp({ crm: { contatos } })` (sem banco, D-DEC-09): autenticação, forma
 * do corpo (`.strict()`, T-07-02) e envelope da lista. A segunda
 * (`describeComBanco`) usa o serviço real contra o Postgres LOCAL — nunca
 * contra o banco remoto do `.env` (D-12, `testes/banco-crm.ts`) — e prova a
 * gravação em `plataforma.contatos` com o `workspace_id` da sessão (T-07-01) e
 * o isolamento entre Espaços de Trabalho.
 *
 * 07-03 completa o contrato REST (ver `<interfaces>` do plano): o bloco sem
 * banco usa um serviço falso que REGISTRA as chamadas e devolve o que o caso
 * pede; o bloco com banco percorre o ciclo inteiro por `app.inject`.
 *
 * 07-02 acrescenta o Papel (D-14) e a troca de Proprietário (D-11): a segunda
 * parte semeia os Membros em `plataforma.registros` e usa o acesso REAL, que é
 * o que prova a consulta `members` → `roles`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { ContatoDetalhado, ContatoResumo } from "@n1/dominio/crm/contatos";
import { buildApp } from "../../app";
import { encerrar, pool } from "../../persistencia/conexao";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeContatos } from "../../servicos/crm/contatos";
import type { AcessoAoCrm } from "../../servicos/crm/acesso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";

const MARYANE = usuarioDoSeed("mem_maryane");
const membros = buildSeed().members;
const AUTORIZACAO = { authorization: "Bearer token-maryane" };

function opcoesDeAutenticacao(workspaceId: string) {
  return {
    logger: false,
    workspaceId,
    verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId: string, userId: string) => membros.find((m) => m.userId === userId),
  };
}

describe("rotas de Contatos — serviço falso, sem banco", () => {
  const resumo: ContatoResumo = {
    id: "c1",
    nomeDeExibicao: "Falso",
    estado: "ativo",
    proprietarioId: "mem_maryane",
    emailPrincipal: null,
    telefonePrincipal: null,
    atualizadoEm: "2026-10-09T00:00:00.000Z",
  };
  const detalhe: ContatoDetalhado = {
    contato: {
      id: "c1",
      nome: "Falso",
      sobrenome: null,
      dataNascimento: null,
      idioma: null,
      fusoHorario: null,
      fotoUrl: null,
      descricao: null,
      enderecos: [],
      camposAdicionais: {},
      origem: null,
      qualificacao: null,
      modoCriacao: "manual",
      estado: "ativo",
      proprietarioId: "mem_maryane",
      criadoPor: "mem_maryane",
      criadoEm: "2026-10-09T00:00:00.000Z",
      atualizadoEm: "2026-10-09T00:00:00.000Z",
    },
    identificadores: [],
    vinculos: [],
  };

  /** Serviço falso: registra `[método, ...argumentos]` e devolve `respostas[método]` ou o detalhe. */
  function novoFalso(respostas: Partial<Record<keyof ServicoDeContatos, ResultadoCrm<unknown>>> = {}) {
    const chamadas: unknown[][] = [];
    const responder = (nome: keyof ServicoDeContatos, ...argumentos: unknown[]) => {
      chamadas.push([nome, ...argumentos]);
      return Promise.resolve((respostas[nome] ?? sucesso(detalhe)) as never);
    };
    const servico: ServicoDeContatos = {
      listar: (...a) => responder("listar", ...a),
      criar: (...a) => responder("criar", ...a),
      obter: (...a) => responder("obter", ...a),
      editar: (...a) => responder("editar", ...a),
      adicionarIdentificador: (...a) => responder("adicionarIdentificador", ...a),
      editarIdentificador: (...a) => responder("editarIdentificador", ...a),
      removerIdentificador: (...a) => responder("removerIdentificador", ...a),
      arquivar: (...a) => responder("arquivar", ...a),
      restaurar: (...a) => responder("restaurar", ...a),
      enviarParaLixeira: (...a) => responder("enviarParaLixeira", ...a),
      excluirPermanentemente: (...a) => responder("excluirPermanentemente", ...a),
    };
    return { servico, chamadas };
  }
  const falso = novoFalso({ listar: sucesso({ itens: [resumo], total: 1 }) }).servico;
  const appCom = (servico: ServicoDeContatos) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { contatos: servico } });
  const app = () => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { contatos: falso } });

  it("(a) GET /contatos sem Authorization responde 401", async () => {
    const resposta = await app().inject({ method: "GET", url: "/contatos" });
    expect(resposta.statusCode).toBe(401);
  });

  it("(b) POST /contatos com workspaceId no corpo responde 400", async () => {
    const resposta = await app().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ana", workspaceId: "ws_de_outro" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(b) POST /contatos com criadoPor no corpo responde 400", async () => {
    const resposta = await app().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ana", criadoPor: "mem_outro" },
    });
    expect(resposta.statusCode).toBe(400);
  });

  it("(c) GET /contatos devolve { ok, itens, total } do serviço", async () => {
    const resposta = await app().inject({ method: "GET", url: "/contatos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [resumo], total: 1 });
  });

  it("(a) GET /contatos/c1 devolve { ok, dados } do serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/contatos/c1", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: detalhe });
    expect(chamadas[0]?.slice(0, 1)).toEqual(["obter"]);
    expect(chamadas[0]?.[2]).toBe("c1");
  });

  it("(a) serviço devolvendo 404 vira 404 { ok: false, error }", async () => {
    const { servico } = novoFalso({ obter: recusa(404, "Contato não encontrado.") });
    const resposta = await appCom(servico).inject({ method: "GET", url: "/contatos/nao-existe", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ ok: false, error: "Contato não encontrado." });
  });

  it.each([
    ["modoCriacao", { nome: "Ana", modoCriacao: "importacao" }],
    ["estado", { nome: "Ana", estado: "na_lixeira" }],
    ["criadoPor", { nome: "Ana", criadoPor: "mem_outro" }],
    ["workspaceId", { nome: "Ana", workspaceId: "ws_de_outro" }],
    ["tipo de Identificador desconhecido", { identificadores: [{ tipo: "fax", valor: "123" }] }],
    [
      "Identificadores demais",
      { identificadores: Array.from({ length: LIMITES_CRM.identificadoresMaximo + 1 }, (_, i) => ({ tipo: "email", valor: `a${i}@x.com` })) },
    ],
    ["dataNascimento fora do formato", { nome: "Ana", dataNascimento: "17/05/1990" }],
  ])("(b) POST /contatos com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: "/contatos", headers: AUTORIZACAO, payload });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("(c) DELETE /contatos/c1 sem corpo e sem content-type responde 200", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "DELETE", url: "/contatos/c1", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ok).toBe(true);
    expect(chamadas[0]?.[0]).toBe("enviarParaLixeira");
  });

  it("(c) 409 do serviço chega com codigo e bloqueios intactos", async () => {
    const bloqueios = {
      empresas: [{ id: "e1", nome: "Alfa" }],
      negocios: { total: 2, itens: [{ id: "n1", titulo: "A" }] },
    };
    const { servico } = novoFalso({
      enviarParaLixeira: recusa(409, "Este Contato não pode ir para a lixeira.", { codigo: "CONTATO_BLOQUEADO", bloqueios }),
    });
    const resposta = await appCom(servico).inject({ method: "DELETE", url: "/contatos/c1", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({
      ok: false,
      error: "Este Contato não pode ir para a lixeira.",
      codigo: "CONTATO_BLOQUEADO",
      bloqueios,
    });
  });

  it("(c) DELETE /contatos/c1/permanente responde { ok, dados: { id } }", async () => {
    const { servico, chamadas } = novoFalso({ excluirPermanentemente: sucesso({ id: "c1" }) });
    const resposta = await appCom(servico).inject({ method: "DELETE", url: "/contatos/c1/permanente", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: { id: "c1" } });
    expect(chamadas[0]?.[0]).toBe("excluirPermanentemente");
  });

  it.each([
    ["arquivar", "/contatos/c1/arquivar"],
    ["restaurar", "/contatos/c1/restaurar"],
  ])("(d) POST %s sem corpo responde 200", async (metodo, url) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url, headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.[0]).toBe(metodo);
  });

  it("(d) PATCH /contatos/c1 com {} responde 400: edição vazia não é edição", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "PATCH", url: "/contatos/c1", headers: AUTORIZACAO, payload: {} });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it("(d) PATCH /contatos/c1 não aceita identificadores nem estado", async () => {
    const { servico } = novoFalso();
    for (const payload of [{ identificadores: [] }, { estado: "arquivado" }]) {
      const resposta = await appCom(servico).inject({ method: "PATCH", url: "/contatos/c1", headers: AUTORIZACAO, payload });
      expect(resposta.statusCode).toBe(400);
    }
  });

  it("(d) PATCH /contatos/c1 repassa a edição ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "PATCH",
      url: "/contatos/c1",
      headers: AUTORIZACAO,
      payload: { nome: "Novo", proprietarioId: "mem_outro" },
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.slice(2)).toEqual(["c1", { nome: "Novo", proprietarioId: "mem_outro" }]);
  });

  it("(d) sub-recurso de Identificadores: POST 201, PATCH e DELETE 200; PATCH vazio e tipo inválido 400", async () => {
    const { servico, chamadas } = novoFalso();
    const a = appCom(servico);
    const criado = await a.inject({
      method: "POST",
      url: "/contatos/c1/identificadores",
      headers: AUTORIZACAO,
      payload: { tipo: "email", valor: "a@x.com" },
    });
    expect(criado.statusCode).toBe(201);
    const editado = await a.inject({
      method: "PATCH",
      url: "/contatos/c1/identificadores/i1",
      headers: AUTORIZACAO,
      payload: { principal: true },
    });
    expect(editado.statusCode).toBe(200);
    const removido = await a.inject({ method: "DELETE", url: "/contatos/c1/identificadores/i1", headers: AUTORIZACAO });
    expect(removido.statusCode).toBe(200);
    expect(chamadas.map((c) => c[0])).toEqual(["adicionarIdentificador", "editarIdentificador", "removerIdentificador"]);

    const vazio = await a.inject({ method: "PATCH", url: "/contatos/c1/identificadores/i1", headers: AUTORIZACAO, payload: {} });
    expect(vazio.statusCode).toBe(400);
    const invalido = await a.inject({
      method: "POST",
      url: "/contatos/c1/identificadores",
      headers: AUTORIZACAO,
      payload: { tipo: "fax", valor: "1" },
    });
    expect(invalido.statusCode).toBe(400);
  });

  it.each(["/contatos?limite=500", "/contatos?estado=mesclado", "/contatos?q=" + "x".repeat(101)])(
    "(e) GET %s responde 400",
    async (url) => {
      const resposta = await appCom(falso).inject({ method: "GET", url, headers: AUTORIZACAO });
      expect(resposta.statusCode).toBe(400);
    },
  );

  it("(i) Convidado recebe 403 em POST /contatos com o acesso falso, sem chegar ao banco", async () => {
    const acessoFalso: AcessoAoCrm = {
      papelDe: async () => ({ base: "convidado", estado: "ativo" }),
      membroAtivo: async () => true,
    };
    // Sem `contatos`: o serviço é o real, e a recusa de Papel vem antes de qualquer `pool()`.
    const comAcessoFalso = buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { acesso: acessoFalso } });
    const resposta = await comAcessoFalso.inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ana" },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "PERMISSAO" });
  });
});

/** Sessões do bloco com banco: cada token é um Membro, e o `id` dele é o da linha semeada. */
const SESSOES = {
  "token-maryane": { sub: MARYANE, membroId: "mem_maryane" },
  "token-convidado": { sub: "usuario-convidado", membroId: "mem_convidado" },
} as const;

function opcoesComPapeis(workspaceId: string) {
  const base = membros.find((m) => m.id === "mem_maryane");
  return {
    logger: false,
    workspaceId,
    verificarToken: async (token: string) => {
      const sessao = SESSOES[token as keyof typeof SESSOES];
      return sessao ? { sub: sessao.sub } : null;
    },
    resolverMembro: async (_workspaceId: string, userId: string) => {
      const sessao = Object.values(SESSOES).find((s) => s.sub === userId);
      if (!sessao || !base) return undefined;
      return { ...base, id: sessao.membroId, userId, state: "ativo" as const };
    },
  };
}

const AUTORIZACAO_CONVIDADO = { authorization: "Bearer token-convidado" };

describeComBanco("rotas de Contatos — serviço real, Postgres local", () => {
  const espacoA = novoEspacoDeTeste("contatosa");
  const espacoB = novoEspacoDeTeste("contatosb");
  const appA = () => buildApp(opcoesComPapeis(espacoA));
  const appB = () => buildApp(opcoesComPapeis(espacoB));

  beforeAll(async () => {
    await prepararBancoCrm();
    for (const espaco of [espacoA, espacoB]) {
      await semearMembro(espaco, { id: "mem_maryane", base: "membro", state: "ativo" });
      await semearMembro(espaco, { id: "mem_convidado", base: "convidado", state: "ativo" });
    }
    await semearMembro(espacoA, { id: "mem_outro", base: "membro", state: "ativo" });
    await semearMembro(espacoA, { id: "mem_removido", base: "membro", state: "removido" });
    await semearMembro(espacoB, { id: "mem_so_em_b", base: "membro", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(espacoA);
    await limparEspaco(espacoB);
    await encerrar();
  });

  it("(d) POST /contatos cria o Contato no Espaço da sessão, com o Membro como Proprietário e criador", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ana" },
    });
    expect(resposta.statusCode).toBe(201);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.dados.contato.proprietarioId).toBe("mem_maryane");
    expect(corpo.dados.contato.criadoPor).toBe("mem_maryane");
    expect(corpo.dados.contato.estado).toBe("ativo");

    const gravado = await pool().query<{ workspace_id: string }>(
      "select workspace_id from plataforma.contatos where id = $1",
      [corpo.dados.contato.id],
    );
    expect(gravado.rows[0]?.workspace_id).toBe(espacoA);
  });

  it("(e) GET /contatos no Espaço A lista Ana com o nome de exibição", async () => {
    const resposta = await appA().inject({ method: "GET", url: "/contatos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.total).toBe(1);
    expect(corpo.itens[0].nomeDeExibicao).toBe("Ana");
  });

  it("(f) GET /contatos no Espaço B não lista o Contato do Espaço A (D-10)", async () => {
    const resposta = await appB().inject({ method: "GET", url: "/contatos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [], total: 0 });
  });

  it("(g) POST /contatos {} responde 409 com o código de INV-CON-01", async () => {
    const resposta = await appA().inject({ method: "POST", url: "/contatos", headers: AUTORIZACAO, payload: {} });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "CONTATO_SEM_NOME_NEM_IDENTIFICADOR", campo: "nome" });
  });

  it("(g) Convidado ativo recebe 403 em POST /contatos e nada é gravado (D-14, T-07-03)", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO_CONVIDADO,
      payload: { nome: "Do Convidado" },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "PERMISSAO" });
    expect(resposta.json().error).toContain("Convidado");

    const gravado = await pool().query("select 1 from plataforma.contatos where workspace_id = $1 and nome = $2", [
      espacoA,
      "Do Convidado",
    ]);
    expect(gravado.rowCount).toBe(0);
  });

  it("(g) Convidado ativo lê a lista (consulta é permitida)", async () => {
    const resposta = await appA().inject({ method: "GET", url: "/contatos", headers: AUTORIZACAO_CONVIDADO });
    expect(resposta.statusCode).toBe(200);
  });

  it("(g) Membro com base `membro` cria (a consulta members -> roles resolve a base)", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Bia" },
    });
    expect(resposta.statusCode).toBe(201);
  });

  it("(h) proprietarioId de Membro removido responde 409 PROPRIETARIO_INVALIDO", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Cris", proprietarioId: "mem_removido" },
    });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "PROPRIETARIO_INVALIDO" });
  });

  it("(h) proprietarioId inexistente ou de outro Espaço responde 409 PROPRIETARIO_INVALIDO (T-07-40)", async () => {
    for (const proprietarioId of ["mem_nao_existe", "mem_so_em_b"]) {
      const resposta = await appA().inject({
        method: "POST",
        url: "/contatos",
        headers: AUTORIZACAO,
        payload: { nome: "Dani", proprietarioId },
      });
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json()).toMatchObject({ ok: false, codigo: "PROPRIETARIO_INVALIDO" });
    }
  });

  it("(h) proprietarioId de outro Membro ativo grava o Proprietário; criadoPor continua o da sessão", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Edu", proprietarioId: "mem_outro" },
    });
    expect(resposta.statusCode).toBe(201);
    const { contato } = resposta.json().dados;
    expect(contato.proprietarioId).toBe("mem_outro");
    expect(contato.criadoPor).toBe("mem_maryane");
  });

  it("(f) o ciclo inteiro por app.inject: criar, Identificador, principal, lixeira, restaurar, lixeira, excluir, 404", async () => {
    const app = appA();
    const criado = await app.inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ciclo", identificadores: [{ tipo: "email", valor: "Ciclo@X.com" }] },
    });
    expect(criado.statusCode).toBe(201);
    const id: string = criado.json().dados.contato.id;
    expect(criado.json().dados.identificadores[0]).toMatchObject({ valor: "ciclo@x.com", principal: true });

    const adicionado = await app.inject({
      method: "POST",
      url: `/contatos/${id}/identificadores`,
      headers: AUTORIZACAO,
      payload: { tipo: "email", valor: "ciclo2@x.com" },
    });
    expect(adicionado.statusCode).toBe(201);
    const segundo = adicionado.json().dados.identificadores.find((i: { valor: string }) => i.valor === "ciclo2@x.com");
    expect(segundo.principal).toBe(false);

    const trocado = await app.inject({
      method: "PATCH",
      url: `/contatos/${id}/identificadores/${segundo.id}`,
      headers: AUTORIZACAO,
      payload: { principal: true },
    });
    expect(trocado.statusCode).toBe(200);
    expect(
      trocado.json().dados.identificadores.filter((i: { principal: boolean }) => i.principal).map((i: { valor: string }) => i.valor),
    ).toEqual(["ciclo2@x.com"]);

    const lixeira = await app.inject({ method: "DELETE", url: `/contatos/${id}`, headers: AUTORIZACAO });
    expect(lixeira.statusCode).toBe(200);
    expect(lixeira.json().dados.contato.estado).toBe("na_lixeira");

    const restaurado = await app.inject({ method: "POST", url: `/contatos/${id}/restaurar`, headers: AUTORIZACAO });
    expect(restaurado.statusCode).toBe(200);
    expect(restaurado.json().dados.contato.estado).toBe("ativo");

    expect((await app.inject({ method: "DELETE", url: `/contatos/${id}`, headers: AUTORIZACAO })).statusCode).toBe(200);
    const permanente = await app.inject({ method: "DELETE", url: `/contatos/${id}/permanente`, headers: AUTORIZACAO });
    expect(permanente.statusCode).toBe(200);
    expect(permanente.json()).toEqual({ ok: true, dados: { id } });

    const depois = await app.inject({ method: "GET", url: `/contatos/${id}`, headers: AUTORIZACAO });
    expect(depois.statusCode).toBe(404);
  });

  it("(f) GET /contatos/:id de outro Espaço é 404, nunca 403 nem o registro (D-10)", async () => {
    const criado = await appA().inject({ method: "POST", url: "/contatos", headers: AUTORIZACAO, payload: { nome: "Só de A" } });
    const id: string = criado.json().dados.contato.id;
    const alheio = await appB().inject({ method: "GET", url: `/contatos/${id}`, headers: AUTORIZACAO });
    expect(alheio.statusCode).toBe(404);
    expect(alheio.json()).toEqual({ ok: false, error: "Contato não encontrado.", codigo: "CONTATO_NAO_ENCONTRADO" });
  });

  it("(f) IDENTIFICADOR_EM_USO e CONTATO_BLOQUEADO chegam como 409 ricos pelo HTTP", async () => {
    const app = appA();
    const dono = await app.inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Dona do E-mail", identificadores: [{ tipo: "email", valor: "unico@x.com" }] },
    });
    const outro = await app.inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Quer o mesmo", identificadores: [{ tipo: "email", valor: "UNICO@x.com" }] },
    });
    expect(outro.statusCode).toBe(409);
    expect(outro.json()).toMatchObject({
      ok: false,
      codigo: "IDENTIFICADOR_EM_USO",
      bloqueios: { contatos: [{ id: dono.json().dados.contato.id, nome: "Dona do E-mail" }] },
    });
  });
});
