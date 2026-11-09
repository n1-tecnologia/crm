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

    describe("recusas por Conversa, Espaço, Papel e Canal (Task 3)", () => {
      const MIB = 1024 * 1024;
      const instagram = { canalId: "", conversaId: "" };
      const comoMembro = (id: string, workspaceId = ws) =>
        appComArmazenamento({
          ...opcoesDeAutenticacao(workspaceId),
          resolverMembro: async () => ({ ...membros.find((m) => m.userId === MARYANE)!, id, workspaceId }),
        });

      async function conversaNova(espaco: string, canalId: string, nome: string): Promise<string> {
        const contato = await criarRepositorioDeContatosPg(pool()).inserir(espaco, { nome, proprietarioId: "mem_maryane", criadoPor: "mem_maryane" });
        const conversa = await criarRepositorioDeConversasPg(pool()).inserir(espaco, {
          canalId, contatoId: contato.id, titulo: nome, filaId: null,
          atribuido: { tipo: "membro", id: "mem_maryane" }, participantes: [], criadoPor: { tipo: "member", id: "mem_maryane" },
        });
        return conversa.id;
      }

      const enviarComAnexo = (conversaId: string, submissionId: string, objectId: string, aplicacao = appComArmazenamento(), extra: Record<string, unknown> = {}) =>
        aplicacao.inject({
          method: "POST",
          url: "/mensagens",
          headers: AUTORIZACAO,
          payload: { conversaId, direcao: "enviada", conteudo: "", anexos: [{ submissionId, objectId }], ...extra },
        });

      const total = async (conversaId: string) => (await mensagens().listar(ws, { conversaId, limite: 200, deslocamento: 0 })).total;
      const ogg = (bytes: number) => {
        const conteudo = new Uint8Array(bytes);
        conteudo.set(Buffer.from("OggS"));
        return conteudo;
      };

      beforeAll(async () => {
        instagram.canalId = await semearCanal(ws, { nome: "Instagram", tipo: "instagram", provedor: "instagram-graph", identificadorExterno: "@n1_teste", conexao: "desconectada" });
        instagram.conversaId = await conversaNova(ws, instagram.canalId, "Dani");
      });

      it("a sessão de outra Conversa responde 422 \"Este arquivo não é desta Conversa.\" e nenhuma Mensagem é gravada", async () => {
        const outra = await conversaNova(ws, ids.suporte.canalId, "Edu");
        const { submissionId, objectId } = await subirAnexo(ids.suporte.conversaId);
        const antes = await total(outra);
        const resposta = await enviarComAnexo(outra, submissionId, objectId);
        expect(resposta.statusCode).toBe(422);
        expect(resposta.json()).toMatchObject({ ok: false, error: "Este arquivo não é desta Conversa.", codigo: "ANEXO_DE_OUTRA_CONVERSA" });
        expect(await total(outra)).toBe(antes);
        expect(armazenamento.sessaoConsumida(submissionId)).toBe(false);
        expect(resposta.body).not.toContain("workspace/");
      });

      it("a sessão de outro Espaço (mesmo com o formId da Conversa) responde 422 e nada é gravado", async () => {
        const deFora = await armazenamento.abrirSessao({ workspaceId: ws2, formId: `conversa-${ids.suporte.conversaId}` });
        const ticket = await armazenamento.emitirTicket({
          submissionId: deFora.submissionId, displayName: "foto.png", mediaType: "image/png",
          tipos: ["image/png"], prefixoDaChave: `workspace/${ws2}/conversas/${ids.suporte.conversaId}`, tetoBytes: MIB,
        });
        armazenamento.colocarBytes(ticket.objectId, PNG);
        const antes = await total(ids.suporte.conversaId);
        const resposta = await enviarComAnexo(ids.suporte.conversaId, deFora.submissionId, ticket.objectId);
        expect(resposta.statusCode).toBe(422);
        expect(resposta.json()).toMatchObject({ codigo: "ANEXO_DE_OUTRA_CONVERSA" });
        expect(await total(ids.suporte.conversaId)).toBe(antes);
        expect(armazenamento.sessaoConsumida(deFora.submissionId)).toBe(false);
      });

      it("referência de sessão que não existe responde 422 ANEXO_NAO_ENCONTRADO; objeto de OUTRA sessão responde 422 como de outra Conversa", async () => {
        const inexistente = await enviarComAnexo(ids.suporte.conversaId, "sessao-que-nao-existe", "objeto-x");
        expect(inexistente.statusCode).toBe(422);
        expect(inexistente.json()).toMatchObject({ codigo: "ANEXO_NAO_ENCONTRADO" });
        const a = await subirAnexo(ids.suporte.conversaId);
        const b = await subirAnexo(ids.suporte.conversaId);
        const cruzado = await enviarComAnexo(ids.suporte.conversaId, a.submissionId, b.objectId);
        expect(cruzado.statusCode).toBe(422);
        expect(cruzado.json()).toMatchObject({ codigo: "ANEXO_DE_OUTRA_CONVERSA" });
      });

      it("a sessão que já virou anexo não vale de novo: 409 ANEXO_JA_USADO e a segunda Mensagem não é gravada", async () => {
        const { submissionId, objectId } = await subirAnexo(ids.suporte.conversaId);
        expect((await enviarComAnexo(ids.suporte.conversaId, submissionId, objectId)).statusCode).toBe(201);
        const depois = await total(ids.suporte.conversaId);
        const repetida = await enviarComAnexo(ids.suporte.conversaId, submissionId, objectId);
        expect(repetida.statusCode).toBe(409);
        expect(repetida.json()).toMatchObject({ ok: false, codigo: "ANEXO_JA_USADO" });
        expect(await total(ids.suporte.conversaId)).toBe(depois);
      });

      it("dois anexos na mesma Mensagem respondem 400 e nada é gravado", async () => {
        const a = await subirAnexo(ids.suporte.conversaId);
        const b = await subirAnexo(ids.suporte.conversaId);
        const antes = await total(ids.suporte.conversaId);
        const resposta = await appComArmazenamento().inject({
          method: "POST",
          url: "/mensagens",
          headers: AUTORIZACAO,
          payload: { conversaId: ids.suporte.conversaId, direcao: "enviada", conteudo: "", anexos: [a, b] },
        });
        expect(resposta.statusCode).toBe(400);
        expect(await total(ids.suporte.conversaId)).toBe(antes);
      });

      it("o Canal que não envia documento (Instagram) recusa um PDF no ticket, sem abrir sessão, e no envio", async () => {
        const sessoes = armazenamento.quantidadeDeSessoes();
        const ticket = await pedirTicket(instagram.conversaId, { nome: "contrato.pdf", tipoDeMidia: "application/pdf", tamanhoBytes: 1000 });
        expect(ticket.statusCode).toBe(422);
        expect(ticket.json()).toMatchObject({ ok: false, error: "Este Canal não envia este tipo de arquivo.", codigo: "TIPO_NAO_ENVIADO_PELO_CANAL" });
        expect(armazenamento.quantidadeDeSessoes()).toBe(sessoes);

        // Um envio forjado (a sessão aberta direto no falso, com o PDF) tem de ser recusado também na hora de gravar.
        const forjada = await armazenamento.abrirSessao({ workspaceId: ws, formId: `conversa-${instagram.conversaId}` });
        const objeto = await armazenamento.emitirTicket({
          submissionId: forjada.submissionId, displayName: "contrato.pdf", mediaType: "application/pdf",
          tipos: ["application/pdf"], prefixoDaChave: `workspace/${ws}/conversas/${instagram.conversaId}`, tetoBytes: MIB,
        });
        armazenamento.colocarBytes(objeto.objectId, Buffer.from("%PDF-1.4\n%teste\n"));
        const antes = await total(instagram.conversaId);
        const envio = await enviarComAnexo(instagram.conversaId, forjada.submissionId, objeto.objectId);
        expect(envio.statusCode).toBe(422);
        expect(envio.json()).toMatchObject({ ok: false, error: "Este Canal não envia este tipo de arquivo.", codigo: "TIPO_NAO_ENVIADO_PELO_CANAL" });
        expect(await total(instagram.conversaId)).toBe(antes);
        expect(armazenamento.sessaoConsumida(forjada.submissionId)).toBe(false);
      });

      it("o Instagram aceita uma imagem; um tipo fora da lista da Mensagem responde 422 TIPO_NAO_ACEITO", async () => {
        expect((await pedirTicket(instagram.conversaId)).statusCode).toBe(200);
        const fora = await pedirTicket(ids.suporte.conversaId, { nome: "setup.exe", tipoDeMidia: "application/x-msdownload", tamanhoBytes: 1000 });
        expect(fora.statusCode).toBe(422);
        expect(fora.json()).toMatchObject({ codigo: "TIPO_NAO_ACEITO" });
      });

      it("o ticket acima do teto responde 422 \"O arquivo passa do tamanho máximo.\" sem abrir sessão; no teto exato passa", async () => {
        const sessoes = armazenamento.quantidadeDeSessoes();
        for (const [tipo, tamanho] of [["image/png", 25 * MIB + 1], ["audio/ogg", 17 * MIB], ["video/mp4", 16 * MIB + 1]] as const) {
          const resposta = await pedirTicket(ids.suporte.conversaId, { nome: "grande", tipoDeMidia: tipo, tamanhoBytes: tamanho });
          expect(resposta.statusCode).toBe(422);
          expect(resposta.json()).toMatchObject({ ok: false, error: "O arquivo passa do tamanho máximo.", codigo: "ARQUIVO_GRANDE_DEMAIS" });
        }
        expect(armazenamento.quantidadeDeSessoes()).toBe(sessoes);
        expect((await pedirTicket(ids.suporte.conversaId, { nome: "voz.ogg", tipoDeMidia: "audio/ogg; codecs=opus", tamanhoBytes: 16 * MIB })).statusCode).toBe(200);
        expect((await pedirTicket(ids.suporte.conversaId, { nome: "foto", tipoDeMidia: "image/png", tamanhoBytes: 20 * MIB })).statusCode).toBe(200);
      });

      it("T-16-31: o arquivo que não é o que diz ser, ou que não chegou, ou que passa do teto ao subir, é recusado na confirmação", async () => {
        const disfarcado = await subirAnexo(ids.suporte.conversaId, Buffer.from("isto é só um texto"), { nome: "voz.ogg", tipoDeMidia: "audio/ogg", tamanhoBytes: 100 });
        const antes = await total(ids.suporte.conversaId);
        const r1 = await enviarComAnexo(ids.suporte.conversaId, disfarcado.submissionId, disfarcado.objectId);
        expect(r1.statusCode).toBe(422);
        expect(r1.json()).toMatchObject({ error: "O conteúdo do arquivo não confere com o tipo dele.", codigo: "ARQUIVO_NAO_CONFERE" });

        const ticket = await pedirTicket(ids.suporte.conversaId);
        const { submissionId, objectId } = (ticket.json() as { dados: { submissionId: string; objectId: string } }).dados;
        const r2 = await enviarComAnexo(ids.suporte.conversaId, submissionId, objectId);
        expect(r2.statusCode).toBe(422);
        expect(r2.json()).toMatchObject({ codigo: "ARQUIVO_AUSENTE" });

        // O ticket dizia 100 bytes de áudio; o navegador subiu 17 MiB: a confirmação mede o que chegou.
        const grande = await subirAnexo(ids.suporte.conversaId, ogg(17 * MIB), { nome: "voz.ogg", tipoDeMidia: "audio/ogg", tamanhoBytes: 100 });
        const r3 = await enviarComAnexo(ids.suporte.conversaId, grande.submissionId, grande.objectId);
        expect(r3.statusCode).toBe(422);
        expect(r3.json()).toMatchObject({ error: "O arquivo passa do tamanho máximo.", codigo: "ARQUIVO_GRANDE_DEMAIS" });
        expect(await total(ids.suporte.conversaId)).toBe(antes);
        for (const r of [r1, r2, r3]) expect(r.body).not.toContain("workspace/");
      });

      it("o áudio de verdade (OggS, com codec no tipo) sobe e vira anexo com o tipo normalizado", async () => {
        const voz = await subirAnexo(ids.suporte.conversaId, ogg(2048), { nome: "voz.ogg", tipoDeMidia: "audio/ogg; codecs=opus", tamanhoBytes: 2048 });
        const resposta = await enviarComAnexo(ids.suporte.conversaId, voz.submissionId, voz.objectId);
        expect(resposta.statusCode).toBe(201);
        expect((resposta.json() as { dados: Mensagem }).dados.anexos[0]).toMatchObject({ tipoDeMidia: "audio/ogg", nome: "voz.ogg", baixado: true, tamanhoBytes: 2048 });
      });

      it("Convidado (sem poder enviar) recebe 403 no ticket e no envio; Membro suspenso, 403 SUSPENSO", async () => {
        await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
        const comoConvidado = comoMembro("mem_convidado");
        expect((await pedirTicket(ids.suporte.conversaId, {}, comoConvidado)).statusCode).toBe(403);
        expect((await enviarComAnexo(ids.suporte.conversaId, "s", "o", comoConvidado)).statusCode).toBe(403);
        const comoSuspenso = appComArmazenamento({
          ...opcoesDeAutenticacao(ws),
          resolverMembro: async () => ({ ...membros.find((m) => m.userId === MARYANE)!, state: "suspenso" as const }),
        });
        const suspenso = await pedirTicket(ids.suporte.conversaId, {}, comoSuspenso);
        expect(suspenso.statusCode).toBe(403);
        expect(suspenso.json()).toMatchObject({ codigo: "SUSPENSO" });
      });

      it("o ticket de uma Conversa de outro Espaço, ou que não existe, responde 404; na lixeira, 409", async () => {
        const deFora = await pedirTicket("conversa-que-nao-existe");
        expect(deFora.statusCode).toBe(404);
        const conversa = await conversaNova(ws, ids.suporte.canalId, "Fabi");
        await pool().query("update plataforma.conversas set estado = 'na_lixeira', situacao = 'resolvida', na_lixeira_em = now() where workspace_id = $1 and id = $2", [ws, conversa]);
        const lixeira = await pedirTicket(conversa);
        expect(lixeira.statusCode).toBe(409);
        expect(lixeira.json()).toMatchObject({ codigo: "CONVERSA_NA_LIXEIRA" });
      });

      it("uma falha do armazenamento vira 500 genérico e nunca cita a chave nem a mensagem do erro", async () => {
        armazenamento.falharNaProxima(new Error(`boom: workspace/${ws}/conversas/x/segredo`));
        const resposta = await pedirTicket(ids.suporte.conversaId);
        expect(resposta.statusCode).toBe(500);
        expect(resposta.body).not.toContain("workspace/");
        expect(resposta.body).not.toContain("segredo");
      });

      describe("download", () => {
        async function mensagemComAnexo(anexo: { tipoDeMidia: string; nome: string; objectKey?: string; baixado: boolean }): Promise<string> {
          const criada = await mensagens().inserir(ws, {
            conversaId: ids.suporte.conversaId, canalId: ids.suporte.canalId, direcao: "interna",
            ator: { tipo: "member", id: "mem_maryane" }, conteudo: "com anexo", statusEntrega: null, anexos: [anexo],
          });
          return criada.id;
        }
        const baixar = (id: string, indice: number | string, aplicacao = appComArmazenamento()) =>
          aplicacao.inject({ method: "GET", url: `/mensagens/${id}/anexos/${indice}`, headers: AUTORIZACAO });

        it("PDF sai com download = o nome do arquivo (nunca abre no navegador); imagem sai sem download", async () => {
          const chavePdf = `workspace/${ws}/conversas/${ids.suporte.conversaId}/pdf-1`;
          const chaveImagem = `workspace/${ws}/conversas/${ids.suporte.conversaId}/img-1`;
          const id = await mensagemComAnexo({ tipoDeMidia: "application/pdf", nome: "contrato.pdf", objectKey: chavePdf, baixado: true });
          const idImagem = await mensagemComAnexo({ tipoDeMidia: "image/png", nome: "foto.png", objectKey: chaveImagem, baixado: true });
          expect((await baixar(id, 0)).statusCode).toBe(200);
          expect(armazenamento.urlsEmitidas.at(-1)).toEqual({ objectKey: chavePdf, download: "contrato.pdf" });
          expect((await baixar(idImagem, 0)).statusCode).toBe(200);
          expect(armazenamento.urlsEmitidas.at(-1)).toEqual({ objectKey: chaveImagem });
        });

        it.each([
          ["xml", "application/xml"],
          ["zip", "application/zip"],
          ["csv", "text/csv"],
          ["txt", "text/plain"],
          ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        ])("o documento %s também sai sempre como anexo para baixar", async (extensao, tipo) => {
          const chave = `workspace/${ws}/conversas/${ids.suporte.conversaId}/doc-${extensao}`;
          const id = await mensagemComAnexo({ tipoDeMidia: tipo, nome: `arquivo.${extensao}`, objectKey: chave, baixado: true });
          expect((await baixar(id, 0)).statusCode).toBe(200);
          expect(armazenamento.urlsEmitidas.at(-1)).toEqual({ objectKey: chave, download: `arquivo.${extensao}` });
        });

        it("o anexo com baixado false responde 404 \"O arquivo não está disponível.\" e não pede URL ao bucket", async () => {
          const id = await mensagemComAnexo({ tipoDeMidia: "audio/ogg", nome: "voz.ogg", baixado: false });
          const antes = armazenamento.urlsEmitidas.length;
          const resposta = await baixar(id, 0);
          expect(resposta.statusCode).toBe(404);
          expect(resposta.json()).toEqual({ ok: false, error: "O arquivo não está disponível.", codigo: "ARQUIVO_INDISPONIVEL" });
          expect(armazenamento.urlsEmitidas).toHaveLength(antes);
        });

        it("a chave de OUTRO Espaço gravada na linha nunca vira URL (a chave é conferida contra o Espaço da sessão)", async () => {
          const id = await mensagemComAnexo({ tipoDeMidia: "image/png", nome: "x.png", objectKey: `workspace/${ws2}/conversas/z/img`, baixado: true });
          const antes = armazenamento.urlsEmitidas.length;
          const resposta = await baixar(id, 0);
          expect(resposta.statusCode).toBe(404);
          expect(resposta.json()).toMatchObject({ codigo: "ARQUIVO_INDISPONIVEL" });
          expect(armazenamento.urlsEmitidas).toHaveLength(antes);
        });

        it("índice que não existe responde 404; Mensagem sem anexo e Mensagem inexistente também", async () => {
          const id = await mensagemComAnexo({ tipoDeMidia: "image/png", nome: "foto.png", objectKey: `workspace/${ws}/conversas/c/img`, baixado: true });
          const alem = await baixar(id, 5);
          expect(alem.statusCode).toBe(404);
          expect(alem.json()).toMatchObject({ ok: false, codigo: "ANEXO_NAO_ENCONTRADO" });
          const semAnexo = await mensagens().inserir(ws, {
            conversaId: ids.suporte.conversaId, canalId: ids.suporte.canalId, direcao: "interna",
            ator: { tipo: "member", id: "mem_maryane" }, conteudo: "sem anexo", statusEntrega: null,
          });
          expect((await baixar(semAnexo.id, 0)).statusCode).toBe(404);
          expect((await baixar("mensagem-que-nao-existe", 0)).json()).toMatchObject({ codigo: "MENSAGEM_NAO_ENCONTRADA" });
        });

        it("Membro de outro Espaço recebe 404 (nunca 403, nunca a URL); Membro removido recebe 403", async () => {
          const chave = `workspace/${ws}/conversas/${ids.suporte.conversaId}/img-2`;
          const id = await mensagemComAnexo({ tipoDeMidia: "image/png", nome: "foto.png", objectKey: chave, baixado: true });
          const antes = armazenamento.urlsEmitidas.length;

          await semearMembro(ws2, { id: "mem_de_fora", base: "membro", state: "ativo" });
          const deFora = await baixar(id, 0, comoMembro("mem_de_fora", ws2));
          expect(deFora.statusCode).toBe(404);
          expect(deFora.json()).toMatchObject({ ok: false, codigo: "MENSAGEM_NAO_ENCONTRADA" });

          await semearMembro(ws, { id: "mem_removido", base: "membro", state: "removido" });
          const removido = await baixar(id, 0, comoMembro("mem_removido"));
          expect(removido.statusCode).toBe(403);
          expect(removido.json()).toMatchObject({ ok: false, codigo: "PERMISSAO" });
          expect(removido.body).not.toContain("workspace/");
          expect(armazenamento.urlsEmitidas).toHaveLength(antes);
        });

        it("índice inválido (negativo, fracionado, texto) não chega ao serviço", async () => {
          const id = await mensagemComAnexo({ tipoDeMidia: "image/png", nome: "foto.png", objectKey: `workspace/${ws}/conversas/c/img`, baixado: true });
          for (const indice of ["-1", "1.5", "abc"]) expect((await baixar(id, indice)).statusCode).toBe(400);
        });
      });
    });
  });
});
