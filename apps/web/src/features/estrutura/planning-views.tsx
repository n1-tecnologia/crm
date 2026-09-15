"use client";

/**
 * Fase 3 — as Visualizações que só fazem sentido com datas e estimativas:
 * Linha do tempo (barras entre início e vencimento, arrastáveis) e Carga de
 * trabalho (estimativa por Membro por semana contra a capacidade dele).
 *
 * Sem biblioteca: a Linha do tempo é um grid CSS com uma coluna por dia. As
 * setas de Dependência são um SVG por cima, medido a partir das colunas.
 */

import { useMemo, useRef, useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { updateTask } from "@n1/dominio/operations";
import { memberCapacityMinutes } from "@n1/dominio/operations/planning";
import { civilPlusDays, isTerminalCategory, statusCategory, statusDefinition, taskCivilDay, taskWriteRefusal, weekStartOf, workload } from "@n1/dominio/derive";
import { useFormat } from "@/features/shell/use-format";
import { EmptyState, Painel, ReguaDeSecao } from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";
import type { Task, TaskDate } from "@n1/dominio/types";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

const DAY_PX = 28;
const ROW_PX = 36;
const LABEL_PX = 240;

const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay ?? 0, (am ?? 1) - 1, ad ?? 1).getTime();
  const db = new Date(by ?? 0, (bm ?? 1) - 1, bd ?? 1).getTime();
  return Math.round((db - da) / 86_400_000);
};

/** Desloca uma data da Tarefa em dias, preservando a forma (dia civil ou instante). */
function shiftDate(date: TaskDate, days: number): TaskDate {
  if (date.form === "civilDay") return { form: "civilDay", value: civilPlusDays(date.value, days) };
  const d = new Date(date.value);
  d.setDate(d.getDate() + days);
  return { form: "instant", value: d.toISOString() };
}

/* ───────────────────────────── Linha do tempo ───────────────────────────── */

