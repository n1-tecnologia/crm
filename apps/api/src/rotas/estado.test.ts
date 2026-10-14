/**
 * `GET /estado` — a carga inicial (D-04). Sem banco: só a checagem de que a
 * rota também exige sessão (o hook de autenticação já cobre 401/403 em
 * detalhe em `autenticacao.test.ts`). Com Postgres real: prova que o corpo
 * tem a forma exata que `apps/web/src/dados/transporte.ts` espera.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed, COLECOES, SINGULARES } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import { estadoVisivelPara, visibilidadePara } from "@n1/dominio/derive-visibilidade";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";

const MARYANE = usuarioDoSeed("mem_maryane");
const semente = buildSeed();
const membros = semente.members;

/** PRIV-03 — um Membro ativo que não enxerga NADA de Gestão (o Espaço privado do seed): sem concessão e sem Tarefa que o nomeie. */
const SEM_GESTAO = usuarioDoSeed(
  (() => {
    const m = semente.members.find((x) => x.state === "ativo" && x.userId && visibilidadePara(semente, x.id).ocultos.has(CP.spaceId));
    if (!m) throw new Error("o seed precisa de um Membro ativo, com usuário, que não enxergue Gestão");
    return m.id;
  })(),
);

function appDeTeste(workspaceId: string) {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) => (token === "token-maryane" ? { sub: MARYANE } : token === "token-sem-gestao" ? { sub: SEM_GESTAO } : null),
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
  });
}

describe("GET /estado — sem banco", () => {
  it("sem token responde 401 (roda sempre, sem DATABASE_URL)", async () => {
    const resposta = await appDeTeste("ws_estado_teste").inject({ method: "GET", url: "/estado" });
    expect(resposta.statusCode).toBe(401);
  });
});

describe("GET /estado/revisao — sem banco", () => {
  it("sem token responde 401 (checklist E2: a revisão também é do Espaço de quem tem sessão)", async () => {
    const resposta = await appDeTeste("ws_estado_teste").inject({ method: "GET", url: "/estado/revisao" });
    expect(resposta.statusCode).toBe(401);
  });
});

