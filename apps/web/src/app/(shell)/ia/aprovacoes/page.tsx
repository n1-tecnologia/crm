"use client";

/**
 * T36 — Solicitações de Aprovação.
 *
 * D-08 — este é UM dos dois pontos de decisão (o outro é o card de Aprovação
 * na página cheia da Tarefa, `@/features/tarefa/painel-aprovacao`); os dois
 * chamam exatamente a mesma operação para cada origem.
 *
 * Duas origens coexistem na mesma fila, discriminadas por `origin.kind`
 * (D-06, união discriminada — Plan 02-04):
 *
 * B77 — `agentExecution` tem prazo, e um prazo vencido cancela a Execução. A
 * tela mostra o tempo restante e desliga a decisão quando o prazo passou, sem
 * o clique descobrir isso (PADROES §10). Comportamento inalterado desta fase.
 *
 * D-11 — `processTask` (Solicitação de pagamento) NUNCA mostra prazo,
 * contagem regressiva ou expiração: o tipo não tem o campo `deadline`, então
 * nenhum código aqui pode lê-lo por engano.
 *
 * Fase 6 — dentro de `processTask`, `origin.processStep` separa a Aprovação
 * da Solicitação (`"pagamento"`) da Conferência do Resumo de uma conta a
 * pagar (`"resumo"`): o card, os botões e os diálogos da Conferência vêm de
 * `@/features/tarefa/painel-conferencia-do-resumo`, e a decisão passa pelo
 * MESMO controlador (`useDecisaoDeAprovacao`). Uma Conferência só aparece a
 * quem alcança a conta (`memberSeesTask`): o estado hidratado é o Espaço
 * inteiro, e a conta mora numa Lista privada.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { executionChainOf, memberSeesTask, statusDefinition } from "@n1/dominio/derive";
import { conferenciaDoResumo, decideApproval } from "@n1/dominio/operations";
import { APPROVAL_REASON_LABEL, EFFECT_CLASS_LABEL, RESOURCE_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  DialogoAprovar,
  DialogoRejeitar,
  resumoDaSolicitacao,
  useDecisaoDeAprovacao,
} from "@/features/tarefa/painel-aprovacao";
import {
  DialogoConferir,
  DialogoPedirAjuste,
  faltaCodigoDaCategoria,
  podeConferirOResumo,
  resumoDaConta,
} from "@/features/tarefa/painel-conferencia-do-resumo";
import {
  Button,
  CategoryDot,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  PageHeader,
  Pilula,
  Section,
  TextArea,
  Toast,
} from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";
import type { ApprovalRequest } from "@n1/dominio/types";

/** D-06 — só o ramo `agentExecution` de `ApprovalOrigin` tem `executionId`/`deadline`. */
const approvalExecutionId = (approval: ApprovalRequest): string | undefined =>
  approval.origin.kind === "agentExecution" ? approval.origin.executionId : undefined;
const approvalDeadline = (approval: ApprovalRequest): string | undefined =>
  approval.origin.kind === "agentExecution" ? approval.origin.deadline : undefined;

/** Fase 6 — a Conferência do Resumo de uma conta a pagar (`processStep: "resumo"`). */
const ehConferenciaDoResumo = (approval: ApprovalRequest): boolean =>
  approval.origin.kind === "processTask" && approval.origin.processStep === "resumo";

/** A rejection is recorded on the Execution it stopped, not on the request. */
function terminationReasonOf(state: DataState, approval: ApprovalRequest): string {
  if (approval.decision !== "rejeitada") return "";
  const executionId = approvalExecutionId(approval);
  const execution = executionId ? state.agentExecutions.find((e) => e.id === executionId) : undefined;
  return execution?.terminationReason ? ` · ${execution.terminationReason}` : "";
}

/** §15 — the imported historical backlog (Plan 02-25) cannot render unbounded. */
const DECIDED_PAGE_SIZE = 20;

