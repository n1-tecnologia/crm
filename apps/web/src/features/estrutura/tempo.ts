/**
 * Formato do tempo registrado numa Tarefa (D-15, 11-03). Uma cópia só: o
 * editor `TaskTime` e a linha "Rastrear tempo" da Tarefa aberta partem do mesmo
 * `textoDoTempo(tempo).total`, então nunca mostram números diferentes.
 */

import type { TempoRegistrado } from "@n1/dominio/derive";

export function minutos(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}

export interface TextoDoTempo {
  readonly total: string;
  readonly emAndamento: boolean;
  /** Só quando alguma Subtarefa tem tempo: `minutosComSubtarefas > minutos`. */
  readonly comSubtarefas?: string;
}

export function textoDoTempo(tempo: TempoRegistrado): TextoDoTempo {
  const base = { total: minutos(tempo.minutos), emAndamento: tempo.emAndamento };
  return tempo.minutosComSubtarefas > tempo.minutos
    ? { ...base, comSubtarefas: `${minutos(tempo.minutosComSubtarefas)} com Subtarefas` }
    : base;
}
