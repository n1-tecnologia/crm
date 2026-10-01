/**
 * `app.inject()` sobre `POST /v1/integrations/payment-approvals/classifications`
 * (Plan 02-24) — os casos (a)-(k) do plano, provando SOL-08: o comentário
 * decide pela MESMA operação de domínio do clique (`decideProcessApproval`),
 * nunca por um caminho de negócio paralelo, e nunca com o autor declarado
 * pelo corpo (T-02-18).
 *
 * Mesmo modelo de isolamento de `./integracao-solicitacoes.test.ts`: parte
 * sem banco ((a)-(c), schema/auth validados ANTES de qualquer hidratação)
 * roda sempre; parte com banco ((d)-(k)) pula sem `DATABASE_URL`, com
 * `RUN`/`WORKSPACE` por execução e `limparTudo()` em `beforeAll` E `afterAll`.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SOL, usuarioDoSeed } from "@n1/dominio";
import { nextId } from "@n1/dominio/operations/activity";
import { decideProcessApproval, solicitarAprovacao } from "@n1/dominio/operations/ai";
import { addTaskComment, createTask } from "@n1/dominio/operations/tasks";
import { buildSeed } from "@n1/dominio/seed";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar, semear } from "../persistencia/repositorio";
import type { ResolverCredencial } from "../plugins/autenticacao-servico";
import { relogioFixo } from "../testes/relogio";

const LISTA_ID = "lst_solicitacoes_de_pagamento";
const MARYANE_USER = usuarioDoSeed("mem_maryane");

const semente = buildSeed();
const MEMBRO_SERVICO = semente.members.find((m) => m.userId === MARYANE_USER);
if (!MEMBRO_SERVICO) throw new Error("seed sem mem_maryane — fixture do teste ficou desatualizada");

const evolucao = evoluirConfiguracaoDeSolicitacoes(semente, MEMBRO_SERVICO.id);
if (!evolucao.ok) throw new Error(`evoluirConfiguracaoDeSolicitacoes falhou no setup do teste: ${evolucao.error}`);

// APROVADOR — Proprietário do Espaço (`role_prop`): sempre autorizado, em
// qualquer Lista, por administrar/proprietário (RN-SP-05).
const APROVADOR = semente.members.find((m) => m.id === "mem_thiago");
if (!APROVADOR) throw new Error("seed sem mem_thiago — fixture do teste ficou desatualizada");

// Um Membro comum, NEM o aprovador designado, NEM administrador/proprietário — o caso (e).
const MEMBRO_NAO_AUTORIZADO = semente.members.find((m) => m.id === "mem_julia");
if (!MEMBRO_NAO_AUTORIZADO) throw new Error("seed sem mem_julia — fixture do teste ficou desatualizada");

interface FixtureDeTopico {
  readonly taskId: string;
  readonly raizId: string;
  readonly respostaId: string;
  readonly approvalId: string;
}

/**
 * Cria uma Tarefa na Lista, o Comentário de roteamento (raiz) e a
 * `ApprovalRequest` de processo (`solicitarAprovacao`, move a Tarefa para
 * "em aprovação"). Tudo em memória, ANTES de `semear()` copiar para o
 * Postgres real (mesmo padrão de `COMENTARIO_RAIZ` em
 * `./integracao-solicitacoes.test.ts`).
 */
function criarTopicoBase(titulo: string): { readonly taskId: string; readonly raizId: string; readonly approvalId: string } {
  const criado = createTask(semente, MEMBRO_SERVICO!.id, { listId: LISTA_ID, title: titulo });
  if (!criado.ok) throw new Error(`createTask falhou no setup: ${criado.error}`);

  const raiz = addTaskComment(semente, MEMBRO_SERVICO!.id, criado.value.id, { content: `@Aprovador, para aprovação.` });
  if (!raiz.ok) throw new Error(`addTaskComment (raiz) falhou no setup: ${raiz.error}`);

  const aprovacao = solicitarAprovacao(semente, MEMBRO_SERVICO!.id, {
    taskId: criado.value.id,
    approverMemberId: APROVADOR!.id,
    threadCommentId: raiz.value.id,
  });
  if (!aprovacao.ok) throw new Error(`solicitarAprovacao falhou no setup: ${aprovacao.error}`);

  return { taskId: criado.value.id, raizId: raiz.value.id, approvalId: aprovacao.value.id };
}

