"use client";

/**
 * D10 — Restaurar cópia de registro `mesclado`, aberto por `?restaurar-copia=`.
 *
 * É a única saída da mesclagem, e o diálogo existe justamente para desfazer a
 * expectativa de que ela desfaz: cria um registro NOVO a partir do Estado
 * pré-mesclagem, com Proveniência, e o absorvido permanece `mesclado`.
 *
 * Por isso o Estado guardado aparece campo a campo antes de confirmar — quem
 * restaura precisa ver que o que volta é isto, e só isto.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/data/store";
import { contactDisplayName } from "@/data/derive";
import { restoreMergedCopy } from "@/data/operations";
import { ConfirmDialog, RecordPanel, RecordRow } from "@/features/shell/ui";

export const RESTORE_COPY_PARAM = "restaurar-copia";

export function useRestoreCopyDialog(): {
  readonly restoring: boolean;
  readonly openRestore: () => void;
  readonly closeRestore: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    restoring: query.has(RESTORE_COPY_PARAM),
    openRestore: () => {
      const next = new URLSearchParams(query.toString());
      next.set(RESTORE_COPY_PARAM, "");
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeRestore: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(RESTORE_COPY_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

interface Snapshot {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly consents?: readonly unknown[];
  readonly addresses?: readonly unknown[];
  readonly tagIds?: readonly string[];
  readonly fieldValues?: ReadonlyArray<{ readonly definitionId: string; readonly value?: unknown }>;
  readonly identifiers?: ReadonlyArray<{ readonly displayValue: string }>;
}

export function RestoreCopyDialog({
  contactId,
  open,
  onClose,
  onDone,
}: {
  readonly contactId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [error, setError] = useState<string | null>(null);

  const merged = state.contacts.find((c) => c.id === contactId);
  if (!merged?.preMergeState) return null;

  const survivor = state.contacts.find((c) => c.id === merged.mergedIntoId);

  let snapshot: Snapshot | null = null;
  let parseError: string | null = null;
  try {
    snapshot = JSON.parse(merged.preMergeState.snapshot) as Snapshot;
  } catch (cause) {
    parseError = cause instanceof Error ? cause.message : "formato inválido";
  }

  const confirm = () => {
    const result = run((data, memberId) => restoreMergedCopy(data, memberId, merged.id));
    if (result.ok) {
      onDone(
        `Cópia criada: ${contactDisplayName(result.value)}. É um registro novo — ${contactDisplayName(merged)} continua mesclado.`,
      );
      setError(null);
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Restaurar cópia"
      description="Cria um Contato novo a partir do Estado pré-mesclagem. Não desfaz a mesclagem: o registro atual continua mesclado e as Conversas, Negócios e Tarefas seguem apontando para o sobrevivente."
      confirmLabel="Criar cópia"
      {...(parseError
        ? { confirmDisabledReason: `O Estado pré-mesclagem não pôde ser lido: ${parseError}.` }
        : {})}
      onConfirm={confirm}
      onCancel={() => {
        setError(null);
        onClose();
      }}
    >
      <div className="grid gap-3">
        <RecordPanel title="Estado pré-mesclagem, guardado no ato">
          {snapshot ? (
            <dl>
              <RecordRow label="Nome">
                {[snapshot.firstName, snapshot.lastName].filter(Boolean).join(" ") || "—"}
              </RecordRow>
              <RecordRow label="Consentimentos">{snapshot.consents?.length ?? 0} registro(s)</RecordRow>
              <RecordRow label="Endereços">{snapshot.addresses?.length ?? 0}</RecordRow>
              <RecordRow label="Tags">{snapshot.tagIds?.length ?? 0}</RecordRow>
              <RecordRow label="Valores de Campo">{snapshot.fieldValues?.length ?? 0}</RecordRow>
            </dl>
          ) : (
            <p className="app-base" style={{ color: "var(--erro)" }}>
              O Estado pré-mesclagem não pôde ser lido: {parseError}.
            </p>
          )}
        </RecordPanel>

        <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
          A cópia nasce <strong>sem Identificadores</strong>: eles já pertencem a{" "}
          {survivor ? contactDisplayName(survivor) : "ao sobrevivente"}, e um Identificador vive num só
          Contato.
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
