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
import { encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { describeComBanco, prepararBancoCrm } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

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

// F9 — o guarda é o `describeComBanco` (só Postgres local): este arquivo semeia
// dado de teste e, com o `.env` do dono, o guarda antigo mirava o Supabase remoto.
const WS = "ws_estado_teste";

describeComBanco("GET /estado — contra o banco real", () => {
  const tarefa = semente.tasks.find((t) => t.listId === CP.listId);

  beforeAll(async () => {
    await prepararBancoCrm();
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

describeComBanco("GET /estado — vazamento entre Membros (1.1.6, D-01, D-22)", () => {
  let espaco: EspacoDeVazamento;

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("estado");
    await semearEspacoDeVazamento(espaco);
  });

  afterAll(async () => {
    await limparEspacoDeVazamento(espaco);
    await encerrar();
  });

  const pedir = (token: string) =>
    appDoEspaco(espaco).inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${token}` } });

  it("(a) B não recebe a Sessão, a pasta, o texto da conversa, a Memória, a Visão de A, o convite, os segredos nem o Arquivo órfão — e recebe o que é dele", async () => {
    const resposta = await pedir(TOKENS_DE_VAZAMENTO.b);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    // Procura no corpo INTEIRO (string), nunca só em campos escolhidos: um dado pode sair por onde ninguém olhou.
    for (const frase of espaco.frases.a) expect(resposta.body, `frase de A: ${frase}`).not.toContain(frase);
    for (const id of [espaco.ids.a.sessao, espaco.ids.a.pasta, espaco.ids.a.execucao, espaco.ids.a.visao]) {
      expect(resposta.body, `id de A: ${id}`).not.toContain(id);
    }
    expect(resposta.body, "e-mail do convite").not.toContain(espaco.convite.email);
    expect(resposta.body, "segredo do link público").not.toContain(espaco.segredos.link);
    expect(resposta.body, "segredo do Formulário").not.toContain(espaco.segredos.formulario);
    expect(resposta.body, "Arquivo órfão de A").not.toContain(espaco.arquivoOrfao);

    // O que é de B continua chegando: a conversa, a Memória e a Visão dele.
    for (const frase of espaco.frases.b) expect(resposta.body, `frase de B: ${frase}`).toContain(frase);
    expect(resposta.body).toContain(espaco.ids.b.sessao);
    expect(resposta.body).toContain(espaco.ids.b.pasta);
    expect(resposta.body).toContain(espaco.ids.b.visao);

    // A Tarefa do link público chega, com a chave `secret` e o valor vazio (os tipos dizem `secret: string`).
    const corpo = resposta.json() as { data: { tasks: Array<{ id: string; publicShare?: { secret: string } }> } };
    const tarefa = corpo.data.tasks.find((t) => t.id === espaco.segredos.tarefaComLink);
    expect(tarefa, "B alcança a Lista da Tarefa com link público").toBeDefined();
    expect(tarefa?.publicShare?.secret).toBe("");
  });

  it("(b) o Proprietário recebe o e-mail do convite e os segredos da Lista que administra, mas nenhuma frase privada de A nem de B (Pitfall 1)", async () => {
    const resposta = await pedir(TOKENS_DE_VAZAMENTO.proprietario);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    for (const frase of [...espaco.frases.a, ...espaco.frases.b]) expect(resposta.body, `frase: ${frase}`).not.toContain(frase);
    for (const id of [espaco.ids.a.sessao, espaco.ids.b.sessao, espaco.ids.a.pasta, espaco.ids.b.pasta, espaco.ids.a.execucao, espaco.ids.b.execucao]) {
      expect(resposta.body, `id: ${id}`).not.toContain(id);
    }
    // A Visão pessoal também é de quem a salvou, mesmo para o Proprietário.
    expect(resposta.body).not.toContain(espaco.ids.a.visao);
    expect(resposta.body).not.toContain(espaco.ids.b.visao);
    // Quem administra o Espaço lê o que o administrar pede: o e-mail do convite e os segredos.
    expect(resposta.body).toContain(espaco.convite.email);
    expect(resposta.body).toContain(espaco.segredos.link);
    expect(resposta.body).toContain(espaco.segredos.formulario);
  });

  it("(c) o recorte esvazia as coleções de IA pessoal, mas todas as chaves de COLECOES continuam no corpo", async () => {
    const resposta = await pedir(TOKENS_DE_VAZAMENTO.b);
    const corpo = resposta.json() as { data: Record<string, unknown>; ordens: Record<string, Record<string, number>> };
    const chaves = Object.keys(corpo.data);
    for (const colecao of [...COLECOES, ...SINGULARES]) expect(chaves).toContain(colecao);
    // `ordens` também não carrega o id do que saiu (um id também é informação).
    expect(corpo.ordens.chatSessions?.[espaco.ids.a.sessao]).toBeUndefined();
    expect(corpo.ordens.agentExecutions?.[espaco.ids.a.execucao]).toBeUndefined();
    expect(corpo.ordens.views?.[espaco.ids.a.visao]).toBeUndefined();
    expect(corpo.ordens.chatSessions?.[espaco.ids.b.sessao]).toBeTypeOf("number");
  });

  it("(d) R3/F8 — o Arquivo órfão de A dá 404 em GET /anexos/:fileId/url para B; para A, a resposta não é 404", async () => {
    const url = `/anexos/${espaco.arquivoOrfao}/url`;
    const deB = await appDoEspaco(espaco).inject({ method: "GET", url, headers: { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.b}` } });
    expect(deB.statusCode).toBe(404);
    const deA = await appDoEspaco(espaco).inject({ method: "GET", url, headers: { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.a}` } });
    // Passou da autorização: o que vem depois depende do Storage, que este teste não exige.
    expect(deA.statusCode).not.toBe(404);
  });
});
