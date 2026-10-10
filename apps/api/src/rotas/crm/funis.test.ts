/**
 * Rotas REST de Funil e Etapa (07-04, Task 3).
 *
 * Duas partes. A primeira roda sempre, com um serviço falso injetado por
 * `buildApp({ crm: { funis } })` (sem banco): autenticação, forma do corpo
 * (`.strict()`, T-07-14, tetos de 40 de T-07-16), rotas sem corpo e o envelope
 * dos 409 de D-07. A segunda (`describeComBanco`) usa o serviço real contra o
 * Postgres LOCAL (D-12, `testes/banco-crm.ts`) e percorre o ciclo de um
 * Administrador por `app.inject`, mais o 403 de um Membro (D-14).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { Etapa, EtapaDetalhada, Funil, FunilDetalhado, FunilResumo } from "@n1/dominio/crm/funis";
import { buildApp } from "../../app";
import { encerrar } from "../../persistencia/conexao";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeFunis } from "../../servicos/crm/funis";
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

const AGORA = "2026-10-09T00:00:00.000Z";

const funilFalso: Funil = {
  id: "f1",
  nome: "Vendas",
  descricao: null,
  cor: null,
  ordem: 1,
  padrao: true,
  privado: false,
  exigeMotivoPerda: false,
  exigeValorGanho: false,
  estado: "ativo",
  criadoPor: "mem_maryane",
  criadoEm: AGORA,
  atualizadoEm: AGORA,
};

const etapaFalsa: EtapaDetalhada = {
  id: "e1",
  funilId: "f1",
  nome: "Novo",
  ordem: 1,
  probabilidadePadrao: 0,
  cor: null,
  descricao: null,
  criadoEm: AGORA,
  negocios: { abertos: 0, ganhos: 0, perdidos: 0, arquivados: 0, naLixeira: 0, total: 0 },
};

const detalheFalso: FunilDetalhado = { funil: funilFalso, etapas: [etapaFalsa] };
const resumoFalso: FunilResumo = { funil: funilFalso, totalEtapas: 1, negociosAbertos: 0 };

/** Os ids de um mapeamento/permutação do tamanho pedido. */
const ids = (quantos: number, prefixo = "id"): string[] => Array.from({ length: quantos }, (_, i) => `${prefixo}${i}`);

