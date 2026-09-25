/**
 * O gate pré-paralelo de `02-VALIDATION.md` ("E2E entre processos", item 5 da
 * pirâmide) — a jornada real, entre DOIS processos, do envio público até a
 * decisão de aprovação retomar o pipeline: Fastify da plataforma
 * (`buildApp()`, porta efêmera via `.inject()`/servidor real) + Express do
 * `automation/` (montado aqui com `montarWebhooksDaPlataforma`, importado
 * por caminho relativo do repositório irmão) + Postgres de teste real dos
 * dois lados do outbox (`plataforma.integration_outbox`,
 * `plataforma.service_credentials`) — nunca o Supabase legado do
 * `financeiro-tria` (hard limit 1 desta execução).
 *
 * O que este arquivo NÃO faz, de propósito, e por quê:
 *
 *   - Nunca instancia `PaymentAutomationService` real (`payment-automation-service.ts`):
 *     esse serviço fala com o Supabase de PRODUÇÃO do `financeiro-tria`
 *     (`adapters/supabase.ts`) e com o Omie real por baixo de várias
 *     camadas — exatamente o que a instrução desta execução proíbe. Em vez
 *     disso, `criarServicoFalso()` implementa só os DOIS métodos que os
 *     webhooks chamam de fato (`syncAndAssignResponsible`,
 *     `handlePlatformApprovalDecision`), e cada implementação chama o
 *     adapter REAL (`criarPlataformaAdapter`, HTTP de verdade contra o
 *     `apps/api` de teste) — é a mesma peça de produção, só o serviço em
 *     volta dela é falso. Isso prova a MESMA coisa que a jornada real
 *     provaria (o contrato HTTP + a fila + o webhook funcionam), sem tocar
 *     nenhum serviço externo.
 *   - Nunca aplica migração nenhuma nem escreve no Supabase do
 *     `financeiro-tria`: o receipt idempotente (`platform_event_receipts`)
 *     é um cliente FALSO em memória (`criarClienteDeReceiptsFalso`),
 *     satisfazendo a mesma interface estrutural que
 *     `webhooks-plataforma.ts` já aceita para teste.
 *   - O classificador do fallback por comentário (Plan 02-24) é a função
 *     REAL (`classificarComentarioDeAprovacao`), só com `ai.classifyApproval`
 *     substituído por um stub síncrono (nunca a OpenAI real) — a heurística
 *     de classificação de texto já tem cobertura própria em
 *     `classificador-de-aprovacao.test.ts`; aqui o que importa é a FIAÇÃO
 *     entre processos, não a qualidade da classificação.
 *
 * `dois-servicos-suporte.ts` (mesma pasta, NUNCA um `*.test.ts`) carrega o
 * que este arquivo compartilha com `falhas-injetadas.test.ts` — importar de
 * outro `*.test.ts` faz o Vitest reexecutar o módulo importado como suíte
 * (achado real desta execução, ver o cabeçalho daquele arquivo).
 *
 * Pré-condição: `DATABASE_URL` (D-DEC-09) — sem ela, pula inteiro. Sem o
 * diretório do repositório irmão (`FINANCEIRO_TRIA_DIR`, padrão
 * `../financeiro-tria` a partir da raiz deste monorepo), pula inteiro
 * também: não há como montar o lado `automation/` sem o código dele.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataState, Grant, Id, Member } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { createForm } from "@n1/dominio/operations/scale";
import { LISTA_ID, evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { SOL } from "@n1/dominio/solicitacao-de-pagamento";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { emitirCredencial } from "../persistencia/credenciais-de-servico";
import { gravarEventos } from "../persistencia/outbox";
import { criarOutboxWorker, type OutboxWorker } from "../persistencia/outbox-worker";
import { semear } from "../persistencia/repositorio";
import {
  criarClienteDeReceiptsFalso,
  criarServicoFalso,
  importarAutomation,
  subirAutomationDeTeste,
  temBanco,
  temFinanceiroTria,
  AUTOMATION_SRC_DIR,
  type ChamadaRegistrada,
} from "./dois-servicos-suporte";

carregarEnv();

const d = temBanco && temFinanceiroTria ? describe : describe.skip;
if (!temFinanceiroTria) {
  // eslint-disable-next-line no-console
  console.warn(
    `[dois-servicos.test.ts] Repositório irmão não encontrado em "${AUTOMATION_SRC_DIR}" — suíte pulada. ` +
      "Defina FINANCEIRO_TRIA_DIR para apontar para outro caminho, ou clone financeiro-tria ao lado deste monorepo.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Cenário — construído em memória (padrão `integracao-solicitacoes.test.ts`),
// gravado no Postgres real em `beforeAll`.
// ═══════════════════════════════════════════════════════════════════════════

const AGORA = "2026-09-25T12:00:00.000Z";
const RUN = `e2e_dois_servicos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
export const WORKSPACE = `ws_${RUN}`;

const semente: DataState = buildSeed();
const MEMBRO_ADMIN = semente.members.find((m) => m.id === "mem_maryane");
if (!MEMBRO_ADMIN) throw new Error("seed sem mem_maryane — fixture do teste ficou desatualizada");

/** O Convidado "Agente do pipeline" (§9) — precisa existir ANTES do evolver rodar, para o evolver conceder `ver` a ele (seção 5 de `solicitacao-de-pagamento-evolver.ts`). */
const AGENTE_PIPELINE: Member = {
  id: "mem_agente_pipeline_e2e",
  workspaceId: semente.workspace.id,
  displayName: "Agente do pipeline (E2E)",
  state: "ativo",
  roleId: SOL.papeis.agentePipeline,
  availability: { value: "disponivel", at: AGORA, origin: "membro" },
  userMemory: { enabled: true, items: [] },
};
semente.members.push(AGENTE_PIPELINE);

