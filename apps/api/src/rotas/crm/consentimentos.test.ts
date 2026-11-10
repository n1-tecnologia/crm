/**
 * Rotas REST de Consentimentos do Contato (14-08, 3.2.4), com serviço falso e
 * sem banco: autenticação, forma do corpo (`.strict()`, T-14-19: o registrador
 * nunca vem do corpo) e o envelope. A gravação contra o Postgres local está em
 * `servicos/crm/consentimentos.test.ts`.
 */

import { describe, expect, it } from "vitest";
import type { ConsentimentoDoContato } from "@n1/dominio/crm/consentimentos";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../../app";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeConsentimentos } from "../../servicos/crm/consentimentos";

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

const consentimento: ConsentimentoDoContato = {
  id: "cc1",
  contatoId: "c1",
  finalidadeId: "cat_fin_mkt",
  tipoDeCanal: "whatsapp",
  decisao: "concedido",
  em: "2026-11-04T00:00:00.000Z",
  origem: "formulario",
  evidenciaMensagemId: null,
  registradoPor: "mem_maryane",
  registradoEm: "2026-11-04T00:00:01.000Z",
};

const corpo = { finalidadeId: "cat_fin_mkt", tipoDeCanal: "whatsapp", decisao: "concedido", origem: "formulario" };

describe("rotas de Consentimentos do Contato — serviço falso, sem banco", () => {
  function novoFalso(respostas: Partial<Record<keyof ServicoDeConsentimentos, ResultadoCrm<unknown>>> = {}) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeConsentimentos = {
      listar: (...a) => {
        chamadas.push(["listar", ...a]);
        return Promise.resolve((respostas.listar ?? sucesso({ itens: [consentimento], total: 1 })) as never);
      },
      registrar: (...a) => {
        chamadas.push(["registrar", ...a]);
        return Promise.resolve((respostas.registrar ?? sucesso(consentimento)) as never);
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeConsentimentos) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { consentimentos: servico } });

  it("GET /contatos/c1/consentimentos sem Authorization responde 401", async () => {
    const resposta = await appCom(novoFalso().servico).inject({ method: "GET", url: "/contatos/c1/consentimentos" });
    expect(resposta.statusCode).toBe(401);
  });

  it("GET devolve { ok, itens, total } e chama o serviço com o Membro da sessão", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/contatos/c1/consentimentos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [consentimento], total: 1 });
    expect(chamadas[0]?.[0]).toBe("listar");
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[2]).toBe("c1");
  });

  it("POST grava pelo serviço com o Membro da sessão e responde 201 { ok, dados }", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/contatos/c1/consentimentos",
      headers: AUTORIZACAO,
      payload: { ...corpo, em: "2026-11-01T10:00:00.000Z", evidenciaMensagemId: "m1" },
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({ ok: true, dados: consentimento });
    expect(chamadas[0]?.[0]).toBe("registrar");
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.slice(2)).toEqual(["c1", { ...corpo, em: "2026-11-01T10:00:00.000Z", evidenciaMensagemId: "m1" }]);
  });

  it.each([
    ["decisão fora do vocabulário", { ...corpo, decisao: "talvez" }],
    ["origem fora do vocabulário", { ...corpo, origem: "telepatia" }],
    ["tipo de Canal fora do vocabulário", { ...corpo, tipoDeCanal: "fax" }],
    ["registradoPor no corpo (T-14-19)", { ...corpo, registradoPor: "mem_outro" }],
    ["registradoEm no corpo", { ...corpo, registradoEm: "2020-01-01T00:00:00.000Z" }],
    ["workspaceId no corpo", { ...corpo, workspaceId: "ws_de_outro" }],
    ["contatoId no corpo", { ...corpo, contatoId: "c2" }],
    ["em que não é data e hora", { ...corpo, em: "ontem" }],
    ["corpo sem finalidadeId", { tipoDeCanal: "whatsapp", decisao: "concedido", origem: "formulario" }],
    ["finalidadeId vazia", { ...corpo, finalidadeId: "" }],
  ])("POST com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: "/contatos/c1/consentimentos", headers: AUTORIZACAO, payload });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("a recusa do serviço chega com status, codigo e campo intactos", async () => {
    const { servico } = novoFalso({
      registrar: recusa(400, "Escolha a finalidade do consentimento.", { codigo: "VALOR_INVALIDO", campo: "finalidadeId" }),
    });
    const resposta = await appCom(servico).inject({ method: "POST", url: "/contatos/c1/consentimentos", headers: AUTORIZACAO, payload: corpo });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ ok: false, error: "Escolha a finalidade do consentimento.", codigo: "VALOR_INVALIDO", campo: "finalidadeId" });
  });

  it("não existe rota de edição nem de exclusão (T-14-19)", async () => {
    const app = appCom(novoFalso().servico);
    for (const method of ["PUT", "PATCH", "DELETE"] as const) {
      const resposta = await app.inject({ method, url: "/contatos/c1/consentimentos/cc1", headers: AUTORIZACAO, payload: method === "DELETE" ? undefined : corpo });
      expect(resposta.statusCode).toBe(404);
    }
  });
});
