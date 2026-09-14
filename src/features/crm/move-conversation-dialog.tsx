"use client";

/**
 * D12 — Mover Conversa para outro Contato, aberto por `?mover-conversa=`.
 *
 * A colisão que a regra proíbe é dita ANTES, com o nome do Canal e a Conversa
 * que colide: RN-CXE-11 rejeita mover para um Contato que já tenha Conversa não
 * resolvida no mesmo Canal, salvo resolver a existente no mesmo ato — e essa
 * saída aparece como uma escolha explícita, nunca como efeito colateral.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/data/store";
import { contactDisplayName } from "@/data/derive";
import { moveConversationToContact } from "@/data/operations";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";

export const MOVE_CONVERSATION_PARAM = "mover-conversa";

export function useMoveConversationDialog(): {
  readonly moving: boolean;
  readonly openMoveConversation: () => void;
  readonly closeMoveConversation: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    moving: query.has(MOVE_CONVERSATION_PARAM),
    openMoveConversation: () => {
      const next = new URLSearchParams(query.toString());
      next.set(MOVE_CONVERSATION_PARAM, "");
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeMoveConversation: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(MOVE_CONVERSATION_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

export function MoveConversationDialog({
  conversationId,
  open,
  onClose,
  onDone,
}: {
  readonly conversationId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [toContactId, setToContactId] = useState("");
  const [resolveExisting, setResolveExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation) return null;

  const channel = state.channels.find((c) => c.id === conversation.channelId);
  const current = conversation.contactId
    ? state.contacts.find((c) => c.id === conversation.contactId)
    : undefined;

  const targets = state.contacts.filter(
    (contact) => contact.id !== conversation.contactId && contact.lifecycle !== "mesclado",
  );

  // The collision the rule forbids, named before the act.
  const colliding = toContactId
    ? state.conversations.find(
        (other) =>
          other.id !== conversation.id &&
          other.contactId === toContactId &&
          other.channelId === conversation.channelId &&
          other.lifecycle === "ativo" &&
          other.state !== "resolvida",
      )
    : undefined;

  const blockedReason =
    toContactId === ""
      ? "Escolha o Contato de destino."
      : colliding && !resolveExisting
        ? "Marque resolver a Conversa existente, ou escolha outro Contato."
        : undefined;

  const reset = () => {
    setToContactId("");
    setResolveExisting(false);
    setError(null);
  };

  const confirm = () => {
    const result = run((data, memberId) =>
      moveConversationToContact(data, memberId, conversation.id, toContactId, resolveExisting),
    );
    if (result.ok) {
      const target = state.contacts.find((c) => c.id === toContactId);
      onDone(
        `Conversa movida para ${target ? contactDisplayName(target) : "outro Contato"}.${
          colliding ? " A Conversa que colidia foi resolvida." : ""
        }`,
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
      title="Mover Conversa para outro Contato"
      description={`O Canal ${channel?.name ?? ""} não muda, e nenhuma Mensagem é movida: só a quem a Conversa pertence.`}
      confirmLabel="Mover"
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field
          label="Contato de destino"
          hint={current ? `Hoje pertence a ${contactDisplayName(current)}.` : "Hoje o Contato não está resolvido."}
        >
          {(id) => (
            <Select
              id={id}
              value={toContactId}
              onChange={(value) => {
                setToContactId(value);
                setResolveExisting(false);
              }}
              searchable
              placeholder="Escolher Contato"
              options={targets.map((contact) => ({
                value: contact.id,
                label: contactDisplayName(contact),
                detail: contact.identifiers[0]?.displayValue ?? "sem identificador",
              }))}
            />
          )}
        </Field>

        {colliding ? (
          <div className="rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            <p className="app-base">
              Este Contato já tem a Conversa <em>{colliding.title}</em> não resolvida em{" "}
              {channel?.name}. Duas Conversas abertas do mesmo Contato no mesmo Canal quebram o
              roteamento da próxima Mensagem recebida.
            </p>
            <label className="app-base mt-2 flex items-start gap-2">
              <input
                type="checkbox"
                checked={resolveExisting}
                onChange={(event) => setResolveExisting(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--acento)]"
              />
              Resolver <em>{colliding.title}</em> no mesmo ato
            </label>
          </div>
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
