/**
 * AI operations: approvals and automation publishing.
 * Ontology: documentos 17 and 19, B22, B77, B80, B88, B94, RN-AGE-*, RN-AUT-*.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type {
  Agent,
  ApprovalOrigin,
  ApprovalRequest,
  Automation,
  AutomationVersion,
  ChatAnchor,
  ChatMessage,
  ChatSession,
  Id,
} from "../types";
import { contactDisplayName, effectiveListConfig, memberSeesTask } from "../derive";
import { memberActor, nextId, recordActivity, systemActor } from "./activity";
import { addTaskComment, changeTaskStatus } from "./tasks";
// Os textos da Conferência, a impressão e a forma do código moram fora de
// `./financeiro` porque `./financeiro` importa daqui: os dois módulos-folha
// não importam `./financeiro` (06-11).
import { impressaoDeLancamento, lancamentoSemCodigo } from "./financeiro-base";
import { TEXTOS_DA_CONFERENCIA } from "./financeiro-textos";
import { nomeDeAgenteEmUso } from "./ia/agentes";
import { nomeDeAutomacaoColide } from "./ia/automacoes-editor";
import { validarAutomacao } from "./ia/automacoes-validacao";
import { recusaDeAdministrarAutomacao, recusaDeGovernarAgente } from "./ia/permissoes-ia";

const now = (): string => new Date().toISOString();

/**
 * D-06 — normaliza a ORIGEM de um registro de `ApprovalRequest`, hidratado ou
 * não. `apps/api/src/persistencia/repositorio.ts::hidratar` é um `JSON.parse`
 * genérico por coleção — sem conhecimento do domínio, ele não pode fazer esta
 * tradução. Por isso a normalização mora aqui, e é aplicada pelas operações
 * que leem `state.approvals` (`ensureApprovalsNormalized`, abaixo), na
 * primeira leitura de cada registro: uma `ApprovalRequest` gravada antes desta
 * fase chega da hidratação com `executionId`/`stepIndex`/`deadline` soltos,
 * sem `origin` — perder isso silenciosamente corromperia o histórico de
 * Aprovações de Agente (V02-03A).
 */
export function normalizeApprovalOrigin(bruto: unknown): ApprovalOrigin {
  const registro = (bruto ?? {}) as Record<string, unknown>;
  const origin = registro.origin as Record<string, unknown> | undefined;
  if (origin && typeof origin === "object" && typeof origin.kind === "string") {
    return origin as unknown as ApprovalOrigin;
  }
  return {
    kind: "agentExecution",
    executionId: registro.executionId as Id,
    stepIndex: registro.stepIndex as number,
    deadline: registro.deadline as string,
  };
}

/** Garante `origin` em todo registro de `state.approvals` antes de qualquer leitura. */
function ensureApprovalsNormalized(state: DataState): void {
  for (const approval of state.approvals) {
    if (!approval.origin) approval.origin = normalizeApprovalOrigin(approval);
  }
}

/**
 * D-09 — a mesma resolução de autorização que `decideApproval` e
 * `decideProcessApproval` compartilham: o aprovador designado, ou um Membro
 * com papel base administrador/proprietário. `extraOwnerId` é o dono do
 * Agente — só existe no ramo `agentExecution` (RN-SP-05 não tem esse dono).
 */
function mayDecideApproval(state: DataState, actingMemberId: Id, approverMemberId: Id, extraOwnerId?: Id): boolean {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return false;
  const role = state.roles.find((r) => r.id === member.roleId);
  return (
    approverMemberId === actingMemberId ||
    (extraOwnerId !== undefined && extraOwnerId === actingMemberId) ||
    role?.base === "administrador" ||
    role?.base === "proprietario"
  );
}

/**
 * Quem pode decidir a Conferência do Resumo — a régua ÚNICA, pelo fio e pela
 * tela (06-18, crm2:WR-03): alcança a conta (`memberSeesTask`) e é o
 * aprovador designado ou um Membro ativo de Papel base
 * Administrador/Proprietário (`mayDecideApproval`). Filtra as respostas do fio
 * (`respostasDeConferenciaPendentes`) e decide os botões do card; antes, o fio
 * lia `revisoresDoResumo` e o clique, o aprovador — e o aprovador de G3 sem
 * papel de Administrador respondia "ok" em silêncio.
 *
 * `decideProcessApproval` aplica o mesmo `mayDecideApproval`, e o alcance vem
 * da resposta canônica (`addTaskComment`, que recusa quem não alcança).
 */
export function podeDecidirAConferencia(
  state: DataState,
  memberId: Id,
  conferencia: { readonly approverMemberId: Id; readonly origin: { readonly taskId: Id } },
): boolean {
  return memberSeesTask(state, memberId, conferencia.origin.taskId) && mayDecideApproval(state, memberId, conferencia.approverMemberId);
}

