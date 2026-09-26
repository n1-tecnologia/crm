"use client";

/**
 * PERMITIR FERRAMENTA A UM AGENTE — o diálogo que os Plugins (o Catálogo de
 * Ferramentas) e a ficha do Agente compartilham. Um dos dois lados vem fixo:
 * do Catálogo, a Ferramenta; da ficha, o Agente.
 *
 * Permitir uma Ferramenta não concede permissão sobre nenhum registro
 * (DO-HAB-14): é só o que o Agente PODE tentar. Isto cria a Versão N+1 do
 * Agente (RN-AGE-06), válida a partir da próxima Execução. Uma Ferramenta de
 * efeito externo ou irreversível num Agente autônomo executa sem Solicitação
 * de Aprovação (B22) — o diálogo avisa, não bloqueia.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { permitirFerramenta, recusaDeGovernarAgente } from "@n1/dominio/operations";
import { agentesGovernaveisPor, versaoCorrenteDoAgente } from "@n1/dominio/derive-ia";
import { EFFECT_CLASS_LABEL, LIFECYCLE_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";

export function PermitirFerramentaDialog({
  agentId: agenteFixo,
  toolId: ferramentaFixa,
  open,
  onClose,
  onDone,
}: {
  readonly agentId?: string;
  readonly toolId?: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, agentId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [agentId, setAgentId] = useState(agenteFixo ?? "");
  const [toolId, setToolId] = useState(ferramentaFixa ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const agentes = agentesGovernaveisPor(state, memberId);
  const agente = state.agents.find((a) => a.id === agentId);
  const ferramenta = state.tools.find((t) => t.id === toolId);
  const integracao = ferramenta?.integrationId ? state.integrations.find((i) => i.id === ferramenta.integrationId) : undefined;
  const jaPermitida = agente !== undefined && (versaoCorrenteDoAgente(agente)?.allowedToolIds ?? []).includes(toolId);
  const autonomo = agente ? versaoCorrenteDoAgente(agente)?.autonomy === "autonomo" : false;
  const efeitoForte = ferramenta?.effectClass === "externa" || ferramenta?.effectClass === "escritaIrreversivel";

  const motivo = !agentId
    ? "Escolha o Agente."
    : !toolId
      ? "Escolha a Ferramenta."
      : jaPermitida
        ? "Esta Ferramenta já está permitida ao Agente."
        : (agente ? recusaDeGovernarAgente(state, memberId, agente, "editar") : undefined);

  const reset = () => {
    setAgentId(agenteFixo ?? "");
    setToolId(ferramentaFixa ?? "");
    setErro(null);
  };

  const confirmar = () => {
    const result = run((data, me) => permitirFerramenta(data, me, agentId, toolId));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onDone(`Ferramenta “${ferramenta?.name ?? toolId}” permitida a ${result.value.name}.`, result.value.id);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Permitir Ferramenta"
      description="Permitir uma Ferramenta não concede permissão sobre nenhum registro (DO-HAB-14). Isto cria a Versão seguinte do Agente, válida a partir da próxima Execução."
      confirmLabel="Permitir"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        <Field label="Agente" required>
          {(id) => (
            <Select
              id={id}
              value={agentId}
              onChange={setAgentId}
              searchable
              placeholder="Escolher o Agente"
              disabled={agenteFixo !== undefined}
              disabledReason="O Agente é o desta ficha."
              options={agentes.map((a) => ({
                value: a.id,
                label: a.name,
                detail: LIFECYCLE_LABEL[a.lifecycle] ?? a.lifecycle,
                ...(a.lifecycle === "arquivado" || a.lifecycle === "naLixeira" ? { disabledReason: "Restaure o Agente antes de editar." } : {}),
              }))}
            />
          )}
        </Field>
        <Field label="Ferramenta" required hint="O que o Agente passa a poder tentar.">
          {(id) => (
            <Select
              id={id}
              value={toolId}
              onChange={setToolId}
              searchable
              placeholder="Escolher a Ferramenta"
              disabled={ferramentaFixa !== undefined}
              disabledReason="A Ferramenta é a deste cartão."
              options={state.tools.map((t) => ({
                value: t.id,
                label: t.name,
                detail: `${EFFECT_CLASS_LABEL[t.effectClass] ?? t.effectClass} · ${t.origin === "integracao" ? "de Integração" : "da plataforma"}`,
              }))}
            />
          )}
        </Field>

        {integracao && integracao.state !== "conectada" ? (
          <p className="app-sm rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            A Integração {integracao.name} está desconectada: a Ferramenta fica permitida e inoperante até reconectar (7.7).
          </p>
        ) : null}
        {efeitoForte && autonomo ? (
          <p className="app-sm rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            Este Agente é autônomo: uma Ferramenta de {EFFECT_CLASS_LABEL[ferramenta?.effectClass ?? ""] ?? "efeito"} executa sem Solicitação de Aprovação (B22).
          </p>
        ) : null}
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
