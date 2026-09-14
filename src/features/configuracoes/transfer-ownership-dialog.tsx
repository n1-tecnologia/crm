"use client";

/**
 * D05 — Transferir propriedade do Espaço de Trabalho, aberto por
 * `?transferir-propriedade=`.
 *
 * INV-ET-02 — o Proprietário é derivado de quem detém o Papel: transferir é um
 * ato único que troca os dois Papéis no mesmo instante. Quem transfere não fica
 * sem Papel; escolhe qual assume, e o padrão é Administrador.
 *
 * É também o desbloqueio do caminho de erro do fluxo 9: o Proprietário não pode
 * ser removido sem transferir antes.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { transferWorkspaceOwnership } from "@/data/operations";
import { ConfirmDialog, Field, Select, TextInput } from "@/features/shell/ui";

export const TRANSFER_OWNERSHIP_PARAM = "transferir-propriedade";

export function useTransferOwnershipDialog(): {
  readonly transferring: boolean;
  readonly openTransfer: () => void;
  readonly closeTransfer: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    transferring: query.has(TRANSFER_OWNERSHIP_PARAM),
    openTransfer: () => {
      const next = new URLSearchParams(query.toString());
      next.set(TRANSFER_OWNERSHIP_PARAM, "");
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeTransfer: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(TRANSFER_OWNERSHIP_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

export function TransferOwnershipDialog({
  open,
  onClose,
  onDone,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  const [toMemberId, setToMemberId] = useState("");
  const [keepRoleId, setKeepRoleId] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const owner = state.members.find((m) => m.id === state.workspace.ownerMemberId);
  const adminRole = state.roles.find((role) => role.base === "administrador" && role.system);

  // RN-ET-24 — governance comes from the role, and only the current owner
  // transfers ownership.
  const candidates = state.members.filter(
    (member) => member.state === "ativo" && member.id !== state.workspace.ownerMemberId,
  );
  const target = candidates.find((member) => member.id === toMemberId);
  const keepableRoles = state.roles.filter((role) => role.base !== "proprietario");

  const isOwner = state.workspace.ownerMemberId === memberId;
  const confirmation = target ? state.workspace.name : "";

  const blockedReason = !isOwner
    ? "Só o Proprietário do Espaço de Trabalho transfere a propriedade."
    : toMemberId === ""
      ? "Escolha para quem a propriedade passa."
      : typed.trim() !== confirmation
        ? `Digite “${confirmation}” para confirmar.`
        : undefined;

  const reset = () => {
    setToMemberId("");
    setKeepRoleId("");
    setTyped("");
    setError(null);
  };

  const confirm = () => {
    if (!target) return;
    const result = run((data, actingId) =>
      transferWorkspaceOwnership(data, actingId, target.id, keepRoleId || undefined),
    );
    if (result.ok) {
      onDone(
        `Propriedade transferida para ${target.displayName}. ${owner?.displayName ?? "Você"} passou a ${
          state.roles.find((r) => r.id === (keepRoleId || adminRole?.id))?.name ?? "Administrador"
        }.`,
      );
      reset();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Transferir propriedade do Espaço de Trabalho"
      description="A troca é um ato único: o destinatário passa a Proprietário e quem transfere assume outro Papel no mesmo instante. Não existe Espaço de Trabalho sem Proprietário."
      confirmLabel="Transferir"
      destructive
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field label="Nova Proprietária ou novo Proprietário" hint="Só Membros ativos.">
          {(id) => (
            <Select
              id={id}
              value={toMemberId}
              onChange={(value) => {
                setToMemberId(value);
                setTyped("");
              }}
              searchable
              placeholder="Escolher Membro"
              options={candidates.map((member) => ({
                value: member.id,
                label: member.displayName,
                detail: state.roles.find((r) => r.id === member.roleId)?.name ?? "",
              }))}
            />
          )}
        </Field>

        <Field
          label={`Papel que ${owner?.displayName ?? "o Proprietário atual"} passa a ter`}
          hint="Padrão: Administrador. Ninguém fica sem Papel."
        >
          {(id) => (
            <Select
              id={id}
              value={keepRoleId}
              onChange={setKeepRoleId}
              placeholder={adminRole?.name ?? "Administrador"}
              options={keepableRoles.map((role) => ({
                value: role.id,
                label: role.name,
                detail: role.system ? "sistema" : `teto ${role.base}`,
              }))}
            />
          )}
        </Field>

        {target ? (
          <>
            <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
              A partir daí, só {target.displayName} pode transferir a propriedade de volta, encerrar o
              Espaço de Trabalho ou levantar uma suspensão imposta pelo Proprietário.
            </p>
            <Field label={`Digite “${confirmation}” para confirmar`}>
              {(id) => (
                <TextInput
                  id={id}
                  value={typed}
                  onChange={setTyped}
                  invalid={typed !== "" && typed.trim() !== confirmation}
                  placeholder={confirmation}
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