/** O status do Conjunto de Status efetivo da Lista cujo nome bate exatamente. */
function resolveProcessStatusId(state: DataState, listId: Id, name: string): Id | undefined {
  return effectiveListConfig(state, listId)?.statusSet.definitions.find((d) => d.name === name)?.id;
}

/**
 * B80 / RN-AGE-17 — approving is approving EXACTLY the fixed object, and it
 * NEVER grants permission: the two checks of DO-HAB-14 are redone at the moment
 * of the approval. In the `permissao` reason, only whoever holds the required
 * permission may approve, and becomes the delegate of that step (DO-AGE-11).
 */
export function decideApproval(
  state: DataState,
  actingMemberId: Id,
  approvalId: Id,
  decision: "aprovada" | "rejeitada",
  reason?: string,
): OperationResult<ApprovalRequest> {
  ensureApprovalsNormalized(state);
  const approval = state.approvals.find((a) => a.id === approvalId);
  if (!approval) return fail("Solicitação de Aprovação não encontrada.");
  if (approval.origin.kind !== "agentExecution") {
    return fail("Esta Solicitação de Aprovação pertence a um processo; use a decisão de processo.");
  }
  const origin = approval.origin;
  if (approval.decision) {
    return fail(`Esta Solicitação já foi ${approval.decision}.`);
  }
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") {
    return fail("Só um Membro ativo decide uma Solicitação de Aprovação.");
  }

  const execution = state.agentExecutions.find((e) => e.id === origin.executionId);
  const agent = execution ? state.agents.find((a) => a.id === execution.agentId) : undefined;

  if (!mayDecideApproval(state, actingMemberId, approval.approverMemberId, agent?.ownerMemberId)) {
    return fail("Você não é o aprovador designado desta Solicitação.");
  }

  /**
   * The expiry is settled only AFTER authorization: it cancels the Execution,
   * and an actor with no right to decide must not be able to produce that
   * effect by asking. The expiry is an act of the System, and it carries its
   * own Registro de Atividade because it produces an effect (B80).
   */
  if (Date.parse(origin.deadline) < Date.now()) {
    approval.decision = "expirada";
    approval.decidedAt = now();
    if (execution) {
      execution.state = "cancelada";
      execution.terminationReason = "Tempo limite de aprovação vencido";
      execution.endedAt = now();
    }
    recordActivity(state, {
      actor: systemActor,
      action: "Solicitação de Aprovação expirada",
      objectType: "approvalRequest",
      objectId: approval.id,
      objectName: approval.object.toolId,
      before: "pendente",
      after: "expirada",
      detail: "Execução cancelada por tempo limite de aprovação",
    });
    return fail("O prazo desta Solicitação venceu e a Execução foi cancelada.");
  }

  approval.decision = decision;
  approval.decidedByMemberId = actingMemberId;
  approval.decidedAt = now();

  if (execution) {
    if (decision === "aprovada") {
      execution.state = "concluida";
      execution.endedAt = now();
      execution.steps.push({
        index: execution.steps.length,
        kind: "ferramenta",
        toolId: approval.object.toolId,
        input: approval.object.input,
        toolAllowed: true,
        resourcePermitted: true,
        effectClass: approval.object.effectClass,
        result: "concluido",
        approvalRequestId: approval.id,
        at: now(),
      });
    } else {
      execution.state = "falhou";
      execution.terminationReason = reason ?? "Solicitação recusada";
      execution.endedAt = now();
    }
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: decision === "aprovada" ? "Solicitação de Aprovação aprovada" : "Solicitação de Aprovação recusada",
    objectType: "approvalRequest",
    objectId: approval.id,
    objectName: approval.object.toolId,
    after: decision,
    ...(reason ? { detail: reason } : {}),
  });
  return ok(approval, approval.id);
}

export interface SolicitarAprovacaoInput {
  readonly taskId: Id;
  readonly approverMemberId: Id;
  readonly threadCommentId: Id;
  readonly reason?: string;
}

/**
 * D-06/D-07 — a aprovação de processo nasce ligada diretamente à Tarefa e ao
 * passo `pagamento`, sem `AgentExecution`. Quem é o Aprovador certo (Centro de
 * Custo e Valor, RN-SP-03) é resolvido ANTES de chamar esta operação — ela
 * recebe o aprovador já decidido (o catálogo da Lista é o Plan 02-06).
 */
