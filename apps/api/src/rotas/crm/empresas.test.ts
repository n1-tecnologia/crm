/**
 * Rotas REST de Empresa e de vínculo (07-05, Task 3).
 *
 * Duas partes. A primeira roda sempre, com um serviço falso injetado por
 * `buildApp({ crm: { empresas } })` (sem banco): autenticação, forma do corpo
 * (`.strict()`, T-07-02, o admin que é um OU outro, D-08), rotas sem corpo ou
 * com corpo opcional (Pitfall 4) e o envelope dos 409. A segunda
 * (`describeComBanco`) usa o serviço real contra o Postgres LOCAL (D-12,
 * `testes/banco-crm.ts`) e percorre o ciclo inteiro por `app.inject`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { EmpresaDetalhada, EmpresaResumo } from "@n1/dominio/crm/empresas";
import { buildApp } from "../../app";
import { encerrar } from "../../persistencia/conexao";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeEmpresas } from "../../servicos/crm/empresas";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";

const MARYANE = usuarioDoSeed("mem_maryane");
const membros = buildSeed().members;
const AUTORIZACAO = { authorization: "Bearer token-maryane" };
const AGORA = "2026-10-09T00:00:00.000Z";

function opcoesDeAutenticacao(workspaceId: string) {
  return {
    logger: false,
    workspaceId,
    verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId: string, userId: string) => membros.find((m) => m.userId === userId),
  };
}

const detalheFalso: EmpresaDetalhada = {
  empresa: {
    id: "e1",
    nomeFantasia: "Falsa",
    razaoSocial: null,
    descricao: null,
    matrizId: null,
    enderecos: [],
    camposAdicionais: {},
    origem: null,
    estado: "ativo",
    proprietarioId: "mem_maryane",
    criadoPor: "mem_maryane",
    criadoEm: AGORA,
    atualizadoEm: AGORA,
  },
  identificadores: [],
  vinculos: [],
  matriz: null,
  filiais: [],
};

const resumoFalso: EmpresaResumo = {
  id: "e1",
  nomeDeExibicao: "Falsa",
  dominioPrincipal: null,
  documentoPrincipal: null,
  matriz: null,
  proprietarioId: "mem_maryane",
  estado: "ativo",
  atualizadoEm: AGORA,
};

describe("rotas de Empresas — serviço falso, sem banco", () => {
  /** Serviço falso: registra `[método, ...argumentos]` e devolve `respostas[método]` ou o detalhe. */
  function novoFalso(respostas: Partial<Record<keyof ServicoDeEmpresas, ResultadoCrm<unknown>>> = {}) {
    const chamadas: unknown[][] = [];
    const responder = (nome: keyof ServicoDeEmpresas, ...argumentos: unknown[]) => {
      chamadas.push([nome, ...argumentos]);
      return Promise.resolve((respostas[nome] ?? sucesso(detalheFalso)) as never);
    };
    const servico: ServicoDeEmpresas = {
      listar: (...a) => responder("listar", ...a),
      obter: (...a) => responder("obter", ...a),
      criar: (...a) => responder("criar", ...a),
      editar: (...a) => responder("editar", ...a),
      adicionarIdentificador: (...a) => responder("adicionarIdentificador", ...a),
      editarIdentificador: (...a) => responder("editarIdentificador", ...a),
      removerIdentificador: (...a) => responder("removerIdentificador", ...a),
      vincularContato: (...a) => responder("vincularContato", ...a),
      editarVinculo: (...a) => responder("editarVinculo", ...a),
      encerrarVinculo: (...a) => responder("encerrarVinculo", ...a),
      trocarAdmin: (...a) => responder("trocarAdmin", ...a),
      arquivar: (...a) => responder("arquivar", ...a),
      restaurar: (...a) => responder("restaurar", ...a),
      enviarParaLixeira: (...a) => responder("enviarParaLixeira", ...a),
      excluirPermanentemente: (...a) => responder("excluirPermanentemente", ...a),
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeEmpresas) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { empresas: servico } });

  it("sem Authorization responde 401", async () => {
    const resposta = await appCom(novoFalso().servico).inject({ method: "GET", url: "/empresas" });
    expect(resposta.statusCode).toBe(401);
  });

  it("(a) POST /empresas sem admin responde 400 e não chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/empresas",
      headers: AUTORIZACAO,
      payload: { empresa: { nomeFantasia: "Acme" } },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("(a) POST /empresas com contatoId e novoContato ao mesmo tempo responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/empresas",
      headers: AUTORIZACAO,
      payload: { empresa: { nomeFantasia: "Acme" }, admin: { contatoId: "c1", novoContato: { nome: "Bia" } } },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it("(a) POST /empresas com estado ou workspaceId dentro de empresa responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    for (const intruso of [{ estado: "na_lixeira" }, { workspaceId: "ws_de_outro" }, { criadoPor: "mem_outro" }]) {
      const resposta = await appCom(servico).inject({
        method: "POST",
        url: "/empresas",
        headers: AUTORIZACAO,
        payload: { empresa: { nomeFantasia: "Acme", ...intruso }, admin: { contatoId: "c1" } },
      });
      expect(resposta.statusCode).toBe(400);
    }
    expect(chamadas).toHaveLength(0);
  });

  it("POST /empresas válido chega ao serviço com a Empresa e o admin e responde 201 { ok, dados }", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/empresas",
      headers: AUTORIZACAO,
      payload: {
        empresa: { nomeFantasia: "Acme", identificadores: [{ tipo: "dominio", valor: "acme.com.br" }] },
        admin: { novoContato: { nome: "Bia", identificadores: [{ tipo: "email", valor: "bia@acme.com.br" }] }, cargo: "Sócia" },
      },
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({ ok: true, dados: detalheFalso });
    const [nome, , entrada] = chamadas[0]!;
    expect(nome).toBe("criar");
    expect(entrada).toEqual({
      empresa: { nomeFantasia: "Acme", identificadores: [{ tipo: "dominio", valor: "acme.com.br" }] },
      admin: { novoContato: { nome: "Bia", identificadores: [{ tipo: "email", valor: "bia@acme.com.br" }] }, cargo: "Sócia" },
    });
  });

  it("GET /empresas devolve { ok, itens, total } e repassa estado, q e paginação", async () => {
    const { servico, chamadas } = novoFalso({ listar: sucesso({ itens: [resumoFalso], total: 1 }) });
    const resposta = await appCom(servico).inject({
      method: "GET",
      url: "/empresas?estado=arquivado&q=acme&limite=10&deslocamento=5",
      headers: AUTORIZACAO,
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [resumoFalso], total: 1 });
    expect(chamadas[0]![2]).toEqual({ estado: "arquivado", q: "acme", limite: 10, deslocamento: 5 });
  });

  it("(b) POST /empresas/e1/restaurar sem corpo e sem content-type chega ao serviço sem admin", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: "/empresas/e1/restaurar", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]!.slice(0, 1)).toEqual(["restaurar"]);
    expect(chamadas[0]![2]).toBe("e1");
    expect(chamadas[0]![3]).toEqual({});
  });

  it("(b) POST /empresas/e1/restaurar com { admin: { contatoId } } chega ao serviço com o admin", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/empresas/e1/restaurar",
      headers: AUTORIZACAO,
      payload: { admin: { contatoId: "c1" } },
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]![3]).toEqual({ admin: { contatoId: "c1" } });
    const comIntruso = await appCom(servico).inject({
      method: "POST",
      url: "/empresas/e1/restaurar",
      headers: AUTORIZACAO,
      payload: { admin: { contatoId: "c1", admin: false } },
    });
    expect(comIntruso.statusCode).toBe(400);
  });

  it("(c) DELETE /empresas/e1 repassa o 409 EMPRESA_BLOQUEADA com bloqueios.negocios e bloqueios.filiais intactos", async () => {
    const bloqueios = {
      negocios: { total: 2, itens: [{ id: "n1", titulo: "Venda A" }] },
      filiais: [{ id: "e2", nome: "Filial Sul" }],
    };
    const { servico } = novoFalso({
      enviarParaLixeira: recusa(409, "Esta Empresa não pode ir para a lixeira.", { codigo: "EMPRESA_BLOQUEADA", bloqueios }),
    });
    const resposta = await appCom(servico).inject({ method: "DELETE", url: "/empresas/e1", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({
      ok: false,
      error: "Esta Empresa não pode ir para a lixeira.",
      codigo: "EMPRESA_BLOQUEADA",
      bloqueios,
    });
  });

  it("(d) PATCH /empresas/e1/contatos/v1 com {} responde 400; com cargo chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const vazio = await appCom(servico).inject({ method: "PATCH", url: "/empresas/e1/contatos/v1", headers: AUTORIZACAO, payload: {} });
    expect(vazio.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
    const cargo = await appCom(servico).inject({
      method: "PATCH",
      url: "/empresas/e1/contatos/v1",
      headers: AUTORIZACAO,
      payload: { cargo: "Gerente", admin: true },
    });
    expect(cargo.statusCode).toBe(200);
    expect(chamadas[0]!.slice(2)).toEqual(["e1", "v1", { cargo: "Gerente", admin: true }]);
  });

  it("PATCH /empresas/e1 com {} ou com estado responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    for (const payload of [{}, { estado: "ativo" }, { workspaceId: "ws_de_outro" }]) {
      const resposta = await appCom(servico).inject({ method: "PATCH", url: "/empresas/e1", headers: AUTORIZACAO, payload });
      expect(resposta.statusCode).toBe(400);
    }
    expect(chamadas).toHaveLength(0);
  });

  it("os verbos sem corpo chegam ao serviço sem content-type", async () => {
    const { servico, chamadas } = novoFalso({ excluirPermanentemente: sucesso({ id: "e1" }) });
    const app = appCom(servico);
    const casos: Array<[string, string, string]> = [
      ["POST", "/empresas/e1/arquivar", "arquivar"],
      ["DELETE", "/empresas/e1", "enviarParaLixeira"],
      ["DELETE", "/empresas/e1/permanente", "excluirPermanentemente"],
      ["DELETE", "/empresas/e1/identificadores/i1", "removerIdentificador"],
      ["POST", "/empresas/e1/contatos/v1/encerrar", "encerrarVinculo"],
    ];
    for (const [method, url] of casos) {
      const resposta = await app.inject({ method: method as "POST" | "DELETE", url, headers: AUTORIZACAO });
      expect(resposta.statusCode, `${method} ${url}`).toBe(200);
    }
    expect(chamadas.map((c) => c[0])).toEqual(casos.map((c) => c[2]));
    // `encerrar` sem corpo chega com `fim` ausente.
    expect(chamadas[4]![4]).toEqual({});
  });

  it("POST /empresas/e1/contatos/v1/encerrar com fim, trocar-admin e identificadores chegam ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    const encerrar = await app.inject({
      method: "POST",
      url: "/empresas/e1/contatos/v1/encerrar",
      headers: AUTORIZACAO,
      payload: { fim: "2026-10-09" },
    });
    expect(encerrar.statusCode).toBe(200);
    expect(chamadas[0]![4]).toEqual({ fim: "2026-10-09" });
    const fimRuim = await app.inject({
      method: "POST",
      url: "/empresas/e1/contatos/v1/encerrar",
      headers: AUTORIZACAO,
      payload: { fim: "09/10/2026" },
    });
    expect(fimRuim.statusCode).toBe(400);

    const troca = await app.inject({
      method: "POST",
      url: "/empresas/e1/trocar-admin",
      headers: AUTORIZACAO,
      payload: { vinculoAtualId: "v1", novoAdmin: { contatoId: "c2", cargo: "Diretor" } },
    });
    expect(troca.statusCode).toBe(200);
    expect(chamadas[1]![3]).toEqual({ vinculoAtualId: "v1", novoAdmin: { contatoId: "c2", cargo: "Diretor" } });

    const identificador = await app.inject({
      method: "POST",
      url: "/empresas/e1/identificadores",
      headers: AUTORIZACAO,
      payload: { tipo: "documento_fiscal", valor: "12.345.678/0001-90", pais: "BR" },
    });
    expect(identificador.statusCode).toBe(201);
    const tipoRuim = await app.inject({
      method: "POST",
      url: "/empresas/e1/identificadores",
      headers: AUTORIZACAO,
      payload: { tipo: "email", valor: "a@b.com" },
    });
    expect(tipoRuim.statusCode).toBe(400);

    const vinculo = await app.inject({
      method: "POST",
      url: "/empresas/e1/contatos",
      headers: AUTORIZACAO,
      payload: { contatoId: "c3", cargo: "Analista", inicio: "2026-01-02" },
    });
    expect(vinculo.statusCode).toBe(201);
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

