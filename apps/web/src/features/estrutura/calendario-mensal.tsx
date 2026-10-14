"use client";

/**
 * PARD-01 — o Calendário da Lista como grade de mês: sete colunas, as semanas
 * do mês, cada Tarefa no dia em que vence (no fuso do Espaço de Trabalho).
 * Navega por mês, volta a hoje, e arrastar uma Tarefa para outro dia muda o
 * vencimento dela por `updateTask` — as regras da Tarefa continuam valendo, e
 * a recusa aparece como em qualquer outra gravação. As Tarefas sem vencimento
 * ficam numa faixa abaixo da grade: arrastar uma delas para um dia dá a data;
 * arrastar uma datada para a faixa tira.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { isOverdue, statusDefinition } from "@n1/dominio/derive";
import { updateTask } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { useFormat } from "@/features/shell/use-format";
import { useRecente } from "@/features/shell/recente";
import { Button, EmptyState, Icone } from "@/features/shell/ui";
import { dataNoDia, diaDaTarefa, gradeDoMes, hojeNoFuso, mesDe, mesVizinho, type Dia } from "./calendario";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function CalendarioMensal({
  state,
  tasks,
  openTask,
  editavel,
  report,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly openTask: (taskId: string) => void;
  /** Falso quando a Lista não está efetivamente ativa: nada se arrasta. */
  readonly editavel: boolean;
  readonly report: Report;
}) {
  const run = useRun();
  const fmt = useFormat();
  const recente = useRecente();
  const timezone = useData((data) => data.workspace.locale.timezone);
  const hoje = hojeNoFuso(timezone);
  const [mes, setMes] = useState(() => mesDe(hoje));
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Dia | "sem-data" | null>(null);

  const porDia = new Map<Dia, Task[]>();
  const semData: Task[] = [];
  for (const task of tasks) {
    const dia = diaDaTarefa(task, timezone);
    if (dia === undefined) semData.push(task);
    else porDia.set(dia, [...(porDia.get(dia) ?? []), task]);
  }

  const soltar = (destino: Dia | "sem-data") => {
    setSobre(null);
    if (!arrastando || !editavel) return;
    const task = tasks.find((t) => t.id === arrastando);
    setArrastando(null);
    if (!task) return;
    if (destino === "sem-data") {
      if (!task.dueDate) return;
      report(
        run((data, me) => updateTask(data, me, task.id, { dueDate: null })),
        `“${task.title}” ficou sem vencimento.`,
      );
      return;
    }
    if (diaDaTarefa(task, timezone) === destino) return;
    const nova = dataNoDia(task.dueDate, destino, timezone);
    report(
      run((data, me) => updateTask(data, me, task.id, { dueDate: nova })),
      `“${task.title}” agora vence em ${fmt.taskDate(nova)}.`,
    );
  };

  const [ano, m] = mes.split("-").map(Number) as [number, number];
  const tituloDoMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(ano, m - 1, 1)));
  const noMes = [...porDia.entries()].filter(([dia]) => mesDe(dia) === mes).reduce((n, [, grupo]) => n + grupo.length, 0);

  const chip = (task: Task) => {
    const definition = statusDefinition(state, task.listId, task.statusId);
    const atrasada = isOverdue(state, task, new Date());
    return (
      <li key={task.id}>
        <button
          type="button"
          draggable={editavel}
          onDragStart={() => setArrastando(task.id)}
          onDragEnd={() => {
            setArrastando(null);
            setSobre(null);
          }}
          onClick={() => openTask(task.id)}
          title={editavel ? `${task.title} — arraste para outro dia` : task.title}
          data-recente={task.id === recente ? "true" : undefined}
          className="flex w-full items-center gap-1.5 rounded-[var(--r-caixa)] px-1.5 py-1 text-left hover:bg-[var(--superficie-2)]"
          style={{ cursor: editavel ? "grab" : "pointer", opacity: arrastando === task.id ? 0.5 : 1 }}
        >
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: definition?.color ?? "var(--texto-4)" }} />
          <span className="app-sm min-w-0 flex-1 truncate" style={{ color: atrasada ? "var(--erro)" : "var(--texto)" }}>
            {task.dueDate?.form === "instant" ? `${fmt.taskDate(task.dueDate).slice(-5)} ` : ""}
            {task.title}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMes(mesVizinho(mes, -1))} aria-label="Mês anterior" title="Mês anterior" className="btn-icone btn-icone-nu">
          <Icone de={ChevronLeft} tamanho="xs" />
        </button>
        <span className="app-md min-w-40 text-center capitalize" style={{ color: "var(--texto)" }}>
          {tituloDoMes}
        </span>
        <button type="button" onClick={() => setMes(mesVizinho(mes, 1))} aria-label="Mês seguinte" title="Mês seguinte" className="btn-icone btn-icone-nu">
          <Icone de={ChevronRight} tamanho="xs" />
        </button>
        <Button size="sm" onClick={() => setMes(mesDe(hoje))} disabled={mes === mesDe(hoje)} disabledReason="Já é o mês de hoje.">
          Hoje
        </Button>
        <span className="app-meta ml-auto">
          {noMes} {noMes === 1 ? "Tarefa vence" : "Tarefas vencem"} neste mês
        </span>
      </div>

      <div role="grid" aria-label={`Calendário de ${tituloDoMes}`} className="grid grid-cols-7 overflow-hidden rounded-[var(--r-controle)]" style={{ border: "1px solid var(--linha)" }}>
        {DIAS_DA_SEMANA.map((nome) => (
          <div key={nome} role="columnheader" className="app-coluna px-2 py-1.5 text-center" style={{ background: "var(--superficie-2)", borderBottom: "1px solid var(--linha)" }}>
            {nome}
          </div>
        ))}
        {gradeDoMes(mes).flat().map((celula, i) => {
          const grupo = porDia.get(celula.dia) ?? [];
          const ehHoje = celula.dia === hoje;
          return (
            <div
              key={celula.dia}
              role="gridcell"
              aria-label={`${celula.dia}, ${grupo.length} Tarefa(s)`}
              onDragOver={(event) => {
                if (!editavel || !arrastando) return;
                event.preventDefault();
                if (sobre !== celula.dia) setSobre(celula.dia);
              }}
              onDragLeave={() => {
                if (sobre === celula.dia) setSobre(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                soltar(celula.dia);
              }}
              className="flex min-h-24 flex-col gap-1 p-1.5"
              style={{
                borderTop: "1px solid var(--linha)",
                borderLeft: i % 7 === 0 ? undefined : "1px solid var(--linha)",
                background: sobre === celula.dia ? "var(--acento-lavado)" : celula.doMes ? undefined : "var(--superficie-2)",
                opacity: celula.doMes ? 1 : 0.7,
              }}
            >
              <span
                className="app-sm app-numero self-end rounded-full px-1.5"
                style={ehHoje ? { background: "var(--acento)", color: "var(--sobre-acento)" } : { color: celula.doMes ? "var(--texto-2)" : "var(--texto-4)" }}
                aria-current={ehHoje ? "date" : undefined}
              >
                {Number(celula.dia.slice(8, 10))}
              </span>
              {grupo.length > 0 ? <ul className="grid gap-0.5">{grupo.map(chip)}</ul> : null}
            </div>
          );
        })}
      </div>

      <section
        aria-label="Sem vencimento"
        onDragOver={(event) => {
          if (!editavel || !arrastando) return;
          event.preventDefault();
          if (sobre !== "sem-data") setSobre("sem-data");
        }}
        onDragLeave={() => {
          if (sobre === "sem-data") setSobre(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          soltar("sem-data");
        }}
        className="rounded-[var(--r-controle)] p-2"
        style={{ border: "1px dashed var(--linha-forte)", background: sobre === "sem-data" ? "var(--acento-lavado)" : undefined }}
      >
        <p className="app-sm mb-1" style={{ color: "var(--texto-3)" }}>
          Sem vencimento · {semData.length}
          {editavel ? " — arraste para um dia para dar a data, ou solte aqui para tirar." : ""}
        </p>
        {semData.length === 0 ? (
          <EmptyState compact title="Toda Tarefa desta Lista tem vencimento." />
        ) : (
          <ul className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-3">{semData.map(chip)}</ul>
        )}
      </section>
      {!editavel ? <p className="app-meta">Esta Lista não está ativa: o Calendário é só leitura.</p> : null}
    </div>
  );
}
