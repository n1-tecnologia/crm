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
 * (t)–(v) fecham a segunda rodada de CR-02 (Plan 01-16): `saveView` e as
 * demais — antes só cobertas pelo fallback estrutural — agora têm
 * schema próprio; nada muda no contrato HTTP em si, só a superfície
 * coberta.
 * (w)–(x) provam a costura de AUTO-02 (05-07, Task 2; migrado para a
 * Solicitação em 05-17/CR-05): a Automação de Canal publicada em
 * `CANAL_LISTA_ID` (Solicitações de pagamento) dispara por evento
 * (`tarefaEntrouEmStatus`, ao entrar em "em aprovação") e grava exatamente
 * um evento de outbox por Execução — nunca por operação comum sem Automação
 * de Canal envolvida. A derivação em si não é mais opt-in da rota: mora em
 * `persistencia/unidade-de-trabalho.ts::executar()` (05-17 Task 1).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { evoluirConfiguracaoPorEmpresa } from "@n1/dominio/configuracao-por-empresa-evolver";
import { CP } from "@n1/dominio/operations";
import { CANAL_CAMPO_EMPRESA_ID, CANAL_CAMPO_WHATSAPP_ID, CANAL_LISTA_ID } from "@n1/dominio/operations/automations";
import { buildSeed } from "@n1/dominio/seed";
import { SOL } from "@n1/dominio/solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar, semear } from "../persistencia/repositorio";

const MARYANE = usuarioDoSeed("mem_maryane"); // ativo, no seed do Financeiro
const TIAGO = usuarioDoSeed("mem_tiago"); // removido, no seed do CRM
const THIAGO = usuarioDoSeed("mem_thiago"); // Proprietário: conecta Canal (B35) e administra a Estrutura

const semente = buildSeed();
// CR-05/D5-19 (05-17) — o caso (w)/(x) migra para a Solicitação (colateral de
// 05-13): a Lista e as Integrações por Empresa precisam existir no MESMO
// `semente` que `semear()` grava em `ws_rotas_teste`, senão `destinoDeCanal`
// recusa por "Lista errada"/"Empresa sem Integração" antes de chegar ao que
// este caso prova.
{
  const solicitacoes = evoluirConfiguracaoDeSolicitacoes(semente, CP.financeiroId);
  if (!solicitacoes.ok) throw new Error(`fixture: ${solicitacoes.error}`);
  const empresas = evoluirConfiguracaoPorEmpresa(semente, CP.financeiroId);
  if (!empresas.ok) throw new Error(`fixture: ${empresas.error}`);
}
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
          : token === "token-thiago"
            ? { sub: THIAGO }
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

  it("(t) saveView com kind:42 e um campo a mais responde 400 antes de executar()", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/saveView",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [
          { listId: "lst_ativacao", name: "Visão", kind: 42, filters: {}, shared: false, lixo: { a: [1, 2] } },
        ],
      },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error.startsWith('Entrada inválida para "saveView"')).toBe(true);
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_rotas_teste";

/** A Automação de Canal do caso (w)/(x): publicada em `CANAL_LISTA_ID` (Solicitações de pagamento, D5-19/05-13), gatilho por evento — ao ENTRAR em "em aprovação". */
const AUTOMACAO_CANAL_ID = "aut_canal_operacoes_teste";