export function LinhaDoTempo({
  state,
  tasks,
  openTask,
  editavel,
  report,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly openTask: (taskId: string) => void;
  readonly editavel: boolean;
  readonly report: Report;
}) {
  const fmt = useFormat();
  const run = useRun();
  const { memberId } = useSession();
  const [drag, setDrag] = useState<{ taskId: string; startX: number; deltaDays: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const dated = useMemo(() => tasks.filter((t) => t.dueDate || t.startDate), [tasks]);
  const undated = tasks.filter((t) => !t.dueDate && !t.startDate);
  // Editar é por Tarefa: a Lista ativa não basta se este Membro não escreve nela (Convidado, por exemplo).
  const podeMover = (t: Task) => editavel && taskWriteRefusal(state, memberId, t.id) === undefined;

  const range = useMemo(() => {
    const hoje = weekStartOf(new Date().toISOString());
    let min = hoje;
    let max = civilPlusDays(hoje, 13);
    for (const t of dated) {
      const s = taskCivilDay(t.startDate) ?? taskCivilDay(t.dueDate);
      const e = taskCivilDay(t.dueDate) ?? taskCivilDay(t.startDate);
      if (s && s < min) min = s;
      if (e && e > max) max = e;
    }
    min = civilPlusDays(min, -3);
    max = civilPlusDays(max, 3);
    const days: string[] = [];
    for (let d = min; d <= max; d = civilPlusDays(d, 1)) days.push(d);
    return { min, days };
  }, [dated]);

  if (tasks.length === 0) return <EmptyState title="Nenhuma Tarefa nesta Lista ainda." />;

  const colOf = (day: string) => daysBetween(range.min, day);
  const hojeCol = colOf(new Date().toISOString().slice(0, 10));
  const rows = [...dated].sort((a, b) => (taskCivilDay(a.startDate) ?? taskCivilDay(a.dueDate) ?? "").localeCompare(taskCivilDay(b.startDate) ?? taskCivilDay(b.dueDate) ?? ""));
  const rowIndex = new Map(rows.map((t, i) => [t.id, i] as const));

  const barOf = (t: Task) => {
    const s = taskCivilDay(t.startDate) ?? taskCivilDay(t.dueDate) ?? range.min;
    const e = taskCivilDay(t.dueDate) ?? taskCivilDay(t.startDate) ?? s;
    const delta = drag?.taskId === t.id ? drag.deltaDays : 0;
    return { start: colOf(s) + delta, span: Math.max(1, daysBetween(s, e) + 1) };
  };

  const commitDrag = () => {
    if (!drag || drag.deltaDays === 0) {
      setDrag(null);
      return;
    }
    const task = tasks.find((t) => t.id === drag.taskId);
    setDrag(null);
    if (!task) return;
    const result = run((data, me) =>
      updateTask(data, me, task.id, {
        ...(task.startDate ? { startDate: shiftDate(task.startDate, drag.deltaDays) } : {}),
        ...(task.dueDate ? { dueDate: shiftDate(task.dueDate, drag.deltaDays) } : {}),
      }),
    );
    report(result, `“${task.title}” movida ${Math.abs(drag.deltaDays)} dia(s) ${drag.deltaDays > 0 ? "para frente" : "para trás"}.`);
  };

  // Setas: de quem bloqueia (fim da barra) para quem é bloqueada (início da barra).
  const arrows = rows.flatMap((t) =>
    t.dependencies
      .filter((d) => d.kind === "eBloqueadaPor" && rowIndex.has(d.taskId))
      .map((d) => {
        const from = tasks.find((x) => x.id === d.taskId);
        if (!from) return null;
        const a = barOf(from);
        const b = barOf(t);
        const fromRow = rowIndex.get(from.id) ?? 0;
        const toRow = rowIndex.get(t.id) ?? 0;
        return {
          key: `${from.id}-${t.id}`,
          x1: (a.start + a.span) * DAY_PX,
          y1: fromRow * ROW_PX + ROW_PX / 2,
          x2: b.start * DAY_PX,
          y2: toRow * ROW_PX + ROW_PX / 2,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null),
  );

  const gridWidth = range.days.length * DAY_PX;

  return (
    <div className="grid gap-4">
      <p className="app-meta">
        {editavel ? "Arraste uma barra para mudar as datas; " : ""}
        a linha vertical é hoje. Setas ligam a Tarefa que bloqueia à bloqueada.
      </p>
      {/* A coluna de nomes é `sticky` e precisa de fundo OPACO (`--card`): uma lavagem em alfa deixaria as barras vazarem por trás dela ao rolar. */}
      <Painel className="relative overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `${LABEL_PX}px ${gridWidth}px` }}>
          {/* Cabeçalho de dias */}
          <div
            className="app-coluna sticky left-0 z-10 flex items-center px-3 py-1"
            style={{ background: "var(--card)", borderBottom: "1px solid var(--linha)", borderRight: "1px solid var(--linha)" }}
          >
            Tarefa
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${range.days.length}, ${DAY_PX}px)`, background: "var(--superficie-2)", borderBottom: "1px solid var(--linha)" }}>
            {range.days.map((day) => {
              const [, m, d] = day.split("-");
              const domingo = new Date(day + "T00:00").getDay() === 0;
              return (
                <div key={day} className="app-xs app-numero py-1 text-center leading-tight" style={{ color: domingo ? "var(--texto)" : "var(--texto-4)" }} title={fmt.civilDate(day)}>
                  {d}
                  <span className="block">{domingo ? m : ""}</span>
                </div>
              );
            })}
          </div>

          {/* Rótulos */}
          <div className="sticky left-0 z-10" style={{ background: "var(--card)", borderRight: "1px solid var(--linha)" }}>
            {rows.map((t) => {
              const def = statusDefinition(state, t.listId, t.statusId);
              return (
                <div key={t.id} className="flex items-center gap-2 px-3" style={{ height: ROW_PX, borderBottom: "1px solid var(--linha)" }}>
                  <span aria-hidden="true" className="pilula-ponto" style={{ backgroundColor: def?.color ?? "var(--texto-4)" }} />
                  <button type="button" onClick={() => openTask(t.id)} className="app-base min-w-0 flex-1 truncate text-left hover:underline" style={{ color: "var(--texto)" }}>
                    {t.title}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Barras */}
          <div
            ref={gridRef}
            className="relative"
            style={{ height: rows.length * ROW_PX, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_PX - 1}px, var(--linha) ${DAY_PX - 1}px, var(--linha) ${DAY_PX}px)` }}
            onPointerMove={(event) => {
              if (!drag) return;
              setDrag({ ...drag, deltaDays: Math.round((event.clientX - drag.startX) / DAY_PX) });
            }}
            onPointerUp={commitDrag}
            onPointerLeave={() => {
              if (drag) commitDrag();
            }}
          >
            {hojeCol >= 0 && hojeCol < range.days.length ? (
              <div aria-hidden="true" className="absolute inset-y-0 w-px" style={{ left: hojeCol * DAY_PX + DAY_PX / 2, background: "var(--acento)" }} />
            ) : null}
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={gridWidth} height={rows.length * ROW_PX}>
              <defs>
                <marker id="seta" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill="var(--texto-3)" />
                </marker>
              </defs>
              {arrows.map((a) => (
                <path
                  key={a.key}
                  d={`M${a.x1},${a.y1} C${a.x1 + 12},${a.y1} ${a.x2 - 12},${a.y2} ${a.x2},${a.y2}`}
                  fill="none"
                  stroke="var(--texto-3)"
                  strokeWidth={1.5}
                  markerEnd="url(#seta)"
                />
              ))}
            </svg>
            {rows.map((t) => {
              const bar = barOf(t);
              const def = statusDefinition(state, t.listId, t.statusId);
              const done = isTerminalCategory(statusCategory(state, t));
              const row = rowIndex.get(t.id) ?? 0;
              return (
                <div
                  key={t.id}
                  role={podeMover(t) ? "slider" : undefined}
                  aria-label={podeMover(t) ? `Datas de ${t.title}` : undefined}
                  aria-valuetext={podeMover(t) ? `${fmt.civilDate(range.days[Math.max(0, Math.min(range.days.length - 1, bar.start))] ?? "")}, ${bar.span} dia(s)` : undefined}
                  tabIndex={podeMover(t) ? 0 : -1}
                  title={`${t.title}: ${t.startDate ? fmt.taskDate(t.startDate) : "sem início"} → ${t.dueDate ? fmt.taskDate(t.dueDate) : "sem vencimento"}`}
                  onPointerDown={(event) => {
                    if (!podeMover(t)) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDrag({ taskId: t.id, startX: event.clientX, deltaDays: 0 });
                  }}
                  onKeyDown={(event) => {
                    if (!podeMover(t)) return;
                    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                    if (delta === 0) return;
                    event.preventDefault();
                    const result = run((data, me) =>
                      updateTask(data, me, t.id, {
                        ...(t.startDate ? { startDate: shiftDate(t.startDate, delta) } : {}),
                        ...(t.dueDate ? { dueDate: shiftDate(t.dueDate, delta) } : {}),
                      }),
                    );
                    report(result, `“${t.title}” movida 1 dia ${delta > 0 ? "para frente" : "para trás"}.`);
                  }}
                  className={`app-sm absolute flex items-center overflow-hidden rounded-[var(--r-caixa)] px-2 select-none ${podeMover(t) ? "cursor-grab active:cursor-grabbing" : ""} ${done ? "opacity-50" : ""} ${drag?.taskId === t.id ? "ring-2 ring-[var(--acento)]" : ""}`}
                  style={{
                    top: row * ROW_PX + 6,
                    height: ROW_PX - 12,
                    left: bar.start * DAY_PX + 2,
                    width: bar.span * DAY_PX - 4,
                    backgroundColor: def?.color ?? "var(--texto-4)",
                    color: "var(--texto)",
                  }}
                >
                  <span className="truncate">{t.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Painel>

      {undated.length > 0 ? (
        <section>
          <ReguaDeSecao rotulo="Sem data" contagem={undated.length} />
          <ul className="flex flex-wrap gap-2">
            {undated.map((t) => (
              <li key={t.id}>
                {/* Tracejado: a Tarefa ainda não tem lugar na linha. `btn-sutil` mantém o título em caixa normal. */}
                <button type="button" onClick={() => openTask(t.id)} className="btn btn-sutil btn-sm" style={{ border: "1px dashed var(--linha-forte)", color: "var(--texto)" }}>
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
          <p className="app-meta mt-2">Dê início ou vencimento na Tarefa para ela entrar na linha.</p>
        </section>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Carga de trabalho ───────────────────────────── */

const horas = (min: number): string => (min >= 60 ? `${(min / 60).toFixed(min % 60 === 0 ? 0 : 1)} h` : `${Math.round(min)} min`);

export function CargaDeTrabalho({ state, tasks, openTask }: { readonly state: DataState; readonly tasks: readonly Task[]; readonly openTask: (taskId: string) => void }) {
  const fmt = useFormat();
  const members = useData((data) => data.members);
  const cells = workload(state, tasks);
  if (tasks.length === 0) return <EmptyState title="Nenhuma Tarefa nesta Lista ainda." />;
  if (cells.length === 0) {
    return (
      <EmptyState
        title="Nenhuma carga a somar."
        hint="A Carga soma a estimativa das Tarefas abertas por Responsável. Dê estimativa e Responsável às Tarefas para vê-la."
      />
    );
  }

  const weeks = [...new Set(cells.map((c) => c.week).filter((w) => w !== "semData"))].sort();
  const temSemData = cells.some((c) => c.week === "semData");
  const memberIds = [...new Set(cells.map((c) => c.memberId))];
  const cellOf = (memberId: string, week: string) => cells.find((c) => c.memberId === memberId && c.week === week);
  const semEstimativa = tasks.filter((t) => !isTerminalCategory(statusCategory(state, t)) && (t.estimate === undefined || t.estimate <= 0)).length;

  return (
    <div className="grid gap-3">
      <p className="app-meta">
        Estimativa das Tarefas abertas por Responsável, na semana do vencimento, contra a capacidade semanal de cada Membro. Uma Tarefa com dois Responsáveis divide a estimativa.
      </p>
      {/* Sem wrapper de rolagem: quem rola é o corpo da tela, e é nele que o cabeçalho de colunas gruda. */}
      <table className="tabela">
        <thead>
          <tr>
            <th className="app-coluna">Membro</th>
            <th className="app-coluna">Capacidade</th>
            {weeks.map((w) => (
              <th key={w} className="app-coluna">
                Semana de {fmt.civilDate(w)}
              </th>
            ))}
            {temSemData ? <th className="app-coluna">Sem vencimento</th> : null}
          </tr>
        </thead>
        <tbody>
          {memberIds.map((memberId) => {
            const capacidade = memberCapacityMinutes(state, memberId);
            return (
              <tr key={memberId}>
                <td className="app-md" style={{ color: "var(--texto)" }}>{members.find((m) => m.id === memberId)?.displayName ?? memberId}</td>
                <td className="app-numero" style={{ color: "var(--texto-3)" }}>{horas(capacidade)}/sem</td>
                {[...weeks, ...(temSemData ? ["semData"] : [])].map((w) => {
                  const cell = cellOf(memberId, w);
                  if (!cell) return <td key={w} style={{ color: "var(--texto-4)" }}>—</td>;
                  const pct = capacidade > 0 ? Math.round((cell.minutes / capacidade) * 100) : Infinity;
                  const acima = w !== "semData" && pct > 100;
                  return (
                    <td key={w} className="py-2">
                      <details>
                        <summary className="app-numero cursor-pointer list-none" style={{ color: acima ? "var(--erro)" : "var(--texto)", fontWeight: acima ? 600 : undefined }}>
                          {horas(cell.minutes)}
                          {w !== "semData" ? ` · ${Number.isFinite(pct) ? `${pct}%` : "sem capacidade"}` : ""}
                          {acima ? " · acima da capacidade" : ""}
                        </summary>
                        <ul className="mt-1 grid gap-0.5">
                          {cell.taskIds.map((id) => (
                            <li key={id}>
                              <button type="button" onClick={() => openTask(id)} className="app-sm hover:underline" style={{ color: "var(--texto-3)" }}>
                                {tasks.find((t) => t.id === id)?.title ?? id}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {semEstimativa > 0 ? (
        <p className="app-meta">
          {semEstimativa} Tarefa(s) aberta(s) sem estimativa ficam fora da soma.
        </p>
      ) : null}
    </div>
  );
}