export function solicitarAprovacao(
  state: DataState,
  actingMemberId: Id,
  input: SolicitarAprovacaoInput,
): OperationResult<ApprovalRequest> {
  ensureApprovalsNormalized(state);
  const task = state.tasks.find((t) => t.id === input.taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const approver = state.members.find((m) => m.id === input.approverMemberId);
  if (!approver || approver.state !== "ativo") {
    return fail("O Aprovador precisa ser um Membro ativo.");
  }
  const threadComment = task.comments.find((c) => c.id === input.threadCommentId && !c.deletedAt);
  if (!threadComment) {
    return fail("O Comentário de roteamento não existe nesta Tarefa.");
  }

  // Idempotência do roteamento — repetir para a mesma Tarefa não cria uma segunda pendência.
  // Uma Conferência do Resumo pendente (Fase 6) é outra coisa e não conta aqui.
  const existing = state.approvals.find(
    (a) => a.origin.kind === "processTask" && a.origin.processStep !== "resumo" && a.origin.taskId === input.taskId && a.decision === undefined,
  );
  if (existing) return ok(existing);

  const statusId = resolveProcessStatusId(state, task.listId, "em aprovação");
  if (!statusId) {
    return fail("Esta Lista não tem o status “em aprovação” configurado.");
  }
  const moved = changeTaskStatus(state, actingMemberId, task.id, statusId);
  if (!moved.ok) return fail(moved.error, moved.field);

  const approval: ApprovalRequest = {
    id: nextId("apr"),
    origin: { kind: "processTask", taskId: task.id, processStep: "pagamento", threadCommentId: threadComment.id },
    requestedBy: memberActor(actingMemberId),
    reason: "processo",
    object: {
      // D-06 — uma aprovação de processo não é uma Ferramenta.
      toolId: "",
      input: "",
      targetResourceType: "task",
      targetResourceId: task.id,
      effectClass: "escritaIrreversivel",
    },
    approverMemberId: input.approverMemberId,
    createdAt: now(),
  };
  state.approvals.push(approval);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Aprovação solicitada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    ...(input.reason ? { detail: input.reason } : {}),
  });
  return ok(approval);
}

export interface SolicitarConferenciaDoResumoInput {
  readonly taskId: Id;
  /** O raiz do fio do Resumo. */
  readonly threadCommentId: Id;
  /** O Comentário do Resumo que esta Conferência confere (o raiz, ou a resposta revisada). */
  readonly resumoCommentId: Id;
  readonly impressao: string;
  readonly lancamento: { readonly conta: string; readonly categoria: string; readonly codigo: string; readonly veredito: "resolvida" | "revisar" | "ausente" };
  readonly approverMemberId: Id;
  /**
   * 06-18 (crm2:WR-03): `false` quando a Conferência não aceita o "ok" pelo
   * fio (`AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO=false`); vai para
   * `origin.aprovacaoPeloFio`, que a tela lê. Ausente: o "ok" vale.
   */
  readonly aprovacaoPeloFio?: false;
}

/**
 * Fase 6 (Fluxo 5/6) — abre a Conferência do Resumo de uma Conta a pagar: a
 * `ApprovalRequest` de processo com `processStep: "resumo"`, que guarda a
 * tripla conta · categoria · código e a impressão de lançamento como DADO
 * (D6-10). Ao contrário de `solicitarAprovacao`, NÃO muda o Status: conferir o
 * Resumo não é um passo do fluxo de Status, é a condição para o lançamento.
 *
 * Toda Conferência pendente anterior da mesma Tarefa é cancelada no mesmo ato
 * ("Conferência superada"): vale sempre a do Resumo mais recente. Só o
 * domínio chama esta operação (`publicarResumoParaConferencia`), por isso ela
 * não está em `OPERACOES`.
 */
