/**
 * PARD-01 — o que o Calendário da Lista calcula, sem React: em que DIA uma
 * Tarefa cai, a grade do mês e o que arrastar uma Tarefa para outro dia
 * significa para a data dela.
 *
 * Um dia civil (`civilDay`) não tem fuso: é o dia que está escrito. Um
 * instante (`instant`, a Reunião com hora) cai no dia em que acontece NO FUSO
 * DO ESPAÇO DE TRABALHO — não no dia UTC, que virava a véspera à noite no
 * Brasil. Mover um instante para outro dia preserva a hora (6.2: a data mantém
 * a forma que tinha); mover um dia civil troca só o dia.
 */

import { isoNoFuso } from "@n1/dominio/relogio";
import type { Task, TaskDate } from "@n1/dominio/types";

/** "AAAA-MM-DD" */
export type Dia = string;

export function diaDaData(date: TaskDate, timezone: string): Dia {
  return date.form === "civilDay" ? date.value : isoNoFuso(new Date(date.value), timezone).slice(0, 10);
}

export function diaDaTarefa(task: Pick<Task, "dueDate">, timezone: string): Dia | undefined {
  return task.dueDate ? diaDaData(task.dueDate, timezone) : undefined;
}

export function hojeNoFuso(timezone: string, agora = new Date()): Dia {
  return isoNoFuso(agora, timezone).slice(0, 10);
}

/** "AAAA-MM" do dia. */
export function mesDe(dia: Dia): string {
  return dia.slice(0, 7);
}

export function mesVizinho(mes: string, delta: -1 | 1): string {
  const [ano, m] = mes.split("-").map(Number) as [number, number];
  const indice = ano * 12 + (m - 1) + delta;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

function diaCivil(ano: number, mesIndice: number, dia: number): Dia {
  // Date.UTC só para a aritmética de calendário: nunca interpreta fuso nenhum.
  return new Date(Date.UTC(ano, mesIndice, dia)).toISOString().slice(0, 10);
}

export interface CelulaDoMes {
  readonly dia: Dia;
  readonly doMes: boolean;
}

/**
 * As semanas do mês, de domingo a sábado, completadas com os dias vizinhos
 * para a grade ficar retangular — sempre 7 colunas, 4 a 6 linhas.
 */
export function gradeDoMes(mes: string): CelulaDoMes[][] {
  const [ano, m] = mes.split("-").map(Number) as [number, number];
  // `inicio` é o deslocamento (negativo ou zero) do domingo da primeira semana até o dia 1.
  const inicio = -new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const total = Math.ceil((ultimo - inicio) / 7) * 7;
  const semanas: CelulaDoMes[][] = [];
  for (let i = 0; i < total; i += 1) {
    const d = inicio + i;
    if (i % 7 === 0) semanas.push([]);
    semanas[semanas.length - 1]?.push({ dia: diaCivil(ano, m - 1, d + 1), doMes: d >= 0 && d < ultimo });
  }
  return semanas;
}

/** O instante UTC de "dia T hh:mm" lido no fuso dado — sem biblioteca: compara o palpite UTC com o que o fuso diz dele. */
export function instanteNoFuso(dia: Dia, hora: string, timezone: string): string {
  const [ano, m, d] = dia.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hora.split(":").map(Number) as [number, number];
  let palpite = Date.UTC(ano, m - 1, d, hh, mm);
  // Duas rodadas cobrem a troca de horário de verão no meio do caminho.
  for (let i = 0; i < 2; i += 1) {
    const lido = isoNoFuso(new Date(palpite), timezone);
    const [ld, lh] = lido.split("T") as [string, string];
    const [la, lm, ldd] = ld.split("-").map(Number) as [number, number, number];
    const [lhh, lmm] = lh.split(":").map(Number) as [number, number];
    const diferenca = Date.UTC(la, lm - 1, ldd, lhh, lmm) - Date.UTC(ano, m - 1, d, hh, mm);
    if (diferenca === 0) break;
    palpite -= diferenca;
  }
  return new Date(palpite).toISOString();
}

/** A data da Tarefa depois de arrastá-la para `novoDia`: dia civil troca o dia; instante troca o dia e mantém a hora. */
export function dataNoDia(atual: TaskDate | undefined, novoDia: Dia, timezone: string): TaskDate {
  if (atual?.form === "instant") {
    const hora = isoNoFuso(new Date(atual.value), timezone).slice(11, 16);
    return { form: "instant", value: instanteNoFuso(novoDia, hora, timezone) };
  }
  return { form: "civilDay", value: novoDia };
}
