"use client";

/**
 * D03 — Mesclar Contatos, aberto por `?mesclar=<contato>`.
 *
 * A mesclagem é irreversível na prática: a única saída é restaurar uma cópia a
 * partir do Estado pré-mesclagem, e isso cria um registro NOVO — não desfaz.
 * Por isso o diálogo antecipa cada consequência antes do ato e exige digitar o
 * nome do absorvido: o gesto precisa custar tanto quanto a consequência.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/data/store";
import { contactDisplayName } from "@/data/derive";
import { mergeContacts } from "@/data/operations";
import { CabecalhoDePainel, ConfirmDialog, Field, Painel, Select, StateSeal, TextInput } from "@/features/shell/ui";
import type { DataState } from "@/data/state";

export const MERGE_PARAM = "mesclar";

export function useMergeDialog(): {
  readonly mergingContactId: string | null;
  readonly openMerge: (contactId: string) => void;
  readonly closeMerge: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    mergingContactId: query.get(MERGE_PARAM),
    openMerge: (contactId) => {
      const next = new URLSearchParams(query.toString());
      next.set(MERGE_PARAM, contactId);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeMerge: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(MERGE_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

export function MergeContactsDialog({
  contactId,
  onClose,
  onDone,
}: {
  readonly contactId: string | null;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [otherId, setOtherId] = useState("");
  const [survivorId, setSurvivorId] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const anchor = contactId === null ? undefined : state.contacts.find((c) => c.id === contactId);
  if (!anchor) return null;

  // B14 — `naLixeira` and `mesclado` are offered as neither source nor target.
  const mergeable = state.contacts.filter(
    (contact) =>
      contact.id !== anchor.id && (contact.lifecycle === "ativo" || contact.lifecycle === "arquivado"),
  );

  const other = mergeable.find((c) => c.id === otherId);
  const pair = other ? [anchor, other] : [];
  const survivor = pair.find((c) => c.id === survivorId);
  const absorbed = pair.find((c) => c.id !== survivorId);

  const repointed = absorbed
    ? {
        conversations: state.conversations.filter((c) => c.contactId === absorbed.id).length,
        deals: state.deals.filter((d) => d.contactLinks.some((l) => l.contactId === absorbed.id)).length,
        tasks: state.links.filter(
          (link) =>
            (link.fromType === "contact" && link.fromId === absorbed.id && link.toType === "task") ||
            (link.toType === "contact" && link.toId === absorbed.id && link.fromType === "task"),
        ).length,
        companyLinks: state.contactCompanyLinks.filter((l) => l.contactId === absorbed.id).length,
      }
    : null;

  // RN-CXE-10 — the survivor may end up with two unresolved conversations on the
  // same Channel; the one with the newest Message stays and the other is
  // resolved with cause `mesclagem`. Said BEFORE, not discovered after.
  const collidingChannels =
    survivor && absorbed
      ? channelsWithUnresolved(state, survivor.id).filter((channelId) =>
          channelsWithUnresolved(state, absorbed.id).includes(channelId),
        )
      : [];

  const absorbedName = absorbed ? contactDisplayName(absorbed) : "";
  const blockedReason =
    otherId === ""
      ? "Escolha o outro Contato."
      : survivorId === ""
        ? "Escolha qual dos dois sobrevive."
        : typed.trim() !== absorbedName
          ? `Digite “${absorbedName}” para confirmar.`
          : undefined;

  const reset = () => {
    setOtherId("");
    setSurvivorId("");
    setTyped("");
    setError(null);
  };

  const confirm = () => {
    if (!survivor || !absorbed) return;
    const result = run((data, memberId) => mergeContacts(data, memberId, survivor.id, absorbed.id));
    if (result.ok) {
      const parts = repointed
        ? [
            repointed.conversations > 0 ? `${repointed.conversations} Conversa(s)` : undefined,
            repointed.deals > 0 ? `${repointed.deals} Negócio(s)` : undefined,
            repointed.tasks > 0 ? `${repointed.tasks} Tarefa(s)` : undefined,
          ].filter((part) => part !== undefined)
        : [];
      onDone(
        parts.length > 0
          ? `Contatos mesclados. ${parts.join(", ")} foram reapontados para ${contactDisplayName(survivor)}.`
          : `Contatos mesclados em ${contactDisplayName(survivor)}.`,
      );
      reset();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open={contactId !== null}
      title="Mesclar Contatos"
      description="Um dos dois sobrevive por inteiro; o outro fica mesclado, terminal e somente leitura, com link para o sobrevivente."
      confirmLabel="Mesclar"
      destructive
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field label="Mesclar com" hint="Só Contatos ativos ou arquivados aparecem aqui.">
          {(id) => (
            <Select
              id={id}
              value={otherId}
              onChange={(value) => {
                setOtherId(value);
                setSurvivorId("");
                setTyped("");
              }}
              searchable
              placeholder="Escolher Contato"
              options={mergeable.map((contact) => ({
                value: contact.id,
                label: contactDisplayName(contact),
                detail: contact.identifiers[0]?.displayValue ?? "sem identificador",
              }))}
            />
          )}
        </Field>

        {other ? (
          <>
            <Field label="Qual dos dois sobrevive">
              {(id) => (
                <Select
                  id={id}
                  value={survivorId}
                  onChange={(value) => {
                    setSurvivorId(value);
                    setTyped("");
                  }}
                  placeholder="Escolher sobrevivente"
                  options={pair.map((contact) => ({
                    value: contact.id,
                    label: contactDisplayName(contact),
                    detail: `${contact.identifiers.length} identificador(es)`,
                  }))}
                />
              )}
            </Field>

            <div className="grade-solta sm:grid-cols-2">
              {pair.map((contact) => (
                <div
                  key={contact.id}
                  className="item-solto"
                  data-bloco="true"
                  data-estatico="true"
                  data-destacado={contact.id === survivorId ? "true" : undefined}
                >
                  <p className="app-md flex flex-wrap items-center gap-2" style={{ color: "var(--texto)" }}>
                    {contactDisplayName(contact)}
                    <StateSeal state={contact.lifecycle} />
                    {contact.id === survivorId ? <span className="app-meta">sobrevive</span> : null}
                  </p>
                  <ul className="app-sm mt-1 space-y-0.5" style={{ color: "var(--texto-3)" }}>
                    {contact.identifiers.map((identifier) => (
                      <li key={identifier.id}>{identifier.displayValue}</li>
                    ))}
                    {contact.identifiers.length === 0 ? <li>sem Identificador</li> : null}
                  </ul>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {absorbed && repointed ? (
          <Painel>
            <CabecalhoDePainel titulo="O que passa ao sobrevivente" />
            <ul className="app-base space-y-0.5 px-4 py-3" style={{ color: "var(--texto-3)" }}>
              <li>{absorbed.identifiers.length} Identificador(es), Tags, Valores de Campo e Consentimentos</li>
              <li>{repointed.conversations} Conversa(s) reapontada(s)</li>
              <li>{repointed.deals} Negócio(s) reapontado(s)</li>
              <li>{repointed.tasks} Tarefa(s) vinculada(s) reapontada(s)</li>
              <li>{repointed.companyLinks} Vínculo(s) com Empresa</li>
            </ul>
          </Painel>
        ) : null}

        {collidingChannels.length > 0 ? (
          <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            O sobrevivente ficará com duas Conversas não resolvidas em{" "}
            {collidingChannels
              .map((channelId) => state.channels.find((c) => c.id === channelId)?.name ?? channelId)
              .join(", ")}
            . A de Mensagem mais recente permanece; a outra é resolvida com a causa <em>mesclagem</em>. As
            Mensagens não são movidas.
          </p>
        ) : null}

        {absorbed ? (
          <>
            <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>
              A mesclagem é irreversível. A única saída é restaurar uma cópia a partir do Estado
              pré-mesclagem, que cria um registro <strong>novo</strong> — não desfaz esta.
            </p>
            <Field label={`Digite “${absorbedName}” para confirmar`}>
              {(id) => (
                <TextInput
                  id={id}
                  value={typed}
                  onChange={setTyped}
                  invalid={typed !== "" && typed.trim() !== absorbedName}
                  placeholder={absorbedName}
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

/** Channels on which this Contact has an unresolved Conversation (RN-CXE-10). */
function channelsWithUnresolved(state: DataState, contactId: string): string[] {
  return state.conversations
    .filter(
      (conversation) =>
        conversation.contactId === contactId &&
        conversation.lifecycle === "ativo" &&
        conversation.state !== "resolvida",
    )
    .map((conversation) => conversation.channelId);
}
