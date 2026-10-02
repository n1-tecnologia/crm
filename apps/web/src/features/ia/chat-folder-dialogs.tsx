"use client";

/**
 * Os diálogos das pastas de Chat: criar, renomear, excluir. Vivem num lugar só
 * porque são abertos de dois — o menu lateral, onde as pastas moram, e a home
 * do Chat — e um diálogo copiado em dois lugares diverge no primeiro ajuste.
 */

import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { createChatFolder, deleteChatFolder, renameChatFolder } from "@n1/dominio/operations";
import { ConfirmDialog, Field, TextInput } from "@/features/shell/ui";
import type { ChatFolder } from "@n1/dominio/types";

type Editing = { readonly id?: string; readonly name: string };

/**
 * `onDone` recebe a frase do que aconteceu e, quando uma pasta NASCEU, o id
 * dela: quem abriu "Nova pasta…" a partir de uma escolha (o compositor do
 * Chat) já a deixa escolhida — criar e ainda ter de escolher de novo seria
 * trabalho dobrado.
 */
export function useChatFolderDialogs(onDone: (message: string, criadaId?: string) => void) {
  const run = useRun();
  const sessions = useData((data) => data.chatSessions);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ChatFolder | null>(null);

  const save = () => {
    if (!editing) return;
    const result = editing.id
      ? run((data, id) => renameChatFolder(data, id, editing.id ?? "", editing.name))
      : run((data, id) => createChatFolder(data, id, { name: editing.name }));
    if (result.ok) {
      setError(null);
      setEditing(null);
      onDone(editing.id ? "Pasta renomeada." : "Pasta criada.", editing.id ? undefined : result.value.id);
    } else {
      setError(result.error);
    }
  };

  const dialogs = (
    <>
      <ConfirmDialog
        open={editing !== null}
        title={editing?.id ? "Renomear pasta" : "Nova pasta"}
        description="Uma pasta só organiza a sua lista: ninguém mais a vê, e apagá-la não apaga Sessão nenhuma."
        confirmLabel={editing?.id ? "Renomear" : "Criar pasta"}
        {...(editing && editing.name.trim() === "" ? { confirmDisabledReason: "Dê um nome à pasta." } : {})}
        onConfirm={save}
        onCancel={() => {
          setError(null);
          setEditing(null);
        }}
      >
        <div className="grid gap-2">
          <Field label="Nome">
            {(id) => (
              <TextInput
                id={id}
                value={editing?.name ?? ""}
                onChange={(name) => setEditing((atual) => (atual ? { ...atual, name } : atual))}
                placeholder="Ex.: Propostas"
              />
            )}
          </Field>
          {error ? (
            <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
              {error}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir a pasta “${deleting?.name ?? ""}”?`}
        description={`${sessions.filter((s) => s.folderId === deleting?.id).length} Sessão(ões) voltam a ficar soltas. Nenhuma é apagada.`}
        confirmLabel="Excluir pasta"
        destructive
        onConfirm={() => {
          if (deleting) {
            const result = run((data, id) => deleteChatFolder(data, id, deleting.id));
            onDone(result.ok ? "Pasta excluída. As Sessões continuam na lista." : result.error);
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );

  return {
    dialogs,
    openCreate: () => {
      setError(null);
      setEditing({ name: "" });
    },
    openRename: (folder: ChatFolder) => {
      setError(null);
      setEditing({ id: folder.id, name: folder.name });
    },
    openDelete: (folder: ChatFolder) => setDeleting(folder),
  };
}