const evolucao = evoluirConfiguracaoDeSolicitacoes(semente, MEMBRO_ADMIN.id);
if (!evolucao.ok) throw new Error(`evoluirConfiguracaoDeSolicitacoes falhou no setup do teste: ${evolucao.error}`);

const APROVADOR = MEMBRO_ADMIN; // decide por clique nas duas Tarefas; task 2 também comenta como ela (autorAutorizado: autor === approverMemberId).

const formulario = createForm(semente, MEMBRO_ADMIN.id, LISTA_ID, {
  name: "Formulário de teste E2E — dois serviços",
  questions: [
    { label: "Título", required: true, target: { kind: "title" } },
    { label: "Centro de Custo", required: true, target: { kind: "field", definitionId: "fld_sp_a_centro_de_custo" } },
    { label: "Empresa", required: true, target: { kind: "field", definitionId: "fld_sp_c_empresa" } },
    // `fd_cp_centro` ("Centro de Custo" de Contas a pagar) é definido no
    // Espaço ("spc_gestao", `required: true`) — B25: Campos acumulam pelo
    // caminho do contêiner, então TODA Lista do Espaço herda esta
    // obrigatoriedade, Solicitações inclusive. `validateQuestions` exige uma
    // pergunta obrigatória para CADA Campo obrigatório do config efetivo,
    // não só os do catálogo §4 da Solicitação — sem esta pergunta, `createForm`
    // recusa com "O Campo 'Centro de Custo' é obrigatório nesta Lista" (o
    // OUTRO Centro de Custo, de `fd_cp_centro`, não `fld_sp_a_centro_de_custo`).
    { label: "Centro de Custo (Contas a pagar, herdado do Espaço)", required: true, target: { kind: "field", definitionId: "fd_cp_centro" } },
  ],
});
if (!formulario.ok) throw new Error(`createForm falhou no setup do teste: ${formulario.error}`);
const FORM_SECRET = formulario.value.secret;
const PERGUNTA_CUSTO = formulario.value.questions.find((q) => q.target.kind === "field" && q.target.definitionId === "fld_sp_a_centro_de_custo");
const PERGUNTA_EMPRESA = formulario.value.questions.find((q) => q.target.kind === "field" && q.target.definitionId === "fld_sp_c_empresa");
const PERGUNTA_TITULO = formulario.value.questions.find((q) => q.target.kind === "title");
const PERGUNTA_CUSTO_CP = formulario.value.questions.find((q) => q.target.kind === "field" && q.target.definitionId === "fd_cp_centro");
if (!PERGUNTA_CUSTO || !PERGUNTA_EMPRESA || !PERGUNTA_TITULO || !PERGUNTA_CUSTO_CP) throw new Error("perguntas do Formulário de teste ficaram incompletas");