export default function AprovacoesPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { memberId } = useSession();
  const run = useRun();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decidedShown, setDecidedShown] = useState(DECIDED_PAGE_SIZE);
  const router = useRouter();
  const query = useSearchParams();
  /**
   * D09 — a decisão vive no endereço (`?aprovar=<solicitação>`): decidir uma
   * Aprovação é um passo que se compartilha ("olha isso antes de eu aprovar") e
   * que precisa sobreviver a um recarregamento. O mesmo endereço serve as duas
   * origens — só o conteúdo do diálogo muda.
   */
  const decidingRaw = query.get("aprovar");
  const [decidingId, decidingKind] = (() => {
    if (!decidingRaw) return [null, "rejeitada"] as const;
    const [id, kind] = decidingRaw.split(":");
    return [id ?? null, kind === "aprovada" ? "aprovada" : "rejeitada"] as const;
  })();
  const openDecision = (approvalId: string, kind: "aprovada" | "rejeitada" = "rejeitada") => {
    setReason("");
    router.replace(`?aprovar=${approvalId}:${kind}`, { scroll: false });
  };
  const closeDecision = () => {
    setReason("");
    router.replace("?", { scroll: false });
  };
  const [reason, setReason] = useState("");
  const [now] = useState(() => Date.now());

  const member = state.members.find((m) => m.id === memberId);
  const role = state.roles.find((r) => r.id === member?.roleId);
  const isAdminLevel = role?.base === "administrador" || role?.base === "proprietario";

  // Mirrors decideApproval: the designated approver, the Agent owner, or an admin.
  const mayDecide = (approval: ApprovalRequest): boolean => {
    if (approval.approverMemberId === memberId) return true;
    if (isAdminLevel) return true;
    const executionId = approvalExecutionId(approval);
    const execution = executionId ? state.agentExecutions.find((e) => e.id === executionId) : undefined;
    const agent = execution ? state.agents.find((a) => a.id === execution.agentId) : undefined;
    return agent?.ownerMemberId === memberId;
  };

  // Mirrors decideProcessApproval: the designated approver, or an admin — sem dono de Agente (RN-SP-05).
  const mayDecideProcesso = (approval: ApprovalRequest): boolean =>
    approval.approverMemberId === memberId || isAdminLevel;

  // Uma Conferência do Resumo só existe na fila de quem alcança a conta.
  const alcanca = (approval: ApprovalRequest): boolean =>
    approval.origin.kind !== "processTask" ||
    approval.origin.processStep !== "resumo" ||
    memberSeesTask(state, memberId, approval.origin.taskId);
  const pending = state.approvals.filter((approval) => approval.decision === undefined && alcanca(approval));
  const decided = [...state.approvals]
    .filter((approval) => approval.decision !== undefined && alcanca(approval))
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
  const mine = pending.filter((approval) => approval.approverMemberId === memberId);
  const others = pending.filter((approval) => approval.approverMemberId !== memberId);

  const decide = (approval: ApprovalRequest, decision: "aprovada" | "rejeitada", why?: string) => {
    const result = run((data, actingMemberId) =>
      decideApproval(data, actingMemberId, approval.id, decision, why),
    );
    if (result.ok) {
      setError(null);
      setNotice(decision === "aprovada" ? "Solicitação aprovada; a Execução retomou." : "Solicitação rejeitada.");
      closeDecision();
      setReason("");
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  /**
   * A Solicitação é uma peça de bloco que NÃO clica: quem clica são os botões
   * dentro dela. Subir no hover prometeria um clique que não existe.
   */
  const renderAgentCard = (approval: ApprovalRequest) => {
    const actionable = mayDecide(approval);
    const deadline = approvalDeadline(approval);
    const expired = deadline !== undefined && Date.parse(deadline) < now;
    const executionId = approvalExecutionId(approval);
    const execution = executionId ? state.agentExecutions.find((e) => e.id === executionId) : undefined;
    const approver = state.members.find((m) => m.id === approval.approverMemberId);
    const chain = execution ? executionChainOf(state, execution.id) : [];

    return (
      <li key={approval.id} className="item-solto" data-bloco="true" data-estatico="true">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="app-meta mb-1">
              <Pilula tom="acento" comPonto>
                Execução de Agente
              </Pilula>
            </p>
            <p className="app-md" style={{ color: "var(--texto)" }}>
              {state.tools.find((t) => t.id === approval.object.toolId)?.name ?? approval.object.toolId}
            </p>
            <p className="app-meta mt-0.5">
              classe de efeito {EFFECT_CLASS_LABEL[approval.object.effectClass] ?? approval.object.effectClass}{" "}
              · motivo: {APPROVAL_REASON_LABEL[approval.reason] ?? approval.reason} · aprovador {approver?.displayName ?? "não encontrado"}
            </p>
          </div>
          <span className="app-sm app-numero shrink-0" style={{ color: expired ? "var(--erro)" : "var(--texto-3)" }}>
            {expired
              ? `prazo vencido em ${fmt.instant(deadline!)}`
              : deadline
                ? `vence ${fmt.relative(deadline, now)}`
                : "sem prazo"}
          </span>
        </div>

        <pre
          className="app-sm mt-3 overflow-x-auto rounded-[var(--r-controle)] p-3"
          style={{ background: "var(--superficie-2)", border: "1px solid var(--linha)", color: "var(--texto)" }}
        >
          {approval.object.input}
        </pre>

        {chain.length > 0 ? (
          <p className="app-meta mt-2">
            Cadeia: {chain.map((link) => link.name).join(" → ")}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() => openDecision(approval.id, "aprovada")}
              disabled={!actionable || expired}
              disabledReason={
                expired
                  ? "O prazo desta Solicitação venceu; a Execução foi cancelada."
                  : "Só o aprovador designado, o Proprietário do Agente ou um Administrador decide esta Solicitação."
              }
            >
              Aprovar
            </Button>
            <Button
              variant="danger"
              onClick={() => openDecision(approval.id, "rejeitada")}
              disabled={!actionable || expired}
              disabledReason={
                expired
                  ? "O prazo desta Solicitação venceu; a Execução foi cancelada."
                  : "Só o aprovador designado, o Proprietário do Agente ou um Administrador decide esta Solicitação."
              }
            >
              Rejeitar
            </Button>
            {execution ? (
              <Link href={`/ia/execucoes/${execution.id}`} className="btn btn-sutil btn-sm">
                Ver a Execução
              </Link>
            ) : null}
        </div>
      </li>
    );
  };

  /**
   * UI-SPEC "Fila de aprovações · Card de Solicitação de pagamento": nunca
   * CPF/CNPJ completo, chave Pix, código de barras ou RESUMO — esses dados
   * ficam restritos à Tarefa autorizada. D-11 — nenhuma contagem regressiva
   * nem data-limite: o tipo `origin` deste ramo não carrega esse campo.
   */
  const renderConferenciaCard = (approval: ApprovalRequest) => {
    if (approval.origin.kind !== "processTask" || approval.origin.processStep !== "resumo") return null;
    const origin = approval.origin;
    const task = state.tasks.find((t) => t.id === origin.taskId);
    if (!task) return null;
    // O estado vem do domínio: só a Conferência VIGENTE e pendente para os
    // dados atuais se decide; uma que a conta deixou para trás espera o Resumo novo.
    const atual = conferenciaDoResumo(state, task);
    const conferencia = atual.conferencia;
    const vigentePendente = conferencia?.id === approval.id && atual.estado === "pendente";
    const actionable = conferencia !== undefined && podeConferirOResumo(state, memberId, conferencia);
    const definition = statusDefinition(state, task.listId, task.statusId);
    const resumo = resumoDaConta(task, state, fmt);
    const aprovador = state.members.find((m) => m.id === approval.approverMemberId);
    const disabledReason = `Somente ${aprovador?.displayName ?? "o aprovador designado"} ou um Administrador confere este Resumo.`;

    return (
      <li key={approval.id} className="item-solto" data-bloco="true" data-estatico="true">
        <div className="grid w-full gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pilula tom="aviso" comPonto>
              Conferência do Resumo
            </Pilula>
            <span className="identificador app-sm" style={{ color: "var(--texto-3)" }}>
              {task.readableId ?? task.id}
            </span>
            {definition ? <CategoryDot color={definition.color} label={definition.name} /> : null}
            <span className="app-numero app-sm ml-auto shrink-0" style={{ color: "var(--texto)" }}>
              {resumo.valorTexto}
            </span>
          </div>

          <p className="app-base" style={{ color: "var(--texto)" }}>
            Conferir Resumo de pagamento — {resumo.numero}
          </p>
          <p className="app-sm" style={{ color: "var(--texto-2)" }}>
            {task.title}
          </p>

          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            <span className="app-sm" style={{ color: "var(--texto-2)" }}>
              Lançamento: {origin.lancamento.conta} · {origin.lancamento.categoria} · {origin.lancamento.codigo}
            </span>
            <span className="app-sm" style={{ color: "var(--texto-2)" }}>
              Fornecedor: {resumo.fornecedor}
            </span>
            {resumo.vencimento !== "—" ? (
              <span className="app-sm" style={{ color: "var(--texto-2)" }}>
                Vencimento: {resumo.vencimento}
              </span>
            ) : null}
          </div>

          <p className="app-meta">
            Aguardando {aprovador?.displayName ?? "—"} · {fmt.relative(approval.createdAt, now)}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {vigentePendente ? (
              <>
                {conferencia && faltaCodigoDaCategoria(conferencia) ? (
                  // 06-14 (crm:WR-03) — sem código de Categoria não se confere: só o pedido de ajuste.
                  <span className="app-sm" style={{ color: "var(--texto-2)" }}>
                    Peça ajuste com o código da Categoria.
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => openDecision(approval.id, "aprovada")}
                    disabled={!actionable}
                    disabledReason={disabledReason}
                  >
                    Conferir
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => openDecision(approval.id, "rejeitada")}
                  disabled={!actionable}
                  disabledReason={disabledReason}
                >
                  Pedir ajuste
                </Button>
              </>
            ) : (
              <span className="app-sm" style={{ color: "var(--texto-3)" }}>
                Os dados mudaram depois da conferência; um Resumo novo será publicado
              </span>
            )}
            <Link href={`/estrutura/tarefas/${task.id}`} className="btn btn-sutil btn-sm">
              Abrir tarefa
            </Link>
          </div>
        </div>
      </li>
    );
  };

  const renderProcessCard = (approval: ApprovalRequest) => {
    if (approval.origin.kind !== "processTask") return null;
    if (approval.origin.processStep === "resumo") return renderConferenciaCard(approval);
    const origin = approval.origin;
    const task = state.tasks.find((t) => t.id === origin.taskId);
    if (!task) return null;
    const actionable = mayDecideProcesso(approval);
    const definition = statusDefinition(state, task.listId, task.statusId);
    const resumo = resumoDaSolicitacao(task, state, fmt);
    const aprovador = state.members.find((m) => m.id === approval.approverMemberId);
    const disabledReason = `Somente ${aprovador?.displayName ?? "o aprovador designado"} ou um Administrador pode decidir esta Solicitação.`;

    return (
      <li key={approval.id} className="item-solto" data-bloco="true" data-estatico="true">
        <div className="grid w-full gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pilula tom="info" comPonto>
              Solicitação de pagamento
            </Pilula>
            <span className="identificador app-sm" style={{ color: "var(--texto-3)" }}>
              {task.readableId ?? task.id}
            </span>
            {definition ? <CategoryDot color={definition.color} label={definition.name} /> : null}
            <span className="app-numero app-sm ml-auto shrink-0" style={{ color: "var(--texto)" }}>
              {resumo.valorTexto}
            </span>
          </div>

          <p className="app-base" style={{ color: "var(--texto)" }}>
            {task.title}
          </p>

          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            <span className="app-sm" style={{ color: "var(--texto-2)" }}>
              Centro de Custo: {resumo.centroDeCusto}
            </span>
            <span className="app-sm" style={{ color: "var(--texto-2)" }}>
              Fornecedor: {resumo.fornecedor}
            </span>
            <span className="app-sm" style={{ color: "var(--texto-2)" }}>
              Solicitante: {resumo.solicitante}
            </span>
            {resumo.vencimento !== "—" ? (
              <span className="app-sm" style={{ color: "var(--texto-2)" }}>
                Vencimento: {resumo.vencimento}
              </span>
            ) : null}
          </div>

          <p className="app-meta">
            {resumo.anexos} anexo(s) ·{" "}
            <Link href={`/estrutura/tarefas/${task.id}`} className="underline">
              Ver anexos
            </Link>
          </p>

          <p className="app-meta">
            Encaminhada para {aprovador?.displayName ?? "—"} · {fmt.relative(approval.createdAt, now)}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() => openDecision(approval.id, "aprovada")}
              disabled={!actionable}
              disabledReason={disabledReason}
            >
              Aprovar solicitação
            </Button>
            <Button
              variant="danger"
              onClick={() => openDecision(approval.id, "rejeitada")}
              disabled={!actionable}
              disabledReason={disabledReason}
            >
              Rejeitar solicitação
            </Button>
            <Link href={`/estrutura/tarefas/${task.id}`} className="btn btn-sutil btn-sm">
              Abrir tarefa
            </Link>
          </div>
        </div>
      </li>
    );
  };

  const renderPendingCard = (approval: ApprovalRequest) =>
    approval.origin.kind === "processTask" ? renderProcessCard(approval) : renderAgentCard(approval);

  const deciding = decidingId ? state.approvals.find((a) => a.id === decidingId) : undefined;
  const decidingOrigin = deciding?.origin;
  const decidingIsProcess = decidingOrigin?.kind === "processTask";
  const decidingProcessTaskId = decidingOrigin?.kind === "processTask" ? decidingOrigin.taskId : undefined;
  const decidingTask = decidingProcessTaskId ? state.tasks.find((t) => t.id === decidingProcessTaskId) : undefined;
  const decidingIsConferencia = deciding !== undefined && ehConferenciaDoResumo(deciding);
  const decidingConferencia =
    decidingIsConferencia && decidingTask ? conferenciaDoResumo(state, decidingTask).conferencia : undefined;
  const decidingResumo = decidingTask && !decidingIsConferencia ? resumoDaSolicitacao(decidingTask, state, fmt) : undefined;
  const decidingResumoDaConta = decidingTask && decidingIsConferencia ? resumoDaConta(decidingTask, state, fmt) : undefined;

  const controladorProcesso = useDecisaoDeAprovacao(decidingIsProcess ? (deciding?.id ?? undefined) : undefined, (decisao) => {
    closeDecision();
    setError(null);
    setNotice(
      decidingIsConferencia
        ? decisao === "aprovada"
          ? "Resumo conferido."
          : "Ajuste pedido; o Agente vai republicar o Resumo."
        : decisao === "aprovada"
          ? "Solicitação aprovada."
          : "Solicitação rejeitada.",
    );
  });

  const decidingDeadline = deciding && !decidingIsProcess ? approvalDeadline(deciding) : undefined;
  const decidingExpired = decidingDeadline !== undefined ? Date.parse(decidingDeadline) < now : false;
  const decidingTool = deciding && !decidingIsProcess
    ? (state.tools.find((t) => t.id === deciding.object.toolId)?.name ?? deciding.object.toolId)
    : "";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Aprovações" meta={`${mine.length} para você · ${pending.length} pendentes`} />

      {deciding && decidingIsProcess && decidingResumo ? (
        <>
          <DialogoAprovar
            open={decidingKind === "aprovada"}
            resumo={decidingResumo}
            processando={controladorProcesso.processando === "aprovada"}
            onConfirm={() => controladorProcesso.decidir("aprovada")}
            onCancel={closeDecision}
          />
          <DialogoRejeitar
            open={decidingKind === "rejeitada"}
            resumo={decidingResumo}
            processando={controladorProcesso.processando === "rejeitada"}
            motivo={reason}
            onMotivoChange={setReason}
            onConfirm={() => controladorProcesso.decidir("rejeitada", reason)}
            onCancel={closeDecision}
          />
        </>
      ) : null}

      {deciding && decidingIsConferencia && decidingResumoDaConta && decidingConferencia?.id === deciding.id ? (
        <>
          <DialogoConferir
            // Nem pelo link `?aprovar=<id>:aprovada`: sem código de Categoria não se confere (06-14, crm:WR-03).
            open={decidingKind === "aprovada" && !faltaCodigoDaCategoria(decidingConferencia)}
            resumo={decidingResumoDaConta}
            conferencia={decidingConferencia}
            processando={controladorProcesso.processando === "aprovada"}
            onConfirm={() => controladorProcesso.decidir("aprovada")}
            onCancel={closeDecision}
          />
          <DialogoPedirAjuste
            open={decidingKind === "rejeitada"}
            resumo={decidingResumoDaConta}
            conferencia={decidingConferencia}
            processando={controladorProcesso.processando === "rejeitada"}
            motivo={reason}
            onMotivoChange={setReason}
            onConfirm={() => controladorProcesso.decidir("rejeitada", reason)}
            onCancel={closeDecision}
          />
        </>
      ) : null}

      {deciding && !decidingIsProcess ? (
        <ConfirmDialog
          open
          title={
            decidingKind === "aprovada" ? `Aprovar: ${decidingTool}` : `Rejeitar: ${decidingTool}`
          }
          description={
            decidingKind === "aprovada"
              ? `Aprovar é aprovar exatamente este objeto, e ele tem classe de efeito ${
                  EFFECT_CLASS_LABEL[deciding.object.effectClass] ?? deciding.object.effectClass
                }${
                  deciding.object.effectClass === "externa"
                    ? " — o passo sai da plataforma e não volta atrás"
                    : ""
                }. As verificações são refeitas na decisão e ainda podem resultar em negada.`
              : "A rejeição interrompe a Execução e fica registrada nela com o motivo. A decisão é terminal: esta Solicitação não é decidida de novo."
          }
          confirmLabel={decidingKind === "aprovada" ? "Aprovar" : "Rejeitar"}
          cancelLabel="Voltar"
          destructive={decidingKind === "rejeitada"}
          {...(decidingExpired
            ? { confirmDisabledReason: "O prazo desta Solicitação venceu; a Execução foi cancelada." }
            : !mayDecide(deciding)
              ? {
                  confirmDisabledReason:
                    "Só o aprovador designado, o Proprietário do Agente ou um Administrador decide esta Solicitação.",
                }
              : decidingKind === "rejeitada" && reason.trim() === ""
                ? { confirmDisabledReason: "Escreva o motivo: ele fica na Execução que a rejeição interrompe." }
                : {})}
          onConfirm={() =>
            decidingKind === "aprovada"
              ? decide(deciding, "aprovada")
              : decide(deciding, "rejeitada", reason)
          }
          onCancel={closeDecision}
        >
          <div className="grid gap-3">
            <div>
              <p className="rotulo">Objeto, imutável</p>
              <pre
                className="app-sm overflow-x-auto rounded-[var(--r-controle)] p-3"
                style={{ background: "var(--superficie-2)", border: "1px solid var(--linha)", color: "var(--texto)" }}
              >
                {deciding.object.input}
              </pre>
              <p className="app-meta mt-1">
                Alvo: {RESOURCE_TYPE_LABEL[deciding.object.targetResourceType] ??
                  deciding.object.targetResourceType}{" "}
                · motivo: {APPROVAL_REASON_LABEL[deciding.reason] ?? deciding.reason}
                {decidingDeadline ? <> · vence {fmt.relative(decidingDeadline, now)}</> : null}
              </p>
            </div>

            {decidingKind === "rejeitada" ? (
              <Field label="Motivo da rejeição" hint="Fica registrado na Execução que ela interrompe.">
                {(id) => <TextArea id={id} value={reason} onChange={setReason} rows={2} />}
              </Field>
            ) : null}
          </div>
        </ConfirmDialog>
      ) : null}

      <CorpoDeTela>
        {notice ? (
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        ) : null}
        {error ? (
          <Toast tone="error" onDismiss={() => setError(null)}>
            {error}
          </Toast>
        ) : null}
        {controladorProcesso.erro ? (
          <Toast tone="error" onDismiss={controladorProcesso.limparErro}>
            {controladorProcesso.erro}
          </Toast>
        ) : null}

        <Section title="Aguardando a sua decisão" count={mine.length}>
          {mine.length === 0 ? (
            <EmptyState
              title="Nenhuma solicitação aguarda sua decisão."
              hint="Quando uma solicitação for encaminhada para você, ela aparecerá aqui."
            />
          ) : (
            <ul className="pilha-solta">{mine.map((approval) => renderPendingCard(approval))}</ul>
          )}
        </Section>

        <Section title="Aguardando outros aprovadores" count={others.length}>
          {others.length === 0 ? (
            <EmptyState
              title="Nenhuma solicitação aguarda outros aprovadores."
              hint="Quando outra pessoa precisar decidir, acompanhe a solicitação aqui ou abra a tarefa para consultar a timeline."
            />
          ) : (
            <ul className="pilha-solta">{others.map((approval) => renderPendingCard(approval))}</ul>
          )}
        </Section>

        <Section title="Decididas" count={decided.length}>
          {decided.length === 0 ? (
            <EmptyState
              title="Nenhuma solicitação foi decidida."
              hint="Depois de aprovar ou rejeitar uma solicitação, consulte aqui a decisão ou abra a tarefa para ver a timeline."
            />
          ) : (
            <>
              <ul className="pilha-solta">
                {decided.slice(0, decidedShown).map((approval) => {
                  const origin = approval.origin;
                  const isProcess = origin.kind === "processTask";
                  const task = origin.kind === "processTask" ? state.tasks.find((t) => t.id === origin.taskId) : undefined;
                  return (
                    <li key={approval.id} className="item-solto" data-estatico="true" data-atenuado="true">
                      <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                        {isProcess
                          ? (task?.title ?? "Tarefa removida")
                          : (state.tools.find((t) => t.id === approval.object.toolId)?.name ?? approval.object.toolId)}
                      </span>
                      <Pilula tom={approval.decision === "aprovada" ? "sucesso" : "neutro"} className="shrink-0">
                        {approval.decision}
                      </Pilula>
                      <span className="app-meta app-numero shrink-0">
                        {approval.decidedAt ? fmt.instant(approval.decidedAt) : ""}
                        {isProcess
                          ? ` · ${approval.decisionSource === "comment" ? "por comentário" : "por clique"}`
                          : terminationReasonOf(state, approval)}
                      </span>
                      {isProcess && task ? (
                        <Link href={`/estrutura/tarefas/${task.id}`} className="app-sm underline shrink-0">
                          Abrir tarefa
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {decided.length > decidedShown ? (
                <p className="app-meta app-numero mt-2">
                  Mostrando {decidedShown} de {decided.length}.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setDecidedShown((atual) => atual + DECIDED_PAGE_SIZE)}
                  >
                    Mostrar mais decididas
                  </button>
                </p>
              ) : null}
            </>
          )}
        </Section>
      </CorpoDeTela>
    </div>
  );
}