export function solicitarConferenciaDoResumo(
  state: DataState,
  actingMemberId: Id,
  input: SolicitarConferenciaDoResumoInput,
): OperationResult<ApprovalRequest> {
  ensureApprovalsNormalized(state);
  const task = state.tasks.find((t) => t.id === input.taskId);
  if (!task) return fail("Tarefa não encontrada.");
  const approver = state.members.find((m) => m.id === input.approverMemberId);
  if (!approver || approver.state !== "ativo") return fail("Quem confere o Resumo precisa ser um Membro ativo.");
  const existe = (id: Id) => task.comments.some((c) => c.id === id && !c.deletedAt);
  if (!existe(input.threadCommentId) || !existe(input.resumoCommentId)) {
    return fail("O Comentário do Resumo não existe nesta Tarefa.");
  }

  for (const anterior of state.approvals) {
    if (anterior.origin.kind !== "processTask" || anterior.origin.processStep !== "resumo") continue;
    if (anterior.origin.taskId !== task.id || anterior.decision !== undefined) continue;
    anterior.decision = "cancelada";
    anterior.decidedAt = now();
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Conferência superada",
      objectType: "approvalRequest",
      objectId: anterior.id,
      objectName: task.title,
      before: "pendente",
      after: "cancelada",
      detail: "Um Resumo mais recente foi publicado no mesmo fio",
    });
  }

  const { conta, categoria, codigo } = input.lancamento;
  const approval: ApprovalRequest = {
    id: nextId("apr"),
    origin: {
      kind: "processTask",
      taskId: task.id,
      processStep: "resumo",
      threadCommentId: input.threadCommentId,
      resumoCommentId: input.resumoCommentId,
      impressao: input.impressao,
      lancamento: { ...input.lancamento },
      ...(input.aprovacaoPeloFio === false ? { aprovacaoPeloFio: false as const } : {}),
    },
    requestedBy: memberActor(actingMemberId),
    reason: "processo",
    object: {
      toolId: "omie_lancar_conta_a_pagar",
      input: `${conta} · ${categoria} · ${codigo}`,
      targetResourceType: "task",
      targetResourceId: task.id,
      effectClass: "escritaIrreversivel",
    },
    approverMemberId: input.approverMemberId,
    createdAt: now(),
  };
  state.approvals.push(approval);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Conferência do Resumo aberta",
    objectType: "approvalRequest",
    objectId: approval.id,
    objectName: task.title,
    detail: `${conta} · ${categoria} · ${codigo}`,
  });
  return ok(approval, approval.id);
}

export interface DecideProcessApprovalOptions {
  readonly source: "click" | "comment";
  readonly reason?: string;
}

/**
 * D-09 — a decisão canônica que clique e comentário compartilham: publica a
 * resposta no tópico, grava a decisão, registra a Atividade com a fonte e só
 * então muda o Status. Repetir a MESMA decisão é sucesso idempotente; a
 * decisão oposta é conflito e nunca sobrescreve. D-11 — sem prazo: o ramo
 * `processTask` de `ApprovalOrigin` não tem `deadline`, então não há o que
 * expirar aqui — o timeout de Execução de Agente nunca alcança esta operação.
 */