describe("rotas de Funis — serviço falso, sem banco", () => {
  /** Serviço falso: registra `[método, ...argumentos]` e devolve `respostas[método]` ou o detalhe. */
  function novoFalso(respostas: Partial<Record<keyof ServicoDeFunis, ResultadoCrm<unknown>>> = {}) {
    const chamadas: unknown[][] = [];
    const responder = (nome: keyof ServicoDeFunis, ...argumentos: unknown[]) => {
      chamadas.push([nome, ...argumentos]);
      return Promise.resolve((respostas[nome] ?? sucesso(detalheFalso)) as never);
    };
    const servico: ServicoDeFunis = {
      listar: (...a) => responder("listar", ...a),
      obter: (...a) => responder("obter", ...a),
      criar: (...a) => responder("criar", ...a),
      editar: (...a) => responder("editar", ...a),
      definirPadrao: (...a) => responder("definirPadrao", ...a),
      adicionarEtapa: (...a) => responder("adicionarEtapa", ...a),
      editarEtapa: (...a) => responder("editarEtapa", ...a),
      reordenarEtapas: (...a) => responder("reordenarEtapas", ...a),
      removerEtapa: (...a) => responder("removerEtapa", ...a),
      remapearEtapa: (...a) => responder("remapearEtapa", ...a),
      arquivar: (...a) => responder("arquivar", ...a),
      restaurar: (...a) => responder("restaurar", ...a),
      enviarParaLixeira: (...a) => responder("enviarParaLixeira", ...a),
      excluirPermanentemente: (...a) => responder("excluirPermanentemente", ...a),
      migrarNegocios: (...a) => responder("migrarNegocios", ...a),
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeFunis) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { funis: servico } });

  it("GET /funis sem Authorization responde 401", async () => {
    const resposta = await appCom(novoFalso().servico).inject({ method: "GET", url: "/funis" });
    expect(resposta.statusCode).toBe(401);
  });

  it("GET /funis devolve { ok, itens, total } e GET /funis/f1 devolve { ok, dados }", async () => {
    const { servico } = novoFalso({ listar: sucesso({ itens: [resumoFalso], total: 1 }) });
    const lista = await appCom(servico).inject({ method: "GET", url: "/funis", headers: AUTORIZACAO });
    expect(lista.statusCode).toBe(200);
    expect(lista.json()).toEqual({ ok: true, itens: [resumoFalso], total: 1 });
    const ficha = await appCom(servico).inject({ method: "GET", url: "/funis/f1", headers: AUTORIZACAO });
    expect(ficha.statusCode).toBe(200);
    expect(ficha.json()).toEqual({ ok: true, dados: detalheFalso });
  });

  it("(a) POST /funis com padrao no corpo responde 400 (T-07-14) e o serviço não é chamado", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/funis",
      headers: AUTORIZACAO,
      payload: { nome: "Vendas", padrao: true, etapas: [{ nome: "Novo" }] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
    expect(chamadas).toEqual([]);
  });

  it("(a) POST /funis recusa workspaceId, criadoPor e estado no corpo", async () => {
    const { servico, chamadas } = novoFalso();
    for (const extra of [{ workspaceId: "ws_de_outro" }, { criadoPor: "mem_outro" }, { estado: "arquivado" }]) {
      const resposta = await appCom(servico).inject({
        method: "POST",
        url: "/funis",
        headers: AUTORIZACAO,
        payload: { nome: "Vendas", etapas: [{ nome: "Novo" }], ...extra },
      });
      expect(resposta.statusCode).toBe(400);
    }
    expect(chamadas).toEqual([]);
  });

  it("(a) POST /funis com etapas vazias ou com 41 Etapas responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const vazio = await appCom(servico).inject({ method: "POST", url: "/funis", headers: AUTORIZACAO, payload: { nome: "V", etapas: [] } });
    expect(vazio.statusCode).toBe(400);
    const demais = await appCom(servico).inject({
      method: "POST",
      url: "/funis",
      headers: AUTORIZACAO,
      payload: { nome: "V", etapas: ids(41, "Etapa").map((nome) => ({ nome })) },
    });
    expect(demais.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("(a) POST /funis válido responde 201 e chega ao serviço com o Membro da sessão", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/funis",
      headers: AUTORIZACAO,
      payload: { nome: "Vendas", etapas: [{ nome: "Novo", probabilidadePadrao: 10 }, { nome: "Fim" }] },
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({ ok: true, dados: detalheFalso });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]![0]).toBe("criar");
    expect(chamadas[0]![2]).toEqual({ nome: "Vendas", etapas: [{ nome: "Novo", probabilidadePadrao: 10 }, { nome: "Fim" }] });
  });

  it("PATCH /funis/f1 vazio ou com padrao responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const vazio = await appCom(servico).inject({ method: "PATCH", url: "/funis/f1", headers: AUTORIZACAO, payload: {} });
    expect(vazio.statusCode).toBe(400);
    const comPadrao = await appCom(servico).inject({ method: "PATCH", url: "/funis/f1", headers: AUTORIZACAO, payload: { padrao: true } });
    expect(comPadrao.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("(b) PUT /funis/f1/etapas/ordem com 201 ids ou lista vazia responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const demais = await appCom(servico).inject({
      method: "PUT",
      url: "/funis/f1/etapas/ordem",
      headers: AUTORIZACAO,
      payload: { etapaIds: ids(201) },
    });
    expect(demais.statusCode).toBe(400);
    const vazia = await appCom(servico).inject({ method: "PUT", url: "/funis/f1/etapas/ordem", headers: AUTORIZACAO, payload: { etapaIds: [] } });
    expect(vazia.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("(b) PUT /funis/f1/etapas/ordem válido chega ao serviço com a lista", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "PUT",
      url: "/funis/f1/etapas/ordem",
      headers: AUTORIZACAO,
      payload: { etapaIds: ["b", "a"] },
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]!.slice(0, 1).concat(chamadas[0]!.slice(2))).toEqual(["reordenarEtapas", "f1", ["b", "a"]]);
  });

  it("POST /funis/f1/etapas aceita posicao e recusa posicao 0", async () => {
    const { servico, chamadas } = novoFalso();
    const boa = await appCom(servico).inject({
      method: "POST",
      url: "/funis/f1/etapas",
      headers: AUTORIZACAO,
      payload: { nome: "Primeira", posicao: 1 },
    });
    expect(boa.statusCode).toBe(201);
    expect(chamadas[0]![3]).toEqual({ nome: "Primeira", posicao: 1 });
    const zero = await appCom(servico).inject({
      method: "POST",
      url: "/funis/f1/etapas",
      headers: AUTORIZACAO,
      payload: { nome: "Zero", posicao: 0 },
    });
    expect(zero.statusCode).toBe(400);
  });

  it("(c) DELETE /etapas/e1 sem corpo e sem content-type chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "DELETE", url: "/etapas/e1", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: detalheFalso });
    expect(chamadas[0]!.slice(0, 1).concat(chamadas[0]!.slice(2))).toEqual(["removerEtapa", "e1"]);
  });

  it("(c) o 409 de D-07 passa com codigo e bloqueios.negocios.total intactos", async () => {
    const bloqueios = { negocios: { total: 3, itens: [] } };
    const { servico } = novoFalso({
      removerEtapa: recusa(409, "Esta Etapa ainda tem 3 Negócios.", { codigo: "ETAPA_COM_NEGOCIOS", bloqueios }),
      enviarParaLixeira: recusa(409, "Este Funil ainda tem 3 Negócios.", { codigo: "FUNIL_COM_NEGOCIOS", bloqueios }),
    });
    const etapa = await appCom(servico).inject({ method: "DELETE", url: "/etapas/e1", headers: AUTORIZACAO });
    expect(etapa.statusCode).toBe(409);
    expect(etapa.json()).toEqual({ ok: false, error: "Esta Etapa ainda tem 3 Negócios.", codigo: "ETAPA_COM_NEGOCIOS", bloqueios });
    const funil = await appCom(servico).inject({ method: "DELETE", url: "/funis/f1", headers: AUTORIZACAO });
    expect(funil.statusCode).toBe(409);
    expect(funil.json().bloqueios.negocios.total).toBe(3);
    expect(funil.json().codigo).toBe("FUNIL_COM_NEGOCIOS");
  });

  it("as rotas sem corpo chegam ao serviço: padrao, arquivar, restaurar, lixeira e permanente", async () => {
    const { servico, chamadas } = novoFalso({ excluirPermanentemente: sucesso({ id: "f1" }) });
    const app = appCom(servico);
    const casos: Array<[string, string, string]> = [
      ["POST", "/funis/f1/padrao", "definirPadrao"],
      ["POST", "/funis/f1/arquivar", "arquivar"],
      ["POST", "/funis/f1/restaurar", "restaurar"],
      ["DELETE", "/funis/f1", "enviarParaLixeira"],
      ["DELETE", "/funis/f1/permanente", "excluirPermanentemente"],
    ];
    for (const [method, url, metodo] of casos) {
      const resposta = await app.inject({ method: method as "POST" | "DELETE", url, headers: AUTORIZACAO });
      expect(`${url}:${resposta.statusCode}`).toBe(`${url}:200`);
      expect(chamadas.at(-1)![0]).toBe(metodo);
    }
  });

  it("PATCH /etapas/e1 vazio responde 400; com campo chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const vazio = await appCom(servico).inject({ method: "PATCH", url: "/etapas/e1", headers: AUTORIZACAO, payload: {} });
    expect(vazio.statusCode).toBe(400);
    const boa = await appCom(servico).inject({
      method: "PATCH",
      url: "/etapas/e1",
      headers: AUTORIZACAO,
      payload: { probabilidadePadrao: 50 },
    });
    expect(boa.statusCode).toBe(200);
    expect(chamadas.at(-1)!.slice(0, 1).concat(chamadas.at(-1)!.slice(2))).toEqual(["editarEtapa", "e1", { probabilidadePadrao: 50 }]);
    const absurda = await appCom(servico).inject({
      method: "PATCH",
      url: "/etapas/e1",
      headers: AUTORIZACAO,
      payload: { probabilidadePadrao: 101 },
    });
    expect(absurda.statusCode).toBe(400);
  });

  it("POST /etapas/e1/remapear exige paraEtapaId", async () => {
    const { servico, chamadas } = novoFalso();
    const sem = await appCom(servico).inject({ method: "POST", url: "/etapas/e1/remapear", headers: AUTORIZACAO, payload: {} });
    expect(sem.statusCode).toBe(400);
    const boa = await appCom(servico).inject({
      method: "POST",
      url: "/etapas/e1/remapear",
      headers: AUTORIZACAO,
      payload: { paraEtapaId: "e2" },
    });
    expect(boa.statusCode).toBe(200);
    expect(chamadas.at(-1)!.slice(0, 1).concat(chamadas.at(-1)!.slice(2))).toEqual(["remapearEtapa", "e1", "e2"]);
  });

  it("(d) POST /funis/f1/migrar-negocios sem mapeamento ou com mais de 40 pares responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const sem = await appCom(servico).inject({
      method: "POST",
      url: "/funis/f1/migrar-negocios",
      headers: AUTORIZACAO,
      payload: { paraFunilId: "f2" },
    });
    expect(sem.statusCode).toBe(400);
    const mapeamento = Object.fromEntries(ids(41, "o").map((id, i) => [id, `d${i}`]));
    const demais = await appCom(servico).inject({
      method: "POST",
      url: "/funis/f1/migrar-negocios",
      headers: AUTORIZACAO,
      payload: { paraFunilId: "f2", mapeamento },
    });
    expect(demais.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("(d) POST /funis/f1/migrar-negocios válido devolve { migrados } do serviço", async () => {
    const { servico, chamadas } = novoFalso({ migrarNegocios: sucesso({ migrados: 4 }) });
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/funis/f1/migrar-negocios",
      headers: AUTORIZACAO,
      payload: { paraFunilId: "f2", mapeamento: { o1: "d1" } },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: { migrados: 4 } });
    expect(chamadas[0]![3]).toEqual({ paraFunilId: "f2", mapeamento: { o1: "d1" } });
  });
});

