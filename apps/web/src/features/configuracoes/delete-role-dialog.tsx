"use client";

/**
 * D14 — Excluir Papel personalizado, aberto por `?excluir-papel=<papel>`.
 *
 * A remoção EXIGE o Papel de destino dos titulares e é aplicada no mesmo ato:
 * um Papel excluído sem destino deixaria Membros e Agentes apontando para nada.
 *
 * INV-ET-13 — o destino de um Agente nunca é Proprietário nem Administrador,
 * nem Papel com base num deles. Por isso os dois grupos escolhem separado, e a
 * lista do grupo dos Agentes já não oferece o que a regra proíbe.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { deleteRole, roleHolders } from "@n1/dominio/operations";
import { ConfirmDialog, Field, Painel, Select } from "@/features/shell/ui";

export const DELETE_ROLE_PARAM = "excluir-papel";

export function useDeleteRoleDialog(): {
  readonly deletingRoleId: string | null;
  readonly openDeleteRole: (roleId: string) => void;
  readonly closeDeleteRole: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    deletingRoleId: query.get(DELETE_ROLE_PARAM),
    openDeleteRole: (roleId) => {
      const next = new URLSearchParams(query.toString());
      next.set(DELETE_ROLE_PARAM, roleId);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeDeleteRole: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(DELETE_ROLE_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

export function DeleteRoleDialog({
  roleId,
  onClose,
  onDone,
}: {
  readonly roleId: string | null;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [memberRoleId, setMemberRoleId] = useState("");
  const [agentRoleId, setAgentRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const role = roleId === null ? undefined : state.roles.find((r) => r.id === roleId);
  if (!role) return null;

  const holders = roleHolders(state, role.id);
  const nonHuman = [...holders.agents, ...holders.automations];

  const memberTargets = state.roles.filter((option) => option.id !== role.id);
  // INV-ET-13 — o que a regra proíbe não é oferecido.
  const agentTargets = memberTargets.filter(
    (option) => option.base !== "proprietario" && option.base !== "administrador",
  );

  const blockedReason = role.system
    ? "Um Papel de sistema não pode ser excluído."
    : holders.members.length > 0 && memberRoleId === ""
      ? `${holders.members.length} Membro(s) ainda sem Papel de destino.`
      : nonHuman.length > 0 && agentRoleId === ""
        ? `${nonHuman.length} Agente(s) ou Automação(ões) ainda sem Papel de destino.`
        : undefined;

  const reset = () => {
    setMemberRoleId("");
    setAgentRoleId("");
    setError(null);
  };

  const confirm = () => {
    const result = run((data, actingId) =>
      deleteRole(data, actingId, role.id, {
        ...(memberRoleId ? { memberRoleId } : {}),
        ...(agentRoleId ? { agentRoleId } : {}),
      }),
    );
    if (result.ok) {
      onDone(
        holders.members.length + nonHuman.length === 0
          ? `Papel ${role.name} excluído.`
          : `Papel ${role.name} excluído. ${holders.members.length} Membro(s) e ${nonHuman.length} Agente(s)/Automação(ões) receberam novo Papel.`,
      );
      reset();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open={roleId !== null}
      title={`Excluir o Papel “${role.name}”`}
      description={
        holders.members.length + nonHuman.length === 0
          ? "Nenhum titular usa este Papel."
          : "Todo titular recebe o Papel de destino no mesmo ato — nenhum fica sem Papel."
      }
      confirmLabel="Excluir Papel"
      destructive
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        {holders.members.length > 0 ? (
          <>
            <Painel className="px-3 py-2">
              <p className="app-coluna">
                Membros titulares ({holders.members.length})
              </p>
              <p className="app-base mt-0.5" style={{ color: "var(--texto-3)" }}>
                {holders.members.map((holder) => holder.name).join(", ")}
              </p>
            </Painel>
            <Field label="Papel de destino dos Membros" hint="A base do destino define o novo teto de permissão.">
              {(id) => (
                <Select
                  id={id}
                  value={memberRoleId}
                  onChange={setMemberRoleId}
                  searchable
                  placeholder="Escolher Papel"
                  options={memberTargets.map((option) => ({
                    value: option.id,
                    label: option.name,
                    detail: option.system ? "sistema" : `teto ${option.base}`,
                  }))}
                />
              )}
            </Field>
          </>
        ) : null}

        {nonHuman.length > 0 ? (
          <>
            <Painel className="px-3 py-2">
              <p className="app-coluna">
                Agentes e Automações titulares ({nonHuman.length})
              </p>
              <p className="app-base mt-0.5" style={{ color: "var(--texto-3)" }}>
                {nonHuman.map((holder) => holder.name).join(", ")}
              </p>
            </Painel>
            <Field
              label="Papel de destino dos Agentes"
              hint="Proprietário e Administrador não aparecem: um Agente nunca é titular deles."
            >
              {(id) => (
                <Select
                  id={id}
                  value={agentRoleId}
                  onChange={setAgentRoleId}
                  searchable
                  placeholder="Escolher Papel"
                  options={agentTargets.map((option) => ({
                    value: option.id,
                    label: option.name,
                    detail: option.system ? "sistema" : `teto ${option.base}`,
                  }))}
                />
              )}
            </Field>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
