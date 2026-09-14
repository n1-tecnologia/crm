"use client";

/**
 * D11 — Transferir Identificador de Contato, aberto por
 * `?transferir-identificador=<identificador>`.
 *
 * O aviso central é contra-intuitivo e por isso é dito antes do ato: só a
 * resolução FUTURA muda. As Conversas e as Mensagens já trocadas continuam
 * pertencendo ao Contato de origem — transferir um identificador não reescreve
 * o passado.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/data/store";
import { contactDisplayName } from "@/data/derive";
import { transferContactIdentifier } from "@/data/operations";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";

export const TRANSFER_IDENTIFIER_PARAM = "transferir-identificador";

export function useTransferIdentifierDialog(): {
  readonly transferringId: string | null;
  readonly openTransfer: (identifierId: string) => void;
  readonly closeTransfer: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    transferringId: query.get(TRANSFER_IDENTIFIER_PARAM),
    openTransfer: (identifierId) => {
      const next = new URLSearchParams(query.toString());
      next.set(TRANSFER_IDENTIFIER_PARAM, identifierId);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeTransfer: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(TRANSFER_IDENTIFIER_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

export function TransferIdentifierDialog({
  identifierId,
  fromContactId,
  onClose,
  onDone,
}: {
  readonly identifierId: string | null;
  readonly fromContactId: string;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [toContactId, setToContactId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const from = state.contacts.find((c) => c.id === fromContactId);
  const identifier = from?.identifiers.find((i) => i.id === identifierId);
  if (!from || !identifier) return null;

  const targets = state.contacts.filter(
    (contact) => contact.id !== from.id && contact.lifecycle !== "mesclado",
  );
  const conversations = state.conversations.filter(
    (conversation) => conversation.contactId === from.id,
  ).length;

  const reset = () => {
    setToContactId("");
    setError(null);
  };

  const confirm = () => {
    const result = run((data, memberId) =>
      transferContactIdentifier(data, memberId, from.id, identifier.id, toContactId),
    );
    if (result.ok) {
      onDone(
        `Identificador ${identifier.displayValue} transferido para ${contactDisplayName(result.value)}.`,
      );
      reset();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open={identifierId !== null}
      title={`Transferir ${identifier.displayValue}`}
      description={`O Identificador sai de ${contactDisplayName(from)} e passa a resolver para o Contato de destino.`}
      confirmLabel="Transferir"
      {...(toContactId === "" ? { confirmDisabledReason: "Escolha o Contato de destino." } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field label="Contato de destino" hint="Um Contato mesclado não recebe Identificadores.">
          {(id) => (
            <Select
              id={id}
              value={toContactId}
              onChange={setToContactId}
              searchable
              placeholder="Escolher Contato"
              options={targets.map((contact) => ({
                value: contact.id,
                label: contactDisplayName(contact),
                detail: `${contact.identifiers.length} identificador(es)`,
              }))}
            />
          )}
        </Field>

        <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
          Só a resolução <strong>futura</strong> muda.{" "}
          {conversations > 0
            ? `As ${conversations} Conversa(s) e todas as Mensagens já trocadas permanecem com ${contactDisplayName(from)}.`
            : `Conversas e Mensagens passadas permaneceriam com ${contactDisplayName(from)}.`}
        </p>

        {error ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