describe("GET /anexos/:fileId/url — sem banco", () => {
  it("sem token responde 401 (o hook de autenticação cobre toda rota deste módulo, Plan 02-19)", async () => {
    const resposta = await appDeTeste("ws_estado_teste").inject({ method: "GET", url: "/anexos/wf_qualquer/url" });
    expect(resposta.statusCode).toBe(401);
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_estado_teste";

d("GET /estado — contra o banco real", () => {
  const tarefa = semente.tasks.find((t) => t.listId === CP.listId);

  beforeAll(async () => {
    expect(tarefa, "o seed precisa ter alguma Tarefa de Contas a pagar").toBeDefined();
    // POSC-08 — um Arquivo anexado a uma conta de Gestão: baixa quem vê a conta.
    semente.files.push({
      id: "wf_teste_gestao",
      workspaceId: semente.workspace.id,
      name: "boleto.pdf",
      mediaType: "document",
      sizeBytes: 10,
      createdBy: { kind: "member", id: "mem_maryane" },
      createdAt: new Date().toISOString(),
      objectKey: "privado/teste/wf_teste_gestao.pdf",
      state: "enviado",
    });
    tarefa!.attachments.push({ fileId: "wf_teste_gestao", order: tarefa!.attachments.length, mediaType: "document", displayName: "boleto.pdf" });
    // FUND-07 — um anexo de protótipo (attachFile antigo): nada subiu, nada a baixar.
    semente.files.push({
      id: "wf_teste_legado",
      workspaceId: semente.workspace.id,
      name: "rascunho.pdf",
      mediaType: "document",
      sizeBytes: 10,
      createdBy: { kind: "member", id: "mem_maryane" },
      createdAt: new Date().toISOString(),
      objectKey: "legado/wf_teste_legado",
      state: "enviado",
    });
    tarefa!.attachments.push({ fileId: "wf_teste_legado", order: tarefa!.attachments.length, mediaType: "document", displayName: "rascunho.pdf" });
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
      await semear(cliente, WS, semente);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it("devolve o Espaço inteiro, a revisão, as ordens e a sessão do Membro (D-04)", async () => {
    const resposta = await appDeTeste(WS).inject({
      method: "GET",
      url: "/estado",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();

    expect(corpo.sessao.memberId).toBe("mem_maryane");
    expect(typeof corpo.revisao).toBe("number");

    const chaves = Object.keys(corpo.data);
    for (const colecao of [...COLECOES, ...SINGULARES]) {
      expect(chaves).toContain(colecao);
    }

    expect(typeof corpo.ordens.tasks[tarefa!.id]).toBe("number");
    // PRIV-03 — o que chega é o que a Maryane alcança (ela não alcança todo Espaço privado do seed), nunca mais que isso.
    expect(corpo.data.tasks.length).toBe(estadoVisivelPara(semente, "mem_maryane").tasks.length);
    expect(corpo.data.tasks.length).toBeLessThanOrEqual(semente.tasks.length);
  });

  it("PRIV-03 — quem não alcança Gestão não recebe o Espaço privado, as Listas nem as Tarefas dele; e recebe `sequencia` do estado inteiro", async () => {
    const resposta = await appDeTeste(WS).inject({
      method: "GET",
      url: "/estado",
      headers: { authorization: "Bearer token-sem-gestao" },
    });
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    const corpo = resposta.json() as {
      data: { spaces: Array<{ id: string }>; lists: Array<{ id: string }>; tasks: Array<{ listId: string }> };
      ordens: Record<string, Record<string, number>>;
      sequencia: number;
    };
    expect(corpo.data.spaces.some((s) => s.id === CP.spaceId)).toBe(false);
    expect(corpo.data.lists.some((l) => l.id === CP.listId)).toBe(false);
    expect(corpo.data.tasks.some((t) => t.listId === CP.listId)).toBe(false);
    expect(corpo.data.tasks.length).toBeLessThan(semente.tasks.length);
    expect(corpo.ordens.tasks?.[tarefa!.id]).toBeUndefined();
    expect(typeof corpo.sequencia).toBe("number");
    expect(corpo.sequencia).toBeGreaterThan(0);
    // Maryane (Financeiro, com concessão) continua recebendo o Espaço inteiro.
    const completo = (await appDeTeste(WS).inject({ method: "GET", url: "/estado", headers: { authorization: "Bearer token-maryane" } })).json() as { data: { tasks: Array<{ listId: string }> }; sequencia: number };
    expect(completo.data.tasks.filter((t) => t.listId === CP.listId).length).toBe(semente.tasks.filter((t) => t.listId === CP.listId).length);
    expect(completo.data.tasks.length).toBeGreaterThan(corpo.data.tasks.length);
    // O contador de ids é do estado INTEIRO: igual para os dois, por mais que cada um receba uma fatia.
    expect(completo.sequencia).toBe(corpo.sequencia);
  });

  it("GET /estado/revisao devolve a mesma revisão do /estado, e só ela (checklist E2)", async () => {
    const headers = { authorization: "Bearer token-maryane" };
    const estado = (await appDeTeste(WS).inject({ method: "GET", url: "/estado", headers })).json() as { revisao: number };
    const resposta = await appDeTeste(WS).inject({ method: "GET", url: "/estado/revisao", headers });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ revisao: estado.revisao });
  });

  it("POSC-08 — GET /anexos/:fileId/url autoriza por Tarefa: quem não vê a conta de Gestão recebe 404; quem vê, não", async () => {
    const escondido = await appDeTeste(WS).inject({ method: "GET", url: "/anexos/wf_teste_gestao/url", headers: { authorization: "Bearer token-sem-gestao" } });
    expect(escondido.statusCode).toBe(404);
    const financeiro = await appDeTeste(WS).inject({ method: "GET", url: "/anexos/wf_teste_gestao/url", headers: { authorization: "Bearer token-maryane" } });
    // Passou da autorização: o que vem depois depende do Storage, que este teste não exige.
    expect(financeiro.statusCode).not.toBe(404);
  });

  it("FUND-07 — GET /anexos/:fileId/url de um anexo de protótipo (legado/<id>) responde 409 sem tocar o Storage", async () => {
    const resposta = await appDeTeste(WS).inject({ method: "GET", url: "/anexos/wf_teste_legado/url", headers: { authorization: "Bearer token-maryane" } });
    expect(resposta.statusCode).toBe(409);
    expect((resposta.json() as { error: string }).error).toContain("sem conteúdo");
  });

  it("GET /anexos/:fileId/url — Arquivo inexistente no Espaço responde 404 (Plan 02-19)", async () => {
    const resposta = await appDeTeste(WS).inject({
      method: "GET",
      url: "/anexos/wf_nao_existe/url",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(404);
  });
});
