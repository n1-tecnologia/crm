"use client";

/**
 * IMPORTAR DO CANAL — o Canal lê os grupos de que participa e cria os que
 * ainda não existem, com Participações `importado` e Captação inativa até o
 * Membro decidir (DO-GRP-05). O diálogo diz quantos o provedor conhece e
 * quantos já estão aqui antes de importar.
 */

import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { GRUPOS_NO_PROVEDOR, importarGruposDoCanal, recusaDoCanal } from "@n1/dominio/operations";
import type { Report } from "@/features/shell/ficha";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";

export function ImportarGruposDialog({ open, onClose, report }: { readonly open: boolean; readonly onClose: () => void; readonly report: Report }) {
  if (!open) return null;
  return <Formulario onClose={onClose} report={report} />;
}

function Formulario({ onClose, report }: { readonly onClose: () => void; readonly report: Report }) {
  const state = useData((data) => data);
  const run = useRun();
  const canais = state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo");
  const [canalId, setCanalId] = useState(canais.find((c) => c.connection === "conectada")?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const canal = canais.find((c) => c.id === canalId);
  const recusa = recusaDoCanal(state, canalId || undefined, "gruposAdministraveis");
  const noProvedor = canal ? (GRUPOS_NO_PROVEDOR[canal.externalId] ?? []) : [];
  const existentes = new Set(state.grupos.map((g) => g.identificadorExterno));
  const novos = noProvedor.filter((g) => !existentes.has(g.jid));

  const confirmar = () => {
    const r = run((data, me) => importarGruposDoCanal(data, me, canalId));
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    report(r, `${r.value.importados.length} Grupo${r.value.importados.length === 1 ? "" : "s"} importado${r.value.importados.length === 1 ? "" : "s"}; ${r.value.jaExistiam} já existia${r.value.jaExistiam === 1 ? "" : "m"}. Captação inativa até você ativá-la.`);
    onClose();
  };

  return (
    <ConfirmDialog
      open
      title="Importar Grupos do Canal"
      description="O Canal lê os grupos de que participa. Os que já existem aqui não são duplicados; os novos entram com Participações importadas e Captação inativa (DO-GRP-05)."
      confirmLabel={novos.length === 0 ? "Nada a importar" : `Importar ${novos.length}`}
      {...(recusa ? { confirmDisabledReason: recusa } : novos.length === 0 ? { confirmDisabledReason: "Todos os grupos deste Canal já estão na plataforma." } : {})}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        <Field label="Canal" required>
          {(id) => (
            <Select
              id={id}
              value={canalId}
              onChange={setCanalId}
              placeholder="Escolher o Canal"
              options={canais.map((c) => {
                const r = recusaDoCanal(state, c.id, "gruposAdministraveis");
                return { value: c.id, label: c.name, detail: `${(GRUPOS_NO_PROVEDOR[c.externalId] ?? []).length} no provedor`, ...(r ? { disabledReason: r } : {}) };
              })}
            />
          )}
        </Field>
        {canal ? (
          <ul className="pilha-solta">
            {noProvedor.map((g) => (
              <li key={g.jid} className="item-solto">
                <span className="min-w-0 flex-1">
                  <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                    {g.nome}
                  </span>
                  <span className="app-meta block truncate">
                    {g.participantes.length + 1} participantes · Canal {g.papelDoCanal}
                  </span>
                </span>
                <span className="app-meta">{existentes.has(g.jid) ? "já existe" : "novo"}</span>
              </li>
            ))}
            {noProvedor.length === 0 ? <li className="app-meta px-2 py-1">O provedor não lista grupos para este Canal.</li> : null}
          </ul>
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