/** `criarTopicoBase` + uma resposta no tópico, autorada por quem `autorId` indicar. */
function criarTopicoDeAprovacao(titulo: string, autorId: string, textoDaResposta = "Aprovado."): FixtureDeTopico {
  const base = criarTopicoBase(titulo);
  const resposta = addTaskComment(semente, autorId, base.taskId, {
    content: textoDaResposta,
    parentCommentId: base.raizId,
  });
  if (!resposta.ok) throw new Error(`addTaskComment (resposta) falhou no setup: ${resposta.error}`);
  return { ...base, respostaId: resposta.value.id };
}

// (d)/(i) — nenhum destes casos decide (todos são "sem efeito"), então
// compartilham a mesma Tarefa sem risco de um caso interferir no outro.
const TOPICO_JANELA = criarTopicoDeAprovacao("Solicitação de teste — janela/tópico", APROVADOR.id);
// (j) — sem prazo configurado a análise vale (checklist 3.3): decide, então tem Tarefa própria.
const TOPICO_SEM_PRAZO = criarTopicoDeAprovacao("Solicitação de teste — sem prazo", APROVADOR.id);

// (e) — resposta de quem não é o aprovador designado nem administrador/proprietário.
// O Espaço "Gestão" é privado (D-04 da spec, `seed-financeiro.ts`): sem uma
// concessão, `mem_julia` nem alcançaria a Tarefa para comentar. Uma concessão
// de `comentar` NA PRÓPRIA TAREFA (nunca na Lista) é o cenário real que a
// recusa de autorização do passo 5 precisa cobrir — ela vê e comenta, mas
// isso nunca a torna aprovadora (RN-SP-05, `taskWriteRefusal`/`derive.ts`).
const BASE_AUTOR_ERRADO = criarTopicoBase("Solicitação de teste — autor não autorizado");
semente.grants.push({
  id: nextId("grn"),
  workspaceId: semente.workspace.id,
  subjectKind: "member",
  subjectId: MEMBRO_NAO_AUTORIZADO.id,
  action: "comentar",
  resourceType: "task",
  resourceId: BASE_AUTOR_ERRADO.taskId,
  scope: "proprios",
  origin: "concessaoDireta",
  grantedBy: APROVADOR.id,
  grantedAt: "2026-01-01T00:00:00.000Z",
});
const respostaAutorErrado = addTaskComment(semente, MEMBRO_NAO_AUTORIZADO.id, BASE_AUTOR_ERRADO.taskId, {
  content: "Aprovado.",
  parentCommentId: BASE_AUTOR_ERRADO.raizId,
});
if (!respostaAutorErrado.ok) throw new Error(`addTaskComment (autor não autorizado) falhou no setup: ${respostaAutorErrado.error}`);
const TOPICO_AUTOR_ERRADO: FixtureDeTopico = { ...BASE_AUTOR_ERRADO, respostaId: respostaAutorErrado.value.id };

// (f)/(g)/(h)/(k) — decidido AO VIVO pela rota, uma vez por teste na ordem certa.
const TOPICO_COMENTARIO = criarTopicoDeAprovacao("Solicitação de teste — decisão por comentário", APROVADOR.id);
// (k) — decidido por CLIQUE direto no domínio, ANTES de `semear()`, para comparar com o de cima.
const TOPICO_CLIQUE = criarTopicoDeAprovacao("Solicitação de teste — decisão por clique", APROVADOR.id);
{
  const decisao = decideProcessApproval(semente, APROVADOR.id, TOPICO_CLIQUE.approvalId, "aprovada", { source: "click" });
  if (!decisao.ok) throw new Error(`decideProcessApproval (clique, setup) falhou: ${decisao.error}`);
}

