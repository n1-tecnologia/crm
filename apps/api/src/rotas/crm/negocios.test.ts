/**
 * Rotas REST de Negócio (07-08, Task 3).
 *
 * Duas partes. A primeira roda sempre, com um serviço falso injetado por
 * `buildApp({ crm: { negocios } })` (sem banco): autenticação, forma do corpo
 * (`.strict()`, T-07-27: `situacao`, `encerradoEm`, `estado` e `criadoPor` não
 * viajam), valor como texto decimal, filtros da lista, corpo opcional sem
 * `content-type` (Pitfall 4) e o envelope dos 403/409 de D-05 e D-14. A segunda
 * (`describeComBanco`) usa o serviço real contra o Postgres LOCAL (D-12,
 * `testes/banco-crm.ts`) e percorre o ciclo de um Negócio por `app.inject`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { Negocio, NegocioDetalhado, NegocioResumo } from "@n1/dominio/crm/negocios";
import { buildApp } from "../../app";
import { encerrar } from "../../persistencia/conexao";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeNegocios } from "../../servicos/crm/negocios";
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

const negocioFalso: Negocio = {
  id: "n1",
  titulo: "Falso",
  objeto: null,
  descricao: null,
  empresaId: null,
  contatoId: "c1",
  funilId: "f1",
  etapaId: "e1",
  valor: null,
  moeda: "BRL",
  probabilidade: null,
  situacao: "aberto",
  motivoPerda: null,
  motivoGanho: null,
  notaEncerramento: null,
  origem: null,
  dataPrevistaFechamento: null,
  encerradoEm: null,
  estado: "ativo",
  proprietarioId: "mem_maryane",
  criadoPor: "mem_maryane",
  criadoEm: AGORA,
  atualizadoEm: AGORA,
};

const detalheFalso: NegocioDetalhado = {
  negocio: negocioFalso,
  funil: { id: "f1", nome: "Vendas", estado: "ativo", exigeMotivoPerda: false, exigeValorGanho: false },
  etapa: { id: "e1", nome: "Novo", probabilidadePadrao: 10 },
  etapasDoFunil: [{ id: "e1", nome: "Novo", ordem: 1 }],
  empresa: null,
  contato: { id: "c1", nome: "Contato", estado: "ativo" },
  probabilidadeEfetiva: 10,
};

const resumoFalso: NegocioResumo = {
  id: "n1",
  titulo: "Falso",
  valor: null,
  moeda: "BRL",
  probabilidadeEfetiva: 10,
  situacao: "aberto",
  estado: "ativo",
  funilId: "f1",
  etapaId: "e1",
  empresa: null,
  contato: { id: "c1", nome: "Contato" },
  proprietarioId: "mem_maryane",
  dataPrevistaFechamento: null,
  encerradoEm: null,
  atualizadoEm: AGORA,
};

describe("rotas de Negócios — serviço falso, sem banco", () => {
  /** Serviço falso: registra `[método, ...argumentos]` e devolve `respostas[método]` ou o detalhe. */
  function novoFalso(respostas: Partial<Record<keyof ServicoDeNegocios, ResultadoCrm<unknown>>> = {}) {
    const chamadas: unknown[][] = [];
    const responder = (nome: keyof ServicoDeNegocios, ...argumentos: unknown[]) => {
      chamadas.push([nome, ...argumentos]);
      return Promise.resolve((respostas[nome] ?? sucesso(detalheFalso)) as never);
    };
    const servico: ServicoDeNegocios = {
      listar: (...a) => responder("listar", ...a),
      obter: (...a) => responder("obter", ...a),
      criar: (...a) => responder("criar", ...a),
      editar: (...a) => responder("editar", ...a),
      mover: (...a) => responder("mover", ...a),
      ganhar: (...a) => responder("ganhar", ...a),
      perder: (...a) => responder("perder", ...a),
      reabrir: (...a) => responder("reabrir", ...a),
      arquivar: (...a) => responder("arquivar", ...a),
      restaurar: (...a) => responder("restaurar", ...a),
      enviarParaLixeira: (...a) => responder("enviarParaLixeira", ...a),
      excluirPermanentemente: (...a) => responder("excluirPermanentemente", ...a),
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeNegocios) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { negocios: servico } });

  const criar = (servico: ServicoDeNegocios, payload: unknown) =>
    appCom(servico).inject({ method: "POST", url: "/negocios", headers: AUTORIZACAO, payload: payload as object });

  it("GET /negocios sem Authorization responde 401", async () => {
    const resposta = await appCom(novoFalso().servico).inject({ method: "GET", url: "/negocios" });
    expect(resposta.statusCode).toBe(401);
  });

  it("GET /negocios devolve { ok, itens, total } e GET /negocios/n1 devolve { ok, dados }", async () => {
    const { servico } = novoFalso({ listar: sucesso({ itens: [resumoFalso], total: 1 }) });
    const lista = await appCom(servico).inject({ method: "GET", url: "/negocios", headers: AUTORIZACAO });
    expect(lista.statusCode).toBe(200);
    expect(lista.json()).toEqual({ ok: true, itens: [resumoFalso], total: 1 });
    const ficha = await appCom(servico).inject({ method: "GET", url: "/negocios/n1", headers: AUTORIZACAO });
    expect(ficha.statusCode).toBe(200);
    expect(ficha.json()).toEqual({ ok: true, dados: detalheFalso });
  });

  it("(a) POST /negocios com situacao, encerradoEm, estado, criadoPor ou workspaceId responde 400 e o serviço não é chamado", async () => {
    const { servico, chamadas } = novoFalso();
    for (const extra of [
      { situacao: "ganho" },
      { encerradoEm: "2026-01-01T00:00:00.000Z" },
      { estado: "arquivado" },
      { criadoPor: "mem_outro" },
      { workspaceId: "ws_de_outro" },
    ]) {
      const resposta = await criar(servico, { titulo: "Contrato", contatoId: "c1", ...extra });
      expect(resposta.statusCode).toBe(400);
      expect(resposta.json().ok).toBe(false);
    }
    expect(chamadas).toEqual([]);
  });

  it("(a) POST /negocios com valor numérico ou com vírgula responde 400; texto decimal chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    expect((await criar(servico, { titulo: "x", contatoId: "c1", valor: 12.5 })).statusCode).toBe(400);
    expect((await criar(servico, { titulo: "x", contatoId: "c1", valor: "12,50" })).statusCode).toBe(400);
    expect((await criar(servico, { titulo: "x", contatoId: "c1", valor: "-1" })).statusCode).toBe(400);
    expect((await criar(servico, { titulo: "x", contatoId: "c1", moeda: "brl" })).statusCode).toBe(400);
    expect((await criar(servico, { titulo: "x", contatoId: "c1", probabilidade: 101 })).statusCode).toBe(400);
    expect((await criar(servico, { titulo: "x", contatoId: "c1", dataPrevistaFechamento: "01/12/2026" })).statusCode).toBe(400);
    expect(chamadas).toEqual([]);

    const ok = await criar(servico, { titulo: "Contrato", contatoId: "c1", valor: "1234.50", moeda: "BRL", dataPrevistaFechamento: "2026-12-01" });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toEqual({ ok: true, dados: detalheFalso });
    expect(chamadas[0]?.[2]).toEqual({
      titulo: "Contrato",
      contatoId: "c1",
      valor: "1234.50",
      moeda: "BRL",
      dataPrevistaFechamento: "2026-12-01",
    });
  });

  it("(a) POST /negocios exige Empresa OU Contato: os dois ou nenhum responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    expect((await criar(servico, { titulo: "x", contatoId: "c1", empresaId: "e1" })).statusCode).toBe(400);
    expect((await criar(servico, { titulo: "x" })).statusCode).toBe(400);
    expect((await criar(servico, { titulo: "   ", contatoId: "c1" })).statusCode).toBe(400);
    expect(chamadas).toEqual([]);
    expect((await criar(servico, { titulo: "x", empresaId: "e1" })).statusCode).toBe(201);
  });

  it("(b) GET /negocios?situacao=fechado responde 400; funilId e situacao chegam ao serviço junto dos padrões", async () => {
    const { servico, chamadas } = novoFalso({ listar: sucesso({ itens: [], total: 0 }) });
    const ruim = await appCom(servico).inject({ method: "GET", url: "/negocios?situacao=fechado", headers: AUTORIZACAO });
    expect(ruim.statusCode).toBe(400);
    const desconhecida = await appCom(servico).inject({ method: "GET", url: "/negocios?ordem=titulo", headers: AUTORIZACAO });
    expect(desconhecida.statusCode).toBe(400);
    const demais = await appCom(servico).inject({ method: "GET", url: "/negocios?limite=201", headers: AUTORIZACAO });
    expect(demais.statusCode).toBe(400);
    expect(chamadas).toEqual([]);

    const resposta = await appCom(servico).inject({ method: "GET", url: "/negocios?funilId=f1&situacao=aberto", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.[2]).toMatchObject({ funilId: "f1", situacao: "aberto", estado: "ativo", limite: 50, deslocamento: 0 });

    await appCom(servico).inject({
      method: "GET",
      url: "/negocios?empresaId=e1&contatoId=c1&q=alfa&estado=arquivado&limite=200&deslocamento=10",
      headers: AUTORIZACAO,
    });
    expect(chamadas[1]?.[2]).toMatchObject({ empresaId: "e1", contatoId: "c1", q: "alfa", estado: "arquivado", limite: 200, deslocamento: 10 });
  });

  it("(c) POST /negocios/n1/reabrir sem corpo e sem content-type chega ao serviço; com Etapa também", async () => {
    const { servico, chamadas } = novoFalso();
    const semCorpo = await appCom(servico).inject({ method: "POST", url: "/negocios/n1/reabrir", headers: AUTORIZACAO });
    expect(semCorpo.statusCode).toBe(200);
    expect(chamadas[0]?.slice(0, 1)).toEqual(["reabrir"]);
    expect(chamadas[0]?.[2]).toBe("n1");
    expect(chamadas[0]?.[3]).toEqual({});

    const comDestino = await appCom(servico).inject({
      method: "POST",
      url: "/negocios/n1/reabrir",
      headers: AUTORIZACAO,
      payload: { funilId: "f2", etapaId: "e9" },
    });
    expect(comDestino.statusCode).toBe(200);
    expect(chamadas[1]?.[3]).toEqual({ funilId: "f2", etapaId: "e9" });

    const intruso = await appCom(servico).inject({
      method: "POST",
      url: "/negocios/n1/reabrir",
      headers: AUTORIZACAO,
      payload: { situacao: "ganho" },
    });
    expect(intruso.statusCode).toBe(400);
  });

  it("(c) o 403 do serviço em reabrir passa intacto", async () => {
    const { servico } = novoFalso({
      reabrir: recusa(403, "Só Administrador ou Proprietário reabre um Negócio ganho (RN-NEG-10).", { codigo: "PERMISSAO" }),
    });
    const resposta = await appCom(servico).inject({ method: "POST", url: "/negocios/n1/reabrir", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({
      ok: false,
      error: "Só Administrador ou Proprietário reabre um Negócio ganho (RN-NEG-10).",
      codigo: "PERMISSAO",
    });
  });

  it("(d) POST /negocios/n1/ganhar com valor e motivo chega ao serviço; valor numérico ou campo estranho responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/negocios/n1/ganhar",
      headers: AUTORIZACAO,
      payload: { valor: "10.00", motivoGanho: "preço" },
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.slice(0, 3)).toEqual(["ganhar", expect.anything(), "n1"]);
    expect(chamadas[0]?.[3]).toEqual({ valor: "10.00", motivoGanho: "preço" });

    for (const payload of [{ valor: 10 }, { valor: "10,00" }, { situacao: "perdido" }, { motivoPerda: "x" }]) {
      const ruim = await appCom(servico).inject({ method: "POST", url: "/negocios/n1/ganhar", headers: AUTORIZACAO, payload });
      expect(ruim.statusCode).toBe(400);
    }
    expect(chamadas).toHaveLength(1);

    const semCorpo = await appCom(servico).inject({ method: "POST", url: "/negocios/n1/ganhar", headers: AUTORIZACAO });
    expect(semCorpo.statusCode).toBe(200);
    expect(chamadas[1]?.[3]).toEqual({});
  });

  it("(d) o 409 NEGOCIO_EXIGE_VALOR com campo valor passa intacto, assim como NEGOCIO_EXIGE_MOTIVO", async () => {
    const { servico } = novoFalso({
      ganhar: recusa(409, "Este Funil exige um valor maior que zero.", { codigo: "NEGOCIO_EXIGE_VALOR", campo: "valor" }),
      perder: recusa(409, "Este Funil exige o motivo da perda.", { codigo: "NEGOCIO_EXIGE_MOTIVO", campo: "motivoPerda" }),
    });
    const ganho = await appCom(servico).inject({ method: "POST", url: "/negocios/n1/ganhar", headers: AUTORIZACAO, payload: {} });
    expect(ganho.statusCode).toBe(409);
    expect(ganho.json()).toEqual({
      ok: false,
      error: "Este Funil exige um valor maior que zero.",
      codigo: "NEGOCIO_EXIGE_VALOR",
      campo: "valor",
    });
    const perda = await appCom(servico).inject({ method: "POST", url: "/negocios/n1/perder", headers: AUTORIZACAO, payload: {} });
    expect(perda.statusCode).toBe(409);
    expect(perda.json()).toMatchObject({ codigo: "NEGOCIO_EXIGE_MOTIVO", campo: "motivoPerda" });
  });

  it("POST /negocios/n1/mover exige etapaId e recusa campo estranho", async () => {
    const { servico, chamadas } = novoFalso();
    for (const payload of [{}, { funilId: "f1" }, { etapaId: "e2", situacao: "ganho" }]) {
      const ruim = await appCom(servico).inject({ method: "POST", url: "/negocios/n1/mover", headers: AUTORIZACAO, payload });
      expect(ruim.statusCode).toBe(400);
    }
    expect(chamadas).toEqual([]);
    const ok = await appCom(servico).inject({
      method: "POST",
      url: "/negocios/n1/mover",
      headers: AUTORIZACAO,
      payload: { etapaId: "e2", funilId: "f2" },
    });
    expect(ok.statusCode).toBe(200);
    expect(chamadas[0]?.[3]).toEqual({ etapaId: "e2", funilId: "f2" });
  });

  it("PATCH /negocios/n1 exige ao menos um campo, aceita null para limpar e recusa situacao e estado", async () => {
    const { servico, chamadas } = novoFalso();
    for (const payload of [{}, { situacao: "ganho" }, { estado: "arquivado" }, { funilId: "f2" }, { valor: 12.5 }]) {
      const ruim = await appCom(servico).inject({ method: "PATCH", url: "/negocios/n1", headers: AUTORIZACAO, payload });
      expect(ruim.statusCode).toBe(400);
    }
    expect(chamadas).toEqual([]);
    const ok = await appCom(servico).inject({
      method: "PATCH",
      url: "/negocios/n1",
      headers: AUTORIZACAO,
      payload: { empresaId: "e1", contatoId: null, valor: null, probabilidade: null, titulo: "Novo título" },
    });
    expect(ok.statusCode).toBe(200);
    expect(chamadas[0]?.[3]).toEqual({ empresaId: "e1", contatoId: null, valor: null, probabilidade: null, titulo: "Novo título" });
  });

  it("arquivar, restaurar, lixeira e exclusão permanente não declaram corpo e chegam ao serviço", async () => {
    const { servico, chamadas } = novoFalso({ excluirPermanentemente: sucesso({ id: "n1" }) });
    const app = appCom(servico);
    expect((await app.inject({ method: "POST", url: "/negocios/n1/arquivar", headers: AUTORIZACAO })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/negocios/n1/restaurar", headers: AUTORIZACAO })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: "/negocios/n1", headers: AUTORIZACAO })).statusCode).toBe(200);
    const permanente = await app.inject({ method: "DELETE", url: "/negocios/n1/permanente", headers: AUTORIZACAO });
    expect(permanente.statusCode).toBe(200);
    expect(permanente.json()).toEqual({ ok: true, dados: { id: "n1" } });
    expect(chamadas.map((c) => c[0])).toEqual(["arquivar", "restaurar", "enviarParaLixeira", "excluirPermanentemente"]);
  });
});

/** Sessões do bloco com banco: cada token é um Membro, e o `id` dele é o da linha semeada. */
const SESSOES = {
  "token-admin": { sub: MARYANE, membroId: "mem_admin" },
  "token-membro": { sub: "usuario-membro", membroId: "mem_ana" },
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

const ADMIN = { authorization: "Bearer token-admin" };
const MEMBRO = { authorization: "Bearer token-membro" };
const CONVIDADO = { authorization: "Bearer token-convidado" };

describeComBanco("rotas de Negócios — serviço real, Postgres local", () => {
  const espaco = novoEspacoDeTeste("negociosrotas");
  const app = () => buildApp(opcoesComPapeis(espaco));

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(espaco, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(espaco, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(espaco, { id: "mem_convidado", base: "convidado", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(espaco);
    await encerrar();
  });

  interface Corpo {
    ok: boolean;
    dados?: NegocioDetalhado & { contato?: { id: string } };
    error?: string;
    codigo?: string;
    campo?: string;
  }

  async function chamar(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown, headers = MEMBRO) {
    const resposta = await app().inject({ method, url, headers, ...(payload !== undefined ? { payload: payload as object } : {}) });
    return { status: resposta.statusCode, corpo: resposta.json() as Corpo };
  }

  it("(e) o ciclo: Funil padrão com Regras, Negócio sem Funil, mover, ganhar sem valor 409, com valor, reabrir 403 e 200, perder, lixeira e restaurar", async () => {
    const funil = await app().inject({
      method: "POST",
      url: "/funis",
      headers: ADMIN,
      payload: {
        nome: "Vendas",
        exigeValorGanho: true,
        exigeMotivoPerda: true,
        etapas: [{ nome: "Novo", probabilidadePadrao: 10 }, { nome: "Proposta", probabilidadePadrao: 50 }],
      },
    });
    expect(funil.statusCode).toBe(201);
    const funilCriado = funil.json().dados as { funil: { id: string; padrao: boolean }; etapas: { id: string }[] };
    expect(funilCriado.funil.padrao).toBe(true);

    const contato = await app().inject({ method: "POST", url: "/contatos", headers: MEMBRO, payload: { nome: "Cliente do ciclo" } });
    expect(contato.statusCode).toBe(201);
    const contatoId = (contato.json().dados as { contato: { id: string } }).contato.id;

    const criado = await chamar("POST", "/negocios", { titulo: "Contrato do ciclo", contatoId, valor: "1500.00" });
    expect(criado.status).toBe(201);
    const id = criado.corpo.dados!.negocio.id;
    expect(criado.corpo.dados!.negocio.funilId).toBe(funilCriado.funil.id);
    expect(criado.corpo.dados!.negocio.etapaId).toBe(funilCriado.etapas[0]!.id);
    expect(criado.corpo.dados!.negocio.valor).toBe("1500.00");

    const movido = await chamar("POST", `/negocios/${id}/mover`, { etapaId: funilCriado.etapas[1]!.id });
    expect(movido.status).toBe(200);
    expect(movido.corpo.dados!.probabilidadeEfetiva).toBe(50);

    // O valor do Negócio (1500.00) já satisfaz a Regra; zerar o valor da entrada não: "0" é recusado.
    const zero = await chamar("POST", `/negocios/${id}/ganhar`, { valor: "0" });
    expect(zero.status).toBe(409);
    expect(zero.corpo).toMatchObject({ ok: false, codigo: "NEGOCIO_EXIGE_VALOR", campo: "valor" });

    const semValor = await chamar("POST", "/negocios", { titulo: "Sem valor", contatoId });
    const idSemValor = semValor.corpo.dados!.negocio.id;
    const recusado = await chamar("POST", `/negocios/${idSemValor}/ganhar`);
    expect(recusado.status).toBe(409);
    expect(recusado.corpo).toMatchObject({ codigo: "NEGOCIO_EXIGE_VALOR", campo: "valor" });
    const ganho = await chamar("POST", `/negocios/${idSemValor}/ganhar`, { valor: "300.00" });
    expect(ganho.status).toBe(200);
    expect(ganho.corpo.dados!.negocio.situacao).toBe("ganho");
    expect(ganho.corpo.dados!.negocio.valor).toBe("300.00");

    const negado = await chamar("POST", `/negocios/${idSemValor}/reabrir`);
    expect(negado.status).toBe(403);
    expect(negado.corpo).toMatchObject({ ok: false, codigo: "PERMISSAO" });
    const reaberto = await chamar("POST", `/negocios/${idSemValor}/reabrir`, undefined, ADMIN);
    expect(reaberto.status).toBe(200);
    expect(reaberto.corpo.dados!.negocio.situacao).toBe("aberto");

    const semMotivo = await chamar("POST", `/negocios/${idSemValor}/perder`, {});
    expect(semMotivo.status).toBe(409);
    expect(semMotivo.corpo).toMatchObject({ codigo: "NEGOCIO_EXIGE_MOTIVO", campo: "motivoPerda" });
    const perdido = await chamar("POST", `/negocios/${idSemValor}/perder`, { motivoPerda: "Preço" });
    expect(perdido.status).toBe(200);
    expect(perdido.corpo.dados!.negocio.motivoPerda).toBe("Preço");
    const reabertoPeloMembro = await chamar("POST", `/negocios/${idSemValor}/reabrir`);
    expect(reabertoPeloMembro.status).toBe(200);

    const lixeira = await chamar("DELETE", `/negocios/${idSemValor}`);
    expect(lixeira.status).toBe(200);
    expect(lixeira.corpo.dados!.negocio.estado).toBe("na_lixeira");
    const restaurado = await chamar("POST", `/negocios/${idSemValor}/restaurar`);
    expect(restaurado.status).toBe(200);
    expect(restaurado.corpo.dados!.negocio.estado).toBe("ativo");

    const quadro = await chamar("GET", `/negocios?funilId=${funilCriado.funil.id}&situacao=aberto`);
    expect(quadro.status).toBe(200);
    const itens = (quadro.corpo as unknown as { itens: NegocioResumo[]; total: number }).itens;
    expect(itens.map((n) => n.titulo).sort()).toEqual(["Contrato do ciclo", "Sem valor"]);

    await chamar("DELETE", `/negocios/${idSemValor}`);
    const apagado = await chamar("DELETE", `/negocios/${idSemValor}/permanente`);
    expect(apagado.status).toBe(200);
    expect(apagado.corpo.dados).toEqual({ id: idSemValor });
    expect((await chamar("GET", `/negocios/${idSemValor}`)).status).toBe(404);
  });

  it("(e) um Convidado lê e recebe 403 em POST /negocios (D-14)", async () => {
    const escrita = await chamar("POST", "/negocios", { titulo: "Do Convidado", contatoId: "qualquer" }, CONVIDADO);
    expect(escrita.status).toBe(403);
    expect(escrita.corpo).toMatchObject({ ok: false, codigo: "PERMISSAO" });
    const leitura = await chamar("GET", "/negocios", undefined, CONVIDADO);
    expect(leitura.status).toBe(200);
  });
});