export function decideProcessApproval(
  state: DataState,
  actingMemberId: Id,
  approvalId: Id,
  decision: "aprovada" | "rejeitada",
  options: DecideProcessApprovalOptions,
): OperationResult<ApprovalRequest> {
  ensureApprovalsNormalized(state);
  const approval = state.approvals.find((a) => a.id === approvalId);
  if (!approval) return fail("Solicitação de Aprovação não encontrada.");
  if (approval.origin.kind !== "processTask") {
    return fail("Esta Solicitação de Aprovação pertence a uma Execução de Agente; use a decisão de Agente.");
  }
  const origin = approval.origin;

  // Replay da MESMA decisão é sucesso idempotente, sem efeito nenhum (D-09).
  if (approval.decision === decision) return ok(approval);
  if (approval.decision) {
    const decisor = state.members.find((m) => m.id === approval.decidedByMemberId)?.displayName ?? "outro Membro";
    return fail(`Esta Solicitação já foi ${approval.decision} por ${decisor}.`);
  }

  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") {
    return fail("Só um Membro ativo decide uma Solicitação de Aprovação.");
  }
  if (!mayDecideApproval(state, actingMemberId, approval.approverMemberId)) {
    return fail("Você não é o aprovador designado desta Solicitação.");
  }

  if (decision === "rejeitada" && !options.reason?.trim()) {
    return fail("Rejeitar exige um motivo.", "reason");
  }

  const task = state.tasks.find((t) => t.id === origin.taskId);
  if (!task) return fail("A Tarefa desta Solicitação não existe mais.");

  if (origin.processStep === "resumo") {
    /**
     * Fase 6 (Fluxo 6) — a Conferência do Resumo. Clique e resposta no fio
     * convergem aqui e produzem o MESMO fato: a resposta canônica no fio, a
     * decisão gravada com a fonte e, na aprovação, o fio resolvido — como no
     * ClickUp. Nunca muda o Status: conferir o Resumo é a condição do
     * lançamento, não um passo do fluxo de Status (quem move para "lançado
     * omie" é `registrarLancamentoNoOmie`, depois do Omie).
     * Textos (`TEXTOS_DA_CONFERENCIA`): `✅ Resumo conferido por <nome>` e
     * `🔁 Ajuste pedido por <nome>: <motivo>`.
     *
     * Duas recusas SEM efeito (06-11), depois das guardas comuns e da
     * repetição idempotente: (1) a impressão de lançamento atual não é a da
     * Conferência ⇒ `recusaDesatualizada`, para as duas decisões (crm:WR-08);
     * (2) APROVAR um Resumo sem código de Categoria (`lancamentoSemCodigo`)
     * ⇒ `recusaSemCodigo` (crm:WR-03). O porquê: a Conferência afirma que
     * ALGUÉM conferiu ESTES dados, e `9.99.99` é preenchimento, não código.
     * Pedir ajuste continua aberto. Consequência para a ponte (06-12): a
     * dispensa D6-04 `sem-conferencia` de uma conta com Categoria `ausente`
     * passa a ser recusada — o lado seguro, porque lançar com `9.99.99` é
     * errado.
     */
    if (impressaoDeLancamento(state, task) !== origin.impressao) return fail(TEXTOS_DA_CONFERENCIA.recusaDesatualizada);
    if (decision === "aprovada" && lancamentoSemCodigo(origin.lancamento)) return fail(TEXTOS_DA_CONFERENCIA.recusaSemCodigo);

    const motivo = options.reason?.trim() ?? "";
    const texto = decision === "aprovada" ? TEXTOS_DA_CONFERENCIA.conferido(member.displayName) : TEXTOS_DA_CONFERENCIA.ajuste(member.displayName, motivo);
    const resposta = addTaskComment(state, actingMemberId, task.id, { content: texto, parentCommentId: origin.threadCommentId });
    if (!resposta.ok) return fail(resposta.error, resposta.field);

    approval.decision = decision;
    approval.decidedByMemberId = actingMemberId;
    approval.decidedAt = now();
    approval.decisionSource = options.source;
    if (motivo) approval.decisionReason = motivo;

    if (decision === "aprovada") {
      // Direto, sem a guarda de autor de `resolveTaskComment`: o fio é do
      // Agente, e quem o fecha é quem conferiu.
      const raiz = task.comments.find((c) => c.id === origin.threadCommentId && !c.deletedAt);
      if (raiz && !raiz.resolved) {
        raiz.resolved = { by: actingMemberId, at: now() };
        recordActivity(state, {
          actor: memberActor(actingMemberId),
          action: "Comentário resolvido",
          objectType: "task",
          objectId: task.id,
          objectName: task.title,
        });
      }
    }

    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Aprovação decidida",
      objectType: "approvalRequest",
      objectId: approval.id,
      objectName: task.title,
      after: decision,
      detail: `${options.source === "click" ? "por clique" : "por comentário"}${motivo ? ` — ${motivo}` : ""}`,
    });
    return ok(approval);
  }

  // D-09 — a resposta canônica é publicada como resposta ao tópico de roteamento, texto fixo.
  const texto = decision === "aprovada" ? `✅ Aprovado por ${member.displayName}` : `❌ Reprovado por ${member.displayName}`;
  const comentario = addTaskComment(state, actingMemberId, task.id, {
    content: texto,
    parentCommentId: origin.threadCommentId,
  });
  if (!comentario.ok) return fail(comentario.error, comentario.field);

  approval.decision = decision;
  approval.decidedByMemberId = actingMemberId;
  approval.decidedAt = now();
  approval.decisionSource = options.source;
  if (options.reason) approval.decisionReason = options.reason;

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Aprovação decidida",
    objectType: "approvalRequest",
    objectId: approval.id,
    objectName: task.title,
    after: decision,
    detail: `${options.source === "click" ? "por clique" : "por comentário"}${options.reason ? ` — ${options.reason}` : ""}`,
  });

  const statusName = decision === "aprovada" ? "aprovado" : "não aprovado";
  const statusId = resolveProcessStatusId(state, task.listId, statusName);
  if (!statusId) {
    return fail(`Esta Lista não tem o status “${statusName}” configurado.`);
  }
  const moved = changeTaskStatus(state, actingMemberId, task.id, statusId);
  if (!moved.ok) return fail(moved.error, moved.field);

  return ok(approval);
}

/**
 * RN-AUT-07 — publishing validates, WITHOUT effect on failure: trigger
 * compatible with the scope, at least one action, existing tools, `ativo`
 * agents the automation may execute, skills granted to the agent, and the
 * permission ceiling of the owner (RN-AUT-04). The rules live in
 * `validarAutomacao`, shared with the editor; the first problem is answered
 * with its block as `field`. DO-AUT-19 — publishing makes the previous
 * version `obsoleta` in the same act.
 */
