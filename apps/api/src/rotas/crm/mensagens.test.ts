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
import { criarAcessoAoCrmPg } from "../../servicos/crm/acesso";
import { criarServicoDeMensagens, type ServicoDeMensagens } from "../../servicos/crm/mensagens";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
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
      registrarRecebida: (...a) => {
        chamadas.push(["registrarRecebida", ...a]);
        return Promise.resolve(sucesso({ mensagem: { id: "m1" } as Mensagem, repetida: false }));
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
  const servicoReal = criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool) });
  const app = () => buildApp({ ...opcoesDeAutenticacao(ws), crm: {} });
  const ids = { comercial: { canalId: "", conversaId: "" }, suporte: { canalId: "", conversaId: "" } };
  const CARGA = { entry: [{ changes: [{ value: { text: "dado pessoal do provedor", from: "5511999990000" } }] }] };

  beforeAll(async () => {
    await prepararBancoCrm();
    // A sessão do seed é o Membro `mem_maryane`; o Papel dele vem da linha semeada.
    await semearMembro(ws, { id: "mem_maryane", base: "membro", state: "ativo" });
    const contato = await criarRepositorioDeContatosPg(pool()).inserir(ws, { nome: "Ana", proprietarioId: "mem_maryane", criadoPor: "mem_maryane" });
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
    await limparEspaco(ws);
    await encerrar();
  });

  const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const receber = (conversaId: string, idExterno: string, criadoEm: string) =>
    servicoReal.registrarRecebida(ws, { conversaId, idExterno, criadoEm, conteudo: "oi", cargaBruta: CARGA });

  it("(f) GET /mensagens devolve o fio e a resposta crua NÃO contém carga_bruta nem cargaBruta nem o payload", async () => {
    await receber(ids.comercial.conversaId, "wamid.f1", horasAtras(3));
    const resposta = await app().inject({ method: "GET", url: `/mensagens?conversaId=${ids.comercial.conversaId}`, headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    const json = resposta.json() as { itens: Array<{ idExterno: string }>; total: number };
    expect(json.total).toBe(1);
    expect(json.itens[0]?.idExterno).toBe("wamid.f1");
    expect(resposta.body).not.toContain("carga_bruta");
    expect(resposta.body).not.toContain("cargaBruta");
    expect(resposta.body).not.toContain("dado pessoal do provedor");
  });

  it("POST /mensagens enviada no oficial dentro da janela responde 201 sem carga bruta", async () => {
    const resposta = await app().inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { conversaId: ids.comercial.conversaId, direcao: "enviada", conteudo: "Bom dia" },
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toMatchObject({ ok: true, dados: { direcao: "enviada", statusEntrega: "enviada", ator: { tipo: "member", id: "mem_maryane" } } });
    expect(resposta.body).not.toContain("argaBruta");
    expect(resposta.body).not.toContain("arga_bruta");
  });

  it("POST /mensagens enviada no oficial com recebida de 30 h responde 409 JANELA_EXPIRADA; no não oficial responde 201", async () => {
    // Conversa nova por Canal, para a única recebida ser a de 30 h.
    await receber(ids.suporte.conversaId, "wamid.s1", horasAtras(30));
    const naoOficial = await app().inject({
      method: "POST",
      url: "/mensagens",
      headers: AUTORIZACAO,
      payload: { conversaId: ids.suporte.conversaId, direcao: "enviada", conteudo: "Retornando" },
    });
    expect(naoOficial.statusCode).toBe(201);

    // No oficial, uma recebida MAIS RECENTE reabre a janela; então travamos a conta apagando-a do cenário.
    await pool().query("delete from plataforma.mensagens where workspace_id = $1 and conversa_id = $2 and direcao = 'recebida'", [ws, ids.comercial.conversaId]);
    await receber(ids.comercial.conversaId, "wamid.f2", horasAtras(30));
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
});
