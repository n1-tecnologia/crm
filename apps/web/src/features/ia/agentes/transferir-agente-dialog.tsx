"use client";

/**
 * TRANSFERIR A PROPRIEDADE DE UM AGENTE (RN-AGE-04): ato do Proprietário
 * atual ou de quem administra o Espaço de Trabalho, para um Membro ativo sem
 * base Convidado. É governança, não comportamento — não cria Versão. O
 * Assistente padrão acompanha o Proprietário do Espaço de Trabalho (B33) e
 * por isso nunca passa por aqui.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { baseDoPapel, recusaDeGovernarAgente, transferirAgente } from "@n1/dominio/operations";
import { LIFECYCLE_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";

export function TransferirAgenteDialog({
  agentId,
  open,
  onClose,
  onDone,
}: {
  readonly agentId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [novoDonoId, setNovoDonoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const agent = state.agents.find((a) => a.id === agentId);
  const padrao = state.workspace.defaultAgentId === agentId;
  const donoAtual = state.members.find((m) => m.id === agent?.ownerMemberId);
  const novoDono = state.members.find((m) => m.id === novoDonoId);

  // A mesma recusa da operação, antes do clique (§11).
  const inelegivel = (id: string): string | undefined => {
    const m = state.members.find((x) => x.id === id);
    if (!m || m.state !== "ativo" || baseDoPapel(state, id) === "convidado") return "O novo Proprietário precisa ser um Membro ativo sem base Convidado (RN-AGE-04).";
    if (agent?.ownerMemberId === id) return "Este Membro já é o Proprietário.";
    return undefined;
  };

  const motivo = !agent
    ? "Agente não encontrado."
    : (recusaDeGovernarAgente(state, memberId, agent, "administrar") ??
      (padrao ? "O Assistente padrão acompanha o Proprietário do Espaço de Trabalho (B33)." : !novoDonoId ? "Escolha o novo Proprietário." : inelegivel(novoDonoId)));

  const reset = () => {
    setNovoDonoId("");
    setErro(null);
  };

  const confirmar = () => {
    const result = run((data, me) => transferirAgente(data, me, agentId, novoDonoId));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onDone(`Propriedade de ${result.value.name} transferida a ${novoDono?.displayName ?? novoDonoId}.`);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Transferir propriedade"
      description={`O Proprietário administra o Agente e responde por ele (RN-AGE-04). Governança, não comportamento: sem Versão nova. Hoje é ${donoAtual?.displayName ?? "—"}.`}
      confirmLabel="Transferir"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        <Field label="Novo Proprietário" required hint="Um Membro ativo sem base Convidado (RN-AGE-04).">
          {(id) => (
            <Select
              id={id}
              value={novoDonoId}
              onChange={setNovoDonoId}
              searchable
              placeholder="Escolher o Membro"
              options={state.members
                .filter((m) => m.state !== "removido")
                .map((m) => {
                  const recusa = inelegivel(m.id);
                  const papel = state.roles.find((r) => r.id === m.roleId)?.name;
                  return {
                    value: m.id,
                    label: m.displayName,
                    detail: `${papel ?? "sem Papel"} · ${LIFECYCLE_LABEL[m.state] ?? m.state}`,
                    ...(recusa ? { disabledReason: recusa } : {}),
                  };
                })}
            />
          )}
        </Field>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
