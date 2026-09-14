"use client";

/**
 * Mudança de Status em lote numa Lista — o Financeiro fecha 61 contas como
 * "pago" no mesmo minuto. Cada Tarefa passa pela mesma operação de sempre
 * (`changeTaskStatus`), uma a uma: o que uma recusa, a barra conta e nomeia.
 * Também o botão "Rodar automações por vencimento": o relógio do protótipo.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { changeTaskStatus, runScheduledAutomations } from "@/data/operations";
import { containerAdminRefusal } from "@/data/derive";
import { Button, ConfirmDialog, Field, Painel, Select } from "@/features/shell/ui";
import type { StatusDefinition, Task } from "@/data/types";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

export function BulkStatusBar({
  tasks,
  definitions,
  selected,
  onSelect,
  onClear,
  report,
}: {
  readonly tasks: readonly Task[];
  readonly definitions: readonly StatusDefinition[];
  readonly selected: ReadonlySet<string>;
  readonly onSelect: (ids: ReadonlySet<string>) => void;
  readonly onClear: () => void;
  readonly report: Report;
}) {
  const run = useRun();
  const [statusId, setStatusId] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const alvo = definitions.find((d) => d.id === statusId);
  const todosSelecionados = tasks.length > 0 && tasks.every((t) => selected.has(t.id));

  return (
    <Painel className="flex flex-wrap items-center gap-2 px-3 py-2">
      <ConfirmDialog
        open={confirmando}
        title={`Mover ${selected.size} Tarefa(s) para “${alvo?.name ?? ""}”?`}
        description="Cada uma passa pelas mesmas regras de uma mudança individual (requisitos de saída, quem pode entrar, Recorrência). As recusadas ficam onde estão e são listadas."
        confirmLabel="Mover todas"
        onConfirm={() => {
          setConfirmando(false);
          if (!alvo) return;
          const recusas: Array<{ id: string; texto: string }> = [];
          let movidas = 0;
          for (const id of selected) {
            const task = tasks.find((t) => t.id === id);
            if (!task) continue;
            const r = run((data, me) => changeTaskStatus(data, me, id, alvo.id));
            if (r.ok) movidas += 1;
            else recusas.push({ id, texto: `${task.title}: ${r.error}` });
          }
          if (recusas.length === 0) {
            report({ ok: true }, `${movidas} Tarefa(s) movida(s) para “${alvo.name}”.`);
            onClear();
          } else {
            report({ ok: false, error: `${movidas} movida(s); ${recusas.length} recusada(s) — ${recusas.slice(0, 3).map((r) => r.texto).join(" · ")}${recusas.length > 3 ? " …" : ""}` }, "");
            // Ficam selecionadas só as recusadas, pelo id — títulos se repetem entre meses.
            onSelect(new Set(recusas.map((r) => r.id)));
          }
        }}
        onCancel={() => setConfirmando(false)}
      />
      <label className="app-base flex items-center gap-2" style={{ color: "var(--texto)" }}>
        <input
          type="checkbox"
          checked={todosSelecionados}
          onChange={(event) => onSelect(event.target.checked ? new Set(tasks.map((t) => t.id)) : new Set())}
          className="size-4 accent-[var(--acento)]"
        />
        {selected.size === 0 ? "Selecionar todas as visíveis" : `${selected.size} selecionada(s)`}
      </label>
      <span className="min-w-56">
        <Field label="Mover para">
          {(id) => <Select id={id} value={statusId} onChange={setStatusId} placeholder="Escolher Status" options={definitions.map((d) => ({ value: d.id, label: d.name }))} />}
        </Field>
      </span>
      <Button variant="primary" onClick={() => setConfirmando(true)} disabled={selected.size === 0 || !alvo} disabledReason={selected.size === 0 ? "Selecione ao menos uma Tarefa." : "Escolha o Status de destino."}>
        Aplicar
      </Button>
      {selected.size > 0 ? (
        <Button variant="ghost" onClick={onClear}>
          Limpar seleção
        </Button>
      ) : null}
    </Painel>
  );
}

/** Só aparece quando a Lista tem Automação por vencimento; roda com a data de hoje. */
export function RunScheduledButton({ listId, report }: { readonly listId: string; readonly report: Report }) {
  const run = useRun();
  const { memberId } = useSession();
  const state = useData((data) => data);
  const agendadas = state.automations.filter((a) => a.lifecycle === "ativo" && a.scopeType === "list" && a.scopeId === listId && a.versions.some((v) => v.state === "publicada" && v.trigger?.kind === "condicaoTemporal"));
  if (agendadas.length === 0) return null;
  const bloqueio = containerAdminRefusal(state, memberId, "list", listId);
  return (
    <span title={`${agendadas.length} Automação(ões) por vencimento: ${agendadas.map((a) => a.name).join("; ")}`}>
      <Button
        onClick={() => {
          const r = run((data, me) => runScheduledAutomations(data, me, listId, new Date()));
          if (r.ok && r.value.failed > 0) {
            report(
              { ok: false, error: `${r.value.executed} executada(s); ${r.value.failed} falhou(aram): ${r.value.failures.map((f) => `${f.title} — ${f.reason}`).join(" · ")}` },
              "",
            );
          } else {
            report(r, r.ok ? `Automações por vencimento: ${r.value.executed} executada(s), ${r.value.skipped} já rodada(s) ou fora da condição.` : "");
          }
        }}
        disabled={bloqueio !== undefined}
        disabledReason={bloqueio ?? ""}
      >
        Rodar automações por vencimento (hoje)
      </Button>
    </span>
  );
}