/** Sessões do bloco com banco: cada token é um Membro, e o `id` dele é o da linha semeada. */
const SESSOES = {
  "token-admin": { sub: MARYANE, membroId: "mem_admin" },
  "token-membro": { sub: "usuario-membro", membroId: "mem_ana" },
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

const ADMIN = { authorization: "Bearer token-admin" };
const MEMBRO = { authorization: "Bearer token-membro" };

describeComBanco("rotas de Funis — serviço real, Postgres local", () => {
  const espaco = novoEspacoDeTeste("funisrotas");
  const app = () => buildApp(opcoesComPapeis(espaco));

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(espaco, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(espaco, { id: "mem_ana", base: "membro", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(espaco);
    await encerrar();
  });

  async function chamar(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown, headers = ADMIN) {
    const resposta = await app().inject({ method, url, headers, ...(payload !== undefined ? { payload: payload as object } : {}) });
    return { status: resposta.statusCode, corpo: resposta.json() as { ok: boolean; dados?: FunilDetalhado & { id?: string }; error?: string; codigo?: string } };
  }

  it("(e) um Administrador percorre o ciclo: cria, cria outro, adiciona Etapa, reordena, troca o padrão, lixeira e restaura", async () => {
    const primeiro = await chamar("POST", "/funis", { nome: "Vendas", etapas: [{ nome: "Novo" }, { nome: "Proposta", probabilidadePadrao: 40 }] });
    expect(primeiro.status).toBe(201);
    expect(primeiro.corpo.dados?.funil.padrao).toBe(true);
    const idUm = primeiro.corpo.dados!.funil.id;

    const segundo = await chamar("POST", "/funis", { nome: "Pós-venda", etapas: [{ nome: "Aberto" }] });
    expect(segundo.status).toBe(201);
    expect(segundo.corpo.dados?.funil.padrao).toBe(false);
    const idDois = segundo.corpo.dados!.funil.id;

    const comEtapa = await chamar("POST", `/funis/${idUm}/etapas`, { nome: "Fechamento" });
    expect(comEtapa.status).toBe(201);
    const etapas: readonly Etapa[] = comEtapa.corpo.dados!.etapas;
    expect(etapas.map((e) => e.nome)).toEqual(["Novo", "Proposta", "Fechamento"]);

    const invertida = await chamar("PUT", `/funis/${idUm}/etapas/ordem`, { etapaIds: etapas.map((e) => e.id).reverse() });
    expect(invertida.status).toBe(200);
    expect(invertida.corpo.dados?.etapas.map((e) => e.nome)).toEqual(["Fechamento", "Proposta", "Novo"]);

    const novoPadrao = await chamar("POST", `/funis/${idDois}/padrao`);
    expect(novoPadrao.status).toBe(200);
    expect(novoPadrao.corpo.dados?.funil.padrao).toBe(true);

    const lista = await chamar("GET", "/funis");
    expect(lista.status).toBe(200);
    expect((lista.corpo as unknown as { itens: FunilResumo[] }).itens.map((i) => [i.funil.nome, i.funil.padrao])).toEqual([
      ["Pós-venda", true],
      ["Vendas", false],
    ]);

    const lixeira = await chamar("DELETE", `/funis/${idUm}`);
    expect(lixeira.status).toBe(200);
    expect(lixeira.corpo.dados?.funil.estado).toBe("na_lixeira");

    const restaurado = await chamar("POST", `/funis/${idUm}/restaurar`);
    expect(restaurado.status).toBe(200);
    expect(restaurado.corpo.dados?.funil.estado).toBe("ativo");

    const padraoNaLixeira = await chamar("DELETE", `/funis/${idDois}`);
    expect(padraoNaLixeira.status).toBe(409);
    expect(padraoNaLixeira.corpo.codigo).toBe("FUNIL_PADRAO");
  });

  it("(e) um Membro recebe 403 em POST /funis e ainda lê a lista (D-14)", async () => {
    const escrita = await chamar("POST", "/funis", { nome: "Do Membro", etapas: [{ nome: "A" }] }, MEMBRO);
    expect(escrita.status).toBe(403);
    expect(escrita.corpo).toMatchObject({ ok: false, codigo: "PERMISSAO" });
    const leitura = await chamar("GET", "/funis", undefined, MEMBRO);
    expect(leitura.status).toBe(200);
  });
});
