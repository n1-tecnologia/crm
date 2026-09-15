"use client";

import { use, useState } from "react";
import { useData } from "@/dados/store";
import { requirementLabel } from "@n1/dominio/derive";
import {
  Button,
  CabecalhoDePainel,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Painel,
  RecordPanel,
  RecordRow,
  StateSeal,
  Toast,
} from "@/features/shell/ui";
import { RemoveStageDialog, useRemoveStageDialog } from "@/features/crm/remove-stage-dialog";
import { MigrateFunnelDialog, useMigrateFunnelDialog } from "@/features/crm/migrate-funnel-dialog";

export default function FunilPage({ params }: { params: Promise<{ funil: string }> }) {
  const { funil } = use(params);
  const state = useData((data) => data);
  const record = state.funnels.find((f) => f.id === funil);
  const { removingStageId, openRemoveStage, closeRemoveStage } = useRemoveStageDialog();
  const { migrating, openMigrate, closeMigrate } = useMigrateFunnelDialog();
  const [notice, setNotice] = useState<string | null>(null);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Funil não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={record.name}
        seal={<StateSeal state={record.lifecycle} />}
        meta={`${record.stages.length} Etapas · ${state.deals.filter((deal) => deal.funnelId === record.id).length} Negócio(s)`}
        actions={
          <Button
            onClick={openMigrate}
            disabled={state.funnels.filter((f) => f.id !== record.id && f.lifecycle === "ativo").length === 0}
            disabledReason="Não há outro Funil ativo para receber os Negócios."
          >
            Migrar Negócios
          </Button>
        }
      />

      {notice ? (
        <div className="px-4 pt-3">
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        </div>
      ) : null}

      <RemoveStageDialog
        funnelId={record.id}
        stageId={removingStageId}
        onClose={closeRemoveStage}
        onDone={setNotice}
      />

      <MigrateFunnelDialog
        funnelId={record.id}
        open={migrating}
        onClose={closeMigrate}
        onDone={setNotice}
      />

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ── as Etapas, na ordem do processo ── */}
          <Painel className="min-w-0">
            <CabecalhoDePainel titulo="Etapas" contagem={record.stages.length} />
            <div className="p-3">
              <ol className="pilha-solta">
                {[...record.stages]
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => (
                    <li key={stage.id} className="item-solto" data-bloco="true" data-estatico="true">
                      <div className="flex items-center justify-between gap-3">
                        <span className="app-md truncate" style={{ color: "var(--texto)" }}>
                          {stage.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="app-meta app-numero">
                            probabilidade padrão {stage.defaultProbability}% ·{" "}
                            {state.deals.filter((deal) => deal.stageId === stage.id).length} Negócio(s)
                          </span>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openRemoveStage(stage.id)}
                            disabled={record.stages.length <= 1}
                            disabledReason="Um Funil precisa de ao menos uma Etapa."
                          >
                            Remover
                          </Button>
                        </span>
                      </div>
                      {stage.requirements.length > 0 ? (
                        <ul className="app-sm mt-2 space-y-0.5" style={{ color: "var(--texto-3)" }}>
                          {stage.requirements.map((requirement, index) => (
                            <li key={index}>
                              Exigência de {requirement.moment === "entrada" ? "entrada" : "saída"}:{" "}
                              {requirementLabel(state, requirement.kind, requirement.fieldDefinitionId)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="app-sm mt-2" style={{ color: "var(--texto-3)" }}>
                          Sem Requisitos de Etapa.
                        </p>
                      )}
                      <p className="app-sm mt-1" style={{ color: "var(--texto-3)" }}>
                        {stage.allowedTransitionStageIds.length === 0
                          ? "Transições permitidas: todas."
                          : `Transições permitidas: ${stage.allowedTransitionStageIds
                              .map((id) => record.stages.find((s) => s.id === id)?.name)
                              .filter(Boolean)
                              .join(", ")}`}
                      </p>
                    </li>
                  ))}
              </ol>
            </div>
          </Painel>

          {/* ── os atributos do Funil, na lateral ── */}
          <div className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Regras de encerramento">
              <dl className="grid gap-2">
                <RecordRow label="Exigir Motivo de Perda ao marcar perdido">
                  {record.closingRules.requireLossReason ? "sim" : "não"}
                </RecordRow>
                <RecordRow label="Exigir valor ao marcar ganho">
                  {record.closingRules.requireValueOnWin ? "sim" : "não"}
                </RecordRow>
              </dl>
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
