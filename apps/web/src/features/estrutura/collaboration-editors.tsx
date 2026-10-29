"use client";

/**
 * Fase 2 — o que se faz numa Tarefa no dia a dia: Dependências, tempo,
 * anexos e Recorrência. Cada editor chama uma operação e devolve o resultado
 * ao chamador, que avisa. Nada aqui decide permissão: a tela só é montada
 * quando a Tarefa é editável, e a operação recusa de novo por conta própria.
 */

import { Play, Square, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import {
  addDependency,
  addTimeEntry,
  removeDependency,
  runningTimer,
  setRecurrence,
  startTimer,
  stopTimer,
} from "@n1/dominio/operations";
import { effectiveLifecycleOfTask, effectiveListConfig, isTerminalCategory, listPath, memberSeesTask, statusCategory } from "@n1/dominio/derive";
import { useFormat } from "@/features/shell/use-format";
import { Button, ConfirmDialog, EmptyState, Field, Icone, Select, TextInput, Toggle } from "@/features/shell/ui";
import type { OperationResult } from "@n1/dominio/state";
import type { DependencyKind, RecurrenceRule, Task } from "@n1/dominio/types";
import Link from "next/link";

type Report = (result: OperationResult<unknown>, message: string) => void;

const KIND_LABEL: Record<DependencyKind, string> = {
  bloqueia: "bloqueia",
  eBloqueadaPor: "é bloqueada por",
  aguarda: "aguarda",
};

/* ───────────────────────────── Dependências ───────────────────────────── */

export function TaskDependencies({ task, report, readOnly }: { readonly task: Task; readonly report: Report; readonly readOnly: boolean }) {
  const run = useRun();
  const { memberId } = useSession();
  const state = useData((data) => data);
  const [kind, setKind] = useState<DependencyKind>("eBloqueadaPor");
  const [outra, setOutra] = useState("");
  const [removendo, setRemovendo] = useState<string | null>(null);

  // Candidatas: Tarefas ativas de qualquer Lista do Espaço de Trabalho que use
  // Dependências (tarefa.md, seção 7: Listas e Espaços diferentes são
  // permitidos; a funcionalidade precisa estar ligada nas DUAS Listas), fora
  // esta e as já ligadas.
  const ligadas = new Set(task.dependencies.map((d) => d.taskId));
  // Nem a própria árvore (INV-TAR-09) nem o que este Membro não alcança.
  const arvore = new Set<string>();
  for (let cur = state.tasks.find((t) => t.id === task.parentTaskId); cur; cur = state.tasks.find((t) => t.id === cur?.parentTaskId)) arvore.add(cur.id);
  const desce = (id: string) => {
    for (const filha of state.tasks.filter((t) => t.parentTaskId === id)) {
      arvore.add(filha.id);
      desce(filha.id);
    }
  };
  desce(task.id);
  const candidatas = state.tasks.filter(
    (t) =>
      t.id !== task.id &&
      !ligadas.has(t.id) &&
      (t.listId === task.listId || effectiveListConfig(state, t.listId)?.features.dependencias === true) &&
      !arvore.has(t.id) &&
      effectiveLifecycleOfTask(state, t.id) === "ativo" &&
      memberSeesTask(state, memberId, t.id),
  );
  const aRemover = task.dependencies.find((d) => d.id === removendo);
  const tituloDe = (id: string) => state.tasks.find((t) => t.id === id)?.title ?? id;
  // De outra Lista, o título sozinho não situa: vai o caminho "Espaço › Pasta › Lista".
  const caminhoDe = (listId: string) => (listId === task.listId ? undefined : listPath(state, listId).map((n) => n.name).join(" › "));

  return (
    <div className="grid gap-3">
      <ConfirmDialog
        open={removendo !== null}
        title="Remover a Dependência?"
        description={aRemover ? `“${task.title}” ${KIND_LABEL[aRemover.kind]} “${tituloDe(aRemover.taskId)}”. As duas Tarefas deixam de se referir uma à outra.` : ""}
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          if (removendo) report(run((data, me) => removeDependency(data, me, task.id, removendo)), "Dependência removida.");
          setRemovendo(null);
        }}
        onCancel={() => setRemovendo(null)}
      />
      {task.dependencies.length === 0 ? (
        <EmptyState compact title="Nenhuma Dependência." hint="Uma Tarefa bloqueada não conclui enquanto a que a bloqueia estiver aberta, se a Lista exigir." />
      ) : (
        <ul className="pilha-solta">
          {task.dependencies.map((dependency) => {
            const outraTarefa = state.tasks.find((t) => t.id === dependency.taskId);
            const aberta = outraTarefa ? !isTerminalCategory(statusCategory(state, outraTarefa)) : false;
            return (
              // A peça não clica por inteiro (o link é o título); a Dependência já satisfeita recua.
              <li key={dependency.id} className="item-solto app-base flex-wrap" data-estatico="true" data-atenuado={aberta ? undefined : "true"}>
                <span style={{ color: "var(--texto-3)" }}>{KIND_LABEL[dependency.kind]}</span>
                <Link href={`/estrutura/tarefas/${dependency.taskId}`} className="min-w-0 flex-1 truncate hover:underline" style={{ color: "var(--texto)" }}>
                  {outraTarefa?.title ?? dependency.taskId}
                </Link>
                {outraTarefa && caminhoDe(outraTarefa.listId) ? <span className="app-meta truncate">{caminhoDe(outraTarefa.listId)}</span> : null}
                <span className="app-meta">{aberta ? "aberta" : "concluída"}</span>
                {readOnly ? null : (
                  <button
                    type="button"
                    onClick={() => setRemovendo(dependency.id)}
                    aria-label={`Remover Dependência com ${outraTarefa?.title ?? dependency.taskId}`}
                    className="btn-icone btn-icone-nu"
                    style={{ color: "var(--erro)" }}
                  >
                    <Icone de={Trash2} tamanho="xs" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {readOnly ? null : (
        <form
          className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const result = run((data, me) => addDependency(data, me, task.id, kind, outra));
            report(result, "Dependência adicionada.");
            if (result.ok) setOutra("");
          }}
        >
          <Field label="Esta Tarefa">
            {(id) => (
              <Select
                id={id}
                value={kind}
                onChange={(v) => setKind(v as DependencyKind)}
                options={(Object.keys(KIND_LABEL) as DependencyKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              />
            )}
          </Field>
          <Field label="Outra Tarefa">
            {(id) => (
              <Select
                id={id}
                value={outra}
                onChange={setOutra}
                searchable
                placeholder={candidatas.length === 0 ? "Nenhuma outra Tarefa ativa em Lista com Dependências" : "Escolher"}
                options={candidatas.map((t) => {
                  const caminho = caminhoDe(t.listId);
                  return { value: t.id, label: t.title, ...(caminho ? { detail: caminho } : {}) };
                })}
                disabled={candidatas.length === 0}
                disabledReason="Não há outra Tarefa ativa em Lista que use Dependências."
              />
            )}
          </Field>
          <Button type="submit" variant="primary" disabled={outra === ""} disabledReason="Escolha a outra Tarefa.">
            Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

/* ───────────────────────────── Tempo ───────────────────────────── */

function minutos(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}

/** O cronômetro aberto conta na tela; `revision` não muda enquanto ele corre, então há um relógio local. */
function useAgora(ativo: boolean): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ativo]);
  return agora;
}

export function TaskTime({ task, report, readOnly }: { readonly task: Task; readonly report: Report; readonly readOnly: boolean }) {
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const state = useData((data) => data);
  const [duracao, setDuracao] = useState("");
  const [nota, setNota] = useState("");
  const meuAberto = runningTimer(state, memberId);
  const abertoAqui = meuAberto?.task.id === task.id ? meuAberto.entry : undefined;
  const agora = useAgora(abertoAqui !== undefined);

  const fechados = task.timeEntries.filter((e) => e.end !== undefined);
  const total = fechados.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  const nomeDe = (id: string) => state.members.find((m) => m.id === id)?.displayName ?? id;
  const duracaoNumero = Number(duracao);
  const duracaoValida = Number.isFinite(duracaoNumero) && duracaoNumero > 0 && duracaoNumero <= 24 * 60;

  return (
    <div className="grid gap-3">
      <p className="app-base" style={{ color: "var(--texto)" }}>
        Total registrado: <strong className="app-numero">{minutos(total)}</strong>
        {task.estimate !== undefined ? <span className="app-numero" style={{ color: "var(--texto-3)" }}> · estimativa {minutos(task.estimate)}</span> : null}
      </p>

      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {abertoAqui ? (
            <>
              <span className="app-base app-numero" style={{ color: "var(--texto)" }} aria-live="off">
                {minutos(Math.max(0, Math.floor((agora - Date.parse(abertoAqui.start)) / 60_000)))} correndo
              </span>
              <Button onClick={() => report(run((data, me) => stopTimer(data, me, task.id)), "Cronômetro parado.")} icon={<Icone de={Square} tamanho="xs" />}>
                Parar
              </Button>
            </>
          ) : (
            <Button
              onClick={() => report(run((data, me) => startTimer(data, me, task.id)), "Cronômetro iniciado.")}
              icon={<Icone de={Play} tamanho="xs" />}
              disabled={meuAberto !== undefined}
              disabledReason={meuAberto ? `Você já tem um cronômetro aberto em “${meuAberto.task.title}”.` : ""}
            >
              Iniciar cronômetro
            </Button>
          )}
          {meuAberto && meuAberto.task.id !== task.id ? (
            <Link href={`/estrutura/tarefas/${meuAberto.task.id}`} className="app-sm underline" style={{ color: "var(--texto-3)" }}>
              Cronômetro aberto em “{meuAberto.task.title}”
            </Link>
          ) : null}
        </div>
      )}

      {readOnly ? null : (
        <form
          className="grid gap-2 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const result = run((data, me) => addTimeEntry(data, me, task.id, { durationMinutes: duracaoNumero, description: nota }));
            report(result, "Tempo registrado.");
            if (result.ok) {
              setDuracao("");
              setNota("");
            }
          }}
        >
          <Field label="Minutos">
            {(id) => <TextInput id={id} value={duracao} onChange={setDuracao} type="number" placeholder="Ex.: 45" />}
          </Field>
          <Field label="No que trabalhou">
            {(id) => <TextInput id={id} value={nota} onChange={setNota} placeholder="Opcional" />}
          </Field>
          <Button type="submit" variant="primary" disabled={!duracaoValida} disabledReason="Informe os minutos: de 1 a 1440.">
            Lançar
          </Button>
        </form>
      )}

      {task.timeEntries.length === 0 ? (
        <EmptyState compact title="Nenhum tempo registrado." />
      ) : (
        <ul className="pilha-solta">
          {[...task.timeEntries]
            .sort((a, b) => b.start.localeCompare(a.start))
            .map((entry) => (
              // Lançamento de hora é leitura: peça estática.
              <li key={entry.id} className="item-solto app-base flex-wrap" data-estatico="true">
                <span style={{ color: "var(--texto)" }}>{nomeDe(entry.memberId)}</span>
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--texto-3)" }}>{entry.description ?? ""}</span>
                <span className="app-meta app-numero">{fmt.instant(entry.start)}</span>
                <span className="app-numero" style={{ color: "var(--texto)" }}>{entry.end ? minutos(entry.durationMinutes ?? 0) : "em andamento"}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────────────────────── Recorrência ───────────────────────────── */

const FREQ_LABEL: Record<RecurrenceRule["frequency"], string> = {
  diaria: "dia(s)",
  semanal: "semana(s)",
  mensal: "mês(es)",
  anual: "ano(s)",
};

export function TaskRecurrence({ task, report, readOnly }: { readonly task: Task; readonly report: Report; readonly readOnly: boolean }) {
  const run = useRun();
  const atual = task.recurrence;
  const [aberto, setAberto] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceRule["frequency"]>(atual?.frequency ?? "semanal");
  const [triggerMode, setTriggerMode] = useState<RecurrenceRule["triggerMode"]>(atual?.triggerMode ?? "aoConcluir");
  // FUND-08 — "" é qualquer conclusão (a ontologia); um id é entrar naquele Status terminal.
  const [triggerStatusId, setTriggerStatusId] = useState(atual?.triggerStatusId ?? "");
  // FUND-17 — por calendário com a corrente ainda aberta: gerar mesmo assim (duas abertas) ou aguardar a conclusão.
  const [whenStillOpen, setWhenStillOpen] = useState<NonNullable<RecurrenceRule["whenStillOpen"]>>(atual?.whenStillOpen ?? "gerarMesmoAssim");
  const [interval, setInterval] = useState(String(atual?.interval ?? 1));
  const [endsAfter, setEndsAfter] = useState(atual?.endsAfter !== undefined ? String(atual.endsAfter) : "");
  const [copies, setCopies] = useState(atual?.copies ?? { checklists: true, subtasks: false, assignees: true, fieldValues: true });
  const [removendo, setRemovendo] = useState(false);
  const ids = useId();

  const intervalo = Number(interval);
  const fim = endsAfter.trim() === "" ? undefined : Number(endsAfter);
  const valido = Number.isInteger(intervalo) && intervalo >= 1 && (fim === undefined || (Number.isInteger(fim) && fim >= 1)) && task.dueDate !== undefined;
  const membros = useData((data) => data.members);
  const statusTerminais = useData((data) => (effectiveListConfig(data, task.listId)?.statusSet.definitions ?? []).filter((d) => isTerminalCategory(d.category)));
  const nomeDoStatus = (id: string) => statusTerminais.find((d) => d.id === id)?.name ?? id;
  const descricao = (rule: RecurrenceRule) =>
    `A cada ${rule.interval} ${FREQ_LABEL[rule.frequency]}, ${
      rule.triggerMode === "aoConcluir" ? (rule.triggerStatusId ? `ao entrar em “${nomeDoStatus(rule.triggerStatusId)}”` : "ao concluir") : "por calendário"
    }${rule.endsAfter !== undefined ? `, até ${rule.endsAfter} ocorrência(s)` : ""}` +
    `${rule.businessDays ? `; fim de semana vai para o dia útil ${rule.businessDays}` : ""}` +
    `${rule.defaultAssigneeMemberId ? `; a próxima nasce com ${membros.find((m) => m.id === rule.defaultAssigneeMemberId)?.displayName ?? rule.defaultAssigneeMemberId}` : ""}` +
    `${rule.copies.fieldValuesExcept?.length ? `; não copia ${rule.copies.fieldValuesExcept.length} Campo(s)` : ""}.`;

  return (
    <div className="grid gap-3">
      <ConfirmDialog
        open={removendo}
        title="Remover a Recorrência?"
        description="Concluir esta Tarefa deixa de criar a próxima ocorrência. As já criadas continuam."
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          report(run((data, me) => setRecurrence(data, me, task.id, null)), "Recorrência removida.");
          setRemovendo(false);
        }}
        onCancel={() => setRemovendo(false)}
      />
      {atual ? (
        <p className="app-base" style={{ color: "var(--texto)" }}>
          {descricao(atual)}
          {atual.triggerMode === "porCalendario" ? (
            <span className="app-meta block">
              A próxima nasce no dia do vencimento
              {atual.whenStillOpen === "aguardarConclusao" ? "; se esta ainda estiver aberta, espera a conclusão" : "; se esta ainda estiver aberta, as duas coexistem"}.
            </span>
          ) : null}
        </p>
      ) : (
        <p className="app-base" style={{ color: "var(--texto-3)" }}>Não se repete.</p>
      )}
      {task.provenance?.kind === "recurrence" ? (
        <p className="app-meta">
          Gerada de{" "}
          <Link href={`/estrutura/tarefas/${task.provenance.sourceId}`} className="underline">
            {task.provenance.sourceName}
          </Link>
          .
        </p>
      ) : null}
      {readOnly ? null : aberto ? (
        <form
          className="painel grid gap-2 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            // O formulário edita o que mostra; o resto da regra (dia útil, Responsável padrão,
            // Campos não copiados) atravessa intacto.
            const rule: RecurrenceRule = {
              ...(atual ?? {}),
              frequency,
              interval: intervalo,
              triggerMode,
              ...(triggerMode === "aoConcluir" && triggerStatusId ? { triggerStatusId } : {}),
              ...(triggerMode === "porCalendario" ? { whenStillOpen } : {}),
              ...(fim !== undefined ? { endsAfter: fim } : {}),
              copies: { ...copies, ...(atual?.copies.fieldValuesExcept ? { fieldValuesExcept: atual.copies.fieldValuesExcept } : {}) },
            };
            if (fim === undefined) delete (rule as { endsAfter?: number }).endsAfter;
            if (triggerMode !== "aoConcluir" || !triggerStatusId) delete (rule as { triggerStatusId?: string }).triggerStatusId;
            if (triggerMode !== "porCalendario") delete (rule as { whenStillOpen?: string }).whenStillOpen;
            const result = run((data, me) => setRecurrence(data, me, task.id, rule));
            report(result, "Recorrência definida.");
            if (result.ok) setAberto(false);
          }}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="A cada">
              {(id) => <TextInput id={id} value={interval} onChange={setInterval} type="number" />}
            </Field>
            <Field label="Unidade">
              {(id) => (
                <Select
                  id={id}
                  value={frequency}
                  onChange={(v) => setFrequency(v as RecurrenceRule["frequency"])}
                  options={(Object.keys(FREQ_LABEL) as RecurrenceRule["frequency"][]).map((f) => ({ value: f, label: FREQ_LABEL[f] }))}
                />
              )}
            </Field>
            <Field label="Termina após" hint="Ocorrências no total; vazio é sem fim.">
              {(id) => <TextInput id={id} value={endsAfter} onChange={setEndsAfter} type="number" placeholder="sem fim" />}
            </Field>
          </div>
          <Field
            label="Quando a próxima nasce"
            hint={triggerMode === "porCalendario" ? "A próxima nasce no dia do vencimento desta, pela agenda da Lista — concluída ou não." : "A próxima ocorrência nasce quando esta é concluída."}
          >
            {(id) => (
              <Select
                id={id}
                value={triggerMode}
                onChange={(v) => setTriggerMode(v as RecurrenceRule["triggerMode"])}
                options={[
                  { value: "aoConcluir", label: "ao concluir" },
                  { value: "porCalendario", label: "por calendário" },
                ]}
              />
            )}
          </Field>
          {triggerMode === "porCalendario" ? (
            <Field label="Se esta ainda estiver aberta no vencimento" hint="Gerar mesmo assim deixa duas ocorrências abertas; aguardar segura a próxima até esta ser concluída.">
              {(id) => (
                <Select
                  id={id}
                  value={whenStillOpen}
                  onChange={(v) => setWhenStillOpen(v as NonNullable<RecurrenceRule["whenStillOpen"]>)}
                  options={[
                    { value: "gerarMesmoAssim", label: "gerar mesmo assim" },
                    { value: "aguardarConclusao", label: "aguardar a conclusão" },
                  ]}
                />
              )}
            </Field>
          ) : null}
          {triggerMode === "aoConcluir" && statusTerminais.length > 1 ? (
            <Field label="Ao entrar em" hint="Qual conclusão dispara a próxima. Em Contas a pagar, “pago” — não “aprovado” nem “negado”.">
              {(id) => (
                <Select
                  id={id}
                  value={triggerStatusId}
                  onChange={setTriggerStatusId}
                  options={[{ value: "", label: "qualquer conclusão" }, ...statusTerminais.map((d) => ({ value: d.id, label: d.name, color: d.color }))]}
                />
              )}
            </Field>
          ) : null}
          <fieldset className="grid gap-1">
            <legend className="rotulo">A próxima ocorrência copia</legend>
            {(
              [
                ["checklists", "Checklists (por fazer)"],
                ["assignees", "Responsáveis"],
                ["fieldValues", "Valores de Campo"],
              ] as const
            ).map(([key, label]) => (
              <span key={key} className="app-base flex items-center gap-2" style={{ color: "var(--texto)" }}>
                <Toggle checked={copies[key]} onChange={(v) => setCopies({ ...copies, [key]: v })} labelledBy={`${ids}-${key}`} />
                <span id={`${ids}-${key}`}>{label}</span>
              </span>
            ))}
          </fieldset>
          <span className="flex justify-end gap-2">
            <Button onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!valido} disabledReason={task.dueDate === undefined ? "Defina o vencimento antes: é dele que a próxima ocorrência é calculada." : "Intervalo e fim são inteiros maiores que zero."}>
              Salvar
            </Button>
          </span>
        </form>
      ) : (
        <span className="flex flex-wrap gap-2">
          <Button onClick={() => setAberto(true)} disabled={task.dueDate === undefined} disabledReason="Defina o vencimento antes: é dele que a próxima ocorrência é calculada.">
            {atual ? "Alterar" : "Repetir"}
          </Button>
          {atual ? (
            <Button variant="danger" onClick={() => setRemovendo(true)}>
              Remover
            </Button>
          ) : null}
        </span>
      )}
    </div>
  );
}