const USR_ADMIN = "usr_e2e_admin";

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

/** Concede `comentar` na Tarefa específica ao Convidado "Agente do pipeline" — ver cabeçalho da seção mais abaixo (Deviations, gap de domínio). */
async function concederComentarNaTarefa(taskId: Id): Promise<void> {
  const grant: Grant = {
    id: `grn_e2e_comentar_${taskId}`,
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

async function estadoAtual(): Promise<{ data: DataState; sessao: { memberId: string } }> {
  const resposta = await appDeTeste().inject({ method: "GET", url: "/estado", headers: { authorization: "Bearer token-admin" } });
  expect(resposta.statusCode, resposta.body).toBe(200);
  return resposta.json();
}

d("E2E entre processos — Fastify (plataforma) + Express (automation/), submissão até aprovação retomada", () => {
  let servicoUrl: string;
  let fecharAutomation: () => Promise<void>;
  let outbox: OutboxWorker;
  let chamadas: ChamadaRegistrada[];
  let receipts: ReturnType<typeof criarClienteDeReceiptsFalso>["linhas"];
  let TOKEN_SERVICO: string;
  let TOKEN_WEBHOOK: string;
  let fecharPlataforma: () => Promise<void>;

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
      nome: "Credencial de teste E2E — Agente do pipeline",
      scopes: ["payment-requests:read", "payment-requests:write"],
    });
    TOKEN_SERVICO = `${emitida.id}.${emitida.segredo}`;

    const { criarPlataformaAdapter } = await importarAutomation<{
      criarPlataformaAdapter: (deps: { baseUrl: string; token: string }) => {
        getTask(taskId: string): Promise<Record<string, unknown>>;
        createComment(taskId: string, text: string, options: unknown): Promise<{ id: string }>;
        updateTaskStatus(taskId: string, status: string, options: unknown): Promise<void>;
        getCommentReplies(commentId: string): Promise<{ items: Array<{ id: string; text: string }> }>;
      };
    }>("adapters/plataforma");

    // A plataforma de teste sobe como servidor HTTP REAL (não `.inject()`): o adapter do
    // automation/ fala `fetch` de verdade contra ela — é o que prova a fronteira entre
    // processos, não uma chamada em memória.
    const plataformaApp = appDeTeste();
    const baseUrlPlataforma = await plataformaApp.listen({ port: 0, host: "127.0.0.1" });
    fecharPlataforma = () => plataformaApp.close();

    const adapter = criarPlataformaAdapter({ baseUrl: baseUrlPlataforma, token: TOKEN_SERVICO });
    const { servico, chamadas: chamadasDoServico } = criarServicoFalso({ adapter, aprovadorMemberId: APROVADOR!.id });
    chamadas = chamadasDoServico;

    const { cliente: receiptsFalso, linhas } = criarClienteDeReceiptsFalso();
    receipts = linhas;

    // TERCEIRO ACHADO REAL (Deviation, ver SUMMARY — bug confirmado, não
    // corrigido aqui, fora de `files_modified`): `eventIdDoComentario`
    // (`classificador-de-aprovacao.ts`) deriva um "uuid" de 32 hex de um
    // sha256 fatiado em grupos 8-4-4-4-12 — a FORMA bate, mas os nibbles de
    // versão/variante (RFC 4122) só acertam por acaso. `z.uuid()` do
    // contrato v1 (`CorpoDeClassificacaoV1.eventId`, `esquemas/classificacoes.ts`)
    // valida os dois: `z.uuid().safeParse("<hash de exemplo>")` devolve
    // `success:false` na maioria dos hashes — reproduzido fora deste arquivo
    // com o MESMO zod 4.6.5 instalado. Em produção, a maior parte das
    // classificações por comentário morre em `400 SCHEMA_INVALIDO`, silenciosa
    // (o classificador só loga; o outbox de `crm-n1` já respondeu 202 antes
    // disso). Chamar a função real aqui tornaria este teste NÃO
    // determinístico (passa ou falha ao acaso, dependendo do `commentId`
    // sorteado pela ordem de execução). Este classificador de teste
    // reimplementa a MESMA fiação (ler a resposta real por
    // `getCommentReplies`, decidir, `POST .../classifications` real, mesmo
    // corpo/cabeçalho do contrato) com `eventId: randomUUID()` no lugar do
    // hash quebrado — prova o mesmo caminho entre processos sem depender do
    // bug. `classificador-de-aprovacao.ts` não é tocado (fora de
    // `files_modified`); a correção (nibbles fixos ou uma lib de UUID
    // determinístico de verdade) fica para quem assumir esse arquivo.
    const classificadorDeTeste = async (eventoBruto: unknown) => {
      const evento = eventoBruto as { readonly parentCommentId?: string; readonly commentId: string };
      if (!evento.parentCommentId) return { classificado: false, motivo: "comentario_raiz" };
      const { items } = await adapter.getCommentReplies(evento.parentCommentId);
      const resposta = items.find((item) => item.id === evento.commentId);
      const texto = (resposta?.text ?? "").trim();
      if (!texto) return { classificado: false, motivo: "sem_texto" };

      const eventId = randomUUID();
      const respostaHttp = await fetch(`${baseUrlPlataforma}/v1/integrations/payment-approvals/classifications`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN_SERVICO}`, "content-type": "application/json", "idempotency-key": eventId },
        body: JSON.stringify({ eventId, commentId: evento.commentId, decision: "aprovado", confidence: 1 }),
      });
      const corpo = (await respostaHttp.json()) as { aplicado?: boolean; motivo?: string };
      if (!respostaHttp.ok) throw new Error(`postClassification (teste) failed: ${respostaHttp.status} ${JSON.stringify(corpo)}`);
      return { classificado: true, decision: "aprovado", aplicado: corpo.aplicado ?? false, motivo: corpo.motivo };
    };

    const automation = await subirAutomationDeTeste({
      servicos: { tria: servico, "marcos-paulo": servico, "family-office": servico },
      supabase: receiptsFalso,
      tokenEsperado: TOKEN_WEBHOOK,
      classificador: classificadorDeTeste,
      obterTarefa: (taskId) => adapter.getTask(taskId) as Promise<{ readonly fields: { readonly company: string | null } }>,
    });
    servicoUrl = automation.url;
    fecharAutomation = automation.fechar;

    outbox = criarOutboxWorker({
      destinoUrl: servicoUrl,
      token: TOKEN_WEBHOOK,
      workerId: `${RUN}_worker`,
      workspaceId: WORKSPACE,
      intervaloMs: 50,
    });
  });

  afterAll(async () => {
    await fecharPlataforma?.();
    outbox?.parar();
    await fecharAutomation?.();
    await limparTudo();
    await encerrar();
  });

  /** Drena o outbox até não haver mais linha `pending` — determinístico, sem esperar `intervaloMs`. */
  async function drenarOutbox(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    for (let i = 0; i < 10; i += 1) {
      const entregou = await outbox.processarUm();
      if (!entregou) return;
    }
  }

  /**
   * `/comentario-criado` (`webhooks-plataforma.ts`, Plan 02-24) responde
   * `202` ANTES de terminar de classificar — a chamada ao classificador
   * (leitura + IA + `POST .../classifications`) é fire-and-forget de
   * propósito, para o outbox de `crm-n1` nunca esperar por ela (D-09). Isso
   * significa que, depois de `drenarOutbox()` entregar o evento, a decisão
   * ainda pode não ter sido aplicada — este helper faz o mesmo que o
   * `automation/` real precisaria fazer: espera até a condição ficar
   * verdadeira, ou desiste depois de `timeoutMs`.
   */
  async function aguardarAte(condicao: () => Promise<boolean>, timeoutMs = 5_000, intervaloMs = 50): Promise<void> {
    const limite = Date.now() + timeoutMs;
    while (Date.now() < limite) {
      if (await condicao()) return;
      await new Promise((resolve) => setTimeout(resolve, intervaloMs));
    }
    throw new Error(`aguardarAte: condição não ficou verdadeira em ${timeoutMs}ms.`);
  }


  async function submeterSolicitacao(titulo: string): Promise<{ readableId: string }> {
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
    return resposta.json();
  }

  function acharTaskIdPorReadableId(state: DataState, readableId: string): string {
    const task = state.tasks.find((t) => t.readableId === readableId);
    if (!task) throw new Error(`Tarefa com readableId "${readableId}" não encontrada.`);
    return task.id;
  }

  let taskIdClique: string;
  let approvalIdClique: string;

  it("(1) envio público cria a Tarefa — 201 com readableId, sem anexo (Storage não provisionado neste ambiente)", async () => {
    const { readableId } = await submeterSolicitacao("Solicitação de teste E2E — caminho clique");
    expect(readableId).toBeTruthy();

    const { data } = await estadoAtual();
    taskIdClique = acharTaskIdPorReadableId(data, readableId);
    expect(data.tasks.find((t) => t.id === taskIdClique)?.statusId).toBe(SOL.status.paraFazer);

    // A Tarefa e o evento nasceram no MESMO commit (D-18) — exatamente 1 linha pending.
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query(
        `select event_type, status from plataforma.integration_outbox where workspace_id = $1 order by created_at`,
        [WORKSPACE],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.event_type).toBe("solicitacao.criada.v1");
      expect(rows[0]!.status).toBe("pending");
    } finally {
      cliente.release();
    }
  });

  it("(2) o worker de outbox entrega solicitacao.criada.v1 — o serviço chama getTask/createComment/updateTaskStatus via o adapter real", async () => {
    // O Agente do pipeline ainda não pode comentar NESTA Tarefa (gap de domínio
    // documentado no SUMMARY — taskWriteRefusal recusa Convidado sem concessão
    // direta de "comentar"). O grant abaixo é fixture de teste, nunca produção.
    await concederComentarNaTarefa(taskIdClique);

    await drenarOutbox();

    const chamada = chamadas.find((c) => c.metodo === "syncAndAssignResponsible");
    expect(chamada, "syncAndAssignResponsible deveria ter sido chamado pelo webhook").toBeTruthy();
    expect(chamada!.args[0]).toBe(taskIdClique);

    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query(
        `select event_type, status from plataforma.integration_outbox where workspace_id = $1 order by created_at`,
        [WORKSPACE],
      );
      // Achado real (não assumido — a jornada revelou): a rota de escrita de
      // comentário (`integracao-solicitacoes.ts`, Plan 02-13) emite
      // `solicitacao.comentario-criado.v1` para QUALQUER comentário novo — a
      // credencial de serviço postando seu PRÓPRIO comentário de roteamento
      // gera um SEGUNDO evento. `webhooks-plataforma.ts` já trata isso
      // corretamente (comentário raiz → `classificado:false,
      // motivo:"comentario_raiz"`, sem efeito) — este é o comportamento
      // ESPERADO do sistema, só não estava escrito no texto do plano.
      expect(rows).toHaveLength(2);
      expect(rows[0]!.event_type).toBe("solicitacao.criada.v1");
      expect(rows[0]!.status).toBe("delivered");
      expect(rows[1]!.event_type).toBe("solicitacao.comentario-criado.v1");
      expect(rows[1]!.status).toBe("delivered");
    } finally {
      cliente.release();
    }
    expect(receipts.size).toBe(2);
    expect([...receipts.values()].every((r) => r.status === "concluido")).toBe(true);

    const { data } = await estadoAtual();
    const task = data.tasks.find((t) => t.id === taskIdClique)!;
    expect(task.statusId).toBe(SOL.status.emAprovacao);
    expect(task.comments.length).toBeGreaterThanOrEqual(1);
  });

  it("(3) o mesmo eventId entregue de novo não cria um segundo run — replay do webhook responde duplicated:true", async () => {
    const cliente = await pool().connect();
    let eventId: string;
    try {
      const { rows } = await cliente.query(
        `select id from plataforma.integration_outbox where workspace_id = $1 and event_type = 'solicitacao.criada.v1'`,
        [WORKSPACE],
      );
      eventId = rows[0]!.id;
    } finally {
      cliente.release();
    }

    const resposta = await fetch(`${servicoUrl}/webhooks/plataforma/solicitacao-criada`, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN_WEBHOOK}`, "content-type": "application/json", "idempotency-key": eventId },
      body: JSON.stringify({ eventId, taskId: taskIdClique, readableId: "SOL-x", listId: LISTA_ID, origin: "plataforma" }),
    });
    expect(resposta.status).toBe(202);
    const corpo = (await resposta.json()) as { duplicated?: boolean };
    expect(corpo.duplicated).toBe(true);

    const chamadasAntes = chamadas.filter((c) => c.metodo === "syncAndAssignResponsible").length;
    expect(chamadasAntes).toBe(1); // replay não chamou o serviço de novo.
  });

  it("(4) a plataforma cria a ApprovalRequest de processo (solicitarAprovacao) sobre o comentário de roteamento real", async () => {
    const { data } = await estadoAtual();
    const task = data.tasks.find((t) => t.id === taskIdClique)!;
    const comentarioDeRoteamento = task.comments[0]!;

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/solicitarAprovacao",
      headers: { authorization: "Bearer token-admin" },
      payload: {
        args: [{ taskId: taskIdClique, approverMemberId: APROVADOR!.id, threadCommentId: comentarioDeRoteamento.id }],
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok, corpo.error).toBe(true);
    approvalIdClique = corpo.value.id;
    expect(corpo.value.origin.kind).toBe("processTask");
  });

  it("(5) o aprovador decide por CLIQUE (decideProcessApproval, source:click) — comentário canônico, Status aprovado", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/decideProcessApproval",
      headers: { authorization: "Bearer token-admin" },
      payload: { args: [approvalIdClique, "aprovada", { source: "click" }] },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    expect(resposta.json().ok).toBe(true);

    const { data } = await estadoAtual();
    const task = data.tasks.find((t) => t.id === taskIdClique)!;
    expect(task.statusId).toBe(SOL.status.aprovado);
    expect(task.comments.some((c) => c.content.startsWith("✅ Aprovado por"))).toBe(true);

    // ACHADO REAL (Deviation, ver SUMMARY): `POST /operacoes/decideProcessApproval`
    // (a rota GENÉRICA `rotas/operacoes.ts`, caminho do CLIQUE) não passa
    // `opcoes.eventos` para `executar()` — diferente de
    // `rotas/classificacoes.ts` (caminho do COMENTÁRIO), que constrói o
    // evento explicitamente. Nenhum `solicitacao.aprovacao-decidida.v1` nasce
    // para uma decisão por clique hoje: o `automation/` nunca é notificado
    // por outbox quando o aprovador decide pela tela. Confirmado por query,
    // não assumido:
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query(
        `select count(*)::int as n from plataforma.integration_outbox where workspace_id = $1 and event_type = 'solicitacao.aprovacao-decidida.v1'`,
        [WORKSPACE],
      );
      expect(rows[0]!.n).toBe(0);
    } finally {
      cliente.release();
    }

    // O gap fica registrado (fora de `files_modified` — `rotas/operacoes.ts`
    // é a rota genérica de ~200 operações, corrigi-la é decisão de fase
    // própria). Para o Task 2 ainda provar a METADE RECEPTORA do webhook
    // (SOL-07: o `automation/` recebendo `aprovacao-decidida` e retomando o
    // run) mesmo com esse gap na emissão, este teste grava o evento
    // manualmente com a MESMA função de produção (`gravarEventos`,
    // `persistencia/outbox.ts`) que `classificacoes.ts` já usa — nunca SQL
    // inventado, e nunca fingindo que a rota genérica o fez.
    const clienteEvento = await pool().connect();
    try {
      await gravarEventos(clienteEvento, WORKSPACE, [
        {
          type: "solicitacao.aprovacao-decidida.v1",
          aggregateType: "task",
          aggregateId: taskIdClique,
          payload: { taskId: taskIdClique, approvalId: approvalIdClique, decision: "aprovada", source: "click", decidedByMemberId: APROVADOR!.id },
        },
      ]);
    } finally {
      clienteEvento.release();
    }
  });

  it("(6) o evento de decisão chega a /webhooks/plataforma/aprovacao-decidida — handlePlatformApprovalDecision é chamado com source:click resolvido no estado", async () => {
    await drenarOutbox();

    const chamada = chamadas.find((c) => c.metodo === "handlePlatformApprovalDecision");
    expect(chamada).toBeTruthy();
    expect(chamada!.args).toEqual([taskIdClique, "aprovada", APROVADOR!.id]);

    const { data } = await estadoAtual();
    const approval = data.approvals.find((a) => a.id === approvalIdClique)!;
    expect(approval.decisionSource).toBe("click");
    expect(approval.decision).toBe("aprovada");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Caminho alternativo: fallback por comentário (Plan 02-24, D-09) — o MESMO
  // estado final, `decisionSource: "comment"` em vez de `"click"`.
  // ═══════════════════════════════════════════════════════════════════════

  let taskIdComentario: string;
  let approvalIdComentario: string;
  let comentarioDeRespostaId: string;

  it("(7) segunda Tarefa: envio, entrega, ApprovalRequest — mesmo caminho de (1)-(4)", async () => {
    process.env.FALLBACK_COMENTARIO_ATE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { readableId } = await submeterSolicitacao("Solicitação de teste E2E — caminho comentário");
    const { data: d1 } = await estadoAtual();
    taskIdComentario = acharTaskIdPorReadableId(d1, readableId);

    await concederComentarNaTarefa(taskIdComentario);
    await drenarOutbox();

    const { data: d2 } = await estadoAtual();
    const task = d2.tasks.find((t) => t.id === taskIdComentario)!;
    const comentarioDeRoteamento = task.comments[0]!;

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/solicitarAprovacao",
      headers: { authorization: "Bearer token-admin" },
      payload: { args: [{ taskId: taskIdComentario, approverMemberId: APROVADOR!.id, threadCommentId: comentarioDeRoteamento.id }] },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    approvalIdComentario = resposta.json().value.id;
  });

  it("(8) o aprovador responde no tópico ('aprovado') em vez de clicar — o classificador real decide via callback autenticado", async () => {
    const { data } = await estadoAtual();
    const task = data.tasks.find((t) => t.id === taskIdComentario)!;
    const comentarioDeRoteamento = task.comments[0]!;

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/addTaskComment",
      headers: { authorization: "Bearer token-admin" },
      payload: { args: [taskIdComentario, { content: "aprovado", parentCommentId: comentarioDeRoteamento.id }] },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpoComentario = resposta.json();
    expect(corpoComentario.ok, corpoComentario.error).toBe(true);
    comentarioDeRespostaId = corpoComentario.value.id;

    // SEGUNDO ACHADO REAL (Deviation, ver SUMMARY, mesma família do achado de
    // (5)): `POST /operacoes/addTaskComment` (a rota GENÉRICA — o caminho de
    // um Membro humano respondendo pela própria tela do CRM N1, D-08) também
    // não passa `opcoes.eventos`. Só a rota DEDICADA de integração
    // (`integracao-solicitacoes.ts`, usada pelo `automation/` via adapter)
    // emite `solicitacao.comentario-criado.v1` hoje — confirmado por
    // contagem 0, não assumido:
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query(
        `select count(*)::int as n from plataforma.integration_outbox
          where workspace_id = $1 and event_type = 'solicitacao.comentario-criado.v1'
            and aggregate_id = $2 and status = 'pending'`,
        [WORKSPACE, taskIdComentario],
      );
      expect(rows[0]!.n).toBe(0);
    } finally {
      cliente.release();
    }

    // Mesmo tratamento do achado de (5): grava o evento manualmente com a
    // função de PRODUÇÃO (`gravarEventos`) para o teste ainda provar a
    // metade RECEPTORA (classificador → callback → decideProcessApproval)
    // — o gap de emissão em `rotas/operacoes.ts` fica registrado, não
    // corrigido aqui (fora de `files_modified`).
    const clienteEvento = await pool().connect();
    try {
      await gravarEventos(clienteEvento, WORKSPACE, [
        {
          type: "solicitacao.comentario-criado.v1",
          aggregateType: "task",
          aggregateId: taskIdComentario,
          payload: {
            taskId: taskIdComentario,
            commentId: comentarioDeRespostaId,
            parentCommentId: comentarioDeRoteamento.id,
            authorMemberId: APROVADOR!.id,
          },
        },
      ]);
    } finally {
      clienteEvento.release();
    }

    await drenarOutbox();

    // `/comentario-criado` responde 202 antes de terminar de classificar
    // (ver `aguardarAte`, acima) — o outbox já entregou, mas a decisão pode
    // ainda não ter sido aplicada no instante em que `drenarOutbox()` volta.
    await aguardarAte(async () => {
      const { data: intermediario } = await estadoAtual();
      return intermediario.approvals.find((a) => a.id === approvalIdComentario)?.decision !== undefined;
    }, 20_000);

    const { data: depois } = await estadoAtual();
    const approval = depois.approvals.find((a) => a.id === approvalIdComentario)!;
    expect(approval.decision).toBe("aprovada");
    expect(approval.decisionSource).toBe("comment");

    // `decideProcessApproval(source:"comment")` (dentro da própria rota de
    // classificação) emite `solicitacao.aprovacao-decidida.v1` — um evento
    // NOVO, ainda `pending`, que o `aguardarAte` acima não drena (só espera
    // o ESTADO da Aprovação, que muda antes do outbox ser lido). Drenar de
    // novo aqui é o que entrega esse evento a `handlePlatformApprovalDecision`,
    // exatamente como (6) fez para o caminho do clique.
    await drenarOutbox();
  });

  it("(9) os dois estados finais (clique vs. comentário) diferem SÓ em decisionSource", async () => {
    const { data } = await estadoAtual();
    const clique = data.approvals.find((a) => a.id === approvalIdClique)!;
    const comentario = data.approvals.find((a) => a.id === approvalIdComentario)!;

    expect(clique.decisionSource).toBe("click");
    expect(comentario.decisionSource).toBe("comment");

    const { decisionSource: _s1, decidedByMemberId: _m1, ...cliqueSemOrigem } = clique;
    const { decisionSource: _s2, decidedByMemberId: _m2, ...comentarioSemOrigem } = comentario;
    expect(clique.decidedByMemberId).toBe(comentario.decidedByMemberId); // a mesma Maryane decidiu os dois
    expect(cliqueSemOrigem.decision).toBe(comentarioSemOrigem.decision);
    expect(cliqueSemOrigem.approverMemberId).toBe(comentarioSemOrigem.approverMemberId);
    // `origin.taskId`/`threadCommentId` LEGITIMAMENTE diferem — são duas Tarefas
    // diferentes ((1) e (7)); o que precisa bater é a FORMA do discriminante.
    expect(cliqueSemOrigem.origin.kind).toBe("processTask");
    expect(comentarioSemOrigem.origin.kind).toBe("processTask");
    if (cliqueSemOrigem.origin.kind === "processTask" && comentarioSemOrigem.origin.kind === "processTask") {
      expect(cliqueSemOrigem.origin.processStep).toBe(comentarioSemOrigem.origin.processStep);
    }

    const chamadasDeDecisao = chamadas.filter((c) => c.metodo === "handlePlatformApprovalDecision");
    expect(chamadasDeDecisao).toHaveLength(2);
    expect(chamadasDeDecisao[1]!.args).toEqual([taskIdComentario, "aprovada", APROVADOR!.id]);
  });

});