export function publishAutomation(
  state: DataState,
  actingMemberId: Id,
  automationId: Id,
): OperationResult<AutomationVersion> {
  const automation = state.automations.find((a) => a.id === automationId);
  if (!automation) return fail("Automação não encontrada.");

  /**
   * Publicar exige `administrar` sobre a Automação (documento 12, 12.2 e a
   * tabela de 17.1). A verificação vem antes de qualquer validação do
   * rascunho para que quem não pode publicar não descubra, pela mensagem de
   * erro, o que falta nele.
   */
  const recusa = recusaDeAdministrarAutomacao(state, actingMemberId, automation, "publicar");
  if (recusa) return fail(recusa);

  const draft = automation.versions.find((v) => v.state === "rascunho");
  if (!draft) return fail("Não há rascunho para publicar.");

  const primeiro = validarAutomacao(state, automation, draft)[0];
  if (primeiro) return fail(primeiro.mensagem, primeiro.bloco);

  for (const version of automation.versions) {
    if (version.state === "publicada") version.state = "obsoleta";
  }
  draft.state = "publicada";
  draft.publishedBy = actingMemberId;
  draft.publishedAt = now();
  if (automation.lifecycle === "rascunho") automation.lifecycle = "ativo";

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Versão de Automação publicada",
    objectType: "automation",
    objectId: automation.id,
    objectName: automation.name,
    after: `versão ${draft.number}`,
  });
  return ok(draft);
}

/**
 * 17.1 — desarquivar é `administrar`; restaurar da lixeira é `excluir`, que
 * no protótipo é administrar. RN-AGE-02 — a lixeira não reservou o nome:
 * restaurar com colisão é rejeitado até renomear. É a frase que a ficha e o
 * catálogo mostram como `disabledReason` de Desarquivar/Restaurar.
 */
export function recusaDeRestaurarAgente(state: DataState, memberId: Id, agent: Agent): string | undefined {
  const recusa = recusaDeGovernarAgente(state, memberId, agent, "administrar");
  if (recusa) return recusa;
  const homonimo = nomeDeAgenteEmUso(state, agent.name, agent.id);
  if (homonimo) return `Já existe um Agente chamado “${homonimo.name}”: renomeie antes de restaurar (RN-AGE-02).`;
  return undefined;
}

/**
 * 17.1 e RN-AUT-03, a mesma pergunta para a Automação: `administrar`, e o
 * nome livre no escopo (a lixeira não reserva).
 */
export function recusaDeRestaurarAutomacao(state: DataState, memberId: Id, automation: Automation): string | undefined {
  const recusa = recusaDeAdministrarAutomacao(state, memberId, automation, "restaurar");
  if (recusa) return recusa;
  if (nomeDeAutomacaoColide(state, automation.scopeType, automation.scopeId, automation.name, automation.id)) {
    return `Já existe uma Automação chamada “${automation.name}” neste escopo: renomeie antes de restaurar (RN-AUT-03).`;
  }
  return undefined;
}

/**
 * B94 — restoring or unarchiving an Agent or an Automation NEVER returns it
 * directly to `ativo`: it returns to `pausado` when the previous state was
 * `ativo` or `pausado`; `rascunho` and `arquivado` come back as they were.
 * Permission and name collision (`recusaDeRestaurarAgente`) come first, so a
 * refusal has no effect.
 */
export function restoreAgent(state: DataState, actingMemberId: Id, agentId: Id): OperationResult<Agent> {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent) return fail("Agente não encontrado.");
  const recusa = recusaDeRestaurarAgente(state, actingMemberId, agent);
  if (recusa) return fail(recusa);
  if (agent.lifecycle !== "naLixeira" && agent.lifecycle !== "arquivado") return ok(agent);
  const previous = agent.lifecycleBeforeTrashAi ?? "ativo";
  agent.lifecycle = previous === "ativo" || previous === "pausado" ? "pausado" : previous;
  delete agent.lifecycleBeforeTrashAi;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Agente restaurado",
    objectType: "agent",
    objectId: agent.id,
    objectName: agent.name,
    after: agent.lifecycle,
    detail: "A reativação é ato explícito após revisão de referências.",
  });
  return ok(agent);
}

export function restoreAutomation(
  state: DataState,
  actingMemberId: Id,
  automationId: Id,
): OperationResult<Automation> {
  const automation = state.automations.find((a) => a.id === automationId);
  if (!automation) return fail("Automação não encontrada.");
  const recusa = recusaDeRestaurarAutomacao(state, actingMemberId, automation);
  if (recusa) return fail(recusa);
  if (automation.lifecycle !== "naLixeira" && automation.lifecycle !== "arquivado") return ok(automation);
  const previous = automation.lifecycleBeforeTrashAi ?? "ativo";
  automation.lifecycle = previous === "ativo" || previous === "pausado" ? "pausado" : previous;
  delete automation.lifecycleBeforeTrashAi;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Automação restaurada",
    objectType: "automation",
    objectId: automation.id,
    objectName: automation.name,
    after: automation.lifecycle,
  });
  return ok(automation);
}

/**
 * B83 — a Âncora é fixada na criação e é imutável como VALOR: ela guarda o nome
 * que o registro tinha no momento, para a Sessão continuar legível mesmo depois
 * de o registro ser renomeado ou mesclado.
 */
