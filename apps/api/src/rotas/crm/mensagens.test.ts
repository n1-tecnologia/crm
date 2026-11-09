/**
 * Rotas REST de Mensagem (08-12).
 *
 * Duas partes. A primeira roda sempre, com um serviço falso injetado por
 * `buildApp({ crm: { mensagens } })` (sem banco): autenticação, forma do corpo
 * e a ausência de qualquer porta humana para a `recebida` (T-08-44). A segunda
 * (`describeComBanco`) usa o serviço real contra o Postgres LOCAL:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55592/postgres npx vitest run src/rotas/crm/mensagens.test.ts
 *
 * e prova que nenhuma resposta traz a carga bruta do provedor (A9, T-08-45) e
 * que a janela do WhatsApp oficial é aplicada no servidor (T-08-47).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { Mensagem } from "@n1/dominio/crm/mensagens";
import { buildApp } from "../../app";
import { encerrar, pool } from "../../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../../repositorios/crm/mensagens";
import { criarServicoDeRecebimento } from "../../servicos/crm/recebimento";
import { criarAcessoAoCrmPg } from "../../servicos/crm/acesso";
import { criarServicoDeMensagens, type ServicoDeMensagens } from "../../servicos/crm/mensagens";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import { criarArmazenamentoFalso } from "../../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";

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

describe("rotas de Mensagens — serviço falso, sem banco", () => {
  function novoFalso(enviar?: ResultadoCrm<Mensagem>) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeMensagens = {
      listar: (...a) => {
        chamadas.push(["listar", ...a]);
        return Promise.resolve(sucesso({ itens: [], total: 0 }));
      },
      enviar: (...a) => {
        chamadas.push(["enviar", ...a]);
        return Promise.resolve(enviar ?? sucesso({ id: "m1" } as Mensagem));
      },
      reenviar: (...a) => {
        chamadas.push(["reenviar", ...a]);
        return Promise.resolve(enviar ?? sucesso({ id: "m1" } as Mensagem));
      },
      pedirTicketDeAnexo: (...a) => {
        chamadas.push(["pedirTicketDeAnexo", ...a]);
        return Promise.resolve(sucesso({ submissionId: "s1", objectId: "o1", uploadUrl: "https://armazenamento-falso.test/upload/o1" }));
      },
      urlDoAnexo: (...a) => {
        chamadas.push(["urlDoAnexo", ...a]);
        return Promise.resolve(sucesso({ url: "https://armazenamento-falso.test/objeto/k", expiraEm: "2026-11-09T19:00:00.000Z" }));
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeMensagens) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { mensagens: servico } });
  const corpoValido = { conversaId: "v1", direcao: "enviada", conteudo: "Bom dia" };

  it("(a) GET /mensagens e POST /mensagens sem Authorization respondem 401", async () => {
    const app = appCom(novoFalso().servico);
    expect((await app.inject({ method: "GET", url: "/mensagens?conversaId=v1" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/mensagens", payload: corpoValido })).statusCode).toBe(401);
  });

  it("(b) POST /mensagens com direcao recebida responde 400 e o serviço não é chamado", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { ...corpoValido, direcao: "recebida" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it.each(["idExterno", "cargaBruta", "statusEntrega", "ator", "canalId", "modeloId", "workspaceId"])(
    "(c) POST /mensagens com %s no corpo responde 400 e o serviço não é chamado",
    async (campo) => {
      const { servico, chamadas } = novoFalso();
      const resposta = await appCom(servico).inject({
        method: "POST",
        url: "/mensagens",
        headers: AUTORIZACAO,
        payload: { ...corpoValido, [campo]: "x" },
      });
      expect(resposta.statusCode).toBe(400);
      expect(chamadas).toEqual([]);
    },
  );

  it("POST /mensagens sem conteúdo (ou só espaços) ou sem conversaId responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    for (const payload of [{ ...corpoValido, conteudo: "   " }, { conversaId: "v1", direcao: "enviada" }, { direcao: "interna", conteudo: "x" }]) {
      const resposta = await app.inject({ method: "POST", url: "/mensagens", headers: AUTORIZACAO, payload });
      expect(resposta.statusCode).toBe(400);
    }
    expect(chamadas).toEqual([]);
  });

  it("POST /mensagens válido responde 201 com o Membro da sessão e o corpo repassado", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { ...corpoValido, direcao: "interna", emRespostaAId: "m0" },
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toMatchObject({ ok: true, dados: { id: "m1" } });
    expect(chamadas[0]?.[0]).toBe("enviar");
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[2]).toEqual({ ...corpoValido, direcao: "interna", emRespostaAId: "m0" });
  });

  it("(d) GET /mensagens sem conversaId responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/mensagens", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("GET /mensagens repassa conversaId, limite e deslocamento; limite acima do teto responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    const ok = await app.inject({ method: "GET", url: "/mensagens?conversaId=v1&limite=20&deslocamento=40", headers: AUTORIZACAO });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ok: true, itens: [], total: 0 });
    expect(chamadas[0]?.[2]).toEqual({ conversaId: "v1", limite: 20, deslocamento: 40 });
    const alto = await app.inject({ method: "GET", url: "/mensagens?conversaId=v1&limite=201", headers: AUTORIZACAO });
    expect(alto.statusCode).toBe(400);
  });

  it("(e) o 409 JANELA_EXPIRADA do serviço sai com campo modelo no envelope", async () => {
    const { servico } = novoFalso(recusa<Mensagem>(409, "A janela expirou.", { codigo: "JANELA_EXPIRADA", campo: "modelo" }));
    const resposta = await appCom(servico).inject({ method: "POST", url: "/mensagens", headers: AUTORIZACAO, payload: corpoValido });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({ ok: false, error: "A janela expirou.", codigo: "JANELA_EXPIRADA", campo: "modelo" });
  });

  it("(16-06) POST /mensagens/{id}/reenviar sem Authorization responde 401 e o serviço não é chamado", async () => {
    const { servico, chamadas } = novoFalso();
    expect((await appCom(servico).inject({ method: "POST", url: "/mensagens/m1/reenviar" })).statusCode).toBe(401);
    expect(chamadas).toEqual([]);
  });

  it("(16-06) POST /mensagens/{id}/reenviar sem corpo responde 200 e repassa o Membro da sessão e o id", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: "/mensagens/m1/reenviar", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ ok: true, dados: { id: "m1" } });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.[0]).toBe("reenviar");
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[2]).toBe("m1");
  });

  it("(16-06) o 409 NAO_FALHOU do serviço sai com a frase do produto no envelope", async () => {
    const { servico } = novoFalso(recusa<Mensagem>(409, "Só uma Mensagem que não foi enviada pode ser enviada de novo.", { codigo: "NAO_FALHOU" }));
    const resposta = await appCom(servico).inject({ method: "POST", url: "/mensagens/m1/reenviar", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({ ok: false, error: "Só uma Mensagem que não foi enviada pode ser enviada de novo.", codigo: "NAO_FALHOU" });
  });

  it("(16-09) POST /mensagens/anexos sem Authorization responde 401 e o serviço não é chamado", async () => {
    const { servico, chamadas } = novoFalso();
    const corpo = { conversaId: "v1", nome: "foto.png", tipoDeMidia: "image/png", tamanhoBytes: 2048 };
    expect((await appCom(servico).inject({ method: "POST", url: "/mensagens/anexos", payload: corpo })).statusCode).toBe(401);
    expect(chamadas).toEqual([]);
  });

  it("(16-09) POST /mensagens/anexos válido responde 200 com o ticket e repassa o Membro da sessão e o corpo", async () => {
    const { servico, chamadas } = novoFalso();
    const corpo = { conversaId: "v1", nome: "foto.png", tipoDeMidia: "image/png", tamanhoBytes: 2048 };
    const resposta = await appCom(servico).inject({ method: "POST", url: "/mensagens/anexos", headers: AUTORIZACAO, payload: corpo });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: { submissionId: "s1", objectId: "o1", uploadUrl: "https://armazenamento-falso.test/upload/o1" } });
    expect(chamadas[0]?.[0]).toBe("pedirTicketDeAnexo");
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[2]).toEqual(corpo);
  });

  it.each([
    ["sem conversaId", { nome: "a.png", tipoDeMidia: "image/png", tamanhoBytes: 10 }],
    ["sem nome", { conversaId: "v1", tipoDeMidia: "image/png", tamanhoBytes: 10 }],
    ["com nome vazio", { conversaId: "v1", nome: "  ", tipoDeMidia: "image/png", tamanhoBytes: 10 }],
    ["sem tipoDeMidia", { conversaId: "v1", nome: "a.png", tamanhoBytes: 10 }],
    ["com tamanho zero", { conversaId: "v1", nome: "a.png", tipoDeMidia: "image/png", tamanhoBytes: 0 }],
    ["com tamanho negativo", { conversaId: "v1", nome: "a.png", tipoDeMidia: "image/png", tamanhoBytes: -5 }],
    ["com tamanho fracionado", { conversaId: "v1", nome: "a.png", tipoDeMidia: "image/png", tamanhoBytes: 10.5 }],
    ["com a chave do objeto", { conversaId: "v1", nome: "a.png", tipoDeMidia: "image/png", tamanhoBytes: 10, objectKey: "workspace/x" }],
    ["com o Espaço", { conversaId: "v1", nome: "a.png", tipoDeMidia: "image/png", tamanhoBytes: 10, workspaceId: "ws_outro" }],
  ])("(16-09) POST /mensagens/anexos %s responde 400 e o serviço não é chamado", async (_nome, payload) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: "/mensagens/anexos", headers: AUTORIZACAO, payload });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("(16-09) POST /mensagens aceita conteúdo vazio COM um anexo, e recusa conteúdo vazio sem anexo", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    const anexos = [{ submissionId: "s1", objectId: "o1" }];
    const comAnexo = await app.inject({ method: "POST", url: "/mensagens", headers: AUTORIZACAO, payload: { ...corpoValido, conteudo: "", anexos } });
    expect(comAnexo.statusCode).toBe(201);
    expect(chamadas[0]?.[2]).toEqual({ ...corpoValido, conteudo: "", anexos });
    const semNada = await app.inject({ method: "POST", url: "/mensagens", headers: AUTORIZACAO, payload: { ...corpoValido, conteudo: "", anexos: [] } });
    expect(semNada.statusCode).toBe(400);
    expect(chamadas).toHaveLength(1);
  });

  it("(16-09) POST /mensagens com dois anexos, ou com a chave do objeto no anexo, responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    const um = { submissionId: "s1", objectId: "o1" };
    const dois = await app.inject({ method: "POST", url: "/mensagens", headers: AUTORIZACAO, payload: { ...corpoValido, anexos: [um, { submissionId: "s2", objectId: "o2" }] } });
    expect(dois.statusCode).toBe(400);
    const comChave = await app.inject({ method: "POST", url: "/mensagens", headers: AUTORIZACAO, payload: { ...corpoValido, anexos: [{ ...um, objectKey: "workspace/x/y" }] } });
    expect(comChave.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("(16-09) GET /mensagens/{id}/anexos/{indice} sem Authorization responde 401; com ele repassa o Membro, o id e o índice", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    expect((await app.inject({ method: "GET", url: "/mensagens/m1/anexos/0" })).statusCode).toBe(401);
    expect(chamadas).toEqual([]);
    const resposta = await app.inject({ method: "GET", url: "/mensagens/m1/anexos/2", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: { url: "https://armazenamento-falso.test/objeto/k", expiraEm: "2026-11-09T19:00:00.000Z" } });
    expect(chamadas[0]?.[0]).toBe("urlDoAnexo");
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[2]).toBe("m1");
    expect(chamadas[0]?.[3]).toBe(2);
  });

  it.each(["-1", "abc", "1.5", ""])("(16-09) GET /mensagens/{id}/anexos/%s com índice inválido responde 400 ou 404 e o serviço não é chamado", async (indice) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: `/mensagens/m1/anexos/${indice}`, headers: AUTORIZACAO });
    expect([400, 404]).toContain(resposta.statusCode);
    expect(chamadas).toEqual([]);
  });

  it("não existe rota de recebida nem DELETE/PATCH em /mensagens", async () => {
    const app = appCom(novoFalso().servico);
    for (const [method, url] of [
      ["POST", "/mensagens/recebida"],
      ["POST", "/mensagens/m1/recebida"],
      ["DELETE", "/mensagens/m1"],
      ["PATCH", "/mensagens/m1"],
    ] as const) {
      const resposta = await app.inject({ method, url, headers: AUTORIZACAO, payload: {} });
      expect(resposta.statusCode).toBe(404);
    }
  });
});

describeComBanco("rotas de Mensagens — serviço real, Postgres local", () => {
  const ws = novoEspacoDeTeste("msgrotas");
  const ws2 = novoEspacoDeTeste("msgrotas2");
  const recebimento = criarServicoDeRecebimento({ pool });
  const app = () => buildApp({ ...opcoesDeAutenticacao(ws), crm: {} });
  const ids = { comercial: { canalId: "", conversaId: "" }, suporte: { canalId: "", conversaId: "" } };
  const WHATSAPP_DA_ANA = "+5511987654321";
  const CARGA = { entry: [{ changes: [{ value: { text: "dado pessoal do provedor", from: "5511999990000" } }] }] };

  beforeAll(async () => {
    await prepararBancoCrm();
    // A sessão do seed é o Membro `mem_maryane`; o Papel dele vem da linha semeada.
    await semearMembro(ws, { id: "mem_maryane", base: "membro", state: "ativo" });
    const contato = await criarRepositorioDeContatosPg(pool()).inserir(ws, { nome: "Ana", proprietarioId: "mem_maryane", criadoPor: "mem_maryane" });
    await criarRepositorioDeContatosPg(pool()).inserirIdentificador(ws, contato.id, { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, principal: true });
    for (const [chave, nome, provedor, externo] of [
      ["comercial", "Comercial", "whatsapp-cloud", "+5511977770001"],
      ["suporte", "Suporte", "whatsapp-nao-oficial", "+5511977770002"],
    ] as const) {
      const canalId = await semearCanal(ws, { nome, tipo: "whatsapp", provedor, identificadorExterno: externo, conexao: "conectada" });
      const conversa = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
        canalId,
        contatoId: contato.id,
        titulo: `Ana — ${nome}`,
        filaId: null,
        atribuido: { tipo: "membro", id: "mem_maryane" },
        participantes: [],
        criadoPor: { tipo: "member", id: "mem_maryane" },
      });
      ids[chave] = { canalId, conversaId: conversa.id };
    }
  });

  afterAll(async () => {
    // `integration_outbox` não tem FK para o Espaço: as linhas de `mensagem.enviar.v1` saem por aqui.
    for (const espaco of [ws, ws2]) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [espaco]);
      await limparEspaco(espaco);
    }
    await encerrar();
  });

  const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const receber = (canalId: string, idExterno: string, criadoEm: string) =>
    recebimento.receberMensagem(ws, canalId, { idExterno, criadoEm, remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA }, conteudo: "oi", cargaBruta: CARGA });

  it("(f) GET /mensagens devolve o fio e a resposta crua NÃO contém carga_bruta nem cargaBruta nem o payload", async () => {
    await receber(ids.comercial.canalId, "wamid.f1", horasAtras(3));
    const resposta = await app().inject({ method: "GET", url: `/mensagens?conversaId=${ids.comercial.conversaId}`, headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    const json = resposta.json() as { itens: Array<{ idExterno: string }>; total: number };
    expect(json.total).toBe(1);
    expect(json.itens[0]?.idExterno).toBe("wamid.f1");
    expect(resposta.body).not.toContain("carga_bruta");
    expect(resposta.body).not.toContain("cargaBruta");
    expect(resposta.body).not.toContain("dado pessoal do provedor");
  });

  it("POST /mensagens enviada no oficial dentro da janela responde 201 pendente (só o provedor diz que saiu), sem carga bruta", async () => {
    const resposta = await app().inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { conversaId: ids.comercial.conversaId, direcao: "enviada", conteudo: "Bom dia" },
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toMatchObject({ ok: true, dados: { direcao: "enviada", statusEntrega: "pendente", ator: { tipo: "member", id: "mem_maryane" } } });
    expect(resposta.body).not.toContain("argaBruta");
    expect(resposta.body).not.toContain("arga_bruta");
  });

  it("POST /mensagens enviada no oficial com recebida de 30 h responde 409 JANELA_EXPIRADA; no não oficial responde 201", async () => {
    // Conversa nova por Canal, para a única recebida ser a de 30 h.
    await receber(ids.suporte.canalId, "wamid.s1", horasAtras(30));
    const naoOficial = await app().inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { conversaId: ids.suporte.conversaId, direcao: "enviada", conteudo: "Retornando" },
    });
    expect(naoOficial.statusCode).toBe(201);

    // No oficial, uma recebida MAIS RECENTE reabre a janela; então travamos a conta apagando-a do cenário.
    await pool().query("delete from plataforma.mensagens where workspace_id = $1 and conversa_id = $2 and direcao = 'recebida'", [ws, ids.comercial.conversaId]);
    await receber(ids.comercial.canalId, "wamid.f2", horasAtras(30));
    const oficial = await app().inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { conversaId: ids.comercial.conversaId, direcao: "enviada", conteudo: "Retornando" },
    });
    expect(oficial.statusCode).toBe(409);
    expect(oficial.json()).toMatchObject({ ok: false, codigo: "JANELA_EXPIRADA", campo: "modelo" });
    expect(oficial.body).not.toContain("argaBruta");
  });

  it("POST /mensagens com emRespostaAId de outra Conversa responde 409 RESPOSTA_DE_OUTRA_CONVERSA sem expor o constraint", async () => {
    const nota = await app().inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { conversaId: ids.suporte.conversaId, direcao: "interna", conteudo: "nota" },
    });
    const idDaNota = (nota.json() as { dados: { id: string } }).dados.id;
    const resposta = await app().inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { conversaId: ids.comercial.conversaId, direcao: "interna", conteudo: "resposta", emRespostaAId: idDaNota },
    });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toMatchObject({ codigo: "RESPOSTA_DE_OUTRA_CONVERSA" });
    expect(resposta.body).not.toContain("_fkey");
  });

  describe("Tentar de novo (16-06, 3.7.3)", () => {
    const mensagens = () => criarRepositorioDeMensagensPg(pool());

    /** Uma Mensagem `enviada` que o provedor recusou: `falhou` com o motivo. */
    async function mensagemQueFalhou(espaco: string, conversaId: string, canalId: string): Promise<string> {
      const criada = await mensagens().inserir(espaco, {
        conversaId,
        canalId,
        direcao: "enviada",
        ator: { tipo: "member", id: "mem_maryane" },
        conteudo: "não saiu",
        statusEntrega: "pendente",
      });
      await mensagens().marcarFalha(espaco, criada.id, "O provedor recusou a Mensagem.");
      return criada.id;
    }

    const reenviar = (id: string, headers: Record<string, string> = AUTORIZACAO, aplicacao = app()) =>
      aplicacao.inject({ method: "POST", url: `/mensagens/${id}/reenviar`, headers });

    const linhasDaFila = async (espaco: string, mensagemId: string) =>
      (
        await pool().query<{ status: string }>(
          "select status from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
          [espaco, mensagemId],
        )
      ).rows;

    const estadoDe = async (espaco: string, id: string) => (await mensagens().obter(espaco, id))!.statusEntrega;

    it("a Mensagem que falhou responde 200 pendente, sem o motivo, e entra na fila do Canal conectado", async () => {
      const id = await mensagemQueFalhou(ws, ids.comercial.conversaId, ids.comercial.canalId);
      const resposta = await reenviar(id);
      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toMatchObject({ ok: true, dados: { id, statusEntrega: "pendente", motivoFalha: null } });
      expect(await linhasDaFila(ws, id)).toEqual([{ status: "pending" }]);
    });

    it("Mensagem que não falhou (pendente, enviada, interna) responde 409 NAO_FALHOU e nada muda", async () => {
      const pendente = await mensagens().inserir(ws, {
        conversaId: ids.suporte.conversaId, canalId: ids.suporte.canalId, direcao: "enviada",
        ator: { tipo: "member", id: "mem_maryane" }, conteudo: "a", statusEntrega: "pendente",
      });
      const enviada = await mensagens().inserir(ws, {
        conversaId: ids.suporte.conversaId, canalId: ids.suporte.canalId, direcao: "enviada",
        ator: { tipo: "member", id: "mem_maryane" }, conteudo: "b", statusEntrega: "pendente",
      });
      await mensagens().gravarEnvio(ws, enviada.id, { idExterno: "ext-b", em: new Date().toISOString() });
      const interna = await mensagens().inserir(ws, {
        conversaId: ids.suporte.conversaId, canalId: ids.suporte.canalId, direcao: "interna",
        ator: { tipo: "member", id: "mem_maryane" }, conteudo: "c", statusEntrega: null,
      });
      for (const alvo of [pendente.id, enviada.id, interna.id]) {
        const resposta = await reenviar(alvo);
        expect(resposta.statusCode).toBe(409);
        expect(resposta.json()).toMatchObject({
          ok: false,
          error: "Só uma Mensagem que não foi enviada pode ser enviada de novo.",
          codigo: "NAO_FALHOU",
        });
        expect(await linhasDaFila(ws, alvo)).toEqual([]);
      }
      expect(await estadoDe(ws, pendente.id)).toBe("pendente");
      expect(await estadoDe(ws, enviada.id)).toBe("enviada");
    });

    it("Mensagem inexistente ou de outro Espaço responde 404 (nunca 403) e a de fora continua falhou", async () => {
      await semearMembro(ws2, { id: "mem_maryane", base: "membro", state: "ativo" });
      const contato = await criarRepositorioDeContatosPg(pool()).inserir(ws2, { nome: "Beto", proprietarioId: "mem_maryane", criadoPor: "mem_maryane" });
      const canalId = await semearCanal(ws2, { nome: "Comercial", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511977770009", conexao: "conectada" });
      const conversa = await criarRepositorioDeConversasPg(pool()).inserir(ws2, {
        canalId, contatoId: contato.id, titulo: "Beto", filaId: null,
        atribuido: { tipo: "membro", id: "mem_maryane" }, participantes: [], criadoPor: { tipo: "member", id: "mem_maryane" },
      });
      const deFora = await mensagemQueFalhou(ws2, conversa.id, canalId);

      for (const alvo of [deFora, "nao-existe"]) {
        const resposta = await reenviar(alvo);
        expect(resposta.statusCode).toBe(404);
        expect(resposta.json()).toMatchObject({ ok: false, codigo: "MENSAGEM_NAO_ENCONTRADA" });
      }
      expect(await estadoDe(ws2, deFora)).toBe("falhou");
      expect(await linhasDaFila(ws2, deFora)).toEqual([]);
    });

    it("Convidado (sem poder enviar) responde 403 e a Mensagem continua falhou", async () => {
      await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
      const id = await mensagemQueFalhou(ws, ids.suporte.conversaId, ids.suporte.canalId);
      const comoConvidado = buildApp({
        ...opcoesDeAutenticacao(ws),
        resolverMembro: async () => ({ ...membros.find((m) => m.userId === MARYANE)!, id: "mem_convidado" }),
        crm: {},
      });
      const resposta = await reenviar(id, AUTORIZACAO, comoConvidado);
      expect(resposta.statusCode).toBe(403);
      expect(await estadoDe(ws, id)).toBe("falhou");
      expect(await linhasDaFila(ws, id)).toEqual([]);
    });

    it("Membro suspenso responde 403 SUSPENSO (a escrita recusa antes de qualquer leitura) e a Mensagem continua falhou", async () => {
      const id = await mensagemQueFalhou(ws, ids.suporte.conversaId, ids.suporte.canalId);
      const comoSuspenso = buildApp({
        ...opcoesDeAutenticacao(ws),
        resolverMembro: async () => ({ ...membros.find((m) => m.userId === MARYANE)!, state: "suspenso" as const }),
        crm: {},
      });
      const resposta = await reenviar(id, AUTORIZACAO, comoSuspenso);
      expect(resposta.statusCode).toBe(403);
      expect(resposta.json()).toMatchObject({ ok: false, codigo: "SUSPENSO" });
      expect(await estadoDe(ws, id)).toBe("falhou");
    });

    it("Canal fora do ar: a Mensagem volta a pendente guardada, sem linha na fila (o Canal reenfileira ao voltar)", async () => {
      const id = await mensagemQueFalhou(ws, ids.suporte.conversaId, ids.suporte.canalId);
      await pool().query("update plataforma.canais set conexao = 'desconectada', conectada_em = null where workspace_id = $1 and id = $2", [ws, ids.suporte.canalId]);
      const resposta = await reenviar(id);
      expect(resposta.statusCode).toBe(200);
      expect(await estadoDe(ws, id)).toBe("pendente");
      expect(await linhasDaFila(ws, id)).toEqual([]);
      await pool().query("update plataforma.canais set conexao = 'conectada', conectada_em = now() where workspace_id = $1 and id = $2", [ws, ids.suporte.canalId]);
    });

    it("Conversa na lixeira responde 409 CONVERSA_NA_LIXEIRA e a Mensagem continua falhou", async () => {
      const id = await mensagemQueFalhou(ws, ids.suporte.conversaId, ids.suporte.canalId);
      await pool().query("update plataforma.conversas set estado = 'na_lixeira', situacao = 'resolvida', na_lixeira_em = now() where workspace_id = $1 and id = $2", [ws, ids.suporte.conversaId]);
      const resposta = await reenviar(id);
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json()).toMatchObject({ codigo: "CONVERSA_NA_LIXEIRA" });
      expect(await estadoDe(ws, id)).toBe("falhou");
      await pool().query("update plataforma.conversas set estado = 'ativo', na_lixeira_em = null where workspace_id = $1 and id = $2", [ws, ids.suporte.conversaId]);
    });
  });
  describe("Anexo da Mensagem (16-09, 3.9.3, MSG-04) — o armazenamento é o falso, nunca o Storage real", () => {
    const armazenamento = criarArmazenamentoFalso();
    const appComArmazenamento = (autenticacao: ReturnType<typeof opcoesDeAutenticacao> = opcoesDeAutenticacao(ws)) =>
      buildApp({ ...autenticacao, crm: { mensagens: criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool), armazenamento }) } });
    // Um PNG de 1x1 pixel de verdade.
    const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const mensagens = () => criarRepositorioDeMensagensPg(pool());

    const pedirTicket = (conversaId: string, extra: Record<string, unknown> = {}, aplicacao = appComArmazenamento()) =>
      aplicacao.inject({
        method: "POST",
        url: "/mensagens/anexos",
        headers: AUTORIZACAO,
        payload: { conversaId, nome: "foto.png", tipoDeMidia: "image/png", tamanhoBytes: PNG.byteLength, ...extra },
      });

    /** Pede o ticket e põe os bytes no falso, como o navegador faria no `uploadUrl`. */
    async function subirAnexo(conversaId: string, bytes: Uint8Array = PNG, extra: Record<string, unknown> = {}) {
      const ticket = await pedirTicket(conversaId, extra);
      expect(ticket.statusCode).toBe(200);
      const { submissionId, objectId } = (ticket.json() as { dados: { submissionId: string; objectId: string } }).dados;
      armazenamento.colocarBytes(objectId, bytes);
      return { submissionId, objectId };
    }

    it("POST /mensagens/anexos abre a sessão da Conversa e devolve o ticket; a chave reservada é do Espaço e da Conversa, e não sai na resposta", async () => {
      const resposta = await pedirTicket(ids.suporte.conversaId);
      expect(resposta.statusCode).toBe(200);
      const dados = (resposta.json() as { ok: true; dados: { submissionId: string; objectId: string; uploadUrl: string } }).dados;
      expect(Object.keys(dados).sort()).toEqual(["objectId", "submissionId", "uploadUrl"]);
      expect(armazenamento.chaveDoObjeto(dados.objectId).startsWith(`workspace/${ws}/conversas/${ids.suporte.conversaId}/`)).toBe(true);
      expect(await armazenamento.sessao(dados.submissionId)).toEqual({ workspaceId: ws, formId: `conversa-${ids.suporte.conversaId}` });
      expect(resposta.body).not.toContain("workspace/");
    });

    it("MSG-04: a Mensagem só com anexo (conteúdo vazio) é gravada com o anexo conferido e a sessão é consumida", async () => {
      const { submissionId, objectId } = await subirAnexo(ids.suporte.conversaId);
      const resposta = await appComArmazenamento().inject({
        method: "POST",
        url: "/mensagens",
        headers: AUTORIZACAO,
        payload: { conversaId: ids.suporte.conversaId, direcao: "enviada", conteudo: "", anexos: [{ submissionId, objectId }] },
      });
      expect(resposta.statusCode).toBe(201);
      const criada = (resposta.json() as { dados: Mensagem }).dados;
      expect(criada.statusEntrega).toBe("pendente");
      expect(criada.anexos).toEqual([
        { tipoDeMidia: "image/png", nome: "foto.png", objectKey: armazenamento.chaveDoObjeto(objectId), tamanhoBytes: PNG.byteLength, baixado: true },
      ]);
      expect((await mensagens().obter(ws, criada.id))?.anexos).toEqual(criada.anexos);
      expect(armazenamento.sessaoConsumida(submissionId)).toBe(true);
    });

    it("GET /mensagens/{id}/anexos/0 devolve uma URL assinada do falso, sem download: a imagem abre no <img>", async () => {
      const { submissionId, objectId } = await subirAnexo(ids.suporte.conversaId);
      const criada = (
        await appComArmazenamento().inject({
          method: "POST",
          url: "/mensagens",
          headers: AUTORIZACAO,
          payload: { conversaId: ids.suporte.conversaId, direcao: "enviada", conteudo: "", anexos: [{ submissionId, objectId }] },
        })
      ).json() as { dados: Mensagem };
      const antes = armazenamento.urlsEmitidas.length;
      const resposta = await appComArmazenamento().inject({ method: "GET", url: `/mensagens/${criada.dados.id}/anexos/0`, headers: AUTORIZACAO });
      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json() as { ok: true; dados: { url: string; expiraEm: string } };
      expect(corpo.dados.url.startsWith("https://armazenamento-falso.test/objeto/")).toBe(true);
      expect(Number.isNaN(Date.parse(corpo.dados.expiraEm))).toBe(false);
      expect(armazenamento.urlsEmitidas).toHaveLength(antes + 1);
      expect(armazenamento.urlsEmitidas.at(-1)).toEqual({ objectKey: armazenamento.chaveDoObjeto(objectId) });
    });
  });
});