async function inserirAutomacaoDeCanal(workspaceId: string): Promise<void> {
  const dados = {
    id: AUTOMACAO_CANAL_ID,
    lifecycle: "ativo",
    scopeType: "list",
    scopeId: CANAL_LISTA_ID,
    name: "Canal de teste (05-17, migrado de 05-07 Task 2)",
    description: "",
    ownerMemberId: CP.financeiroId,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger: { kind: "evento", eventType: "tarefaEntrouEmStatus", eventSubtype: "em aprovação" },
        conditions: [],
        actions: [
          {
            order: 1,
            kind: "controle",
            controlKind: "notificar",
            params: JSON.stringify({ canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" }),
          },
        ],
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
  const cliente = await pool().connect();
  try {
    await cliente.query(
      `insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'automations', $2, $3::jsonb)`,
      [workspaceId, AUTOMACAO_CANAL_ID, JSON.stringify(dados)],
    );
  } finally {
    cliente.release();
  }
}

/** Quantas linhas de `automacao.notificar-canal.v1` o payload aponta para `taskId` — a leitura que sobrevive a duas rodadas com aggregate_id distintos. */
async function contarOutboxCanalDaTarefa(taskId: string): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ n: string }>(
      `select count(*)::text as n from plataforma.integration_outbox
        where workspace_id = $1 and event_type = 'automacao.notificar-canal.v1' and payload->>'taskId' = $2`,
      [WS, taskId],
    );
    return Number(r.rows[0]?.n ?? "0");
  } finally {
    cliente.release();
  }
}

