/**
 * `GET /membros/:id/sucessao-no-crm` (14-10, 3.2.8), com serviço falso e sem
 * banco: autenticação, forma do parâmetro, o envelope e as recusas do serviço.
 * As contagens e o Papel contra o Postgres local estão em
 * `servicos/crm/sucessao.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../../app";
import type { SucessaoNoCrm } from "../../repositorios/crm/sucessao";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeSucessao } from "../../servicos/crm/sucessao";

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

const contagens: SucessaoNoCrm = { contatos: 2, empresas: 1, negocios: 1, conversasLiberadas: 1 };

describe("rota da sucessão no CRM — serviço falso, sem banco", () => {
  function novoFalso(resposta: ResultadoCrm<SucessaoNoCrm> = sucesso(contagens)) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeSucessao = {
      previa: (...a) => {
        chamadas.push(a);
        return Promise.resolve(resposta);
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeSucessao) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { sucessao: servico } });

  it("sem Authorization responde 401", async () => {
    const resposta = await appCom(novoFalso().servico).inject({ method: "GET", url: "/membros/mem_x/sucessao-no-crm" });
    expect(resposta.statusCode).toBe(401);
  });

  it("devolve { ok, dados } com as quatro contagens e repassa o Membro da sessão e o id da rota", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/membros/mem_x/sucessao-no-crm", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: contagens });
    expect(chamadas[0]?.[0]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[1]).toBe("mem_x");
  });

  it("a recusa do serviço chega com status, codigo e frase intactos (403 e 404)", async () => {
    const frase = "Só um Administrador ou o Proprietário ativo vê a sucessão de um Membro.";
    const negado = await appCom(novoFalso(recusa<SucessaoNoCrm>(403, frase, { codigo: "PERMISSAO" })).servico).inject({
      method: "GET",
      url: "/membros/mem_x/sucessao-no-crm",
      headers: AUTORIZACAO,
    });
    expect(negado.statusCode).toBe(403);
    expect(negado.json()).toEqual({ ok: false, error: frase, codigo: "PERMISSAO" });

    const ausente = await appCom(novoFalso(recusa(404, "Membro não encontrado.", { codigo: "MEMBRO_NAO_ENCONTRADO" })).servico).inject({
      method: "GET",
      url: "/membros/mem_x/sucessao-no-crm",
      headers: AUTORIZACAO,
    });
    expect(ausente.statusCode).toBe(404);
    expect(ausente.json().codigo).toBe("MEMBRO_NAO_ENCONTRADO");
  });

  it("um id grande demais responde 400 e não chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: `/membros/${"x".repeat(65)}/sucessao-no-crm`, headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });
});
