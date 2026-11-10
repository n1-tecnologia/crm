/**
 * Rotas REST de Notas do Contato (14-06, 3.2.7), com serviço falso e sem banco:
 * autenticação, forma do corpo (`.strict()`, T-14-13: o autor nunca vem do
 * corpo), tetos de página e o envelope. A gravação contra o Postgres local está
 * em `servicos/crm/notas.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type { NotaDoContato } from "@n1/dominio/crm/notas";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../../app";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeNotas } from "../../servicos/crm/notas";

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

const nota: NotaDoContato = {
  id: "n1",
  contatoId: "c1",
  conteudo: "Pediu retorno.",
  autorId: "mem_maryane",
  criadoEm: "2026-11-04T00:00:00.000Z",
};

describe("rotas de Notas do Contato — serviço falso, sem banco", () => {
  /** Serviço falso: registra `[método, ...argumentos]` e devolve `respostas[método]` ou o padrão. */
  function novoFalso(respostas: Partial<Record<keyof ServicoDeNotas, ResultadoCrm<unknown>>> = {}) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeNotas = {
      listar: (...a) => {
        chamadas.push(["listar", ...a]);
        return Promise.resolve((respostas.listar ?? sucesso({ itens: [nota], total: 1 })) as never);
      },
      adicionar: (...a) => {
        chamadas.push(["adicionar", ...a]);
        return Promise.resolve((respostas.adicionar ?? sucesso(nota)) as never);
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeNotas) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { notas: servico } });

  it("GET /contatos/c1/notas sem Authorization responde 401", async () => {
    const resposta = await appCom(novoFalso().servico).inject({ method: "GET", url: "/contatos/c1/notas" });
    expect(resposta.statusCode).toBe(401);
  });

  it("GET /contatos/c1/notas devolve { ok, itens, total } e repassa a página padrão", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/contatos/c1/notas", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [nota], total: 1 });
    expect(chamadas[0]?.slice(2)).toEqual(["c1", { limite: LIMITES_CRM.paginaPadrao, deslocamento: 0 }]);
  });

  it.each([
    ["limite acima do teto", `limite=${LIMITES_CRM.paginaMaxima + 1}`],
    ["limite zero", "limite=0"],
    ["deslocamento negativo", "deslocamento=-1"],
    ["estado (a nota não tem estado)", "estado=ativo"],
  ])("GET com %s responde 400 e não chega ao serviço", async (_rotulo, consulta) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: `/contatos/c1/notas?${consulta}`, headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it("POST grava pelo serviço com o Membro da sessão e responde 201 { ok, dados }", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/contatos/c1/notas",
      headers: AUTORIZACAO,
      payload: { conteudo: "Pediu retorno." },
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({ ok: true, dados: nota });
    expect(chamadas[0]?.[0]).toBe("adicionar");
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.slice(2)).toEqual(["c1", { conteudo: "Pediu retorno." }]);
  });

  it.each([
    ["autorId (T-14-13)", { conteudo: "x", autorId: "mem_outro" }],
    ["workspaceId", { conteudo: "x", workspaceId: "ws_de_outro" }],
    ["contatoId no corpo", { conteudo: "x", contatoId: "c2" }],
    ["conteudo só com espaços", { conteudo: "   " }],
    ["conteudo acima do teto", { conteudo: "a".repeat(LIMITES_CRM.textoLongo + 1) }],
    ["corpo sem conteudo", {}],
  ])("POST com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: "/contatos/c1/notas", headers: AUTORIZACAO, payload });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("a recusa do serviço chega com status, codigo e campo intactos", async () => {
    const { servico } = novoFalso({
      adicionar: recusa(409, "Um Contato mesclado é somente leitura.", { codigo: "NOTA_RECUSADA" }),
    });
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/contatos/c1/notas",
      headers: AUTORIZACAO,
      payload: { conteudo: "x" },
    });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({ ok: false, error: "Um Contato mesclado é somente leitura.", codigo: "NOTA_RECUSADA" });
  });
});
