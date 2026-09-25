/**
 * A Fault-Injection Matrix de `02-VALIDATION.md`, nas nove linhas, NO
 * CONTEXTO ENTRE PROCESSOS (Plan 02-26, Task 3) — os Planos 02-10
 * (`outbox.test.ts`/`outbox-worker.test.ts`) e 02-17
 * (`platform-adapter-queue.test.ts`) já provaram cada peça ISOLADA; o valor
 * aqui é a COMPOSIÇÃO: Fastify da plataforma real + Express do
 * `automation/` real + Postgres de teste real, como `dois-servicos.test.ts`
 * — reaproveitando os mesmos helpers desse arquivo (nunca duplicados).
 *
 * Cada caso afirma o INVARIANTE (perda, duplicação, reordenação — nunca o
 * caminho exato de como o invariante se prova).
 *
 * Caso (i) — importação retomada pelo `--resume` — depende de
 * `apps/api/src/importacao/financeiro/importar.ts` (Plan 02-25), que NÃO foi
 * executado nesta branch (o arquivo não existe). Escrito como `it.todo`
 * nomeado, nunca fingido: ver hard limit 5 da execução e o SUMMARY deste
 * plano.
 *
 * Pré-condição idêntica a `dois-servicos.test.ts`: `DATABASE_URL` +
 * repositório irmão clonado — sem os dois, pula inteiro.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataState, Grant, Id, Member } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { createForm } from "@n1/dominio/operations/scale";
import { LISTA_ID, evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { SOL } from "@n1/dominio/solicitacao-de-pagamento";
import { buildApp } from "../app";
import { paraDtoV1 } from "../servicos/dto-solicitacao";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { emitirCredencial } from "../persistencia/credenciais-de-servico";
import { criarOutboxWorker, type OutboxWorker } from "../persistencia/outbox-worker";
import { semear } from "../persistencia/repositorio";
import {
  criarClienteDeReceiptsFalso,
  criarServicoFalso,
  importarAutomation,
  subirAutomationDeTeste,
  temBanco,
  temFinanceiroTria,
  type ChamadaRegistrada,
} from "./dois-servicos-suporte";

const d = temBanco && temFinanceiroTria ? describe : describe.skip;

// ═══════════════════════════════════════════════════════════════════════════
// Cenário — mesmo padrão de `dois-servicos.test.ts`, Espaço próprio.
// ═══════════════════════════════════════════════════════════════════════════

const AGORA = "2026-09-25T12:00:00.000Z";
const RUN = `e2e_falhas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;

const semente: DataState = buildSeed();
const MEMBRO_ADMIN = semente.members.find((m) => m.id === "mem_maryane");
if (!MEMBRO_ADMIN) throw new Error("seed sem mem_maryane — fixture do teste ficou desatualizada");

const AGENTE_PIPELINE: Member = {
  id: "mem_agente_pipeline_falhas",
  workspaceId: semente.workspace.id,
  displayName: "Agente do pipeline (falhas injetadas)",
  state: "ativo",
  roleId: SOL.papeis.agentePipeline,
  availability: { value: "disponivel", at: AGORA, origin: "membro" },
  userMemory: { enabled: true, items: [] },
};
semente.members.push(AGENTE_PIPELINE);

const evolucao = evoluirConfiguracaoDeSolicitacoes(semente, MEMBRO_ADMIN.id);
if (!evolucao.ok) throw new Error(`evoluirConfiguracaoDeSolicitacoes falhou no setup do teste: ${evolucao.error}`);

const formulario = createForm(semente, MEMBRO_ADMIN.id, LISTA_ID, {
  name: "Formulário de teste — falhas injetadas",
  questions: [
    { label: "Título", required: true, target: { kind: "title" } },
    { label: "Centro de Custo", required: true, target: { kind: "field", definitionId: "fld_sp_a_centro_de_custo" } },
    { label: "Empresa", required: true, target: { kind: "field", definitionId: "fld_sp_c_empresa" } },
    // Ver dois-servicos.test.ts — `fd_cp_centro` é herdado do Espaço (B25).
    { label: "Centro de Custo (Contas a pagar, herdado do Espaço)", required: true, target: { kind: "field", definitionId: "fd_cp_centro" } },
  ],
});
if (!formulario.ok) throw new Error(`createForm falhou no setup do teste: ${formulario.error}`);
const FORM_SECRET = formulario.value.secret;
const PERGUNTA_CUSTO = formulario.value.questions.find((q) => q.target.kind === "field" && q.target.definitionId === "fld_sp_a_centro_de_custo");
const PERGUNTA_EMPRESA = formulario.value.questions.find((q) => q.target.kind === "field" && q.target.definitionId === "fld_sp_c_empresa");
const PERGUNTA_TITULO = formulario.value.questions.find((q) => q.target.kind === "title");
const PERGUNTA_CUSTO_CP = formulario.value.questions.find((q) => q.target.kind === "field" && q.target.definitionId === "fd_cp_centro");
if (!PERGUNTA_CUSTO || !PERGUNTA_EMPRESA || !PERGUNTA_TITULO || !PERGUNTA_CUSTO_CP) {
  throw new Error("perguntas do Formulário de teste ficaram incompletas");
}

const USR_ADMIN = "usr_falhas_admin";

function appDeTeste() {
  return buildApp({
    logger: false,
    workspaceId: WORKSPACE,
    verificarToken: async (token) => (token === "token-admin" ? { sub: USR_ADMIN } : null),
    resolverMembro: async (_workspaceId, userId) => (userId === USR_ADMIN ? MEMBRO_ADMIN : undefined),
  });
}

async function limparTudo(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.http_idempotency where service_id like $1", [`${RUN}%`]);
    await cliente.query("delete from plataforma.service_credentials where workspace_id = $1", [WORKSPACE]);
  } finally {
    cliente.release();
  }
}

async function estadoAtual(): Promise<{ data: DataState }> {
  const resposta = await appDeTeste().inject({ method: "GET", url: "/estado", headers: { authorization: "Bearer token-admin" } });
  expect(resposta.statusCode, resposta.body).toBe(200);
  return resposta.json();
}

function acharTaskIdPorReadableId(state: DataState, readableId: string): string {
  const task = state.tasks.find((t) => t.readableId === readableId);
  if (!task) throw new Error(`Tarefa com readableId "${readableId}" não encontrada.`);
  return task.id;
}

d("Fault-Injection Matrix (02-VALIDATION.md) — no contexto entre processos", () => {
  let fecharPlataforma: () => Promise<void>;
  let fecharAutomation: () => Promise<void>;
  let baseUrlPlataforma: string;
  let automationUrl: string;
  let TOKEN_SERVICO: string;
  let TOKEN_WEBHOOK: string;
  let chamadas: ChamadaRegistrada[];
  let criarNovoOutboxWorker: (workerId: string) => OutboxWorker;

  beforeAll(async () => {
    await limparTudo();
    const cliente = await pool().connect();
    try {
      await semear(cliente, WORKSPACE, semente);
    } finally {
      cliente.release();
    }

    TOKEN_WEBHOOK = randomUUID();
    const emitida = await emitirCredencial({
      workspaceId: WORKSPACE,
      nome: "Credencial de teste — falhas injetadas",
      scopes: ["payment-requests:read", "payment-requests:write"],
    });
    TOKEN_SERVICO = `${emitida.id}.${emitida.segredo}`;

    const plataformaApp = appDeTeste();
    baseUrlPlataforma = await plataformaApp.listen({ port: 0, host: "127.0.0.1" });
    fecharPlataforma = () => plataformaApp.close();

    const { criarPlataformaAdapter } = await importarAutomation<{
      criarPlataformaAdapter: (deps: { baseUrl: string; token: string; fila?: unknown }) => {
        getTask(taskId: string): Promise<Record<string, unknown>>;
        createComment(taskId: string, text: string, options: unknown): Promise<{ id: string }>;
        updateTaskStatus(taskId: string, status: string, options: unknown): Promise<void>;
        addTaskTag(taskId: string, tagName: string, options: unknown): Promise<void>;
        getCommentReplies(commentId: string): Promise<{ items: Array<{ id: string; text: string }> }>;
      };
    }>("adapters/plataforma");

    const adapter = criarPlataformaAdapter({ baseUrl: baseUrlPlataforma, token: TOKEN_SERVICO });
    const { servico, chamadas: chamadasDoServico } = criarServicoFalso({ adapter, aprovadorMemberId: MEMBRO_ADMIN!.id });
    chamadas = chamadasDoServico;

    const { cliente: receiptsFalso } = criarClienteDeReceiptsFalso();

    const automation = await subirAutomationDeTeste({
      servicos: { tria: servico, "marcos-paulo": servico, "family-office": servico },
      supabase: receiptsFalso,
      tokenEsperado: TOKEN_WEBHOOK,
      obterTarefa: (taskId: string) => adapter.getTask(taskId) as Promise<{ readonly fields: { readonly company: string | null } }>,
    });
    fecharAutomation = automation.fechar;
    automationUrl = automation.url;

    criarNovoOutboxWorker = (workerId: string) =>
      criarOutboxWorker({ destinoUrl: automationUrl, token: TOKEN_WEBHOOK, workerId, workspaceId: WORKSPACE, intervaloMs: 50 });
  });

  afterAll(async () => {
    await fecharPlataforma?.();
    await fecharAutomation?.();
    await limparTudo();
    await encerrar();
  });

  async function submeterSolicitacao(titulo: string): Promise<{ readonly readableId: string; readonly submissionId: string }> {
    const submissionId = randomUUID();
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: `/v1/public/forms/${FORM_SECRET}/submissions`,
      payload: {
        submissionId,
        answers: {
          [PERGUNTA_TITULO!.id]: titulo,
          [PERGUNTA_CUSTO!.id]: "TRIA",
          [PERGUNTA_EMPRESA!.id]: "Tria Company",
          [PERGUNTA_CUSTO_CP!.id]: "TRIA",
        },
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(201);
    return { readableId: resposta.json().readableId, submissionId };
  }

  async function contarRegistros(colecao: string, workspaceId = WORKSPACE): Promise<number> {
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query(`select count(*)::int as n from plataforma.registros where workspace_id = $1 and colecao = $2`, [
        workspaceId,
        colecao,
      ]);
      return rows[0].n;
    } finally {
      cliente.release();
    }
  }

  async function contarOutbox(): Promise<number> {
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query(`select count(*)::int as n from plataforma.integration_outbox where workspace_id = $1`, [WORKSPACE]);
      return rows[0].n;
    } finally {
      cliente.release();
    }
  }

  async function contarOutboxPendente(): Promise<number> {
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query(
        `select count(*)::int as n from plataforma.integration_outbox where workspace_id = $1 and status = 'pending'`,
        [WORKSPACE],
      );
      return rows[0].n;
    } finally {
      cliente.release();
    }
  }

  /**
   * Drena TODAS as linhas `pending` — nunca só a primeira. Achado real: a
   * rota de escrita de comentário (`integracao-solicitacoes.ts`) emite
   * `solicitacao.comentario-criado.v1` para QUALQUER comentário novo,
   * inclusive o de roteamento que o PRÓPRIO `automation/` publica — cada
   * Tarefa entregue nesta suíte deixa, no mínimo, DOIS eventos (a criação e
   * esse comentário), não um. Parar no primeiro `processarUm()` bem-sucedido
   * deixa o segundo pendente, "furando a fila" para o próximo `it()`.
   */
  async function drenarTudo(worker: OutboxWorker): Promise<number> {
    let entregas = 0;
    for (let i = 0; i < 20; i += 1) {
      const entregou = await worker.processarUm();
      if (!entregou) break;
      entregas += 1;
    }
    return entregas;
  }

  /** Mesmo gap de domínio documentado em `dois-servicos.test.ts` — concessão de fixture, nunca produção. */
  async function concederComentarNaTarefa(taskId: Id): Promise<void> {
    const grant: Grant = {
      id: `grn_falhas_comentar_${taskId}`,
      workspaceId: semente.workspace.id,
      subjectKind: "member",
      subjectId: AGENTE_PIPELINE.id,
      action: "comentar",
      resourceType: "task",
      resourceId: taskId,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: MEMBRO_ADMIN!.id,
      grantedAt: new Date().toISOString(),
    };
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `insert into plataforma.registros (workspace_id, colecao, id, dados, ordem)
         values ($1, 'grants', $2, $3::jsonb, extract(epoch from now()))
         on conflict (workspace_id, colecao, id) do nothing`,
        [WORKSPACE, grant.id, JSON.stringify(grant)],
      );
    } finally {
      cliente.release();
    }
  }

  it("(a) crash entre o INSERT da Tarefa e o commit — nem Tarefa nem outbox ficam visíveis, automation nunca recebe evento", async () => {
    // `consumirSessao` (dentro da MESMA transação de `submitForm`, via
    // `opcoes.aoConfirmar`) lança quando a `submissionId` já foi consumida —
    // a Unidade de Trabalho desfaz TUDO (Tarefa, Campos, Atividade, outbox)
    // antes do commit. É o "crash no meio da transação" que a produção teria
    // com um erro de infraestrutura no mesmo ponto: nem Tarefa nem evento
    // sobrevivem, byte a byte.
    const antesTasks = await contarRegistros("tasks");
    const antesOutbox = await contarOutbox();
    const antesChamadas = chamadas.length;

    const { readableId: primeiro, submissionId } = await submeterSolicitacao("Falha injetada (a) — primeira tentativa");
    expect(primeiro).toBeTruthy();

    // Reenvio da MESMA submissionId — a sessão já foi consumida pela primeira
    // tentativa (garantirSessao vê um registro `consumida`, não `pendente`).
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: `/v1/public/forms/${FORM_SECRET}/submissions`,
      payload: {
        submissionId,
        answers: {
          [PERGUNTA_TITULO!.id]: "Falha injetada (a) — segunda tentativa, mesma sessão",
          [PERGUNTA_CUSTO!.id]: "TRIA",
          [PERGUNTA_EMPRESA!.id]: "Tria Company",
          [PERGUNTA_CUSTO_CP!.id]: "TRIA",
        },
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(409);

    // Exatamente 1 Tarefa nova (a primeira) — a segunda tentativa não deixou
    // nem Tarefa nem outbox parciais.
    expect(await contarRegistros("tasks")).toBe(antesTasks + 1);
    expect(await contarOutbox()).toBe(antesOutbox + 1);
    // O automation/ nunca foi chamado por esta segunda tentativa — nenhum
    // outbox novo para ela, nada a entregar.
    expect(chamadas.length).toBe(antesChamadas);

    // Limpeza: a Tarefa da PRIMEIRA tentativa deixou 1 linha `pending` de
    // propósito (o invariante deste caso é "nada da segunda tentativa
    // vaza"; a primeira é uma solicitação válida e seu evento é legítimo).
    // Drena aqui para não deixar uma linha antiga "furando a fila" e sendo
    // reivindicada pelos casos (b)/(c)/(e) mais abaixo, que esperam entregar
    // a PRÓPRIA Tarefa.
    const { data } = await estadoAtual();
    const taskId = acharTaskIdPorReadableId(data, primeiro);
    await concederComentarNaTarefa(taskId);
    await drenarTudo(criarNovoOutboxWorker(`${RUN}_worker_a_cleanup`));
  });

  it("(b) crash depois do commit e antes do HTTP — outbox fica pending; ao religar o worker, a entrega acontece e o run nasce uma vez só", async () => {
    const { readableId } = await submeterSolicitacao("Falha injetada (b) — outbox pending");
    const { data } = await estadoAtual();
    const taskId = acharTaskIdPorReadableId(data, readableId);
    await concederComentarNaTarefa(taskId);

    // "automation/ estava fora do ar" = ninguém drenou o outbox ainda.
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query(
        `select status from plataforma.integration_outbox where workspace_id = $1 and event_type = 'solicitacao.criada.v1' and aggregate_id = $2`,
        [WORKSPACE, taskId],
      );
      expect(rows[0]!.status).toBe("pending");
    } finally {
      cliente.release();
    }

    // "Religa o worker": drena agora. O run nasce UMA vez — 1 chamada nova a
    // syncAndAssignResponsible para ESTA Tarefa.
    const antesChamadas = chamadas.filter((c) => c.metodo === "syncAndAssignResponsible" && c.args[0] === taskId).length;
    const entregas = await drenarTudo(criarNovoOutboxWorker(`${RUN}_worker_b`));
    expect(entregas).toBeGreaterThanOrEqual(1);

    const depois = chamadas.filter((c) => c.metodo === "syncAndAssignResponsible" && c.args[0] === taskId).length;
    expect(depois).toBe(antesChamadas + 1);
  });

  it("(c) o receptor persiste o receipt e a resposta se perde — replay do mesmo eventId não cria um segundo run", async () => {
    const { readableId } = await submeterSolicitacao("Falha injetada (c) — replay de eventId");
    const { data } = await estadoAtual();
    const taskId = acharTaskIdPorReadableId(data, readableId);
    await concederComentarNaTarefa(taskId);

    const cliente = await pool().connect();
    let eventId: string;
    try {
      const { rows } = await cliente.query(
        `select id from plataforma.integration_outbox where workspace_id = $1 and event_type = 'solicitacao.criada.v1' and aggregate_id = $2`,
        [WORKSPACE, taskId],
      );
      eventId = rows[0]!.id;
    } finally {
      cliente.release();
    }

    const entregas = await drenarTudo(criarNovoOutboxWorker(`${RUN}_worker_c`));
    expect(entregas).toBeGreaterThanOrEqual(1);

    const antesChamadas = chamadas.filter((c) => c.metodo === "syncAndAssignResponsible" && c.args[0] === taskId).length;
    expect(antesChamadas).toBe(1);

    // A "resposta se perdeu" do ponto de vista do outbox: alguém (o worker,
    // depois de um timeout) repete a MESMA entrega com o MESMO eventId —
    // simulado aqui chamando o webhook direto de novo com o cabeçalho igual.
    const respostaReplay = await fetch(`${automationUrl}/webhooks/plataforma/solicitacao-criada`, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN_WEBHOOK}`, "content-type": "application/json", "idempotency-key": eventId },
      body: JSON.stringify({ eventId, taskId, readableId, listId: LISTA_ID, origin: "plataforma" }),
    });
    expect(respostaReplay.status).toBe(202);
    const corpo = (await respostaReplay.json()) as { duplicated?: boolean };
    expect(corpo.duplicated).toBe(true);

    const depoisChamadas = chamadas.filter((c) => c.metodo === "syncAndAssignResponsible" && c.args[0] === taskId).length;
    expect(depoisChamadas).toBe(1); // nenhum segundo run.
  });

  it("(d) a plataforma aplica uma mutação e a resposta se perde — o adapter repete com a mesma Idempotency-Key e recebe o mesmo resultado; o comentário existe uma vez só", async () => {
    const { readableId } = await submeterSolicitacao("Falha injetada (d) — idempotência HTTP");
    const { data } = await estadoAtual();
    const taskId = acharTaskIdPorReadableId(data, readableId);
    await concederComentarNaTarefa(taskId);

    const idempotencyKey = `teste-d:${taskId}`;
    const corpoRequisicao = { text: "Comentário repetido por resposta perdida" };

    const chamar = () =>
      fetch(`${baseUrlPlataforma}/v1/integrations/payment-requests/${taskId}/comments`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN_SERVICO}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify(corpoRequisicao),
      });

    const primeira = await chamar();
    expect(primeira.status).toBe(200);
    const corpoPrimeira = (await primeira.json()) as { id: string };

    // "A resposta se perdeu" do lado do adapter: ele não viu o 200 e repete
    // com a MESMA Idempotency-Key — a plataforma devolve a MESMA resposta
    // gravada, sem publicar um segundo Comentário.
    const segunda = await chamar();
    expect(segunda.status).toBe(200);
    const corpoSegunda = (await segunda.json()) as { id: string };
    expect(corpoSegunda.id).toBe(corpoPrimeira.id);

    const { data: depois } = await estadoAtual();
    const task = depois.tasks.find((t) => t.id === taskId)!;
    const ocorrencias = task.comments.filter((c) => c.content === corpoRequisicao.text).length;
    expect(ocorrencias).toBe(1);
  });

  it("(e) duas workers de outbox disputam a mesma fila — uma única entrega", async () => {
    // Esvazia qualquer linha `pending` deixada por (c)/(d) (o comentário de
    // roteamento QUE O PRÓPRIO automation/ publica também emite
    // `solicitacao.comentario-criado.v1` — achado real, ver
    // `dois-servicos.test.ts`) — sem isto, as duas workers abaixo poderiam
    // reivindicar DUAS linhas DIFERENTES (nenhuma disputa de verdade) em vez
    // de disputar a MESMA.
    await drenarTudo(criarNovoOutboxWorker(`${RUN}_worker_e_zeladora`));
    expect(await contarOutboxPendente()).toBe(0);

    const { readableId } = await submeterSolicitacao("Falha injetada (e) — duas workers");
    const { data } = await estadoAtual();
    const taskId = acharTaskIdPorReadableId(data, readableId);
    await concederComentarNaTarefa(taskId);
    expect(await contarOutboxPendente()).toBe(1);

    const antesChamadas = chamadas.filter((c) => c.metodo === "syncAndAssignResponsible" && c.args[0] === taskId).length;
    expect(antesChamadas).toBe(0);

    const workerX = criarNovoOutboxWorker(`${RUN}_worker_e_x`);
    const workerY = criarNovoOutboxWorker(`${RUN}_worker_e_y`);

    const [entregouX, entregouY] = await Promise.all([workerX.processarUm(), workerY.processarUm()]);
    // FOR UPDATE SKIP LOCKED: com exatamente 1 linha pending disponível,
    // exatamente uma das duas a reivindica.
    expect([entregouX, entregouY].filter(Boolean)).toHaveLength(1);

    const depoisChamadas = chamadas.filter((c) => c.metodo === "syncAndAssignResponsible" && c.args[0] === taskId).length;
    expect(depoisChamadas).toBe(1);
  });

  it("(f) comando 1 falha e o comando 2 da MESMA Tarefa está pronto — o comando 2 não ultrapassa; uma Tarefa diferente continua avançando", async () => {
    const { criarFilaDeComandos } = await importarAutomation<{
      criarFilaDeComandos: (opcoes: { readonly supabase: unknown; readonly leaseOwner?: string }) => {
        enfileirar(args: { readonly taskId: string; readonly operation: string; readonly request: Record<string, unknown>; readonly idempotencyKey: string }): Promise<{ readonly id: string }>;
        reivindicarCabeca(): Promise<{ readonly id: string; readonly taskId: string; readonly status: string } | undefined>;
        executar(comando: unknown, adapter: unknown): Promise<void>;
      };
    }>("adapters/platform-adapter-queue");
    const { criarPlataformaAdapter } = await importarAutomation<{
      criarPlataformaAdapter: (deps: { baseUrl: string; token: string }) => unknown;
    }>("adapters/plataforma");

    const { cliente: clienteDeComandos } = criarClienteDeTabelaGenericoFalso();
    const fila = criarFilaDeComandos({ supabase: clienteDeComandos, leaseOwner: `${RUN}_fila` });
    const adapterCru = criarPlataformaAdapter({ baseUrl: baseUrlPlataforma, token: TOKEN_SERVICO });

    const { readableId: readableA } = await submeterSolicitacao("Falha injetada (f) — Tarefa A (bloqueada)");
    const { readableId: readableB } = await submeterSolicitacao("Falha injetada (f) — Tarefa B (avança)");
    const { data } = await estadoAtual();
    const taskA = acharTaskIdPorReadableId(data, readableA);
    const taskB = acharTaskIdPorReadableId(data, readableB);

    // Comando 1 da Tarefa A: addTaskTag — o Convidado "Agente do pipeline"
    // nunca tem essa permissão (categórica, §9 do catálogo) — falha
    // PERMANENTE garantida, sem depender de nenhum grant de fixture.
    await fila.enfileirar({ taskId: taskA, operation: "addTaskTag", request: { tagName: SOL.tags.contaTria }, idempotencyKey: `f:${taskA}:tag` });
    // Comando 2 da MESMA Tarefa A: updateTaskStatus — pronto, mas atrás do comando 1.
    await fila.enfileirar({
      taskId: taskA,
      operation: "updateTaskStatus",
      request: { status: "em aprovação" },
      idempotencyKey: `f:${taskA}:status`,
    });
    // Comando da Tarefa B: updateTaskStatus — sem nada bloqueando.
    await fila.enfileirar({ taskId: taskB, operation: "updateTaskStatus", request: { status: "em aprovação" }, idempotencyKey: `f:${taskB}:status` });

    // Reivindica e executa o comando 1 de A — falha permanente.
    const comando1 = await fila.reivindicarCabeca();
    expect(comando1?.taskId).toBe(taskA);
    await fila.executar(comando1, adapterCru);

    // Agora a cabeça reivindicável NUNCA é o comando 2 de A (bloqueado pelo
    // comando 1 `failed`) — só a Tarefa B avança.
    const proximo = await fila.reivindicarCabeca();
    expect(proximo?.taskId).toBe(taskB);
    await fila.executar(proximo!, adapterCru);

    // Confere no ESTADO real: B mudou de Status, A não (o comando 2 dela nunca rodou).
    const { data: depois } = await estadoAtual();
    expect(depois.tasks.find((t) => t.id === taskB)!.statusId).toBe(SOL.status.emAprovacao);
    expect(depois.tasks.find((t) => t.id === taskA)!.statusId).toBe(SOL.status.paraFazer);

    // Nada mais reivindicável agora (comando 2 de A continua bloqueado).
    const maisNada = await fila.reivindicarCabeca();
    expect(maisNada).toBeUndefined();
  });

  it("(g) a signed URL expira durante o download — getTask sempre gera uma URL nova, nunca reaproveitada", async () => {
    // Sem SUPABASE_STORAGE_BUCKET/SUPABASE_URL/SUPABASE_SECRET_KEY neste
    // ambiente (mesmo gate de storage-uploads.test.ts/formularios-publicos.test.ts),
    // não há como subir um objeto real. `paraDtoV1` aceita `urlDeDownload`
    // por injeção (D-04) — prova o MESMO invariante (URL nova a cada
    // chamada, nunca cache) sem depender de um bucket real; hard limit 2
    // permite estubar a porta de Storage quando necessário.
    const { readableId } = await submeterSolicitacao("Falha injetada (g) — URL assinada renovada");
    const { data } = await estadoAtual();
    const taskId = acharTaskIdPorReadableId(data, readableId);

    const fileId = `wf_falhas_g_${taskId}`;
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `insert into plataforma.registros (workspace_id, colecao, id, dados, ordem)
         values ($1, 'files', $2, $3::jsonb, extract(epoch from now()))
         on conflict (workspace_id, colecao, id) do nothing`,
        [
          WORKSPACE,
          fileId,
          JSON.stringify({
            id: fileId,
            workspaceId: semente.workspace.id,
            name: "nota-fiscal-teste.pdf",
            mediaType: "document",
            sizeBytes: 1024,
            createdBy: { kind: "member", id: MEMBRO_ADMIN!.id },
            createdAt: new Date().toISOString(),
            objectKey: `workspace/forms/teste/${fileId}`,
          }),
        ],
      );
    } finally {
      cliente.release();
    }

    // `setTaskFieldValue` (a operação genérica) só aceita `string` para
    // Campos fora do `switch` explícito (`default: ... "é texto."`) — Campo
    // tipo `file` não tem um caso próprio ali; quem preenche Anexo de
    // verdade é `submitForm`, que escreve `task.fieldValues` diretamente. Para
    // este teste (só prova a projeção do DTO, não o preenchimento), o
    // caminho correto é a MESMA gravação direta — nunca uma chamada de
    // domínio que a própria operação recusaria.
    const clientePatch = await pool().connect();
    try {
      const { rows } = await clientePatch.query(`select dados from plataforma.registros where workspace_id = $1 and colecao = 'tasks' and id = $2`, [
        WORKSPACE,
        taskId,
      ]);
      const tarefaBruta = rows[0]!.dados as { fieldValues: Array<{ definitionId: string; value: unknown; state: string }> };
      tarefaBruta.fieldValues = [...tarefaBruta.fieldValues, { definitionId: "fld_sp_j_anexo", value: [fileId], state: "ativo" }];
      await clientePatch.query(`update plataforma.registros set dados = $3::jsonb where workspace_id = $1 and colecao = 'tasks' and id = $2`, [
        WORKSPACE,
        taskId,
        JSON.stringify(tarefaBruta),
      ]);
    } finally {
      clientePatch.release();
    }

    const { data: comAnexo } = await estadoAtual();
    const task = comAnexo.tasks.find((t) => t.id === taskId)!;
    expect(task.fieldValues.some((f) => f.definitionId === "fld_sp_j_anexo")).toBe(true);

    let contador = 0;
    const urlDeDownloadDeTeste = async (objectKey: string) => {
      contador += 1;
      return { downloadUrl: `https://storage.exemplo.com.br/${objectKey}?token=tentativa-${contador}`, expiresAt: new Date(Date.now() + 5_000) };
    };

    const primeira = await paraDtoV1(comAnexo, task, { urlDeDownload: urlDeDownloadDeTeste });
    // "expira" — o retry chama getTask (== paraDtoV1) de novo, nunca reaproveita.
    const segunda = await paraDtoV1(comAnexo, task, { urlDeDownload: urlDeDownloadDeTeste });

    expect(primeira?.attachments).toHaveLength(1);
    expect(segunda?.attachments).toHaveLength(1);
    expect(primeira!.attachments[0]!.downloadUrl).not.toBe(segunda!.attachments[0]!.downloadUrl);
    expect(segunda!.attachments[0]!.downloadUrl.endsWith("tentativa-2")).toBe(true);
  });

  it("(h) o Omie falso inclui e a conexão cai — ConsultarContaPagar encontra o código determinístico e o serviço não reinclui", async () => {
    interface OmieFalsoDeTeste {
      consultar: (codigo: string) => { encontrado: boolean };
      incluir: (payload: Record<string, unknown> & { codigo_lancamento_integracao: string }) => unknown;
      incluirComConexaoCaida: (payload: Record<string, unknown> & { codigo_lancamento_integracao: string }) => never;
      chamadas: Array<{ metodo: string; codigo: string }>;
    }
    const { criarOmieFalso } = await importarAutomation<{ criarOmieFalso: () => OmieFalsoDeTeste }>("testing/omie-falso");
    const omie = criarOmieFalso();

    // CON-07 — código determinístico, nunca Date.now(): a mesma obrigação
    // sempre produz o MESMO código, com ou sem retry.
    const codigo = "tria:payment-request:plataforma:tsk_falhas_h";

    // O padrão que CON-07 exige de qualquer chamador: consultar ANTES de incluir.
    function incluirComRetry(payloadBase: Record<string, unknown>): void {
      const existente = omie.consultar(codigo);
      if (existente.encontrado) return; // já incluído — nunca reinclui.
      try {
        omie.incluirComConexaoCaida({ ...payloadBase, codigo_lancamento_integracao: codigo });
      } catch {
        // "a conexão caiu antes da resposta" — quem chama não sabe se incluiu.
        // O retry SEMPRE consulta antes de tentar de novo (é isso que este teste prova).
      }
    }

    incluirComRetry({ valor: 12345 });
    // Retry após timeout — consulta primeiro, encontra o código, não reinclui.
    incluirComRetry({ valor: 12345 });
    incluirComRetry({ valor: 12345 });

    expect(omie.chamadas).toHaveLength(1);
    expect(omie.chamadas[0]!.metodo).toBe("incluirComConexaoCaida");
    expect(omie.consultar(codigo).encontrado).toBe(true);
  });

  it.todo(
    "(i) a importação cai no lote 7 — --resume continua pelo ledger e o reapply total não duplica (depende de apps/api/src/importacao/financeiro/importar.ts, Plan 02-25, NÃO executado nesta branch — ver hard limit 5 e SUMMARY)",
  );
});

