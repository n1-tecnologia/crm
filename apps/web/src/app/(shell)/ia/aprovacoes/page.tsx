"use client";

/**
 * T36 — Solicitações de Aprovação.
 *
 * B77 — the request has a deadline, and an expired one cancels the Execution.
 * The screen shows the remaining time and disables deciding once the deadline
 * passed, so nobody discovers it by being refused on click (PADROES §10).
 *
 * B78 — the designated approver decides; the Agent owner and an administrator
 * may also decide. A request nobody here can decide is visible but inert, and
 * the screen says why.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { executionChainOf } from "@n1/dominio/derive";
import { decideApproval } from "@n1/dominio/operations";
import { APPROVAL_REASON_LABEL, EFFECT_CLASS_LABEL, RESOURCE_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
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

/** A rejection is recorded on the Execution it stopped, not on the request. */
function terminationReasonOf(state: DataState, approval: ApprovalRequest): string {
  if (approval.decision !== "rejeitada") return "";
  const executionId = approvalExecutionId(approval);
  const execution = executionId ? state.agentExecutions.find((e) => e.id === executionId) : undefined;
  return execution?.terminationReason ? ` · ${execution.terminationReason}` : "";
}

export default function AprovacoesPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { memberId } = useSession();
  const run = useRun();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const query = useSearchParams();
  /**
   * D09 — a decisão vive no endereço (`?aprovar=<solicitação>`): decidir uma
   * Aprovação é um passo que se compartilha ("olha isso antes de eu aprovar") e
   * que precisa sobreviver a um recarregamento.
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

  const pending = state.approvals.filter((approval) => approval.decision === undefined);
  const decided = state.approvals.filter((approval) => approval.decision !== undefined);
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
  const renderCard = (approval: ApprovalRequest) => {
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

  const deciding = decidingId ? state.approvals.find((a) => a.id === decidingId) : undefined;
  const decidingDeadline = deciding ? approvalDeadline(deciding) : undefined;
  const decidingExpired = decidingDeadline !== undefined ? Date.parse(decidingDeadline) < now : false;
  const decidingTool = deciding
    ? (state.tools.find((t) => t.id === deciding.object.toolId)?.name ?? deciding.object.toolId)
    : "";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Aprovações" meta={`${mine.length} para você · ${pending.length} pendentes`} />

      {deciding ? (
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

        <Section title="Aguardando a sua decisão" count={mine.length}>
          {mine.length === 0 ? (
            <EmptyState
              title="Nenhuma Solicitação aguarda você."
              hint="Uma Solicitação chega quando uma Execução pede uma Ferramenta que a Concessão exige aprovar."
            />
          ) : (
            <ul className="pilha-solta">{mine.map((approval) => renderCard(approval))}</ul>
          )}
        </Section>

        <Section title="Aguardando outros aprovadores" count={others.length}>
          {others.length === 0 ? (
            <EmptyState title="Nenhuma Solicitação pendente com outro aprovador." />
          ) : (
            <ul className="pilha-solta">{others.map((approval) => renderCard(approval))}</ul>
          )}
        </Section>

        <Section title="Decididas" count={decided.length}>
          {decided.length === 0 ? (
            <EmptyState title="Nenhuma Solicitação decidida ainda." />
          ) : (
            <ul className="pilha-solta">
              {decided.map((approval) => (
                <li key={approval.id} className="item-solto" data-estatico="true" data-atenuado="true">
                  <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                    {state.tools.find((t) => t.id === approval.object.toolId)?.name ?? approval.object.toolId}
                  </span>
                  <Pilula tom={approval.decision === "aprovada" ? "sucesso" : "neutro"} comPonto className="shrink-0">
                    {approval.decision}
                  </Pilula>
                  <span className="app-meta app-numero shrink-0">
                    {approval.decidedAt ? fmt.instant(approval.decidedAt) : ""}
                    {terminationReasonOf(state, approval)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </CorpoDeTela>
    </div>
  );
}