describeComBanco("rotas de Empresas — serviço real, Postgres local", () => {
  const espaco = novoEspacoDeTeste("empresasrota");
  const outroEspaco = novoEspacoDeTeste("empresasrotab");
  const app = () => buildApp(opcoesComPapeis(espaco));

  beforeAll(async () => {
    await prepararBancoCrm();
    for (const ws of [espaco, outroEspaco]) {
      await semearMembro(ws, { id: "mem_maryane", base: "membro", state: "ativo" });
      await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    }
  });

  afterAll(async () => {
    await limparEspaco(espaco);
    await limparEspaco(outroEspaco);
    await encerrar();
  });

  it("(e) o ciclo: criar com novoContato, vincular, trocar admin, lixeira, restaurar com admin, lixeira e excluir de vez", async () => {
    const servidor = app();
    const chamar = async (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown, headers = AUTORIZACAO) => {
      const resposta = await servidor.inject({ method, url, headers, ...(payload !== undefined ? { payload: payload as object } : {}) });
      return { status: resposta.statusCode, corpo: resposta.json() as Record<string, any> };
    };

    const criada = await chamar("POST", "/empresas", {
      empresa: { nomeFantasia: "Acme (rota)", identificadores: [{ tipo: "dominio", valor: "acme-rota.com.br" }] },
      admin: { novoContato: { nome: "Bia", identificadores: [{ tipo: "email", valor: "bia-rota@acme-rota.com.br" }] }, cargo: "Sócia" },
    });
    expect(criada.status).toBe(201);
    const empresaId = criada.corpo.dados.empresa.id as string;
    const antigo = criada.corpo.dados.vinculos[0] as { id: string; contatoId: string; admin: boolean };
    expect(antigo.admin).toBe(true);
    expect(criada.corpo.dados.empresa.proprietarioId).toBe("mem_maryane");

    const segundoContato = await chamar("POST", "/contatos", { nome: "Carlos" });
    const segundoId = segundoContato.corpo.dados.contato.id as string;
    const vinculado = await chamar("POST", `/empresas/${empresaId}/contatos`, { contatoId: segundoId, cargo: "Analista" });
    expect(vinculado.status).toBe(201);
    const repetido = await chamar("POST", `/empresas/${empresaId}/contatos`, { contatoId: segundoId });
    expect(repetido.status).toBe(409);
    expect(repetido.corpo.codigo).toBe("VINCULO_JA_EXISTE");

    const rebaixar = await chamar("PATCH", `/empresas/${empresaId}/contatos/${antigo.id}`, { admin: false });
    expect(rebaixar.status).toBe(409);
    expect(rebaixar.corpo.codigo).toBe("ULTIMO_ADMIN");

    const trocada = await chamar("POST", `/empresas/${empresaId}/trocar-admin`, {
      vinculoAtualId: antigo.id,
      novoAdmin: { contatoId: segundoId, cargo: "Diretor" },
    });
    expect(trocada.status).toBe(200);
    const admins = (trocada.corpo.dados.vinculos as Array<{ admin: boolean; contatoId: string; fim: string | null }>).filter(
      (v) => v.admin && v.fim === null,
    );
    expect(admins.map((v) => v.contatoId)).toEqual([segundoId]);

    const naLixeira = await chamar("DELETE", `/empresas/${empresaId}`);
    expect(naLixeira.status).toBe(200);
    expect(naLixeira.corpo.dados.empresa.estado).toBe("na_lixeira");
    expect((naLixeira.corpo.dados.vinculos as Array<{ fim: string | null }>).every((v) => v.fim !== null)).toBe(true);

    const semAdmin = await chamar("POST", `/empresas/${empresaId}/restaurar`);
    expect(semAdmin.status).toBe(409);
    expect(semAdmin.corpo.codigo).toBe("EMPRESA_SEM_ADMIN");

    const restaurada = await chamar("POST", `/empresas/${empresaId}/restaurar`, { admin: { contatoId: antigo.contatoId, cargo: "Sócia" } });
    expect(restaurada.status).toBe(200);
    expect(restaurada.corpo.dados.empresa.estado).toBe("ativo");

    // O Contato admin antigo vê o vínculo encerrado (com `fim`) e o novo, vigente.
    const ficha = await chamar("GET", `/contatos/${antigo.contatoId}`);
    expect(ficha.status).toBe(200);
    const vinculosDoContato = ficha.corpo.dados.vinculos as Array<{ empresaId: string; fim: string | null; admin: boolean }>;
    expect(vinculosDoContato.filter((v) => v.empresaId === empresaId && v.fim !== null)).toHaveLength(1);
    expect(vinculosDoContato.filter((v) => v.empresaId === empresaId && v.fim === null && v.admin)).toHaveLength(1);

    const segundaLixeira = await chamar("DELETE", `/empresas/${empresaId}`);
    expect(segundaLixeira.status).toBe(200);
    const apagada = await chamar("DELETE", `/empresas/${empresaId}/permanente`);
    expect(apagada.status).toBe(200);
    expect(apagada.corpo).toEqual({ ok: true, dados: { id: empresaId } });
    expect((await chamar("GET", `/empresas/${empresaId}`)).status).toBe(404);
    // Os Contatos continuam.
    expect((await chamar("GET", `/contatos/${antigo.contatoId}`)).status).toBe(200);
    expect((await chamar("GET", `/contatos/${segundoId}`)).status).toBe(200);
  });

  it("Convidado só lê; Empresa de outro Espaço é 404; a lista paginada tem o envelope { ok, itens, total }", async () => {
    const servidor = app();
    const criada = await servidor.inject({
      method: "POST",
      url: "/empresas",
      headers: AUTORIZACAO,
      payload: { empresa: { nomeFantasia: "Acme (rota) lista" }, admin: { novoContato: { nome: "Dora" } } },
    });
    expect(criada.statusCode).toBe(201);
    const id = criada.json().dados.empresa.id as string;

    const convidado = { authorization: "Bearer token-convidado" };
    const leitura = await servidor.inject({ method: "GET", url: `/empresas/${id}`, headers: convidado });
    expect(leitura.statusCode).toBe(200);
    const escrita = await servidor.inject({ method: "POST", url: `/empresas/${id}/arquivar`, headers: convidado });
    expect(escrita.statusCode).toBe(403);
    const criar = await servidor.inject({
      method: "POST",
      url: "/empresas",
      headers: convidado,
      payload: { empresa: { nomeFantasia: "Não" }, admin: { contatoId: "x" } },
    });
    expect(criar.statusCode).toBe(403);

    const deOutroEspaco = await buildApp(opcoesComPapeis(outroEspaco)).inject({
      method: "GET",
      url: `/empresas/${id}`,
      headers: AUTORIZACAO,
    });
    expect(deOutroEspaco.statusCode).toBe(404);

    const lista = await servidor.inject({ method: "GET", url: "/empresas?q=rota%20lista&limite=5", headers: AUTORIZACAO });
    expect(lista.statusCode).toBe(200);
    const corpo = lista.json() as { ok: boolean; itens: Array<{ id: string }>; total: number };
    expect(corpo.ok).toBe(true);
    expect(corpo.total).toBe(1);
    expect(corpo.itens[0]!.id).toBe(id);
  });
});
