/**
 * Rota POST /crm/nomes (15-10, 3.4.9 e 3.4.10, UCR-08), com serviço falso e sem banco:
 * autenticação, forma do corpo (`.strict()`: o Espaço e o nome nunca vêm de fora), o teto
 * do lote (T-15-30) e o envelope. A leitura contra o Postgres local, por Espaço e Papel,
 * está em `servicos/crm/nomes.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { NOMES_MAXIMO, type AlvoDoCrm, type NomeDoAlvo } from "@n1/dominio/crm/nomes";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../../app";
import type { ServicoDeNomes } from "../../servicos/crm/nomes";
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

describe("rota POST /crm/nomes — serviço falso, sem banco", () => {
  /** Serviço falso: registra `[membro, alvos]` e devolve a resposta dada ou um nome por alvo. */
  function novoFalso(resposta?: ResultadoCrm<readonly NomeDoAlvo[]>) {
    const chamadas: [unknown, readonly AlvoDoCrm[]][] = [];
    const servico: ServicoDeNomes = {
      nomes: (membro, alvos) => {
        chamadas.push([membro, alvos]);
        return Promise.resolve(resposta ?? sucesso(alvos.map((alvo) => ({ ...alvo, nome: `Nome de ${alvo.id}` }))));
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeNomes) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { nomes: servico } });
  const pedir = (servico: ServicoDeNomes, corpo: unknown, headers: Record<string, string> = AUTORIZACAO) =>
    appCom(servico).inject({ method: "POST", url: "/crm/nomes", headers, payload: corpo as object });

  it("sem Authorization responde 401 e não chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await pedir(servico, { alvos: [{ tipo: "contact", id: "c1" }] }, {});
    expect(resposta.statusCode).toBe(401);
    expect(chamadas).toHaveLength(0);
  });

  it("devolve { ok, itens, total } na ordem pedida e repassa o Membro da sessão e os alvos", async () => {
    const { servico, chamadas } = novoFalso();
    const alvos: AlvoDoCrm[] = [
      { tipo: "deal", id: "n1" },
      { tipo: "contact", id: "c1" },
    ];
    const resposta = await pedir(servico, { alvos });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      ok: true,
      itens: [
        { tipo: "deal", id: "n1", nome: "Nome de n1" },
        { tipo: "contact", id: "c1", nome: "Nome de c1" },
      ],
      total: 2,
    });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.[0]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[1]).toEqual(alvos);
  });

  it("o nome null do serviço viaja como null no item (id desconhecido, de outro Espaço ou tipo negado)", async () => {
    const { servico } = novoFalso(sucesso([{ tipo: "funnel", id: "f1", nome: null }]));
    const resposta = await pedir(servico, { alvos: [{ tipo: "funnel", id: "f1" }] });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [{ tipo: "funnel", id: "f1", nome: null }], total: 1 });
  });

  it("lista vazia é aceita e chega ao serviço (que responde sem banco)", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await pedir(servico, { alvos: [] });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [], total: 0 });
    expect(chamadas).toHaveLength(1);
  });

  it(`exatamente ${NOMES_MAXIMO} alvos passam`, async () => {
    const { servico, chamadas } = novoFalso();
    const alvos = Array.from({ length: NOMES_MAXIMO }, (_, i) => ({ tipo: "contact", id: `c-${i}` }));
    const resposta = await pedir(servico, { alvos });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().total).toBe(NOMES_MAXIMO);
    expect(chamadas[0]?.[1]).toHaveLength(NOMES_MAXIMO);
  });

  it.each([
    [`${NOMES_MAXIMO + 1} alvos`, { alvos: Array.from({ length: NOMES_MAXIMO + 1 }, (_, i) => ({ tipo: "contact", id: `c-${i}` })) }],
    ["tipo desconhecido", { alvos: [{ tipo: "tarefa", id: "t1" }] }],
    ["tipo ausente", { alvos: [{ id: "c1" }] }],
    ["id vazio", { alvos: [{ tipo: "contact", id: "" }] }],
    ["id comprido demais", { alvos: [{ tipo: "contact", id: "x".repeat(65) }] }],
    ["campo a mais no alvo (nome vindo de fora)", { alvos: [{ tipo: "contact", id: "c1", nome: "Falso" }] }],
    ["campo a mais no corpo (workspaceId)", { alvos: [{ tipo: "contact", id: "c1" }], workspaceId: "ws_de_outro" }],
    ["sem alvos", {}],
    ["alvos que não é lista", { alvos: "contact:c1" }],
  ])("%s responde 400 e não chega ao serviço", async (_rotulo, corpo) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await pedir(servico, corpo);
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it("a recusa do serviço sai com o status e o envelope de erro", async () => {
    const { servico } = novoFalso(recusa<never>(400, "Os nomes aceitam até 200 alvos por chamada.", { codigo: "VALOR_INVALIDO", campo: "alvos" }));
    const resposta = await pedir(servico, { alvos: [{ tipo: "contact", id: "c1" }] });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ ok: false, error: "Os nomes aceitam até 200 alvos por chamada.", codigo: "VALOR_INVALIDO", campo: "alvos" });
  });
});
