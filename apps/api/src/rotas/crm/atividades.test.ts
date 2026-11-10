/**
 * Rota GET /atividades (15-37, D-15-09, UCR-03), com serviço falso e sem banco:
 * autenticação, forma do pedido (`.strict()`: nenhum ator, ação ou Espaço vem de
 * fora), teto de página, objeto pela metade e o envelope. A leitura contra o
 * Postgres local, por Espaço e Papel, está em `servicos/crm/atividades.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { LIMITES_DE_ATIVIDADE } from "@n1/dominio/crm/atividades";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { ActivityRecord } from "@n1/dominio/types/primitives";
import { buildApp } from "../../app";
import type { ServicoDeAtividades } from "../../servicos/crm/atividades";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";

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

const atividade: ActivityRecord = {
  id: "3f1e0c8e-6a52-4d57-9d0e-3a2d8f1d9a11",
  workspaceId: "ws_falso",
  actor: { kind: "member", id: "mem_maryane" },
  action: "Nota registrada no Contato",
  objectType: "contact",
  objectId: "c1",
  objectName: "Ana",
  at: "2026-11-05T10:00:00.000Z",
  result: "ok",
};

describe("rota GET /atividades — serviço falso, sem banco", () => {
  /** Serviço falso: registra `[membro, filtro]` e devolve a resposta dada ou a padrão. */
  function novoFalso(resposta: ResultadoCrm<ActivityRecord[]> = sucesso([atividade])) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeAtividades = {
      listar: (...a) => {
        chamadas.push(a);
        return Promise.resolve(resposta);
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeAtividades) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { atividades: servico } });

  it("sem Authorization responde 401 e não chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/atividades?objetoTipo=contact&objetoId=c1" });
    expect(resposta.statusCode).toBe(401);
    expect(chamadas).toHaveLength(0);
  });

  it("devolve { ok, itens } e repassa o Membro da sessão e o filtro com a página padrão", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "GET",
      url: "/atividades?objetoTipo=contact&objetoId=c1",
      headers: AUTORIZACAO,
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [atividade] });
    expect(chamadas[0]?.[0]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[1]).toEqual({ objetoTipo: "contact", objetoId: "c1", limite: LIMITES_DE_ATIVIDADE.paginaPadrao });
  });

  it("sem objeto, com limite e cursor `ate`, repassa só o que veio", async () => {
    const { servico, chamadas } = novoFalso();
    const ate = "2026-11-05T10:00:00.000Z";
    const resposta = await appCom(servico).inject({
      method: "GET",
      url: `/atividades?limite=${LIMITES_DE_ATIVIDADE.paginaMaxima}&ate=${encodeURIComponent(ate)}`,
      headers: AUTORIZACAO,
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.[1]).toEqual({ limite: LIMITES_DE_ATIVIDADE.paginaMaxima, ate });
  });

  it("o cursor composto (`ate` + `ateId`, 15-09) chega ao serviço inteiro", async () => {
    const { servico, chamadas } = novoFalso();
    const ate = "2026-11-05T10:00:00.123Z";
    const resposta = await appCom(servico).inject({
      method: "GET",
      url: `/atividades?ate=${encodeURIComponent(ate)}&ateId=3f1e0c8e-6a52-4d57-9d0e-3a2d8f1d9a11`,
      headers: AUTORIZACAO,
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.[1]).toEqual({ limite: LIMITES_DE_ATIVIDADE.paginaPadrao, ate, ateId: "3f1e0c8e-6a52-4d57-9d0e-3a2d8f1d9a11" });
  });

  it.each([
    ["limite acima do teto (T-15-89)", `limite=${LIMITES_DE_ATIVIDADE.paginaMaxima + 1}`],
    ["limite zero", "limite=0"],
    ["limite fracionário", "limite=1.5"],
    ["objetoTipo sem objetoId", "objetoTipo=contact"],
    ["objetoId sem objetoTipo", "objetoId=c1"],
    ["objetoTipo fora do vocabulário", "objetoTipo=grupo&objetoId=g1"],
    ["ate que não é um instante", "ate=ontem"],
    ["ateId sem ate (o desempate precisa do instante)", "ateId=abc"],
    ["ator (a Atividade só lê)", "ator=mem_outro"],
    ["acao (a Atividade só lê)", "acao=Contato%20editado"],
    ["workspaceId (o Espaço é o da sessão)", "workspaceId=ws_de_outro"],
    ["parâmetro desconhecido", "qualquerCoisa=1"],
  ])("com %s responde 400 e não chega ao serviço", async (_rotulo, consulta) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: `/atividades?${consulta}`, headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("a recusa do serviço (403 de Papel) chega com status, codigo e frase intactos", async () => {
    const { servico } = novoFalso(recusa(403, "Só um Membro ativo ou suspenso consulta o CRM.", { codigo: "PERMISSAO" }));
    const resposta = await appCom(servico).inject({ method: "GET", url: "/atividades", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({ ok: false, error: "Só um Membro ativo ou suspenso consulta o CRM.", codigo: "PERMISSAO" });
  });

  it("só existe GET: POST, PATCH, PUT e DELETE em /atividades não são rota", async () => {
    const { servico, chamadas } = novoFalso();
    const app = appCom(servico);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"] as const) {
      const resposta = await app.inject({ method, url: "/atividades", headers: AUTORIZACAO, ...(method === "DELETE" ? {} : { payload: {} }) });
      expect(resposta.statusCode, method).toBe(404);
    }
    expect(chamadas).toHaveLength(0);
  });
});
