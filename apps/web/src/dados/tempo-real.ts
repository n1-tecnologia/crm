"use client";

/**
 * Esqueleto do tempo real da tela (16-08): só os tipos e os nomes, para o teste do tracador compilar.
 * A implementacao vem no commit seguinte.
 */

import type { EventoParaATela } from "@n1/dominio/crm/eventos";

export const INTERVALO_SEM_TEMPO_REAL_MS = 5_000;
export const ESPERA_MAXIMA_DE_RECONEXAO_MS = 30_000;
export const JANELA_DE_AGRUPAMENTO_MS = 300;

export interface OpcoesDaConexao {
  obterToken(): Promise<string | undefined>;
  urlBase: string;
  fetchImpl?: typeof fetch;
  aoEventos(eventos: readonly EventoParaATela[]): void;
  aoReler(): void;
  aoAbrir(): void;
  aoCair(): void;
  agendar?: typeof setTimeout;
}

export function lerQuadrosSse(resto: string, pedaco: string): { eventos: EventoParaATela[]; resto: string } {
  void pedaco;
  return { eventos: [], resto };
}

export function chavesDoEvento(evento: EventoParaATela): readonly string[] {
  void evento;
  return [];
}

export function criarConexaoDoTempoReal(opcoes: OpcoesDaConexao): { parar(): void } {
  void opcoes;
  return { parar() {} };
}

export function AcompanhanteDoTempoReal(): null {
  return null;
}
