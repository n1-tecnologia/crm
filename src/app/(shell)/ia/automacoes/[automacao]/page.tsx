"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useCurrentMember, useData, useRun } from "@/data/store";
import { publishAutomation } from "@/data/operations";
import { RESOURCE_TYPE_LABEL, TRIGGER_EVENT_LABEL, TRIGGER_KIND_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
  CabecalhoDePainel,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Painel,
  RecordPanel,
  RecordRow,
  StateSeal,
  Toast,
} from "@/features/shell/ui";

export default function AutomacaoPage({ params }: { params: Promise<{ automacao: string }> }) {
  const { automacao } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const run = useRun();
  const acting = useCurrentMember();
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const record = state.automations.find((a) => a.id === automacao);
  const executions = state.automationExecutions.filter((e) => e.automationId === automacao);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Automação não encontrada." hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la." />
        </CorpoDeTela>
      </div>
    );
  }

  // RN-AUT-07 — publicar exige Gatilho e ao menos uma Ação. A tela lê a mesma
  // condição que a operação aplica, para o botão não habilitar numa recusa.
  const draft = record.versions.find((version) => version.state === "rascunho");
  const current = record.versions.find((version) => version.state === "publicada");
  // A tela lê a mesma autorização que a operação aplica (PADROES §10): quem não
  // administra a Automação vê o motivo, não uma recusa depois do clique.
  const actingBase = state.roles.find((r) => r.id === acting?.roleId)?.base;
  const mayPublish =
    actingBase === "proprietario" ||
    actingBase === "administrador" ||
    (actingBase !== "convidado" &&
      acting !== undefined &&
      (record.ownerMemberId === acting.id ||
        (record.createdBy.kind === "member" && record.createdBy.id === acting.id)));

  const publishBlocked = !mayPublish
    ? "Publicar uma Versão exige administrar esta Automação."
    : !draft
      ? "Não há rascunho para publicar."
      : !draft.trigger
        ? "O rascunho ainda não tem Gatilho."
        : draft.actions.length === 0
          ? "O rascunho ainda não tem nenhuma Ação."
          : undefined;

  const publish = () => {
    const result = run((data, memberId) => publishAutomation(data, memberId, record.id));
    if (result.ok) {
      setError(null);
      setNotice(
        current
          ? `Versão ${result.value.number} publicada. A Versão ${current.number} passou a obsoleta.`
          : `Versão ${result.value.number} publicada.`,
      );
    } else {
      setNotice(null);
      setError(result.error);
    }
    setPublishing(false);
  };

  return (
    <div className="flex h-full flex-col">
      <ConfirmDialog
        open={publishing}
        title={draft ? `Publicar a Versão ${draft.number}?` : "Publicar"}
        description={
          current
            ? `A Versão ${current.number}, hoje publicada, passa a obsoleta no mesmo ato. Execuções já em curso seguem na Versão que as iniciou.`
            : "Esta passa a ser a Versão vigente: a partir daqui o Gatilho dispara Execuções reais."
        }
        confirmLabel="Publicar"
        onConfirm={publish}
        onCancel={() => setPublishing(false)}
      />

      <PageHeader
        title={record.name}
        seal={<StateSeal state={record.lifecycle} />}
        actions={
          <Button
            variant="primary"
            onClick={() => setPublishing(true)}
            disabled={publishBlocked !== undefined}
            disabledReason={publishBlocked ?? ""}
          >
            Publicar rascunho
          </Button>
        }
      />

      {notice || error ? (
        <div className="px-4 pt-3">
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
        </div>
      ) : null}

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ------------------------------------------------ coluna principal */}
          <div className="grid content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo="Versões" contagem={record.versions.length} />
              <div className="p-3">
                <ul className="pilha-solta">
                  {record.versions.map((version) => (
                    <li key={version.number} className="item-solto" data-bloco="true" data-estatico="true">
                      <div className="flex items-center justify-between gap-2">
                        <span className="app-md" style={{ color: "var(--texto)" }}>
                          Versão {version.number}
                        </span>
                        <StateSeal state={version.state} />
                      </div>
                      <p className="app-base mt-1" style={{ color: "var(--texto-1)" }}>
                        Gatilho:{" "}
                        {version.trigger
                          ? (TRIGGER_KIND_LABEL[version.trigger.kind] ?? version.trigger.kind)
                          : "sem Gatilho"}
                        {version.trigger?.eventType
                          ? ` · ${TRIGGER_EVENT_LABEL[version.trigger.eventType] ?? version.trigger.eventType}`
                          : ""}
                      </p>
                      <p className="app-base app-numero mt-1" style={{ color: "var(--texto-1)" }}>
                        {version.conditions.length} Condição(ões) · {version.actions.length} Ação(ões)
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Execuções" contagem={executions.length} />
              <div className="p-3">
                {executions.length === 0 ? (
                  <EmptyState
                    compact
                    title="Nenhuma Execução ainda."
                    hint="Uma Execução nasce quando o gatilho desta Automação acontece."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {executions.map((execution) => (
                      <li key={execution.id}>
                        <Link href={`/ia/execucoes/${execution.id}`} className="item-solto">
                          <span className="app-meta app-numero shrink-0">{fmt.instant(execution.startedAt)}</span>
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {execution.state}
                            {execution.terminationReason ? ` · ${execution.terminationReason}` : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>
          </div>

          {/* ------------------------------------------------ coluna lateral */}
          <div className="grid content-start gap-3">
            <RecordPanel title="Atributos">
              <dl>
                <RecordRow label="Escopo">{RESOURCE_TYPE_LABEL[record.scopeType] ?? record.scopeType}</RecordRow>
                <RecordRow label="Proprietário">{state.members.find((m) => m.id === record.ownerMemberId)?.displayName ?? "—"}</RecordRow>
              </dl>
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