d("POST /operacoes/:nome — contra o banco real", () => {
  const tarefaDeContasAPagar = semente.tasks.find(
    (t) => t.listId === CP.listId && t.statusId === CP.status.paraPagar,
  );

  beforeAll(async () => {
    expect(tarefaDeContasAPagar, "o seed precisa ter uma conta em 'para pagar'").toBeDefined();
    const cliente = await pool().connect();
    try {
      // Os ids de Tarefa do seed se repetem entre execuções: sem limpar o outbox, as linhas
      // de Canal de uma rodada anterior entram na contagem de (w) e (x) da seguinte.
      await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
      await semear(cliente, WS, semente);
    } finally {
      cliente.release();
    }
    await inserirAutomacaoDeCanal(WS);
  });

  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WS]);
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

  it("(y) uma operação nova do frontend do main (criarColecao) grava e volta na hidratação — não fica só na cópia do cliente", async () => {
    const nome = `Coleção pela rota ${Date.now()}`;
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/criarColecao",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [{ name: nome, description: "Criada pela integração do main.", isPrivate: false }] },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok, corpo.error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      expect(state.collections.some((c) => c.name === nome)).toBe(true);
    } finally {
      cliente.release();
    }
  });

  it("(z) createList com a forma literal de create-container-dialog.tsx (modeloDeTarefa) grava e volta na hidratação — era 400 pelo .strict() (FUND-05)", async () => {
    const nome = `Lista pela rota ${Date.now()}`;
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createList",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [{ name: nome, parentType: "folder", parentId: CP.folderId, isPrivate: false, modeloDeTarefa: "operacional" }],
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok, corpo.error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const lista = state.lists.find((l) => l.name === nome);
      expect(lista).toBeDefined();
      expect(lista?.modeloDeTarefa).toBe("operacional");
    } finally {
      cliente.release();
    }
  });

  it("(z2) updateContainer e archiveContainer pela rota (POSC-09): renomeia e arquiva a Lista no banco, e volta na hidratação", async () => {
    const nome = `Lista renomeada ${Date.now()}`;
    const renomear = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateContainer",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["list", CP.listId, { name: nome }] },
    });
    expect(renomear.statusCode, renomear.body).toBe(200);
    expect(renomear.json().ok, renomear.json().error).toBe(true);
    const arquivar = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/archiveContainer",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["list", CP.listId] },
    });
    expect(arquivar.statusCode, arquivar.body).toBe(200);
    expect(arquivar.json().ok, arquivar.json().error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const lista = state.lists.find((l) => l.id === CP.listId);
      expect(lista?.name).toBe(nome);
      expect(lista?.lifecycle).toBe("arquivado");
    } finally {
      cliente.release();
    }
    // Desarquiva para não deixar a Lista de Contas a pagar arquivada para os casos seguintes.
    const desarquivar = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/unarchiveContainer",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["list", CP.listId] },
    });
    expect(desarquivar.json().ok, desarquivar.json().error).toBe(true);
  });

  it("(z3) FUND-18 — o fluxo conversacional inteiro pela rota: conectar Canal, criar Lista conversacional com ele, trocar os canais e criar a Tarefa a partir de um Contato", async () => {
    const chamar = (nome: string, args: unknown[]) =>
      appDeTeste().inject({ method: "POST", url: `/operacoes/${nome}`, headers: { authorization: "Bearer token-thiago" }, payload: { args } });
    // Thiago é Proprietário do seed: conecta Canal (B35) e administra a Estrutura.
    const canal = await chamar("criarCanal", [{ channelType: "whatsapp", name: `Atendimento ${Date.now()}`, externalId: "+55 11 90000-0001" }]);
    expect(canal.statusCode, canal.body).toBe(200);
    const canalCorpo = canal.json() as { ok: boolean; error?: string; value: { id: string } };
    expect(canalCorpo.ok, canalCorpo.error).toBe(true);
    const canalId = canalCorpo.value.id;

    const lista = await chamar("createList", [
      { name: `Atendimento ${Date.now()}`, parentType: "folder", parentId: CP.folderId, isPrivate: false, modeloDeTarefa: "conversacional", canaisDeAtendimento: [canalId] },
    ]);
    const listaCorpo = lista.json() as { ok: boolean; error?: string; value: { id: string; canaisDeAtendimento?: string[] } };
    expect(listaCorpo.ok, listaCorpo.error).toBe(true);
    expect(listaCorpo.value.canaisDeAtendimento).toEqual([canalId]);
    const listaId = listaCorpo.value.id;

    const canais = await chamar("definirCanaisDaLista", [listaId, [canalId]]);
    expect((canais.json() as { ok: boolean; error?: string }).ok, canais.body).toBe(true);

    const contato = semente.contacts.find((c) => c.lifecycle === "ativo");
    if (!contato) throw new Error("o seed precisa de um Contato ativo");
    const tarefa = await chamar("criarTarefaConversacional", [{ listId: listaId, contactId: contato.id, channelId: canalId }]);
    const tarefaCorpo = tarefa.json() as { ok: boolean; error?: string; value: { task: { id: string; listId: string }; conversation: { id: string } } };
    expect(tarefaCorpo.ok, tarefaCorpo.error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      expect(state.channels.some((c) => c.id === canalId && c.connection === "conectada")).toBe(true);
      const l = state.lists.find((x) => x.id === listaId);
      expect(l?.modeloDeTarefa).toBe("conversacional");
      expect(l?.canaisDeAtendimento).toEqual([canalId]);
      expect(state.tasks.some((t) => t.id === tarefaCorpo.value.task.id && t.listId === listaId)).toBe(true);
      expect(state.conversations.some((c) => c.id === tarefaCorpo.value.conversation.id)).toBe(true);
    } finally {
      cliente.release();
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

  it("(w) cria Solicitação, preenche Empresa/WhatsApp e entra em 'em aprovação' com a Automação de Canal publicada: grava 1 linha por rodada — duas rodadas não colidem", async () => {
    const app = appDeTeste();

    async function rodarFluxoDeCanal(titulo: string): Promise<string> {
      // 1) Nasce em "para fazer" — a Automação de Canal reage a ENTRAR em
      // "em aprovação", nunca a `tarefaCriada`, então este passo não a dispara.
      const criacao = await app.inject({
        method: "POST",
        url: "/operacoes/createTask",
        headers: { authorization: "Bearer token-maryane" },
        payload: { args: [{ listId: CANAL_LISTA_ID, title: titulo, statusId: SOL.status.paraFazer }] },
      });
      expect(criacao.statusCode).toBe(200);
      const taskId: string = criacao.json().value.id;

      // 2) Preenche os Campos ANTES da Automação rodar — `setTaskFieldValue` não
      // dispara nenhum gatilho por si. `destinoDeCanal` (D5-19) lê Empresa E,
      // no modo campo, o WhatsApp — os dois precisam estar preenchidos.
      const empresa = await app.inject({
        method: "POST",
        url: "/operacoes/setTaskFieldValue",
        headers: { authorization: "Bearer token-maryane" },
        payload: { args: [taskId, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo"] },
      });
      expect(empresa.statusCode).toBe(200);
      expect(empresa.json().ok).toBe(true);

      const campo = await app.inject({
        method: "POST",
        url: "/operacoes/setTaskFieldValue",
        headers: { authorization: "Bearer token-maryane" },
        payload: { args: [taskId, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-do-solicitante-teste"] },
      });
      expect(campo.statusCode).toBe(200);
      expect(campo.json().ok).toBe(true);

      // 3) Entrar em "em aprovação" dispara `tarefaEntrouEmStatus` — a Automação
      // de Canal roda dentro da MESMA transação e o evento nasce no mesmo commit.
      const mudanca = await app.inject({
        method: "POST",
        url: "/operacoes/changeTaskStatus",
        headers: { authorization: "Bearer token-maryane" },
        payload: { args: [taskId, SOL.status.emAprovacao] },
      });
      expect(mudanca.statusCode).toBe(200);
      expect(mudanca.json().ok).toBe(true);
      return taskId;
    }

    const primeiraTarefa = await rodarFluxoDeCanal("Solicitação de teste — Canal (05-17 w, 1ª rodada)");
    expect(await contarOutboxCanalDaTarefa(primeiraTarefa)).toBe(1);

    // Segunda rodada, TAREFA DIFERENTE: outra Execução, outro `executionId`, outro
    // `aggregate_id` (WR-04, `<executionId>:<indicePasso>`) — nenhum conflito.
    const segundaTarefa = await rodarFluxoDeCanal("Solicitação de teste — Canal (05-17 w, 2ª rodada)");
    expect(await contarOutboxCanalDaTarefa(segundaTarefa)).toBe(1);
    expect(segundaTarefa).not.toBe(primeiraTarefa);

    const cliente = await pool().connect();
    try {
      const execucoes = await cliente.query<{ objectid: string }>(
        `select r.dados->>'objectId' as objectid
           from plataforma.registros r
          where r.workspace_id = $1 and r.colecao = 'automationExecutions'
            and r.dados->>'automationId' = $2 and r.dados->>'objectId' in ($3, $4)`,
        [WS, AUTOMACAO_CANAL_ID, primeiraTarefa, segundaTarefa],
      );
      expect(execucoes.rowCount).toBe(2); // uma Execução por rodada, cada uma com o seu id

      const aggregateIds = await cliente.query<{ aggregate_id: string }>(
        `select aggregate_id from plataforma.integration_outbox
          where workspace_id = $1 and event_type = 'automacao.notificar-canal.v1' and payload->>'taskId' in ($2, $3)`,
        [WS, primeiraTarefa, segundaTarefa],
      );
      // WR-04 — `<executionId>:<indicePasso>`, nunca só o executionId.
      for (const linha of aggregateIds.rows) expect(linha.aggregate_id).toMatch(/^.+:0$/);
    } finally {
      cliente.release();
    }
  });

  it("(x) uma operação comum, sem a Automação de Canal envolvida, não grava evento de Canal nenhum", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: { authorization: "Bearer token-maryane" },
      // Nasce DIRETO em "em aprovação" (o status que a Automação vigia) — a
      // criação não é uma ENTRADA por `changeTaskStatus`, então
      // `tarefaEntrouEmStatus` nunca dispara e a Automação de Canal nunca roda.
      payload: { args: [{ listId: CANAL_LISTA_ID, title: "Solicitação de teste — sem Canal (05-17 x)", statusId: SOL.status.emAprovacao }] },
    });
    expect(resposta.statusCode).toBe(200);
    const taskId: string = resposta.json().value.id;

    expect(await contarOutboxCanalDaTarefa(taskId)).toBe(0);
  });
});