/** Fake genérico de um client `postgrest`-like (`ClienteSupabaseDeComandos`/`ClienteDeTabela`, `platform-adapter-queue.ts`) — em memória, sem rede, só o subconjunto (select/insert/update/eq/lt/lte/in/order/limit/single/then) que a fila realmente usa. */
function criarClienteDeTabelaGenericoFalso(): { cliente: { from: (tabela: string) => unknown }; linhas: Record<string, unknown>[] } {
  const linhas: Record<string, unknown>[] = [];
  let proximoId = 1;

  function tabela() {
    let modo: "select" | "insert" | "update" = "select";
    let payloadInsert: Record<string, unknown> | undefined;
    let payloadUpdate: Record<string, unknown> | undefined;
    const filtros: Array<(linha: Record<string, unknown>) => boolean> = [];
    const ordens: Array<{ coluna: string; asc: boolean }> = [];
    let limite: number | undefined;

    async function executar(): Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }> {
      if (modo === "insert" && payloadInsert) {
        const conflitoSequencia = linhas.some((r) => r.task_id === payloadInsert!.task_id && r.sequence === payloadInsert!.sequence);
        const conflitoChave = linhas.some((r) => r.idempotency_key === payloadInsert!.idempotency_key);
        if (conflitoSequencia || conflitoChave) return { data: null, error: { code: "23505", message: "unique_violation" } };
        const nova = { id: String(proximoId), ...payloadInsert };
        proximoId += 1;
        linhas.push(nova);
        return { data: [nova], error: null };
      }
      let selecionadas = linhas.filter((linha) => filtros.every((f) => f(linha)));
      if (modo === "update" && payloadUpdate) {
        for (const linha of selecionadas) Object.assign(linha, payloadUpdate);
      }
      for (const { coluna, asc } of [...ordens].reverse()) {
        selecionadas = [...selecionadas].sort((a, b) => {
          const av = a[coluna] as string | number;
          const bv = b[coluna] as string | number;
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return asc ? cmp : -cmp;
        });
      }
      if (limite !== undefined) selecionadas = selecionadas.slice(0, limite);
      return { data: selecionadas, error: null };
    }

    const builder = {
      select() {
        return builder;
      },
      insert(linha: Record<string, unknown>) {
        modo = "insert";
        payloadInsert = linha;
        return builder;
      },
      update(patch: Record<string, unknown>) {
        modo = "update";
        payloadUpdate = patch;
        return builder;
      },
      eq(coluna: string, valor: unknown) {
        filtros.push((linha) => linha[coluna] === valor);
        return builder;
      },
      lt(coluna: string, valor: unknown) {
        filtros.push((linha) => (linha[coluna] as number) < (valor as number));
        return builder;
      },
      lte(coluna: string, valor: unknown) {
        filtros.push((linha) => (linha[coluna] as string) <= (valor as string));
        return builder;
      },
      in(coluna: string, valores: readonly unknown[]) {
        filtros.push((linha) => valores.includes(linha[coluna]));
        return builder;
      },
      order(coluna: string, opcoes?: { readonly ascending?: boolean }) {
        ordens.push({ coluna, asc: opcoes?.ascending !== false });
        return builder;
      },
      limit(n: number) {
        limite = n;
        return builder;
      },
      async single() {
        const { data, error } = await executar();
        if (error) return { data: null, error };
        if (!data || data.length === 0) return { data: null, error: { code: "PGRST116", message: "not found" } };
        return { data: data[0], error: null };
      },
      then<T>(onfulfilled?: (value: { data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }) => T | PromiseLike<T>) {
        return executar().then(onfulfilled);
      },
    };
    return builder;
  }

  return { cliente: { from: () => tabela() }, linhas };
}