const RUN = `teste_classificacoes_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;

interface CredencialDeTeste {
  readonly id: string;
  readonly segredo: string;
  readonly scopes: readonly string[];
}

const CREDENCIAL_ESCRITA: CredencialDeTeste = {
  id: RUN,
  segredo: "segredo-de-escrita",
  scopes: ["payment-requests:read", "payment-requests:write"],
};

function tokenDe(credencial: CredencialDeTeste): string {
  return `${credencial.id}.${credencial.segredo}`;
}

function resolverCredencialDeTeste(credenciais: readonly CredencialDeTeste[]): ResolverCredencial {
  return async (token) => {
    const corte = token.indexOf(".");
    if (corte <= 0) return undefined;
    const id = token.slice(0, corte);
    const segredo = token.slice(corte + 1);
    const achada = credenciais.find((c) => c.id === id);
    if (!achada || achada.segredo !== segredo) return undefined;
    return { id: achada.id, workspaceId: WORKSPACE, memberId: MEMBRO_SERVICO!.id, scopes: achada.scopes, state: "ativa" };
  };
}

function appDeTeste(relogioIso = "2026-01-15T00:00:00.000Z") {
  return buildApp({
    logger: false,
    workspaceId: WORKSPACE,
    resolverCredencial: resolverCredencialDeTeste([CREDENCIAL_ESCRITA]),
    classificacoes: { relogio: relogioFixo(relogioIso) },
  });
}

function corpoValido(overrides: Partial<{ eventId: string; commentId: string; decision: string; confidence: number }> = {}) {
  const eventId = overrides.eventId ?? randomUUID();
  return {
    corpo: {
      eventId,
      commentId: overrides.commentId ?? TOPICO_COMENTARIO.respostaId,
      decision: overrides.decision ?? "aprovado",
      confidence: overrides.confidence ?? 0.9,
    },
    eventId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Sem banco — auth e schema (D-DEC-09: roda sempre, antes de hidratar())
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /payment-approvals/classifications — sem banco", () => {
  it("(a) sem credencial de serviço responde 401 no envelope do contrato", async () => {
    const { corpo, eventId } = corpoValido();
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-approvals/classifications",
      headers: { "idempotency-key": eventId },
      payload: corpo,
    });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().error.code).toBe("CREDENCIAL_AUSENTE");
  });

  it("(b) corpo com actorId responde 400 (schema .strict() rejeita campo desconhecido)", async () => {
    const { corpo, eventId } = corpoValido();
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-approvals/classifications",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventId },
      payload: { ...corpo, actorId: "mem_thiago" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().error.code).toBe("SCHEMA_INVALIDO");
  });

  it("(c) decision 'irrelevante' responde 200 sem efeito, sem tocar o banco", async () => {
    const { corpo, eventId } = corpoValido({ decision: "irrelevante" });
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-approvals/classifications",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventId },
      payload: corpo,
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ aplicado: false, motivo: "irrelevante" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Com banco — a decisão de verdade (pula sem DATABASE_URL)
// ═══════════════════════════════════════════════════════════════════════════

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

async function limparTudo(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
  } finally {
    cliente.release();
  }
}

async function hidratarDeVerdade() {
  const cliente = await pool().connect();
  try {
    return (await hidratar(cliente, WORKSPACE)).state;
  } finally {
    cliente.release();
  }
}

d("POST /payment-approvals/classifications — com banco real", () => {
  let fallbackOriginal: string | undefined;

  beforeAll(async () => {
    fallbackOriginal = process.env.FALLBACK_COMENTARIO_ATE;
    // Dentro da janela por padrão — só (i)/(j) mexem nesta variável, e cada
    // um restaura antes de terminar.
    process.env.FALLBACK_COMENTARIO_ATE = "2099-01-01T00:00:00.000Z";

    await limparTudo();
    const cliente = await pool().connect();
    try {
      await semear(cliente, WORKSPACE, semente);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    if (fallbackOriginal === undefined) delete process.env.FALLBACK_COMENTARIO_ATE;
    else process.env.FALLBACK_COMENTARIO_ATE = fallbackOriginal;
    await limparTudo();
    await encerrar();
  });

  it("(d) comentário raiz (sem parentCommentId) responde fora_do_topico, sem decidir nada", async () => {
    const { corpo, eventId } = corpoValido({ commentId: TOPICO_JANELA.raizId });
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-approvals/classifications",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventId },
      payload: corpo,
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ aplicado: false, motivo: "fora_do_topico" });

    const state = await hidratarDeVerdade();
    const approval = state.approvals.find((a) => a.id === TOPICO_JANELA.approvalId);
    expect(approval?.decision).toBeUndefined();
  });

  it("(e) resposta de quem não é o aprovador nem administrador/proprietário responde autor_nao_autorizado", async () => {
    const { corpo, eventId } = corpoValido({ commentId: TOPICO_AUTOR_ERRADO.respostaId });
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-approvals/classifications",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventId },
      payload: corpo,
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ aplicado: false, motivo: "autor_nao_autorizado" });

    const state = await hidratarDeVerdade();
    const approval = state.approvals.find((a) => a.id === TOPICO_AUTOR_ERRADO.approvalId);
    expect(approval?.decision).toBeUndefined();
  });

  it("(i) relógio depois da data final responde fora_da_janela, nenhuma decisão", async () => {
    const original = process.env.FALLBACK_COMENTARIO_ATE;
    process.env.FALLBACK_COMENTARIO_ATE = "2026-01-01T00:00:00.000Z";
    try {
      const { corpo, eventId } = corpoValido({ commentId: TOPICO_JANELA.respostaId });
      const resposta = await appDeTeste("2026-06-01T00:00:00.000Z").inject({
        method: "POST",
        url: "/v1/integrations/payment-approvals/classifications",
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventId },
        payload: corpo,
      });
      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ aplicado: false, motivo: "fora_da_janela" });
    } finally {
      process.env.FALLBACK_COMENTARIO_ATE = original;
    }

    const state = await hidratarDeVerdade();
    const approval = state.approvals.find((a) => a.id === TOPICO_JANELA.approvalId);
    expect(approval?.decision).toBeUndefined();
  });

  it("(j) FALLBACK_COMENTARIO_ATE ausente: a análise vale e a resposta decide (checklist 3.3)", async () => {
    const original = process.env.FALLBACK_COMENTARIO_ATE;
    delete process.env.FALLBACK_COMENTARIO_ATE;
    try {
      const { corpo, eventId } = corpoValido({ commentId: TOPICO_SEM_PRAZO.respostaId });
      const resposta = await appDeTeste().inject({
        method: "POST",
        url: "/v1/integrations/payment-approvals/classifications",
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventId },
        payload: corpo,
      });
      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ aplicado: true });
    } finally {
      process.env.FALLBACK_COMENTARIO_ATE = original;
    }

    const state = await hidratarDeVerdade();
    const approval = state.approvals.find((a) => a.id === TOPICO_SEM_PRAZO.approvalId);
    expect(approval?.decision).toBe("aprovada");
    expect(approval?.decisionSource).toBe("comment");
  });

  it("(f)/(g)/(h)/(k) resposta do aprovador designado decide — idêntico ao clique, exceto decisionSource", async () => {
    // (f) — a primeira decisão de verdade.
    const { corpo: corpoAprovado, eventId: eventIdAprovado } = corpoValido({ commentId: TOPICO_COMENTARIO.respostaId });
    const primeira = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-approvals/classifications",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventIdAprovado },
      payload: corpoAprovado,
    });
    expect(primeira.statusCode).toBe(200);
    expect(primeira.json()).toEqual({ aplicado: true });

    const estadoAposF = await hidratarDeVerdade();
    const tarefaComentario = estadoAposF.tasks.find((t) => t.id === TOPICO_COMENTARIO.taskId)!;
    const aprovacaoComentario = estadoAposF.approvals.find((a) => a.id === TOPICO_COMENTARIO.approvalId)!;
    expect(tarefaComentario.statusId).toBe(SOL.status.aprovado);
    expect(aprovacaoComentario.decision).toBe("aprovada");
    expect(aprovacaoComentario.decisionSource).toBe("comment");
    expect(aprovacaoComentario.decidedByMemberId).toBe(APROVADOR.id);
    const comentarioCanonico = tarefaComentario.comments.find(
      (c) => c.parentCommentId === TOPICO_COMENTARIO.raizId && c.content.startsWith("✅ Aprovado por"),
    );
    expect(comentarioCanonico?.content).toBe(`✅ Aprovado por ${APROVADOR.displayName}`);

    // (g) — o MESMO eventId reenviado é replay: sem segundo comentário canônico.
    const segunda = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-approvals/classifications",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventIdAprovado },
      payload: corpoAprovado,
    });
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json()).toEqual({ aplicado: true, replay: true });

    const estadoAposG = await hidratarDeVerdade();
    const tarefaAposG = estadoAposG.tasks.find((t) => t.id === TOPICO_COMENTARIO.taskId)!;
    const canonicosAposG = tarefaAposG.comments.filter(
      (c) => c.parentCommentId === TOPICO_COMENTARIO.raizId && c.content.startsWith("✅ Aprovado por"),
    );
    expect(canonicosAposG.length).toBe(1);

    // (h) — a decisão OPOSTA depois de já decidida é 409, nada muda.
    const { corpo: corpoOposto, eventId: eventIdOposto } = corpoValido({
      commentId: TOPICO_COMENTARIO.respostaId,
      decision: "reprovado",
    });
    const terceira = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-approvals/classifications",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": eventIdOposto },
      payload: corpoOposto,
    });
    expect(terceira.statusCode).toBe(409);

    const estadoAposH = await hidratarDeVerdade();
    const aprovacaoAposH = estadoAposH.approvals.find((a) => a.id === TOPICO_COMENTARIO.approvalId)!;
    expect(aprovacaoAposH.decision).toBe("aprovada");

    // (k) — o TOPICO_CLIQUE foi decidido por clique direto no domínio, ANTES
    // de `semear()` (setup do módulo). Mesmo aprovador, mesma decisão —
    // idêntico ao de comentário, exceto `decisionSource`.
    const tarefaClique = estadoAposH.tasks.find((t) => t.id === TOPICO_CLIQUE.taskId)!;
    const aprovacaoClique = estadoAposH.approvals.find((a) => a.id === TOPICO_CLIQUE.approvalId)!;
    expect(tarefaClique.statusId).toBe(tarefaComentario.statusId);
    expect(aprovacaoClique.decision).toBe(aprovacaoComentario.decision);
    expect(aprovacaoClique.decidedByMemberId).toBe(aprovacaoComentario.decidedByMemberId);
    expect(aprovacaoClique.decisionSource).toBe("click");
    expect(aprovacaoClique.decisionSource).not.toBe(aprovacaoComentario.decisionSource);
    const comentarioCanonicoClique = tarefaClique.comments.find(
      (c) => c.parentCommentId === TOPICO_CLIQUE.raizId && c.content.startsWith("✅ Aprovado por"),
    );
    expect(comentarioCanonicoClique?.content).toBe(comentarioCanonico?.content);
  });
});
