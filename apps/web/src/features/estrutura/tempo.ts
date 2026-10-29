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

/**
 * O valor da linha "Rastrear tempo" da Tarefa aberta (11-07). "Iniciar" quando
 * não há nada a mostrar; senão as partes não vazias separadas por " · ", e a
 * primeira é sempre o mesmo `textoDoTempo(tempo).total` do editor.
 */
export function valorDaLinhaDeTempo(tempo: TempoRegistrado): string {
  const texto = textoDoTempo(tempo);
  if (tempo.lancamentos === 0 && texto.comSubtarefas === undefined) return "Iniciar";
  const partes = [
    texto.total,
    tempo.lancamentos > 0 ? `${tempo.lancamentos} ${tempo.lancamentos === 1 ? "registro" : "registros"}` : "",
    texto.emAndamento ? "em andamento" : "",
    texto.comSubtarefas ?? "",
  ];
  return partes.filter((parte) => parte !== "").join(" · ");
}

export function textoDoTempo(tempo: TempoRegistrado): TextoDoTempo {
  const base = { total: minutos(tempo.minutos), emAndamento: tempo.emAndamento };
  return tempo.minutosComSubtarefas > tempo.minutos
    ? { ...base, comSubtarefas: `${minutos(tempo.minutosComSubtarefas)} com Subtarefas` }
    : base;
}