export function createChatSession(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly title: string;
    readonly mainAgentId?: Id;
    readonly anchor?: { readonly type: ChatAnchor["type"]; readonly id: Id };
    /** O Modelo desta Sessão; sem escolha, vale o do Agente. */
    readonly chosenModelId?: Id;
    /** A pasta em que a Sessão já nasce guardada. */
    readonly folderId?: Id;
    /** A Habilidade escolhida para a Sessão. */
    readonly skillId?: Id;
  },
): OperationResult<ChatSession> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") {
    return fail("Só um Membro ativo abre uma Sessão de Chat.");
  }
  if (!input.title.trim()) return fail("Dê um título à Sessão.", "titulo");

  if (input.chosenModelId) {
    const model = state.models.find((m) => m.id === input.chosenModelId);
    if (!model) return fail("Modelo não encontrado.", "modelo");
    if (model.discontinued) return fail(`O Modelo “${model.name}” foi descontinuado.`, "modelo");
  }
  if (input.skillId) {
    const skill = state.skills.find((k) => k.id === input.skillId);
    if (!skill) return fail("Habilidade não encontrada.", "habilidade");
    if (skill.lifecycle !== "ativo") return fail(`A Habilidade “${skill.name}” não está ativa.`, "habilidade");
  }
  if (input.folderId) {
    const folder = state.chatFolders.find((f) => f.id === input.folderId);
    if (!folder) return fail("Pasta não encontrada.", "pasta");
    if (folder.ownerMemberId !== actingMemberId) return fail("Esta pasta é de outro Membro.", "pasta");
  }

  if (input.mainAgentId) {
    const agent = state.agents.find((a) => a.id === input.mainAgentId);
    if (!agent) return fail("Agente não encontrado.", "agente");
    if (agent.lifecycle !== "ativo") return fail(`O Agente “${agent.name}” não está ativo.`, "agente");
  }

  let anchor: ChatAnchor | undefined;
  if (input.anchor) {
    const name = anchorName(state, input.anchor.type, input.anchor.id);
    if (name === undefined) return fail("O registro da Âncora não foi encontrado.", "ancora");
    anchor = { type: input.anchor.type, id: input.anchor.id, nameAtTheTime: name };
  }

  const session: ChatSession = {
    id: nextId("cht"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    ownerMemberId: actingMemberId,
    title: input.title.trim(),
    titleEdited: true,
    ...(anchor ? { anchor } : {}),
    ...(input.mainAgentId ? { mainAgentId: input.mainAgentId } : {}),
    ...(input.chosenModelId ? { chosenModelId: input.chosenModelId } : {}),
    ...(input.folderId ? { folderId: input.folderId } : {}),
    ...(input.skillId ? { skillId: input.skillId } : {}),
    toolRestriction: { toolIds: [], effectClasses: [] },
    messages: [],
    sharedWithMemberIds: [],
    sharedWithTeamIds: [],
  };
  state.chatSessions.push(session);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Sessão de Chat aberta",
    objectType: "chatSession",
    objectId: session.id,
    objectName: session.title,
    ...(anchor ? { detail: `Ancorada em ${anchor.nameAtTheTime}` } : {}),
  });
  return ok(session, session.id);
}

/**
 * Os ajustes da Sessão que a home oferece antes da primeira mensagem — pasta,
 * Habilidade, Modelo e Âncora — também para uma Sessão que já existe.
 *
 * B83 — a Âncora é fixada na criação. Uma Sessão sem Mensagem ainda não
 * começou: trocar a Âncora aí é parte de criar, não de reescrever. Com
 * Mensagem, a Âncora fecha.
 */
