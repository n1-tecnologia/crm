"use client";

/**
 * 12.4.4 — criar e editar Equipe: nome e descrição. Os Membros entram e saem
 * no painel da própria Equipe (`configuracoes/equipes/page.tsx`). Quem recusa
 * é o domínio (`createTeam`, `updateTeam`).
 */

import { useState } from "react";
import type { Team } from "@n1/dominio";
import { createTeam, updateTeam } from "@n1/dominio/operations";
import { useRun } from "@/dados/store";
import { ConfirmDialog, Field, TextArea, TextInput } from "@/features/shell/ui";

/** `equipe` ausente = Equipe nova. Monte com `key` diferente a cada abertura. */
export function EquipeDialog({
  equipe,
  onClose,
  onDone,
}: {
  readonly equipe?: Team;
  readonly onClose: () => void;
  readonly onDone: (frase: string) => void;
}) {
  const run = useRun();
  const [nome, setNome] = useState(equipe?.name ?? "");
  const [descricao, setDescricao] = useState(equipe?.description ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const gravar = () => {
    const r = equipe
      ? run((data, me) => updateTeam(data, me, equipe.id, { nome, descricao }))
      : run((data, me) => createTeam(data, me, { nome, ...(descricao.trim() ? { descricao } : {}) }));
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    onDone(equipe ? `Equipe ${r.value.name} alterada.` : `Equipe ${r.value.name} criada. Agora ponha os Membros nela.`);
    onClose();
  };

  return (
    <ConfirmDialog
      open
      title={equipe ? `Editar ${equipe.name}` : "Nova Equipe"}
      description="Uma Equipe concede a mesma permissão a várias pessoas de uma vez. Não substitui o Papel e não é hierarquia."
      confirmLabel={equipe ? "Gravar" : "Criar Equipe"}
      {...(!nome.trim() ? { confirmDisabledReason: "Dê um nome à Equipe." } : {})}
      onConfirm={gravar}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        <Field label="Nome" required>
          {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Suporte" required />}
        </Field>
        <Field label="Descrição">
          {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} />}
        </Field>
        {erro ? (
          <p role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
