/**
 * `POST /contatos/:id/mesclar` (14-09, 3.2.2), com serviço falso e sem banco:
 * autenticação, forma do corpo (`.strict()`: o sobrevivente é o caminho, nunca o
 * corpo) e o envelope. A mesclagem contra o Postgres local está em
 * `servicos/crm/mesclagem.test.ts`.
 */

import { describe, expect, it } from "vitest";
import type { ContatoDetalhado } from "@n1/dominio/crm/contatos";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../../app";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { ServicoDeMesclagem } from "../../servicos/crm/mesclagem";

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

const sobrevivente: ContatoDetalhado = {
  contato: {
    id: "b",
    nome: "Marina",
    sobrenome: null,
    dataNascimento: null,
    idioma: null,
    fusoHorario: null,
    fotoUrl: null,
    descricao: null,
    enderecos: [],
    camposAdicionais: {},
    origem: null,
    qualificacao: null,
    modoCriacao: "manual",
    estado: "ativo",
    mescladoEmId: null,
    mescladoEm: null,
    proprietarioId: "mem_maryane",
    criadoPor: "mem_maryane",
    criadoEm: "2026-11-04T00:00:00.000Z",
    atualizadoEm: "2026-11-04T00:00:00.000Z",
  },
  identificadores: [],
  vinculos: [],
};

describe("POST /contatos/:id/mesclar — serviço falso, sem banco", () => {
  function novoFalso(resposta: ResultadoCrm<ContatoDetalhado> = sucesso(sobrevivente)) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeMesclagem = {
      mesclar: (...a) => {
        chamadas.push(a);
        return Promise.resolve(resposta);
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeMesclagem) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { mesclagem: servico } });
  const mesclar = (servico: ServicoDeMesclagem, payload?: Record<string, unknown>, id = "b") =>
    appCom(servico).inject(
      payload === undefined
        ? { method: "POST", url: `/contatos/${id}/mesclar`, headers: AUTORIZACAO }
        : { method: "POST", url: `/contatos/${id}/mesclar`, headers: AUTORIZACAO, payload },
    );

  it("sem Authorization responde 401 e não chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: "/contatos/b/mesclar", payload: { absorvidoId: "a" } });
    expect(resposta.statusCode).toBe(401);
    expect(chamadas).toHaveLength(0);
  });

  it("repassa o Membro da sessão, o sobrevivente do caminho e o absorvido do corpo, e devolve 200 { ok, dados }", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await mesclar(servico, { absorvidoId: "a" });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: sobrevivente });
    expect(chamadas[0]?.[0]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.slice(1)).toEqual(["b", { absorvidoId: "a" }]);
  });

  it.each([
    ["sobreviventeId no corpo", { absorvidoId: "a", sobreviventeId: "c" }],
    ["workspaceId no corpo", { absorvidoId: "a", workspaceId: "ws_de_outro" }],
    ["absorvidoId vazio", { absorvidoId: "" }],
    ["absorvidoId que não é texto", { absorvidoId: 7 }],
    ["corpo sem absorvidoId", {}],
  ])("com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await mesclar(servico, payload);
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("sem corpo responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await mesclar(servico);
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it.each([
    [409, "Só é possível mesclar Contatos ativos ou arquivados.", "MESCLAGEM_RECUSADA", "absorvidoId"],
    [404, "Contato não encontrado.", "CONTATO_NAO_ENCONTRADO", undefined],
    [403, "Seu Papel não pode editar Contatos.", "PERMISSAO", undefined],
  ] as const)("a recusa %i do serviço chega com status e frase, sem nome de constraint", async (status, frase, codigo, campo) => {
    const { servico } = novoFalso(recusa(status, frase, { codigo, ...(campo !== undefined ? { campo } : {}) }));
    const resposta = await mesclar(servico, { absorvidoId: "a" });
    expect(resposta.statusCode).toBe(status);
    expect(resposta.json()).toEqual({ ok: false, error: frase, codigo, ...(campo !== undefined ? { campo } : {}) });
    expect(JSON.stringify(resposta.json())).not.toMatch(/_fk|_uq|_ck|constraint/i);
  });
});