export function configureChatSession(
  state: DataState,
  actingMemberId: Id,
  sessionId: Id,
  input: {
    readonly folderId?: Id | null;
    readonly skillId?: Id | null;
    readonly chosenModelId?: Id | null;
    readonly mainAgentId?: Id | null;
    readonly anchor?: { readonly type: ChatAnchor["type"]; readonly id: Id } | null;
  },
): OperationResult<ChatSession> {
  const session = state.chatSessions.find((s) => s.id === sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.lifecycle !== "ativo") return fail("Esta Sessão não está ativa.");
  if (session.ownerMemberId !== actingMemberId) return fail("Só o dono ajusta a própria Sessão.");

  const mudancas: string[] = [];

  if (input.mainAgentId !== undefined) {
    if (input.mainAgentId) {
      const agent = state.agents.find((a) => a.id === input.mainAgentId);
      if (!agent) return fail("Agente não encontrado.", "agente");
      if (agent.lifecycle !== "ativo") return fail(`O Agente “${agent.name}” não está ativo.`, "agente");
      session.mainAgentId = agent.id;
      mudancas.push(`Agente ${agent.name}`);
    } else {
      delete session.mainAgentId;
      mudancas.push("Assistente padrão");
    }
  }

  if (input.folderId !== undefined) {
    if (input.folderId) {
      const folder = state.chatFolders.find((f) => f.id === input.folderId);
      if (!folder) return fail("Pasta não encontrada.", "pasta");
      if (folder.ownerMemberId !== actingMemberId) return fail("Esta pasta é de outro Membro.", "pasta");
      session.folderId = folder.id;
      mudancas.push(`pasta ${folder.name}`);
    } else {
      delete session.folderId;
      mudancas.push("sem pasta");
    }
  }
  if (input.skillId !== undefined) {
    if (input.skillId) {
      const skill = state.skills.find((k) => k.id === input.skillId);
      if (!skill) return fail("Habilidade não encontrada.", "habilidade");
      if (skill.lifecycle !== "ativo") return fail(`A Habilidade “${skill.name}” não está ativa.`, "habilidade");
      session.skillId = skill.id;
      mudancas.push(`Habilidade ${skill.name}`);
    } else {
      delete session.skillId;
      mudancas.push("sem Habilidade");
    }
  }
  if (input.chosenModelId !== undefined) {
    if (input.chosenModelId) {
      const model = state.models.find((m) => m.id === input.chosenModelId);
      if (!model) return fail("Modelo não encontrado.", "modelo");
      if (model.discontinued) return fail(`O Modelo “${model.name}” foi descontinuado.`, "modelo");
      session.chosenModelId = model.id;
      mudancas.push(`Modelo ${model.name}`);
    } else {
      delete session.chosenModelId;
      mudancas.push("Modelo do Agente");
    }
  }
  if (input.anchor !== undefined) {
    if (session.messages.length > 0) {
      return fail("A Âncora é fixada na criação: com Mensagens, ela não muda.", "ancora");
    }
    if (input.anchor) {
      const name = anchorName(state, input.anchor.type, input.anchor.id);
      if (name === undefined) return fail("O registro da Âncora não foi encontrado.", "ancora");
      session.anchor = { type: input.anchor.type, id: input.anchor.id, nameAtTheTime: name };
      mudancas.push(`ancorada em ${name}`);
    } else {
      delete session.anchor;
      mudancas.push("sem Âncora");
    }
  }
  if (mudancas.length === 0) return ok(session);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Sessão de Chat ajustada",
    objectType: "chatSession",
    objectId: session.id,
    objectName: session.title,
    detail: mudancas.join(" · "),
  });
  return ok(session, session.id);
}

/**
 * B84 — a Mensagem de Chat é imutável: corrigir cria uma nova, nunca edita a
 * anterior. Por isso enviar só acrescenta.
 *
 * DO-CHT-09 — uma Sessão de terceiro não é acessível a ninguém, nem ao
 * Proprietário do Espaço de Trabalho; o compartilhamento explícito é a única
 * via, e ele dá leitura, não voz.
 */
export function sendChatMessage(
  state: DataState,
  actingMemberId: Id,
  sessionId: Id,
  content: string,
): OperationResult<ChatMessage> {
  const session = state.chatSessions.find((s) => s.id === sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.lifecycle !== "ativo") return fail("Esta Sessão não está ativa.");
  if (session.ownerMemberId !== actingMemberId) {
    return fail("Só o Proprietário da Sessão escreve nela; o compartilhamento dá leitura.");
  }
  if (!content.trim()) return fail("Escreva a mensagem antes de enviar.", "conteudo");

  const message: ChatMessage = {
    id: nextId("cmg"),
    order: session.messages.length,
    role: "usuario",
    author: memberActor(actingMemberId),
    content: content.trim(),
    fileIds: [],
    knowledgeReferences: [],
    complete: true,
    at: now(),
  };
  session.messages.push(message);
  return ok(message, message.id);
}

function anchorName(state: DataState, type: ChatAnchor["type"], id: Id): string | undefined {
  switch (type) {
    case "task":
      return state.tasks.find((t) => t.id === id)?.title;
    case "deal":
      return state.deals.find((d) => d.id === id)?.title;
    case "contact": {
      const contact = state.contacts.find((c) => c.id === id);
      return contact ? contactDisplayName(contact) : undefined;
    }
    case "company":
      return state.companies.find((c) => c.id === id)?.legalName;
    case "conversation":
      return state.conversations.find((c) => c.id === id)?.title;
    case "knowledgeDocument":
      return state.documents.find((d) => d.id === id)?.title;
    case "space":
      return state.spaces.find((s) => s.id === id)?.name;
    case "folder":
      return state.folders.find((f) => f.id === id)?.name;
    case "list":
      return state.lists.find((l) => l.id === id)?.name;
  }
}
