/**
 * Rotas REST de Conversa (08-06), com um serviço falso injetado por
 * `buildApp({ crm: { conversas } })` (sem banco): autenticação, forma do corpo
 * (`.strict()`, inclusive o objeto `mensagem` aninhado — T-08-26), filtros da
 * lista, ações sem corpo e o envelope do 409 com `bloqueios.conversas`.
 */

import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { Conversa, ConversaDetalhada } from "@n1/dominio/crm/conversas";
import { buildApp } from "../../app";
import { sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeConversas } from "../../servicos/crm/conversas";

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

const DETALHE = { conversa: { id: "v1" } as Conversa, canal: { id: "c1" } } as unknown as ConversaDetalhada;

describe("rotas de Conversas — serviço falso, sem banco", () => {
  function novoFalso(devolve?: ResultadoCrm<ConversaDetalhada>) {
    const chamadas: unknown[][] = [];
    const resposta = () => Promise.resolve(devolve ?? sucesso(DETALHE));
    const servico: ServicoDeConversas = {
      listar: (...a) => {
        chamadas.push(["listar", ...a]);
        return Promise.resolve(sucesso({ itens: [], total: 0 }));
      },
      obter: (...a) => {
        chamadas.push(["obter", ...a]);
        return resposta();
      },
      criar: (...a) => {
        chamadas.push(["criar", ...a]);
        return Promise.resolve(
          devolve && !devolve.ok ? devolve : sucesso({ ...DETALHE, primeiraMensagem: { id: "m1" } as never }),
        );
      },
      resolver: (...a) => {
        chamadas.push(["resolver", ...a]);
        return resposta();
      },
      reabrir: (...a) => {
        chamadas.push(["reabrir", ...a]);
        return resposta();
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeConversas) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { conversas: servico } });
  const corpoValido = { canalId: "c1", contatoId: "p1", mensagem: { conteudo: "oi" } };

  it("(a) GET /conversas sem Authorization responde 401", async () => {
    const resposta = await appCom(novoFalso().servico).inject({ method: "GET", url: "/conversas" });
    expect(resposta.statusCode).toBe(401);
  });

  it.each(["situacao", "estado", "atribuido", "criadoPor", "workspaceId"])(
    "(b) POST /conversas com %s no corpo responde 400 e o serviço não é chamado",
    async (campo) => {
      const { servico, chamadas } = novoFalso();
      const resposta = await appCom(servico).inject({
        method: "POST",
        url: "/conversas",
        headers: AUTORIZACAO,
        payload: { ...corpoValido, [campo]: "x" },
      });
      expect(resposta.statusCode).toBe(400);
      expect(chamadas).toEqual([]);
    },
  );

  it("(c) mensagem com direcao no objeto aninhado responde 400 (o aninhado é .strict())", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/conversas",
      headers: AUTORIZACAO,
      payload: { ...corpoValido, mensagem: { conteudo: "oi", direcao: "recebida" } },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("POST /conversas sem mensagem ou com conteúdo vazio responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    const semMensagem = await app.inject({ method: "POST", url: "/conversas", headers: AUTORIZACAO, payload: { canalId: "c1", contatoId: "p1" } });
    const vazio = await app.inject({
      method: "POST",
      url: "/conversas",
      headers: AUTORIZACAO,
      payload: { ...corpoValido, mensagem: { conteudo: "   " } },
    });
    expect(semMensagem.statusCode).toBe(400);
    expect(vazio.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("POST /conversas válido responde 201 com o Membro da sessão e o corpo repassado", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: "/conversas", headers: AUTORIZACAO, payload: corpoValido });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toMatchObject({ ok: true, dados: { conversa: { id: "v1" }, primeiraMensagem: { id: "m1" } } });
    expect(chamadas[0]?.[0]).toBe("criar");
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[2]).toEqual(corpoValido);
  });

  it("(d) GET /conversas?estado=arquivado responde 400: Conversa só tem ativo e na_lixeira", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/conversas?estado=arquivado", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("GET /conversas repassa canalId, contatoId e situacao, e rejeita situacao desconhecida", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    const ok = await app.inject({ method: "GET", url: "/conversas?canalId=c1&contatoId=p1&situacao=pendente", headers: AUTORIZACAO });
    expect(ok.statusCode).toBe(200);
    expect(chamadas[0]?.[2]).toEqual({ estado: "ativo", limite: 50, deslocamento: 0, canalId: "c1", contatoId: "p1", situacao: "pendente" });
    const ruim = await app.inject({ method: "GET", url: "/conversas?situacao=talvez", headers: AUTORIZACAO });
    expect(ruim.statusCode).toBe(400);
  });

  it("GET /conversas?limite=201 responde 400 (teto da página, T-08-28)", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/conversas?limite=201", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it.each(["resolver", "reabrir"])("(e) POST /conversas/x/%s sem corpo e sem content-type responde 200 e chama o serviço", async (acao) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: `/conversas/x/${acao}`, headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ ok: true, dados: { conversa: { id: "v1" } } });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.[0]).toBe(acao);
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[2]).toBe("x");
  });

  it("GET /conversas/x chama obter com o id", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/conversas/x", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.[0]).toBe("obter");
    expect(chamadas[0]?.[2]).toBe("x");
  });

  it("(f) um 409 CONVERSA_JA_ABERTA do serviço sai no envelope com bloqueios.conversas", async () => {
    const bloqueios = { conversas: { total: 1, itens: [{ id: "v9", titulo: "Ana" }] } };
    const { servico } = novoFalso({
      ok: false,
      status: 409,
      error: "Este Contato já tem uma Conversa aberta neste Canal.",
      codigo: "CONVERSA_JA_ABERTA",
      bloqueios,
    });
    const resposta = await appCom(servico).inject({ method: "POST", url: "/conversas", headers: AUTORIZACAO, payload: corpoValido });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({
      ok: false,
      error: "Este Contato já tem uma Conversa aberta neste Canal.",
      codigo: "CONVERSA_JA_ABERTA",
      bloqueios,
    });
  });

  it("não há DELETE /conversas/:id nesta fase", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "DELETE", url: "/conversas/x", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(404);
    expect(chamadas).toEqual([]);
  });
});
