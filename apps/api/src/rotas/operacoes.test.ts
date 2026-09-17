/**
 * `POST /operacoes/:nome` — a rota genérica sobre `executar()`.
 *
 * A parte sem banco roda sempre (D-DEC-09), injetando `verificarToken`/
 * `resolverMembro` como `autenticacao.test.ts` já faz: prova o despacho por
 * `OPERACOES` (404 fora do registro, `__proto__` nunca resolve), 401/400,
 * sem depender de `DATABASE_URL`. A parte com Postgres real prova o caminho
 * inteiro — sucesso com diff, recusa do domínio em 200, Membro removido em
 * 403 — contra `apps/api/src/persistencia/unidade-de-trabalho.ts`.
 *
 * Os casos (k)–(r) provam CR-02: forma errada é 400 ANTES de `executar()`
 * para TODA operação (sem banco, (k)–(o); com banco, (p)/(q)) — nada chega
 * ao `jsonb`; (r) prova que o caminho feliz continua inteiro.
 * (s) prova WR-10 — o reviver protegido antes de qualquer schema.
 * (t)–(v) fecham a segunda rodada de CR-02 (Plan 01-16): `createGoal` e
 * `saveView` — antes só cobertas pelo fallback estrutural — agora têm
 * schema próprio; nada muda no contrato HTTP em si, só a superfície
 * coberta.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar, semear } from "../persistencia/repositorio";

const MARYANE = usuarioDoSeed("mem_maryane"); // ativo, no seed do Financeiro
const TIAGO = usuarioDoSeed("mem_tiago"); // removido, no seed do CRM

const semente = buildSeed();
const membros = semente.members;

function appDeTeste(workspaceId = "ws_rotas_teste") {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) =>
      token === "token-maryane"
        ? { sub: MARYANE }
        : token === "token-tiago"
          ? { sub: TIAGO }
          : null,
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
  });
}

describe("POST /operacoes/:nome — sem banco", () => {
  it("(a) nome fora do registro responde 404", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/naoExiste",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().ok).toBe(false);
  });

  it("(b) um helper que não é caso de uso (nextId) responde 404 — não está em OPERACOES", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/nextId",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(404);
  });

  it("(c) __proto__ nunca resolve por herança de protótipo — 404 ou 400, nunca 200/500", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/__proto__",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect([400, 404]).toContain(resposta.statusCode);
    expect(resposta.json().ok).toBe(false);
  });

  it("(d) sem token responde 401", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(401);
  });

  it("(e) corpo sem args responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: {},
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(f) args que não é array responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: "x" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(k) updateTask com title:123 responde 400 antes de executar() — nunca 500", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["t1", { title: 123 }] },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error).toBe('Entrada inválida para "updateTask" em 1.title.');
  });

  it("(l) updateTask com description:{} responde 400 antes de executar()", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["t1", { description: {} }] },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error).toContain("em 1.description");
  });

  it("(m) updateTask com chave desconhecida (titulo) responde 400 — .strict()", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["t1", { titulo: "x" }] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(n) runScheduledAutomations com marcador de Date inválido responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/runScheduledAutomations",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["l1", { $tipo: "Date", iso: "isso-nao-e-data" }] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(o) trashTask com argumento a mais responde 400 — tupla fechada", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/trashTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["t1", "a-mais"] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(s) corpo com 10.000 níveis de arrays aninhados em args responde 400 antes de qualquer schema — nunca 500 (WR-10)", async () => {
    // Limiar medido neste repositório: `reviverArgumentos` lança `RangeError`
    // a partir de ~3.000 níveis. 10.000 níveis são 20 KB — 50× abaixo do
    // `bodyLimit` padrão (1 MiB) — e estouram com folga.
    const n = 10000;
    const corpo = `{"args":[${"[".repeat(n)}${"]".repeat(n)}]}`;
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane", "content-type": "application/json" },
      payload: corpo,
    });
    expect(resposta.statusCode).toBe(400);
    const respostaCorpo = resposta.json();
    expect(respostaCorpo.ok).toBe(false);
    expect(respostaCorpo.error).toBe('Entrada inválida para "updateTask".');
  });

  it("(t) createGoal com kind:42 e anchor.lixo responde 400 antes de executar() — a forma que o verificador reproduziu", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createGoal",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [
          { name: "Meta", anchor: { type: "list", id: "lst_ativacao", lixo: { a: [1, 2] } }, kind: 42, target: 10 },
        ],
      },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error.startsWith('Entrada inválida para "createGoal"')).toBe(true);
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_rotas_teste";

d("POST /operacoes/:nome — contra o banco real", () => {
  const tarefaDeContasAPagar = semente.tasks.find(
    (t) => t.listId === CP.listId && t.statusId === CP.status.paraPagar,
  );

  beforeAll(async () => {
    expect(tarefaDeContasAPagar, "o seed precisa ter uma conta em 'para pagar'").toBeDefined();
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

  it("(g) addTaskComment com o Membro da sessão grava e devolve o diff (D-03)", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/addTaskComment",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { content: "Comentário pela rota." }] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.diferenca.gravados.length).toBeLessThanOrEqual(4);
    expect(corpo.diferenca.gravados.some((g: { colecao: string }) => g.colecao === "tasks")).toBe(true);
    expect(corpo.revisao).toBe(corpo.revisaoAnterior + 1);
    expect(corpo.value.content).toBe("Comentário pela rota.");
  });

  it("(h) recusa do domínio (RN-CP-04) responde 200 com ok:false e diff vazio", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/changeTaskStatus",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, CP.status.pago] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(typeof corpo.error).toBe("string");
    expect(corpo.error.length).toBeGreaterThan(0);
    expect(corpo.diferenca.gravados.length).toBe(0);
  });

  it("(i) runScheduledAutomations revive o marcador de Date — nunca 400/500", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/runScheduledAutomations",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [CP.listId, { $tipo: "Date", iso: new Date().toISOString() }] },
    });
    expect(resposta.statusCode).toBe(200);
    expect(typeof resposta.json().ok).toBe("boolean");
  });

  it("(j) Membro removido (Tiago) responde 403 antes de qualquer execução", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/addTaskComment",
      headers: { authorization: "Bearer token-tiago" },
      payload: { args: [tarefaDeContasAPagar!.id, { content: "Não deveria gravar." }] },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it("(p) updateTask com title:123 e description:{} responde 400 e nunca persistido", async () => {
    const clienteAntes = await pool().connect();
    let tituloAntes: string | undefined;
    try {
      const { state } = await hidratar(clienteAntes, WS);
      tituloAntes = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id)?.title;
    } finally {
      clienteAntes.release();
    }

    const respostaTitulo = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { title: 123 }] },
    });
    expect(respostaTitulo.statusCode).toBe(400);

    const respostaDescricao = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { description: {} }] },
    });
    expect(respostaDescricao.statusCode).toBe(400);

    const clienteDepois = await pool().connect();
    try {
      const { state } = await hidratar(clienteDepois, WS);
      const tarefa = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id);
      expect(tarefa?.title).toBe(tituloAntes);
      expect(["string", "undefined"]).toContain(typeof tarefa?.description);
    } finally {
      clienteDepois.release();
    }
  });

  it("(q) createChatFolder com name:123 responde 400 pelo schema — antes de executar(), nada persistido", async () => {
    const clienteAntes = await pool().connect();
    let quantidadeAntes: number;
    try {
      const { state } = await hidratar(clienteAntes, WS);
      quantidadeAntes = state.chatFolders.length;
    } finally {
      clienteAntes.release();
    }

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createChatFolder",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [{ name: 123 }] },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error).toBe('Entrada inválida para "createChatFolder" em 0.name.');

    const clienteDepois = await pool().connect();
    try {
      const { state } = await hidratar(clienteDepois, WS);
      expect(state.chatFolders.length).toBe(quantidadeAntes);
    } finally {
      clienteDepois.release();
    }
  });

  it("(r) updateTask com description válida grava e devolve o diff — o caminho feliz continua inteiro", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { description: "Descrição pela rota." }] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.value.description).toBe("Descrição pela rota.");
    expect(corpo.diferenca.gravados.some((g: { colecao: string }) => g.colecao === "tasks")).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const tarefa = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id);
      expect(tarefa?.description).toBe("Descrição pela rota.");
    } finally {
      cliente.release();
    }
  });

  it("(u) createGoal com kind:42 nunca persistido — state.goals inalterado", async () => {
    const clienteAntes = await pool().connect();
    let quantidadeAntes: number;
    try {
      const { state } = await hidratar(clienteAntes, WS);
      quantidadeAntes = state.goals.length;
    } finally {
      clienteAntes.release();
    }

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createGoal",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [
          { name: "Meta", anchor: { type: "list", id: "lst_ativacao", lixo: { a: [1, 2] } }, kind: 42, target: 10 },
        ],
      },
    });
    expect(resposta.statusCode).toBe(400);

    const clienteDepois = await pool().connect();
    try {
      const { state } = await hidratar(clienteDepois, WS);
      expect(state.goals.length).toBe(quantidadeAntes);
    } finally {
      clienteDepois.release();
    }
  });

  it("(v) saveView com filters arbitrário responde 400 e state.views inalterado; com filters:{} responde 200", async () => {
    const clienteAntes = await pool().connect();
    let quantidadeAntes: number;
    try {
      const { state } = await hidratar(clienteAntes, WS);
      quantidadeAntes = state.views.length;
    } finally {
      clienteAntes.release();
    }

    const respostaHostil = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/saveView",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [
          {
            listId: CP.listId,
            name: "V",
            kind: "lista",
            filters: { qualquer: { coisa: true } },
            shared: false,
          },
        ],
      },
    });
    expect(respostaHostil.statusCode).toBe(400);
    const corpoHostil = respostaHostil.json();
    expect(corpoHostil.ok).toBe(false);
    expect(corpoHostil.error).toContain("em 0.filters");

    const clienteDepois = await pool().connect();
    try {
      const { state } = await hidratar(clienteDepois, WS);
      expect(state.views.length).toBe(quantidadeAntes);
    } finally {
      clienteDepois.release();
    }

    const respostaLegitima = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/saveView",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [{ listId: CP.listId, name: "V", kind: "lista", filters: {}, shared: false }],
      },
    });
    expect(respostaLegitima.statusCode).toBe(200);
    expect(respostaLegitima.json().ok).toBe(true);
  });
});
